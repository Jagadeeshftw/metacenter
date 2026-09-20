import { config } from "./config.js";
import { migrate, pool } from "./db.js";
import { syncDistributions } from "./distributions.js";
import { syncCycles, takeLiveSnapshot } from "./live.js";
import { currentPrice, fillMissingPrices } from "./price.js";
import { publishPending } from "./publisher.js";
import { runKeeper } from "./keeper.js";
import { buildApi } from "./api.js";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e: any) {
    log(`${name} failed:`, e?.message ?? e);
  }
}

let running = false;
async function poll() {
  if (running) return;
  running = true;
  const t0 = Date.now();
  try {
    let cycle = 0;
    await step("live", async () => {
      cycle = (await takeLiveSnapshot()).cycle;
    });
    await step("price", currentPrice);
    await step("distributions", () => syncDistributions(log));
    await step("missing prices", fillMissingPrices);
    if (cycle) await step("cycles", () => syncCycles(cycle));
    await step("publish", () => publishPending(log));
    await step("keeper", () => runKeeper(log));
  } finally {
    running = false;
    log(`poll done in ${Math.round((Date.now() - t0) / 1000)}s`);
  }
}

async function main() {
  await migrate();
  if (process.argv.includes("--once")) {
    await poll();
    await pool.end();
    return;
  }
  const app = await buildApi();
  await app.listen({ port: config.port, host: "0.0.0.0" });
  log(
    `api listening on ${config.port}; reader ${config.readerContract ?? "(not deployed)"}; cache ${config.cacheContract ?? "(none)"}; feed ${config.feedContract}; publisher ${config.publisherKey ? "on" : "off"}; keeper ${config.keeperKey ? "on" : "off"}`,
  );
  void poll();
  setInterval(poll, config.pollMs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
