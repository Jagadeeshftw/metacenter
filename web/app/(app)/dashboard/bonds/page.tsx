import Link from "next/link";
import { getCurrent, getIntervals } from "@/lib/api";
import { btc, satsExact } from "@/lib/format";
import { PageHeader, Panel, Note } from "@/components/dash/ui";

export const revalidate = 60;
export const metadata = { title: "Bonds & payout order", alternates: { canonical: "/dashboard/bonds" }, openGraph: { url: "/dashboard/bonds" } };

export default async function BondsPage() {
  const [cur, iv] = await Promise.all([getCurrent(), getIntervals()]);
  const order = cur?.payout_order.value ?? null;
  const last = iv?.intervals.at(-1) ?? null;
  const cycle = cur?.cycle.value ?? last?.cycle;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bonds & payout order"
        lead="pox-5 pays bonds first, in descending stx-value-ratio; ties go to the lower bond index (pox-5 L2285–2299). Each bond gets min(target, what is left), so the last bonds in the order absorb a shortfall first. Within a bond, every staked sat earns the same."
      />
      <Panel
        title={`Payout order${cycle ? `, cycle ${cycle}` : ""}`}
        provenance={order ? "onchain" : "mirrored"}
        source={order ? cur?.payout_order.source : last ? `bond-distribution events, calculate-rewards tx ${last.txid}` : undefined}
      >
        {order ? (
          <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-subtle">
                  <th className="py-2 font-medium">Order</th>
                  <th className="font-medium">Bond</th>
                  <th className="text-right font-medium">stx-value-ratio</th>
                  <th className="text-right font-medium">Target rate</th>
                  <th className="text-right font-medium">Staked</th>
                  <th className="text-right font-medium">Owed per interval</th>
                </tr>
              </thead>
              <tbody>
                {order.map((b, i) => (
                  <tr key={b.bond_index} className="border-t border-line">
                    <td className="num py-3">{i + 1}</td>
                    <td>#{b.bond_index}{b.bond_index === 1 ? " Genesis Bond" : ""}</td>
                    <td className="num text-right">{Number(b.stx_value_ratio).toLocaleString("en-US")}</td>
                    <td className="num text-right">{(Number(b.target_rate_bps) / 100).toFixed(2)}%</td>
                    <td className="num text-right">{btc(b.shares_sats, 2)}</td>
                    <td className="num text-right">{satsExact(b.target_per_interval_sats)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : last ? (
          <p className="text-sm text-muted">
            The live order comes from pox5-reader::get-bond-payout-order once it is deployed on mainnet. The latest
            distribution ({last.distribution_index}) paid bond #1 (Genesis Bond) {satsExact(last.bond_paid.value)} against a
            target of {satsExact(last.obligation.value)}.
          </p>
        ) : (
          <p className="text-sm text-muted">No data yet.</p>
        )}
      </Panel>
      <Panel title="What a shortfall looks like" provenance="hypothetical" dashed>
        <p className="text-sm text-muted">
          With one bond active, a shortfall simply short-pays it. With several, pox-5 fills them in order until the pool
          runs out. The stress test shows both: the current book, and a hypothetical multi-bond book with the SIP&apos;s
          3,000 BTC launch size.
        </p>
        <Note>The reserve does not step in: pox-5 cannot pay bonds from it without a SIP.</Note>
        <Link href="/dashboard/stress" className="text-sm text-brand underline underline-offset-4">
          Open the stress test
        </Link>
      </Panel>
    </div>
  );
}
