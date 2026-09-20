// Verify every pox5-reader read-only on mainnet against pox-5 state read directly, and record
// the values with the block height.
//
//   node scripts/verify-mainnet.mjs [<reader-contract-id>]
//
// Both sides are read at the same tip (the Stacks index block hash of the chain tip), so the
// comparison is of one block's state. The reader's answers are on the left, the same figures
// computed here from pox-5 (and sbtc-token) on the right. Nothing is written.
//
// Hiro's /v2/contracts/call-read allows 500,000 of read length, and every contract-call? into
// pox-5 loads that contract: about 569k. So the reader functions that read pox-5 cannot be
// called through the public endpoint, and show as "Hiro cap" here. That limit does not exist
// inside a transaction or a fork; scripts/verify-at-tip.mjs checks those against the same
// state. The independent column is filled in either way.
import { Cl, cvToValue, hexToCV, cvToHex } from "@stacks/transactions";

const API = "https://api.hiro.so";
const POX5 = "SP000000000000000000002Q6VF78.pox-5";
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const READER = process.argv[2] ?? "SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader";
const PRECISION = 10n ** 18n;
const RESERVE_RATIO = 1500n;
const SENDER = "SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY";

const info = await (await fetch(`${API}/v2/info`)).json();
const tipBlock = await (await fetch(`${API}/extended/v2/blocks/${info.stacks_tip_height}`)).json();
const tip = tipBlock.index_block_hash.replace(/^0x/, "");

