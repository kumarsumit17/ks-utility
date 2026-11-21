// Human-readable sizes, speeds and durations. Binary units (1 KB = 1024 bytes).
// Without a locale the output is fixed ("1.5 KB", as before); with one, numbers are
// formatted for that language by the built-in Intl, always with Latin digits.

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export interface FormatOptions {
  /** A BCP 47 language tag ("en", "hi"). */
  locale?: string;
  /** What `formatBytes` returns for an unknown size (default "Unknown"). */
  unknown?: string;
}

const cache = new Map<string, Intl.NumberFormat>();

function number(locale: string, digits: number, minInt = 1, grouping = true): Intl.NumberFormat {
  const id = `${locale}|${digits}|${minInt}|${grouping}`;
  let f = cache.get(id);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      numberingSystem: "latn",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      minimumIntegerDigits: minInt,
      useGrouping: grouping,
    });
    cache.set(id, f);
  }
  return f;
}

/** "Unknown" for null; one decimal below 100 of a unit, whole numbers above. */
export function formatBytes(n: number | null, options: FormatOptions = {}): string {
  if (n === null) return options.unknown ?? "Unknown";
  let v = n;
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  const whole = v >= 100 || i === 0;
  if (options.locale === undefined) return `${whole ? Math.round(v) : v.toFixed(1)} ${UNITS[i]}`;
  return `${number(options.locale, whole ? 0 : 1).format(whole ? Math.round(v) : v)} ${UNITS[i]}`;
}

/** Bytes per second as "1.5 MB/s"; empty when not moving (0 or less). */
export function formatSpeed(bps: number, options: FormatOptions = {}): string {
  return bps > 0 ? `${formatBytes(bps, options)}/s` : "";
}

/** "m:ss", or "h:mm:ss" from one hour; empty when unknown (null, NaN or infinite). */
export function formatTimeLeft(seconds: number | null, options: FormatOptions = {}): string {
  if (seconds === null || !Number.isFinite(seconds)) return "";
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const locale = options.locale;
  const plain = (x: number) => (locale === undefined ? String(x) : number(locale, 0, 1, false).format(x));
  const pad = (x: number) => (locale === undefined ? String(x).padStart(2, "0") : number(locale, 0, 2, false).format(x));
  return h > 0 ? `${plain(h)}:${pad(m)}:${pad(sec)}` : `${plain(m)}:${pad(sec)}`;
}
