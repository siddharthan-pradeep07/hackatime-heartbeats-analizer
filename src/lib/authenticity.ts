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

export interface EditAnomalyRow {
  project: string;
  file: string;
  occurrences: number;
  maxJump: number;
  minGapSec: number;
}

/** One specific, named file with a concrete integrity concern and a plain-language reason for each. */
export interface FlaggedFileRow {
  project: string;
  file: string;
  reasons: string[];
}

export type VerdictLevel = "pass" | "caution" | "flag" | "insufficient";

export interface AuthenticityVerdict {
  level: VerdictLevel;
  headline: string;
  reasons: string[];
}

export interface AuthenticitySignals {
  activeGapCount: number;
  /** Gaps ≤ BURST_GAP_SEC, excluded from the timing-regularity read below — see module docs. */
  burstGapCount: number;
  burstShare: number;
  pacingGapCount: number;
  /** Whether the timing read below actually used pacing-only gaps (false if there weren't enough, and it fell back to every active gap, bursts included). */
  usedPacingGaps: boolean;
  meanGap: number;
  stddevGap: number;
  cv: number | null;
  topGaps: GapBucketEvidence[];
  modalShare: number;
  nearDuplicateShare: number;
  fileIntegrity: FileIntegrityRow[];
  staticWriteFileShare: number | null;
  editAnomalies: EditAnomalyRow[];
  flaggedFiles: FlaggedFileRow[];
  verdict: AuthenticityVerdict;
}

const MIN_GAPS_FOR_TIMING = 15;
const MIN_WRITES_PER_FILE = 3;
const MIN_FILES_FOR_WRITE_SIGNAL = 2;
const NEAR_DUPLICATE_TOLERANCE = 0.02; // ±2% of the modal gap value

/**
 * Gaps at or below this are treated as one "turn" rather than independent
 * pacing signal — see the module docs above `computeAuthenticitySignals`.
 */
const BURST_GAP_SEC = 2;

/**
 * A same-file re-heartbeat this close together, this large a line-count
 * swing, reads as an anomaly candidate. Deliberately loose: real gaming of
 * a time tracker often leaves a small, specific trace rather than an
 * unmistakable one, so this is tuned to surface that trace — see module docs.
 */
const ANOMALY_GAP_SEC = 25;
const ANOMALY_MIN_JUMP_LINES = 50;
const ANOMALY_MIN_JUMP_RATIO = 0.12; // or 12% of the file, whichever is larger
const MIN_ANOMALY_OCCURRENCES = 2;

interface GapInfo {
  gap: number;
  sameFile: boolean;
}

/**
 * Real exports sometimes leave `project` blank on some heartbeats for a file
 * that's clearly named elsewhere in the same session (normalize.ts falls
 * back to the literal string "Unnamed project"). Grouping the raw
 * (project, file) pair as-is would then split that one file's write history
 * into several partial buckets — one of which can spuriously look "the line
 * count never moved" simply because it only caught a slice of the file's
 * actual writes, not because nothing changed. When a file has exactly one
 * named project across the whole session, every heartbeat for that file is
 * folded into it before any signal below runs.
 */
function canonicalizeProjects(heartbeats: Heartbeat[]): Heartbeat[] {
  const NO_PROJECT = "Unnamed project";
  const projectsByFile = new Map<string, Set<string>>();
  for (const hb of heartbeats) {
    if (hb.project === NO_PROJECT) continue;
    let set = projectsByFile.get(hb.file);
    if (!set) {
      set = new Set();
      projectsByFile.set(hb.file, set);
    }
    set.add(hb.project);
  }
  return heartbeats.map((hb) => {
    const named = projectsByFile.get(hb.file);
    if (named && named.size === 1) {
      const only = named.values().next().value as string;
      if (hb.project !== only) return { ...hb, project: only };
    }
    return hb;
  });
}

