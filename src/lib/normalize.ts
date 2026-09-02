import type { Heartbeat } from "../types";

/**
 * Accepts a bare array of heartbeats, a `{ heartbeats: [...] }` wrapper, or any
 * object whose first array-of-objects property looks like one. Tolerates `t`
 * (seconds since the first heartbeat) or `time`/`timestamp` (a Unix timestamp,
 * converted to relative seconds) as the time field, and fills in sensible
 * defaults for missing/null fields.
 */
export function normalizeHeartbeats(raw: unknown): Heartbeat[] {
  const arr = findHeartbeatArray(raw);
  if (!arr || !arr.length) {
    throw new Error('No heartbeats found — expected a "heartbeats" array of objects.');
  }

  const timeKey = findTimeKey(arr);
  if (!timeKey) {
    throw new Error('Heartbeats are missing a time field ("t", "time", or "timestamp").');
  }

  const rawTimes = arr
    .map((h) => (isRecord(h) && typeof h[timeKey] === "number" ? (h[timeKey] as number) : null))
    .filter((v): v is number => v !== null);
  const minTime = Math.min(...rawTimes);
  const looksAbsolute = timeKey !== "t" || minTime > 1e6;

  const out: Heartbeat[] = [];
  for (const hbRaw of arr) {
    if (!isRecord(hbRaw) || typeof hbRaw[timeKey] !== "number") continue;
    const t = hbRaw[timeKey] as number;
    out.push({
      t: looksAbsolute ? t - minTime : t,
      write: !!hbRaw.write,
      project: strOr(hbRaw.project, "Unnamed project"),
      file: strOr(hbRaw.file, "(untitled)"),
      language: hbRaw.language == null || hbRaw.language === "" ? null : String(hbRaw.language),
      category: strOr(hbRaw.category, "coding"),
      editor: strOr(hbRaw.editor, "Unknown editor"),
      lines: typeof hbRaw.lines === "number" ? hbRaw.lines : null,
      sourceType: strOr(hbRaw.sourceType, "unknown"),
    });
  }
  out.sort((a, b) => a.t - b.t);
  if (!out.length) throw new Error("Heartbeats did not contain any usable time values.");
  return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function strOr(v: unknown, fallback: string): string {
  return v == null || v === "" ? fallback : String(v);
}

function findHeartbeatArray(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (isRecord(raw)) {
    if (Array.isArray(raw.heartbeats)) return raw.heartbeats;
    for (const key of Object.keys(raw)) {
      const v = raw[key];
      if (Array.isArray(v) && v.length && typeof v[0] === "object" && v[0] !== null) return v;
    }
  }
  return null;
}

function findTimeKey(arr: unknown[]): "t" | "time" | "timestamp" | null {
  for (const h of arr) {
    if (!isRecord(h)) continue;
    if (typeof h.t === "number") return "t";
    if (typeof h.time === "number") return "time";
    if (typeof h.timestamp === "number") return "timestamp";
  }
  return null;
}

/** Groups editor labels that differ only in punctuation/case, e.g. "antigravity-ide" and "antigravityide". */
export function editorGroupKey(editor: string): string {
  return editor.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** For each normalized editor key, picks the most-frequent original label to display. */
export function buildEditorLabelMap(heartbeats: Heartbeat[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const hb of heartbeats) {
    const key = editorGroupKey(hb.editor);
    if (!counts.has(key)) counts.set(key, new Map());
    const m = counts.get(key)!;
    m.set(hb.editor, (m.get(hb.editor) || 0) + 1);
  }
  const labelFor = new Map<string, string>();
  counts.forEach((m, key) => {
    let best = key,
      bestCount = -1;
    m.forEach((count, label) => {
      if (count > bestCount) {
        bestCount = count;
        best = label;
      }
    });
    labelFor.set(key, best);
  });
  return labelFor;
}
