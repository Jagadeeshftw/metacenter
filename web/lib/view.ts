// Picks the figures the UI shows, preferring onchain values and falling back to the
// latest mirrored distribution (with its own label) when pox5-reader is unavailable.
import type { Current, Field, Interval, Provenance } from "./api";

export type Shown = { value: number | null; provenance: Provenance; source: string; note?: string };

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function pick(primary: Field<unknown> | undefined, fallback?: Shown): Shown {
  if (primary && primary.value !== null && primary.value !== undefined)
    return { value: n(primary.value), provenance: primary.provenance, source: primary.source, note: primary.note };
  if (fallback) return fallback;
  return { value: null, provenance: primary?.provenance ?? "onchain", source: primary?.source ?? "", note: primary?.note };
}

export function headline(cur: Current | null, last: Interval | null) {
  const li = last;
  const mirrored = (f: Field<unknown> | undefined, value?: number | null): Shown | undefined =>
    f ? { value: value ?? n(f.value), provenance: "mirrored", source: f.source, note: f.note } : undefined;

  const owed = li ? Number(li.obligation.value) : null;
  const reserve = li ? Number(li.reserve_balance.value) : null;
  return {
    coverage: pick(cur?.coverage, mirrored(li?.coverage)),
    headroom: pick(cur?.headroom, mirrored(li?.headroom)),
    obligation: pick(cur?.obligation_per_interval, mirrored(li?.obligation)),
    reserve: pick(cur?.reserve, mirrored(li?.reserve_balance)),
    cover: pick(
      cur?.reserve_cover,
      li && owed
        ? { value: Math.floor(((reserve ?? 0) * 100) / (2 * owed)) / 100, provenance: "mirrored", source: "reserve-balance ÷ (2 × obligation), distribution " + li.distribution_index }
        : undefined,
    ),
    pending: pick(cur?.pending_pool),
    apy: li ? { value: n(li.stx_only_apy_btc.value), provenance: "mirrored" as Provenance, source: li.stx_only_apy_btc.source } : null,
    cycle: pick(cur?.cycle, li ? { value: li.cycle, provenance: "mirrored", source: "calculate-rewards stx-cycle" } : undefined),
  };
}