function collectActiveGaps(heartbeats: Heartbeat[], thresholdSec: number): GapInfo[] {
  const gaps: GapInfo[] = [];
  for (let i = 0; i < heartbeats.length - 1; i++) {
    const gap = heartbeats[i + 1].t - heartbeats[i].t;
    if (gap > 0 && gap <= thresholdSec) {
      const sameFile = heartbeats[i].project === heartbeats[i + 1].project && heartbeats[i].file === heartbeats[i + 1].file;
      gaps.push({ gap, sameFile });
    }
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
 * Per file, counts back-to-back heartbeats whose `lines` value swings by a
 * large amount in a short window — e.g. a 1300-line file that loses several
 * hundred lines, gains them back, and loses them again within 90 seconds.
 * One big jump is a normal paste or bulk delete; a couple of them stacked up
 * on the same file in quick succession, especially oscillating instead of
 * trending toward a final size, doesn't look like ordinary editing.
 */
function buildEditAnomalies(heartbeats: Heartbeat[]): EditAnomalyRow[] {
  interface Rec {
    project: string;
    file: string;
    occurrences: number;
    maxJump: number;
    minGapSec: number;
  }
  const map = new Map<string, Rec>();
  const byFile = new Map<string, Heartbeat[]>();
  for (const hb of heartbeats) {
    if (hb.lines == null) continue;
    const key = `${hb.project} ${hb.file}`;
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key)!.push(hb);
  }
  byFile.forEach((list, key) => {
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      const gapSec = b.t - a.t;
      if (gapSec <= 0 || gapSec > ANOMALY_GAP_SEC) continue;
      const jump = Math.abs((b.lines ?? 0) - (a.lines ?? 0));
      const threshold = Math.max(ANOMALY_MIN_JUMP_LINES, ANOMALY_MIN_JUMP_RATIO * Math.max(a.lines ?? 0, b.lines ?? 0));
      if (jump < threshold) continue;
      let rec = map.get(key);
      if (!rec) {
        rec = { project: a.project, file: a.file, occurrences: 0, maxJump: 0, minGapSec: gapSec };
        map.set(key, rec);
      }
      rec.occurrences++;
      rec.maxJump = Math.max(rec.maxJump, jump);
      rec.minGapSec = Math.min(rec.minGapSec, gapSec);
    }
  });
  const rows: EditAnomalyRow[] = [];
  map.forEach((rec) => {
    if (rec.occurrences < MIN_ANOMALY_OCCURRENCES) return;
    rows.push(rec);
  });
  rows.sort((a, b) => b.occurrences - a.occurrences);
  return rows;
}

/**
 * Turns the per-file integrity and edit-anomaly evidence into one merged,
 * named list: every file that has *any* concrete concern attached to it,
 * each with its own plain-language reason(s), independent of whether the
 * session as a whole reads as "pass" — a single suspicious file in an
 * otherwise-clean session is still worth naming and explaining, not just
 * folded into an aggregate percentage.
 */
function buildFlaggedFiles(fileIntegrity: FileIntegrityRow[], editAnomalies: EditAnomalyRow[]): FlaggedFileRow[] {
  const map = new Map<string, FlaggedFileRow>();
  const get = (project: string, file: string) => {
    const key = `${project} ${file}`;
    let row = map.get(key);
    if (!row) {
      row = { project, file, reasons: [] };
      map.set(key, row);
    }
    return row;
  };
  for (const r of fileIntegrity) {
    if (r.changed) continue;
    get(r.project, r.file).reasons.push(`${r.writes} writes recorded, but the line count never moved (stayed at ${r.maxLines} the whole time)`);
  }
  for (const r of editAnomalies) {
    get(r.project, r.file).reasons.push(
      `line count swung by up to ${r.maxJump} lines, ${r.occurrences} separate times, as close together as ${r.minGapSec.toFixed(1)}s apart`,
    );
  }
  return Array.from(map.values()).sort((a, b) => b.reasons.length - a.reasons.length);
}

function regularityFromGaps(gaps: number[]) {
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
  return { avg, sd, cv, topGaps, modalShare, nearDuplicateShare };
}

