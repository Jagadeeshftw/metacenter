"use client";

// BTC or sats, chosen by the reader and remembered in their browser.
//
// Amounts are passed around as sats, the unit pox-5 works in, and rendered in whichever unit the
// reader picked. Every page under the dashboard shares one choice. Before mount, and for anyone
// with storage blocked, the server's rendering stands, so the markup matches and nothing shifts.
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Unit = "sats" | "btc";
const KEY = "mc-units";
const DEFAULT: Unit = "sats";

const UnitsContext = createContext<{ unit: Unit; setUnit: (u: Unit) => void }>({ unit: DEFAULT, setUnit: () => {} });

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnitState] = useState<Unit>(DEFAULT);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "btc" || stored === "sats") setUnitState(stored);
    } catch {
      // storage can be blocked; the default stands
    }
  }, []);

  const setUnit = useCallback((u: Unit) => {
    setUnitState(u);
    try {
      localStorage.setItem(KEY, u);
    } catch {
      // the choice still applies for this page view
    }
  }, []);

  return <UnitsContext.Provider value={{ unit, setUnit }}>{children}</UnitsContext.Provider>;
}

export const useUnits = () => useContext(UnitsContext);

const num = (v: string | number | null | undefined) => (v === null || v === undefined ? null : Number(v));

/** sats, in full, with separators. */
export const formatSats = (v: string | number | null | undefined) => {
  const n = num(v);
  return n === null || Number.isNaN(n) ? "—" : `${Math.round(n).toLocaleString("en-US")} sats`;
};

/**
 * sats, shortened for headline figures. It never switches to BTC: the reader chose sats, and a
 * card reading BTC beside one reading sats is exactly the confusion the toggle exists to remove.
 */
export const formatSatsShort = (v: string | number | null | undefined, digits = 1) => {
  const n = num(v);
  if (n === null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B sats`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(digits)}M sats`;
  return `${Math.round(n).toLocaleString("en-US")} sats`;
};

export const formatBtc = (v: string | number | null | undefined, digits = 3) => {
  const n = num(v);
  if (n === null || Number.isNaN(n)) return "—";
  // keep small amounts readable rather than printing 0.000 BTC
  const d = Math.abs(n) > 0 && Math.abs(n) < 1e6 ? 8 : digits;
  return `${(n / 1e8).toFixed(d)} BTC`;
};

/**
 * An amount held in sats, shown in the reader's unit.
 * `exact` keeps every sat rather than shortening to millions.
 */
export function Amount({
  sats,
  exact = false,
  digits,
}: {
  sats: string | number | null | undefined;
  exact?: boolean;
  digits?: number;
}) {
  const { unit } = useUnits();
  if (sats === null || sats === undefined) return <>—</>;
  const text = unit === "btc" ? formatBtc(sats, digits ?? 3) : exact ? formatSats(sats) : formatSatsShort(sats, digits ?? 1);
  // the other unit stays available on hover, so a figure is never ambiguous
  const title = unit === "btc" ? formatSats(sats) : formatBtc(sats, digits ?? 3);
  return <span title={title}>{text}</span>;
}

/** The toggle itself: two buttons, the current one pressed. */
export function UnitsToggle({ className = "" }: { className?: string }) {
  const { unit, setUnit } = useUnits();
  return (
    <div
      className={`inline-flex shrink-0 overflow-hidden rounded-full border border-line text-xs ${className}`}
      role="group"
      aria-label="Show amounts in"
    >
      {(["sats", "btc"] as const).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => setUnit(u)}
          aria-pressed={unit === u}
          className={`px-2.5 py-1 font-medium transition-colors ${
            unit === u ? "bg-brand/15 text-brand" : "text-muted hover:text-foreground"
          }`}
        >
          {u === "sats" ? "sats" : "BTC"}
        </button>
      ))}
    </div>
  );
}
