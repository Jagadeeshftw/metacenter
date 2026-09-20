// Call a public function with uint / principal arguments.
//   node scripts/call.mjs <mainnet|testnet> <key-file> [--fee <uSTX>] <contract-name> <function> [u123 | SP...principal]...
//
// --fee sets the fee in uSTX. Pass it for a contract the node has no fee history for: estimation
// answers NoEstimateAvailable, and for calls that read pox-5 the percentile estimate can come
// back at tens of STX.
import fs from "node:fs";
import { makeContractCall, broadcastTransaction, Cl, PostConditionMode } from "@stacks/transactions";

const argv = process.argv.slice(2);
const fi = argv.indexOf("--fee");
const fee = fi >= 0 ? BigInt(argv.splice(fi, 2)[1]) : undefined;
const [network, keyFile, contractName, functionName, ...raw] = argv;
const key = JSON.parse(fs.readFileSync(keyFile, "utf8"));
const functionArgs = raw.map((a) => (/^u\d+$/.test(a) ? Cl.uint(a.slice(1)) : Cl.principal(a)));
const tx = await makeContractCall({
  contractAddress: key.address,
  contractName,
  functionName,
  functionArgs,
  senderKey: key.privateKey,
  network,
  ...(fee === undefined ? {} : { fee }),
  postConditionMode: PostConditionMode.Deny,
});
const res = await broadcastTransaction({ transaction: tx, network });
console.log(JSON.stringify({ ...res, fee: tx.auth.spendingCondition.fee.toString() }));
