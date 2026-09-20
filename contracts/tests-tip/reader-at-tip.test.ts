// pox5-reader against mainnet state at the current chain tip.
//
// Run it with: node scripts/verify-at-tip.mjs
//
// Unlike tests-fork (pinned, deterministic), nothing here is hardcoded: every expected value is
// computed in the test from pox-5 read-onlys fetched from Hiro at the same tip the fork uses.
// The contract source is byte-identical to the deployed mainnet contract, which
// scripts/verify-at-tip.mjs checks before running this.
//
// It exists because 9 of the reader's 13 read-onlys cannot be called through Hiro's public
// /v2/contracts/call-read: every contract-call? into pox-5 loads that contract, about 569k of
// read length, over the endpoint's 500k cap. There is no such limit inside a transaction or a
// fork, so this is how the deployed logic gets checked against live state.
import { describe, it, expect, beforeAll } from "vitest";
import { Cl, cvToValue, hexToCV, cvToHex, type ClarityValue } from "@stacks/transactions";

const API = "https://api.hiro.so";
const POX5 = "SP000000000000000000002Q6VF78.pox-5";
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const SENDER = "SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY";
const PRECISION = 10n ** 18n;
const RESERVE_RATIO = 1500n;
const TIP = process.env.FORK_TIP_INDEX_HASH?.replace(/^0x/, "") ?? "";

const caller = () => simnet.getAccounts().get("wallet_1")!;
const n = (v: any): bigint => BigInt(v?.value ?? v);

/** cvToValue(..., true) wraps every value as {type, value}; strip that back to plain data. */
function plain(v: any): any {
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object") {
    if ("type" in v && "value" in v && Object.keys(v).length === 2) return plain(v.value);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}


