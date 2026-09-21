// Render every alert message from real data, without posting anything.
//
//   node src/alerts-dry-run.mjs [apiBase] [--force]
//
// --force also renders the threshold warnings by pretending coverage, headroom, the cache and
// the keeper are all unhappy, so the wording can be reviewed without waiting for a bad day.
// Nothing here can post: it never reads the bot token.
import { evaluate, readState, renderDistribution, THRESHOLDS } from "../dist/alerts-core.js";

const base = process.argv.find((a) => a.startsWith("http")) ?? "https://metacenter.0xo.in/api";
const force = process.argv.includes("--force");
const line = (t) => console.log(`\n${"─".repeat(72)}\n${t}\n`);

const state = await readState(base);
console.log(`state read from ${base} at Bitcoin block ${state.burnHeight} (distribution ${state.distribution}, cycle ${state.cycle})`);

console.log("\n=== a. after a distribution ===");
line(renderDistribution(state));

console.log("=== c. new bonding period ===");
for (const a of evaluate(state, { distributions: [state.distribution], active: [], bonds: [] }).filter((a) => a.kind === "bond")) line(a.text);
if (state.bondIndexes.length === 0) console.log("(no active bonds in this cycle)\n");

console.log("=== b. threshold warnings ===");
const real = evaluate(state, { distributions: [state.distribution], active: [], bonds: state.bondIndexes });
if (real.length === 0) console.log("none are true right now; use --force to see the wording\n");
for (const a of real) line(`[${a.kind}] ${a.text}`);

if (force) {
  console.log("=== b. threshold warnings, FORCED (dry run only, never posted) ===");
  const bad = {
    ...state,
    coverage: { value: 1.42, provenance: state.coverage.provenance },
    headroom: { value: 0.29, provenance: state.headroom.provenance },
    cacheBehind: THRESHOLDS.cacheStaleBlocks + 130,
    keeper: { lowBalance: true, lastStatus: "abort_by_response", lastKind: "refresh" },
  };
  for (const a of evaluate(bad, { distributions: [state.distribution], active: [], bonds: state.bondIndexes })) line(`[${a.kind}] ${a.text}`);

  console.log("=== resolved messages, when those conditions end ===");
  const active = ["coverage-critical", "headroom-warn", "cache-stale", "keeper-balance", "keeper-failed"];
  for (const a of evaluate(state, { distributions: [state.distribution], active, bonds: state.bondIndexes })) line(`[${a.kind}] ${a.text}`);
}
