// Call a public function with uint / principal arguments.
//   node scripts/call.mjs <mainnet|testnet> <key-file> <contract-name> <function> [u123 | SP...principal]...
import fs from "node:fs";
import { makeContractCall, broadcastTransaction, Cl, PostConditionMode } from "@stacks/transactions";

const [network, keyFile, contractName, functionName, ...raw] = process.argv.slice(2);
const key = JSON.parse(fs.readFileSync(keyFile, "utf8"));
const functionArgs = raw.map((a) => (/^u\d+$/.test(a) ? Cl.uint(a.slice(1)) : Cl.principal(a)));
const tx = await makeContractCall({
  contractAddress: key.address,
  contractName,
  functionName,
  functionArgs,
  senderKey: key.privateKey,
  network,
  postConditionMode: PostConditionMode.Deny,
});
console.log(await broadcastTransaction({ transaction: tx, network }));
