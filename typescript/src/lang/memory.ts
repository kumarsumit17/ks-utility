// Translation memory (specs/translating.md, "Translation memory"): every English text that is
// already translated, in any folder of any app, offered again for the same or a similar text.

import { isPlural, type Catalog, type Entry } from "./catalog.ts";

/** One translated text: the English, its translation and where it comes from. */
export interface MemoryUnit {
  english: Entry;
  translation: Entry;
  /** The folder (or app) the pair was found in. */
  source: string;
  key: string;
}

export interface MemoryMatch extends MemoryUnit {
  /** 100 for the same English text; less for a similar one. */
  score: number;
}

function sourceText(e: Entry): string {
  return isPlural(e) ? e.other : e;
}

/** Two entries are the same English when their texts (all forms) are equal. */
function sameEnglish(a: Entry, b: Entry): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Levenshtein distance of two strings (characters, not bytes). */
export function editDistance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[y.length];
}

/** How alike two texts are, 0 to 100, ignoring case: 100 when equal. */
export function similarity(a: string, b: string): number {
  const p = a.toLowerCase();
  const q = b.toLowerCase();
  if (p === q) return 100;
  const longest = Math.max([...p].length, [...q].length);
  return longest === 0 ? 100 : Math.floor(100 * (1 - editDistance(p, q) / longest));
}

/** The memory of one language: the translated pairs of every `{ en, [lang] }` folder given. */
export function buildMemory(lang: string, folders: readonly { source: string; catalogs: Record<string, Catalog | undefined> }[]): MemoryUnit[] {
  const out: MemoryUnit[] = [];
  for (const f of folders) {
    const en = f.catalogs.en;
    const tr = f.catalogs[lang];
    if (!en || !tr) continue;
    for (const [key, english] of Object.entries(en)) {
      const translation = tr[key];
      if (translation !== undefined && isPlural(english) === isPlural(translation)) out.push({ english, translation, source: f.source, key });
    }
  }
  return out;
}

/**
 * Matches for `english` in `memory`, best first: the same English (100), then similar texts
 * scoring at least `min` (default 70). At most `limit` (default 5); one per translation.
 * A plural is matched only with a plural, a text only with a text.
 */
export function lookUp(memory: readonly MemoryUnit[], english: Entry, min = 70, limit = 5): MemoryMatch[] {
  const text = sourceText(english);
  const matches: MemoryMatch[] = [];
  for (const u of memory) {
    if (isPlural(u.english) !== isPlural(english)) continue;
    const score = sameEnglish(u.english, english) ? 100 : Math.min(99, similarity(sourceText(u.english), text));
    if (score >= min) matches.push({ ...u, score });
  }
  matches.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return matches.filter((m) => {
    const id = JSON.stringify(m.translation);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, limit);
}
