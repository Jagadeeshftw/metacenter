// Discover and record pox-5 distributions (calculate-rewards calls) on mainnet.
//
// Discovery does not use the deprecated contract-events endpoint. For each
// distribution index k the calculation height is fixed by pox-5:
//   h_k = first_burn + (k + 1) * (cycle_length / 2) - 1
// We binary-search Stacks heights for the first block whose state has
// last-reward-compute-height >= h_k (call-read ?tip=), take the calculate-rewards
// tx from that block, and read its exact print events from the tx detail.
// Every distribution is then recomputed independently from state before/after
// that block (reserve delta, rewards-per-token deltas) as a cross-check.
import { Cl } from "@stacks/transactions";
import { deserializeCV } from "@stacks/transactions";
import { config } from "./config.js";
import { hiro, callRead, indexHashAt } from "./hiro.js";
import { toPlain } from "./clarity.js";
import { pool } from "./db.js";
import { priceAt } from "./price.js";

const P = config.pox5;
const PRECISION = 10n ** 18n;

export type PoxParams = { firstBurn: number; cycleLength: number; interval: number };

export async function poxParams(): Promise<PoxParams> {
  const r = await hiro<any>("/v2/pox");
  return {
    firstBurn: r.first_burnchain_block_height,
    cycleLength: r.reward_cycle_length,
    interval: r.reward_cycle_length / 2,
  };
}

export const calcHeightOf = (p: PoxParams, k: number) => p.firstBurn + (k + 1) * p.interval - 1;
export const distIndexOf = (p: PoxParams, h: number) => Math.floor((h - p.firstBurn) / p.interval);
export const cycleOf = (p: PoxParams, h: number) => Math.floor((h - p.firstBurn) / p.cycleLength);

const lastCalcAt = async (stacksHeight: number) =>
  Number(await callRead(P, "get-last-reward-compute-height", [], { tip: await indexHashAt(stacksHeight) }));

/** First Stacks block whose post-state has last-reward-compute-height >= h. */
async function locateCalcBlock(h: number, lo: number, hi: number): Promise<number | null> {
  if ((await lastCalcAt(hi)) < h) return null;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await lastCalcAt(mid)) >= h) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

async function findCalcTx(stacksHeight: number): Promise<string> {
  for (let offset = 0; ; offset += 50) {
    const r = await hiro<any>(`/extended/v2/blocks/${stacksHeight}/transactions?limit=50&offset=${offset}`);
    const tx = r.results.find(
      (t: any) =>
        t.tx_type === "contract_call" &&
        t.contract_call?.contract_id === P &&
        t.contract_call?.function_name === "calculate-rewards" &&
        t.tx_status === "success",
    );
    if (tx) return tx.tx_id;
    if (offset + 50 >= r.total) throw new Error(`no calculate-rewards tx in Stacks block ${stacksHeight}`);
  }
}

type BondEvent = { bondIndex: number; target: bigint; paid: bigint; staked: bigint; position: number };

async function readCalcTx(txid: string) {
  const tx = await hiro<any>(`/extended/v1/tx/${txid}?event_limit=50`);
  const prints = tx.events
    .filter((e: any) => e.event_type === "smart_contract_log" && e.contract_log.contract_id === P)
    .map((e: any) => toPlain(deserializeCV(e.contract_log.value.hex)));
  const calc = prints.find((p: any) => p.topic === "calculate-rewards");
  if (!calc) throw new Error(`${txid}: no calculate-rewards print`);
  const bonds: BondEvent[] = prints
    .filter((p: any) => p.topic === "bond-distribution")
    .map((p: any, i: number) => ({
      bondIndex: Number(p["bond-index"]),
      target: BigInt(p["target-yield"]),
      paid: BigInt(p["bond-rewards"]),
      staked: BigInt(p["bond-staked-sats"]),
      position: i,
    }));
  return { tx, calc, bonds };
}

/** Recompute a distribution from state before/after its block. */
async function recomputeFromTips(stacksHeight: number, cycle: number, bondIndexes: number[]) {
  const before = await indexHashAt(stacksHeight - 1);
  const after = await indexHashAt(stacksHeight);
  const read = (fn: string, args: any[], tip: string) => callRead(P, fn, args, { tip }).then((v) => BigInt(v));
  const reserveDelta =
    (await read("get-reserve-balance", [], after)) - (await read("get-reserve-balance", [], before));
  const stxShares = await read("get-total-shares-staked-for-cycle", [Cl.uint(cycle), Cl.none()], after);
  const stxRptDelta =
    (await read("get-rewards-per-token-for-cycle", [Cl.uint(cycle), Cl.none()], after)) -
    (await read("get-rewards-per-token-for-cycle", [Cl.uint(cycle), Cl.none()], before));
  const stxOnly = (stxRptDelta * stxShares) / PRECISION;
  let bondPaid = 0n;
  for (const i of bondIndexes) {
    const shares = await read("get-total-shares-staked-for-cycle", [Cl.uint(cycle), Cl.some(Cl.uint(i))], after);
    const d =
      (await read("get-rewards-per-token-for-cycle", [Cl.uint(cycle), Cl.some(Cl.uint(i))], after)) -
      (await read("get-rewards-per-token-for-cycle", [Cl.uint(cycle), Cl.some(Cl.uint(i))], before));
    bondPaid += (d * shares) / PRECISION;
  }
  return { before, after, reserveDelta, stxOnly, bondPaid, gross: reserveDelta + stxOnly + bondPaid };
}

