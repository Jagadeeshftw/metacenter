import { describe, it, expect, beforeEach } from "vitest";
import { Cl, ClarityType, cvToValue } from "@stacks/transactions";

// Plain simnet (empty pox-5 state). Real-data assertions live in tests-fork/.
const accounts = simnet.getAccounts();
const wallet1 = accounts.get("wallet_1")!;
const POX5 = "SP000000000000000000002Q6VF78.pox-5";
// Hard-coded bond admin in the deployed pox-5 (L348).
const BOND_ADMIN = "SP72DMR3MJKS7RVBY33JVV7EEJSQ1PYDVKDP10FX";

const ro = (fn: string, args: any[] = []) =>
  simnet.callReadOnlyFn("pox5-reader", fn, args, wallet1).result;

const setupBond = (index: number, stxValueRatio: number, targetRate = 300) =>
  simnet.callPublicFn(
    POX5,
    "setup-bond",
    [
      Cl.uint(index),
      Cl.uint(targetRate),
      Cl.uint(stxValueRatio),
      Cl.uint(500),
      Cl.bufferFromHex("51"),
      Cl.list([]),
    ],
    BOND_ADMIN,
  ).result;

const cycleLength = () => {
  const info = cvToValue(simnet.callReadOnlyFn(POX5, "get-pox-info", [], wallet1).result);
  return Number(info.value["reward-cycle-length"].value);
};

const mineTo = (height: number) => {
  const n = height - simnet.burnBlockHeight;
  if (n > 0) simnet.mineEmptyBurnBlocks(n);
};

describe("pox5-reader: empty pox-5 state", () => {
  it("reports no bonds and no obligation", () => {
    expect(ro("get-bond-payout-order", [Cl.uint(0)])).toStrictEqual(Cl.list([]));
    expect(ro("get-obligation-per-interval", [Cl.uint(0)])).toBeUint(0);
  });

  it("reserve cover is n/a without bonds and the reserve can never pay bonds", () => {
    expect(ro("get-reserve-cover-cycles", [Cl.uint(0)])).toStrictEqual(
      Cl.tuple({
        "reserve-sats": Cl.uint(0),
        "obligation-per-cycle-sats": Cl.uint(0),
        "cover-cycles-x100": Cl.none(),
        "reserve-can-pay-bonds": Cl.bool(false),
      }),
    );
  });

  it("coverage is n/a (none) for a cycle with no bonds and no distributions", () => {
    const c = ro("get-coverage-for-cycle", [Cl.uint(0)]);
    expect(c).toStrictEqual(
      Cl.tuple({
        cycle: Cl.uint(0),
        "intervals-computed": Cl.uint(0),
        "pool-sats": Cl.uint(0),
        "bond-paid-sats": Cl.uint(0),
        "stx-paid-sats": Cl.uint(0),
        "obligation-sats": Cl.uint(0),
        "shortfall-sats": Cl.uint(0),
        "coverage-bps": Cl.none(),
        "headroom-bps": Cl.none(),
        "stx-visible": Cl.bool(false),
      }),
    );
  });

  it("pending pool is zero and balanced", () => {
    expect(ro("get-pending-pool")).toStrictEqual(
      Cl.tuple({
        "pending-sats": Cl.uint(0),
        balanced: Cl.bool(true),
        "last-compute-height": Cl.uint(0),
      }),
    );
  });

  it("coverage summary implements the trait with provenance onchain", () => {
    const r = ro("get-coverage-summary");
    expect(r.type).toBe(ClarityType.ResponseOk);
    const v = cvToValue(r).value;
    expect(v.provenance.value).toBe("onchain");
    expect(v["period-kind"].value).toBe("cycle");
    expect(v["coverage-bps"].value).toBeNull();
  });

  it("bond target math matches pox-5 L2266 (floor twice)", () => {
    // bond 1 on mainnet: 23,017,037,628 sats at 300 bps -> 13,810,222 sats/interval
    expect(ro("bond-target-per-interval", [Cl.uint(23017037628n), Cl.uint(300)])).toBeUint(13810222);
    expect(ro("bond-target-per-interval", [Cl.uint(0), Cl.uint(300)])).toBeUint(0);
    // 1 sat never earns anything
    expect(ro("bond-target-per-interval", [Cl.uint(1), Cl.uint(10000)])).toBeUint(0);
  });

  it("cycle calc heights are the last block of each distribution interval", () => {
    const len = cycleLength();
    expect(ro("get-cycle-calc-heights", [Cl.uint(3)])).toStrictEqual(
      Cl.tuple({ mid: Cl.uint(3 * len + len / 2 - 1), end: Cl.uint(4 * len - 1) }),
    );
  });
});

