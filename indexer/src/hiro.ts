import { serializeCV, deserializeCV, type ClarityValue } from "@stacks/transactions";
import { config } from "./config.js";
import { toPlain } from "./clarity.js";

// Hiro allows 50 req/min per IP without a key and 500 with one; stay under.
const minGapMs = config.hiroApiKey ? 60_000 / 450 : 60_000 / 45;
let nextSlot = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pace() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + minGapMs;
  if (wait) await sleep(wait);
}

export async function hiro<T = any>(
  path: string,
  opts: { network?: "mainnet" | "testnet"; method?: string; body?: unknown; allow404?: boolean } = {},
): Promise<T> {
  const base = opts.network === "testnet" ? config.testnetApi : config.mainnetApi;
  for (let attempt = 0; ; attempt++) {
    await pace();
    const res = await fetch(base + path, {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.body ? { "content-type": "application/json" } : {}),
        ...(config.hiroApiKey ? { "x-api-key": config.hiroApiKey } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 404 && opts.allow404) return null as T;
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(2_000 * 2 ** attempt);
      continue;
    }
    throw new Error(`hiro ${opts.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  }
}

/** Call a read-only function. `tip` is an index block hash (historical state). */
export async function callRead(
  contract: string,
  fn: string,
  args: ClarityValue[] = [],
  opts: { tip?: string; network?: "mainnet" | "testnet" } = {},
): Promise<any> {
  const [address, name] = contract.split(".");
  const tip = opts.tip ? `?tip=${opts.tip.replace(/^0x/, "")}` : "";
  const r = await hiro<{ okay: boolean; result?: string; cause?: string }>(
    `/v2/contracts/call-read/${address}/${name}/${fn}${tip}`,
    {
      method: "POST",
      network: opts.network,
      body: { sender: address, arguments: args.map((a) => "0x" + serializeCV(a)) },
    },
  );
  if (!r.okay || !r.result) throw new Error(`call-read ${contract}::${fn}: ${r.cause}`);
  return toPlain(deserializeCV(r.result));
}

/** Index block hash of a Stacks block height. */
export async function indexHashAt(height: number): Promise<string> {
  const b = await hiro<{ index_block_hash: string }>(`/extended/v2/blocks/${height}`);
  return b.index_block_hash;
}
