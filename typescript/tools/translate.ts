// The translation editor (specs/translating.md): a page served on this computer only
// (127.0.0.1, a random token in the address), where English and each translation stand side
// by side, with plural forms per language, quality checks, translation memory, glossary,
// translators' notes, outdated and approved states. It writes a language file only when the
// file passes the language-file check. Node's own `http`; nothing is installed, and nothing
// is sent anywhere.

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PLURAL_CATEGORIES, type Catalog, type Entry } from "../src/lang/catalog.ts";
import { checkLanguages, type GlossaryTerm, type Term } from "../src/lang/check.ts";
import { isLanguageCode, nativeLanguageName } from "../src/lang/language.ts";
import { buildMemory, lookUp } from "../src/lang/memory.ts";
import { qaCheck } from "../src/lang/qa.ts";
import {
  STATE_FILE,
  keyStatus,
  nextState,
  progress,
  readContext,
  readGlossaries,
  readJson,
  readLanguages,
  readState,
  translationLanguages,
  writeJson,
} from "./files.ts";

export interface EditorOptions {
  /** Language folders to translate (each with en.json). */
  dirs: string[];
  /** Folders only read for translation memory (other apps, the shared catalogue). */
  memory?: string[];
  /** The ks-utility folder: the shared catalogue, the term list and the glossaries. */
  root: string;
  /** Languages to offer even where no file exists yet ("fr"). */
  languages?: string[];
  /** 0 or none: any free port. */
  port?: number;
}

export interface Editor {
  url: string;
  token: string;
  close(): Promise<void>;
}

const PAGE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "translate.html"), "utf8");
const MAX_BODY = 4 * 1024 * 1024;

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function categories(lang: string): string[] {
  const used = new Set<string>(new Intl.PluralRules(lang).resolvedOptions().pluralCategories);
  return PLURAL_CATEGORIES.filter((c) => used.has(c));
}

