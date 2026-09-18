import { it } from "vitest";
import fs from "node:fs";
import { Cl, cvToString } from "@stacks/transactions";
const log = (...a: any[]) => fs.appendFileSync("out2.log", a.join(" ") + "\n");
const w1 = simnet.getAccounts().get("wallet_1")!;
const POX = "SP000000000000000000002Q6VF78.pox-5";
const ADMIN = "SP72DMR3MJKS7RVBY33JVV7EEJSQ1PYDVKDP10FX";
it("setup bond as admin in simnet", () => {
  const h = simnet.callReadOnlyFn(POX, "bond-period-to-burn-height", [Cl.uint(1)], w1);
  const start = Number((h.result as any).value);
  log("bond1 start burn height", start, "now", simnet.burnBlockHeight);
  const target = start - 1050 * 2 + 1; // inside the setup window (BOND_GAP_CYCLES assumed 2)
  if (simnet.burnBlockHeight < target) simnet.mineEmptyBurnBlocks(Math.max(target - simnet.burnBlockHeight, 1));
  log("now burn", simnet.burnBlockHeight);
  const r = simnet.callPublicFn(POX, "setup-bond", [
    Cl.uint(1), Cl.uint(300), Cl.uint(310237), Cl.uint(500),
    Cl.bufferFromHex("21" + "02".padEnd(66, "a") + "ac"),
    Cl.list([Cl.tuple({ staker: Cl.principal(w1), "max-sats": Cl.uint(100000) })]),
  ], ADMIN);
  log("setup-bond", cvToString(r.result));
  log("reader bond-sp u1", cvToString(simnet.callReadOnlyFn("reader", "bond-sp", [Cl.uint(1)], w1).result));
  log("allowance", cvToString(simnet.callReadOnlyFn(POX, "get-bond-allowance", [Cl.uint(1), Cl.principal(w1)], w1).result));
  const bad = simnet.callPublicFn(POX, "setup-bond", [Cl.uint(2), Cl.uint(1), Cl.uint(1), Cl.uint(1), Cl.bufferFromHex("51"), Cl.list([])], w1);
  log("setup-bond as non-admin", cvToString(bad.result));
});
