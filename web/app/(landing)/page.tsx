import CTA from "@/components/landing/cta";
import { FrequentlyAskedQuestions } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Hero, type HeroStat } from "@/components/landing/hero";
import { SpotlightLogoCloud } from "@/components/landing/logos-cloud";
import { Pricing } from "@/components/landing/pricing";
import { Testimonials } from "@/components/landing/testimonials";
import { getCurrent, getIntervals, getMeta } from "@/lib/api";
import { btc, int, pct, times, timestamp } from "@/lib/format";
import { TESTS } from "@/lib/site";
import { headline } from "@/lib/view";

export const revalidate = 60;

export default async function Home() {
  const [cur, iv, meta] = await Promise.all([getCurrent(), getIntervals(), getMeta()]);
  const intervals = iv?.intervals ?? [];
  const last = intervals.at(-1) ?? null;
  const h = headline(cur, last);
  const stats: HeroStat[] = [
    { label: "Headroom", value: pct(h.headroom.value), detail: "pool can fall this far before bond yield is impaired", provenance: h.headroom.provenance },
    { label: "Coverage", value: times(h.coverage.value), detail: `reward pool ÷ what bonds are owed${h.cycle.value ? `, cycle ${h.cycle.value}` : ""}`, provenance: h.coverage.provenance },
    { label: "Reserve", value: btc(h.reserve.value), detail: `hypothetical cover ${h.cover.value === null ? "n/a" : h.cover.value.toFixed(2) + " cycles"} (needs a SIP to pay out)`, provenance: h.reserve.provenance },
    { label: "STX-only yield", value: pct(h.apy?.value ?? null, 2), detail: `annualised in BTC terms, distribution ${last?.distribution_index ?? "—"}`, provenance: "mirrored" },
  ];
  const bars = intervals.map((i) => ({ index: i.distribution_index, pool: Number(i.gross_pool.value), owed: Number(i.obligation.value) }));
  const asOf = cur?.as_of
    ? `Bitcoin block ${int(cur.as_of.burn_height)} · last updated ${timestamp(cur.as_of.taken_at)}`
    : "Live data unavailable right now";
  return (
    <div>
      <Hero stats={stats} bars={bars} asOf={asOf} />
      <SpotlightLogoCloud />
      <Features testCount={TESTS} />
      <Testimonials />
      <Pricing reader={meta?.reader ?? null} feed={meta?.feed ?? "ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed"} />
      <FrequentlyAskedQuestions />
      <CTA />
    </div>
  );
}
