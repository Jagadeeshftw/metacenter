import { describe, it, expect } from "vitest";
import { Cl, cvToValue } from "@stacks/transactions";

// Mainnet fork pinned at Stacks block 9,019,000 (Bitcoin 967,574); see Clarinet.fork.toml.
// Expected values were read independently with Hiro call-read ?tip=<index hash of 9,019,000>
// and from the mainnet calculate-rewards events (research/PHASE0-REPORT.md).
const accounts = simnet.getAccounts();
const caller = accounts.get("wallet_1")!;

const ro = (fn: string, args: any[] = []) =>
  cvToValue(simnet.callReadOnlyFn("pox5-reader", fn, args, caller).result);
const n = (v: any) => BigInt(v.value ?? v);

const PRECISION = 10n ** 18n;
// pox-5 state at the pinned height
const RPT = {
  141: { stx: 758607677183n, b1: 0n },
  142: { stx: 909456324512n, b1: 0n },
  143: { stx: 420177251715n, b1: 599999974940302n },
};
const SHARES = {
  141: { stx: 392447554847960n, b1: 0n },
  142: { stx: 421543815427560n, b1: 0n },
  143: { stx: 438005558960464n, b1: 23017037628n },
};
// gross-accrued-rewards summed per cycle from calculate-rewards events
const EVENT_GROSS = { 141: 350251444n, 142: 451030221n, 143: 230327835n };
const BOND1_TARGET = 13810222n;

const reconstruct = (c: 141 | 142 | 143) => {
  const bondPaid = (RPT[c].b1 * SHARES[c].b1) / PRECISION;
  const stxPaid = (RPT[c].stx * SHARES[c].stx) / PRECISION;
  return bondPaid + (stxPaid * 10000n) / 8500n;
};

