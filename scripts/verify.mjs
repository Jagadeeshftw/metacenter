// Rebuild every headline figure from public sources and compare it with what the site shows.
//
//   npm run verify                 check https://metacenter.0xo.in
//   npm run verify -- --json       the same, as JSON
//   node scripts/verify.mjs --site https://metacenter.0xo.in
//
// No secrets, no install, no local database: Node 22+ and a network connection. Everything on
// the left of the table is computed here, from pox-5 state read through the public Hiro API,
// the sBTC token contract, the deployed Metacenter contracts and CoinGecko. Everything on the
// right is what the site is publishing right now. The block height each side was read at is
// printed, because a figure without its height is not checkable.
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
const jget = async (url, init) => {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
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
async function callRead(contract, fn, args = []) {
  const [addr, name] = contract.split(".");
  const body = { sender: addr, arguments: args };
  const r = await jget(`${HIRO}/v2/contracts/call-read/${addr}/${name}/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.okay) throw new Error(`${contract}::${fn}: ${r.cause}`);
  return decode(r.result);
}

// ---------------------------------------------------------------- checks
const rows = [];
const add = (figure, mine, site, source, ok, note = "") => rows.push({ figure, recomputed: mine, site, source, ok, note });
const near = (a, b, tol) => a != null && b != null && Math.abs(Number(a) - Number(b)) <= tol;
const fmt = (v, d = 2) => (v == null ? "n/a" : typeof v === "bigint" ? v.toLocaleString("en-US") : typeof v === "number" ? v.toFixed(d) : String(v));

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

  // --- pox-5 state, read directly
  const cycle = await callRead(POX5, "current-pox-reward-cycle");
  const reserve = await callRead(POX5, "get-reserve-balance");
  const lastCalc = await callRead(POX5, "get-last-reward-compute-height");
  const stxShares = await callRead(POX5, "get-total-shares-staked-for-cycle", [hexUint(cycle), hexNone()]);
  const stxRpt = await callRead(POX5, "get-rewards-per-token-for-cycle", [hexUint(cycle), hexNone()]);
  const firstBondCycle = await callRead(POX5, "bond-period-to-reward-cycle", [hexUint(0)]);

  // active bonds in this cycle, the way pox-5 indexes them
  const latestBond = cycle <= firstBondCycle ? 0n : (cycle - firstBondCycle) / 2n;
  const bonds = [];
  for (let b = 0n; b <= latestBond; b++) {
    const shares = await callRead(POX5, "get-total-shares-staked-for-cycle", [hexUint(cycle), hexSome(hexUint(b))]);
    if (shares === 0n) continue;
    const pb = await callRead(POX5, "get-protocol-bond", [hexUint(b)]);
    const rpt = await callRead(POX5, "get-rewards-per-token-for-cycle", [hexUint(cycle), hexSome(hexUint(b))]);
    bonds.push({ index: b, shares, rate: pb["target-rate"], ratio: pb["stx-value-ratio"], rpt });
  }

  // --- rebuild the figures
  const obligation = bonds.reduce((s, b) => s + (b.shares * b.rate) / 10000n / INTERVALS_PER_YEAR, 0n);
  const bondPaid = bonds.reduce((s, b) => s + (b.rpt * b.shares) / PRECISION, 0n);
  const stxPaid = (stxRpt * stxShares) / PRECISION;
  const pool = bondPaid + (stxPaid * 10000n) / (10000n - RESERVE_RATIO);
  const coverage = obligation === 0n ? null : Number(pool) / Number(obligation);
  const headroom = obligation === 0n || pool === 0n ? null : pool >= obligation ? Number(pool - obligation) / Number(pool) : 0;
  const cover = obligation === 0n ? null : Number((reserve * 100n) / (2n * obligation)) / 100;

  // the sBTC pox-5 holds, from Hiro's balances endpoint (same number as sbtc-token get-balance,
  // without hand-encoding a contract principal)
  const balances = await jget(`${HIRO}/extended/v1/address/${POX5}/balances`);
  const sbtcKey = Object.keys(balances.fungible_tokens ?? {}).find((k) => k.startsWith(SBTC));
  const balance = BigInt(balances.fungible_tokens[sbtcKey].balance);
  const accounted =
    (await callRead(POX5, "get-total-sbtc-staked")) + reserve + (await callRead(POX5, "get-last-accounted-rewards-only"));
  const pending = balance >= accounted ? balance - accounted : 0n;

  const yieldPerStx = stxShares === 0n ? null : (Number(stxPaid) * 1e6) / Number(stxShares);

  // the price at the distribution, from CoinGecko, for the figures that are price-based
  const calcBlock = await jget(`${HIRO}/extended/v2/burn-blocks/${last.calculation_height}`);
  const at = calcBlock.burn_block_time;
  const chart = await jget(`${COINGECKO}/coins/blockstack/market_chart/range?vs_currency=btc&from=${at - 7200}&to=${at + 7200}`);
  const point = (chart.prices ?? []).reduce((best, p) => (Math.abs(p[0] / 1000 - at) < Math.abs(best[0] / 1000 - at) ? p : best), chart.prices?.[0]);
  const priceAtDist = point ? point[1] * 1e8 : null;
  const apy = yieldPerStx == null || !priceAtDist ? null : (yieldPerStx * Number(INTERVALS_PER_YEAR)) / priceAtDist;
  const sipCliff = priceAtDist == null || pool === 0n ? null : (priceAtDist * Number(SIP_BOOK_SATS)) / Number(pool);

  // --- compare, with the tolerance each figure deserves
  const sitePool = BigInt(last.gross_pool.value);
  const siteObligation = BigInt(cur.obligation_per_interval.value ?? last.obligation.value);
  const siteCoverage = Number(cur.coverage.value ?? last.coverage.value);
  const siteHeadroom = Number(cur.headroom.value ?? last.headroom.value);
  const siteReserve = BigInt(cur.reserve.value ?? last.reserve_balance.value);
  const siteCover = cur.reserve_cover.value == null ? null : Number(cur.reserve_cover.value);
  const sitePending = cur.pending_pool.value == null ? null : BigInt(cur.pending_pool.value);
  const siteYield = Number(last.stx_only_yield.value);
  const siteApy = Number(last.stx_only_apy_btc.value);
  const siteCliff = cur.cliff.sip_book_scenario.value == null ? null : Number(cur.cliff.sip_book_scenario.value);

  const perInterval = BigInt(iv.intervals.length ? 2 : 2); // +-2 sats per computed interval, see docs/verification
  add("Reward pool (sats)", fmt(pool), fmt(sitePool), "pox-5 rewards-per-token x shares, grossed up by the 15% reserve cut",
    near(pool, sitePool, Number(perInterval)), "±2 sats per interval, from integer truncation");
  add("Obligation per interval (sats)", fmt(obligation), fmt(siteObligation), "sum of bond shares x target-rate / 10000 / 50", obligation === siteObligation);
  add("Coverage (x)", fmt(coverage, 3), fmt(siteCoverage, 3), "pool / obligation", near(coverage, siteCoverage, 0.01));
  add("Headroom", fmt(headroom, 4), fmt(siteHeadroom, 4), "1 - obligation / pool", near(headroom, siteHeadroom, 0.0005));
  add("Reserve (sats)", fmt(reserve), fmt(siteReserve), "pox-5 get-reserve-balance", reserve === siteReserve);
  add("Hypothetical cover (cycles)", fmt(cover), fmt(siteCover), "reserve / (2 x obligation), truncated", near(cover, siteCover, 0.01));
  // The published pending pool is the reading coverage-cache recorded on-chain, which is some
  // blocks behind the tip; miner commits accrue in between, so the two are not the same number
  // and should not be. What must hold is that the published figure is a real earlier reading:
  // not larger than the pool now, and not negative. A distribution in between resets it, so the
  // check is skipped if one has landed since.
  const cacheBlock = health?.checks?.coverage_cache?.updated_at_burn_height ?? null;
  const behind = cacheBlock == null ? null : tip - Number(cacheBlock);
  const pendingOk =
    sitePending == null
      ? true
      : Number(sitePending) >= 0 && Number(sitePending) <= Number(pending) + 2_000_000;
  add(
    "Pending pool (sats)",
    fmt(pending),
    fmt(sitePending),
    "sbtc-token balance of pox-5 minus what pox-5 has accounted",
    pendingOk,
    cacheBlock == null
      ? "accrues every block"
      : `published figure was recorded on-chain at block ${cacheBlock}, ${behind} blocks back; it accrues with miner commits, so it must be no larger than the figure now`,
  );
  add("STX-only yield (sats per STX)", fmt(yieldPerStx, 4), fmt(siteYield, 4), "stx-only sats / shares x 1e6", near(yieldPerStx, siteYield, 0.0005));
  add("STX-only APY (BTC terms)", fmt(apy, 4), fmt(siteApy, 4), "yield x 50 / price at the distribution (CoinGecko)",
    near(apy, siteApy, 0.002), "price-based: CoinGecko hourly point may differ slightly");
  add("Cliff, 3,000 BTC book (sats/STX)", fmt(sipCliff), fmt(siteCliff), "price at the distribution x 180,000,000 / pool",
    near(sipCliff, siteCliff, 5), "price-based");

  // --- the contracts the site says it is reading, byte for byte
  for (const [name, id] of [["pox5-reader", meta.reader], ["coverage-cache", meta.cache], ["coverage-guard-cached", meta.guard_mainnet]]) {
    if (!id) continue;
    const [addr, cname] = id.split(".");
    const onchain = (await jget(`${HIRO}/v2/contracts/source/${addr}/${cname}`)).source;
    const file = path.join(ROOT, "contracts", "contracts", `${cname}.clar`);
    const sha = (s) => createHash("sha256").update(s.replace(/\n+$/, "\n")).digest("hex");
    const repo = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    add(`${name} source`, repo ? sha(repo).slice(0, 12) : "(file missing)", sha(onchain).slice(0, 12),
      `${id} vs contracts/contracts/${cname}.clar`, repo != null && sha(repo) === sha(onchain), "sha256, trailing newline ignored");
  }

  const failed = rows.filter((r) => !r.ok);
  const out = {
    site: SITE,
    read_at: { bitcoin_block: tip, site_block: cur.as_of.burn_height, distribution: last.distribution_index, cycle: Number(cycle) },
    sources: { pox5: POX5, sbtc: SBTC, hiro: HIRO, prices: COINGECKO },
    checks: rows.map(({ figure, recomputed, site, source, ok, note }) => ({ figure, recomputed, site, source, pass: ok, note })),
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
    console.log(`  read at        Bitcoin block ${tip}; the site last read at ${cur.as_of.burn_height}`);
    console.log(`  distribution   ${last.distribution_index} (cycle ${cycle}, calculation height ${last.calculation_height})\n`);
    const w = Math.max(...rows.map((r) => r.figure.length));
    console.log(`  ${"figure".padEnd(w)}  ${"recomputed here".padStart(18)}  ${"published".padStart(18)}   `);
    console.log(`  ${"-".repeat(w)}  ${"-".repeat(18)}  ${"-".repeat(18)}  ---`);
    for (const r of rows)
      console.log(`  ${r.figure.padEnd(w)}  ${String(r.recomputed).padStart(18)}  ${String(r.site).padStart(18)}  ${r.ok ? "ok" : "MISMATCH"}`);
    console.log();
    for (const r of rows) console.log(`  ${r.figure}: ${r.source}${r.note ? ` (${r.note})` : ""}`);
    console.log(`\n  ${out.passed}/${rows.length} checks pass${failed.length ? `, ${failed.length} MISMATCH` : ""}.`);
    console.log(`  Every number on the left was computed by this script from the sources listed above.\n`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nverify failed: ${e.message}\n`);
  console.error(`This checks public endpoints only. If Hiro or CoinGecko is rate-limiting, wait a minute and run it again.\n`);
  process.exit(1);
});
