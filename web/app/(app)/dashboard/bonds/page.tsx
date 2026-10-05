import Link from "next/link";
import { getBondsOrder, getCurrent, getIntervals } from "@/lib/api";
import { btc, satsExact } from "@/lib/format";
import { PageHeader, Panel, Note } from "@/components/dash/ui";
import { Amount } from "@/components/shared/units";
import { PER_INTERVAL } from "@/lib/interval";

export const revalidate = 60;
export const metadata = { title: "Bonds & payout order", alternates: { canonical: "/dashboard/bonds" }, openGraph: { url: "/dashboard/bonds" } };

export default async function BondsPage() {
  const [cur, iv, bo] = await Promise.all([getCurrent(), getIntervals(), getBondsOrder()]);
  const terms = new Map((bo?.order.value ?? []).map((b) => [b.bond_index, b.term]));
  const period = bo?.bonding_period ?? null;
  const order = cur?.payout_order.value ?? null;
  const last = iv?.intervals.at(-1) ?? null;
  const cycle = cur?.cycle.value ?? last?.cycle;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bonds & payout order"
        lead="pox-5 pays bonds first, in descending stx-value-ratio; ties go to the lower bond index (pox-5 L2285–2299). Each bond gets min(target, what is left), so the last bonds in the order absorb a shortfall first. Within a bond, every staked sat earns the same."
      />
      <Note>
        {period?.note ??
          "A bonding period runs 25,200 Bitcoin blocks (about 6 months) and a new one opens every 4,200 blocks (about a month), so at most 6 run at once."}{" "}
        A bond is not open-ended: each one stops earning when its period ends, which is why the live book is a handful of
        overlapping bonds rather than a growing pile.
      </Note>
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
                  <th className="text-right font-medium" title={PER_INTERVAL}>Owed per interval<span className="block font-normal text-subtle">1,050 blocks, ~7.3 days</span></th>
                  <th className="text-right font-medium">Term<span className="block font-normal text-subtle">left of ~6 months</span></th>
                </tr>
              </thead>
              <tbody>
                {order.map((b, i) => (
                  <tr key={b.bond_index} className="border-t border-line">
                    <td className="num py-3">{i + 1}</td>
                    <td>#{b.bond_index}{b.bond_index === 1 ? " Genesis Bond" : ""}</td>
                    <td className="num text-right">{Number(b.stx_value_ratio).toLocaleString("en-US")}</td>
                    <td className="num text-right">{(Number(b.target_rate_bps) / 100).toFixed(2)}%</td>
                    <td className="num text-right"><Amount sats={b.shares_sats} digits={2} /></td>
                    <td className="num text-right"><Amount sats={b.target_per_interval_sats} exact /></td>
                    <td className="num text-right">
                      {(() => {
                        const t = terms.get(b.bond_index);
                        if (!t) return "—";
                        const days = (n: number) => Math.round((n * 10) / 1440);
                        return (
                          <span title={`bonding period ${t.period_start_burn_height.toLocaleString("en-US")} → unlock ${t.l1_unlock_burn_height.toLocaleString("en-US")}`}>
                            {t.remaining_blocks.toLocaleString("en-US")} blocks
                            <span className="block text-xs font-normal text-subtle">
                              ~{days(t.remaining_blocks)} days left of {days(t.term_blocks)}
                              {t.remaining_intervals === null ? "" : `, ${t.remaining_intervals} intervals`}
                            </span>
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : last ? (
          <p className="text-sm text-muted">
            The live order comes from pox5-reader::get-bond-payout-order, which is unavailable right now. The latest
            distribution ({last.distribution_index}) paid bond #1 (Genesis Bond) <Amount sats={last.bond_paid.value} exact /> against a
            target of <Amount sats={last.obligation.value} exact />.
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
        <Note>
          The reserve is designed as a back-stop for bonds. In this iteration it can&apos;t be drawn automatically: using it
          goes through a SIP process, and automatic responses are anticipated for PoX-6.
        </Note>
        <Link href="/dashboard/stress" className="text-sm text-brand underline underline-offset-4">
          Open the stress test
        </Link>
      </Panel>
    </div>
  );
}
