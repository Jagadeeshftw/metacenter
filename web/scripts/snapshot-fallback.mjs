// Write web/data/fallback.json: the last known good API responses, committed so the site can
// still render real figures (clearly marked stale) if the API or its database is down when a
// page is built or revalidated.
//
//   node web/scripts/snapshot-fallback.mjs [apiBase]
//
// Re-run it whenever the figures move; it is also fine for it to lag, since every page shows
// the block the data was read at.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = process.argv[2] ?? "https://metacenter.0xo.in/api";
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "fallback.json");
const paths = ["/metrics/current", "/intervals", "/meta"];

const snapshot = { captured_at: new Date().toISOString(), api: API, responses: {} };
for (const p of paths) {
  const r = await fetch(API + p);
  if (!r.ok) throw new Error(`${p}: ${r.status}`);
  snapshot.responses[p] = await r.json();
}
const cur = snapshot.responses["/metrics/current"];
snapshot.burn_height = cur?.as_of?.burn_height ?? null;
fs.writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`wrote ${out} at burn height ${snapshot.burn_height} (${paths.length} responses)`);
