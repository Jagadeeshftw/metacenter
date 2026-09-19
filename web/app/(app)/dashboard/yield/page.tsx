import { getCurrent, getIntervals } from "@/lib/api";
import { pct, satsPerStx } from "@/lib/format";
import { headline } from "@/lib/view";
import { PageHeader, Panel, Stat, Unavailable } from "@/components/dash/ui";
import { YieldChart } from "@/components/dash/charts";
import { ProvenanceTag } from "@/components/shared/provenance";

export const revalidate = 60;
export const metadata = { title: "STX-only yield", alternates: { canonical: "/dashboard/yield" }, openGraph: { url: "/dashboard/yield" } };

export default async function YieldPage() {
  const [cur, iv] = await Promise.all([getCurrent(), getIntervals()]);
  const intervals = iv?.intervals ?? [];
  const last = intervals.at(-1) ?? null;
  const h = headline(cur, last);
  const c = cur?.cliff;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="STX-only yield"
        lead="STX-only stakers get 85% of what remains after bonds and the reserve cut. Realised yield is sats earned per STX staked in each distribution; the APY converts it to BTC terms at the STX/BTC price of that distribution."
      />
      <section className="grid gap-4 md:grid-cols-3">
        <Stat
          label="Realised APY (BTC terms)"
          value={pct(last?.stx_only_apy_btc.value ?? null, 2)}
          detail={last ? `distribution ${last.distribution_index}, priced at ${satsPerStx(last.price.value, 2)}` : undefined}
          provenance="mirrored"
          source={last?.stx_only_apy_btc.source}
        />
        <Stat
          label="Per STX staked"
          value={last?.stx_only_yield.value == null ? "—" : `${last.stx_only_yield.value.toFixed(4)} sats`}
          detail="sats per STX in that distribution"
          provenance="mirrored"
          source={last?.stx_only_yield.source}
        />
        <Stat label="Headroom to the zero-yield cliff" value={pct(h.headroom.value)} detail="pool can fall this far before STX-only yield is zero" provenance={h.headroom.provenance} source={h.headroom.source} />
      </section>
      {intervals.length === 0 ? (
        <Unavailable what="Yield history" />
      ) : (
        <Panel title="Realised APY per distribution" provenance="mirrored" source="(total-stx-staker-rewards ÷ cycle-staked-ustx × 1e6) × 50 ÷ price at the distribution (CoinGecko hourly; Coinbase fallback)">
          <YieldChart intervals={intervals} height={300} />
        </Panel>
      )}
      <Panel title="Distance to the zero-yield cliff">
        <div className="grid gap-6 md:grid-cols-3">
          <CliffItem
            label="Cliff price today"
            value={satsPerStx(c?.price.value ?? null)}
            provenance="mirrored"
            note={`current price ${satsPerStx(cur?.price.value ?? null, 2)} × obligation ÷ pool. ${c?.price.note ?? ""}`}
          />
          <CliffItem
            label="With the SIP's 3,000 BTC launch book"
            value={c?.sip_book_scenario.value == null ? "n/a" : `≈ ${c.sip_book_scenario.value.toFixed(1)} sats/STX`}
            provenance="hypothetical"
            note="3,000 BTC at 3% owes 180,000,000 sats per interval, against today's pool."
          />
          <CliffItem
            label="friedger's figure, SIP inputs"
            value={satsPerStx(c?.friedger_sip_inputs.value ?? null)}
            provenance="hypothetical"
            note="3,000 BTC × 3% ÷ (1,000 STX/block × 52,560 blocks/year). See the Methodology page."
          />
        </div>
        <p className="text-xs text-subtle">
          Price-denominated cliffs assume miner BTC bids scale with the STX price. Observed pool per sat/STX of price ranged
          0.58M–0.89M sats across distributions 282–286, so treat them as indicative.
        </p>
      </Panel>
    </div>
  );
}

function CliffItem({ label, value, provenance, note }: { label: string; value: string; provenance: "mirrored" | "hypothetical"; note: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2 text-sm text-muted">
        <span>{label}</span>
        <ProvenanceTag kind={provenance} className="shrink-0" />
      </div>
      <span className="num text-2xl font-medium">{value}</span>
      <span className="text-xs text-muted">{note}</span>
    </div>
  );
}
