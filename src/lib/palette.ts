/**
 * The 7 Hack Club brand hues, in the one adjacency order (of several tried)
 * that clears the CVD-safety and normal-vision-distinction checks in both
 * themes: Red, Cyan, Orange, Blue, Yellow, Purple, Green. Never cycle or
 * reassign by rank — a category keeps its slot for as long as it's on screen.
 */
const SERIES_VARS = [
  "var(--series-1)", // red
  "var(--series-2)", // cyan
  "var(--series-3)", // orange
  "var(--series-4)", // blue
  "var(--series-5)", // yellow
  "var(--series-6)", // purple
  "var(--series-7)", // green
] as const;

/** Slot color for the Nth category, or the muted "Other" swatch once a breakdown folds its tail. */
export function seriesColor(index: number, isOther?: boolean): string {
  if (isOther) return "var(--muted)";
  return SERIES_VARS[index % SERIES_VARS.length];
}
