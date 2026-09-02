import type { Heartbeat } from "../types";

export interface GapBucketEvidence {
  value: number;
  count: number;
  share: number;
}

export interface FileIntegrityRow {
  project: string;
  file: string;
  writes: number;
  minLines: number;
  maxLines: number;
  changed: boolean;
}

export type VerdictLevel = "pass" | "caution" | "flag" | "insufficient";

export interface AuthenticityVerdict {
  level: VerdictLevel;
  headline: string;
  reasons: string[];
}

export interface AuthenticitySignals {
  activeGapCount: number;
  meanGap: number;
  stddevGap: number;
  cv: number | null;
  topGaps: GapBucketEvidence[];
  modalShare: number;
  nearDuplicateShare: number;
  fileIntegrity: FileIntegrityRow[];
  staticWriteFileShare: number | null;
  verdict: AuthenticityVerdict;
}

const MIN_GAPS_FOR_TIMING = 15;
const MIN_WRITES_PER_FILE = 3;
const MIN_FILES_FOR_WRITE_SIGNAL = 2;
const NEAR_DUPLICATE_TOLERANCE = 0.02; // ±2% of the modal gap value

function collectActiveGaps(heartbeats: Heartbeat[], thresholdSec: number): number[] {
  const gaps: number[] = [];
  for (let i = 0; i < heartbeats.length - 1; i++) {
    const gap = heartbeats[i + 1].t - heartbeats[i].t;
    if (gap > 0 && gap <= thresholdSec) gaps.push(gap);
  }
  return gaps;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Files with enough recorded writes to ask "did the line count ever actually move?" */
function buildFileIntegrity(heartbeats: Heartbeat[]): FileIntegrityRow[] {
  interface Rec {
    project: string;
    file: string;
    writes: number;
    minLines: number;
    maxLines: number;
  }
  const map = new Map<string, Rec>();
  for (const hb of heartbeats) {
    if (!hb.write || hb.lines == null) continue;
    const key = `${hb.project} ${hb.file}`;
    let rec = map.get(key);
    if (!rec) {
      rec = { project: hb.project, file: hb.file, writes: 0, minLines: hb.lines, maxLines: hb.lines };
      map.set(key, rec);
    }
    rec.writes++;
    rec.minLines = Math.min(rec.minLines, hb.lines);
    rec.maxLines = Math.max(rec.maxLines, hb.lines);
  }
  const rows: FileIntegrityRow[] = [];
  map.forEach((rec) => {
    if (rec.writes < MIN_WRITES_PER_FILE) return;
    rows.push({
      project: rec.project,
      file: rec.file,
      writes: rec.writes,
      minLines: rec.minLines,
      maxLines: rec.maxLines,
      changed: rec.maxLines > rec.minLines,
    });
  });
  rows.sort((a, b) => b.writes - a.writes);
  return rows;
}

/**
 * Heuristic-only read on whether the timing and editing patterns in this export
 * look like a person coding, or like something pinging on a fixed timer without
 * matching edits. Two independent signals, both grounded in how real editor
 * plugins actually behave:
 *
 *  - **Gap regularity.** A real heartbeat fires off keystrokes and file saves,
 *    so the spacing between heartbeats is close to memoryless — it varies a lot.
 *    A script that just pings on a timer produces gaps clustered tightly around
 *    one value.
 *  - **Writes without growth.** A `write` heartbeat with a `lines` count that
 *    never moves across a whole session, on a file touched repeatedly, means
 *    saves are being recorded without matching edits.
 *
 * Neither signal is proof by itself — a genuinely fast, rhythmic typist or a
 * session of pure refactoring can each look unusual on one axis. The verdict
 * only escalates when multiple signals agree, and every number behind it is
 * shown alongside it so it can be checked by hand.
 */
export function computeAuthenticitySignals(heartbeats: Heartbeat[], thresholdSec: number): AuthenticitySignals {
  const gaps = collectActiveGaps(heartbeats, thresholdSec);
  const fileIntegrity = buildFileIntegrity(heartbeats);
  const staticCount = fileIntegrity.filter((r) => !r.changed).length;
  const staticWriteFileShare = fileIntegrity.length >= MIN_FILES_FOR_WRITE_SIGNAL ? staticCount / fileIntegrity.length : null;

  if (gaps.length < MIN_GAPS_FOR_TIMING) {
    return {
      activeGapCount: gaps.length,
      meanGap: 0,
      stddevGap: 0,
      cv: null,
      topGaps: [],
      modalShare: 0,
      nearDuplicateShare: 0,
      fileIntegrity,
      staticWriteFileShare,
      verdict: {
        level: "insufficient",
        headline: "Not enough active heartbeats to assess timing patterns",
        reasons: [
          `Only ${gaps.length} active gap${gaps.length === 1 ? "" : "s"} at the current idle threshold — timing ` +
            `analysis needs at least ${MIN_GAPS_FOR_TIMING} to say anything meaningful. Try a longer session, or ` +
            "widen the idle threshold above.",
        ],
      },
    };
  }

  const avg = mean(gaps);
  const sd = stddev(gaps, avg);
  const cv = avg > 0 ? sd / avg : 0;

  const freq = new Map<string, number>();
  gaps.forEach((g) => {
    const key = g.toFixed(2);
    freq.set(key, (freq.get(key) || 0) + 1);
  });
  const topGaps: GapBucketEvidence[] = Array.from(freq.entries())
    .map(([k, count]) => ({ value: Number(k), count, share: count / gaps.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const modalValue = topGaps[0]?.value ?? 0;
  const modalShare = topGaps[0]?.share ?? 0;
  const nearDupCount = gaps.filter((g) => modalValue > 0 && Math.abs(g - modalValue) / modalValue <= NEAR_DUPLICATE_TOLERANCE).length;
  const nearDuplicateShare = nearDupCount / gaps.length;

  const timingFlag = cv < 0.2 && nearDuplicateShare > 0.45;
  const timingCaution = cv < 0.45 || nearDuplicateShare > 0.3;
  const writesCaution = staticWriteFileShare != null && staticWriteFileShare > 0.7;

  const reasons: string[] = [];
  let level: VerdictLevel;

  if (timingFlag) {
    level = "flag";
    reasons.push(
      `${(nearDuplicateShare * 100).toFixed(0)}% of the ${gaps.length} active gaps land within 2% of a single ` +
        `value (${modalValue.toFixed(2)}s). A coefficient of variation of ${cv.toFixed(2)} is far tighter than the ` +
        "irregular rhythm of real typing and file-save activity, and reads more like a script pinging on a fixed timer.",
    );
    if (writesCaution) {
      reasons.push(
        `${(staticWriteFileShare! * 100).toFixed(0)}% of the frequently-written files never gained a line across ` +
          "the session — writes are being logged without matching code growth.",
      );
    }
  } else if (timingCaution || writesCaution) {
    level = "caution";
    if (timingCaution) {
      reasons.push(
        `Gap timing is more regular than typical human activity (coefficient of variation ${cv.toFixed(2)}, ` +
          `${(modalShare * 100).toFixed(0)}% of gaps repeat the same ${modalValue.toFixed(2)}s value). Not ` +
          "conclusive alone — worth reading alongside the file-growth evidence below.",
      );
    }
    if (writesCaution) {
      reasons.push(
        `${(staticWriteFileShare! * 100).toFixed(0)}% of the frequently-written files show no line-count growth ` +
          "across the session.",
      );
    }
  } else {
    level = "pass";
    reasons.push(
      `Gap timing has the irregular spread (coefficient of variation ${cv.toFixed(2)}) typical of activity-driven ` +
        `heartbeats rather than a fixed-interval script — the most-repeated gap value accounts for only ` +
        `${(modalShare * 100).toFixed(0)}% of all ${gaps.length} gaps.`,
    );
    if (staticWriteFileShare != null) {
      reasons.push(`${((1 - staticWriteFileShare) * 100).toFixed(0)}% of the frequently-written files show real line-count growth.`);
    }
  }

  const headline =
    level === "flag"
      ? "Multiple statistical signals typical of automated or scripted activity"
      : level === "caution"
        ? "A few patterns are worth a closer look"
        : "No strong signs of automation — timing looks human-driven";

  return { activeGapCount: gaps.length, meanGap: avg, stddevGap: sd, cv, topGaps, modalShare, nearDuplicateShare, fileIntegrity, staticWriteFileShare, verdict: { level, headline, reasons } };
}
