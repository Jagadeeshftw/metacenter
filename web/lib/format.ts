// Number formatting. Every large number carries its unit.
const toNum = (v: string | number | null | undefined) => (v === null || v === undefined ? null : Number(v));

export function sats(v: string | number | null | undefined, digits = 1): string {
  const n = toNum(v);
  if (n === null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(3)} BTC`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(digits)}M sats`;
  return `${Math.round(n).toLocaleString("en-US")} sats`;
}

export const satsExact = (v: string | number | null | undefined) => {
  const n = toNum(v);
  return n === null ? "—" : `${Math.round(n).toLocaleString("en-US")} sats`;
};

export const btc = (v: string | number | null | undefined, digits = 3) => {
  const n = toNum(v);
  return n === null ? "—" : `${(n / 1e8).toFixed(digits)} BTC`;
};

export const times = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined ? "n/a" : `${v.toFixed(digits)}×`;

export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "n/a" : `${(v * 100).toFixed(digits)}%`;

export const stx = (ustx: string | number | null | undefined) => {
  const n = toNum(ustx);
  if (n === null) return "—";
  const s = n / 1e6;
  if (s >= 1e6) return `${(s / 1e6).toFixed(1)}M STX`;
  return `${Math.round(s).toLocaleString("en-US")} STX`;
};

export const satsPerStx = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "n/a" : `${v.toFixed(digits)} sats/STX`;

export const int = (v: number | string | null | undefined) =>
  v === null || v === undefined ? "—" : Number(v).toLocaleString("en-US");

export function timestamp(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** Always in sats (millions above 1M), for side-by-side comparisons. */
export function satsM(v: string | number | null | undefined, digits = 1): string {
  const n = toNum(v);
  if (n === null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(digits)}M sats`;
  return `${Math.round(n).toLocaleString("en-US")} sats`;
}
