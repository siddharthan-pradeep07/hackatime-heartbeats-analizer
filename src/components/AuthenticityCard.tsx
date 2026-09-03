import type { TableColumn } from "../types";
import type { AuthenticitySignals, EditAnomalyRow, FileIntegrityRow, FlaggedFileRow, GapBucketEvidence, VerdictLevel } from "../lib/authenticity";
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

const FLAGGED_FILE_COLUMNS: TableColumn<FlaggedFileRow>[] = [
  { key: "file", label: "File", mono: true },
  { key: "project", label: "Project" },
  { key: "reasons", label: "Why it's flagged", render: (r) => r.reasons.join("; ") },
];

const FILE_INTEGRITY_COLUMNS: TableColumn<FileIntegrityRow>[] = [
  { key: "file", label: "File", mono: true },
  { key: "project", label: "Project" },
  { key: "writes", label: "Writes", align: "right", mono: true },
  { key: "minLines", label: "Min lines", align: "right", mono: true },
  { key: "maxLines", label: "Max lines", align: "right", mono: true },
  { key: "changed", label: "Grew?", render: (r) => (r.changed ? "Yes" : "No") },
];

const EDIT_ANOMALY_COLUMNS: TableColumn<EditAnomalyRow>[] = [
  { key: "file", label: "File", mono: true },
  { key: "project", label: "Project" },
  { key: "occurrences", label: "Large swings", align: "right", mono: true },
  { key: "maxJump", label: "Biggest jump", align: "right", mono: true, render: (r) => `${r.maxJump} lines` },
  { key: "minGapSec", label: "Closest together", align: "right", mono: true, render: (r) => `${r.minGapSec.toFixed(1)}s` },
];

/**
 * The "final conclusion" section: a heuristic read on whether this export's
 * timing and editing patterns look human-driven, plus every number behind
 * that read so it can be checked by hand rather than taken on faith.
 */
export function AuthenticityCard({ signals }: { signals: AuthenticitySignals }) {
  const meta = LEVEL_META[signals.verdict.level];
  const hasTimingEvidence = signals.verdict.level !== "insufficient" && signals.cv != null;

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

      {signals.flaggedFiles.length > 0 && (
        <div className="authenticity-evidence">
          <div>
            <div className="subchart-heading">Flagged files</div>
            <p className="hint" style={{ marginTop: 0 }}>
              Every file with a concrete integrity concern, named directly with the exact reason it was flagged — even
              a single file with a small trace is called out here rather than folded into a session-wide average.
            </p>
            <DataTable columns={FLAGGED_FILE_COLUMNS} rows={signals.flaggedFiles} limit={8} />
          </div>
        </div>
      )}

      {hasTimingEvidence && (
        <div className="authenticity-evidence">
          <div>
            <div className="subchart-heading">Heartbeat timing evidence</div>
            <p className="hint" style={{ marginTop: 0 }}>
              {signals.activeGapCount} active gaps
              {signals.usedPacingGaps
                ? ` (${signals.burstGapCount} sub-2s multi-file bursts set aside, ${signals.pacingGapCount} pacing gaps analyzed below)`
                : signals.burstGapCount > 0
                  ? ` (only ${signals.pacingGapCount} pacing gaps — too few to analyze alone, so bursts are included below)`
                  : ""}{" "}
              · mean {signals.meanGap.toFixed(2)}s · coefficient of variation {signals.cv?.toFixed(2)}
            </p>
            <DataTable columns={GAP_COLUMNS} rows={signals.topGaps} />
          </div>
          {signals.fileIntegrity.length > 0 && (
            <div>
              <div className="subchart-heading">Write vs. line-growth evidence</div>
              <p className="hint" style={{ marginTop: 0 }}>
                Every file with 3+ recorded writes, smallest vs. largest observed line count — including files not
                flagged above.
              </p>
              <DataTable columns={FILE_INTEGRITY_COLUMNS} rows={signals.fileIntegrity} limit={8} />
            </div>
          )}
          {signals.editAnomalies.length > 0 && (
            <div>
              <div className="subchart-heading">Erratic edit evidence</div>
              <p className="hint" style={{ marginTop: 0 }}>
                Files whose reported line count swung by a large amount, repeatedly, within a short window.
              </p>
              <DataTable columns={EDIT_ANOMALY_COLUMNS} rows={signals.editAnomalies} limit={8} />
            </div>
          )}
        </div>
      )}

      <p className="authenticity-disclaimer">
        Heuristic only, computed from timing and line-count patterns in this export — not proof of anything either way.
        Deliberately tuned to surface even a small trace on a single file, so treat every row above as a starting
        point for manual review, not a verdict on the person.
      </p>
    </section>
  );
}
