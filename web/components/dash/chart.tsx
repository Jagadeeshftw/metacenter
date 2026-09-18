"use client";
// Per-distribution charts. Rendered at the container's pixel width (text never scales),
// one axis only, hover/focus tooltips with exact values and provenance, n/a slots hatched.
import { useEffect, useId, useRef, useState } from "react";
import type { Provenance } from "@/lib/api";
import { ProvenanceGlyph } from "@/components/shared/provenance";

export type TipLine = { label: string; value: string; provenance?: Provenance };
export type Slot = {
  key: number;
  label: string; // x label, e.g. distribution index
  group?: string; // e.g. "cycle 143"
  bar?: number | null; // bar series
  line?: number | null; // line series (null = n/a)
  tick?: number | null; // per-slot reference tick (e.g. owed to bonds)
  na?: string; // reason when the value is not applicable
  tip: TipLine[];
  source?: string;
};

type Props = {
  slots: Slot[];
  height?: number;
  yMax?: number;
  yFormat: (v: number) => string;
  barColor?: string;
  lineColor?: string;
  tickColor?: string;
  refs?: { value: number; label: string; short?: string; dashed?: boolean }[];
  ariaLabel: string;
  legend: { label: string; swatch: "bar" | "line" | "tick" | "hatch" | "dot"; color?: string; dash?: string }[];
  pointLabel?: (v: number) => string;
};

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function IntervalChart({
  slots,
  height = 280,
  yMax,
  yFormat,
  barColor = "var(--series-pool)",
  lineColor = "var(--series-pool)",
  tickColor = "var(--series-owed)",
  refs = [],
  ariaLabel,
  legend,
  pointLabel,
}: Props) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const hatchId = useId().replace(/:/g, "");
  const narrow = width < 520;
  const m = { l: narrow ? 52 : 64, r: refs.length ? (narrow ? 44 : 112) : 12, t: 24, b: 48 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = height - m.t - m.b;
  const values = slots.flatMap((s) => [s.bar ?? 0, s.line ?? 0, s.tick ?? 0]).concat(refs.map((r) => r.value));
  const max = yMax ?? niceMax(Math.max(...values, 0) * 1.1);
  const y = (v: number) => m.t + ih - (ih * v) / max;
  const slotW = slots.length ? iw / slots.length : 0;
  const cx = (i: number) => m.l + slotW * (i + 0.5);
  const bw = Math.min(56, slotW * 0.56);
  const ticks = [0, max / 2, max];
  // reference labels: keep at least 14px apart, pushing the higher value up
  const refLabelY = (() => {
    const sorted = [...refs].sort((a, b) => a.value - b.value);
    const out = new Map<string, number>();
    let prev = Infinity;
    for (const r of sorted) {
      const want = y(r.value) + 4;
      const at = Math.min(want, prev - 14);
      out.set(r.label, at);
      prev = at;
    }
    return out;
  })();
  const naRuns = groupNa(slots);
  const linePts = slots.map((s, i) => (s.line === null || s.line === undefined ? null : [cx(i), y(s.line)] as const));
  const groups = groupRuns(slots);

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          <defs>
            <pattern id={hatchId} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="var(--surface-2)" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--hatch)" strokeWidth="2.5" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--border)" : "var(--grid)"} />
              <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--subtle)" className="num">
                {yFormat(t)}
              </text>
            </g>
          ))}
          {naRuns.map((r) => {
            const x0 = m.l + slotW * r.from + 4;
            const x1 = m.l + slotW * (r.to + 1) - 4;
            return (
              <g key={`na${r.from}`}>
                <rect x={x0} y={m.t} width={x1 - x0} height={ih} rx="6" fill={`url(#${hatchId})`} opacity="0.55" />
                <text x={(x0 + x1) / 2} y={m.t + ih / 2} textAnchor="middle" fontSize="12" fill="var(--muted)">
                  n/a · {r.reason}
                </text>
              </g>
            );
          })}
          {slots.map((s, i) =>
            s.bar != null ? (
              <rect key={`b${s.key}`} x={cx(i) - bw / 2} y={y(s.bar)} width={bw} height={y(0) - y(s.bar)} rx="4" fill={barColor} opacity={active === null || active === i ? 1 : 0.55} />
            ) : null,
          )}
          {refs.map((r) => (
            <g key={r.label}>
              <line x1={m.l} x2={m.l + iw} y1={y(r.value)} y2={y(r.value)} stroke="var(--foreground)" strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray={r.dashed ? "6 5" : "2 4"} />
              <text x={m.l + iw + 8} y={refLabelY.get(r.label)} fontSize="11" fill="var(--foreground)">
                {narrow ? (r.short ?? r.label) : r.label}
              </text>
            </g>
          ))}
          {slots.map((s, i) =>
            s.tick ? (
              <line key={`t${s.key}`} x1={cx(i) - bw / 2 - 8} x2={cx(i) + bw / 2 + 8} y1={y(s.tick)} y2={y(s.tick)} stroke={tickColor} strokeWidth="3" strokeLinecap="round" />
            ) : null,
          )}
          {linePts.some(Boolean) && <path d={pathFrom(linePts)} fill="none" stroke={lineColor} strokeWidth="2" />}
          {linePts.map((p, i) =>
            p ? <circle key={`d${i}`} cx={p[0]} cy={p[1]} r={active === i ? 6 : 4.5} fill={lineColor} stroke="var(--surface)" strokeWidth="2" /> : null,
          )}
          {pointLabel &&
            (() => {
              const i = linePts.map((p, k) => (p ? k : -1)).filter((k) => k >= 0).at(-1);
              if (i === undefined) return null;
              const p = linePts[i]!;
              return (
                <text x={p[0]} y={p[1] - 12} textAnchor="middle" fontSize="12" fontWeight="500" fill="var(--foreground)" className="num">
                  {pointLabel(slots[i].line as number)}
                </text>
              );
            })()}
          {slots.map((s, i) => (
            <text key={`x${s.key}`} x={cx(i)} y={m.t + ih + 18} textAnchor="middle" fontSize="11" fill="var(--subtle)" className="num">
              {s.label}
            </text>
          ))}
          {groups.map((g) => (
            <text key={g.label + g.from} x={(cx(g.from) + cx(g.to)) / 2} y={m.t + ih + 36} textAnchor="middle" fontSize="11" fill="var(--subtle)">
              {g.label}
            </text>
          ))}
          {slots.map((s, i) => (
            <rect
              key={`hit${s.key}`}
              x={m.l + slotW * i}
              y={m.t}
              width={slotW}
              height={ih}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${s.label}: ${s.tip.map((t) => `${t.label} ${t.value}`).join(", ")}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="cursor-crosshair outline-none focus-visible:stroke-[var(--brand)] focus-visible:stroke-2"
            />
          ))}
        </svg>
      )}
      {active !== null && width > 0 && <Tooltip slot={slots[active]} x={cx(active)} width={width} />}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <Swatch kind={l.swatch} color={l.color} dash={l.dash} hatchId={hatchId} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tooltip({ slot, x, width }: { slot: Slot; x: number; width: number }) {
  const w = 240;
  const left = Math.min(Math.max(8, x - w / 2), width - w - 8);
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-2 z-10 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-[0_12px_32px_var(--shadow)]"
      style={{ left, width: w }}
    >
      <div className="mb-1.5 font-medium text-foreground">
        Distribution {slot.label}
        {slot.group ? ` · ${slot.group}` : ""}
      </div>
      <dl className="flex flex-col gap-1">
        {slot.tip.map((t) => (
          <div key={t.label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted">
              {t.provenance && <ProvenanceGlyph kind={t.provenance} size={8} />}
              {t.label}
            </dt>
            <dd className="num text-foreground">{t.value}</dd>
          </div>
        ))}
      </dl>
      {slot.source && <p className="num mt-2 break-words text-[10px] text-subtle">{slot.source}</p>}
    </div>
  );
}

