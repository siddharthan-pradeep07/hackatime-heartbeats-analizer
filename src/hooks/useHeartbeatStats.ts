import { useMemo } from "react";
import type { Heartbeat, LabeledValue } from "../types";
import { buildEditorLabelMap, editorGroupKey } from "../lib/normalize";
import {
  buildBuckets,
  buildFileStats,
  buildSessions,
  computeLinesAdded,
  sumDurationsBy,
  topNPlusOther,
  totalActiveSeconds,
} from "../lib/stats";
import { fmtDuration, fmtHMS, fmtClock, fmtCompact } from "../lib/format";
import type { KpiTileData } from "../components/KpiGrid";

export interface BucketRow extends Record<string, unknown> {
  range: string;
  active: string;
  count: number;
}

export interface BreakdownRow extends Record<string, unknown> {
  label: string;
  active: string;
}

export interface SessionRow extends Record<string, unknown> {
  idx: number;
  start: string;
  duration: string;
  heartbeats: number;
  projects: string;
  language: string;
}

export interface HeartbeatStats {
  kpis: KpiTileData[];
  totalActive: number;
  noActivityWarning: boolean;
  buckets: ReturnType<typeof buildBuckets>["buckets"];
  bucketRows: BucketRow[];
  langItems: LabeledValue[];
  editorItems: LabeledValue[];
  projectItems: LabeledValue[];
  categoryItems: LabeledValue[];
  showCategoryBreakdown: boolean;
  aiMeter: { pct: number; caption: string };
  writeMeter: { pct: number; caption: string };
  fileStats: ReturnType<typeof buildFileStats>;
  sessionRows: SessionRow[];
  sourceTypeNote: string;
}

const breakdownRows = (items: LabeledValue[]): BreakdownRow[] => items.map((i) => ({ label: i.label, active: fmtDuration(i.value) }));

