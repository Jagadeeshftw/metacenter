import { getCurrent, getIntervals } from "@/lib/api";
import { btc, satsExact } from "@/lib/format";
import { headline } from "@/lib/view";
import { PageHeader, Panel, Stat, Note, Unavailable } from "@/components/dash/ui";
import { ReserveChart } from "@/components/dash/charts";

export const revalidate = 60;
export const metadata = { title: "Reserve", alternates: { canonical: "/dashboard/reserve" }, openGraph: { url: "/dashboard/reserve" } };

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
        lead="After bonds are paid, 15% of what remains goes to the reserve. In a shortfall there is no remainder, so the deposit is zero and the reserve stays flat."
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
      <section className="grid gap-4 md:grid-cols-2">
        <Panel title="Design">
          <p className="text-sm leading-relaxed">
            A back-stop that keeps bonds whole when mining rewards fall short of the ~3% target.{" "}
            <a className="underline underline-offset-4" href="https://docs.stacks.co/learn/bitcoin-staking/glossary#reserve-fund" target="_blank" rel="noreferrer">
              Reserve fund, Stacks docs
            </a>
          </p>
        </Panel>
        <Panel title="This iteration">
          <p className="text-sm leading-relaxed">
            Accrual-only: it can&apos;t be drawn automatically. <code className="num text-xs">transfer-from-reserve</code> is
            private and uncalled, and using the reserve goes through a SIP process. An automated process is planned for a
            later iteration.
          </p>
        </Panel>
      </section>
      <Note>
        Hypothetical cover: {h.cover.value === null ? "n/a" : `${h.cover.value.toFixed(2)} cycles`} — how long the reserve
        could stand behind the bond obligation at today&apos;s size, if a SIP made it payable. It compares sizes; it is not a
        payout schedule.
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
