// Server-side data access. Every value keeps the API's field envelope, so the UI can
// always show where a number came from.
import { site } from "./site";

export type Provenance = "onchain" | "mirrored" | "hypothetical";
export type Field<T = number | string | null> = {
  value: T;
  unit: string;
  provenance: Provenance;
  source: string;
  note?: string;
};

export type Interval = {
  distribution_index: number;
  cycle: number;
  calculation_height: number;
  txid: string;
  gross_pool: Field<string>;
  obligation: Field<string>;
  bond_paid: Field<string>;
  shortfall: Field<string>;
  stx_only: Field<string>;
  reserve_deposit: Field<string>;
  reserve_balance: Field<string>;
  coverage: Field<number | null>;
  headroom: Field<number | null>;
  stx_only_yield: Field<number | null>;
  stx_only_apy_btc: Field<number | null>;
  price: Field<number | null>;
  cliff_price: Field<number | null>;
  crosscheck: { ok: boolean; note: string; method: string };
  risk_feed: { contract: string; network: string; txid: string | null; status: string | null; note: string };
};

export type PayoutRow = {
  bond_index: number;
  stx_value_ratio: string;
  target_rate_bps: string;
  shares_sats: string;
  target_per_interval_sats: string;
};

export type Current = {
  as_of: { taken_at: string; burn_height: number; stacks_height: number };
  cycle: Field<number | null>;
  coverage: Field<number | null>;
  headroom: Field<number | null>;
  obligation_per_interval: Field<string | null>;
  pending_pool: Field<string | null>;
  reserve: Field<string | null>;
  reserve_cover: Field<number | null>;
  reserve_state: Field<string | null>;
  payout_order: Field<PayoutRow[] | null>;
  latest_interval: Interval | null;
  price: Field<number | null>;
  cliff: {
    headline: Field<number | null>;
    price: Field<number | null>;
    sip_book_scenario: Field<number | null>;
    inputs: {
      distribution_index: number;
      price: Field<number | null>;
      gross_pool: Field<string>;
      obligation: Field<string>;
      sip_book_obligation: Field<string>;
    } | null;
    friedger_sip_inputs: Field<number | null>;
  };
};

export type Meta = {
  pox5: string;
  reader: string | null;
  feed: string;
  trait: { mainnet: string | null; testnet: string };
  guard: string;
  repo: string;
};

export type Stress = {
  inputs: {
    commit_drop: number;
    price_drop: number;
    base: string;
    base_pool: Field<string>;
    stx_shares: Field<string>;
    book: Field<unknown>;
    price: Field<number | null>;
  };
  assumption: string;
  commit_model: string;
  pool: Field<string>;
  obligation: Field<string>;
  coverage: Field<number | null>;
  headroom: Field<number | null>;
  shortfall: Field<string>;
  payout: Field<
    { position: number; bond_index: number; stx_value_ratio: string; target_sats: string; paid_sats: string; status: "full" | "partial" | "none" }[]
  >;
  reserve_deposit: Field<string>;
  stx_only: Field<string>;
  stx_only_yield: Field<number | null>;
  stx_only_apy_btc: Field<number | null>;
  cliff_price: Field<number | null>;
};

export type CycleHiro = {
  number: number;
  status: string;
  rewards: { btc: { total: string; waterfall: { bonds: string; stx_only: string; reserve_deposit: string }; claimed: string } };
  locked: { stx: { stx_only: string; bonds: string; total: string }; btc: { total: string; native: string; sbtc: string } };
  participants: { stakers: { stx_only: number; bonds: number }; signers: number | null };
};

async function get<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const r = await fetch(site.apiOrigin + path, { next: { revalidate } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export const getCurrent = () => get<Current>("/metrics/current");
export const getIntervals = () => get<{ count: number; intervals: Interval[] }>("/intervals");
export const getMeta = () => get<Meta>("/meta", 300);
export const getStress = (q = "") => get<Stress>(`/stress${q}`);
export const getCycle = (n: number) =>
  get<{ cycle: number; coverage: Field<number | null>; pool: Field<string | null>; obligation: Field<string | null>; hiro: Field<CycleHiro> | null; intervals: Interval[] }>(
    `/metrics/cycles/${n}`,
  );
