import { useState, type ReactNode } from "react";
import type { TableColumn } from "../types";
import { DataTable } from "./DataTable";

interface ChartCardProps<Row> {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
  /** When present, adds a "View as table" toggle — the accessible twin of the chart. */
  table?: { columns: TableColumn<Row>[]; rows: Row[] };
}

/** A chart's card shell: caption, optional table-view toggle, and the chart or its table body. */
export function ChartCard<Row>({ title, subtitle, className, children, table }: ChartCardProps<Row>) {
  const [showingTable, setShowingTable] = useState(false);
  return (
    <figure className={"card chart-card" + (className ? ` ${className}` : "")}>
      <figcaption>
        <span>
          <span className="cap-title">{title}</span>
          {subtitle ? <span className="cap-sub">{subtitle}</span> : null}
        </span>
        {table ? (
          <button type="button" className="table-toggle" onClick={() => setShowingTable((v) => !v)}>
            {showingTable ? "View as chart" : "View as table"}
          </button>
        ) : null}
      </figcaption>
      {table && showingTable ? (
        <DataTable columns={table.columns} rows={table.rows} />
      ) : (
        <div className="chart-body">{children}</div>
      )}
    </figure>
  );
}
