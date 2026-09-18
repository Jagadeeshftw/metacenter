import { describe, it, expect } from "vitest";
import { Cl, cvToString } from "@stacks/transactions";
import fs from "node:fs";
const log = (...a: any[]) => fs.appendFileSync("out.log", a.map(x => typeof x === "string" ? x : JSON.stringify(x, (_k, v) => typeof v === "bigint" ? v.toString() : v)).join(" ") + "\n");

const accounts = simnet.getAccounts();
const w1 = accounts.get("wallet_1")!;
const ro = (fn: string, args: any[] = []) => {
  const r = simnet.callReadOnlyFn("reader", fn, args, w1);
  return cvToString(r.result);
};

describe("pox-5 reads in simnet", () => {
  it("reads", () => {
    log("epoch", simnet.currentEpoch, "burn", simnet.burnBlockHeight, "stacks", simnet.blockHeight);
    for (const f of ["cycle", "total-sbtc", "pox-info"]) log(f, ro(f));
    log("bond-sp u1", ro("bond-sp", [Cl.uint(1)]));
    log("membership", ro("membership", [Cl.principal(w1)]));
    log("staker", ro("staker", [Cl.principal(w1)]));
    // direct call to boot contract
    const d = simnet.callReadOnlyFn("SP000000000000000000002Q6VF78.pox-5", "get-first-pox-5-reward-cycle", [], w1);
    log("direct first-pox-5-cycle", cvToString(d.result));
    const deployed = [...simnet.getContractsInterfaces().keys()].filter(k => k.includes("pox"));
    log("pox contracts", deployed);
    expect(true).toBe(true);
  });
});
