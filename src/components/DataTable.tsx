import { useState } from "react";
import type { TableColumn } from "../types";

interface DataTableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  /** Rows shown before a "Show all" toggle appears. Omit to always show every row. */
  limit?: number;
}

/** A plain HTML table — the accessible, non-visual twin every chart's "View as table" resolves to. */
export function DataTable<Row>({ columns, rows, limit }: DataTableProps<Row>) {
  const effectiveLimit = limit ?? rows.length;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, effectiveLimit);

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.mono ? "mono" : undefined} style={c.align ? { textAlign: c.align } : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} className={c.mono ? "mono" : undefined} style={c.align ? { textAlign: c.align } : undefined}>
                    {c.render ? c.render(row) : String(row[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > effectiveLimit && (
        <button type="button" className="show-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}
