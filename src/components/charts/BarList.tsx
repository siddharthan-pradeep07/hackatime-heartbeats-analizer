import type { LabeledValue } from "../../types";
import { seriesColor } from "../../lib/palette";
import { useMarkTooltip } from "./Tooltip";

interface BarListProps {
  items: LabeledValue[];
  formatValue?: (n: number) => string;
}

/** Horizontal bar list — each row already carries its own direct label, so no legend box. */
export function BarList({ items, formatValue }: BarListProps) {
  const fmt = formatValue ?? String;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="barlist">
      {items.map((item, i) => (
        <BarListRow key={item.label} item={item} index={i} max={max} fmt={fmt} />
      ))}
    </div>
  );
}

function BarListRow({ item, index, max, fmt }: { item: LabeledValue; index: number; max: number; fmt: (n: number) => string }) {
  const color = item.color ?? seriesColor(index, item.isOther);
  const pct = item.value > 0 ? Math.max((item.value / max) * 100, 1.5) : 0;
  const handlers = useMarkTooltip(() => ({ title: item.label, value: fmt(item.value), color }));
  return (
    <div className="barlist-row">
      <div className="barlist-label" title={item.label}>{item.label}</div>
      <div className="barlist-track">
        <button
          type="button"
          className="barlist-fill"
          style={{ background: color, width: `${pct}%` }}
          aria-label={`${item.label}: ${fmt(item.value)}`}
          {...handlers}
        />
      </div>
      <div className="barlist-value">{fmt(item.value)}</div>
    </div>
  );
}
