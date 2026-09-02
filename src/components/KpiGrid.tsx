export interface KpiTileData {
  label: string;
  value: string;
  sub?: string;
  hero?: boolean;
}

export function KpiGrid({ tiles }: { tiles: KpiTileData[] }) {
  return (
    <section className="kpi-grid" aria-label="Summary stats">
      {tiles.map((tile) => (
        <div className={"kpi" + (tile.hero ? " kpi-hero" : "")} key={tile.label}>
          <div className="kpi-value">{tile.value}</div>
          <div className="kpi-label">{tile.label}</div>
          {tile.sub ? <div className="kpi-sub">{tile.sub}</div> : null}
        </div>
      ))}
    </section>
  );
}
