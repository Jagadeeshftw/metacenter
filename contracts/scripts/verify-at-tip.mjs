// Check the deployed mainnet contract against the repo, then run tests-tip against a fork of
// mainnet pinned at the current chain tip.
//
//   node scripts/verify-at-tip.mjs [<reader-contract-id>]
//
// Writes Clarinet.tip.toml (git-ignored) with the tip height and runs vitest.tip.config.ts.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const API = "https://api.hiro.so";
const READER = process.argv[2] ?? "SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader";
const [addr, name] = READER.split(".");

const onchain = (await (await fetch(`${API}/v2/contracts/source/${addr}/${name}`)).json()).source;
const repo = fs.readFileSync(`contracts/${name}.clar`, "utf8");
const sha = (s) => createHash("sha256").update(s.replace(/\n+$/, "\n")).digest("hex");
if (sha(onchain) !== sha(repo)) throw new Error(`${READER} source differs from contracts/${name}.clar`);
console.log(`${READER}: source matches the repo (sha256 ${sha(repo).slice(0, 16)}…, trailing newline ignored)`);

const info = await (await fetch(`${API}/v2/info`)).json();
const block = await (await fetch(`${API}/extended/v2/blocks/${info.stacks_tip_height}`)).json();
const manifest = fs
  .readFileSync("Clarinet.fork.toml", "utf8")
  .replace(/^name = .*/m, 'name = "metacenter-tip"')
  .replace(/initial_height = \d+/, `initial_height = ${info.stacks_tip_height}`)
  .replace(/^# Mainnet fork pinned.*\n(#.*\n)*/m, `# Mainnet fork at the tip when this was written: Stacks ${info.stacks_tip_height} (Bitcoin ${info.burn_block_height}).\n`);
fs.writeFileSync("Clarinet.tip.toml", manifest);
console.log(`fork pinned at Stacks block ${info.stacks_tip_height} (Bitcoin ${info.burn_block_height}), index hash ${block.index_block_hash}\n`);

execFileSync("npx", ["vitest", "run", "--config", "vitest.tip.config.ts"], {
  stdio: "inherit",
  env: { ...process.env, FORK_TIP_INDEX_HASH: block.index_block_hash },
});
