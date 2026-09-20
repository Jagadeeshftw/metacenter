// Deploy Metacenter contracts with a key file kept outside the repo.
//
//   node scripts/deploy.mjs <mainnet|testnet> <key-file> [--fee <uSTX>] <contract> [<contract> ...]
//
// Key file: JSON { address, privateKey } (see ~/.metacenter/). Contracts are
// deployed in the given order as Clarity 6, each waiting for confirmation.
// Contracts that already exist at the deployer address are skipped.
//
// --fee sets the fee in uSTX for every deploy in the run. Without it the node's
// own estimate is used, which for a large contract can come back at hundreds of
// STX when the fee percentiles are skewed by a few expensive transactions; check
// /v2/fees/transaction and pass a fee above its low tier instead.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeContractDeploy,
  broadcastTransaction,
  fetchNonce,
  ClarityVersion,
  PostConditionMode,
} from "@stacks/transactions";

const argv = process.argv.slice(2);
const fi = argv.indexOf("--fee");
const fee = fi >= 0 ? BigInt(argv.splice(fi, 2)[1]) : undefined;
const [network, keyFile, ...contracts] = argv;
if (!["mainnet", "testnet"].includes(network) || !keyFile || contracts.length === 0) {
  console.error("usage: node scripts/deploy.mjs <mainnet|testnet> <key-file> <contract>...");
  process.exit(1);
}
const api = network === "mainnet" ? "https://api.hiro.so" : "https://api.testnet.hiro.so";
const key = JSON.parse(fs.readFileSync(keyFile, "utf8"));
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exists(name) {
  const r = await fetch(`${api}/v2/contracts/interface/${key.address}/${name}`);
  return r.ok;
}

async function waitFor(txid) {
  for (;;) {
    const r = await fetch(`${api}/extended/v1/tx/${txid}`);
    if (r.ok) {
      const tx = await r.json();
      if (tx.tx_status === "success") return tx;
      if (tx.tx_status !== "pending") throw new Error(`${txid}: ${tx.tx_status} ${JSON.stringify(tx.tx_result)}`);
    }
    await sleep(15_000);
  }
}

for (const name of contracts) {
  if (await exists(name)) {
    console.log(`${key.address}.${name} already deployed, skipping`);
    continue;
  }
  const codeBody = fs.readFileSync(path.join(root, "contracts", `${name}.clar`), "utf8");
  const nonce = await fetchNonce({ address: key.address, network });
  const tx = await makeContractDeploy({
    contractName: name,
    codeBody,
    senderKey: key.privateKey,
    network,
    nonce,
    ...(fee === undefined ? {} : { fee }),
    clarityVersion: ClarityVersion.Clarity6,
    postConditionMode: PostConditionMode.Deny,
  });
  const res = await broadcastTransaction({ transaction: tx, network });
  if (!res.txid || res.error) throw new Error(`broadcast ${name}: ${JSON.stringify(res)}`);
  console.log(`${name}: broadcast 0x${res.txid.replace(/^0x/, "")} (fee ${tx.auth.spendingCondition.fee} uSTX)`);
  const confirmed = await waitFor(`0x${res.txid.replace(/^0x/, "")}`);
  console.log(`${name}: confirmed in block ${confirmed.block_height}`);
}
