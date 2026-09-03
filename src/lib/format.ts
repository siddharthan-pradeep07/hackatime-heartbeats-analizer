/** Compact duration, e.g. "3h 14m", "14m 7s", "42s". Pass `short` for axis labels ("3h", "14m"). */
export function fmtDuration(seconds: number, short = false): string {
  seconds = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return short ? `${h}h` : `${h}h ${m}m`;
  if (m > 0) return short ? `${m}m` : `${m}m ${s}s`;
  return `${s}s`;
}

/** Zero-padded clock format of an elapsed-seconds offset, e.g. "03:14:07". */
export function fmtHMS(seconds: number): string {
  seconds = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Short elapsed clock for chart axes, e.g. "3:14". */
export function fmtClock(seconds: number): string {
  seconds = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}`;
}

/** Large-number compaction, e.g. 12_340 -> "12.3K". */
export function fmtCompact(n: number): string {
  n = n || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e4) return (n / 1e3).toFixed(1) + "K";
  return Math.round(n).toLocaleString();
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Short calendar-day label, e.g. "Sep 2". */
export function fmtDayLabel(date: Date): string {
  return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
}