async function knownIndexes(): Promise<Set<number>> {
  const r = await pool.query("SELECT distribution_index FROM intervals");
  return new Set(r.rows.map((x) => x.distribution_index));
}

/** Record every distribution from the first PoX-5 cycle up to the chain tip. */
export async function syncDistributions(log = console.log) {
  const p = await poxParams();
  const tip = await hiro<any>("/extended/v2/blocks?limit=1");
  const tipHeight: number = tip.results[0].height;
  const lastCalc = Number(await callRead(P, "get-last-reward-compute-height"));
  if (lastCalc === 0) return;
  const firstIndex = (config.firstPox5Cycle * p.cycleLength) / p.interval; // first interval of cycle 141
  const lastIndex = distIndexOf(p, lastCalc);
  const known = await knownIndexes();

  // search lower bound: block of the latest recorded distribution, or pox-5 activation
  const prev = await pool.query("SELECT max(stacks_block_height) AS h FROM intervals");
  let lo: number = Number(prev.rows[0].h ?? 8665568);

  for (let k = firstIndex; k <= lastIndex; k++) {
    if (known.has(k)) continue;
    const h = calcHeightOf(p, k);
    const block = await locateCalcBlock(h, lo, tipHeight);
    if (block === null) break;
    const txid = await findCalcTx(block);
    const { tx, calc, bonds } = await readCalcTx(txid);
    const calcHeight = Number(calc["calculation-height"]);
    if (calcHeight !== h) {
      // pox-5 skipped this interval: the next call covers both; record under its own index
      log(`distribution ${k} skipped on-chain (next calculation-height ${calcHeight})`);
      lo = block;
      continue;
    }
    const cycle = Number(calc["stx-cycle"]);
    const bondTarget = bonds.reduce((s, b) => s + b.target, 0n);
    const recomputed = await recomputeFromTips(block, cycle, bonds.map((b) => b.bondIndex));

    const gross = BigInt(calc["gross-accrued-rewards"]);
    const reserveDeposit = BigInt(calc["reserve-deposit"]);
    const diffs = {
      gross: recomputed.gross - gross,
      reserve: recomputed.reserveDelta - reserveDeposit,
      stx: recomputed.stxOnly - BigInt(calc["total-stx-staker-rewards"]),
      bonds: recomputed.bondPaid - BigInt(calc["total-bond-rewards"]),
    };
    // truncation: at most 1 sat low per rewards-per-token product
    const tolerance = BigInt(1 + bonds.length);
    const ok = recomputed.reserveDelta === reserveDeposit && Object.values(diffs).every((d) => d <= 0n && -d <= tolerance);
    const price = await priceAt(tx.burn_block_time);

    await pool.query(
      `INSERT INTO intervals (distribution_index, stx_cycle, calculation_height, txid, stacks_block_height,
         burn_block_height, burn_block_time, gross_pool_sats, bond_target_sats, bond_paid_sats, stx_only_sats,
         reserve_deposit_sats, reserve_balance_sats, stx_shares_ustx, cumulative_rpt_stx, raw_event,
         tip_before, tip_after, tip_gross_pool_sats, tip_reserve_deposit_sats, tip_stx_only_sats, tip_bond_paid_sats,
         crosscheck_ok, crosscheck_note, price_sats_per_stx, price_source, price_timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
       ON CONFLICT (distribution_index) DO NOTHING`,
      [
        k, cycle, calcHeight, txid, block, tx.burn_block_height, tx.burn_block_time,
        calc["gross-accrued-rewards"], bondTarget.toString(), calc["total-bond-rewards"],
        calc["total-stx-staker-rewards"], calc["reserve-deposit"], calc["reserve-balance"],
        calc["cycle-staked-ustx"], calc["cumulative-rewards-per-ustx"], JSON.stringify({ calc, bonds: bonds.map((b) => ({ ...b, target: b.target.toString(), paid: b.paid.toString(), staked: b.staked.toString() })) }),
        recomputed.before, recomputed.after, recomputed.gross.toString(), recomputed.reserveDelta.toString(),
        recomputed.stxOnly.toString(), recomputed.bondPaid.toString(),
        ok, `diff vs event (sats): gross ${diffs.gross}, reserve ${diffs.reserve}, stx ${diffs.stx}, bonds ${diffs.bonds}`,
        price?.satsPerStx ?? null, price?.source ?? null, price?.timestamp ?? null,
      ],
    );
    for (const b of bonds) {
      await pool.query(
        `INSERT INTO interval_bonds (distribution_index, bond_index, target_yield_sats, bond_rewards_sats, bond_staked_sats, payout_position)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [k, b.bondIndex, b.target.toString(), b.paid.toString(), b.staked.toString(), b.position],
      );
    }
    log(`distribution ${k} (cycle ${cycle}, h ${calcHeight}) block ${block} tx ${txid} gross ${gross} crosscheck ${ok ? "ok" : "MISMATCH"} ${JSON.stringify(diffs, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);
    lo = block;
  }
}
