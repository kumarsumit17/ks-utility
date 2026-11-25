// Pseudo-localisation (specs/translating.md, "Pseudo-localisation"): English made to look
// foreign, longer and bracketed, so a layout that clips text, text built from pieces, and
// text that is not in the language files show up before any translation exists.

import { isPlural, type Catalog, type Entry } from "./catalog.ts";

/** The pseudo-language code: Android's own English pseudo-locale. */
export const PSEUDO_LANGUAGE = "en-XA";

const ACCENTED: Record<string, string> = {
  a: "á", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "í", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ",
  n: "ñ", o: "ó", p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "ú", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Í", J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ",
  N: "Ñ", O: "Ó", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Ú", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};
const FILLER = "one two three four five six seven eight nine ten".split(" ");

/**
 * `text` pseudo-localised: letters accented, about 40 % longer (German and Russian often are),
 * and in brackets, so a clipped end is visible: "Settings" → "[Šéţţíñĝš one two]". Placeholders
 * (`{name}`) are kept as they are.
 */
export function pseudoLocalize(text: string): string {
  const parts = text.split(/(\{[A-Za-z][A-Za-z0-9]*\})/);
  const body = parts.map((p, i) => (i % 2 === 1 ? p : [...p].map((c) => ACCENTED[c] ?? c).join(""))).join("");
  const letters = text.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, "").length;
  let extra = "";
  for (let i = 0; extra.length < Math.ceil(letters * 0.4); i++) extra += (extra ? " " : "") + FILLER[i % FILLER.length];
  return `[${body}${extra ? " " + extra : ""}]`;
}

/** A whole English catalog pseudo-localised (plural forms each). */
export function pseudoCatalog(english: Catalog): Catalog {
  const out: Catalog = {};
  for (const [key, e] of Object.entries(english)) {
    out[key] = isPlural(e)
      ? (Object.fromEntries(Object.entries(e).map(([c, t]) => [c, pseudoLocalize(t as string)])) as Entry)
      : pseudoLocalize(e);
  }
  return out;
}
