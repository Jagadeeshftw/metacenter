// Build chart slots from API intervals. Every tooltip line keeps its provenance and unit.
import type { Interval } from "./api";
import type { Slot } from "@/components/dash/chart";
import { pct, times, satsPerStx } from "./format";
import { formatAmount, type Unit } from "@/components/shared/units";

const src = (i: Interval) => `calculate-rewards tx ${i.txid.slice(0, 10)}…${i.txid.slice(-6)}`;

export function poolSlots(ivs: Interval[], unit: Unit = "sats"): Slot[] {
  return ivs.map((i) => ({
    key: i.distribution_index,
    label: String(i.distribution_index),
    group: `cycle ${i.cycle}`,
    bar: Number(i.gross_pool.value),
    tick: Number(i.obligation.value) || null,
    tip: [
      { label: "Pool", value: formatAmount(i.gross_pool.value, unit, true), provenance: "mirrored" },
      { label: "Owed to bonds", value: Number(i.obligation.value) ? formatAmount(i.obligation.value, unit, true) : unit === "btc" ? "0 BTC (no bonds)" : "0 sats (no bonds)", provenance: "mirrored" },
      { label: "Paid to bonds", value: formatAmount(i.bond_paid.value, unit, true), provenance: "mirrored" },
      { label: "Reserve deposit", value: formatAmount(i.reserve_deposit.value, unit, true), provenance: "mirrored" },
    ],
    source: src(i),
  }));
}

export function coverageSlots(ivs: Interval[], unit: Unit = "sats"): Slot[] {
  return ivs.map((i) => ({
    key: i.distribution_index,
    label: String(i.distribution_index),
    group: `cycle ${i.cycle}`,
    line: i.coverage.value,
    na: i.coverage.value === null ? "no bonds" : undefined,
    tip: [
      { label: "Coverage", value: i.coverage.value === null ? "n/a (no bonds)" : times(i.coverage.value), provenance: "mirrored" },
      { label: "Headroom", value: pct(i.headroom.value), provenance: "mirrored" },
      { label: "Pool", value: formatAmount(i.gross_pool.value, unit), provenance: "mirrored" },
      { label: "Owed", value: formatAmount(i.obligation.value, unit), provenance: "mirrored" },
    ],
    source: src(i),
  }));
}

export function yieldSlots(ivs: Interval[], unit: Unit = "sats"): Slot[] {
  return ivs.map((i) => ({
    key: i.distribution_index,
    label: String(i.distribution_index),
    group: `cycle ${i.cycle}`,
    line: i.stx_only_apy_btc.value === null ? null : i.stx_only_apy_btc.value * 100,
    tip: [
      { label: "APY (BTC terms)", value: pct(i.stx_only_apy_btc.value, 2), provenance: "mirrored" },
      { label: "Per STX", value: `${(i.stx_only_yield.value ?? 0).toFixed(4)} sats`, provenance: "mirrored" },
      { label: "STX-only total", value: formatAmount(i.stx_only.value, unit), provenance: "mirrored" },
      { label: "Price", value: satsPerStx(i.price.value), provenance: "mirrored" },
    ],
    source: `${src(i)} · price ${i.price.source}`,
  }));
}

export function reserveSlots(ivs: Interval[], unit: Unit = "sats"): Slot[] {
  return ivs.map((i) => ({
    key: i.distribution_index,
    label: String(i.distribution_index),
    group: `cycle ${i.cycle}`,
    bar: Number(i.reserve_balance.value),
    tip: [
      { label: "Balance after", value: formatAmount(i.reserve_balance.value, unit), provenance: "mirrored" },
      { label: "Deposit", value: formatAmount(i.reserve_deposit.value, unit, true), provenance: "mirrored" },
      { label: "Paid out", value: "0 sats (not possible)", provenance: "mirrored" },
    ],
    source: src(i),
  }));
}
