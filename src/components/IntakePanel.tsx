import { useState, type DragEvent } from "react";
import type { DatasetMeta } from "../types";
import { SAMPLE_RAW } from "../lib/sampleData";

type Tab = "sample" | "file" | "paste" | "url";

interface IntakePanelProps {
  onLoad: (raw: unknown, meta: DatasetMeta) => void;
  onError: (message: string) => void;
  error: string | null;
}

const TABS: Array<[Tab, string]> = [
  ["sample", "Sample data"],
  ["file", "Upload file"],
  ["paste", "Paste JSON"],
  ["url", "Fetch URL"],
];

export function IntakePanel({ onLoad, onError, error }: IntakePanelProps) {
  const [tab, setTab] = useState<Tab>("sample");
  const [dragOver, setDragOver] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onLoad(JSON.parse(String(reader.result)), { source: "file", name: file.name });
      } catch (e) {
        onError(`That file is not valid JSON (${(e as Error).message}).`);
      }
    };
    reader.onerror = () => onError("Could not read that file.");
    reader.readAsText(file);
  }

  function handleParsePaste() {
    try {
      onLoad(JSON.parse(pasteValue), { source: "paste", name: "Pasted JSON" });
    } catch (e) {
      onError(`That JSON could not be parsed (${(e as Error).message}).`);
    }
  }

  async function handleFetch() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setFetching(true);
    try {
      const res = await fetch(trimmed);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      onLoad(await res.json(), { source: "url", name: trimmed });
    } catch (e) {
      onError(
        `Couldn't fetch that URL (${(e as Error).message}). If it blocks cross-origin requests, download the file and use Upload instead.`,
      );
    } finally {
      setFetching(false);
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <section className="card">
      <div className="intake-tabs" role="tablist" aria-label="Choose a data source">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={"pill intake-tab" + (tab === key ? " active" : "")}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "sample" && (
        <div>
          <p className="hint" style={{ marginTop: 0 }}>
            Loaded below: a 299-heartbeat sample session spanning ~14.5 hours across three editors. Swap in your own export any time.
          </p>
          <button
            type="button"
            className="btn accent"
            onClick={() => onLoad(SAMPLE_RAW, { source: "sample", name: "sample-01.json (sample)" })}
          >
            Reload sample-01.json
          </button>
        </div>
      )}

      {tab === "file" && (
        <div>
          <label
            className={"dropzone" + (dragOver ? " dragover" : "")}
            htmlFor="fileInput"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <strong>Drop a heartbeats JSON file here</strong>
            <br />
            or click to browse — parsed entirely in your browser, never uploaded anywhere.
            <input
              type="file"
              id="fileInput"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}

      {tab === "paste" && (
        <div>
          <textarea
            spellCheck={false}
            placeholder='{ "heartbeats": [ { "t": 0, "project": "…", "file": "…", … } ] }'
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
          />
          <div className="field-row">
            <button type="button" className="btn" onClick={handleParsePaste}>
              Parse &amp; load
            </button>
          </div>
        </div>
      )}

      {tab === "url" && (
        <div>
          <div className="field-row" style={{ marginTop: 0 }}>
            <input
              type="url"
              placeholder="https://example.com/heartbeats.json"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button type="button" className="btn" disabled={fetching} onClick={handleFetch}>
              {fetching ? "Fetching…" : "Fetch & load"}
            </button>
          </div>
          <p className="hint">
            Works for URLs that allow cross-origin requests. If a fetch is blocked, download the file and use Upload instead.
          </p>
        </div>
      )}

      {error ? <p className="error-line">{error}</p> : null}
    </section>
  );
}
