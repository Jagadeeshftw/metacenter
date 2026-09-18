import { describe, it, expect } from "vitest";
import { Cl, cvToValue } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

const feed = Cl.contractPrincipal(deployer, "risk-feed");
const reader = Cl.contractPrincipal(deployer, "pox5-reader");

const inputs = (gross: number, target: number) => {
  const paid = Math.min(gross, target);
  const remainder = gross - paid;
  const reserve = Math.floor((remainder * 1500) / 10000);
  return Cl.tuple({
    "stx-cycle": Cl.uint(143),
    "calculation-height": Cl.uint(967399),
    "source-txid": Cl.bufferFromHex("00".repeat(32)),
    "gross-pool-sats": Cl.uint(gross),
    "bond-target-sats": Cl.uint(target),
    "bond-paid-sats": Cl.uint(paid),
    "stx-only-sats": Cl.uint(remainder - reserve),
    "reserve-deposit-sats": Cl.uint(reserve),
    "reserve-balance-sats": Cl.uint(152669889),
    "stx-shares-ustx": Cl.uint(438005558960464n),
    "price-sats-per-stx-e6": Cl.uint(339000000),
    "price-source": Cl.stringAscii("test"),
    "price-timestamp": Cl.uint(0),
  });
};

const post = (index: number, gross: number, target: number) =>
  simnet.callPublicFn("risk-feed", "post-snapshot", [Cl.uint(index), inputs(gross, target)], deployer);

const check = (f = feed) => simnet.callPublicFn("coverage-guard", "check", [f], wallet1).result;

describe("coverage-guard (example consumer)", () => {
  it("passes feed errors through (u104 no data)", () => {
    expect(check()).toBeErr(Cl.uint(104));
  });

  it("rejects an untrusted feed (u200), even a valid trait implementer", () => {
    expect(check(reader)).toBeErr(Cl.uint(200));
  });

  it("ok at healthy coverage", () => {
    post(286, 230327835, 13810222);
    const v = cvToValue(check()).value;
    expect(v.status.value).toBe("ok");
    expect(v.provenance.value).toBe("mirrored");
    expect(v.stale.value).toBe(false);
  });

  it("paused below 2.0x coverage", () => {
    post(287, 20000000, 13810222); // 1.448x
    expect(cvToValue(check()).value.status.value).toBe("paused");
  });

  it("exactly 2.0x is ok", () => {
    post(288, 20000000, 10000000);
    expect(cvToValue(check()).value.status.value).toBe("ok");
  });

  it("ok when there are no bonds to cover (coverage n/a)", () => {
    post(289, 20000000, 0);
    const v = cvToValue(check()).value;
    expect(v["coverage-bps"].value).toBeNull();
    expect(v.status.value).toBe("ok");
  });

  it("max age is owner-settable (u201 otherwise) and drives staleness", () => {
    expect(simnet.callPublicFn("coverage-guard", "set-max-age-blocks", [Cl.uint(10)], wallet1).result).toBeErr(Cl.uint(201));
    expect(simnet.callPublicFn("coverage-guard", "set-max-age-blocks", [Cl.uint(10)], deployer).result).toBeOk(Cl.bool(true));
    expect(simnet.callReadOnlyFn("coverage-guard", "get-max-age-blocks", [], wallet1).result).toBeUint(10);
    post(291, 230327835, 13810222);
    simnet.mineEmptyBurnBlocks(11);
    expect(cvToValue(check()).value.stale.value).toBe(true);
  });

  it("paused when the feed is stale", () => {
    post(290, 230327835, 13810222);
    simnet.mineEmptyBurnBlocks(2101);
    const v = cvToValue(check()).value;
    expect(v.stale.value).toBe(true);
    expect(v.status.value).toBe("paused");
  });
});
