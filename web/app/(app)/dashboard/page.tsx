import Link from "next/link";
import { getCurrent, getIntervals } from "@/lib/api";
import { btc, pct, sats, times } from "@/lib/format";
import { headline } from "@/lib/view";
import { PageHeader, Panel, Stat, Note, Unavailable } from "@/components/dash/ui";
import { CoverageChart, PoolChart, YieldChart } from "@/components/dash/charts";
import { ProvenanceLegend } from "@/components/shared/provenance";

export const revalidate = 60;
export const metadata = { title: "Overview", alternates: { canonical: "/dashboard" }, openGraph: { url: "/dashboard" } };

export default async function Overview() {
  const [cur, iv] = await Promise.all([getCurrent(), getIntervals()]);
  const intervals = iv?.intervals ?? [];
  const last = intervals.at(-1) ?? null;
  const h = headline(cur, last);
  const order = cur?.payout_order.value ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Bitcoin Staking risk${h.cycle.value ? ` · cycle ${h.cycle.value}` : ""}`}
        lead={
          last
            ? `Latest distribution ${last.distribution_index} (cycle ${last.cycle}, calculation height ${last.calculation_height.toLocaleString("en-US")}). Distributions run once per 1,050 Bitcoin blocks.`
            : undefined
        }
      >
        <ProvenanceLegend />
      </PageHeader>

      <section aria-label="Headline figures" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2">
          <Stat
            big
            label="Headroom before bond yield is impaired"
            value={pct(h.headroom.value)}
            detail="How far the reward pool can fall before bonds are short-paid (1 − 1/coverage)."
            provenance={h.headroom.provenance}
            source={h.headroom.source}
          />
        </div>
        <Stat label="Coverage" value={times(h.coverage.value)} detail="reward pool ÷ what bonds are owed" provenance={h.coverage.provenance} source={h.coverage.source} />
        <Stat
          label="Pending pool (not yet split)"
          value={h.pending.value === null ? "—" : sats(h.pending.value)}
          detail={h.pending.value === null ? "pox5-reader is on mainnet, but this read-only is over Hiro's public read-length cap." : "sBTC received since the last distribution"}
          provenance={h.pending.provenance}
          source={h.pending.source}
        />
      </section>

      {intervals.length === 0 ? (
        <Unavailable what="Distribution history" />
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="Coverage history" provenance="mirrored" source="gross-accrued-rewards ÷ Σ target-yield per calculate-rewards event">
            <CoverageChart intervals={intervals} />
          </Panel>
          <Panel title="Pool vs bond obligation" provenance="mirrored" source="calculate-rewards + bond-distribution events, cross-checked against pox-5 state">
            <PoolChart intervals={intervals} />
          </Panel>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Bond payout order" provenance={order ? "onchain" : "mirrored"} source={cur?.payout_order.source}>
          {order && order.length > 0 ? (
            <ol className="flex flex-col gap-2 text-sm">
              {order.map((b, i) => (
                <li key={b.bond_index} className="flex items-center justify-between gap-3 border-t border-line pt-2">
                  <span>
                    <span className="num text-muted">{i + 1}.</span> Bond #{b.bond_index}
                  </span>
                  <span className="num text-muted">ratio {Number(b.stx_value_ratio).toLocaleString("en-US")}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">
              {last && Number(last.obligation.value) > 0
                ? `Distribution ${last.distribution_index} paid bond #1 (Genesis Bond) its full target. Live order needs pox5-reader on mainnet.`
                : "No active bonds."}
            </p>
          )}
          <Link href="/dashboard/bonds" className="mt-auto text-sm text-brand underline underline-offset-4">
            Payout order details
          </Link>
        </Panel>
        <Panel title="Reserve" provenance={h.reserve.provenance} source={h.reserve.source}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="num text-3xl font-medium">{btc(h.reserve.value)}</span>
            <span className="rounded-full border border-line px-3 py-1 text-sm">{last && Number(last.reserve_deposit.value) > 0 ? "Not drawing" : "Flat"}</span>
          </div>
          <Note>
            Hypothetical cover: {h.cover.value === null ? "n/a" : `${h.cover.value.toFixed(2)} cycles`} — reserve cannot currently pay out (requires SIP).
          </Note>
          <Link href="/dashboard/reserve" className="mt-auto text-sm text-brand underline underline-offset-4">
            Reserve details
          </Link>
        </Panel>
        <Panel title="STX-only realised yield" provenance="mirrored" source={last?.stx_only_apy_btc.source}>
          <span className="num text-3xl font-medium">{pct(last?.stx_only_apy_btc.value ?? null, 2)}</span>
          <span className="text-sm text-muted">
            annualised in BTC terms, distribution {last?.distribution_index ?? "—"}, at the STX/BTC price of that distribution
          </span>
          {intervals.length > 0 && <YieldChart intervals={intervals} height={180} />}
        </Panel>
      </section>

      <Panel title="Stress test" provenance="hypothetical" dashed>
        <p className="text-sm text-muted">
          Cut miner BTC commits or the STX price, or swap in a larger bond book, and see which bonds pox-5 would pay in
          full, in part or not at all.
        </p>
        <Link href="/dashboard/stress" className="text-sm text-brand underline underline-offset-4">
          Open the stress test
        </Link>
      </Panel>
    </div>
  );
}
