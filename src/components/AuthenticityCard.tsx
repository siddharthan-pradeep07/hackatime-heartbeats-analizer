import type { TableColumn } from "../types";
import type { AuthenticitySignals, FileIntegrityRow, GapBucketEvidence, VerdictLevel } from "../lib/authenticity";
import { DataTable } from "./DataTable";

const LEVEL_META: Record<VerdictLevel, { label: string; bg: string; fg: string }> = {
  pass: { label: "Looks genuine", bg: "var(--hc-green)", fg: "#12291f" },
  caution: { label: "Worth a second look", bg: "var(--hc-yellow)", fg: "#3a2c00" },
  flag: { label: "Automation signals found", bg: "var(--hc-red)", fg: "#ffffff" },
  insufficient: { label: "Not enough data", bg: "var(--surface-2)", fg: "var(--ink-soft)" },
};

const GAP_COLUMNS: TableColumn<GapBucketEvidence>[] = [
  { key: "value", label: "Gap length", mono: true, align: "right", render: (r) => `${r.value.toFixed(2)}s` },
  { key: "count", label: "Occurrences", align: "right", mono: true },
  { key: "share", label: "Share of gaps", align: "right", mono: true, render: (r) => `${(r.share * 100).toFixed(1)}%` },
];

const FILE_INTEGRITY_COLUMNS: TableColumn<FileIntegrityRow>[] = [
  { key: "file", label: "File", mono: true },
  { key: "project", label: "Project" },
  { key: "writes", label: "Writes", align: "right", mono: true },
  { key: "minLines", label: "Min lines", align: "right", mono: true },
  { key: "maxLines", label: "Max lines", align: "right", mono: true },
  { key: "changed", label: "Grew?", render: (r) => (r.changed ? "Yes" : "No") },
];

/**
 * The "final conclusion" section: a heuristic read on whether this export's
 * timing and editing patterns look human-driven, plus every number behind
 * that read so it can be checked by hand rather than taken on faith.
 */
export function AuthenticityCard({ signals }: { signals: AuthenticitySignals }) {
  const meta = LEVEL_META[signals.verdict.level];
  const hasEvidence = signals.verdict.level !== "insufficient";

  return (
    <section className="card authenticity-card" aria-labelledby="authenticity-headline">
      <div className="authenticity-head">
        <span className="authenticity-pill" style={{ background: meta.bg, color: meta.fg }}>
          {meta.label}
        </span>
        <h2 className="authenticity-headline" id="authenticity-headline">
          {signals.verdict.headline}
        </h2>
      </div>

      <ul className="authenticity-reasons">
        {signals.verdict.reasons.map((reason, i) => (
          <li key={i}>{reason}</li>
        ))}
      </ul>

      {hasEvidence && (
        <div className="authenticity-evidence">
          <div>
            <div className="subchart-heading">Heartbeat timing evidence</div>
            <p className="hint" style={{ marginTop: 0 }}>
              {signals.activeGapCount} active gaps · mean {signals.meanGap.toFixed(2)}s · coefficient of variation{" "}
              {signals.cv?.toFixed(2)}
            </p>
            <DataTable columns={GAP_COLUMNS} rows={signals.topGaps} />
          </div>
          {signals.fileIntegrity.length > 0 && (
            <div>
              <div className="subchart-heading">Write vs. line-growth evidence</div>
              <p className="hint" style={{ marginTop: 0 }}>
                Files with 3+ recorded writes, smallest vs. largest observed line count.
              </p>
              <DataTable columns={FILE_INTEGRITY_COLUMNS} rows={signals.fileIntegrity} limit={8} />
            </div>
          )}
        </div>
      )}

      <p className="authenticity-disclaimer">
        Heuristic only, computed from timing and line-count patterns in this export — not proof of anything either way.
        Treat it as a starting point for manual review, not a verdict on the person.
      </p>
    </section>
  );
}