describe("pox5-reader: snapshot", () => {
  it("records once per distribution index and errors on repeat (u100)", () => {
    const first = simnet.callPublicFn("pox5-reader", "snapshot", [], wallet1);
    expect(first.result.type).toBe(ClarityType.ResponseOk);
    const index = cvToValue(first.result).value;
    expect(first.events.some((e) => e.event === "print_event")).toBe(true);

    const again = simnet.callPublicFn("pox5-reader", "snapshot", [], wallet1);
    expect(again.result).toBeErr(Cl.uint(100));

    const snap = ro("get-snapshot", [Cl.uint(index)]);
    expect(snap.type).toBe(ClarityType.OptionalSome);
    const v = cvToValue(snap).value;
    // no distribution has happened yet
    expect(v["rewards-cycle"].value).toBeNull();
    expect(v.bonds.value).toStrictEqual([]);
  });

  it("a new distribution index can be snapshotted again", () => {
    const a = simnet.callPublicFn("pox5-reader", "snapshot", [], wallet1);
    const len = cycleLength();
    simnet.mineEmptyBurnBlocks(len / 2);
    const b = simnet.callPublicFn("pox5-reader", "snapshot", [], wallet1);
    expect(a.result.type).toBe(ClarityType.ResponseOk);
    expect(b.result.type).toBe(ClarityType.ResponseOk);
    expect(Number(cvToValue(b.result).value)).toBe(Number(cvToValue(a.result).value) + 1);
  });

  it("returns none for a distribution index never snapshotted", () => {
    expect(ro("get-snapshot", [Cl.uint(999999)])).toBeNone();
  });
});

describe("pox5-reader: payout order across several bonds", () => {
  beforeEach(() => {
    const len = cycleLength();
    // bond i starts at cycle 2i and can only be set up in the 2 cycles before.
    expect(setupBond(1, 100).type).toBe(ClarityType.ResponseOk);
    mineTo(2 * len);
    expect(setupBond(2, 300).type).toBe(ClarityType.ResponseOk);
    mineTo(4 * len);
    expect(setupBond(3, 300).type).toBe(ClarityType.ResponseOk);
    mineTo(6 * len + 1);
  });

  it("orders by descending stx-value-ratio, ties to the lower bond index", () => {
    const order = cvToValue(ro("get-bond-payout-order", [Cl.uint(6)]));
    expect(order.map((b: any) => Number(b.value["bond-index"].value))).toStrictEqual([2, 3, 1]);
  });

  it("only includes bonds active at the cycle's calculation height", () => {
    // cycle 2: only bond 1 is active (bond 2 starts at cycle 4)
    const order = cvToValue(ro("get-bond-payout-order", [Cl.uint(2)]));
    expect(order.map((b: any) => Number(b.value["bond-index"].value))).toStrictEqual([1]);
    // cycle 1: bond 1 has not started
    expect(ro("get-bond-payout-order", [Cl.uint(1)])).toStrictEqual(Cl.list([]));
  });

  it("simulated waterfall pays bonds in contract order (zero-share bonds are trivially full)", () => {
    const sim = cvToValue(ro("simulate-waterfall", [Cl.uint(1000), Cl.uint(6)]));
    expect(sim.bonds.value.map((b: any) => Number(b.value["bond-index"].value))).toStrictEqual([2, 3, 1]);
    expect(sim["reserve-deposit-sats"].value).toBe("150");
    expect(sim["stx-only-sats"].value).toBe("850");
  });

  it("setup-bond is admin-only (pox-5 err u1), so ordering cannot be spoofed", () => {
    const r = simnet.callPublicFn(
      POX5,
      "setup-bond",
      [Cl.uint(9), Cl.uint(1), Cl.uint(1), Cl.uint(1), Cl.bufferFromHex("51"), Cl.list([])],
      wallet1,
    ).result;
    expect(r).toBeErr(Cl.uint(1));
  });
});
