// STX/BTC price (mirrored). Every stored price keeps its source and timestamp.
// Primary: CoinGecko STX/BTC. Fallback (e.g. when CoinGecko rate-limits a shared
// IP): Coinbase Exchange STX-USD and BTC-USD, crossed through USD.
import { config } from "./config.js";
import { pool } from "./db.js";

export type Price = { satsPerStx: string; source: string; timestamp: number };

const SATS = 100_000_000;
const COINBASE = "https://api.exchange.coinbase.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, retries = 2): Promise<any> {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "metacenter-indexer" } });
    if (r.ok) return r.json();
    if (r.status === 429 && i < retries) {
      await sleep(5_000 * (i + 1));
      continue;
    }
    throw new Error(`${url}: ${r.status}`);
  }
}

async function coingeckoNow(): Promise<Price> {
  const j = await get(`${config.coingecko}/simple/price?ids=blockstack&vs_currencies=btc&precision=full&include_last_updated_at=true`);
  return { satsPerStx: (j.blockstack.btc * SATS).toFixed(6), source: "coingecko:simple/price", timestamp: j.blockstack.last_updated_at };
}

async function coinbaseNow(): Promise<Price> {
  const stx = await get(`${COINBASE}/products/STX-USD/ticker`);
  const btc = await get(`${COINBASE}/products/BTC-USD/ticker`);
  return {
    satsPerStx: ((Number(stx.price) / Number(btc.price)) * SATS).toFixed(6),
    source: "coinbase:ticker STX-USD/BTC-USD",
    timestamp: Math.round(Date.parse(stx.time) / 1000),
  };
}

/** Current price; stored in `prices`. */
export async function currentPrice(): Promise<Price> {
  let p: Price;
  try {
    p = await coingeckoNow();
  } catch {
    p = await coinbaseNow();
  }
  await pool.query("INSERT INTO prices (source, sats_per_stx, price_timestamp, raw) VALUES ($1, $2, $3, $4)", [
    p.source,
    p.satsPerStx,
    p.timestamp,
    JSON.stringify(p),
  ]);
  return p;
}

async function coingeckoAt(unix: number): Promise<Price | null> {
  const j = await get(`${config.coingecko}/coins/blockstack/market_chart/range?vs_currency=btc&from=${unix - 7200}&to=${unix + 7200}`);
  const pts: [number, number][] = j.prices ?? [];
  if (pts.length === 0) return null;
  const [ms, btc] = pts.reduce((best, pt) => (Math.abs(pt[0] / 1000 - unix) < Math.abs(best[0] / 1000 - unix) ? pt : best));
  return { satsPerStx: (btc * SATS).toFixed(6), source: "coingecko:market_chart/range", timestamp: Math.round(ms / 1000) };
}

async function coinbaseAt(unix: number): Promise<Price | null> {
  const hour = Math.floor(unix / 3600) * 3600;
  const range = `granularity=3600&start=${new Date(hour * 1000).toISOString()}&end=${new Date((hour + 3600) * 1000).toISOString()}`;
  // candles: [time, low, high, open, close, volume]
  const stx: number[][] = await get(`${COINBASE}/products/STX-USD/candles?${range}`);
  const btc: number[][] = await get(`${COINBASE}/products/BTC-USD/candles?${range}`);
  const s = stx.find((c) => c[0] === hour);
  const b = btc.find((c) => c[0] === hour);
  if (!s || !b) return null;
  return { satsPerStx: ((s[4] / b[4]) * SATS).toFixed(6), source: "coinbase:candles-1h STX/BTC via USD", timestamp: hour };
}

/** Hourly price nearest to a unix time, or null if no source has it. */
export async function priceAt(unix: number): Promise<Price | null> {
  try {
    const p = await coingeckoAt(unix);
    if (p) return p;
  } catch {
    // fall through
  }
  try {
    return await coinbaseAt(unix);
  } catch {
    return null;
  }
}

/** Retry prices for distributions recorded while every source was unavailable. */
export async function fillMissingPrices() {
  const r = await pool.query("SELECT distribution_index, burn_block_time FROM intervals WHERE price_sats_per_stx IS NULL");
  for (const row of r.rows) {
    const p = await priceAt(Number(row.burn_block_time));
    if (!p) continue;
    await pool.query(
      "UPDATE intervals SET price_sats_per_stx = $2, price_source = $3, price_timestamp = $4 WHERE distribution_index = $1",
      [row.distribution_index, p.satsPerStx, p.source, p.timestamp],
    );
  }
}