/**
 * Heuristic-only read on whether the timing and editing patterns in this export
 * look like a person (with or without an AI coding agent) coding, or like
 * something pinging on a fixed timer without matching edits. Three
 * independent signals, each grounded in how real editor plugins and AI
 * coding agents actually behave:
 *
 *  - **Pacing-gap regularity.** A real heartbeat fires off keystrokes, file
 *    saves, or an AI agent's turns, so the spacing between *distinct actions*
 *    is close to memoryless — it varies a lot. A script that just pings on a
 *    fixed timer produces gaps clustered tightly around one value. Gaps of
 *    ≤2s are excluded from this read first: AI coding agents (Claude, Cursor,
 *    etc.) routinely touch a dozen files within the same second as part of
 *    one turn, and that burst rhythm — not the pacing between turns — is
 *    what would otherwise make a perfectly legitimate agent-heavy session
 *    look like a fixed-interval script. A same-file burst (many rapid-fire
 *    heartbeats on *one* file rather than sweeping across many) doesn't get
 *    that benefit of the doubt, since that's not how multi-file agent turns
 *    look — it reads more like something re-pinging the same file on a timer.
 *  - **Writes without growth.** A `write` heartbeat with a `lines` count that
 *    never moves across a whole session, on a file touched repeatedly, means
 *    saves are being recorded without matching edits. Any single such file
 *    is named directly in "flagged files" below with its own reason — this
 *    doesn't wait for most of the session's files to look that way before
 *    saying anything.
 *  - **Erratic line-count swings.** A file whose `lines` count jumps by a
 *    couple hundred, back, and away again, within seconds, is unlike normal
 *    editing (which trends toward a size) or a normal bulk paste/delete
 *    (which is one jump, not several oscillating ones).
 *
 * This is tuned deliberately loose: real gaming of a time tracker is often a
 * handful of files with a small, specific trace, not a session that's wrong
 * on every axis at once. So rather than requiring a large fraction of the
 * whole session to look suspicious before saying anything, individual files
 * with even a couple of concrete markers are named and explained on their
 * own — every "flagged files" row says exactly what was found and why, so
 * it can be checked by hand rather than taken on faith. In-place edits (a
 * rename, a bugfix, an AI agent's surgical patch), one big paste, and a
 * genuinely fast typist can each still look unusual on a single axis, which
 * is why this stays a heuristic pointer for review, not a proof of intent —
 * see the disclaimer shown alongside every verdict.
 */
