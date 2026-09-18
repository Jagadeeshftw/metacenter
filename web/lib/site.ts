// Site-wide configuration. The X handle is the one value to fill in once it exists
// (without the @); the footer shows the X link only when it is set.
export const X_HANDLE = "";

export const site = {
  name: "Metacenter",
  description:
    "Risk feed for Stacks Bitcoin Staking (PoX-5): bond coverage, the reserve, STX-only yield and stress tests, from public data.",
  repo: "https://github.com/Jagadeeshftw/metacenter",
  xUrl: X_HANDLE ? `https://x.com/${X_HANDLE}` : null,
  // server-side only; the browser always goes through /api on this site's own domain
  apiOrigin: process.env.METACENTER_API_ORIGIN ?? "https://metacenter-indexer-production.up.railway.app",
  explorer: (id: string, network: "mainnet" | "testnet") =>
    `https://explorer.hiro.so/txid/${id}?chain=${network}`,
};

// Contract test counts, from contracts/tests (simnet) and contracts/tests-fork (mainnet fork).
export const TESTS = { simnet: 36, fork: 11 };
