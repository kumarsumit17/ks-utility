// Human-readable sizes, speeds and durations. Binary units (1 KB = 1024 bytes).

const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** "Unknown" for null; one decimal below 100 of a unit, whole numbers above. */
export function formatBytes(n: number | null): string {
  if (n === null) return "Unknown";
  let v = n;
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${UNITS[i]}`;
}

/** Bytes per second as "1.5 MB/s"; empty when not moving (0 or less). */
export function formatSpeed(bps: number): string {
  return bps > 0 ? `${formatBytes(bps)}/s` : "";
}

/** "m:ss", or "h:mm:ss" from one hour; empty when unknown (null, NaN or infinite). */
export function formatTimeLeft(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "";
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
