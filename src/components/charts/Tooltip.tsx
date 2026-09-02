import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export interface TooltipContent {
  title: string;
  value: string;
  sub?: string;
  color?: string;
}

interface TooltipState extends TooltipContent {
  x: number;
  y: number;
  visible: boolean;
}

interface TooltipApi {
  showAt: (clientX: number, clientY: number, content: TooltipContent) => void;
  hide: () => void;
}

const TooltipContext = createContext<TooltipApi | null>(null);

const INITIAL: TooltipState = { visible: false, x: 0, y: 0, title: "", value: "" };

/** Mounts once near the app root: owns the single floating tooltip every chart mark reports to. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TooltipState>(INITIAL);
  const elRef = useRef<HTMLDivElement>(null);

  const showAt = useCallback((clientX: number, clientY: number, content: TooltipContent) => {
    const pad = 14;
    const el = elRef.current;
    const rect = el ? el.getBoundingClientRect() : { width: 180, height: 60 };
    let x = clientX + pad;
    let y = clientY + pad;
    if (x + rect.width > window.innerWidth - 8) x = clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = clientY - rect.height - pad;
    setState({ visible: true, x, y, ...content });
  }, []);

  const hide = useCallback(() => setState((s) => ({ ...s, visible: false })), []);

  const api = useMemo(() => ({ showAt, hide }), [showAt, hide]);

  return (
    <TooltipContext.Provider value={api}>
      {children}
      <div
        ref={elRef}
        className={"hbc-tooltip" + (state.visible ? " visible" : "")}
        role="tooltip"
        style={{ left: state.x, top: state.y }}
      >
        <div className="tt-value">{state.value}</div>
        <div className="tt-title">
          {state.color ? <span className="tt-key" style={{ background: state.color }} /> : null}
          <span>{state.title}</span>
        </div>
        {state.sub ? <div className="tt-sub">{state.sub}</div> : null}
      </div>
    </TooltipContext.Provider>
  );
}

function useTooltipApi(): TooltipApi {
  const ctx = useContext(TooltipContext);
  if (!ctx) throw new Error("useTooltipApi must be used within a TooltipProvider");
  return ctx;
}

/**
 * Wires a chart mark (bar, segment, column) up to the shared tooltip: hover and
 * keyboard focus both show it, matching the interaction spec — every value reachable
 * without a pointer. `content` is read lazily so callers can close over fresh data.
 */
export function useMarkTooltip(content: () => TooltipContent) {
  const { showAt, hide } = useTooltipApi();
  return {
    onPointerEnter: (e: React.PointerEvent) => showAt(e.clientX, e.clientY, content()),
    onPointerMove: (e: React.PointerEvent) => showAt(e.clientX, e.clientY, content()),
    onPointerLeave: hide,
    onFocus: (e: React.FocusEvent<Element>) => {
      const r = e.currentTarget.getBoundingClientRect();
      showAt(r.left + r.width / 2, r.top, content());
    },
    onBlur: hide,
  };
}
