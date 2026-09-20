// Keeper for the two permissionless mainnet calls, run from the poll loop.
//
//   pox5-reader::snapshot       once per distribution index: records that interval's pox-5
//                               rewards-per-token, shares and reserve on-chain.
//   coverage-cache::refresh     stores pox5-reader's own answers so the public Hiro API can read
//                               them (its read-only endpoint refuses calls that read pox-5).
//
// Both are permissionless and take no arguments, so the keeper can only choose when a reading is
// taken, never what it says. It uses its own key, not the deployer's, and it holds only enough
// STX for fees. Nothing here can move funds: neither contract transfers anything.
import {
  makeContractCall,
  broadcastTransaction,
  fetchNonce,
  getAddressFromPrivateKey,
  Cl,
  PostConditionMode,
} from "@stacks/transactions";
import { config } from "./config.js";
import { hiro, callRead } from "./hiro.js";
import { pool } from "./db.js";

// A refresh is due when the figures can have changed: a new distribution was computed, the cycle
// rolled over, or the stored reading is this old. pox-5 computes twice a cycle, about weekly.
const STALE_BURN_BLOCKS = Number(process.env.KEEPER_STALE_BURN_BLOCKS ?? 1100);

type Pending = { kind: string; txid: string };

const getState = async (): Promise<{ pending?: Pending }> => {
  const r = await pool.query("SELECT v FROM kv WHERE k = 'keeper'");
  return r.rows[0]?.v ?? {};
};
const setState = (v: unknown) =>
  pool.query("INSERT INTO kv (k, v, updated_at) VALUES ('keeper', $1, now()) ON CONFLICT (k) DO UPDATE SET v = $1, updated_at = now()", [
    JSON.stringify(v),
  ]);

/** Run at most one keeper transaction per poll, and never while one is pending. */
export async function runKeeper(log = console.log) {
  const { keeperKey, readerContract, cacheContract } = config;
  if (!keeperKey || !readerContract || !cacheContract) return;

  const state = await getState();
  if (state.pending) {
    const tx = await hiro<any>(`/extended/v1/tx/${state.pending.txid}`, { allow404: true });
    if (!tx || tx.tx_status === "pending") return; // still in the mempool: wait
    log(`keeper: ${state.pending.kind} ${state.pending.txid} ${tx.tx_status}`);
    await setState({ ...state, pending: undefined, last: { ...state.pending, status: tx.tx_status, at: new Date().toISOString() } });
    if (tx.tx_status !== "success") return; // don't retry a failing call every poll
  }

  const address = getAddressFromPrivateKey(keeperKey, "mainnet");
  const balance = BigInt((await hiro<any>(`/extended/v1/address/${address}/stx`)).balance ?? "0");
  if (balance < config.keeperMinBalanceUstx) {
    log(`keeper: ${address} has ${balance} uSTX, below KEEPER_MIN_BALANCE_USTX; skipping`);
    return;
  }

  const due = await whatIsDue();
  if (!due) return;

  const [contractAddress, contractName] = due.contract.split(".");
  const tx = await makeContractCall({
    contractAddress,
    contractName,
    functionName: due.fn,
    functionArgs: [],
    senderKey: keeperKey,
    network: "mainnet",
    fee: config.keeperFeeUstx,
    nonce: await fetchNonce({ address, network: "mainnet" }),
    postConditionMode: PostConditionMode.Deny,
  });
  const res: any = await broadcastTransaction({ transaction: tx, network: "mainnet" });
  if (!res.txid || res.error) {
    log(`keeper: broadcast ${due.fn} failed: ${JSON.stringify(res)}`);
    return;
  }
  const txid = `0x${res.txid.replace(/^0x/, "")}`;
  log(`keeper: ${due.fn} broadcast ${txid} (${due.why}, fee ${config.keeperFeeUstx})`);
  await setState({ ...(await getState()), pending: { kind: due.fn, txid, why: due.why } });
}

/** The first of the two calls that is due, or null. */
async function whatIsDue(): Promise<{ contract: string; fn: string; why: string } | null> {
  const reader = config.readerContract!;
  const cache = config.cacheContract!;
  const index = Number(await callRead(config.pox5, "current-distribution-cycle"));

  const snapshot = await callRead(reader, "get-snapshot", [Cl.uint(index)]);
  if (snapshot === null) return { contract: reader, fn: "snapshot", why: `no snapshot for distribution ${index}` };

  const extras = await callRead(cache, "get-extras");
  if (extras === null) return { contract: cache, fn: "refresh", why: "cache is empty" };

  const cycle = Number(await callRead(config.pox5, "current-pox-reward-cycle"));
  const lastCalc = Number(await callRead(config.pox5, "get-last-reward-compute-height"));
  const burnHeight = Number((await hiro<any>("/v2/info")).burn_block_height);
  const reasons = [
    Number(extras.cycle) !== cycle && `cycle ${extras.cycle} -> ${cycle}`,
    Number(extras["last-compute-height"]) !== lastCalc && `a distribution was computed at ${lastCalc}`,
    burnHeight - Number(extras["updated-at"]) >= STALE_BURN_BLOCKS &&
      `reading is ${burnHeight - Number(extras["updated-at"])} burn blocks old`,
  ].filter(Boolean) as string[];
  if (reasons.length > 0) return { contract: cache, fn: "refresh", why: reasons.join("; ") };
  return null;
}
