import { Fragment } from "react";
import type { Bucket } from "../../types";
import { fmtClock, fmtDuration } from "../../lib/format";
import { useMarkTooltip } from "./Tooltip";

interface PulseStripProps {
  buckets: Bucket[];
}

// A fixed virtual coordinate space; the <svg viewBox> scales it to the real
// rendered width, so no ResizeObserver or measured-width state is needed.
const VW = 1000;
const VH = 190;
const PAD_L = 46;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 26;
const PLOT_W = VW - PAD_L - PAD_R;
const PLOT_H = VH - PAD_T - PAD_B;

/** Active seconds per elapsed-time bucket, as a dense column histogram — one hue, magnitude by height. */
export function PulseStrip({ buckets }: PulseStripProps) {
  const max = Math.max(1, ...buckets.map((b) => b.activeSeconds));
  const slot = PLOT_W / buckets.length;
  const barW = Math.max(slot - 1, 1);
  const gridSteps = 3;
  const tickCount = Math.min(6, buckets.length);

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height={VH} role="img" aria-label="Coding activity over elapsed time">
      {Array.from({ length: gridSteps + 1 }, (_, g) => {
        const y = PAD_T + PLOT_H - (PLOT_H * g) / gridSteps;
        const val = (max * g) / gridSteps;
        return (
          <Fragment key={g}>
            <line x1={PAD_L} x2={VW - PAD_R} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD_L - 8} y={y + 3} textAnchor="end" className="axis-label">
              {fmtDuration(val, true)}
            </text>
          </Fragment>
        );
      })}

      {buckets.map((b, i) => {
        const x = PAD_L + i * slot;
        const h = max > 0 ? (b.activeSeconds / max) * PLOT_H : 0;
        const y = PAD_T + PLOT_H - h;
        return <PulseBar key={b.startT} bucket={b} x={x} y={y} width={barW} height={Math.max(h, 0)} />;
      })}

      {Array.from({ length: tickCount }, (_, i) => {
        const idx = Math.round((i * (buckets.length - 1)) / Math.max(tickCount - 1, 1));
        const tx = PAD_L + idx * slot + barW / 2;
        return (
          <text key={i} x={tx} y={VH - 8} textAnchor="middle" className="axis-label">
            {fmtClock(buckets[idx].startT)}
          </text>
        );
      })}
    </svg>
  );
}

function PulseBar({ bucket, x, y, width, height }: { bucket: Bucket; x: number; y: number; width: number; height: number }) {
  const handlers = useMarkTooltip(() => ({
    title: `From ${fmtClock(bucket.startT)} elapsed`,
    value: fmtDuration(bucket.activeSeconds),
    sub: `${bucket.count} heartbeat${bucket.count === 1 ? "" : "s"}`,
    color: "var(--pulse)",
  }));
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={Math.min(1.5, width / 2)}
      className="pulse-bar"
      tabIndex={0}
      {...handlers}
    />
  );
}
