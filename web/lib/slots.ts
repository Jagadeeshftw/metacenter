// Build chart slots from API intervals. Every tooltip line keeps its provenance and unit.
import type { Interval } from "./api";
import type { Slot } from "@/components/dash/chart";
import { pct, sats, satsM, satsExact, times, satsPerStx } from "./format";

const src = (i: Interval) => `calculate-rewards tx ${i.txid.slice(0, 10)}…${i.txid.slice(-6)}`;

export function poolSlots(ivs: Interval[]): Slot[] {
  return ivs.map((i) => ({
    key: i.distribution_index,
    label: String(i.distribution_index),
    group: `cycle ${i.cycle}`,
    bar: Number(i.gross_pool.value),
    tick: Number(i.obligation.value) || null,
    tip: [
      { label: "Pool", value: satsExact(i.gross_pool.value), provenance: "mirrored" },
      { label: "Owed to bonds", value: Number(i.obligation.value) ? satsExact(i.obligation.value) : "0 sats (no bonds)", provenance: "mirrored" },
      { label: "Paid to bonds", value: satsExact(i.bond_paid.value), provenance: "mirrored" },
      { label: "Reserve deposit", value: satsExact(i.reserve_deposit.value), provenance: "mirrored" },
    ],
    source: src(i),
  }));
}

export function coverageSlots(ivs: Interval[]): Slot[] {
  return ivs.map((i) => ({
    key: i.distribution_index,
    label: String(i.distribution_index),
    group: `cycle ${i.cycle}`,
    line: i.coverage.value,
    na: i.coverage.value === null ? "no bonds" : undefined,
    tip: [
      { label: "Coverage", value: i.coverage.value === null ? "n/a (no bonds)" : times(i.coverage.value), provenance: "mirrored" },
      { label: "Headroom", value: pct(i.headroom.value), provenance: "mirrored" },
      { label: "Pool", value: satsM(i.gross_pool.value), provenance: "mirrored" },
      { label: "Owed", value: satsM(i.obligation.value), provenance: "mirrored" },
    ],
    source: src(i),
  }));
}

export function yieldSlots(ivs: Interval[]): Slot[] {
  return ivs.map((i) => ({
    key: i.distribution_index,
    label: String(i.distribution_index),
    group: `cycle ${i.cycle}`,
    line: i.stx_only_apy_btc.value === null ? null : i.stx_only_apy_btc.value * 100,
    tip: [
      { label: "APY (BTC terms)", value: pct(i.stx_only_apy_btc.value, 2), provenance: "mirrored" },
      { label: "Per STX", value: `${(i.stx_only_yield.value ?? 0).toFixed(4)} sats`, provenance: "mirrored" },
      { label: "STX-only total", value: satsM(i.stx_only.value), provenance: "mirrored" },
      { label: "Price", value: satsPerStx(i.price.value), provenance: "mirrored" },
    ],
    source: `${src(i)} · price ${i.price.source}`,
  }));
}

export function reserveSlots(ivs: Interval[]): Slot[] {
  return ivs.map((i) => ({
    key: i.distribution_index,
    label: String(i.distribution_index),
    group: `cycle ${i.cycle}`,
    bar: Number(i.reserve_balance.value),
    tip: [
      { label: "Balance after", value: sats(i.reserve_balance.value), provenance: "mirrored" },
      { label: "Deposit", value: satsExact(i.reserve_deposit.value), provenance: "mirrored" },
      { label: "Paid out", value: "0 sats (not possible)", provenance: "mirrored" },
    ],
    source: src(i),
  }));
}
