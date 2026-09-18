import { AppShell } from "@/components/dash/shell";
import { brandAssets } from "@/lib/brand";
import { getCurrent, getIntervals } from "@/lib/api";
import { timestamp } from "@/lib/format";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [cur, iv] = await Promise.all([getCurrent(), getIntervals()]);
  const cycle = cur?.cycle.value ?? iv?.intervals.at(-1)?.cycle ?? null;
  return (
    <AppShell
      hasLogo={brandAssets().svg}
      status={{ cycle: cycle === null ? null : Number(cycle), burnHeight: cur?.as_of.burn_height ?? null, updated: cur ? timestamp(cur.as_of.taken_at) : null }}
    >
      {children}
    </AppShell>
  );
}
