// Per-poll reads: Hiro v3 staking cycles, pox5-reader (mainnet) and direct pox-5 state.
import { Cl } from "@stacks/transactions";
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

/** pox5-reader reads, exactly what the contract returns. */
export async function readReader(cycle: number) {
  const R = config.readerContract;
  if (!R) return null;
  const u = Cl.uint;
  return {
    contract: R,
    "get-current-cycle": await callRead(R, "get-current-cycle"),
    [`get-coverage-for-cycle(u${cycle})`]: await callRead(R, "get-coverage-for-cycle", [u(cycle)]),
    [`get-coverage-for-cycle(u${cycle - 1})`]: await callRead(R, "get-coverage-for-cycle", [u(cycle - 1)]),
    [`get-obligation-per-interval(u${cycle})`]: await callRead(R, "get-obligation-per-interval", [u(cycle)]),
    [`get-reserve-cover-cycles(u${cycle})`]: await callRead(R, "get-reserve-cover-cycles", [u(cycle)]),
    [`get-bond-payout-order(u${cycle})`]: await callRead(R, "get-bond-payout-order", [u(cycle)]),
    "get-reserve": await callRead(R, "get-reserve"),
    "get-pending-pool": await callRead(R, "get-pending-pool"),
    "get-coverage-summary": await callRead(R, "get-coverage-summary"),
  };
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
