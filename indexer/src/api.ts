// Public read-only JSON API. Every metric is a field envelope:
//   { value, unit, provenance: "onchain" | "mirrored" | "hypothetical", source, note? }
import Fastify from "fastify";
import cors from "@fastify/cors";
import { Cl } from "@stacks/transactions";
import { config } from "./config.js";
import { keeperStatus } from "./keeper.js";
import { lastRouteCheck } from "./routes-check.js";
import { pool } from "./db.js";
import { callRead } from "./hiro.js";
import {
  waterfall,
  stressedPool,
  hypotheticalBook,
  cliffSatsPerStx,
  friedgerCliff,
  targetPerInterval,
  type Bond,
} from "./model.js";

type Provenance = "onchain" | "mirrored" | "hypothetical";
const f = (value: unknown, unit: string, provenance: Provenance, source: string, note?: string) => ({
  value: typeof value === "bigint" ? value.toString() : value ?? null,
  unit,
  provenance,
  source,
  ...(note ? { note } : {}),
});

// health thresholds: the poll runs every 10 minutes, and the keeper refreshes the cache at least
// every 1,100 burn blocks (about a week), so these leave room for one missed run.
const POLL_STALE_S = Number(process.env.HEALTH_POLL_STALE_S ?? 45 * 60);
const CACHE_STALE_BLOCKS = Number(process.env.HEALTH_CACHE_STALE_BLOCKS ?? 1200);
const READER_MISSING = "pox5-reader is not deployed on mainnet yet";
// Hiro's /v2/contracts/call-read allows 500,000 of read length; each contract-call? into pox-5 loads
// that contract, about 136k, so a reader function that calls pox-5 four or more times is refused
// through the public API, and the figure falls back to its mirrored source.
const CACHE_NOTE =
  "pox5-reader computed this from pox-5 state in a mainnet transaction; coverage-cache stores its answer so the public API can read it";
const READER_CAPPED =
  "pox5-reader is deployed on mainnet, but this read-only cannot be called through the public Hiro API: it calls into pox-5 four or more times, each about 136k of read length, over the 500,000 cap. It is checked against live mainnet state by contracts/scripts/verify-at-tip.mjs.";
const PRICE_ASSUMPTION = "assumes miner BTC bids scale linearly with the STX price";
// pox-5 bonding period geometry, as the SIP draft specifies and the deployed contract follows:
// a 25,200-block term with a new period every 4,200 blocks means six run concurrently, which is
// the cap pox-5 enforces on its payout list.
const DISTRIBUTION_INTERVAL_BLOCKS = 1050;
const BONDING_PERIOD_BLOCKS = 25200;
const BOND_PERIOD_SPACING_BLOCKS = 4200;
const MAX_CONCURRENT_BONDS = 6;
const RESERVE_NOTE =
  "a back-stop for bonds by design; accrual-only in this iteration, and using the reserve goes through a SIP process";
const SIP_BOOK_NOTE =
  "SIP launch book: 3,000 BTC at a 3% target (SIP draft, stacks.link/sip-pox5; as used in forum.stacks.org/t/18862 post #14)";

const int = (v: number) => v.toLocaleString("en-US");
const bps = (v: string | bigint | null | undefined) => (v === null || v === undefined ? null : Number(v) / 10000);
const reader = (fn: string) => `${config.readerContract ?? "pox5-reader"}::${fn}`;
const txSource = (txid: string) => `mainnet pox-5 calculate-rewards event, tx ${txid}`;

// small cache for call-reads made on request
const cache = new Map<string, { at: number; v: any }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v;
  const v = await fn();
  cache.set(key, { at: Date.now(), v });
  return v;
}

async function latestLive() {
  const r = await pool.query("SELECT * FROM live_snapshots ORDER BY id DESC LIMIT 1");
  return r.rows[0] ?? null;
}

async function latestPrice() {
  const r = await pool.query("SELECT * FROM prices ORDER BY id DESC LIMIT 1");
  return r.rows[0] ?? null;
}

