"use client";
import type { Interval } from "@/lib/api";
import { coverageSlots, poolSlots, reserveSlots, yieldSlots } from "@/lib/slots";
import { IntervalChart } from "./chart";

const m = (v: number) => (v === 0 ? "0" : `${(v / 1e6).toFixed(0)}M`);

export function PoolChart({ intervals, height }: { intervals: Interval[]; height?: number }) {
  return (
    <IntervalChart
      slots={poolSlots(intervals)}
      height={height}
      yFormat={(v) => (v === 0 ? "0" : `${m(v)} sats`)}
      ariaLabel="Gross reward pool per distribution, with the amount owed to bonds"
      legend={[
        { label: "Pool (gross accrued, sats)", swatch: "bar" },
        { label: "Owed to bonds (sats)", swatch: "tick" },
      ]}
    />
  );
}

export function CoverageChart({ intervals, height }: { intervals: Interval[]; height?: number }) {
  const vals = intervals.map((i) => i.coverage.value ?? 0);
  const top = Math.max(20, Math.ceil((Math.max(...vals, 0) * 1.15) / 5) * 5);
  return (
    <IntervalChart
      slots={coverageSlots(intervals)}
      height={height}
      yMax={top}
      yFormat={(v) => `${v.toFixed(0)}×`}
      refs={[
        { value: 2, label: "2.0× SIP target", short: "2.0×", dashed: true },
        { value: 1, label: "1.0× impaired", short: "1.0×" },
      ]}
      pointLabel={(v) => `${v.toFixed(2)}×`}
      ariaLabel="Coverage per distribution, with the 1.0× impairment line and the 2.0× target"
      legend={[
        { label: "Coverage (×)", swatch: "dot", color: "var(--series-pool)" },
        { label: "n/a: no bonds", swatch: "hatch" },
        { label: "2.0× coverage target (Bitcoin Staking SIP discussion)", swatch: "line" },
        { label: "1.0× bond yield impaired", swatch: "line", dash: "2 4" },
      ]}
    />
  );
}

export function YieldChart({ intervals, height }: { intervals: Interval[]; height?: number }) {
  return (
    <IntervalChart
      slots={yieldSlots(intervals)}
      height={height}
      yMax={Math.max(10, Math.ceil(Math.max(...intervals.map((i) => (i.stx_only_apy_btc.value ?? 0) * 100)) / 5) * 5)}
      yFormat={(v) => `${v.toFixed(0)}%`}
      lineColor="var(--series-yield)"
      pointLabel={(v) => `${v.toFixed(2)}%`}
      ariaLabel="STX-only realised yield per distribution, annualised in BTC terms"
      legend={[{ label: "STX-only APY, BTC terms (%)", swatch: "dot", color: "var(--series-yield)" }]}
    />
  );
}

export function ReserveChart({ intervals, height }: { intervals: Interval[]; height?: number }) {
  return (
    <IntervalChart
      slots={reserveSlots(intervals)}
      height={height}
      yFormat={(v) => (v === 0 ? "0" : `${(v / 1e8).toFixed(2)} BTC`)}
      barColor="var(--series-pool)"
      ariaLabel="Reserve balance after each distribution"
      legend={[{ label: "Reserve balance after distribution (BTC)", swatch: "bar" }]}
    />
  );
}
