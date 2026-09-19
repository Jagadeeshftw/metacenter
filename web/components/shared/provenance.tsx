import type { Provenance } from "@/lib/api";
import { cn } from "@/lib/utils";

// Provenance is never colour alone: each label has its own glyph and its name.
export function ProvenanceGlyph({ kind, size = 9 }: { kind: Provenance; size?: number }) {
  const h = size / 2;
  if (kind === "onchain")
    return (
      <svg width={size} height={size} aria-hidden="true" className="shrink-0">
        <circle cx={h} cy={h} r={h} fill="var(--onchain)" />
      </svg>
    );
  if (kind === "mirrored")
    return (
      <svg width={size} height={size} aria-hidden="true" className="shrink-0">
        <rect x={size * 0.15} y={size * 0.15} width={size * 0.7} height={size * 0.7} transform={`rotate(45 ${h} ${h})`} fill="var(--mirrored)" />
      </svg>
    );
  return (
    <svg width={size} height={size} aria-hidden="true" className="shrink-0">
      <circle cx={h} cy={h} r={h - 1} fill="none" stroke="var(--hyp)" strokeWidth="1.8" strokeDasharray="2 1.5" />
    </svg>
  );
}

const MEANING: Record<Provenance, string> = {
  onchain: "Computed by the pox5-reader contract on mainnet from pox-5 state.",
  mirrored: "Posted by the publisher from mainnet events, the Hiro API or a price source, with its raw inputs.",
  hypothetical: "A stress test or what-if, shown with its assumption.",
};

// The tag explains itself on hover or keyboard focus (no animation).
export function ProvenanceTag({ kind, className }: { kind: Provenance; className?: string }) {
  return (
    <span
      tabIndex={0}
      aria-label={`${kind}: ${MEANING[kind]}`}
      className={cn("group relative inline-flex cursor-help items-center gap-1.5 text-xs text-muted outline-none", className)}
    >
      <ProvenanceGlyph kind={kind} />
      {kind}
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-64 rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs leading-relaxed text-foreground shadow-[0_12px_32px_var(--shadow)] group-hover:block group-focus-visible:block"
      >
        <b className="font-medium">{kind}</b> · {MEANING[kind]}
      </span>
    </span>
  );
}

export function ProvenanceLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted", className)}>
      <span className="inline-flex items-center gap-1.5"><ProvenanceGlyph kind="onchain" /><b className="font-medium text-foreground">onchain</b> computed by pox5-reader</span>
      <span className="inline-flex items-center gap-1.5"><ProvenanceGlyph kind="mirrored" /><b className="font-medium text-foreground">mirrored</b> posted by the publisher, incl. prices</span>
      <span className="inline-flex items-center gap-1.5"><ProvenanceGlyph kind="hypothetical" /><b className="font-medium text-foreground">hypothetical</b> stress and what-ifs</span>
    </div>
  );
}
