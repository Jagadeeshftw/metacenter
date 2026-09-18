// Publish finished mainnet distributions to the testnet risk-feed (mirrored).
import {
  Cl,
  makeContractCall,
  broadcastTransaction,
  fetchNonce,
  getAddressFromPrivateKey,
  PostConditionMode,
} from "@stacks/transactions";
import { config } from "./config.js";
import { hiro, callRead } from "./hiro.js";
import { pool } from "./db.js";

const [feedAddress, feedName] = config.feedContract.split(".");

async function refreshStatuses() {
  const r = await pool.query("SELECT distribution_index, published_txid FROM intervals WHERE published_status = 'pending'");
  for (const row of r.rows) {
    const tx = await hiro<any>(`/extended/v1/tx/${row.published_txid}`, { network: "testnet", allow404: true });
    if (!tx || tx.tx_status === "pending") continue;
    await pool.query("UPDATE intervals SET published_status = $2 WHERE distribution_index = $1", [
      row.distribution_index,
      tx.tx_status === "success" ? "confirmed" : `failed:${tx.tx_status}:${tx.tx_result?.repr ?? ""}`,
    ]);
  }
}

export async function publishPending(log = console.log) {
  if (!config.publisherKey) return;
  await refreshStatuses();
  const r = await pool.query(
    `SELECT * FROM intervals
     WHERE published_txid IS NULL AND price_sats_per_stx IS NOT NULL
     ORDER BY distribution_index`,
  );
  if (r.rows.length === 0) return;
  const address = getAddressFromPrivateKey(config.publisherKey, "testnet");
  let nonce = await fetchNonce({ address, network: "testnet" });

  for (const row of r.rows) {
    // never double-post: the feed refuses overwrites (u102), check first
    const existing = await callRead(config.feedContract, "get-snapshot", [Cl.uint(row.distribution_index)], { network: "testnet" });
    if (existing) {
      await pool.query(
        "UPDATE intervals SET published_txid = 'already-on-chain', published_status = 'confirmed' WHERE distribution_index = $1",
        [row.distribution_index],
      );
      continue;
    }
    const inputs = Cl.tuple({
      "stx-cycle": Cl.uint(row.stx_cycle),
      "calculation-height": Cl.uint(row.calculation_height),
      "source-txid": Cl.bufferFromHex(row.txid.replace(/^0x/, "")),
      "gross-pool-sats": Cl.uint(row.gross_pool_sats),
      "bond-target-sats": Cl.uint(row.bond_target_sats),
      "bond-paid-sats": Cl.uint(row.bond_paid_sats),
      "stx-only-sats": Cl.uint(row.stx_only_sats),
      "reserve-deposit-sats": Cl.uint(row.reserve_deposit_sats),
      "reserve-balance-sats": Cl.uint(row.reserve_balance_sats),
      "stx-shares-ustx": Cl.uint(row.stx_shares_ustx),
      "price-sats-per-stx-e6": Cl.uint(BigInt(Math.round(Number(row.price_sats_per_stx) * 1e6))),
      "price-source": Cl.stringAscii(row.price_source.slice(0, 32)),
      "price-timestamp": Cl.uint(row.price_timestamp),
    });
    const tx = await makeContractCall({
      contractAddress: feedAddress,
      contractName: feedName,
      functionName: "post-snapshot",
      functionArgs: [Cl.uint(row.distribution_index), inputs],
      senderKey: config.publisherKey,
      network: "testnet",
      nonce,
      postConditionMode: PostConditionMode.Deny,
    });
    const res: any = await broadcastTransaction({ transaction: tx, network: "testnet" });
    if (!res.txid || res.error) {
      log(`publish ${row.distribution_index} failed: ${JSON.stringify(res)}`);
      break;
    }
    const txid = "0x" + res.txid.replace(/^0x/, "");
    await pool.query(
      "UPDATE intervals SET published_txid = $2, published_status = 'pending', published_at = now() WHERE distribution_index = $1",
      [row.distribution_index, txid],
    );
    log(`published distribution ${row.distribution_index} to ${config.feedContract}: ${txid}`);
    nonce += 1n;
  }
}
