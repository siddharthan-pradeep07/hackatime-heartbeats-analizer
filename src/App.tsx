import { useCallback, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { IntakePanel } from "./components/IntakePanel";
import { FiltersRow } from "./components/FiltersRow";
import { KpiGrid } from "./components/KpiGrid";
import { ChartCard } from "./components/ChartCard";
import { BarList } from "./components/charts/BarList";
import { StackedBar } from "./components/charts/StackedBar";
import { Meter } from "./components/charts/Meter";
import { PulseStrip } from "./components/charts/PulseStrip";
import { DataTable } from "./components/DataTable";
import { AuthenticityCard } from "./components/AuthenticityCard";
import { HackClubBanner } from "./components/HackClubBanner";
import { Footer } from "./components/Footer";
import { TooltipProvider } from "./components/charts/Tooltip";
import { normalizeHeartbeats } from "./lib/normalize";
import { fmtDuration } from "./lib/format";
import { breakdownRows, useHeartbeatStats, type BreakdownRow, type BucketRow, type SessionRow } from "./hooks/useHeartbeatStats";
import type { DatasetMeta, FileStat, Heartbeat, TableColumn } from "./types";

const BUCKET_COLUMNS: TableColumn<BucketRow>[] = [
  { key: "range", label: "Elapsed time" },
  { key: "active", label: "Active time", mono: true },
  { key: "count", label: "Heartbeats", align: "right", mono: true },
];

const FILE_COLUMNS: TableColumn<FileStat>[] = [
  { key: "file", label: "File", mono: true },
  { key: "project", label: "Project" },
  { key: "language", label: "Language" },
  { key: "active", label: "Active time", mono: true, align: "right", render: (r) => fmtDuration(r.active) },
  { key: "count", label: "Heartbeats", align: "right", mono: true },
  { key: "writes", label: "Writes", align: "right", mono: true },
  { key: "maxLines", label: "Lines", align: "right", mono: true },
];

const SESSION_COLUMNS: TableColumn<SessionRow>[] = [
  { key: "idx", label: "#", align: "right", mono: true },
  { key: "start", label: "Started at", mono: true },
  { key: "duration", label: "Active time", mono: true },
  { key: "heartbeats", label: "Heartbeats", align: "right", mono: true },
  { key: "projects", label: "Project(s)" },
  { key: "language", label: "Top language" },
];

function breakdownColumns(nameLabel: string): TableColumn<BreakdownRow>[] {
  return [
    { key: "label", label: nameLabel },
    { key: "active", label: "Active time", mono: true },
  ];
}

export default function App() {
  const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([]);
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thresholdSec, setThresholdSec] = useState(300);

  const handleLoad = useCallback((raw: unknown, nextMeta: DatasetMeta) => {
    try {
      const normalized = normalizeHeartbeats(raw);
      setHeartbeats(normalized);
      setMeta(nextMeta);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const stats = useHeartbeatStats(heartbeats, thresholdSec);

  const spanSeconds = useMemo(
    () => (heartbeats.length ? heartbeats[heartbeats.length - 1].t - heartbeats[0].t : 0),
    [heartbeats],
  );

  return (
    <TooltipProvider>
      <HackClubBanner />
      <div className="app">
        <div className="shell">
          <Header meta={meta} heartbeatCount={heartbeats.length} spanSeconds={spanSeconds} />

          <IntakePanel onLoad={handleLoad} onError={setError} error={error} />

          <FiltersRow thresholdSec={thresholdSec} onChange={setThresholdSec} />

          {stats && (
            <>
              <KpiGrid tiles={stats.kpis} />

              {stats.noActivityWarning && (
                <p className="error-line" style={{ textAlign: "center" }}>
                  No gaps at or under the current idle threshold — every heartbeat looks idle-separated. Try a longer
                  threshold above.
                </p>
              )}

              <section className="charts-grid">
                <ChartCard
                  title="Activity over elapsed time"
                  subtitle="Active seconds per time bucket, from the first heartbeat"
                  className="span-2"
                  table={{ columns: BUCKET_COLUMNS, rows: stats.bucketRows }}
                >
                  <PulseStrip buckets={stats.buckets} />
                </ChartCard>

                <ChartCard
                  title="Time by language"
                  subtitle="Top 7, remainder folded into Other"
                  table={{ columns: breakdownColumns("Language"), rows: breakdownRows(stats.langItems) }}
                >
                  <BarList items={stats.langItems} formatValue={fmtDuration} />
                </ChartCard>

                <ChartCard
                  title="Time by editor"
                  subtitle="Share of active coding time"
                  table={{ columns: breakdownColumns("Editor"), rows: breakdownRows(stats.editorItems) }}
                >
                  <StackedBar items={stats.editorItems} total={stats.totalActive} formatValue={fmtDuration} />
                </ChartCard>

                <ChartCard
                  title="Time by project"
                  subtitle="Share of active coding time"
                  table={{ columns: breakdownColumns("Project"), rows: breakdownRows(stats.projectItems) }}
                >
                  <StackedBar items={stats.projectItems} total={stats.totalActive} formatValue={fmtDuration} />
                </ChartCard>

                <ChartCard title="Coding mode">
                  <Meter title="AI-assisted vs. manual" pct={stats.aiMeter.pct} caption={stats.aiMeter.caption} />
                  <Meter title="Write vs. view heartbeats" pct={stats.writeMeter.pct} caption={stats.writeMeter.caption} />
                  {stats.showCategoryBreakdown && (
                    <>
                      <div className="subchart-heading">By category</div>
                      <BarList items={stats.categoryItems} formatValue={fmtDuration} />
                    </>
                  )}
                </ChartCard>

                <ChartCard
                  title="Files, ranked by active time"
                  subtitle="Project shown separately — the same filename can appear in more than one project"
                  className="span-2"
                >
                  <DataTable columns={FILE_COLUMNS} rows={stats.fileStats} limit={12} />
                </ChartCard>

                <ChartCard
                  title="Sessions"
                  subtitle="A new session starts after a gap longer than the idle threshold above"
                  className="span-2"
                >
                  <DataTable columns={SESSION_COLUMNS} rows={stats.sessionRows} limit={10} />
                </ChartCard>
              </section>

              <AuthenticityCard signals={stats.authenticity} />

              <p className="note">{stats.sourceTypeNote}</p>
            </>
          )}

          {!stats && (
            <section className="card empty-state">
              <p className="empty-state-title">No data loaded yet</p>
              <p className="empty-state-body">
                Upload a Hackatime/WakaTime heartbeats export, paste one as JSON, or fetch it from a URL above — stats,
                charts, and the authenticity check appear here once a file is loaded.
              </p>
            </section>
          )}

          <Footer />
        </div>
      </div>
    </TooltipProvider>
  );
}
