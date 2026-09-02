const THRESHOLDS: Array<[number, string]> = [
  [60, "1m"],
  [120, "2m"],
  [300, "5m"],
  [600, "10m"],
  [900, "15m"],
  [1800, "30m"],
];

interface FiltersRowProps {
  thresholdSec: number;
  onChange: (seconds: number) => void;
}

export function FiltersRow({ thresholdSec, onChange }: FiltersRowProps) {
  return (
    <section className="filters">
      <span className="filters-label">Idle threshold</span>
      <div className="pill-row">
        {THRESHOLDS.map(([seconds, label]) => (
          <button
            key={seconds}
            type="button"
            className={"pill threshold-pill" + (thresholdSec === seconds ? " active" : "")}
            onClick={() => onChange(seconds)}
          >
            {label}
          </button>
        ))}
      </div>
      <span>Gaps longer than this end a session and stop counting as active time — every stat below recomputes live.</span>
    </section>
  );
}
