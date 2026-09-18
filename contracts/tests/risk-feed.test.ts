import { describe, it, expect } from "vitest";
import { Cl, ClarityType, cvToValue } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

// Mainnet distribution 286 (cycle 143, calculation-height 967,399), from the
// calculate-rewards event in tx 0x4a0218d7...cc5d. Price is illustrative.
const interval286 = {
  "stx-cycle": Cl.uint(143),
  "calculation-height": Cl.uint(967399),
  "source-txid": Cl.bufferFromHex("4a0218d7b13de29ae47015e72345876d362c47159216675d40d03cd09ad1cc5d"),
  "gross-pool-sats": Cl.uint(230327835),
  "bond-target-sats": Cl.uint(13810222),
  "bond-paid-sats": Cl.uint(13810222),
  "stx-only-sats": Cl.uint(184039972),
  "reserve-deposit-sats": Cl.uint(32477641),
  "reserve-balance-sats": Cl.uint(152669889),
  "stx-shares-ustx": Cl.uint(438005558960464n),
  "price-sats-per-stx-e6": Cl.uint(339000000),
  "price-source": Cl.stringAscii("coingecko:blockstack/btc"),
  "price-timestamp": Cl.uint(1789776000),
};

const post = (index: number, inputs: Record<string, any>, sender = deployer) =>
  simnet.callPublicFn("risk-feed", "post-snapshot", [Cl.uint(index), Cl.tuple(inputs)], sender);

const ro = (fn: string, args: any[] = []) =>
  simnet.callReadOnlyFn("risk-feed", fn, args, wallet1).result;

describe("risk-feed: roles", () => {
  it("deployer is owner and initial publisher", () => {
    expect(ro("get-owner")).toBePrincipal(deployer);
    expect(ro("get-publisher")).toBePrincipal(deployer);
  });

  it("owner rotates the publisher; old publisher loses write access", () => {
    const r = simnet.callPublicFn("risk-feed", "set-publisher", [Cl.principal(wallet1)], deployer);
    expect(r.result).toBeOk(Cl.bool(true));
    expect(r.events[0].event).toBe("print_event");
    expect(ro("get-publisher")).toBePrincipal(wallet1);
    expect(post(286, interval286, deployer).result).toBeErr(Cl.uint(101));
    expect(post(286, interval286, wallet1).result).toBeOk(Cl.uint(286));
  });

  it("non-owner cannot rotate the publisher (u100)", () => {
    const r = simnet.callPublicFn("risk-feed", "set-publisher", [Cl.principal(wallet2)], wallet2);
    expect(r.result).toBeErr(Cl.uint(100));
  });

  it("ownership can be transferred, and only by the owner (u100)", () => {
    expect(simnet.callPublicFn("risk-feed", "set-owner", [Cl.principal(wallet2)], wallet1).result).toBeErr(Cl.uint(100));
    expect(simnet.callPublicFn("risk-feed", "set-owner", [Cl.principal(wallet2)], deployer).result).toBeOk(Cl.bool(true));
    expect(ro("get-owner")).toBePrincipal(wallet2);
    expect(simnet.callPublicFn("risk-feed", "set-publisher", [Cl.principal(wallet2)], deployer).result).toBeErr(Cl.uint(100));
  });
});

