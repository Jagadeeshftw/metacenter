import { initSimnet } from "@stacks/clarinet-sdk";
import { Cl, cvToString } from "@stacks/transactions";
const t0 = Date.now();
const simnet = await initSimnet("./Clarinet.toml");
console.log("init ms", Date.now() - t0, "epoch", simnet.currentEpoch, "burn", simnet.burnBlockHeight, "stacks", simnet.blockHeight);
const w = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const POX = "ST000000000000000000002AMW42H.pox-5";
for (const [fn, args] of [["current-pox-reward-cycle", []], ["get-total-sbtc-staked", []], ["get-protocol-bond", [Cl.uint(1)]], ["get-total-sbtc-staked-for-bond", [Cl.uint(1)]], ["get-first-pox-5-reward-cycle", []]]) {
  const t = Date.now();
  try { console.log(fn, cvToString(simnet.callReadOnlyFn(POX, fn, args, w).result), Date.now() - t, "ms"); } catch (e) { console.log(fn, "ERR", String(e).slice(0, 400)); }
}
try { console.log("reader bond-sp", cvToString(simnet.callReadOnlyFn("reader", "bond-sp", [Cl.uint(1)], w).result)); } catch (e) { console.log("reader ERR", String(e).slice(0, 400)); }
try { console.log("reader total-sbtc", cvToString(simnet.callReadOnlyFn("reader", "total-sbtc", [], w).result)); } catch (e) { console.log("reader ERR", String(e).slice(0, 400)); }
process.exit(0);