function Swatch({ kind, color, dash, hatchId }: { kind: string; color?: string; dash?: string; hatchId: string }) {
  if (kind === "bar") return <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color ?? "var(--series-pool)" }} />;
  if (kind === "tick") return <span className="h-[3px] w-4 rounded" style={{ background: color ?? "var(--series-owed)" }} />;
  if (kind === "line")
    return (
      <svg width="18" height="10" aria-hidden="true">
        <line x1="0" x2="18" y1="5" y2="5" stroke={color ?? "var(--foreground)"} strokeWidth="1.5" strokeDasharray={dash ?? (color ? undefined : "6 5")} />
      </svg>
    );
  if (kind === "dot")
    return (
      <svg width="18" height="10" aria-hidden="true">
        <line x1="0" x2="18" y1="5" y2="5" stroke={color} strokeWidth="2" />
        <circle cx="9" cy="5" r="3.5" fill={color} />
      </svg>
    );
  return (
    <svg width="14" height="10" aria-hidden="true">
      <rect width="14" height="10" rx="2" fill={`url(#${hatchId})`} stroke="var(--hatch)" />
    </svg>
  );
}

function pathFrom(pts: (readonly [number, number] | null)[]) {
  let d = "";
  let pen = false;
  for (const p of pts) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p[0]},${p[1]} `;
    pen = true;
  }
  return d;
}

function groupRuns(slots: Slot[]) {
  const out: { label: string; from: number; to: number }[] = [];
  slots.forEach((s, i) => {
    if (!s.group) return;
    const last = out.at(-1);
    if (last && last.label === s.group && last.to === i - 1) last.to = i;
    else out.push({ label: s.group, from: i, to: i });
  });
  return out;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((c) => n <= c) ?? 10;
  return step * p;
}

function groupNa(slots: Slot[]) {
  const out: { from: number; to: number; reason: string }[] = [];
  slots.forEach((s, i) => {
    if (!s.na) return;
    const last = out.at(-1);
    if (last && last.to === i - 1 && last.reason === s.na) last.to = i;
    else out.push({ from: i, to: i, reason: s.na });
  });
  return out;
}
