"use client";
import { useEffect, useRef, useState } from "react";
import type { Stress } from "@/lib/api";
import { pct, satsPerStx, times } from "@/lib/format";
import { ProvenanceTag } from "@/components/shared/provenance";
import { cn } from "@/lib/utils";
import { Amount } from "@/components/shared/units";

type Q = { commit: number; price: number; book: "current" | "sip"; bookBtc: number; bonds: number };

const query = (q: Q) =>
  `?commit_drop=${(q.commit / 100).toFixed(2)}&price_drop=${(q.price / 100).toFixed(2)}` +
  (q.book === "sip" ? `&book_btc=${q.bookBtc}&bonds=${q.bonds}` : "");

export type TodaysBond = { index: number; sharesSats: number; rateBps: number } | null;

export function StressTest({ initial, todaysBond = null }: { initial: Stress | null; todaysBond?: TodaysBond }) {
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
              <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">
                Total bonded BTC live at one moment
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={q.bookBtc}
                  onChange={(e) => set({ bookBtc: Math.max(1, Number(e.target.value) || 1) })}
                  className="num h-11 rounded-lg border border-line bg-background px-3 text-sm text-foreground"
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-xs text-muted sm:col-span-1">
                Split across this many bonds
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
              <p className="col-span-2 text-xs leading-relaxed text-subtle">
                {q.bookBtc.toLocaleString("en-US")} BTC over {q.bonds} bond{q.bonds === 1 ? "" : "s"} ={" "}
                {q.bonds} × {(q.bookBtc / q.bonds).toLocaleString("en-US", { maximumFractionDigits: 2 })} BTC. This is the
                book that is live during one distribution interval, not a total that builds up: the number of bonds only
                decides how that same capital is split for the payout order, so what is owed does not change with it.
              </p>
              <p className="col-span-2 text-xs leading-relaxed text-subtle">
                Six is the ceiling because a bonding period runs 25,200 Bitcoin blocks (about 6 months) and a new one opens
                every 4,200 blocks (about a month), so six overlap at steady state — the same limit pox-5 puts on its payout
                list.
              </p>
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
            Base: {data.inputs.base}, pool <Amount sats={data.inputs.base_pool.value} exact />, price {satsPerStx(data.inputs.price.value, 2)} at that
            distribution. At 0% / 0% with the current book these reproduce the realised figures exactly.
          </p>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Out label="Pool per interval" hint="miner reward the protocol receives in one distribution interval (1,050 Bitcoin blocks, ~7.3 days)" value={<Amount sats={data.pool.value} />} />
            <Out label="Owed to bonds, same interval" hint="the bond target for that same interval: staked sats × target rate ÷ 10000 ÷ 50. This is not the bond size." value={<Amount sats={data.obligation.value} />} />
            <Out label="Coverage" value={times(data.coverage.value)} />
            <Out label="Shortfall" value={<Amount sats={data.shortfall.value} exact />} />
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
                      <Amount sats={paid} /> / <Amount sats={target} />
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
                <dd className="num">{Number(data.reserve_deposit.value) === 0 ? "0 sats · reserve flat" : <Amount sats={data.reserve_deposit.value} />}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">STX-only stakers (85%)</dt>
                <dd className="num"><Amount sats={data.stx_only.value} /></dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-subtle">
              {data.assumption}. Miner-commit model: {data.commit_model}
            </p>
            <p className="num mt-2 break-words text-[11px] text-subtle">GET /api/stress{query(q)}</p>
          </section>

          <WorkedExample q={q} todaysBond={todaysBond} />
        </>
      )}
    </div>
  );
}

/**
 * The arithmetic, with the numbers currently on screen. kaPow read "pool per interval" as the bond
 * size, which is the misreading this answers: a bond's size and what it is owed each interval are
 * three orders of magnitude apart, and the formula is the only thing that connects them.
 */
function WorkedExample({ q, todaysBond }: { q: Q; todaysBond: TodaysBond }) {
  const hypotheticalSize = (q.bookBtc / q.bonds) * 1e8;
  const target = (size: number, bps: number) => (size * bps) / 10000 / 50;

  const Row = ({ label, size, bps }: { label: string; size: number; bps: number }) => (
    <div className="flex flex-col gap-1 border-t border-line py-3 first:border-0 first:pt-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="num text-sm leading-relaxed">
        {Math.round(size).toLocaleString("en-US")} sats staked × {bps} ÷ 10,000 ÷ 50 ={" "}
        <b className="font-medium">{Math.round(target(size, bps)).toLocaleString("en-US")} sats</b> owed per distribution
        interval
      </span>
      <span className="text-xs text-subtle">
        {(size / 1e8).toLocaleString("en-US", { maximumFractionDigits: 2 })} BTC staked at {(bps / 100).toFixed(2)}% a year,
        paid across ~50 intervals a year
      </span>
    </div>
  );

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium">How a bond&apos;s size becomes what it is owed</h2>
      <p className="text-sm leading-relaxed text-muted">
        A bond&apos;s target for one interval is <span className="num">staked sats × target rate ÷ 10,000 ÷ 50</span>: the
        rate is in basis points, and the yearly figure is spread over roughly 50 distribution intervals (pox-5 L2266). The
        bond&apos;s size and what it is owed each interval are not the same number.
      </p>
      <div className="flex flex-col">
        {todaysBond ? (
          <Row
            label={`Today, bond #${todaysBond.index}${todaysBond.index === 1 ? " (Genesis Bond)" : ""}`}
            size={todaysBond.sharesSats}
            bps={todaysBond.rateBps}
          />
        ) : null}
        <Row label={`Your input: one of ${q.bonds} bond${q.bonds === 1 ? "" : "s"} in a ${q.bookBtc.toLocaleString("en-US")} BTC book`} size={hypotheticalSize} bps={300} />
        <Row label={`All ${q.bonds} together`} size={hypotheticalSize * q.bonds} bps={300} />
      </div>
      <p className="text-xs leading-relaxed text-subtle">
        Compare that with the pool figure above, which is the miner reward the protocol receives in the same interval.
        Coverage is one divided by the other.
      </p>
    </section>
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

function Out({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
      <span className="flex items-start justify-between gap-2 text-xs text-muted">{label}</span>
      <span className="num text-xl font-medium md:text-2xl">{value}</span>
      {hint && <span className="text-xs leading-snug text-subtle">{hint}</span>}
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
