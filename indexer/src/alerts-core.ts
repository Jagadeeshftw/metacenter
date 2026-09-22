// Alert rendering and rules for the Telegram broadcast prototype.
//
// Pure on purpose: no config, no database, no token. It reads the public API and decides what
// would be posted, so the dry run, the tests and the live sender all see exactly the same
// messages. Sending lives in alerts.ts.
const SITE = "https://metacenter.0xo.in";

/** Thresholds, with the reason each one exists. Shown as-is on the /docs/alerts page. */
export const THRESHOLDS = {
  coverageWarn: 3, // "thin": a third of the pool would go to bonds
  // The SIP draft itself sets no coverage target; 2.0x is the level friedger's analysis in the
  // SIP thread (post #14) treats as the line, and post #31 echoes. Cite it that way, not as a
  // SIP target.
  coverageCritical: 2,
  headroomWarn: 0.5, // equivalent to 2.0x coverage, stated the other way round
  cacheStaleBlocks: 1200, // the keeper refreshes at least every 1,100 burn blocks
};

export type AlertState = {
  burnHeight: number;
  takenAt: string;
  distribution: number | null;
  cycle: number | null;
  coverage: { value: number | null; provenance: string };
  headroom: { value: number | null; provenance: string };
  pool: string | null;
  obligation: string | null;
  reserve: { value: string | null; provenance: string };
  reserveCover: number | null;
  yieldPerStx: number | null;
  apyBtc: number | null;
  bondIndexes: number[];
  cacheBehind: number | null;
  keeper: { lowBalance: boolean | null; lastStatus: string | null; lastKind: string | null } | null;
};

export type Alert = { key: string; kind: "distribution" | "warning" | "resolved" | "bond"; text: string };

const int = (v: string | number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString("en-US"));
const times = (v: number | null) => (v == null ? "n/a" : `${v.toFixed(2)}×`);
const pct = (v: number | null) => (v == null ? "n/a" : `${(v * 100).toFixed(2)}%`);
const sats = (v: string | null) => (v == null ? "—" : `${int(v)} sats`);
const tag = (p: string) => (p === "onchain" ? "onchain" : p === "mirrored" ? "mirrored" : "hypothetical");

/** The post that goes out after a distribution is indexed and the on-chain cache has caught up. */
export function renderDistribution(s: AlertState): string {
  return [
    `PoX-5 distribution ${s.distribution} settled (cycle ${s.cycle})`,
    ``,
    `Coverage: ${times(s.coverage.value)} [${tag(s.coverage.provenance)}]`,
    `Headroom: ${pct(s.headroom.value)} [${tag(s.headroom.provenance)}]`,
    `Pool: ${sats(s.pool)} vs ${sats(s.obligation)} owed to bonds [mirrored]`,
    `Reserve: ${sats(s.reserve.value)} [${tag(s.reserve.provenance)}]${
      s.reserveCover == null
        ? ""
        : ` — hypothetical cover ${s.reserveCover.toFixed(2)} cycles; a back-stop by design, accrual-only in this iteration (using it goes through a SIP process)`
    }`,
    `STX-only realised yield: ${s.yieldPerStx == null ? "n/a" : `${s.yieldPerStx.toFixed(4)} sats per STX`}${
      s.apyBtc == null ? "" : `, ${pct(s.apyBtc)} a year in BTC terms`
    } [mirrored]`,
    ``,
    `Read at Bitcoin block ${int(s.burnHeight)}.`,
    `${SITE}/dashboard`,
  ].join("\n");
}

const warnings = (s: AlertState) => {
  const out: { key: string; text: string }[] = [];
  const at = `Bitcoin block ${int(s.burnHeight)}`;
  const c = s.coverage.value;
  if (c != null && c < THRESHOLDS.coverageCritical)
    out.push({
      key: "coverage-critical",
      text: `CRITICAL: PoX-5 bond coverage is ${times(c)} [${tag(s.coverage.provenance)}], below the 2.0× level discussed in the Bitcoin Staking SIP thread (friedger, post #14). The SIP draft sets no coverage target. The reward pool is ${sats(
        s.pool,
      )} against ${sats(s.obligation)} owed to bonds. ${at}.\n${SITE}/dashboard/coverage`,
    });
  else if (c != null && c < THRESHOLDS.coverageWarn)
    out.push({
      key: "coverage-warn",
      text: `Warning: PoX-5 bond coverage is ${times(c)} [${tag(s.coverage.provenance)}], under 3.0×. Pool ${sats(s.pool)} against ${sats(
        s.obligation,
      )} owed. ${at}.\n${SITE}/dashboard/coverage`,
    });
  const h = s.headroom.value;
  if (h != null && h < THRESHOLDS.headroomWarn)
    out.push({
      key: "headroom-warn",
      text: `Warning: headroom is ${pct(h)} [${tag(s.headroom.provenance)}]. The reward pool can fall only this far before bond yield is impaired. ${at}.\n${SITE}/dashboard`,
    });
  if (s.cacheBehind != null && s.cacheBehind > THRESHOLDS.cacheStaleBlocks)
    out.push({
      key: "cache-stale",
      text: `Warning: the on-chain coverage-cache reading is ${int(s.cacheBehind)} Bitcoin blocks old, past its ${int(
        THRESHOLDS.cacheStaleBlocks,
      )}-block window, so the onchain figures on the dashboard are not being refreshed. ${at}.\n${SITE}/docs/verification/read-limits`,
    });
  if (s.keeper?.lowBalance)
    out.push({ key: "keeper-balance", text: `Warning: the keeper that refreshes the on-chain cache is low on STX for fees. ${at}.` });
  if (s.keeper?.lastStatus && s.keeper.lastStatus !== "success")
    out.push({
      key: "keeper-failed",
      text: `Warning: the keeper's last ${s.keeper.lastKind ?? "call"} did not succeed (${s.keeper.lastStatus}). The onchain figures may stop refreshing. ${at}.`,
    });
  return out;
};

