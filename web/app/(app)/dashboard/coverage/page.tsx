import { getCurrent, getIntervals } from "@/lib/api";
import { pct, sats, satsExact, times } from "@/lib/format";
import { headline } from "@/lib/view";
import { PageHeader, Panel, Stat, Unavailable } from "@/components/dash/ui";
import { CoverageChart, PoolChart } from "@/components/dash/charts";
import { ProvenanceTag } from "@/components/shared/provenance";

export const revalidate = 60;
export const metadata = { title: "Coverage" };

export default async function CoveragePage() {
  const [cur, iv] = await Promise.all([getCurrent(), getIntervals()]);
  const intervals = iv?.intervals ?? [];
  const h = headline(cur, intervals.at(-1) ?? null);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Coverage"
        lead="Coverage is the reward pool of a distribution interval divided by what bonds are owed for it (shares × target rate ÷ 10000 ÷ 50). Below 1.0× bonds are short-paid and STX-only stakers and the reserve get nothing."
      />
      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Coverage" value={times(h.coverage.value)} provenance={h.coverage.provenance} source={h.coverage.source} />
        <Stat label="Headroom" value={pct(h.headroom.value)} detail="pool can fall this far before bond yield is impaired" provenance={h.headroom.provenance} source={h.headroom.source} />
        <Stat label="Owed to bonds per interval" value={h.obligation.value === null ? "—" : sats(h.obligation.value)} provenance={h.obligation.provenance} source={h.obligation.source} />
      </section>
      {intervals.length === 0 ? (
        <Unavailable what="Distribution history" />
      ) : (
        <>
          <Panel title="Coverage per distribution" provenance="mirrored" source="Reference lines: 1.0× is where bond yield is impaired; 2.0× is the coverage target cited in the Bitcoin Staking SIP discussion (forum.stacks.org/t/18862).">
            <CoverageChart intervals={intervals} height={320} />
          </Panel>
          <Panel title="Pool vs bond obligation" provenance="mirrored">
            <PoolChart intervals={intervals} height={320} />
          </Panel>
          <Panel title="Every distribution" provenance="mirrored" source="Each row is one calculate-rewards transaction, independently recomputed from pox-5 state before and after its block.">
            <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-subtle">
                    <th className="py-2 font-medium">Distribution</th>
                    <th className="font-medium">Cycle</th>
                    <th className="text-right font-medium">Pool</th>
                    <th className="text-right font-medium">Owed</th>
                    <th className="text-right font-medium">Coverage</th>
                    <th className="text-right font-medium">Shortfall</th>
                    <th className="text-right font-medium">Cross-check</th>
                  </tr>
                </thead>
                <tbody>
                  {intervals
                    .slice()
                    .reverse()
                    .map((i) => (
                      <tr key={i.distribution_index} className="border-t border-line">
                        <td className="num py-3">
                          <a href={`https://explorer.hiro.so/txid/${i.txid}?chain=mainnet`} className="underline-offset-4 hover:underline">
                            {i.distribution_index}
                          </a>
                        </td>
                        <td className="num">{i.cycle}</td>
                        <td className="num text-right">{satsExact(i.gross_pool.value)}</td>
                        <td className="num text-right">{satsExact(i.obligation.value)}</td>
                        <td className="num text-right">{i.coverage.value === null ? "n/a (no bonds)" : times(i.coverage.value)}</td>
                        <td className="num text-right">{satsExact(i.shortfall.value)}</td>
                        <td className="text-right text-xs">{i.crosscheck.ok ? "match" : "mismatch"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <ProvenanceTag kind="mirrored" />
          </Panel>
        </>
      )}
    </div>
  );
}