function intervalView(row: any) {
  const gross = BigInt(row.gross_pool_sats);
  const target = BigInt(row.bond_target_sats);
  const paid = BigInt(row.bond_paid_sats);
  const shares = BigInt(row.stx_shares_ustx);
  const src = txSource(row.txid);
  const price = row.price_sats_per_stx === null ? null : Number(row.price_sats_per_stx);
  const priceSrc = `${row.price_source} @ ${row.price_timestamp}`;
  const yieldSatsPerStx = shares === 0n ? null : (Number(row.stx_only_sats) * 1e6) / Number(shares);
  return {
    distribution_index: row.distribution_index,
    cycle: row.stx_cycle,
    calculation_height: row.calculation_height,
    txid: row.txid,
    gross_pool: f(gross, "sats", "mirrored", `${src}: gross-accrued-rewards`),
    obligation: f(target, "sats", "mirrored", `${src}: sum of bond-distribution target-yield`),
    bond_paid: f(paid, "sats", "mirrored", `${src}: total-bond-rewards`),
    shortfall: f(target > paid ? target - paid : 0n, "sats", "mirrored", "obligation - bond_paid"),
    stx_only: f(row.stx_only_sats, "sats", "mirrored", `${src}: total-stx-staker-rewards`),
    reserve_deposit: f(row.reserve_deposit_sats, "sats", "mirrored", `${src}: reserve-deposit`),
    reserve_balance: f(row.reserve_balance_sats, "sats", "mirrored", `${src}: reserve-balance`),
    coverage: f(target === 0n ? null : Number(gross) / Number(target), "x", "mirrored", "gross_pool / obligation", target === 0n ? "n/a: no bonds" : undefined),
    headroom: f(target === 0n ? null : Math.max(0, 1 - Number(target) / Number(gross)), "fraction", "mirrored", "1 - obligation / gross_pool", target === 0n ? "n/a: no bonds" : undefined),
    stx_only_yield: f(yieldSatsPerStx, "sats per STX per interval", "mirrored", `${src}: total-stx-staker-rewards / cycle-staked-ustx * 1e6`),
    stx_only_apy_btc: f(yieldSatsPerStx === null || price === null ? null : (yieldSatsPerStx * 50) / price, "fraction per year", "mirrored", `stx_only_yield * 50 / price (${priceSrc})`),
    price: f(price, "sats per STX", "mirrored", priceSrc),
    cliff_price: f(price === null ? null : cliffSatsPerStx(price, gross, target), "sats per STX", "mirrored", "price * obligation / gross_pool", PRICE_ASSUMPTION),
    crosscheck: {
      ok: row.crosscheck_ok,
      note: row.crosscheck_note,
      method: "recomputed from pox-5 state before/after the calculate-rewards block (call-read ?tip=)",
      tip_before: row.tip_before,
      tip_after: row.tip_after,
    },
    risk_feed: {
      contract: config.feedContract,
      network: "testnet",
      txid: row.published_txid,
      status: row.published_status,
      note: "testnet feed values mirror mainnet data",
    },
  };
}

function readerBonds(order: any[]): Bond[] {
  return order.map((b) => ({
    bondIndex: Number(b["bond-index"]),
    stxValueRatio: BigInt(b["stx-value-ratio"]),
    targetRate: BigInt(b["target-rate"]),
    shares: BigInt(b.shares),
  }));
}

