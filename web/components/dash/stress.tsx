"use client";
import { useEffect, useRef, useState } from "react";
import type { Stress } from "@/lib/api";
import { pct, satsM as sats, satsExact, satsPerStx, times } from "@/lib/format";
import { ProvenanceTag } from "@/components/shared/provenance";
import { cn } from "@/lib/utils";

type Q = { commit: number; price: number; book: "current" | "sip"; bookBtc: number; bonds: number };

const query = (q: Q) =>
  `?commit_drop=${(q.commit / 100).toFixed(2)}&price_drop=${(q.price / 100).toFixed(2)}` +
  (q.book === "sip" ? `&book_btc=${q.bookBtc}&bonds=${q.bonds}` : "");

export function StressTest({ initial }: { initial: Stress | null }) {
  const [q, setQ] = useState<Q>({ commit: 0, price: 0, book: "current", bookBtc: 3000, bonds: 6 });
  const [data, setData] = useState<Stress | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/stress${query(q)}`);
        if (!r.ok) throw new Error(String(r.status));
        setData(await r.json());
        setError(null);
      } catch {
        setError("Could not reach the API. Showing the last result.");
      }
    }, 200);
  }, [q]);

  const set = (patch: Partial<Q>) => setQ((s) => ({ ...s, ...patch }));

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-6 rounded-2xl border border-dashed border-hyp bg-surface p-5 md:grid-cols-3 md:p-6">
        <Slider label="Miner BTC commit drop" value={q.commit} onChange={(v) => set({ commit: v })} />
        <Slider label="STX price drop" value={q.price} onChange={(v) => set({ price: v })} />
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium">Bond book</span>
          <div role="radiogroup" aria-label="Bond book" className="grid grid-cols-2 overflow-hidden rounded-xl border border-line">
            {(["current", "sip"] as const).map((b) => (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={q.book === b}
                onClick={() => set({ book: b })}
                className={cn("h-11 px-3 text-sm", q.book === b ? "bg-surface-3 font-medium text-foreground" : "text-muted hover:text-foreground", b === "sip" && "border-l border-line")}
              >
                {b === "current" ? "Current" : "Hypothetical"}
              </button>
            ))}
          </div>
          {q.book === "sip" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Book size (BTC)
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={q.bookBtc}
                  onChange={(e) => set({ bookBtc: Math.max(1, Number(e.target.value) || 1) })}
                  className="num h-11 rounded-lg border border-line bg-background px-3 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Bonds
                <select
                  value={q.bonds}
                  onChange={(e) => set({ bonds: Number(e.target.value) })}
                  className="num h-11 rounded-lg border border-line bg-background px-3 text-sm text-foreground"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      </section>

      {error && <p className="text-sm text-owed">{error}</p>}
      {!data ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">The stress model is unavailable right now.</p>
      ) : (
        <>
          <p className="text-sm text-muted">
            Base: {data.inputs.base}, pool {satsExact(data.inputs.base_pool.value)}, price {satsPerStx(data.inputs.price.value, 2)} at that
            distribution. At 0% / 0% with the current book these reproduce the realised figures exactly.
          </p>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Out label="Pool per interval" value={sats(data.pool.value)} />
            <Out label="Owed to bonds" value={sats(data.obligation.value)} />
            <Out label="Coverage" value={times(data.coverage.value)} />
            <Out label="Shortfall" value={satsExact(data.shortfall.value)} />
            <Out label="STX-only APY (BTC)" value={pct(data.stx_only_apy_btc.value, 2)} />
          </section>
          <section className="rounded-2xl border border-line bg-surface p-5 md:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold md:text-lg">Waterfall, in pox-5 order</h2>
              <ProvenanceTag kind="hypothetical" />
            </div>
            <ol className="flex flex-col gap-3">
              {data.payout.value.map((b) => {
                const target = Number(b.target_sats);
                const paid = Number(b.paid_sats);
                const share = target ? paid / target : 0;
                return (
                  <li key={b.bond_index} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm md:grid-cols-[3rem_12rem_minmax(0,1fr)_14rem_6rem]">
                    <span className="num text-muted">{b.position + 1}.</span>
                    <span>
                      {q.book === "current" ? `Bond #${b.bond_index}` : `Hypothetical #${b.bond_index}`}
                      <span className="num block text-xs text-subtle">ratio {Number(b.stx_value_ratio).toLocaleString("en-US")}</span>
                    </span>
                    <span className="col-span-3 row-start-2 h-3 overflow-hidden rounded bg-surface-2 md:col-span-1 md:row-start-auto" aria-hidden="true">
                      <span className="block h-full rounded bg-pool" style={{ width: `${Math.round(share * 100)}%` }} />
                    </span>
                    <span className="num hidden text-right md:block">
                      {sats(paid)} / {sats(target)}
                    </span>
                    <span className="inline-flex items-center justify-end gap-1.5 text-right">
                      <StatusGlyph status={b.status} />
                      {b.status}
                    </span>
                  </li>
                );
              })}
            </ol>
            <dl className="mt-5 grid gap-2 border-t border-line pt-4 text-sm md:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Reserve deposit (15% of remainder)</dt>
                <dd className="num">{Number(data.reserve_deposit.value) === 0 ? "0 sats · reserve flat" : sats(data.reserve_deposit.value)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">STX-only stakers (85%)</dt>
                <dd className="num">{sats(data.stx_only.value)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-subtle">
              {data.assumption}. Miner-commit model: {data.commit_model}
            </p>
            <p className="num mt-2 break-words text-[11px] text-subtle">GET /api/stress{query(q)}</p>
          </section>
        </>
      )}
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="flex justify-between font-medium">
        {label}
        <span className="num">{value}%</span>
      </span>
      <input className="slider" type="range" min={0} max={100} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Out({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
      <span className="flex items-start justify-between gap-2 text-xs text-muted">
        {label}
      </span>
      <span className="num text-xl font-medium md:text-2xl">{value}</span>
    </div>
  );
}

function StatusGlyph({ status }: { status: "full" | "partial" | "none" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="5" fill={status === "full" ? "var(--foreground)" : "none"} stroke="var(--foreground)" strokeWidth="1.5" />
      {status === "partial" && <path d="M6 1 A5 5 0 0 1 6 11 Z" fill="var(--foreground)" />}
    </svg>
  );
}
