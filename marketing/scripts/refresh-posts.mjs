// Check (and optionally update) every live figure used in marketing/posts.md.
//   node marketing/scripts/refresh-posts.mjs          report current vs drafted values
//   node marketing/scripts/refresh-posts.mjs --write  also rewrite posts.md in place
// Reads https://metacenter.0xo.in/api. No dependencies (Node 22+).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "posts.md");
const API = process.env.METACENTER_API ?? "https://metacenter.0xo.in/api";
const get = async (p) => {
  const r = await fetch(API + p);
  if (!r.ok) throw new Error(`${p}: ${r.status}`);
  return r.json();
};

const [cur, iv, s50, sipBook, sipDrop] = await Promise.all([
  get("/metrics/current"),
  get("/intervals"),
  get("/stress?commit_drop=0.5"),
  get("/stress?book_btc=3000&bonds=6"),
  get("/stress?book_btc=3000&bonds=6&price_drop=0.3"),
]);
const li = iv.intervals.at(-1);
const n = (v) => Number(v);
const fx = (v, d) => n(v).toFixed(d);

// Each figure: a pattern with ONE capture group around the number, matched only in its own
// context, and the number's current value. Only the captured number is compared or replaced.
const cov = fx(li.coverage.value, 2);
const FIGURES = [
  { name: "coverage, latest distribution", re: /(?:coverage today: |then |from |pool was |in the latest distribution the reward pool was )(\d+\.\d\d)×/g, now: cov },
  { name: "headroom", re: /(\d+)%(?= before bond yield)/g, now: String(Math.round(n(li.headroom.value) * 100)) },
  { name: "gross pool (M sats)", re: /(\d+\.\d)M sats against/g, now: (n(li.gross_pool.value) / 1e6).toFixed(1) },
  { name: "obligation (M sats)", re: /against (\d+\.\d)M sats owed/g, now: (n(li.obligation.value) / 1e6).toFixed(1) },
  { name: "reserve (BTC)", re: /(\d+\.\d{3}) BTC\b/g, now: (n(li.reserve_balance.value) / 1e8).toFixed(3) },
  { name: "hypothetical cover", re: /(\d+\.\d\d) cycles\b/g, now: (Math.floor((n(li.reserve_balance.value) * 100) / (2 * n(li.obligation.value))) / 100).toFixed(2) },
  { name: "STX-only APY", re: /(\d+\.\d\d)% a year/g, now: fx(n(li.stx_only_apy_btc.value) * 100, 2) },
  { name: "sats per STX", re: /(0\.\d\d) sats per STX/g, now: fx(li.stx_only_yield.value, 2) },
  { name: "50% commit drop: coverage", re: /(?:to |go from \S+ to )(\d+\.\d\d)×/g, now: fx(s50.coverage.value, 2) },
  { name: "50% commit drop: APY", re: /falls to (\d+\.\d\d)%/g, now: fx(n(s50.stx_only_apy_btc.value) * 100, 2) },
  { name: "3,000 BTC: coverage", re: /that's (\d+\.\d\d)× coverage/g, now: fx(sipBook.coverage.value, 2) },
  { name: "3,000 BTC: shortfall (M sats)", re: /short-paid by (\d+\.\d)M sats/g, now: (n(sipDrop.shortfall.value) / 1e6).toFixed(1) },
  { name: "3,000 BTC: cliff (sats/STX)", re: /near (\d+) sats\/STX/g, now: String(Math.round(n(cur.cliff.sip_book_scenario.value))) },
  { name: "read at block", re: /Bitcoin block (\d{3},\d{3})\*\*/g, now: n(cur.as_of.burn_height).toLocaleString("en-US") },
  { name: "latest distribution", re: /\*\*distribution (\d+)\*\*/g, now: String(li.distribution_index) },
];

let text = fs.readFileSync(FILE, "utf8");
const rows = [];
for (const f of FIGURES) {
  const found = [...text.matchAll(f.re)].map((m) => m[1]);
  const uniq = [...new Set(found)];
  const stale = uniq.filter((x) => x !== f.now);
  rows.push({ figure: f.name, drafted: uniq.join(" | ") || "(not found)", live: f.now, status: found.length === 0 ? "missing" : stale.length ? "CHANGED" : "same" });
  if (process.argv.includes("--write") && stale.length) text = text.replace(f.re, (m, g) => m.replace(g, f.now));
}
console.log(`live: block ${cur.as_of.burn_height}, distribution ${li.distribution_index}\n`);
console.table(rows);
if (process.argv.includes("--write")) {
  // the D5·2 sources line cites the raw scenario value, the price it used and the block
  const sip = n(cur.cliff.sip_book_scenario.value);
  text = text.replace(
    /- ~\d+ sats\/STX: `\/api\/metrics\/current` → `cliff\.sip_book_scenario` = [\d.]+ \(at current price [\d.]+ sats\/STX, `price`, CoinGecko; block [\d,]+\)\./,
    `- ~${Math.round(sip)} sats/STX: \`/api/metrics/current\` → \`cliff.sip_book_scenario\` = ${sip.toFixed(2)} (at current price ${n(cur.price.value).toFixed(2)} sats/STX, \`price\`, CoinGecko; block ${n(cur.as_of.burn_height).toLocaleString("en-US")}).`,
  );
  // and the posts table in marketing/README.md names the cliff
  const readme = path.join(path.dirname(FILE), "README.md");
  fs.writeFileSync(readme, fs.readFileSync(readme, "utf8").replace(/~\d+ cliff/, `~${Math.round(sip)} cliff`));
  // keep the read-at timestamp in step with the block number
  text = text.replace(/(- Indexer poll at \*\*Bitcoin block [\d,]+\*\* )\([^)]*\)/, `$1(${cur.as_of.taken_at.replace("T", " ").slice(0, 19)} UTC)`);
  fs.writeFileSync(FILE, text);
  console.log("posts.md updated. Re-check post lengths (≤ 280) and the Sources lines before posting.");
}