/** The whole analytics core, recomputed only when the dataset or idle threshold change. Null with no data loaded. */
export function useHeartbeatStats(heartbeats: Heartbeat[], thresholdSec: number): HeartbeatStats | null {
  return useMemo(() => {
    if (!heartbeats.length) return null;
    const first = heartbeats[0].t;
    const last = heartbeats[heartbeats.length - 1].t;
    const elapsed = last - first;
    const totalActive = totalActiveSeconds(heartbeats, thresholdSec);

    const sessions = buildSessions(heartbeats, thresholdSec);
    const sessionActives = sessions.map((s) => s.active);
    const longest = sessionActives.length ? Math.max(...sessionActives) : 0;
    const avgSession = sessionActives.length ? sessionActives.reduce((a, b) => a + b, 0) / sessionActives.length : 0;

    const uniqueFiles = new Set(heartbeats.map((h) => `${h.project} ${h.file}`));
    const uniqueProjects = new Set(heartbeats.map((h) => h.project));
    const uniqueLangs = new Set(heartbeats.filter((h) => h.language).map((h) => h.language));
    const uniqueEditorKeys = new Set(heartbeats.map((h) => editorGroupKey(h.editor)));
    const writes = heartbeats.filter((h) => h.write).length;
    const linesAdded = computeLinesAdded(heartbeats);

    const kpis: KpiTileData[] = [
      { label: "Active coding time", value: fmtDuration(totalActive), sub: `of ${fmtDuration(elapsed)} elapsed`, hero: true },
      { label: "Heartbeats", value: heartbeats.length.toLocaleString(), sub: `${sessions.length} session${sessions.length === 1 ? "" : "s"}` },
      { label: "Longest session", value: fmtDuration(longest), sub: `avg ${fmtDuration(avgSession)}` },
      { label: "Files touched", value: uniqueFiles.size.toLocaleString() },
      { label: "Projects", value: uniqueProjects.size.toLocaleString() },
      { label: "Languages", value: uniqueLangs.size.toLocaleString() },
      { label: "Editors", value: uniqueEditorKeys.size.toLocaleString() },
      { label: "Write ratio", value: `${heartbeats.length ? Math.round((writes / heartbeats.length) * 100) : 0}%`, sub: `${writes.toLocaleString()} writes` },
      { label: "Lines added (est.)", value: fmtCompact(linesAdded) },
    ];

    const { buckets, bucketSeconds } = buildBuckets(heartbeats, thresholdSec);
    const bucketRows: BucketRow[] = buckets.map((b) => ({
      range: `${fmtClock(b.startT)}–${fmtClock(b.startT + bucketSeconds)}`,
      active: fmtDuration(b.activeSeconds),
      count: b.count,
    }));

    const langMap = sumDurationsBy(heartbeats, thresholdSec, (h) => h.language || "No language");
    const langItems = topNPlusOther(langMap, 7);

    const catMap = sumDurationsBy(heartbeats, thresholdSec, (h) => h.category);
    const categoryItems = topNPlusOther(catMap, 6);

    const editorLabelFor = buildEditorLabelMap(heartbeats);
    const editorRawMap = sumDurationsBy(heartbeats, thresholdSec, (h) => editorGroupKey(h.editor));
    const editorMap = new Map<string, number>();
    editorRawMap.forEach((v, k) => {
      const label = editorLabelFor.get(k) || k;
      editorMap.set(label, (editorMap.get(label) || 0) + v);
    });
    const editorItems = topNPlusOther(editorMap, 6);

    const projMap = sumDurationsBy(heartbeats, thresholdSec, (h) => h.project);
    const projectItems = topNPlusOther(projMap, 6);

    let aiActive = 0;
    let manualActive = 0;
    catMap.forEach((v, k) => {
      if (/ai/i.test(k)) aiActive += v;
      else manualActive += v;
    });
    const catTotal = aiActive + manualActive || 1;
    const aiPct = (aiActive / catTotal) * 100;
    const aiMeter = {
      pct: aiPct,
      caption: `${fmtDuration(aiActive)} AI-assisted (${Math.round(aiPct)}%) · ${fmtDuration(manualActive)} manual`,
    };

    const writePct = heartbeats.length ? (writes / heartbeats.length) * 100 : 0;
    const writeMeter = {
      pct: writePct,
      caption: `${writes.toLocaleString()} of ${heartbeats.length.toLocaleString()} heartbeats were writes (${Math.round(writePct)}%)`,
    };

    const fileStats = buildFileStats(heartbeats, thresholdSec);

    const sessionRows: SessionRow[] = sessions.map((s, i) => {
      let lang = "—";
      let bestCount = -1;
      s.languages.forEach((count, l) => {
        if (count > bestCount) {
          bestCount = count;
          lang = l;
        }
      });
      return {
        idx: i + 1,
        start: fmtHMS(s.startT),
        duration: fmtDuration(s.active),
        heartbeats: s.count,
        projects: Array.from(s.projects).join(", "),
        language: lang,
      };
    });

    const sourceTypeCounts = new Map<string, number>();
    heartbeats.forEach((h) => sourceTypeCounts.set(h.sourceType, (sourceTypeCounts.get(h.sourceType) || 0) + 1));
    let sourceTypeNote: string;
    if (sourceTypeCounts.size <= 1) {
      sourceTypeNote = `All heartbeats recorded via "${Array.from(sourceTypeCounts.keys())[0]}".`;
    } else {
      const parts = Array.from(sourceTypeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} (${Math.round((v / heartbeats.length) * 100)}%)`);
      sourceTypeNote = `sourceType — ${parts.join(", ")}`;
    }

    return {
      kpis,
      totalActive,
      noActivityWarning: totalActive === 0,
      buckets,
      bucketRows,
      langItems,
      editorItems,
      projectItems,
      categoryItems,
      showCategoryBreakdown: catMap.size > 2,
      aiMeter,
      writeMeter,
      fileStats,
      sessionRows,
      sourceTypeNote,
    };
  }, [heartbeats, thresholdSec]);
}

export { breakdownRows };
