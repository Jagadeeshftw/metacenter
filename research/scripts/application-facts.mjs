// Regenerate research/application-facts.md from live public data.
//   node research/scripts/application-facts.mjs
// Reads the public API (https://metacenter.0xo.in/api), Hiro for direct pox-5 reads and the
// chain tip, and the contract test files for test counts. No dependencies (Node 22+).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = "https://metacenter.0xo.in";
const API = `${SITE}/api`;
const REPO = "https://github.com/Jagadeeshftw/metacenter";
const HIRO = "https://api.hiro.so";
const POX5 = "SP000000000000000000002Q6VF78.pox-5";
const explorer = (id, net) => `https://explorer.hiro.so/txid/${id}?chain=${net}`;

const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};
const uintFromHex = (hex) => BigInt("0x" + hex.replace(/^0x01/, ""));
const n = (v) => Number(v).toLocaleString("en-US");
const pct = (v, d = 1) => (v == null ? "n/a" : `${(v * 100).toFixed(d)}%`);
const x = (v) => (v == null ? "n/a" : `${v.toFixed(2)}×`);
const label = (f) => (f?.value == null ? "" : ` _(${f.provenance})_`);

const [cur, iv, meta, info] = await Promise.all([get(`${API}/metrics/current`), get(`${API}/intervals`), get(`${API}/meta`), get(`${HIRO}/v2/info`)]);
const last = iv.intervals.at(-1);

// Pending pool: pox5-reader when deployed (onchain), else a direct pox-5 read at the current tip.
let pending = cur.pending_pool?.value != null ? { value: cur.pending_pool.value, how: `pox5-reader::get-pending-pool _(onchain)_` } : null;
if (!pending) {
  const r = await fetch(`${HIRO}/v2/contracts/call-read/${POX5.replace(".", "/")}/get-new-rewards`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sender: POX5.split(".")[0], arguments: [] }),
  }).then((r) => r.json());
  pending = { value: r.okay ? uintFromHex(r.result).toString() : null, how: `direct read of pox-5 get-new-rewards (${meta?.reader ? "pox5-reader::get-pending-pool is over Hiro's public read-length cap" : "pox5-reader not deployed yet"})` };
}

