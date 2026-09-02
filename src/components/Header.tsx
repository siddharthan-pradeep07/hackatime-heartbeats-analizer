import { fmtDuration } from "../lib/format";
import type { DatasetMeta } from "../types";

interface HeaderProps {
  meta: DatasetMeta | null;
  heartbeatCount: number;
  spanSeconds: number;
}

export function Header({ meta, heartbeatCount, spanSeconds }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <img className="brand-mark" src="/hack-club-icon.svg" alt="Hack Club" width={40} height={40} />
        <div className="brand-text">
          <h1>Hackatime Heartbeats Visualizer</h1>
          <p>An unofficial Hack Club community tool for reading Hackatime heartbeat exports</p>
        </div>
      </div>
      <div className="source-status">
        <span className="pulse-dot" />
        <span>
          {meta ? (
            <>
              {meta.name} · {heartbeatCount.toLocaleString()} heartbeats · {fmtDuration(spanSeconds)} span
            </>
          ) : (
            "No data loaded yet"
          )}
        </span>
      </div>
    </header>
  );
}