describe("risk-feed: posting", () => {
  it("non-publisher cannot post (u101)", () => {
    expect(post(286, interval286, wallet2).result).toBeErr(Cl.uint(101));
  });

  it("stores raw inputs and derives metrics on-chain", () => {
    const r = post(286, interval286);
    expect(r.result).toBeOk(Cl.uint(286));
    expect(r.events.some((e) => e.event === "print_event")).toBe(true);
    const s = cvToValue(ro("get-snapshot", [Cl.uint(286)])).value;
    // 230,327,835 / 13,810,222 = 16.678x
    expect(s["coverage-bps"].value.value).toBe("166780");
    // 1 - 13,810,222 / 230,327,835 = 94.00%
    expect(s["headroom-bps"].value.value).toBe("9400");
    expect(s["shortfall-sats"].value).toBe("0");
    // 152,669,889 / (2 * 13,810,222) = 5.527 cycles
    expect(s["reserve-cover-cycles-x100"].value.value).toBe("552");
    // 339 sats/STX * 13,810,222 / 230,327,835 = 20.326 sats/STX
    expect(s["cliff-sats-per-stx-e6"].value.value).toBe("20326094");
    // 184,039,972 sats over 438,005,558.96 STX = 0.42018 sats/STX this interval
    expect(s["stx-yield-sats-per-stx-e9"].value.value).toBe("420177251");
    expect(s["posted-at"].value).toBe(String(simnet.burnBlockHeight));
    expect(ro("get-latest-index")).toBeSome(Cl.uint(286));
  });

  it("refuses to overwrite an index (u102)", () => {
    expect(post(286, interval286).result).toBeOk(Cl.uint(286));
    expect(post(286, interval286).result).toBeErr(Cl.uint(102));
  });

  it("rejects inputs that do not add up (u103)", () => {
    // paid more than gross
    expect(post(1, { ...interval286, "bond-paid-sats": Cl.uint(230327836) }).result).toBeErr(Cl.uint(103));
    // paid less than target while pool covers it
    expect(post(1, { ...interval286, "bond-paid-sats": Cl.uint(13810221) }).result).toBeErr(Cl.uint(103));
    // reserve deposit not 15% of the remainder
    expect(post(1, { ...interval286, "reserve-deposit-sats": Cl.uint(32477642) }).result).toBeErr(Cl.uint(103));
    // parts do not sum to gross
    expect(post(1, { ...interval286, "stx-only-sats": Cl.uint(184039971) }).result).toBeErr(Cl.uint(103));
  });

  it("records a shortfall in contract terms: bonds take the whole pool, reserve deposit is zero", () => {
    const r = post(300, {
      ...interval286,
      "gross-pool-sats": Cl.uint(10000000),
      "bond-target-sats": Cl.uint(13810222),
      "bond-paid-sats": Cl.uint(10000000),
      "stx-only-sats": Cl.uint(0),
      "reserve-deposit-sats": Cl.uint(0),
    });
    expect(r.result).toBeOk(Cl.uint(300));
    const s = cvToValue(ro("get-snapshot", [Cl.uint(300)])).value;
    expect(s["shortfall-sats"].value).toBe("3810222");
    expect(s["headroom-bps"].value.value).toBe("0");
    expect(s["coverage-bps"].value.value).toBe("7241");
  });

  it("interval with no bonds: coverage, headroom, cover and cliff are n/a", () => {
    const r = post(284, {
      ...interval286,
      "stx-cycle": Cl.uint(142),
      "gross-pool-sats": Cl.uint(217098316),
      "bond-target-sats": Cl.uint(0),
      "bond-paid-sats": Cl.uint(0),
      "stx-only-sats": Cl.uint(184533569),
      "reserve-deposit-sats": Cl.uint(32564747),
    });
    expect(r.result).toBeOk(Cl.uint(284));
    const s = cvToValue(ro("get-snapshot", [Cl.uint(284)])).value;
    expect(s["coverage-bps"].value).toBeNull();
    expect(s["headroom-bps"].value).toBeNull();
    expect(s["reserve-cover-cycles-x100"].value).toBeNull();
    expect(s["cliff-sats-per-stx-e6"].value).toBeNull();
  });

  it("no STX-only shares: the whole remainder must go to the reserve", () => {
    const base = {
      ...interval286,
      "stx-shares-ustx": Cl.uint(0),
      "stx-only-sats": Cl.uint(0),
    };
    expect(post(2, { ...base, "reserve-deposit-sats": Cl.uint(32477641) }).result).toBeErr(Cl.uint(103));
    expect(post(2, { ...base, "reserve-deposit-sats": Cl.uint(216517613) }).result).toBeOk(Cl.uint(2));
  });

  it("latest index only moves forward (backfill keeps the newest as latest)", () => {
    post(286, interval286);
    post(284, {
      ...interval286,
      "gross-pool-sats": Cl.uint(217098316),
      "bond-target-sats": Cl.uint(0),
      "bond-paid-sats": Cl.uint(0),
      "stx-only-sats": Cl.uint(184533569),
      "reserve-deposit-sats": Cl.uint(32564747),
    });
    expect(ro("get-latest-index")).toBeSome(Cl.uint(286));
  });
});

describe("risk-feed: trait getter", () => {
  it("errors with u104 before any data", () => {
    expect(ro("get-coverage-summary")).toBeErr(Cl.uint(104));
    expect(ro("get-latest-snapshot")).toBeNone();
  });

  it("returns the latest interval with provenance mirrored", () => {
    post(286, interval286);
    const r = ro("get-coverage-summary");
    expect(r.type).toBe(ClarityType.ResponseOk);
    const v = cvToValue(r).value;
    expect(v.period.value).toBe("286");
    expect(v["period-kind"].value).toBe("interval");
    expect(v.provenance.value).toBe("mirrored");
    expect(v["coverage-bps"].value.value).toBe("166780");
  });
});