/** A pox-5 (or sbtc-token) read-only on mainnet, at the same tip the fork is pinned to. */
async function onMainnet(contract: string, fn: string, args: ClarityValue[] = []): Promise<any> {
  const [addr, name] = contract.split(".");
  const r = await fetch(`${API}/v2/contracts/call-read/${addr}/${name}/${fn}${TIP ? `?tip=${TIP}` : ""}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sender: SENDER, arguments: args.map((a) => cvToHex(a)) }),
  });
  const j = await r.json();
  if (!j.okay) throw new Error(`${contract}::${fn}: ${j.cause}`);
  return plain(cvToValue(hexToCV(j.result), true));
}
const pox5 = (fn: string, args: ClarityValue[] = []) => onMainnet(POX5, fn, args);

/** A pox5-reader read-only in the fork, as plain data (none -> null, some -> the value). */
const ro = (fn: string, args: ClarityValue[] = []) => plain(cvToValue(simnet.callReadOnlyFn("pox5-reader", fn, args, caller()).result, true));

type Bond = { idx: bigint; shares: bigint; ratio: bigint; rate: bigint; target: bigint; rpt: bigint };
let cycle: bigint;
let bonds: Bond[];
let obligation: bigint;
let pool: bigint;
let bondPaid: bigint;
let stxPaid: bigint;

beforeAll(async () => {
  cycle = n(await pox5("current-pox-reward-cycle"));
  const order = ro("get-bond-payout-order", [Cl.uint(cycle)]);
  bonds = [];
  for (const item of order) {
    const idx = n(item["bond-index"]);
    const pb = await pox5("get-protocol-bond", [Cl.uint(idx)]);
    const shares = n(await pox5("get-total-shares-staked-for-cycle", [Cl.uint(cycle), Cl.some(Cl.uint(idx))]));
    bonds.push({
      idx,
      shares,
      ratio: n(pb["stx-value-ratio"]),
      rate: n(pb["target-rate"]),
      target: (shares * n(pb["target-rate"])) / 10000n / 50n,
      rpt: n(await pox5("get-rewards-per-token-for-cycle", [Cl.uint(cycle), Cl.some(Cl.uint(idx))])),
    });
  }
  obligation = bonds.reduce((s, b) => s + b.target, 0n);
  const stxShares = n(await pox5("get-total-shares-staked-for-cycle", [Cl.uint(cycle), Cl.none()]));
  const stxRpt = n(await pox5("get-rewards-per-token-for-cycle", [Cl.uint(cycle), Cl.none()]));
  stxPaid = (stxRpt * stxShares) / PRECISION;
  bondPaid = bonds.reduce((s, b) => s + (b.rpt * b.shares) / PRECISION, 0n);
  pool = bondPaid + (stxPaid * 10000n) / (10000n - RESERVE_RATIO);
});

describe("pox5-reader against mainnet state at the tip", () => {
  it("reports the cycle pox-5 reports", async () => {
    expect(n(ro("get-current-cycle"))).toBe(cycle);
  });

  it("derives the cycle's two calculation heights from pox-5", async () => {
    const h = ro("get-cycle-calc-heights", [Cl.uint(cycle)]);
    const start = n(await pox5("reward-cycle-to-burn-height", [Cl.uint(cycle)]));
    const first = n(await pox5("burn-height-to-distribution-index", [Cl.uint(start)]));
    expect(n(h.mid)).toBe(n(await pox5("distribution-cycle-to-burn-height", [Cl.uint(first + 1n)])) - 1n);
    expect(n(h.end)).toBe(n(await pox5("distribution-cycle-to-burn-height", [Cl.uint(first + 2n)])) - 1n);
  });

  it("counts the intervals pox-5 has computed", async () => {
    const h = ro("get-cycle-calc-heights", [Cl.uint(cycle)]);
    const lastCalc = n(await pox5("get-last-reward-compute-height"));
    const want = (lastCalc >= n(h.mid) ? 1n : 0n) + (lastCalc >= n(h.end) ? 1n : 0n);
    expect(n(ro("get-intervals-computed", [Cl.uint(cycle)]))).toBe(want);
  });

  it("lists bonds in pox-5 payout order with pox-5's own fields", () => {
    const order = ro("get-bond-payout-order", [Cl.uint(cycle)]);
    const sorted = [...bonds].sort((a, b) => (b.ratio === a.ratio ? Number(a.idx - b.idx) : Number(b.ratio - a.ratio)));
    expect(order.map((i: any) => n(i["bond-index"]))).toEqual(sorted.map((b) => b.idx));
    order.forEach((got: any, i: number) => {
      expect(n(got["stx-value-ratio"])).toBe(sorted[i].ratio);
      expect(n(got["target-rate"])).toBe(sorted[i].rate);
      expect(n(got.shares)).toBe(sorted[i].shares);
      expect(n(got["target-per-interval"])).toBe(sorted[i].target);
    });
  });

  it("obligation per interval is the sum of shares × rate / 10000 / 50", () => {
    expect(n(ro("get-obligation-per-interval", [Cl.uint(cycle)]))).toBe(obligation);
    for (const b of bonds) {
      expect(n(ro("bond-target-per-interval", [Cl.uint(b.shares), Cl.uint(b.rate)]))).toBe(b.target);
    }
  });

  it("reserve matches pox-5, and cannot pay bonds", async () => {
    const reserve = n(await pox5("get-reserve-balance"));
    expect(n(ro("get-reserve"))).toBe(reserve);
    const c = ro("get-reserve-cover-cycles", [Cl.uint(cycle)]);
    expect(n(c["reserve-sats"])).toBe(reserve);
    expect(n(c["obligation-per-cycle-sats"])).toBe(2n * obligation);
    expect(c["reserve-can-pay-bonds"]).toBe(false);
    if (obligation > 0n) expect(n(c["cover-cycles-x100"])).toBe((reserve * 100n) / (2n * obligation));
    else expect(c["cover-cycles-x100"]).toBeNull();
  });

  it("coverage is the reconstructed pool over the obligation", () => {
    const c = ro("get-coverage-for-cycle", [Cl.uint(cycle)]);
    expect(n(c["pool-sats"])).toBe(pool);
    expect(n(c["bond-paid-sats"])).toBe(bondPaid);
    expect(n(c["stx-paid-sats"])).toBe(stxPaid);
    expect(n(c["obligation-sats"])).toBe(obligation);
    if (obligation === 0n) {
      expect(c["coverage-bps"]).toBeNull();
      expect(c["headroom-bps"]).toBeNull();
    } else {
      expect(n(c["coverage-bps"])).toBe((pool * 10000n) / obligation);
      expect(n(c["headroom-bps"])).toBe(pool >= obligation ? ((pool - obligation) * 10000n) / pool : 0n);
    }
  });

  it("pending pool equals the sBTC balance of pox-5 minus what pox-5 has accounted", async () => {
    const balance = n(await onMainnet(SBTC, "get-balance", [Cl.principal(POX5)]));
    const accounted =
      n(await pox5("get-total-sbtc-staked")) + n(await pox5("get-reserve-balance")) + n(await pox5("get-last-accounted-rewards-only"));
    const p = ro("get-pending-pool");
    expect(n(p["pending-sats"])).toBe(balance >= accounted ? balance - accounted : 0n);
    expect(p.balanced).toBe(balance >= accounted);
    expect(n(p["last-compute-height"])).toBe(n(await pox5("get-last-reward-compute-height")));
  });

  it("simulated waterfall pays in order, then 15% to the reserve", () => {
    const s = ro("simulate-waterfall", [Cl.uint(pool), Cl.uint(cycle)]);
    const sorted = [...bonds].sort((a, b) => (b.ratio === a.ratio ? Number(a.idx - b.idx) : Number(b.ratio - a.ratio)));
    let left = pool;
    sorted.forEach((b, i) => {
      const paid = left >= b.target ? b.target : left;
      left -= paid;
      const got = s.bonds[i];
      expect(n(got["paid-sats"])).toBe(paid);
      expect(got.status).toBe(paid === b.target ? "full" : paid === 0n ? "none" : "partial");
    });
    const cut = (left * RESERVE_RATIO) / 10000n;
    expect(n(s["reserve-deposit-sats"])).toBe(cut);
    expect(n(s["stx-only-sats"])).toBe(left - cut);
  });

  it("trait summary agrees with get-coverage-for-cycle and is labelled onchain", () => {
    const s = ro("get-coverage-summary");
    const c = ro("get-coverage-for-cycle", [Cl.uint(n(s.period))]);
    expect(s.provenance).toBe("onchain");
    expect(s["coverage-bps"] == null ? null : n(s["coverage-bps"])).toEqual(c["coverage-bps"] == null ? null : n(c["coverage-bps"]));
    expect(s["headroom-bps"] == null ? null : n(s["headroom-bps"])).toEqual(c["headroom-bps"] == null ? null : n(c["headroom-bps"]));
  });

  it("snapshot records the current distribution index once, from pox-5 state", async () => {
    const index = n(await pox5("current-distribution-cycle"));
    const r = simnet.callPublicFn("pox5-reader", "snapshot", [], caller());
    expect(r.result).toBeOk(Cl.uint(index));
    const s = ro("get-snapshot", [Cl.uint(index)]);
    expect(n(s["stx-rpt"])).toBe(n(await pox5("get-rewards-per-token-for-cycle", [Cl.uint(cycle), Cl.none()])));
    expect(n(s["stx-shares"])).toBe(n(await pox5("get-total-shares-staked-for-cycle", [Cl.uint(cycle), Cl.none()])));
    expect(n(s.reserve)).toBe(n(await pox5("get-reserve-balance")));
    expect(n(s["last-compute-height"])).toBe(n(await pox5("get-last-reward-compute-height")));
    // a second call in the same distribution is rejected
    expect(simnet.callPublicFn("pox5-reader", "snapshot", [], caller()).result).toBeErr(Cl.uint(100));
  });
});
