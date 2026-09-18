// Pure pox-5 math, mirroring the contract (pox-5 calculate-rewards / calculate-bond-rewards).
// Integer (bigint) arithmetic with the same truncation as Clarity.

export const RESERVE_RATIO = 1500n; // bps
export const INTERVALS_PER_YEAR = 50n; // the `/ u50` in pox-5 target-yield

export type Bond = { bondIndex: number; stxValueRatio: bigint; targetRate: bigint; shares: bigint };
export type BondPayout = Bond & { target: bigint; paid: bigint; status: "full" | "partial" | "none" };

export const targetPerInterval = (shares: bigint, rate: bigint) => (shares * rate) / 10000n / INTERVALS_PER_YEAR;

/** pox-5 order: descending stx-value-ratio, ties to the lower bond index. */
export const payoutOrder = <T extends { bondIndex: number; stxValueRatio: bigint }>(bonds: T[]) =>
  [...bonds].sort((a, b) =>
    a.stxValueRatio === b.stxValueRatio ? a.bondIndex - b.bondIndex : a.stxValueRatio > b.stxValueRatio ? -1 : 1,
  );

/** Split one interval's pool the way pox-5 does. */
export function waterfall(pool: bigint, bonds: Bond[], stxShares: bigint) {
  let remaining = pool;
  const out: BondPayout[] = [];
  for (const b of payoutOrder(bonds)) {
    const target = targetPerInterval(b.shares, b.targetRate);
    const paid = remaining >= target ? target : remaining;
    remaining -= paid;
    out.push({ ...b, target, paid, status: paid === target ? "full" : paid === 0n ? "none" : "partial" });
  }
  const reserveCut = (remaining * RESERVE_RATIO) / 10000n;
  const stxOnly = stxShares === 0n ? 0n : remaining - reserveCut;
  const reserveDeposit = stxShares === 0n ? remaining : reserveCut;
  const obligation = out.reduce((s, b) => s + b.target, 0n);
  const bondPaid = out.reduce((s, b) => s + b.paid, 0n);
  return {
    bonds: out,
    obligation,
    bondPaid,
    shortfall: obligation - bondPaid,
    reserveDeposit,
    stxOnly,
    coverageBps: obligation === 0n ? null : (pool * 10000n) / obligation,
    headroomBps: obligation === 0n || pool === 0n ? null : pool >= obligation ? ((pool - obligation) * 10000n) / pool : 0n,
  };
}

/** Pool after a what-if. Assumption: miner BTC bids scale linearly with STX price. */
export const stressedPool = (pool: bigint, commitDrop: number, priceDrop: number) => {
  const keep = BigInt(Math.round((1 - commitDrop) * (1 - priceDrop) * 1e9));
  return (pool * keep) / 1_000_000_000n;
};

/** Hypothetical multi-bond book: `count` equal bonds totalling `bookBtc`, ratios stepped 5% apart. */
export function hypotheticalBook(bookBtc: number, count: number, rateBps: bigint, topRatio: bigint): Bond[] {
  const total = BigInt(Math.round(bookBtc * 1e8));
  return Array.from({ length: count }, (_, i) => ({
    bondIndex: i + 1,
    stxValueRatio: (topRatio * BigInt(100 - 5 * i)) / 100n,
    targetRate: rateBps,
    shares: total / BigInt(count),
  }));
}

/**
 * STX price (sats/STX) at which the pool equals the obligation, holding everything
 * else fixed. Assumption: pool scales linearly with STX price (miner bids track the
 * value of the STX they win).
 */
export const cliffSatsPerStx = (price: number, pool: bigint, obligation: bigint) =>
  pool === 0n || obligation === 0n ? null : (price * Number(obligation)) / Number(pool);

/** friedger's cliff under SIP launch inputs: annual obligation / (STX per block * blocks per year). */
export const friedgerCliff = (bookBtc = 3000, rate = 0.03, stxPerBlock = 1000, blocksPerYear = 52560) =>
  (bookBtc * rate * 1e8) / (stxPerBlock * blocksPerYear);