describe("pox5-reader on a mainnet fork", () => {
  it("sees mainnet cycle 143 and its calculation heights", () => {
    expect(n(ro("get-current-cycle"))).toBe(143n);
    const h = ro("get-cycle-calc-heights", [Cl.uint(143)]);
    expect(n(h.mid)).toBe(967399n);
    expect(n(h.end)).toBe(968449n);
    expect(n(ro("get-intervals-computed", [Cl.uint(141)]))).toBe(2n);
    expect(n(ro("get-intervals-computed", [Cl.uint(142)]))).toBe(2n);
    expect(n(ro("get-intervals-computed", [Cl.uint(143)]))).toBe(1n);
  });

  it("finds bond 1 (the Genesis Bond) as the only active bond in 143", () => {
    const order = ro("get-bond-payout-order", [Cl.uint(143)]);
    expect(order).toHaveLength(1);
    const b = order[0].value;
    expect(n(b["bond-index"])).toBe(1n);
    expect(n(b["stx-value-ratio"])).toBe(310237n);
    expect(n(b["target-rate"])).toBe(300n);
    expect(n(b.shares)).toBe(23017037628n);
    expect(n(b["target-per-interval"])).toBe(BOND1_TARGET);
    expect(ro("get-bond-payout-order", [Cl.uint(142)])).toHaveLength(0);
  });

  it("obligation per interval = shares * rate / 10000 / 50", () => {
    expect(n(ro("get-obligation-per-interval", [Cl.uint(143)]))).toBe(BOND1_TARGET);
    expect(n(ro("get-obligation-per-interval", [Cl.uint(142)]))).toBe(0n);
  });

  it("reserve and hypothetical cover", () => {
    expect(n(ro("get-reserve"))).toBe(152669889n);
    const c = ro("get-reserve-cover-cycles", [Cl.uint(143)]);
    expect(n(c["reserve-sats"])).toBe(152669889n);
    expect(n(c["obligation-per-cycle-sats"])).toBe(2n * BOND1_TARGET);
    expect(n(c["cover-cycles-x100"].value)).toBe(552n); // 5.52 cycles
    expect(c["reserve-can-pay-bonds"].value).toBe(false);
  });

  it("cycle 143 coverage from rpt x shares matches the calculate-rewards event within 2 sats", () => {
    const c = ro("get-coverage-for-cycle", [Cl.uint(143)]);
    const pool = n(c["pool-sats"]);
    expect(pool).toBe(reconstruct(143));
    expect(pool - EVENT_GROSS[143] <= 2n && EVENT_GROSS[143] - pool <= 2n).toBe(true);
    expect(n(c["intervals-computed"])).toBe(1n);
    expect(n(c["obligation-sats"])).toBe(BOND1_TARGET);
    // reconstructed payout is 1 sat under the target through truncation; not a shortfall
    expect(n(c["bond-paid-sats"])).toBe(BOND1_TARGET - 1n);
    expect(n(c["shortfall-sats"])).toBe(0n);
    expect(n(c["coverage-bps"].value)).toBe(166780n); // 16.678x
    expect(n(c["headroom-bps"].value)).toBe(9400n); // pool can fall 94.00%
    expect(c["stx-visible"].value).toBe(true);
  });

  it("cycles 141 and 142 have no bonds: coverage n/a, pool still reconstructed", () => {
    for (const cycle of [141, 142] as const) {
      const c = ro("get-coverage-for-cycle", [Cl.uint(cycle)]);
      const pool = n(c["pool-sats"]);
      expect(pool).toBe(reconstruct(cycle));
      // two intervals each: +-2 sats per interval
      expect(pool - EVENT_GROSS[cycle] <= 4n && EVENT_GROSS[cycle] - pool <= 4n).toBe(true);
      expect(c["coverage-bps"].value).toBeNull();
      expect(c["headroom-bps"].value).toBeNull();
      expect(n(c["obligation-sats"])).toBe(0n);
    }
  });

  it("pending pool equals pox-5 get-new-rewards without calling it", () => {
    const p = ro("get-pending-pool");
    // sBTC balance 16,269,401,916 - staked 16,016,587,628 - reserve 152,669,889 - accounted 62,630,133
    expect(n(p["pending-sats"])).toBe(37514266n);
    expect(p.balanced.value).toBe(true);
    expect(n(p["last-compute-height"])).toBe(967399n);
  });

  it("simulated waterfall reproduces the real distribution exactly", () => {
    const s = ro("simulate-waterfall", [Cl.uint(EVENT_GROSS[143]), Cl.uint(143)]);
    const b = s.bonds.value[0].value;
    expect(b.status.value).toBe("full");
    expect(n(b["paid-sats"])).toBe(13810222n);
    expect(n(s["reserve-deposit-sats"])).toBe(32477641n);
    expect(n(s["stx-only-sats"])).toBe(184039972n);
  });

  it("simulated waterfall: partial and unpaid bond; reserve deposit is zero, never negative", () => {
    const partial = ro("simulate-waterfall", [Cl.uint(10000000), Cl.uint(143)]);
    expect(partial.bonds.value[0].value.status.value).toBe("partial");
    expect(n(partial.bonds.value[0].value["paid-sats"])).toBe(10000000n);
    expect(n(partial["reserve-deposit-sats"])).toBe(0n);
    expect(n(partial["stx-only-sats"])).toBe(0n);
    const none = ro("simulate-waterfall", [Cl.uint(0), Cl.uint(143)]);
    expect(none.bonds.value[0].value.status.value).toBe("none");
  });

  it("trait summary reports cycle 143, provenance onchain", () => {
    const s = ro("get-coverage-summary").value;
    expect(n(s.period)).toBe(143n);
    expect(s.provenance.value).toBe("onchain");
    expect(n(s["coverage-bps"].value)).toBe(166780n);
  });

  it("snapshot records interval 287 with cycle 143 rpt", () => {
    const r = simnet.callPublicFn("pox5-reader", "snapshot", [], caller);
    expect(r.result).toBeOk(Cl.uint(287));
    const s = ro("get-snapshot", [Cl.uint(287)]).value;
    expect(n(s["rewards-cycle"].value)).toBe(143n);
    expect(n(s["stx-rpt"])).toBe(RPT[143].stx);
    expect(n(s["stx-shares"])).toBe(SHARES[143].stx);
    expect(n(s.reserve)).toBe(152669889n);
    expect(n(s.bonds.value[0].value.rpt)).toBe(RPT[143].b1);
    expect(simnet.callPublicFn("pox5-reader", "snapshot", [], caller).result).toBeErr(Cl.uint(100));
  });
});
