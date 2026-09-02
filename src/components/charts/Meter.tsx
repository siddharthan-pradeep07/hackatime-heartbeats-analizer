interface MeterProps {
  title: string;
  pct: number;
  caption: string;
}

/** A single-fill progress meter: same-ramp track, one accent fill, caption spells out both raw numbers. */
export function Meter({ title, pct, caption }: MeterProps) {
  const clamped = Math.max(0, Math.min(pct, 100));
  return (
    <div className="meter-block">
      <div className="meter-title">{title}</div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${clamped}%` }} />
      </div>
      <div className="meter-caption">{caption}</div>
    </div>
  );
}