const RESOLVED: Record<string, string> = {
  "coverage-critical": "Resolved: PoX-5 bond coverage is back above the 2.0× level discussed in the SIP thread",
  "coverage-warn": "Resolved: PoX-5 bond coverage is back above 3.0×",
  "headroom-warn": "Resolved: headroom is back above 50%",
  "cache-stale": "Resolved: the on-chain coverage-cache is being refreshed again",
  "keeper-balance": "Resolved: the keeper has been topped up",
  "keeper-failed": "Resolved: the keeper's calls are succeeding again",
};

export type Posted = { distributions?: number[]; active?: string[]; bonds?: number[]; seeded?: boolean };

/**
 * First run: record the bonds that are already active as known, so the channel does not open by
 * announcing the Genesis Bond as new. Only bond indexes that appear after this are announced.
 */
export function seedPosted(s: AlertState, posted: Posted): Posted {
  if (posted.seeded) return posted;
  return { ...posted, seeded: true, bonds: [...new Set([...(posted.bonds ?? []), ...s.bondIndexes])] };
}

/**
 * What to post, given the state and what has already gone out. Pure, so the dry run and the
 * tests see exactly what the channel would.
 */
export function evaluate(s: AlertState, posted: Posted): Alert[] {
  const out: Alert[] = [];
  const doneDist = posted.distributions ?? [];
  const active = posted.active ?? [];
  const knownBonds = posted.bonds ?? [];

  if (s.distribution != null && !doneDist.includes(s.distribution))
    out.push({ key: `distribution:${s.distribution}`, kind: "distribution", text: renderDistribution(s) });

  for (const b of s.bondIndexes.filter((b) => !knownBonds.includes(b)))
    out.push({
      key: `bond:${b}`,
      kind: "bond",
      text: `New PoX-5 bonding period: bond ${b} is active in cycle ${s.cycle}. It is now part of what the reward pool has to cover — coverage is ${times(
        s.coverage.value,
      )} [${tag(s.coverage.provenance)}] at Bitcoin block ${int(s.burnHeight)}.\n${SITE}/dashboard/bonds`,
    });

  const now = warnings(s);
  for (const w of now) if (!active.includes(w.key)) out.push({ key: `warn:${w.key}`, kind: "warning", text: w.text });
  for (const key of active)
    if (!now.some((w) => w.key === key))
      out.push({
        key: `resolved:${key}`,
        kind: "resolved",
        text: `${RESOLVED[key] ?? `Resolved: ${key}`}. Read at Bitcoin block ${int(s.burnHeight)}.\n${SITE}/dashboard`,
      });
  return out;
}

/** The state the alerts are judged on, read from this service's own public API. */
export async function readState(apiBase: string): Promise<AlertState> {
  const get = async (p: string) => {
    const r = await fetch(apiBase + p, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`${p}: ${r.status}`);
    return r.json() as Promise<any>;
  };
  const [cur, iv, meta, health] = await Promise.all([get("/metrics/current"), get("/intervals"), get("/meta"), get("/health")]);
  const last = iv.intervals?.at(-1) ?? null;
  const coverage = cur.coverage.value != null ? cur.coverage : last?.coverage ?? { value: null, provenance: "mirrored" };
  const headroom = cur.headroom.value != null ? cur.headroom : last?.headroom ?? { value: null, provenance: "mirrored" };
  return {
    burnHeight: cur.as_of.burn_height,
    takenAt: cur.as_of.taken_at,
    distribution: last?.distribution_index ?? null,
    cycle: last?.cycle ?? (cur.cycle.value == null ? null : Number(cur.cycle.value)),
    coverage: { value: coverage.value == null ? null : Number(coverage.value), provenance: coverage.provenance },
    headroom: { value: headroom.value == null ? null : Number(headroom.value), provenance: headroom.provenance },
    pool: last?.gross_pool.value ?? null,
    obligation: cur.obligation_per_interval.value ?? last?.obligation.value ?? null,
    reserve: { value: cur.reserve.value ?? last?.reserve_balance.value ?? null, provenance: cur.reserve.value ? cur.reserve.provenance : "mirrored" },
    reserveCover: cur.reserve_cover.value == null ? null : Number(cur.reserve_cover.value),
    yieldPerStx: last?.stx_only_yield.value == null ? null : Number(last.stx_only_yield.value),
    apyBtc: last?.stx_only_apy_btc.value == null ? null : Number(last.stx_only_apy_btc.value),
    bondIndexes: (cur.payout_order.value ?? []).map((b: any) => Number(b.bond_index)),
    cacheBehind: health?.checks?.coverage_cache?.blocks_behind_tip ?? null,
    keeper: meta.keeper
      ? { lowBalance: meta.keeper.low_balance ?? null, lastStatus: meta.keeper.last?.status ?? null, lastKind: meta.keeper.last?.kind ?? null }
      : null,
  };
}

