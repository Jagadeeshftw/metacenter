// Site-wide configuration. Two handles to fill in once they exist: the X handle (without the @)
// and the Telegram alerts channel (without the @). Each link appears only when its value is set.
export const X_HANDLE = "";
export const TELEGRAM_CHANNEL = "";

export const SITE_URL = "https://metacenter.0xo.in";

export const site = {
  name: "Metacenter",
  url: SITE_URL,
  // public API base for docs and integrators; proxied to the indexer
  apiBase: `${SITE_URL}/api`,
  description:
    "Risk feed for Stacks Bitcoin Staking (PoX-5): bond coverage, the reserve, STX-only yield and stress tests, from public data.",
  repo: "https://github.com/Jagadeeshftw/metacenter",
  xUrl: X_HANDLE ? `https://x.com/${X_HANDLE}` : null,
  telegramUrl: TELEGRAM_CHANNEL ? `https://t.me/${TELEGRAM_CHANNEL}` : null,
  // server-side only; the browser always goes through /api on this site's own domain
  apiOrigin: process.env.METACENTER_API_ORIGIN ?? "https://metacenter-indexer-production.up.railway.app",
  explorer: (id: string, network: "mainnet" | "testnet") =>
    `https://explorer.hiro.so/txid/${id}?chain=${network}`,
};

// Contract test counts, from contracts/tests (simnet) and contracts/tests-fork (mainnet fork).
export const TESTS = { simnet: 36, fork: 11 };
