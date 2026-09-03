// Ad-hoc eval harness (not part of the app build) for calibrating
// src/lib/authenticity.ts against real and synthetic heartbeat logs.
// Run with: npm run eval:authenticity
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { computeAuthenticitySignals } from "../src/lib/authenticity.ts";
import { normalizeHeartbeats } from "../src/lib/normalize.ts";
import type { Heartbeat } from "../src/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const THRESHOLD = 300; // default idle threshold used by the app (5 min)

function loadFixture(name: string): Heartbeat[] | null {
  try {
    const raw = JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));
    return normalizeHeartbeats(raw);
  } catch {
    return null; // fixtures/ is gitignored (real heartbeat data) — fine if this one isn't present locally
  }
}

// --- Synthetic negative control: a genuine, steadily-typed human session ---
function buildHumanSteady(): Heartbeat[] {
  const hb: Heartbeat[] = [];
  let t = 0;
  let cursor = 1;
  let lines = 1;
  for (let i = 0; i < 400; i++) {
    // Human inter-keystroke/save gaps: irregular, roughly 3-40s, occasional longer pauses.
    const gap = i % 37 === 0 ? 180 + Math.random() * 400 : 3 + Math.random() * 37;
    t += gap;
    cursor += Math.floor(1 + Math.random() * 12);
    if (Math.random() < 0.15) lines += 1;
    hb.push({
      t, write: Math.random() < 0.4, project: "proj", file: "main.ts", language: "TypeScript",
      category: "coding", editor: "vscode", lines, sourceType: "direct_entry",
    });
  }
  return hb;
}

// --- Synthetic positive control: a script pinging on a near-fixed timer ---
function buildFraudPinger(): Heartbeat[] {
  const hb: Heartbeat[] = [];
  let t = 0;
  for (let i = 0; i < 80; i++) {
    t += 120 + (Math.random() - 0.5) * 2; // ~120s +/- 1s, essentially clockwork
    hb.push({
      t, write: i % 5 === 0, project: "proj", file: "main.py", language: "Python",
      category: "coding", editor: "vscode", lines: 200, sourceType: "direct_entry",
    });
  }
  return hb;
}

// --- Synthetic: legitimate AI-agent burst pattern (many files touched within
// ~1s of each other, repeated many times through the session, separated by
// human-scale pacing gaps) - modeled on sample-03/sample-05's real shape.
function buildAiAgentBursty(): Heartbeat[] {
  const hb: Heartbeat[] = [];
  let t = 0;
  for (let burst = 0; burst < 30; burst++) {
    // Pacing gap between agent turns: real "thinking time" between an AI
    // agent's turns is heavy-tailed (mostly quick, occasionally long), not
    // uniformly random - an exponential draw is a much closer match, and
    // matches the high CV actually seen in the real sample fixtures above.
    t += 8 + -Math.log(1 - Math.random()) * 45;
    const filesInBurst = 3 + Math.floor(Math.random() * 15);
    for (let f = 0; f < filesInBurst; f++) {
      t += Math.random() < 0.5 ? 0 : 1; // near-simultaneous multi-file touches
      const growth = burst * 2 + f; // each file genuinely grows over the session, unlike a no-op pinger
      hb.push({
        t, write: Math.random() < 0.3, project: "proj", file: `file-${f}.java`, language: "Java",
        category: "ai coding", editor: "Claude", lines: 50 + f * 17 + growth, sourceType: "direct_entry",
      });
    }
  }
  return hb;
}

// --- Synthetic: a plausible-but-worth-flagging anomaly window modeled on
// sample-04's t=35685-37571 burst - the file's total line count oscillates
// by hundreds within seconds, embedded in an otherwise normal human session.
function buildCursorJumpAnomaly(): Heartbeat[] {
  const hb = buildHumanSteady();
  let t = hb[hb.length - 1].t + 500;
  const jumps = [1304, 700, 1250, 640, 1180, 900, 1208, 650];
  for (const lines of jumps) {
    t += 2 + Math.random() * 8;
    hb.push({
      t, write: true, project: "proj", file: "big.c", language: "C",
      category: "coding", editor: "vscode", lines, sourceType: "direct_entry",
    });
  }
  return hb;
}

// --- Synthetic: one small, otherwise-easy-to-miss trace on a single file
// (2 static writes just barely over the reporting minimum) inside a session
// that is completely clean on every other axis - this is the case the
// "flag individual files on small evidence" tuning is meant to catch.
function buildOneQuietFile(): Heartbeat[] {
  const hb = buildHumanSteady();
  let t = hb[hb.length - 1].t + 200;
  for (let i = 0; i < 3; i++) {
    t += 40 + Math.random() * 60;
    hb.push({
      t, write: true, project: "proj", file: "config.json", language: "JSON",
      category: "coding", editor: "vscode", lines: 40, sourceType: "direct_entry",
    });
  }
  return hb;
}

const fixtures: Record<string, Heartbeat[] | null> = {
  "sample-03 (real, Claude-heavy)": loadFixture("sample-03.json"),
  "sample-05 (real, claude-code-heavy)": loadFixture("sample-05.json"),
  "synthetic human-steady (negative control)": buildHumanSteady(),
  "synthetic fraud-pinger (positive control)": buildFraudPinger(),
  "synthetic ai-agent-bursty (should NOT flag)": buildAiAgentBursty(),
  "synthetic cursor-jump-anomaly (should caution)": buildCursorJumpAnomaly(),
  "synthetic one-quiet-file (small trace, should still name the file)": buildOneQuietFile(),
};

for (const [name, heartbeats] of Object.entries(fixtures)) {
  if (!heartbeats) {
    console.log(`\n=== ${name} ===\n  (skipped — fixtures/${name.split(" ")[0]}.json not found locally)`);
    continue;
  }
  const s = computeAuthenticitySignals(heartbeats, THRESHOLD);
  console.log(`\n=== ${name} ===`);
  console.log(`heartbeats=${heartbeats.length} activeGaps=${s.activeGapCount} burstGaps=${s.burstGapCount} pacingGaps=${s.pacingGapCount} cv=${s.cv?.toFixed(3)} modalShare=${s.modalShare.toFixed(2)} nearDup=${s.nearDuplicateShare.toFixed(2)}`);
  console.log(`verdict: ${s.verdict.level} — ${s.verdict.headline}`);
  s.verdict.reasons.forEach((r) => console.log(`  - ${r}`));
  if (s.flaggedFiles.length) {
    console.log(`  flaggedFiles:`);
    s.flaggedFiles.forEach((f) => console.log(`    - ${f.project}/${f.file}: ${f.reasons.join("; ")}`));
  }
  if (s.topGaps.length) console.log(`  topGaps: ${s.topGaps.map((g) => `${g.value}s x${g.count} (${(g.share * 100).toFixed(0)}%)`).join(", ")}`);
}