/** cvToValue(..., true) wraps every value as {type, value}; strip that back to plain data. */
function plain(v) {
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object") {
    if ("type" in v && "value" in v && Object.keys(v).length === 2) return plain(v.value);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

async function callRead(contract, fn, args = []) {
  const [addr, name] = contract.split(".");
  const r = await fetch(`${API}/v2/contracts/call-read/${addr}/${name}/${fn}?tip=${tip}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sender: SENDER, arguments: args.map((a) => cvToHex(a)) }),
  });
  const j = await r.json();
  if (!j.okay) throw new Error(`${contract}::${fn}: ${j.cause ?? JSON.stringify(j)}`);
  return plain(cvToValue(hexToCV(j.result), true));
}
const CAP = "Hiro cap";
/** A reader read-only, or CAP when the public endpoint refuses it on read length. */
const reader = async (fn, args) => {
  try {
    return await callRead(READER, fn, args);
  } catch (e) {
    if (/CostBalanceExceeded/.test(e.message)) return CAP;
    throw e;
  }
};
const pox5 = (fn, args) => callRead(POX5, fn, args);
const n = (v) => BigInt(v?.value ?? v);

const rows = [];
let failures = 0;
let capped = 0;
const check = (name, got, want, note = "") => {
  if (got === CAP || got === undefined) {
    capped++;
    rows.push({ "read-only": name, reader: CAP, "independent (pox-5)": String(want), match: "-", note });
    return;
  }
  const ok = String(got) === String(want);
  if (!ok) failures++;
  rows.push({ "read-only": name, reader: String(got), "independent (pox-5)": String(want), match: ok ? "yes" : "NO", note });
};
/** Reader field, or CAP if the whole call was refused. */
const fld = (res, pick) => (res === CAP ? CAP : pick(res));

// --- cycle and heights ---------------------------------------------------
const pox5Cycle = n(await pox5("current-pox-reward-cycle"));
const cycleRes = await reader("get-current-cycle");
check("get-current-cycle", fld(cycleRes, n), pox5Cycle, "pox-5 current-pox-reward-cycle");
const cycle = pox5Cycle;

const heights = await reader("get-cycle-calc-heights", [Cl.uint(cycle)]);
const start = n(await pox5("reward-cycle-to-burn-height", [Cl.uint(cycle)]));
const firstDist = n(await pox5("burn-height-to-distribution-index", [Cl.uint(start)]));
const mid = n(await pox5("distribution-cycle-to-burn-height", [Cl.uint(firstDist + 1n)])) - 1n;
const end = n(await pox5("distribution-cycle-to-burn-height", [Cl.uint(firstDist + 2n)])) - 1n;
check(`get-cycle-calc-heights(u${cycle}).mid`, fld(heights, (h) => n(h.mid)), mid, "last block of the cycle's first interval");
check(`get-cycle-calc-heights(u${cycle}).end`, fld(heights, (h) => n(h.end)), end, "last block of the second");

const lastCalc = n(await pox5("get-last-reward-compute-height"));
check(`get-intervals-computed(u${cycle})`, fld(await reader("get-intervals-computed", [Cl.uint(cycle)]), n), (lastCalc >= mid ? 1n : 0n) + (lastCalc >= end ? 1n : 0n), `last-reward-compute-height ${lastCalc}`);

// --- bonds, obligation ---------------------------------------------------
const order = await reader("get-bond-payout-order", [Cl.uint(cycle)]);
// Bond indices the same way the reader derives them: bond 0 starts at bond-period-to-reward-cycle
// u0, and a new bond period every 2 cycles. Only bonds with shares in this cycle are active.
const firstBondCycle = n(await pox5("bond-period-to-reward-cycle", [Cl.uint(0)]));
const latest = cycle <= firstBondCycle ? 0n : (cycle - firstBondCycle) / 2n;
const indices = [];
for (let i = 0n; i <= latest; i++) {
  const shares = n(await pox5("get-total-shares-staked-for-cycle", [Cl.uint(cycle), Cl.some(Cl.uint(i))]));
  if (shares > 0n) indices.push(i);
}
const bonds = [];
for (const idx of indices) {
  const b = order === CAP ? CAP : (order.find((o) => n(o["bond-index"]) === idx) ?? CAP);
  const pb = await pox5("get-protocol-bond", [Cl.uint(idx)]);
  const shares = n(await pox5("get-total-shares-staked-for-cycle", [Cl.uint(cycle), Cl.some(Cl.uint(idx))]));
  const target = (shares * n(pb["target-rate"])) / 10000n / 50n;
  check(`get-bond-payout-order(u${cycle})[${idx}].stx-value-ratio`, fld(b, (x) => n(x["stx-value-ratio"])), n(pb["stx-value-ratio"]), "pox-5 get-protocol-bond");
  check(`get-bond-payout-order(u${cycle})[${idx}].target-rate`, fld(b, (x) => n(x["target-rate"])), n(pb["target-rate"]), "");
  check(`get-bond-payout-order(u${cycle})[${idx}].shares`, fld(b, (x) => n(x.shares)), shares, "get-total-shares-staked-for-cycle(bond)");
  check(`get-bond-payout-order(u${cycle})[${idx}].target-per-interval`, fld(b, (x) => n(x["target-per-interval"])), target, "shares * rate / 10000 / 50");
  bonds.push({ idx, shares, ratio: n(pb["stx-value-ratio"]), target, rpt: n(await pox5("get-rewards-per-token-for-cycle", [Cl.uint(cycle), Cl.some(Cl.uint(idx))])) });
}
const sorted = [...bonds].sort((a, b) => (b.ratio === a.ratio ? Number(a.idx - b.idx) : Number(b.ratio - a.ratio)));
check(
  `get-bond-payout-order(u${cycle}) order`,
  fld(order, (o) => o.map((i) => n(i["bond-index"])).join(",")),
  sorted.map((b) => b.idx).join(","),
  "descending stx-value-ratio, ties to the lower index",
);

const obligation = bonds.reduce((s, b) => s + b.target, 0n);
check(`get-obligation-per-interval(u${cycle})`, fld(await reader("get-obligation-per-interval", [Cl.uint(cycle)]), n), obligation, "sum of bond targets");
check(
  "bond-target-per-interval(shares,rate) sample",
  fld(await reader("bond-target-per-interval", [Cl.uint(23017037628), Cl.uint(300)]), n),
  (23017037628n * 300n) / 10000n / 50n,
  "pox-5 L2266 arithmetic",
);

// --- reserve -------------------------------------------------------------
const reserveBal = n(await pox5("get-reserve-balance"));
check("get-reserve", fld(await reader("get-reserve"), n), reserveBal, "pox-5 get-reserve-balance");
const cover = await reader("get-reserve-cover-cycles", [Cl.uint(cycle)]);
check(`get-reserve-cover-cycles(u${cycle}).reserve-sats`, fld(cover, (c) => n(c["reserve-sats"])), reserveBal, "");
check(`get-reserve-cover-cycles(u${cycle}).obligation-per-cycle-sats`, fld(cover, (c) => n(c["obligation-per-cycle-sats"])), 2n * obligation, "two intervals per cycle");
check(
  `get-reserve-cover-cycles(u${cycle}).cover-cycles-x100`,
  fld(cover, (c) => (c["cover-cycles-x100"] == null ? "none" : n(c["cover-cycles-x100"]))),
  obligation === 0n ? "none" : (reserveBal * 100n) / (2n * obligation),
  "hypothetical cover only",
);
check(`get-reserve-cover-cycles(u${cycle}).reserve-can-pay-bonds`, fld(cover, (c) => c["reserve-can-pay-bonds"]), false, "transfer-from-reserve is private (pox-5 L2696)");

// --- coverage ------------------------------------------------------------
const stxShares = n(await pox5("get-total-shares-staked-for-cycle", [Cl.uint(cycle), Cl.none()]));
const stxRpt = n(await pox5("get-rewards-per-token-for-cycle", [Cl.uint(cycle), Cl.none()]));
const stxPaid = (stxRpt * stxShares) / PRECISION;
const bondPaid = bonds.reduce((s, b) => s + (b.rpt * b.shares) / PRECISION, 0n);
const pool = bondPaid + (stxPaid * 10000n) / (10000n - RESERVE_RATIO);
const cov = await reader("get-coverage-for-cycle", [Cl.uint(cycle)]);
check(`get-coverage-for-cycle(u${cycle}).pool-sats`, fld(cov, (c) => n(c["pool-sats"])), pool, "bond rpt*shares + stx paid grossed up by the 15% reserve cut");
check(`get-coverage-for-cycle(u${cycle}).bond-paid-sats`, fld(cov, (c) => n(c["bond-paid-sats"])), bondPaid, "");
check(`get-coverage-for-cycle(u${cycle}).stx-paid-sats`, fld(cov, (c) => n(c["stx-paid-sats"])), stxPaid, "");
check(`get-coverage-for-cycle(u${cycle}).obligation-sats`, fld(cov, (c) => n(c["obligation-sats"])), obligation, "");
check(
  `get-coverage-for-cycle(u${cycle}).coverage-bps`,
  fld(cov, (c) => (c["coverage-bps"] == null ? "none" : n(c["coverage-bps"]))),
  obligation === 0n ? "none" : (pool * 10000n) / obligation,
  "n/a when no bonds",
);
check(
  `get-coverage-for-cycle(u${cycle}).headroom-bps`,
  fld(cov, (c) => (c["headroom-bps"] == null ? "none" : n(c["headroom-bps"]))),
  obligation === 0n || pool === 0n ? "none" : pool >= obligation ? ((pool - obligation) * 10000n) / pool : 0n,
  "",
);

// --- pending pool --------------------------------------------------------
const balance = n(await callRead(SBTC, "get-balance", [Cl.principal(POX5)]));
const accounted = n(await pox5("get-total-sbtc-staked")) + reserveBal + n(await pox5("get-last-accounted-rewards-only"));
const pending = await reader("get-pending-pool");
check("get-pending-pool.pending-sats", fld(pending, (p) => n(p["pending-sats"])), balance >= accounted ? balance - accounted : 0n, "sbtc-token balance of pox-5 minus accounted");
check("get-pending-pool.balanced", fld(pending, (p) => p.balanced), balance >= accounted, "");
check("get-pending-pool.last-compute-height", fld(pending, (p) => n(p["last-compute-height"])), lastCalc, "");

// --- waterfall simulation ------------------------------------------------
const sim = await reader("simulate-waterfall", [Cl.uint(pool), Cl.uint(cycle)]);
let left = pool;
const expected = sorted.map((b) => {
  const paid = left >= b.target ? b.target : left;
  left -= paid;
  return { idx: b.idx, paid, status: paid === b.target ? "full" : paid === 0n ? "none" : "partial" };
});
const reserveDeposit = (left * RESERVE_RATIO) / 10000n;
for (const [i, e] of expected.entries()) {
  check(`simulate-waterfall(pool,u${cycle}).bonds[${i}].paid-sats`, fld(sim, (s) => n(s.bonds[i]["paid-sats"])), e.paid, `bond ${e.idx}`);
  check(`simulate-waterfall(pool,u${cycle}).bonds[${i}].status`, fld(sim, (s) => s.bonds[i].status), e.status, "");
}
check(`simulate-waterfall(pool,u${cycle}).reserve-deposit-sats`, fld(sim, (s) => n(s["reserve-deposit-sats"])), reserveDeposit, "15% of the remainder (pox-5 L2190)");
check(`simulate-waterfall(pool,u${cycle}).stx-only-sats`, fld(sim, (s) => n(s["stx-only-sats"])), left - reserveDeposit, "the other 85%");

// --- trait summary -------------------------------------------------------
const sum = await reader("get-coverage-summary");
check("get-coverage-summary.period", fld(sum, (s) => n(s.period)), cycle, "");
check("get-coverage-summary.provenance", fld(sum, (s) => s.provenance), "onchain", "");
check(
  "get-coverage-summary.coverage-bps",
  fld(sum, (s) => (s["coverage-bps"] == null ? "none" : n(s["coverage-bps"]))),
  obligation === 0n ? "none" : (pool * 10000n) / obligation,
  "same as get-coverage-for-cycle",
);
check(
  "get-coverage-summary.headroom-bps",
  fld(sum, (s) => (s["headroom-bps"] == null ? "none" : n(s["headroom-bps"]))),
  obligation === 0n || pool === 0n ? "none" : pool >= obligation ? ((pool - obligation) * 10000n) / pool : 0n,
  "",
);

// --- snapshot map (empty until snapshot() is called) ---------------------
const distIndex = n(await pox5("current-distribution-cycle"));
const snap = await reader("get-snapshot", [Cl.uint(distIndex)]);
rows.push({ "read-only": `get-snapshot(u${distIndex})`, reader: snap === null ? "none" : "recorded", "independent (pox-5)": `current-distribution-cycle ${distIndex}`, match: "n/a", note: "map is empty until snapshot() is called" });

console.log(`reader: ${READER}`);
console.log(`read at Stacks block ${info.stacks_tip_height} (Bitcoin ${info.burn_block_height}), tip 0x${tip}`);
console.log(`cycle ${cycle}, distribution index ${distIndex}, last calculate-rewards height ${lastCalc}\n`);
console.table(rows);
const compared = rows.length - 1 - capped;
console.log(
  failures === 0
    ? `\n${compared} checks match; ${capped} could not be called through Hiro (read length over 500,000) — run scripts/verify-at-tip.mjs for those`
    : `\n${failures} MISMATCH(ES)`,
);
process.exit(failures === 0 ? 0 : 1);
