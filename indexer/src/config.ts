const env = (name: string, fallback?: string) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`missing env ${name}`);
  return v;
};

export const config = {
  port: Number(env("PORT", "8080")),
  databaseUrl: env("DATABASE_URL"),
  pollMs: Number(env("POLL_MS", String(10 * 60 * 1000))),

  mainnetApi: env("HIRO_MAINNET_API", "https://api.hiro.so"),
  testnetApi: env("HIRO_TESTNET_API", "https://api.testnet.hiro.so"),
  hiroApiKey: process.env.HIRO_API_KEY || undefined,

  pox5: "SP000000000000000000002Q6VF78.pox-5",
  sbtcToken: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
  // mainnet pox5-reader; empty until deployed, onchain fields report unavailable
  readerContract: process.env.READER_CONTRACT || undefined,
  // testnet risk-feed and its publisher key
  feedContract: env("FEED_CONTRACT", "ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed"),
  publisherKey: process.env.PUBLISHER_KEY || undefined,

  firstPox5Cycle: 141,
  coingecko: env("COINGECKO_API", "https://api.coingecko.com/api/v3"),
};
