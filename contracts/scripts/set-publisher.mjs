// Rotate the risk-feed publisher (owner-only).
//   node scripts/set-publisher.mjs <mainnet|testnet> <owner-key-file> <new-publisher-address>
import fs from "node:fs";
import { makeContractCall, broadcastTransaction, Cl, PostConditionMode } from "@stacks/transactions";

const [network, keyFile, publisher] = process.argv.slice(2);
const key = JSON.parse(fs.readFileSync(keyFile, "utf8"));
const tx = await makeContractCall({
  contractAddress: key.address,
  contractName: "risk-feed",
  functionName: "set-publisher",
  functionArgs: [Cl.principal(publisher)],
  senderKey: key.privateKey,
  network,
  postConditionMode: PostConditionMode.Deny,
});
console.log(await broadcastTransaction({ transaction: tx, network }));