export function computeAuthenticitySignals(rawHeartbeats: Heartbeat[], thresholdSec: number): AuthenticitySignals {
  const heartbeats = canonicalizeProjects(rawHeartbeats);
  const gapInfos = collectActiveGaps(heartbeats, thresholdSec);
  const fileIntegrity = buildFileIntegrity(heartbeats);
  const staticCount = fileIntegrity.filter((r) => !r.changed).length;
  const staticWriteFileShare = fileIntegrity.length >= MIN_FILES_FOR_WRITE_SIGNAL ? staticCount / fileIntegrity.length : null;
  const editAnomalies = buildEditAnomalies(heartbeats);
  const flaggedFiles = buildFlaggedFiles(fileIntegrity, editAnomalies);

  const burstGaps = gapInfos.filter((g) => g.gap <= BURST_GAP_SEC);
  const pacingGaps = gapInfos.filter((g) => g.gap > BURST_GAP_SEC);
  const burstShare = gapInfos.length ? burstGaps.length / gapInfos.length : 0;
  const sameFileBurstShare = burstGaps.length ? burstGaps.filter((g) => g.sameFile).length / burstGaps.length : 0;

  // Prefer the de-burst "pacing" gaps for the timing read (see module docs);
  // fall back to every active gap only when bursts have left too few of them.
  const usePacing = pacingGaps.length >= MIN_GAPS_FOR_TIMING;
  const timingGaps = (usePacing ? pacingGaps : gapInfos).map((g) => g.gap);

  if (timingGaps.length < MIN_GAPS_FOR_TIMING) {
    return {
      activeGapCount: gapInfos.length,
      burstGapCount: burstGaps.length,
      burstShare,
      pacingGapCount: pacingGaps.length,
      usedPacingGaps: usePacing,
      meanGap: 0,
      stddevGap: 0,
      cv: null,
      topGaps: [],
      modalShare: 0,
      nearDuplicateShare: 0,
      fileIntegrity,
      staticWriteFileShare,
      editAnomalies,
      flaggedFiles,
      verdict: {
        level: flaggedFiles.length > 0 ? "caution" : "insufficient",
        headline:
          flaggedFiles.length > 0
            ? "Not enough heartbeats to assess timing, but individual files show concerns"
            : "Not enough active heartbeats to assess timing patterns",
        reasons:
          flaggedFiles.length > 0
            ? [
                `Only ${timingGaps.length} usable gap${timingGaps.length === 1 ? "" : "s"} at the current idle threshold — too few for a ` +
                  "session-wide timing read. That said, the file-level evidence below stands on its own.",
              ]
            : [
                `Only ${timingGaps.length} usable gap${timingGaps.length === 1 ? "" : "s"} at the current idle threshold — timing ` +
                  `analysis needs at least ${MIN_GAPS_FOR_TIMING} to say anything meaningful. Try a longer session, or ` +
                  "widen the idle threshold above.",
              ],
      },
    };
  }

  const { avg, sd, cv, topGaps, modalShare, nearDuplicateShare } = regularityFromGaps(timingGaps);

  const timingFlag = cv < 0.3 && nearDuplicateShare > 0.4;
  const timingCaution = cv < 0.5 || nearDuplicateShare > 0.22;
  const writesCaution = staticWriteFileShare != null && staticWriteFileShare > 0.4;
  const sameFileBurstCaution = burstShare > 0.15 && sameFileBurstShare > 0.45;
  const anomalyCaution = editAnomalies.length > 0;
  const namedFileCaution = flaggedFiles.length > 0;

  const reasons: string[] = [];
  let level: VerdictLevel;

  if (timingFlag) {
    level = "flag";
    reasons.push(
      `${(nearDuplicateShare * 100).toFixed(0)}% of the ${timingGaps.length} ${usePacing ? "pacing " : ""}gaps land within 2% of a single ` +
        `value (${topGaps[0]?.value.toFixed(2)}s). A coefficient of variation of ${cv.toFixed(2)} is far tighter than the ` +
        "irregular rhythm of real typing and file-save activity, and reads more like a script pinging on a fixed timer.",
    );
    if (namedFileCaution) {
      reasons.push(
        `${flaggedFiles.length} specific file${flaggedFiles.length === 1 ? "" : "s"} ${flaggedFiles.length === 1 ? "also shows" : "also show"} concrete concerns — see the table below for each one's exact reason.`,
      );
    } else if (writesCaution) {
      reasons.push(
        `${(staticWriteFileShare! * 100).toFixed(0)}% of the frequently-written files never gained a line across ` +
          "the session — writes are being logged without matching code growth.",
      );
    }
  } else if (timingCaution || writesCaution || sameFileBurstCaution || anomalyCaution || namedFileCaution) {
    level = "caution";
    if (timingCaution) {
      reasons.push(
        `Gap timing is more regular than typical human activity (coefficient of variation ${cv.toFixed(2)}, ` +
          `${(modalShare * 100).toFixed(0)}% of gaps repeat the same ${topGaps[0]?.value.toFixed(2)}s value). Not ` +
          "conclusive alone — worth reading alongside the other evidence here.",
      );
    }
    if (sameFileBurstCaution) {
      reasons.push(
        `${(burstShare * 100).toFixed(0)}% of all gaps are sub-${BURST_GAP_SEC}s bursts, and ${(sameFileBurstShare * 100).toFixed(0)}% of ` +
          "those bursts re-hit the same file rather than sweeping across several — a real AI coding agent's rapid-fire " +
          "turns almost always touch many distinct files, so a same-file burst pattern reads more like something re-pinging on a timer.",
      );
    }
    if (namedFileCaution) {
      reasons.push(
        `${flaggedFiles.length} specific file${flaggedFiles.length === 1 ? "" : "s"} ${flaggedFiles.length === 1 ? "shows" : "show"} a concrete integrity concern — ` +
          `e.g. ${flaggedFiles[0].file}: ${flaggedFiles[0].reasons[0]}. See the table below for every file and its exact reason.`,
      );
    } else if (writesCaution) {
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
        `${(modalShare * 100).toFixed(0)}% of all ${timingGaps.length} ${usePacing ? "pacing " : ""}gaps.`,
    );
    if (usePacing && burstShare > 0.1) {
      reasons.push(
        `${(burstShare * 100).toFixed(0)}% of raw gaps are sub-${BURST_GAP_SEC}s multi-file bursts (excluded above), consistent with ` +
          "an AI coding agent touching several files in one turn rather than a script pinging on an interval.",
      );
    }
    if (staticWriteFileShare != null) {
      reasons.push(`${((1 - staticWriteFileShare) * 100).toFixed(0)}% of the frequently-written files show real line-count growth, and none were flagged individually.`);
    }
  }

  const headline =
    level === "flag"
      ? "Multiple statistical signals typical of automated or scripted activity"
      : level === "caution"
        ? "A few patterns are worth a closer look"
        : "No strong signs of automation — timing looks human-driven";

  return {
    activeGapCount: gapInfos.length,
    burstGapCount: burstGaps.length,
    burstShare,
    pacingGapCount: pacingGaps.length,
    usedPacingGaps: usePacing,
    meanGap: avg,
    stddevGap: sd,
    cv,
    topGaps,
    modalShare,
    nearDuplicateShare,
    fileIntegrity,
    staticWriteFileShare,
    editAnomalies,
    flaggedFiles,
    verdict: { level, headline, reasons },
  };
}
