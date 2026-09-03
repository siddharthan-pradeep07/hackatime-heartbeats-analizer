import { Fragment } from "react";
import type { DayBucket } from "../../types";
import { fmtDuration } from "../../lib/format";
import { useMarkTooltip } from "./Tooltip";

interface DailyActivityChartProps {
  buckets: DayBucket[];
}

// Same fixed virtual coordinate space as PulseStrip — the <svg viewBox> scales
// it to the real rendered width, so no ResizeObserver is needed.
const VW = 1000;
const VH = 190;
const PAD_L = 46;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 26;
const PLOT_W = VW - PAD_L - PAD_R;
const PLOT_H = VH - PAD_T - PAD_B;

const HOUR_STEP_OPTIONS = [1, 2, 3, 4, 6, 8, 12, 24, 48, 72, 96];

/** Picks an hour-per-gridline step that keeps the y-axis to ~5 clean, whole-hour ticks. */
function pickHourStep(maxHours: number): number {
  for (const opt of HOUR_STEP_OPTIONS) {
    if (maxHours / opt <= 5) return opt;
  }
  return HOUR_STEP_OPTIONS[HOUR_STEP_OPTIONS.length - 1];
}

/** One column per day across the whole timeline — active hours per day, with clean hour gridlines. */
export function DailyActivityChart({ buckets }: DailyActivityChartProps) {
  const rawMaxSeconds = Math.max(1, ...buckets.map((b) => b.activeSeconds));
  const maxHours = Math.max(1, Math.ceil(rawMaxSeconds / 3600));
  const hourStep = pickHourStep(maxHours);
  const gridSteps = Math.max(1, Math.ceil(maxHours / hourStep));
  const niceMaxSeconds = gridSteps * hourStep * 3600;

  const slot = PLOT_W / buckets.length;
  const barW = Math.max(slot - 1, 1);
  const tickCount = Math.min(7, buckets.length);

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height={VH} role="img" aria-label="Active hours per day across the whole timeline">
      {Array.from({ length: gridSteps + 1 }, (_, g) => {
        const y = PAD_T + PLOT_H - (PLOT_H * g) / gridSteps;
        const hours = g * hourStep;
        return (
          <Fragment key={g}>
            <line x1={PAD_L} x2={VW - PAD_R} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD_L - 8} y={y + 3} textAnchor="end" className="axis-label">
              {hours}h
            </text>
          </Fragment>
        );
      })}

      {buckets.map((b, i) => {
        const x = PAD_L + i * slot;
        const h = (b.activeSeconds / niceMaxSeconds) * PLOT_H;
        const y = PAD_T + PLOT_H - h;
        return <DayBar key={b.dayIndex} bucket={b} x={x} y={y} width={barW} height={Math.max(h, 0)} />;
      })}

      {Array.from({ length: tickCount }, (_, i) => {
        const idx = Math.round((i * (buckets.length - 1)) / Math.max(tickCount - 1, 1));
        const tx = PAD_L + idx * slot + barW / 2;
        return (
          <text key={i} x={tx} y={VH - 8} textAnchor="middle" className="axis-label">
            {buckets[idx].label}
          </text>
        );
      })}
    </svg>
  );
}

function DayBar({ bucket, x, y, width, height }: { bucket: DayBucket; x: number; y: number; width: number; height: number }) {
  const handlers = useMarkTooltip(() => ({
    title: bucket.label,
    value: fmtDuration(bucket.activeSeconds),
    sub: `${bucket.count} heartbeat${bucket.count === 1 ? "" : "s"}`,
    color: "var(--series-4)",
  }));
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={Math.min(1.5, width / 2)}
      className="daily-bar"
      tabIndex={0}
      {...handlers}
    />
  );
}
