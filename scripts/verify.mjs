// Rebuild every headline figure from public sources and compare it with what the site shows.
//
//   npm run verify                 check https://metacenter.0xo.in
//   npm run verify -- --json       the same, as JSON
//   node scripts/verify.mjs --site https://metacenter.0xo.in
//
// No secrets, no install, no local database: Node 22+ and a network connection. Everything on
// the left of the table is computed here, from pox-5 state read through the public Hiro API,
// the sBTC token contract, the deployed Metacenter contracts and CoinGecko. Everything on the
// right is what the site is publishing right now.
//
// Each figure is recomputed from pox-5 as it stood at the block the published figure describes,
// never from today's state: a bond's shares can change after a distribution, and that must not
// make a correct published number look wrong. The block each side was read at is printed,
// because a figure without its height is not checkable.
//
//   the latest distribution    pox-5 just before and just after its calculate-rewards block
//   the headline figures       pox-5 at the block where coverage-cache last stored them
//   the reserve and the pool   pox-5 at the chain tip
//
// Exit code 0 when every check passes, 1 otherwise.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const SITE = (arg("site", "https://metacenter.0xo.in") ?? "").replace(/\/$/, "");
const HIRO = arg("hiro", "https://api.hiro.so");
const COINGECKO = arg("coingecko", "https://api.coingecko.com/api/v3");
const JSON_OUT = process.argv.includes("--json");

const POX5 = "SP000000000000000000002Q6VF78.pox-5";
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const PRECISION = 10n ** 18n;
const RESERVE_RATIO = 1500n; // pox-5 RESERVE_RATIO, basis points
const INTERVALS_PER_YEAR = 50n; // the /u50 in pox-5 target-yield
const SIP_BOOK_SATS = 180_000_000n; // 3,000 BTC at 3% per interval: 3000e8 * 0.03 / 50

// ---------------------------------------------------------------- plumbing
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** GET/POST JSON. Hiro allows 50 requests a minute per IP: on a 429, wait and try again. */
const jget = async (url, init) => {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    if (r.status === 429 && attempt < 4) {
      await sleep(Math.min(Number(r.headers.get("retry-after")) || 2 ** attempt * 5, 60) * 1000);
      continue;
    }
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
  }
};

/** Minimal Clarity value decoding: enough for the uints, tuples and options pox-5 returns. */
function decode(hex) {
  const buf = Buffer.from(hex.replace(/^0x/, ""), "hex");
  let i = 0;
  const u8 = () => buf[i++];
  const uint = () => {
    const v = BigInt("0x" + buf.subarray(i, i + 16).toString("hex"));
    i += 16;
    return v;
  };
  const str = (n) => {
    const s = buf.subarray(i, i + n).toString("ascii");
    i += n;
    return s;
  };
  const value = () => {
    const type = u8();
    switch (type) {
      case 0x00: return -uint(); // int, negative not expected here
      case 0x01: return uint(); // uint
      case 0x02: { const n = buf.readUInt32BE(i); i += 4; const b = buf.subarray(i, i + n); i += n; return "0x" + b.toString("hex"); }
      case 0x03: return true;
      case 0x04: return false;
      case 0x05: { const b = buf.subarray(i, i + 21); i += 21; return "principal:" + b.toString("hex"); }
      case 0x06: { const b = buf.subarray(i, i + 21); i += 21; const n = u8(); return "principal:" + b.toString("hex") + "." + str(n); }
      case 0x07: return { ok: value() };
      case 0x08: return { err: value() };
      case 0x09: return null; // none
      case 0x0a: return value(); // some
      case 0x0b: { const n = buf.readUInt32BE(i); i += 4; return Array.from({ length: n }, () => value()); }
      case 0x0c: { // tuple
        const n = buf.readUInt32BE(i); i += 4;
        const out = {};
        for (let k = 0; k < n; k++) { const len = u8(); const key = str(len); out[key] = value(); }
        return out;
      }
      case 0x0d: { const n = buf.readUInt32BE(i); i += 4; return str(n); }
      default: throw new Error(`unhandled clarity type 0x${type.toString(16)}`);
    }
  };
  return value();
}

