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

export function ProvenanceTag({ kind, className }: { kind: Provenance; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted", className)}>
      <ProvenanceGlyph kind={kind} />
      {kind}
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
