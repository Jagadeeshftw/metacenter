import { getCurrent, getIntervals } from "@/lib/api";
import { btc, satsExact } from "@/lib/format";
import { headline } from "@/lib/view";
import { PageHeader, Panel, Stat, Note, Unavailable } from "@/components/dash/ui";
import { ReserveChart } from "@/components/dash/charts";

export const revalidate = 60;
export const metadata = { title: "Reserve" };

export default async function ReservePage() {
  const [cur, iv] = await Promise.all([getCurrent(), getIntervals()]);
  const intervals = iv?.intervals ?? [];
  const last = intervals.at(-1) ?? null;
  const h = headline(cur, last);
  const drawing = last ? Number(last.reserve_deposit.value) > 0 : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reserve"
        lead="After bonds are paid, 15% of what remains goes to the reserve. pox-5 has no path from the reserve to bonds: transfer-from-reserve is private and never called. In a shortfall the deposit is zero and the reserve stays flat."
      />
      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Balance" value={btc(h.reserve.value)} detail={h.reserve.value === null ? undefined : satsExact(h.reserve.value)} provenance={h.reserve.provenance} source={h.reserve.source} />
        <Stat
          label="Hypothetical cover"
          value={h.cover.value === null ? "n/a" : `${h.cover.value.toFixed(2)} cycles`}
          detail="reserve ÷ (2 × what bonds are owed per interval)"
          provenance={h.cover.provenance}
          source={h.cover.source}
        />
        <Stat
          label="State"
          value={drawing === null ? "—" : drawing ? "Not drawing" : "Flat"}
          detail={last ? `last deposit +${satsExact(last.reserve_deposit.value)} (distribution ${last.distribution_index})` : undefined}
          provenance="mirrored"
          source={last?.reserve_deposit.source}
        />
      </section>
      <Note>
        Hypothetical cover: {h.cover.value === null ? "n/a" : `${h.cover.value.toFixed(2)} cycles`} — reserve cannot currently
        pay out (requires SIP). The figure compares sizes; it is not a payout schedule.
      </Note>
      {intervals.length === 0 ? (
        <Unavailable what="Reserve history" />
      ) : (
        <Panel title="Balance after each distribution" provenance="mirrored" source="reserve-balance from each calculate-rewards event; deposits equal the reserve delta in pox-5 state exactly">
          <ReserveChart intervals={intervals} />
        </Panel>
      )}
    </div>
  );
}