const countTests = (dir) =>
  fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".ts")).reduce((s, f) => s + (fs.readFileSync(path.join(ROOT, dir, f), "utf8").match(/^\s*it\(/gm) ?? []).length, 0);
const simnet = countTests("contracts/tests");
const fork = countTests("contracts/tests-fork");

const readerLine = meta.reader
  ? `| pox5-reader | mainnet | [\`${meta.reader}\`](${explorer(meta.reader, "mainnet")}) |`
  : "| pox5-reader | mainnet | not deployed yet (waiting for deployer funding) |";
const guardLine = meta.guard_mainnet
  ? `| coverage-guard-cached (example consumer) | mainnet | [\`${meta.guard_mainnet}\`](${explorer(meta.guard_mainnet, "mainnet")}) |`
  : null;
const cacheLine = meta.cache
  ? `| coverage-cache | mainnet | [\`${meta.cache}\`](${explorer(meta.cache, "mainnet")}) |`
  : null;
const traitMainLine = meta.trait.mainnet
  ? `| risk-feed-trait | mainnet | [\`${meta.trait.mainnet}\`](${explorer(meta.trait.mainnet, "mainnet")}) |`
  : "| risk-feed-trait | mainnet | not deployed yet (deploys with pox5-reader) |";

const rows = iv.intervals.map((i) => {
  const d = Object.fromEntries((i.crosscheck.note.match(/(\w+) (-?\d+)/g) ?? []).map((s) => s.split(" ")));
  const worst = Math.max(...Object.values(d).map((v) => Math.abs(Number(v))));
  return `| ${i.distribution_index} | ${i.cycle} | ${n(i.gross_pool.value)} | ${n(i.bond_paid.value)} | ${n(i.reserve_deposit.value)} | ${d.reserve === "0" ? "exact" : `${d.reserve} sats`} | ${i.crosscheck.ok ? "yes" : "NO"} | ${worst} sat${worst === 1 ? "" : "s"} | [tx](${explorer(i.txid, "mainnet")}) |`;
});

const md = `# Metacenter: application facts

Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC by \`research/scripts/application-facts.mjs\` from public data. Rerun it to refresh.

## Links

| What | URL |
|---|---|
| Site | ${SITE} |
| Dashboard | ${SITE}/dashboard |
| Methodology (every number mapped to its source) | ${SITE}/methodology |
| Public API (base) | ${API}, e.g. ${API}/metrics/current |
| Source (MIT) | ${REPO} |

\`metacenter-chi.vercel.app\` 308-redirects to ${SITE}.

## Contracts

| Contract | Network | ID |
|---|---|---|
${readerLine}
${traitMainLine}${cacheLine ? "\n" + cacheLine : ""}${guardLine ? "\n" + guardLine : ""}
| risk-feed | testnet | [\`${meta.feed}\`](${explorer(meta.feed, "testnet")}) |
| risk-feed-trait | testnet | [\`${meta.trait.testnet}\`](${explorer(meta.trait.testnet, "testnet")}) |
| coverage-guard (example consumer) | testnet | [\`${meta.guard}\`](${explorer(meta.guard, "testnet")}) |
| pox-5 (read by pox5-reader) | mainnet | [\`${meta.pox5}\`](${explorer(meta.pox5, "mainnet")}) |

The testnet feed mirrors mainnet data. Every distribution below is posted there with its raw inputs.

## Headline numbers

The indexer last polled at Bitcoin block **${n(cur.as_of.burn_height)}** (${cur.as_of.taken_at}). Figures that come from the latest distribution are as of that distribution, **${last.distribution_index}**: cycle ${last.cycle}, calculation height ${n(last.calculation_height)}.

| Figure | Value |
|---|---|
| Coverage | ${x(cur.coverage.value ?? last.coverage.value)}${cur.coverage.value != null ? label(cur.coverage) : " _(mirrored, distribution " + last.distribution_index + ")_"}. ${n(last.gross_pool.value)} sats pool ÷ ${n(last.obligation.value)} sats owed |
| Headroom | ${pct(cur.headroom.value ?? last.headroom.value)}${cur.headroom.value != null ? label(cur.headroom) : " _(mirrored)_"}. The pool can fall this far before bond yield is impaired |
| Reserve | ${n(cur.reserve.value ?? last.reserve_balance.value)} sats${cur.reserve.value != null ? label(cur.reserve) : " _(mirrored)_"} |
| Hypothetical cover | ${cur.reserve_cover.value != null ? cur.reserve_cover.value.toFixed(2) : (Math.floor((Number(last.reserve_balance.value) * 100) / (2 * Number(last.obligation.value))) / 100).toFixed(2)} cycles. A back-stop by design; accrual-only in this iteration, and using it goes through a SIP process |
| Pending pool | ${pending.value == null ? "n/a" : n(pending.value) + " sats"}, via ${pending.how}, at the Bitcoin tip ${n(info.burn_block_height)} (Stacks ${n(info.stacks_tip_height)}) |
| STX-only realised yield | ${pct(last.stx_only_apy_btc.value, 2)} a year in BTC terms _(mirrored)_. ${Number(last.stx_only_yield.value).toFixed(4)} sats/STX in distribution ${last.distribution_index}, priced at ${Number(last.price.value).toFixed(2)} sats/STX (${last.price.source}) |
| Cliff price | ${cur.cliff.price.value?.toFixed(1) ?? "n/a"} sats/STX _(mirrored; price at distribution ${last.distribution_index} × obligation ÷ pool; assumes miner bids scale with STX price)_ |
| Cliff, 3,000 BTC book | ≈ ${cur.cliff.sip_book_scenario.value?.toFixed(1) ?? "n/a"} sats/STX _(hypothetical; price at distribution ${last.distribution_index}, ${Number(last.price.value).toFixed(2)} sats/STX, × 180,000,000 sats ÷ its pool ${n(last.gross_pool.value)} sats)_ |
| Cliff, friedger's SIP inputs | ${cur.cliff.friedger_sip_inputs.value.toFixed(1)} sats/STX _(hypothetical: 3,000 BTC × 3% ÷ (1,000 STX/block × 52,560 blocks/year))_ |

## Tests

| Suite | Tests |
|---|---|
| \`contracts/tests\` (simnet) | ${simnet}, covering every error code |
| \`contracts/tests-fork\` (pox5-reader against mainnet state pinned at Stacks block 9,019,000) | ${fork} |
| **Total** | **${simnet + fork}** |

## Per-distribution recompute

Each distribution is recomputed independently from pox-5 state just before and after its calculate-rewards block (\`call-read ?tip=\`), then compared with the event.

| Distribution | Cycle | Gross (sats) | Paid to bonds (sats) | Reserve deposit (sats) | Reserve delta vs event | Match | Worst diff | Source |
|---|---|---|---|---|---|---|---|---|
${rows.join("\n")}

## Missing blocks

In distribution 286, only 705 of 1,050 Bitcoin blocks paid the pool (230,952,500 sats in miner commits).

- **Why:** in every one of the 345 non-paying blocks, no Stacks block-commit was confirmed, so there was no sortition. Hiro's sortition endpoint shows \`was_sortition: false\` for all 345.
- **Nothing is burned:** under PoX-5 every valid commit pays exactly one output to the sBTC deposit address, including in the prepare phase (stacks-core 4.0.1, \`leader_block_commit.rs:752-827\`).
- **This is not new:** the same ~30% no-sortition rate existed under PoX-4.
- **Who pays:** five miners commit a combined 332,500 sats per block.
- **Stress model:** the pool per interval ≈ 1,050 × paying fraction (0.66–0.72 observed) × per-block spend. The stress test's commit-drop cuts that total directly. Evidence is in \`research/missing-blocks/\`.

## pox-5 line references

Line numbers refer to the deployed source, identical to stacks-core tag 4.0.1 @62e03cc (\`research/pox-5.deployed.clar\`).

| Rule | Where |
|---|---|
| Bond target per interval = shares × target-rate ÷ 10000 ÷ 50 | L2266 |
| Bonds paid in descending stx-value-ratio, ties to the lower bond index | L2285–2299, enforced with \`ERR_INVALID_BOND_PERIOD_ORDERING\` |
| Within a bond, flat per-token accounting | L2304–2309 |
| Reserve takes 15% of what remains after bonds | L2190 (\`RESERVE_RATIO u1500\`, L107) |
| The reserve has no automatic path to bonds in this iteration: \`transfer-from-reserve\` is private and uncalled | L2696 |

## Infrastructure

| Piece | Where it runs |
|---|---|
| Indexer and API | Railway (Node/TS, Postgres), polling every ~10 minutes; the site proxies ${API}/* to it |
| Site | Vercel, at ${SITE} |
| DNS | Cloudflare: CNAME \`metacenter\` → \`dfafebc54dafb963.vercel-dns-017.com\` (DNS only) |
`;

fs.writeFileSync(path.join(ROOT, "research", "application-facts.md"), md);
console.log(`wrote research/application-facts.md (block ${cur.as_of.burn_height}, reader ${meta.reader ?? "not deployed"})`);
