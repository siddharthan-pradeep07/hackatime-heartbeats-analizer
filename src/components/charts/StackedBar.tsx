import type { LabeledValue } from "../../types";
import { seriesColor } from "../../lib/palette";
import { useMarkTooltip } from "./Tooltip";

interface StackedBarProps {
  items: LabeledValue[];
  total: number;
  formatValue?: (n: number) => string;
}

/** A single 100%-wide bar split into shares, with a legend row beneath carrying the direct labels. */
export function StackedBar({ items, total, formatValue }: StackedBarProps) {
  const fmt = formatValue ?? String;
  return (
    <div className="stackbar">
      <div className="stackbar-track">
        {items.map((item, i) => (
          <StackedSegment key={item.label} item={item} index={i} total={total} fmt={fmt} />
        ))}
      </div>
      <div className="stackbar-legend">
        {items.map((item, i) => {
          const color = item.color ?? seriesColor(i, item.isOther);
          return (
            <div className="legend-chip" key={item.label}>
              <span className="chip-swatch" style={{ background: color }} />
              <span className="chip-label">{item.label}</span>
              <span className="chip-value">{fmt(item.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StackedSegment({ item, index, total, fmt }: { item: LabeledValue; index: number; total: number; fmt: (n: number) => string }) {
  const color = item.color ?? seriesColor(index, item.isOther);
  const pct = total > 0 ? (item.value / total) * 100 : 0;
  const handlers = useMarkTooltip(() => ({
    title: item.label,
    value: fmt(item.value),
    sub: `${pct.toFixed(1)}% of total`,
    color,
  }));
  return (
    <button
      type="button"
      className="stackbar-seg"
      style={{ background: color, width: `${Math.max(pct, 0.6)}%` }}
      aria-label={`${item.label}: ${fmt(item.value)}, ${pct.toFixed(1)}%`}
      {...handlers}
    />
  );
}
