/** A heartbeat after normalization: every field present, time relative to the first heartbeat. */
export interface Heartbeat {
  /** Seconds since the first heartbeat in the dataset. */
  t: number;
  write: boolean;
  project: string;
  file: string;
  language: string | null;
  category: string;
  editor: string;
  lines: number | null;
  sourceType: string;
}

/** Where the currently-loaded dataset came from. */
export type DataSource = "file" | "paste" | "url";

export interface DatasetMeta {
  source: DataSource;
  name: string;
}

/** A generic labeled value used by bar lists, stacked bars, and their table-view twins. */
export interface LabeledValue {
  label: string;
  value: number;
  isOther?: boolean;
  color?: string;
}

export interface Bucket {
  startT: number;
  activeSeconds: number;
  count: number;
}

export interface Session {
  startT: number;
  endT: number;
  count: number;
  active: number;
  projects: Set<string>;
  languages: Map<string, number>;
}

export interface FileStat {
  project: string;
  file: string;
  language: string;
  count: number;
  writes: number;
  maxLines: number;
  active: number;
}

export interface TableColumn<Row> {
  key: keyof Row & string;
  label: string;
  align?: "left" | "right";
  mono?: boolean;
  render?: (row: Row) => string | number;
}
