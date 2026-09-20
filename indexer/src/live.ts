// Per-poll reads: Hiro v3 staking cycles, pox5-reader (mainnet) and direct pox-5 state.
import { Cl, type ClarityValue } from "@stacks/transactions";
import { config } from "./config.js";
import { hiro, callRead } from "./hiro.js";
import { pool } from "./db.js";

const P = config.pox5;

export async function syncCycles(currentCycle: number) {
  const known = await pool.query("SELECT cycle FROM cycles WHERE status = 'finished'");
  const finished = new Set(known.rows.map((r) => r.cycle));
  for (let c = config.firstPox5Cycle; c <= currentCycle + 1; c++) {
    if (finished.has(c)) continue;
    const raw = await hiro<any>(`/extended/v3/staking/cycles/${c}`);
    await pool.query(
      `INSERT INTO cycles (cycle, status, raw, fetched_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (cycle) DO UPDATE SET status = $2, raw = $3, fetched_at = now()`,
      [c, raw.status, JSON.stringify(raw)],
    );
  }
}

/**
 * pox5-reader reads, exactly what the contract returns.
 *
 * Best-effort per call. Hiro's /v2/contracts/call-read allows 500,000 of read length and every
 * contract-call? into pox-5 loads that contract (~569k), so the reader functions that read pox-5
 * are refused by the public endpoint. Those come back null with the reason in `errors`, and the
 * figure stays on its mirrored source instead of the whole poll failing. The same functions are
 * checked against live mainnet state by contracts/scripts/verify-at-tip.mjs.
 */
export async function readReader(cycle: number) {
  const R = config.readerContract;
  if (!R) return null;
  const u = Cl.uint;
  const errors: Record<string, string> = {};
  const call = async (fn: string, args: ClarityValue[] = []) => {
    try {
      return await callRead(R, fn, args);
    } catch (e) {
      errors[fn] = (e as Error).message.slice(0, 200);
      return null;
    }
  };
  const out: Record<string, unknown> = { contract: R };
  out["get-current-cycle"] = await call("get-current-cycle");
  out[`get-coverage-for-cycle(u${cycle})`] = await call("get-coverage-for-cycle", [u(cycle)]);
  out[`get-coverage-for-cycle(u${cycle - 1})`] = await call("get-coverage-for-cycle", [u(cycle - 1)]);
  out[`get-obligation-per-interval(u${cycle})`] = await call("get-obligation-per-interval", [u(cycle)]);
  out[`get-reserve-cover-cycles(u${cycle})`] = await call("get-reserve-cover-cycles", [u(cycle)]);
  out[`get-bond-payout-order(u${cycle})`] = await call("get-bond-payout-order", [u(cycle)]);
  out["get-reserve"] = await call("get-reserve");
  out["get-pending-pool"] = await call("get-pending-pool");
  out["get-coverage-summary"] = await call("get-coverage-summary");
  if (Object.keys(errors).length > 0) out.errors = errors;
  return out;
}

/** Direct pox-5 reads, kept for cross-checks and for the period before the reader is deployed. */
export async function readPox5() {
  return {
    "current-pox-reward-cycle": await callRead(P, "current-pox-reward-cycle"),
    "current-distribution-cycle": await callRead(P, "current-distribution-cycle"),
    "get-reserve-balance": await callRead(P, "get-reserve-balance"),
    "get-last-reward-compute-height": await callRead(P, "get-last-reward-compute-height"),
    "get-total-sbtc-staked": await callRead(P, "get-total-sbtc-staked"),
    "get-last-accounted-rewards-only": await callRead(P, "get-last-accounted-rewards-only"),
    "sbtc-token::get-balance(pox-5)": await callRead(config.sbtcToken, "get-balance", [Cl.principal(P)]),
  };
}

export async function takeLiveSnapshot() {
  const info = await hiro<any>("/v2/info");
  const pox5 = await readPox5();
  const cycle = Number(pox5["current-pox-reward-cycle"]);
  const reader = await readReader(cycle);
  await pool.query(
    `INSERT INTO live_snapshots (burn_height, stacks_height, current_cycle, reader, pox5) VALUES ($1,$2,$3,$4,$5)`,
    [info.burn_block_height, info.stacks_tip_height, cycle, reader ? JSON.stringify(reader) : null, JSON.stringify(pox5)],
  );
  return { cycle, burnHeight: info.burn_block_height as number };
}