/** Starts the editor; it runs until `close()`. */
export async function startEditor(options: EditorOptions): Promise<Editor> {
  const token = randomBytes(18).toString("base64url");
  const dirs = options.dirs.map((d) => resolve(d));
  const memoryDirs = [join(options.root, "lang/common"), ...(options.memory ?? []).map((d) => resolve(d))].filter((d) => !dirs.includes(d));
  const terms = readJson(join(options.root, "lang/hindi-terms.json")) as Term[];
  const glossaries = (): Record<string, GlossaryTerm[]> => readGlossaries(options.root).glossaries;
  const extra = (options.languages ?? []).filter((l) => isLanguageCode(l) && l !== "en");
  const name = (d: string) => relative(process.cwd(), d) || basename(d);

  const folder = (id: unknown): string => {
    const i = Number(id);
    if (!Number.isInteger(i) || i < 0 || i >= dirs.length) throw new HttpError(404, "no such folder");
    return dirs[i];
  };
  const language = (v: unknown): string => {
    if (typeof v !== "string" || !isLanguageCode(v) || v === "en") throw new HttpError(400, "not a language to translate into");
    return v;
  };
  const english = (dir: string): Catalog => {
    const en = readLanguages(dir).en;
    if (!en) throw new HttpError(409, `${name(dir)} has no en.json`);
    return en as Catalog;
  };

  /** Every translated pair of `lang` in the editor's and the memory folders. */
  const memory = (lang: string) =>
    buildMemory(
      lang,
      [...dirs, ...memoryDirs].map((d) => {
        try {
          return { source: name(d), catalogs: readLanguages(d) as Record<string, Catalog> };
        } catch {
          return { source: name(d), catalogs: {} };
        }
      }),
    );

  const project = () => ({
    folders: dirs.map((d, id) => {
      const catalogs = readLanguages(d);
      return { id, name: name(d), progress: catalogs.en ? progress(catalogs, readState(d), extra) : [] };
    }),
    languages: translationLanguages([...dirs.flatMap((d) => Object.keys(readLanguages(d))), ...extra]).map((code) => ({ code, name: nativeLanguageName(code) })),
  });

  const folderView = (id: unknown, langArg: unknown) => {
    const dir = folder(id);
    const lang = language(langArg);
    const catalogs = readLanguages(dir);
    const en = english(dir);
    const tr = (catalogs[lang] ?? {}) as Catalog;
    const state = readState(dir)[lang] ?? {};
    const { context } = readContext(dir);
    const mem = memory(lang);
    const exact = new Map<string, Entry>();
    for (const u of mem) {
      const k = JSON.stringify(u.english);
      if (!exact.has(k) && !(u.source === name(dir) && u.key in tr)) exact.set(k, u.translation);
    }
    const g = glossaries()[lang] ?? [];
    return {
      folder: { id: Number(id), name: name(dir) },
      lang,
      langName: nativeLanguageName(lang),
      categories: categories(lang),
      required: lang === "hi",
      glossary: g,
      progress: progress({ ...catalogs, [lang]: tr }, readState(dir), [lang]).find((p) => p.lang === lang),
      rows: Object.entries(en).map(([key, e]) => {
        const t = tr[key];
        const qa = qaCheck(lang, key, e, t, { glossary: g, context: context[key] });
        return {
          key,
          en: e,
          translation: t ?? null,
          status: keyStatus(e, t, state[key]),
          note: context[key]?.note ?? null,
          maxLength: context[key]?.maxLength ?? null,
          suggestion: t === undefined ? (exact.get(JSON.stringify(e)) ?? null) : null,
          errors: t === undefined ? [] : qa.errors,
          warnings: t === undefined ? [] : qa.warnings,
        };
      }),
    };
  };

  const qa = (body: Record<string, unknown>) => {
    const dir = folder(body.folder);
    const lang = language(body.lang);
    const en = english(dir);
    const key = String(body.key);
    if (!(key in en)) throw new HttpError(404, "no such key");
    const { context } = readContext(dir);
    return qaCheck(lang, key, en[key], cleanEntry(body.entry), { glossary: glossaries()[lang] ?? [], context: context[key] });
  };

  const suggestions = (body: Record<string, unknown>) => {
    const dir = folder(body.folder);
    const lang = language(body.lang);
    const en = english(dir);
    const key = String(body.key);
    if (!(key in en)) throw new HttpError(404, "no such key");
    return lookUp(memory(lang).filter((u) => !(u.source === name(dir) && u.key === key)), en[key]).map((m) => ({
      score: m.score,
      english: m.english,
      translation: m.translation,
      source: `${m.source} · ${m.key}`,
    }));
  };

  /** Fills the untranslated keys that have a translation of the same English elsewhere (not saved). */
  const pretranslate = (body: Record<string, unknown>) => {
    const view = folderView(body.folder, body.lang);
    const changes: Record<string, Entry> = {};
    for (const r of view.rows) if (r.translation === null && r.suggestion !== null) changes[r.key] = r.suggestion;
    return { changes };
  };

  const save = (body: Record<string, unknown>) => {
    const dir = folder(body.folder);
    const lang = language(body.lang);
    const catalogs = readLanguages(dir);
    const en = english(dir);
    const prev = (catalogs[lang] ?? {}) as Catalog;
    const changes = (typeof body.changes === "object" && body.changes !== null ? body.changes : {}) as Record<string, unknown>;
    const next: Catalog = {};
    for (const key of Object.keys(en)) {
      const v = key in changes ? cleanEntry(changes[key]) : prev[key];
      if (v !== undefined) next[key] = v;
    }
    const unknown = Object.keys(changes).filter((k) => !(k in en));
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x in next) : []);
    const problems = [
      ...unknown.map((k) => `"${k}" is not in English`),
      ...checkLanguages({ en, [lang]: next }, terms, {
        required: lang === "hi" ? ["en", "hi"] : ["en"],
        glossaries: glossaries(),
      }).filter((p) => p.startsWith(`${lang}: `) || p.includes(` ${lang} `) || p.includes(`not in ${lang}`)),
    ];
    if (problems.length) return { saved: false, problems };
    writeJson(join(dir, `${lang}.json`), next);
    const state = readState(dir);
    state[lang] = nextState(en, prev, next, state[lang], list(body.approve), list(body.unapprove), list(body.confirm));
    writeJson(join(dir, STATE_FILE), state);
    return { saved: true, problems: [], view: folderView(body.folder, lang) };
  };

  const server = createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      const status = e instanceof HttpError ? e.status : 500;
      send(res, status, { error: (e as Error).message });
    });
  });

  let base = "";
  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const host = req.headers.host ?? "";
    const port = (server.address() as AddressInfo).port;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) throw new HttpError(421, "wrong host");
    const url = new URL(req.url ?? "/", base);
    if (req.method === "GET" && url.pathname === "/") {
      if (url.searchParams.get("t") !== token) throw new HttpError(403, "open the address the command printed");
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:",
        "referrer-policy": "no-referrer",
      });
      res.end(PAGE);
      return;
    }
    if (req.headers["x-ks-token"] !== token) throw new HttpError(403, "missing token");
    if (req.method === "GET" && url.pathname === "/api/project") return send(res, 200, project());
    if (req.method === "GET" && url.pathname === "/api/folder") return send(res, 200, folderView(url.searchParams.get("folder"), url.searchParams.get("lang")));
    if (req.method !== "POST") throw new HttpError(404, "not found");
    if (!(req.headers["content-type"] ?? "").startsWith("application/json")) throw new HttpError(415, "JSON expected");
    const body = await readBody(req);
    if (url.pathname === "/api/qa") return send(res, 200, qa(body));
    if (url.pathname === "/api/suggestions") return send(res, 200, suggestions(body));
    if (url.pathname === "/api/pretranslate") return send(res, 200, pretranslate(body));
    if (url.pathname === "/api/save") return send(res, 200, save(body));
    throw new HttpError(404, "not found");
  }

  await new Promise<void>((ok, fail) => {
    server.once("error", fail);
    server.listen(options.port ?? 0, "127.0.0.1", () => ok());
  });
  const port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
  return {
    url: `${base}/?t=${token}`,
    token,
    close: () =>
      new Promise<void>((ok) => {
        server.closeAllConnections();
        server.close(() => ok());
      }),
  };
}

/** An entry from the page: a text, or plural forms; empty texts and forms are left out. */
function cleanEntry(v: unknown): Entry | undefined {
  if (typeof v === "string") return v === "" ? undefined : v;
  if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
  const forms: Record<string, string> = {};
  for (const c of PLURAL_CATEGORIES) {
    const t = (v as Record<string, unknown>)[c];
    if (typeof t === "string" && t !== "") forms[c] = t;
  }
  return Object.keys(forms).length ? (forms as Entry) : undefined;
}

function send(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        fail(new HttpError(413, "too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error();
        ok(v as Record<string, unknown>);
      } catch {
        fail(new HttpError(400, "invalid JSON"));
      }
    });
    req.on("error", fail);
  });
}

