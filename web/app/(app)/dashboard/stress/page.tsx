import { getStress } from "@/lib/api";
import { PageHeader } from "@/components/dash/ui";
import { StressTest } from "@/components/dash/stress";
import { ProvenanceTag } from "@/components/shared/provenance";

export const revalidate = 60;
export const metadata = { title: "Stress test", alternates: { canonical: "/dashboard/stress" }, openGraph: { url: "/dashboard/stress" } };

export default async function StressPage() {
  const initial = await getStress();
  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="Stress test"
        lead="Cut miner BTC commits or the STX price, or swap in a larger bond book, and see how pox-5 would split one distribution interval: bonds in stx-value-ratio order, then the reserve, then STX-only stakers."
      >
        <ProvenanceTag kind="hypothetical" />
      </PageHeader>
      <StressTest initial={initial} />
    </div>
  );
}
