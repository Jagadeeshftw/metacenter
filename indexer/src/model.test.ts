import { describe, it, expect } from "vitest";
import { waterfall, payoutOrder, targetPerInterval, stressedPool, cliffSatsPerStx, friedgerCliff, hypotheticalBook } from "./model.js";

const bond1 = { bondIndex: 1, stxValueRatio: 310237n, targetRate: 300n, shares: 23017037628n };
const STX_SHARES = 438005558960464n;

describe("model mirrors pox-5", () => {
  it("target per interval (L2266)", () => {
    expect(targetPerInterval(bond1.shares, 300n)).toBe(13810222n);
  });

  it("reproduces mainnet distribution 286 exactly", () => {
    const w = waterfall(230327835n, [bond1], STX_SHARES);
    expect(w.bonds[0].paid).toBe(13810222n);
    expect(w.reserveDeposit).toBe(32477641n);
    expect(w.stxOnly).toBe(184039972n);
    expect(w.coverageBps).toBe(166780n);
    expect(w.headroomBps).toBe(9400n);
    expect(w.shortfall).toBe(0n);
  });

  it("shortfall: bonds take the whole pool, reserve deposit zero", () => {
    const w = waterfall(10_000_000n, [bond1], STX_SHARES);
    expect(w.bonds[0].status).toBe("partial");
    expect(w.shortfall).toBe(3810222n);
    expect(w.reserveDeposit).toBe(0n);
    expect(w.stxOnly).toBe(0n);
  });

  it("orders bonds by descending stx-value-ratio, ties to the lower index", () => {
    const order = payoutOrder([
      { bondIndex: 1, stxValueRatio: 100n },
      { bondIndex: 3, stxValueRatio: 300n },
      { bondIndex: 2, stxValueRatio: 300n },
    ]);
    expect(order.map((b) => b.bondIndex)).toEqual([2, 3, 1]);
  });

  it("later bonds go unpaid first", () => {
    const book = hypotheticalBook(3000, 6, 300n, 310237n);
    const w = waterfall(100_000_000n, book, STX_SHARES); // 1 BTC vs 1.8 BTC obligation
    expect(w.bonds.map((b) => b.status)).toEqual(["full", "full", "full", "partial", "none", "none"]);
  });

  it("no STX-only shares: remainder goes to the reserve", () => {
    const w = waterfall(1000n, [], 0n);
    expect(w.reserveDeposit).toBe(1000n);
    expect(w.stxOnly).toBe(0n);
    expect(w.coverageBps).toBeNull();
  });

  it("stress and cliff arithmetic", () => {
    expect(stressedPool(1000n, 0.5, 0.5)).toBe(250n);
    expect(cliffSatsPerStx(339, 230327835n, 13810222n)).toBeCloseTo(20.326, 3);
    // 3,000 BTC SIP launch book at distribution 286: its price (315.011644) and its pool
    expect(cliffSatsPerStx(315.011644, 230327835n, 180000000n)).toBeCloseTo(246.18, 2);
    expect(friedgerCliff()).toBeCloseTo(171.23, 2);
  });
});
