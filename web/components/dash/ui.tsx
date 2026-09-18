// Dashboard building blocks (server-safe).
import { cn } from "@/lib/utils";
import type { Provenance } from "@/lib/api";
import { ProvenanceTag } from "@/components/shared/provenance";

export function PageHeader({ title, lead, children }: { title: string; lead?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {lead && <p className="max-w-3xl text-sm text-muted md:text-base">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

export function Panel({
  title,
  provenance,
  children,
  className,
  source,
  dashed,
}: {
  title?: string;
  provenance?: Provenance;
  children: React.ReactNode;
  className?: string;
  source?: React.ReactNode;
  dashed?: boolean;
}) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl border bg-surface p-5 md:p-6", dashed ? "border-dashed border-hyp" : "border-line", className)}>
      {(title || provenance) && (
        <div className="flex items-start justify-between gap-3">
          {title && <h2 className="text-base font-semibold md:text-lg">{title}</h2>}
          {provenance && <ProvenanceTag kind={provenance} className="shrink-0 pt-1" />}
        </div>
      )}
      {children}
      {source && <p className="num text-[11px] leading-relaxed text-subtle [overflow-wrap:anywhere]">{source}</p>}
    </section>
  );
}

export function Stat({
  label,
  value,
  detail,
  provenance,
  source,
  big,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
  provenance: Provenance;
  source?: string;
  big?: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 text-sm text-muted">
        <span>{label}</span>
        <ProvenanceTag kind={provenance} className="shrink-0" />
      </div>
      <span className={cn("num font-medium tracking-tight text-foreground", big ? "text-5xl md:text-6xl" : "text-3xl md:text-4xl")}>{value}</span>
      {detail && <span className="text-sm text-muted">{detail}</span>}
      {source && <span className="num mt-auto pt-2 text-[11px] text-subtle [overflow-wrap:anywhere]">{source}</span>}
    </div>
  );
}

export function Note({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("rounded-xl bg-surface-2 px-4 py-3 text-sm text-foreground", className)}>{children}</p>;
}

export function Unavailable({ what }: { what: string }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{what} is unavailable right now.</p>;
}