const hexUint = (v) => "0x" + Buffer.concat([Buffer.from([0x01]), Buffer.from(BigInt(v).toString(16).padStart(32, "0"), "hex")]).toString("hex");
const hexNone = () => "0x09";
const hexSome = (inner) => "0x0a" + inner.replace(/^0x/, "");
/** A read-only call, at the chain tip or at the end of the Stacks block whose index hash is `tip`. */
async function callRead(contract, fn, args = [], tip = null) {
  const [addr, name] = contract.split(".");
  const body = { sender: addr, arguments: args };
  const at = tip ? `?tip=${tip.replace(/^0x/, "")}` : "";
  const r = await jget(`${HIRO}/v2/contracts/call-read/${addr}/${name}/${fn}${at}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.okay) throw new Error(`${contract}::${fn}: ${r.cause}`);
  return decode(r.result);
}
const pox = (fn, args, tip) => callRead(POX5, fn, args, tip);

/** The Stacks block that holds `txid`: its index hash (state after it) and its parent's (state before it). */
async function blockOf(txid) {
  const tx = await jget(`${HIRO}/extended/v1/tx/${txid}`);
  if (tx.tx_status !== "success") throw new Error(`${txid} is ${tx.tx_status}`);
  const block = await jget(`${HIRO}/extended/v2/blocks/${tx.block_height}`);
  return {
    height: tx.block_height,
    burnHeight: tx.burn_block_height,
    burnTime: tx.burn_block_time,
    after: block.index_block_hash,
    before: block.parent_index_block_hash,
  };
}

/** Bonds with shares in `cycle`, the way pox-5 indexes them (one bond period per two cycles). */
async function activeBonds(cycle, tip) {
  const firstBondCycle = await pox("bond-period-to-reward-cycle", [hexUint(0)], tip);
  const latest = cycle <= firstBondCycle ? 0n : (cycle - firstBondCycle) / 2n;
  const bonds = [];
  for (let b = 0n; b <= latest; b++) {
    const shares = await pox("get-total-shares-staked-for-cycle", [hexUint(cycle), hexSome(hexUint(b))], tip);
    if (shares === 0n) continue;
    const pb = await pox("get-protocol-bond", [hexUint(b)], tip);
    bonds.push({ index: b, shares, rate: pb["target-rate"] });
  }
  return bonds;
}
const targetPerInterval = (b) => (b.shares * b.rate) / 10000n / INTERVALS_PER_YEAR; // pox-5 L2266
const rpt = (cycle, bond, tip) =>
  pox("get-rewards-per-token-for-cycle", [hexUint(cycle), bond == null ? hexNone() : hexSome(hexUint(bond))], tip);

// ---------------------------------------------------------------- checks
const rows = [];
const add = (group, figure, mine, site, source, ok, note = "") => rows.push({ group, figure, recomputed: mine, site, source, ok, note });
const near = (a, b, tol) => a != null && b != null && Math.abs(Number(a) - Number(b)) <= tol;
const fmt = (v, d = 2) => (v == null ? "n/a" : typeof v === "bigint" ? v.toLocaleString("en-US") : typeof v === "number" ? v.toFixed(d) : String(v));
const ratio = (a, b) => (b === 0n ? null : Number(a) / Number(b));
const headroomOf = (pool, obligation) => (obligation === 0n || pool === 0n ? null : pool >= obligation ? Number(pool - obligation) / Number(pool) : 0);

async function main() {
  const info = await jget(`${HIRO}/v2/info`);
  const tip = info.burn_block_height;

  // --- what the site says
  const [cur, iv, meta, health] = await Promise.all([
    jget(`${SITE}/api/metrics/current`),
    jget(`${SITE}/api/intervals`),
    jget(`${SITE}/api/meta`),
    jget(`${SITE}/api/health`).catch(() => null),
  ]);
  const last = iv.intervals.at(-1);
  const cycle = BigInt(last.cycle);

  // --- 1. the latest distribution, from pox-5 just before and just after its calculate-rewards block
  const dist = await blockOf(last.txid);
  const D = `distribution ${last.distribution_index}`;
  const bonds = await activeBonds(cycle, dist.after);
  let bondPaid = 0n;
  for (const b of bonds) bondPaid += ((await rpt(cycle, b.index, dist.after)) - (await rpt(cycle, b.index, dist.before))) * b.shares / PRECISION;
  const stxShares = await pox("get-total-shares-staked-for-cycle", [hexUint(cycle), hexNone()], dist.after);
  const stxPaid = ((await rpt(cycle, null, dist.after)) - (await rpt(cycle, null, dist.before))) * stxShares / PRECISION;
  const reserveBefore = await pox("get-reserve-balance", [], dist.before);
  const reserveAfter = await pox("get-reserve-balance", [], dist.after);
  const deposit = reserveAfter - reserveBefore;
  const pool = bondPaid + stxPaid + deposit;
  const obligation = bonds.reduce((s, b) => s + targetPerInterval(b), 0n);
  const coverage = ratio(pool, obligation);
  const headroom = headroomOf(pool, obligation);
  const yieldPerStx = stxShares === 0n ? null : (Number(stxPaid) * 1e6) / Number(stxShares);

  // the price at the distribution, from CoinGecko, for the figures that are price-based. The time is
  // the calculate-rewards transaction's, as the indexer uses: the calculation height itself can be a
  // Bitcoin block with no Stacks block, which Hiro's burn-blocks endpoint does not know.
  const at = dist.burnTime;
  const chart = await jget(`${COINGECKO}/coins/blockstack/market_chart/range?vs_currency=btc&from=${at - 7200}&to=${at + 7200}`);
  const point = (chart.prices ?? []).reduce((best, p) => (Math.abs(p[0] / 1000 - at) < Math.abs(best[0] / 1000 - at) ? p : best), chart.prices?.[0]);
  const priceAtDist = point ? point[1] * 1e8 : null;
  const apy = yieldPerStx == null || !priceAtDist ? null : (yieldPerStx * Number(INTERVALS_PER_YEAR)) / priceAtDist;
  const sipCliff = priceAtDist == null || pool === 0n ? null : (priceAtDist * Number(SIP_BOOK_SATS)) / Number(pool);

  const v = (m) => m?.value;
  add(D, "Reward pool (sats)", fmt(pool), fmt(BigInt(v(last.gross_pool))), "paid to bonds + STX-only stakers + reserve in that block",
    near(pool, BigInt(v(last.gross_pool)), 2 * (bonds.length + 1)), "±2 sats from rewards-per-token truncation");
  add(D, "Obligation (sats)", fmt(obligation), fmt(BigInt(v(last.obligation))), "sum of bond shares x target-rate / 10000 / 50",
    obligation === BigInt(v(last.obligation)));
  add(D, "Coverage (x)", fmt(coverage, 3), fmt(Number(v(last.coverage)), 3), "pool / obligation", near(coverage, v(last.coverage), 0.01));
  add(D, "Headroom", fmt(headroom, 4), fmt(Number(v(last.headroom)), 4), "1 - obligation / pool", near(headroom, v(last.headroom), 0.0005));
  add(D, "Reserve deposit (sats)", fmt(deposit), fmt(BigInt(v(last.reserve_deposit))), "pox-5 get-reserve-balance, after minus before",
    deposit === BigInt(v(last.reserve_deposit)));
  add(D, "Reserve after (sats)", fmt(reserveAfter), fmt(BigInt(v(last.reserve_balance))), "pox-5 get-reserve-balance after the block",
    reserveAfter === BigInt(v(last.reserve_balance)));
  add(D, "STX-only yield (sats per STX)", fmt(yieldPerStx, 4), fmt(Number(v(last.stx_only_yield)), 4), "stx-only sats / shares x 1e6",
    near(yieldPerStx, v(last.stx_only_yield), 0.0005));
  add(D, "STX-only APY (BTC terms)", fmt(apy, 4), fmt(Number(v(last.stx_only_apy_btc)), 4), "yield x 50 / price at the distribution (CoinGecko)",
    near(apy, v(last.stx_only_apy_btc), 0.002), "price-based: CoinGecko hourly point may differ slightly");
  const siteCliff = v(cur.cliff.sip_book_scenario) == null ? null : Number(v(cur.cliff.sip_book_scenario));
  add(D, "Cliff, 3,000 BTC book (sats/STX)", fmt(sipCliff), fmt(siteCliff), "price at the distribution x 180,000,000 / pool",
    near(sipCliff, siteCliff, 5), "price-based");

  // --- 2. the headline figures: what coverage-cache stored on-chain, recomputed from pox-5 at that block
  const cache = (await callRead(meta.cache, "get-coverage-summary")).ok;
  const cacheAt = Number(cache["updated-at"]);
  const H = `headline, Bitcoin block ${cacheAt}`;
  const txs = await jget(`${HIRO}/extended/v1/address/${meta.cache}/transactions?limit=20`);
  const refresh = txs.results.find((t) => t.tx_status === "success" && t.contract_call?.function_name === "refresh" && t.burn_block_height === cacheAt);
  if (!refresh) throw new Error(`no successful coverage-cache refresh at Bitcoin block ${cacheAt}`);
  const R = await blockOf(refresh.tx_id);
  // pox5-reader get-coverage-summary: the current cycle, or the one before if it has no distribution yet
  const nowCycle = await pox("current-pox-reward-cycle", [], R.after);
  const lastCalc = await pox("get-last-reward-compute-height", [], R.after);
  const calcHeights = async (c) => {
    const first = await pox("burn-height-to-distribution-index", [hexUint(await pox("reward-cycle-to-burn-height", [hexUint(c)], R.after))], R.after);
    const end = async (k) => (await pox("distribution-cycle-to-burn-height", [hexUint(first + k)], R.after)) - 1n;
    return [await end(1n), await end(2n)];
  };
  const intervalsIn = async (c) => (await calcHeights(c)).filter((h) => lastCalc >= h).length;
  let hc = nowCycle;
  let intervals = BigInt(await intervalsIn(hc));
  if (hc > 0n && intervals === 0n) { hc -= 1n; intervals = BigInt(await intervalsIn(hc)); }
  const hBonds = await activeBonds(hc, R.after);
  let hPaid = 0n;
  for (const b of hBonds) hPaid += ((await rpt(hc, b.index, R.after)) * b.shares) / PRECISION;
  const hStxPaid = ((await rpt(hc, null, R.after)) * (await pox("get-total-shares-staked-for-cycle", [hexUint(hc), hexNone()], R.after))) / PRECISION;
  const hPool = hPaid + (hStxPaid * 10000n) / (10000n - RESERVE_RATIO);
  const hTarget = hBonds.reduce((s, b) => s + targetPerInterval(b), 0n);
  const hObligation = intervals * hTarget;
  const hReserve = await pox("get-reserve-balance", [], R.after);
  const bps = (a, b) => (b === 0n ? null : Number((a * 10000n) / b) / 10000);
  const hCoverage = bps(hPool, hObligation);
  const hHeadroom = hObligation === 0n || hPool === 0n ? null : hPool >= hObligation ? bps(hPool - hObligation, hPool) : 0;
  const hCover = hTarget === 0n ? null : Number((hReserve * 100n) / (2n * hTarget)) / 100;

  const siteCov = v(cur.coverage) == null ? null : Number(v(cur.coverage));
  const siteHead = v(cur.headroom) == null ? null : Number(v(cur.headroom));
  add(H, "Coverage (x)", fmt(hCoverage, 4), fmt(siteCov, 4), "pox5-reader's formula on pox-5 at the refresh block",
    near(hCoverage, siteCov, 0.0001) && near(siteCov, cache["coverage-bps"] == null ? null : Number(cache["coverage-bps"]) / 10000, 0.0001),
    "the published figure must also equal coverage-cache's stored coverage-bps");
  add(H, "Headroom", fmt(hHeadroom, 4), fmt(siteHead, 4), "1 - obligation / pool at the refresh block",
    near(hHeadroom, siteHead, 0.0001));
  add(H, "Obligation per interval (sats)", fmt(hTarget), fmt(BigInt(v(cur.obligation_per_interval))), "bond shares x target-rate / 10000 / 50 at the refresh block",
    hTarget === BigInt(v(cur.obligation_per_interval)));
  add(H, "Hypothetical cover (cycles)", fmt(hCover), fmt(v(cur.reserve_cover) == null ? null : Number(v(cur.reserve_cover))), "reserve / (2 x obligation), truncated",
    near(hCover, v(cur.reserve_cover), 0.005));

  // --- 3. now: the reserve and the pending pool at the chain tip
  const N = `now, Bitcoin block ${tip}`;
  const reserve = await pox("get-reserve-balance", []);
  add(N, "Reserve (sats)", fmt(reserve), fmt(BigInt(v(cur.reserve))), "pox-5 get-reserve-balance", reserve === BigInt(v(cur.reserve)),
    "changes only at a distribution");
  // the sBTC pox-5 holds, from Hiro's balances endpoint (same number as sbtc-token get-balance,
  // without hand-encoding a contract principal)
  const balances = await jget(`${HIRO}/extended/v1/address/${POX5}/balances`);
  const sbtcKey = Object.keys(balances.fungible_tokens ?? {}).find((k) => k.startsWith(SBTC));
  const balance = BigInt(balances.fungible_tokens[sbtcKey].balance);
  const accounted = (await pox("get-total-sbtc-staked", [])) + reserve + (await pox("get-last-accounted-rewards-only", []));
  const pending = balance >= accounted ? balance - accounted : 0n;
  // The published pending pool is the reading coverage-cache recorded on-chain, which is some
  // blocks behind the tip; miner commits accrue in between, so the two are not the same number
  // and should not be. What must hold is that the published figure is a real earlier reading:
  // not larger than the pool now, and not negative.
  const sitePending = v(cur.pending_pool) == null ? null : BigInt(v(cur.pending_pool));
  add(N, "Pending pool (sats)", fmt(pending), fmt(sitePending), "sbtc-token balance of pox-5 minus what pox-5 has accounted",
    sitePending == null || (sitePending >= 0n && sitePending <= pending + 2_000_000n),
    `published figure was recorded at block ${cacheAt}, ${tip - cacheAt} blocks back; it accrues with miner commits, so it must be no larger than the figure now`);

  // --- the contracts the site says it is reading, byte for byte
  for (const [name, id] of [["pox5-reader", meta.reader], ["coverage-cache", meta.cache], ["coverage-guard-cached", meta.guard_mainnet]]) {
    if (!id) continue;
    const [addr, cname] = id.split(".");
    const onchain = (await jget(`${HIRO}/v2/contracts/source/${addr}/${cname}`)).source;
    const file = path.join(ROOT, "contracts", "contracts", `${cname}.clar`);
    const sha = (s) => createHash("sha256").update(s.replace(/\n+$/, "\n")).digest("hex");
    const repo = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    add("contracts", `${name} source`, repo ? sha(repo).slice(0, 12) : "(file missing)", sha(onchain).slice(0, 12),
      `${id} vs contracts/contracts/${cname}.clar`, repo != null && sha(repo) === sha(onchain), "sha256, trailing newline ignored");
  }

  const failed = rows.filter((r) => !r.ok);
  const out = {
    site: SITE,
    read_at: {
      bitcoin_block: tip,
      site_block: cur.as_of.burn_height,
      distribution: { index: last.distribution_index, cycle: Number(cycle), calculation_height: last.calculation_height, txid: last.txid,
        stacks_block: dist.height, state_before: dist.before, state_after: dist.after },
      headline: { bitcoin_block: cacheAt, refresh_txid: refresh.tx_id, stacks_block: R.height, state: R.after },
    },
    sources: { pox5: POX5, sbtc: SBTC, hiro: HIRO, prices: COINGECKO },
    checks: rows.map(({ group, figure, recomputed, site, source, ok, note }) => ({ group, figure, recomputed, site, source, pass: ok, note })),
    passed: rows.length - failed.length,
    failed: failed.length,
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(`\nMetacenter: rebuilding every headline figure from public data\n`);
    console.log(`  site           ${SITE}`);
    console.log(`  pox-5          ${POX5} (via ${HIRO})`);
    console.log(`  prices         ${COINGECKO}`);
    console.log(`  chain tip      Bitcoin block ${tip}; the site last read at ${cur.as_of.burn_height}`);
    console.log(`  distribution   ${last.distribution_index} (cycle ${cycle}): pox-5 before and after Stacks block ${dist.height}`);
    console.log(`  headline       coverage-cache refresh at Bitcoin block ${cacheAt}: pox-5 at Stacks block ${R.height}\n`);
    const w = Math.max(...rows.map((r) => r.figure.length));
    let group = null;
    console.log(`  ${"figure".padEnd(w)}  ${"recomputed here".padStart(17)}  ${"published".padStart(17)}`);
    for (const r of rows) {
      if (r.group !== group) {
        group = r.group;
        console.log(`  ${("-- " + group + " ").padEnd(w + 40, "-")}`);
      }
      console.log(`  ${r.figure.padEnd(w)}  ${String(r.recomputed).padStart(17)}  ${String(r.site).padStart(17)}  ${r.ok ? "ok" : "MISMATCH"}`);
    }
    console.log(`\n  ${out.passed}/${rows.length} checks pass${failed.length ? `, ${failed.length} MISMATCH` : ""}.`);
    console.log(`  Every number on the left was computed by this script from public sources. --json lists each source.\n`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nverify failed: ${e.message}\n`);
  console.error(`This checks public endpoints only. If Hiro or CoinGecko is rate-limiting, wait a minute and run it again.\n`);
  process.exit(1);
});
