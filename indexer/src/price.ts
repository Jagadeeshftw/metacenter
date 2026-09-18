// STX/BTC price (mirrored). Every stored price keeps its source and timestamp.
import { config } from "./config.js";
import { pool } from "./db.js";

export type Price = { satsPerStx: string; source: string; timestamp: number };

const SATS = 100_000_000;

async function get(path: string) {
  const r = await fetch(config.coingecko + path, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`coingecko ${path}: ${r.status}`);
  return r.json();
}

/** Current price; stored in `prices`. */
export async function currentPrice(): Promise<Price> {
  const j = await get("/simple/price?ids=blockstack&vs_currencies=btc&precision=full&include_last_updated_at=true");
  const p: Price = {
    satsPerStx: (j.blockstack.btc * SATS).toFixed(6),
    source: "coingecko:simple/price",
    timestamp: j.blockstack.last_updated_at,
  };
  await pool.query(
    "INSERT INTO prices (source, sats_per_stx, price_timestamp, raw) VALUES ($1, $2, $3, $4)",
    [p.source, p.satsPerStx, p.timestamp, JSON.stringify(j)],
  );
  return p;
}

/** Hourly price nearest to a unix time (within 2 hours), or null. */
export async function priceAt(unix: number): Promise<Price | null> {
  try {
    const j = await get(
      `/coins/blockstack/market_chart/range?vs_currency=btc&from=${unix - 7200}&to=${unix + 7200}`,
    );
    const pts: [number, number][] = j.prices ?? [];
    if (pts.length === 0) return null;
    const [ms, btc] = pts.reduce((best, pt) =>
      Math.abs(pt[0] / 1000 - unix) < Math.abs(best[0] / 1000 - unix) ? pt : best,
    );
    return { satsPerStx: (btc * SATS).toFixed(6), source: "coingecko:market_chart/range", timestamp: Math.round(ms / 1000) };
  } catch {
    return null;
  }
}