export async function buildApi() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true, methods: ["GET"] });

  app.get("/", async () => ({
    name: "metacenter",
    description: "Risk metrics for Stacks Bitcoin Staking (PoX-5)",
    provenance: {
      onchain: `computed by ${config.readerContract ?? "pox5-reader (mainnet, pending deploy)"} from ${config.pox5} state`,
      mirrored: `indexer/publisher-posted figures (mainnet events, Hiro API, prices); per-interval values are also posted to ${config.feedContract} (testnet)`,
      hypothetical: "stress tests and what-if scenarios",
    },
    endpoints: ["/metrics/current", "/metrics/cycles/:n", "/intervals", "/bonds/order?cycle=", "/stress?commit_drop=&price_drop=&book_btc=&bonds="],
  }));

  app.get("/meta", async () => {
    const [feedAddress] = config.feedContract.split(".");
    return {
      pox5: config.pox5,
      reader: config.readerContract ?? null,
      cache: config.cacheContract ?? null,
      keeper: await keeperStatus(),
      reader_network: "mainnet",
      feed: config.feedContract,
      trait: { mainnet: config.readerContract ? `${config.readerContract.split(".")[0]}.risk-feed-trait` : null, testnet: `${feedAddress}.risk-feed-trait` },
      guard: `${feedAddress}.coverage-guard`,
      guard_mainnet: config.readerContract ? `${config.readerContract.split(".")[0]}.coverage-guard-cached` : null,
      feed_network: "testnet",
      repo: "https://github.com/Jagadeeshftw/metacenter",
    };
  });

  // Health for uptime monitors and for a reader who wants to know how fresh the numbers are.
  // 503 only when the service cannot serve data at all (the database is unreachable); anything
  // else answers 200 with status "ok" or "degraded" and says which check is unhappy, so a
  // keyword monitor on "\"status\":\"ok\"" catches degradation too.
  app.get("/health", async (_req, reply) => {
    const started = Date.now();
    const checks: Record<string, unknown> = {};
    const problems: string[] = [];
    const age = (t: string | Date | null | undefined) =>
      t == null ? null : Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 1000));

    // database
    let dbOk = false;
    try {
      const t = Date.now();
      await pool.query("SELECT 1");
      dbOk = true;
      checks.database = { ok: true, latency_ms: Date.now() - t };
    } catch (e: any) {
      checks.database = { ok: false, error: String(e?.message ?? e).slice(0, 200) };
      problems.push("database unreachable");
    }

    if (!dbOk) {
      reply.code(503);
      return { status: "down", checks, problems, checked_at: new Date().toISOString(), took_ms: Date.now() - started };
    }

    // indexer poll
    const live = await latestLive();
    const pollAge = age(live?.taken_at);
    checks.indexer_poll = {
      ok: pollAge != null && pollAge <= POLL_STALE_S,
      last_poll: live?.taken_at ?? null,
      age_seconds: pollAge,
      stale_after_seconds: POLL_STALE_S,
      burn_height: live?.burn_height ?? null,
    };
    if (pollAge == null) problems.push("no poll recorded yet");
    else if (pollAge > POLL_STALE_S) problems.push(`last indexer poll was ${pollAge}s ago`);

    // distributions indexed
    const last = (await pool.query("SELECT distribution_index, calculation_height, crosscheck_ok FROM intervals ORDER BY distribution_index DESC LIMIT 1")).rows[0];
    const lastCalc = Number(live?.pox5?.["get-last-reward-compute-height"] ?? 0);
    const behind = last && lastCalc > Number(last.calculation_height);
    checks.distributions = {
      ok: !!last && !behind,
      latest_indexed: last?.distribution_index ?? null,
      calculation_height: last ? Number(last.calculation_height) : null,
      chain_last_compute_height: lastCalc || null,
      crosscheck_ok: last?.crosscheck_ok ?? null,
    };
    if (!last) problems.push("no distribution indexed");
    else if (behind) problems.push(`pox-5 computed a distribution at ${lastCalc} that is not indexed yet`);

    // coverage-cache freshness, in burn blocks behind the tip
    const cache = live?.reader?.cache ?? null;
    const tip = Number(live?.burn_height ?? 0);
    const cacheAge = cache?.updated_at && tip ? tip - Number(cache.updated_at) : null;
    checks.coverage_cache = {
      ok: cacheAge == null ? config.cacheContract == null : cacheAge <= CACHE_STALE_BLOCKS,
      contract: config.cacheContract ?? null,
      updated_at_burn_height: cache?.updated_at ?? null,
      blocks_behind_tip: cacheAge,
      stale_after_blocks: CACHE_STALE_BLOCKS,
    };
    if (cacheAge != null && cacheAge > CACHE_STALE_BLOCKS) problems.push(`coverage-cache is ${cacheAge} burn blocks behind`);

    // keeper
    const keeper = await keeperStatus();
    const keeperAge = age(keeper?.checked_at ?? null);
    checks.keeper = keeper
      ? {
          ok: !keeper.low_balance && (keeperAge == null || keeperAge <= POLL_STALE_S),
          address: keeper.address,
          balance_ustx: keeper.balance_ustx,
          low_balance: keeper.low_balance,
          last_action: keeper.last ?? null,
          pending: keeper.pending ?? null,
          checked_age_seconds: keeperAge,
        }
      : { ok: true, enabled: false };
    if (keeper?.low_balance) problems.push("keeper balance below the alert threshold");

    // every public route, as the last poll found them
    const routes = await lastRouteCheck();
    const routeAge = age(routes?.checked_at ?? null);
    const failingRoutes = (routes?.results ?? []).filter((r) => !r.ok);
    checks.public_routes = routes
      ? {
          ok: failingRoutes.length === 0 && (routeAge == null || routeAge <= POLL_STALE_S),
          checked: routes.results.length,
          failing: failingRoutes.map((r) => ({ route: r.route, status: r.status, problem: r.problem })),
          checked_age_seconds: routeAge,
        }
      : { ok: true, checked: 0, note: "no route check recorded yet" };
    for (const r of failingRoutes) problems.push(`${r.route}: ${r.problem}`);

    checks.reader = { ok: config.readerContract != null, contract: config.readerContract ?? null };
    if (!config.readerContract) problems.push("pox5-reader not configured");

    return {
      status: problems.length === 0 ? "ok" : "degraded",
      problems,
      checks,
      checked_at: new Date().toISOString(),
      took_ms: Date.now() - started,
    };
  });

  app.get("/metrics/current", async () => {
    const live = await latestLive();
    const last = (await pool.query("SELECT * FROM intervals ORDER BY distribution_index DESC LIMIT 1")).rows[0];
    const price = await latestPrice();
    const r = live?.reader ?? null;
    const cycle = live?.current_cycle ?? null;
    const summary = r?.["get-coverage-summary"]?.ok ?? null;
    const cover = r?.[`get-reserve-cover-cycles(u${cycle})`] ?? null;
    const order = r?.[`get-bond-payout-order(u${cycle})`] ?? null;
    const pending = r?.["get-pending-pool"] ?? null;
    const iv = last ? intervalView(last) : null;
    const reserveDeposit = last ? BigInt(last.reserve_deposit_sats) : null;

    const readerErrors = (r?.errors ?? {}) as Record<string, string>;
    const viaCache = (r?.via_cache ?? {}) as Record<string, number>;
    const onchain = (value: unknown, unit: string, fn: string, note?: string) => {
      if (!r) return f(null, unit, "onchain", reader(fn), READER_MISSING);
      const base = fn.split("(")[0].split(":")[0].trim(); // "get-coverage-summary: headroom-bps" -> the function
      // recorded by pox5-reader in a mainnet transaction, read back from coverage-cache
      if (viaCache[base] !== undefined) {
        // the reader's own function, named in full; the cache contract id is in /meta
        const via = `${reader(fn)} via coverage-cache::refresh at burn height ${viaCache[base]}`;
        return f(value, unit, "onchain", via, note ? `${note}. ${CACHE_NOTE}` : CACHE_NOTE);
      }
      if (value == null && readerErrors[base]) return f(null, unit, "onchain", reader(fn), READER_CAPPED);
      return f(value, unit, "onchain", reader(fn), note);
    };

    const pNow = price ? Number(price.sats_per_stx) : null;
    const pDist = last?.price_sats_per_stx == null ? null : Number(last.price_sats_per_stx);
    const gross = last ? BigInt(last.gross_pool_sats) : null;
    const sipObligation = targetPerInterval(300000000000n, 300n); // 3,000 BTC at 3%

    return {
      as_of: { taken_at: live?.taken_at, burn_height: live?.burn_height, stacks_height: live?.stacks_height },
      cycle: onchain(cycle, "reward cycle", "get-current-cycle"),
      coverage: onchain(bps(summary?.["coverage-bps"]), "x", `get-coverage-summary (cycle ${summary?.period ?? "?"}, realised so far)`, summary && summary["coverage-bps"] === null ? "n/a: no bonds" : undefined),
      headroom: onchain(bps(summary?.["headroom-bps"]), "fraction", "get-coverage-summary: headroom-bps", "pool can fall this much before bond yield is impaired (1 - 1/coverage)"),
      obligation_per_interval: onchain(r?.[`get-obligation-per-interval(u${cycle})`], "sats", `get-obligation-per-interval(u${cycle})`),
      pending_pool: onchain(pending?.["pending-sats"], "sats", "get-pending-pool", pending && !pending.balanced ? "sBTC balance below accounted amounts" : "sBTC received since the last distribution, not yet split"),
      reserve: onchain(r?.["get-reserve"], "sats", "get-reserve"),
      reserve_cover: onchain(cover?.["cover-cycles-x100"] == null ? null : Number(cover["cover-cycles-x100"]) / 100, "cycles", `get-reserve-cover-cycles(u${cycle})`, `Hypothetical cover — ${RESERVE_NOTE}`),
      reserve_state: f(
        reserveDeposit === null ? null : reserveDeposit > 0n ? "not drawing" : "flat",
        "state",
        "mirrored",
        last ? `${txSource(last.txid)}: reserve-deposit` : "no distribution yet",
        "the reserve is a back-stop for bonds by design; in this iteration pox-5 has no call path from it to bonds (transfer-from-reserve is private and uncalled), so using it goes through a SIP process. In a shortfall the deposit is zero and the reserve stays flat",
      ),
      payout_order: onchain(order?.map((b: any) => ({ bond_index: Number(b["bond-index"]), stx_value_ratio: b["stx-value-ratio"], target_rate_bps: b["target-rate"], shares_sats: b.shares, target_per_interval_sats: b["target-per-interval"] })), "bonds", `get-bond-payout-order(u${cycle})`, "descending stx-value-ratio, ties to the lower bond index"),
      latest_interval: iv,
      price: f(pNow, "sats per STX", "mirrored", price ? `${price.source} @ ${price.price_timestamp}` : "none"),
      // Cliffs use the price at the distribution whose pool they divide by (as /intervals, /stress
      // and risk-feed do). Under the linear-bid assumption today's price cancels out, so pairing it
      // with an older pool would only add drift.
      cliff: {
        headline: onchain(bps(summary?.["headroom-bps"]), "fraction", "get-coverage-summary: headroom-bps", "pool can fall this much before bond yield is impaired"),
        price: f(pDist && gross && last ? cliffSatsPerStx(pDist, gross, BigInt(last.bond_target_sats)) : null, "sats per STX", "mirrored", `price at distribution ${last?.distribution_index} * its obligation / its gross pool`, PRICE_ASSUMPTION),
        sip_book_scenario: f(pDist && gross ? cliffSatsPerStx(pDist, gross, sipObligation) : null, "sats per STX", "hypothetical", `price at distribution ${last?.distribution_index} * 180,000,000 sats (3,000 BTC * 3% / 50) / its gross pool`, `${SIP_BOOK_NOTE}; ${PRICE_ASSUMPTION}`),
        inputs: last
          ? {
              distribution_index: last.distribution_index,
              price: f(pDist, "sats per STX", "mirrored", `${last.price_source} @ ${last.price_timestamp} (price at distribution ${last.distribution_index})`),
              gross_pool: f(gross, "sats", "mirrored", `${txSource(last.txid)}: gross-accrued-rewards`),
              obligation: f(BigInt(last.bond_target_sats), "sats", "mirrored", `${txSource(last.txid)}: sum of bond-distribution target-yield`),
              sip_book_obligation: f(sipObligation, "sats", "hypothetical", "3,000 BTC * 3% / 50"),
            }
          : null,
        friedger_sip_inputs: f(friedgerCliff(), "sats per STX", "hypothetical", "3,000 BTC * 3% / (1,000 STX/block * 52,560 blocks/year)", "friedger's figure under SIP launch inputs (forum.stacks.org/t/18862, post #14)"),
      },
    };
  });

  app.get<{ Params: { n: string } }>("/metrics/cycles/:n", async (req, reply) => {
    const n = Number(req.params.n);
    if (!Number.isInteger(n) || n < 0) return reply.code(400).send({ error: "cycle must be a non-negative integer" });
    const hiro = (await pool.query("SELECT raw, fetched_at FROM cycles WHERE cycle = $1", [n])).rows[0];
    const intervals = (await pool.query("SELECT * FROM intervals WHERE stx_cycle = $1 ORDER BY distribution_index", [n])).rows;
    let cov: any = null;
    if (config.readerContract) {
      const live = await latestLive();
      const ttl = live && n < live.current_cycle - 1 ? 24 * 3600_000 : 10 * 60_000;
      cov = await cached(`cov:${n}`, ttl, () =>
        callRead(config.readerContract!, "get-coverage-for-cycle", [Cl.uint(n)]).catch(() => null),
      );
    }
    const src = reader(`get-coverage-for-cycle(u${n})`);
    // get-coverage-for-cycle reads pox-5 several times, so a public node refuses it for any cycle
    // (see /docs/verification/read-limits). Rather than answer 200 with a column of nulls, fall
    // back to the cycle's own calculate-rewards events, which is where these figures come from in
    // the first place: same numbers, honestly labelled mirrored.
    const sum = (key: string): bigint => (intervals as any[]).reduce((t: bigint, r: any) => t + BigInt(r[key]), 0n);
    const mirrorSrc = intervals.length
      ? `calculate-rewards events for distributions ${intervals[0].distribution_index}–${intervals.at(-1).distribution_index}`
      : "no distribution booked to this cycle yet";
    const cyclePool = intervals.length ? sum("gross_pool_sats") : null;
    const cycleObligation = intervals.length ? sum("bond_target_sats") : null;
    const oc = (v: unknown, unit: string, note?: string, fallback?: () => unknown) => {
      if (cov) return f(v, unit, "onchain", src, note);
      const mirrored = fallback?.();
      if (mirrored !== undefined && mirrored !== null)
        return f(mirrored, unit, "mirrored", mirrorSrc, `${READER_CAPPED} These are the same figures from the cycle's events.`);
      return f(null, unit, "onchain", src, config.readerContract ? READER_CAPPED : READER_MISSING);
    };
    return {
      cycle: n,
      intervals_computed: oc(cov?.["intervals-computed"], "intervals", undefined, () => (intervals.length ? intervals.length : null)),
      pool: oc(cov?.["pool-sats"], "sats", "rebuilt from rewards-per-token x shares; +-2 sats per interval", () => cyclePool),
      obligation: oc(cov?.["obligation-sats"], "sats", undefined, () => cycleObligation),
      bond_paid: oc(cov?.["bond-paid-sats"], "sats", undefined, () => (intervals.length ? sum("bond_paid_sats") : null)),
      stx_paid: oc(cov?.["stx-paid-sats"], "sats", undefined, () => (intervals.length ? sum("stx_only_sats") : null)),
      shortfall: oc(cov?.["shortfall-sats"], "sats", undefined, () =>
        cycleObligation === null || cyclePool === null
          ? null
          : cycleObligation > sum("bond_paid_sats")
            ? cycleObligation - sum("bond_paid_sats")
            : 0n,
      ),
      coverage: oc(bps(cov?.["coverage-bps"]), "x", cov && cov["coverage-bps"] === null ? "n/a: no bonds" : undefined, () =>
        cyclePool === null || cycleObligation === null || cycleObligation === 0n ? null : Number(cyclePool) / Number(cycleObligation),
      ),
      headroom: oc(bps(cov?.["headroom-bps"]), "fraction", undefined, () =>
        cyclePool === null || cycleObligation === null || cycleObligation === 0n || cyclePool === 0n
          ? null
          : Math.max(0, 1 - Number(cycleObligation) / Number(cyclePool)),
      ),
      hiro: hiro
        ? f(hiro.raw, "object", "mirrored", `https://api.hiro.so/extended/v3/staking/cycles/${n} @ ${hiro.fetched_at.toISOString?.() ?? hiro.fetched_at}`, "rewards.btc.waterfall.bonds is the amount paid, not the obligation")
        : null,
      intervals: intervals.map(intervalView),
    };
  });

  app.get("/intervals", async () => {
    const rows = (await pool.query("SELECT * FROM intervals ORDER BY distribution_index")).rows;
    return { count: rows.length, intervals: rows.map(intervalView) };
  });

  app.get<{ Querystring: { cycle?: string } }>("/bonds/order", async (req, reply) => {
    const live = await latestLive();
    const cycle = req.query.cycle !== undefined ? Number(req.query.cycle) : live?.current_cycle;
    if (!Number.isInteger(cycle)) return reply.code(400).send({ error: "cycle must be an integer" });
    const src = reader(`get-bond-payout-order(u${cycle})`);
    if (!config.readerContract) return { cycle, order: f(null, "bonds", "onchain", src, READER_MISSING) };

    // get-bond-payout-order reads pox-5 several times, so a public node refuses it (see
    // /docs/verification/read-limits). For the current cycle the poll already holds the answer,
    // via coverage-cache when the direct call is refused; older cycles are attempted directly and
    // report why if the endpoint turns them down, rather than failing the request.
    let order: any = null;
    let note = "descending stx-value-ratio, ties to the lower bond index; flat per-token within a bond";
    let via = src;
    if (live && cycle === live.current_cycle) {
      order = live.reader?.[`get-bond-payout-order(u${cycle})`] ?? null;
      const cacheAt = live.reader?.via_cache?.["get-bond-payout-order"];
      if (cacheAt !== undefined) via = `${src} via coverage-cache::refresh at burn height ${cacheAt}`;
    }
    if (order === null) {
      try {
        order = await cached(`order:${cycle}`, 10 * 60_000, () => callRead(config.readerContract!, "get-bond-payout-order", [Cl.uint(cycle!)]));
      } catch (e: any) {
        return {
          cycle,
          order: f(null, "bonds", "onchain", src, /CostBalanceExceeded/.test(String(e?.message)) ? READER_CAPPED : String(e?.message).slice(0, 200)),
        };
      }
    }

    // A bond is not open-ended: pox-5 gives each bonding period a fixed term, which is why only
    // about six run at once. Read each one's start and unlock height so the page can show how
    // much of the term is left instead of leaving the reader to assume it never ends.
    const tip = Number(live?.burn_height ?? 0);
    const terms = new Map<number, { start: number; unlock: number }>();
    for (const b of order) {
      const idx = Number(b["bond-index"]);
      terms.set(
        idx,
        await cached(`term:${idx}`, 24 * 3600_000, async () => ({
          start: Number(await callRead(config.pox5, "bond-period-to-burn-height", [Cl.uint(idx)])),
          unlock: Number(await callRead(config.pox5, "get-bond-l1-unlock-height", [Cl.uint(idx)])),
        })),
      );
    }

    return {
      cycle,
      bonding_period: {
        length_blocks: BONDING_PERIOD_BLOCKS,
        new_period_every_blocks: BOND_PERIOD_SPACING_BLOCKS,
        concurrent_max: MAX_CONCURRENT_BONDS,
        note: `a bonding period runs ${int(BONDING_PERIOD_BLOCKS)} Bitcoin blocks (about 6 months) and a new one opens every ${int(
          BOND_PERIOD_SPACING_BLOCKS,
        )} blocks (about a month), so at most ${MAX_CONCURRENT_BONDS} run at once`,
      },
      order: f(
        order.map((b: any, i: number) => {
          const idx = Number(b["bond-index"]);
          const t = terms.get(idx);
          const remaining = t ? Math.max(0, t.unlock - tip) : null;
          return {
            position: i,
            bond_index: idx,
            stx_value_ratio: b["stx-value-ratio"],
            target_rate_bps: b["target-rate"],
            shares_sats: b.shares,
            target_per_interval_sats: b["target-per-interval"],
            term: t
              ? {
                  period_start_burn_height: t.start,
                  l1_unlock_burn_height: t.unlock,
                  term_blocks: t.unlock - t.start,
                  elapsed_blocks: Math.max(0, Math.min(t.unlock, tip) - t.start),
                  remaining_blocks: remaining,
                  remaining_intervals: remaining === null ? null : Math.floor(remaining / DISTRIBUTION_INTERVAL_BLOCKS),
                  read_at_burn_height: tip || null,
                }
              : null,
          };
        }),
        "bonds",
        "onchain",
        via,
        note,
      ),
    };
  });

  app.get<{ Querystring: Record<string, string | undefined> }>("/stress", async (req, reply) => {
    const q = req.query;
    const num = (k: string, d: number, lo: number, hi: number) => {
      const v = q[k] === undefined ? d : Number(q[k]);
      if (!Number.isFinite(v) || v < lo || v > hi) {
        const why =
          k === "bonds"
            ? `. A bonding period runs ${int(BONDING_PERIOD_BLOCKS)} Bitcoin blocks (about 6 months) and a new one opens every ${int(
                BOND_PERIOD_SPACING_BLOCKS,
              )} blocks (about a month), so ${MAX_CONCURRENT_BONDS} run concurrently at steady state; pox-5 caps its payout list at ${MAX_CONCURRENT_BONDS} for the same reason. book_btc is the total bonded BTC live at one moment, which this many bonds split between them.`
            : "";
        throw Object.assign(new Error(`${k} must be in [${lo}, ${hi}]${why}`), { statusCode: 400 });
      }
      return v;
    };
    let commitDrop: number, priceDrop: number, bookBtc: number | null, bondCount: number;
    try {
      commitDrop = num("commit_drop", 0, 0, 1);
      priceDrop = num("price_drop", 0, 0, 1);
      bookBtc = q.book_btc === undefined ? null : num("book_btc", 0, 0, 21_000_000);
      bondCount = num("bonds", 6, 1, MAX_CONCURRENT_BONDS);
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
    const last = (await pool.query("SELECT * FROM intervals ORDER BY distribution_index DESC LIMIT 1")).rows[0];
    const live = await latestLive();
    if (!last || !live) return reply.code(503).send({ error: "no data yet" });

    const base = BigInt(last.gross_pool_sats);
    const stxShares = BigInt(last.stx_shares_ustx);
    const order = live.reader?.[`get-bond-payout-order(u${live.current_cycle})`];
    let current: Bond[];
    let bookSource: string;
    if (order) {
      current = readerBonds(order);
      bookSource = reader(`get-bond-payout-order(u${live.current_cycle})`);
    } else {
      const bonds = (await pool.query("SELECT * FROM interval_bonds WHERE distribution_index = $1", [last.distribution_index])).rows;
      current = [];
      for (const b of bonds) {
        const pb = await cached(`bond:${b.bond_index}`, 3600_000, () => callRead(config.pox5, "get-protocol-bond", [Cl.uint(b.bond_index)]));
        current.push({ bondIndex: b.bond_index, stxValueRatio: BigInt(pb["stx-value-ratio"]), targetRate: BigInt(pb["target-rate"]), shares: BigInt(b.bond_staked_sats) });
      }
      bookSource = `${txSource(last.txid)}: bond-distribution bond-staked-sats; ${config.pox5}::get-protocol-bond`;
    }
    const topRatio = current[0]?.stxValueRatio ?? 310237n;
    const book = bookBtc === null ? current : hypotheticalBook(bookBtc, bondCount, 300n, topRatio);
    const pool_ = stressedPool(base, commitDrop, priceDrop);
    const w = waterfall(pool_, book, stxShares);
    // Same base as the realised figures: the latest distribution and the price at its block,
    // so zero stress reproduces the realised STX-only yield exactly.
    const p0 = last.price_sats_per_stx === null ? null : Number(last.price_sats_per_stx);
    const p1 = p0 === null ? null : p0 * (1 - priceDrop);
    const yieldSats = stxShares === 0n ? null : (Number(w.stxOnly) * 1e6) / Number(stxShares);
    const hyp = (value: unknown, unit: string, source: string, note?: string) => f(value, unit, "hypothetical", source, note);

    return {
      inputs: {
        commit_drop: commitDrop,
        price_drop: priceDrop,
        base_pool: f(base, "sats", "mirrored", `${txSource(last.txid)}: gross-accrued-rewards (latest distribution ${last.distribution_index})`),
        stx_shares: f(stxShares, "uSTX", "mirrored", `${txSource(last.txid)}: cycle-staked-ustx`),
        book: bookBtc === null
          ? f("current", "book", order ? "onchain" : "mirrored", bookSource)
          : hyp({ book_btc: bookBtc, bonds: bondCount, target_rate_bps: 300, stx_value_ratios: book.map((b) => b.stxValueRatio.toString()) }, "book", "query parameters", `illustrative: ${bondCount} equal bonds at 3%, stx-value-ratios stepped 5% below the top current bond; ${SIP_BOOK_NOTE}`),
        price: f(p0, "sats per STX", "mirrored", `${last.price_source} @ ${last.price_timestamp} (price at distribution ${last.distribution_index})`),
        base: `distribution ${last.distribution_index} (cycle ${last.stx_cycle}, calculation height ${last.calculation_height})`,
      },
      assumption: `pool = base_pool * (1 - commit_drop) * (1 - price_drop); ${PRICE_ASSUMPTION}`,
      commit_model:
        "pool = sum of confirmed miner commits to the sBTC address over the interval, roughly 1,050 blocks x paying fraction x per-block spend (in distribution 286: 705 of 1,050 blocks paid, mostly 332,500 sats from 5 miners); commit_drop cuts that total (fewer paying blocks, fewer miners or lower spend). PoX-5 burns nothing. See research/missing-blocks.",
      pool: hyp(pool_, "sats per interval", "stressed base_pool"),
      obligation: hyp(w.obligation, "sats per interval", "sum of shares * rate / 10000 / 50"),
      coverage: hyp(w.coverageBps === null ? null : Number(w.coverageBps) / 10000, "x", "pool / obligation", w.coverageBps === null ? "n/a: no bonds" : undefined),
      headroom: hyp(w.headroomBps === null ? null : Number(w.headroomBps) / 10000, "fraction", "1 - obligation / pool"),
      shortfall: hyp(w.shortfall, "sats per interval", "obligation - bond payouts", "the reserve stays flat; in this iteration it cannot be drawn automatically, and using it goes through a SIP process"),
      payout: hyp(
        w.bonds.map((b, i) => ({ position: i, bond_index: b.bondIndex, stx_value_ratio: b.stxValueRatio.toString(), target_sats: b.target.toString(), paid_sats: b.paid.toString(), status: b.status })),
        "bonds",
        "pox-5 waterfall: descending stx-value-ratio, ties to lower index; each bond paid min(target, remaining)",
      ),
      reserve_deposit: hyp(w.reserveDeposit, "sats per interval", "15% of the remainder after bonds"),
      stx_only: hyp(w.stxOnly, "sats per interval", "85% of the remainder after bonds"),
      stx_only_yield: hyp(yieldSats, "sats per STX per interval", "stx_only / stx_shares * 1e6"),
      stx_only_apy_btc: hyp(yieldSats === null || !p1 ? null : (yieldSats * 50) / p1, "fraction per year", "stx_only_yield * 50 / stressed price"),
      cliff_price: hyp(p1 === null ? null : cliffSatsPerStx(p1, pool_, w.obligation), "sats per STX", "stressed price * obligation / pool", PRICE_ASSUMPTION),
    };
  });

  app.setErrorHandler((err: any, _req, reply) => {
    reply.code(err.statusCode ?? 500).send({ error: err.message });
  });
  return app;
}

