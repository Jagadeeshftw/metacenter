// Regression tests for `npm run verify`, replayed against real public data recorded on
// 4 Oct 2026 at Bitcoin block 969,802 (fixtures/distribution-288.json). No network.
//
//   npm test
//
// VERIFY_SCRIPT points the tests at another version of the script, to show they catch the bugs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const FIXTURE = path.join(HERE, "fixtures", "distribution-288.json");
const SCRIPT = path.resolve(ROOT, process.env.VERIFY_SCRIPT ?? "scripts/verify.mjs");
const fixture = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));

function verify() {
  const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "verify-")), "requests.log");
  const r = spawnSync(process.execPath, ["--import", path.join(HERE, "http-fixture.mjs"), SCRIPT, "--json"], {
    cwd: ROOT,
    env: { ...process.env, REPLAY: FIXTURE, REQUEST_LOG: log },
    encoding: "utf8",
  });
  const requests = fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : [];
  let out = null;
  try { out = JSON.parse(r.stdout); } catch {}
  return { status: r.status, out, stderr: r.stderr, requests };
}
const row = (out, group, figure) => out?.checks.find((c) => (c.group ?? group).startsWith(group) && c.figure === figure);

// Clarity uint result -> BigInt, for reading the recorded pox-5 answers directly.
const uintOf = (hex) => BigInt("0x" + hex.replace(/^0x/, "").slice(2));
const sharesRead = (tip) => {
  const k = Object.keys(fixture).find((k) => k.includes("/pox-5/get-total-shares-staked-for-cycle" + (tip ? `?tip=${tip}` : " ")) &&
    k.includes('"arguments":["0x0100000000000000000000000000000090","0x0a0100000000000000000000000000000001"]'));
  return k ? uintOf(JSON.parse(fixture[k].body).result) : null;
};

test("the distribution is priced at its calculate-rewards transaction, not at a Bitcoin block Hiro may not know", () => {
  // The bug: distribution 288's calculation height, Bitcoin block 969,499, has no Stacks block, and
  // Hiro answers 404 for it. The fixture keeps that real 404 so the old code path fails here.
  assert.equal(fixture["GET https://api.hiro.so/extended/v2/burn-blocks/969499"]?.status, 404);
  const { out, stderr, requests } = verify();
  assert.ok(out, `verify did not finish: ${stderr.trim()}`);
  assert.equal(requests.filter((q) => q.includes("/extended/v2/burn-blocks/")).length, 0, "asked Hiro for a burn block's time");
  assert.ok(requests.some((q) => q.includes("/extended/v1/tx/0xcea40e3b35449a2dd11d3dc45c38a98b042f5930e52a82cacb420ef4539e1c58")));
  assert.equal(row(out, "distribution", "STX-only APY (BTC terms)")?.pass, true);
});

test("distribution figures are read from pox-5 at the distribution's own block, so a later share change cannot break them", () => {
  // The bug: bond 1's cycle-144 shares fell by 2,500,000 sats on mainnet after distribution 288.
  // Recomputing from the chain tip made the correct published obligation and pool look wrong.
  const { out, stderr } = verify();
  assert.ok(out, `verify did not finish: ${stderr.trim()}`);
  // the state just after the distribution, as the indexer's cross-check recorded it
  const after = "dfb022f170dab0e9c24aa749a6e336c9afc11a65a2775cef9ab240fdb2c76df6";
  assert.equal(out.read_at.distribution?.state_after?.replace(/^0x/, ""), after, "pox-5 was not read at the distribution's block");
  const atDistribution = sharesRead(after);
  const atTip = sharesRead(null);
  assert.equal(atDistribution, 23_016_977_552n);
  assert.equal(atTip, 23_014_477_552n, "the fixture should hold the real, later share change");
  const obligation = row(out, "distribution", "Obligation (sats)");
  assert.equal(obligation.recomputed, "13,810,186");
  assert.equal(obligation.pass, true);
  assert.equal(row(out, "distribution", "Reward pool (sats)").pass, true);
});

test("every check passes on the recorded data", () => {
  const { status, out, stderr } = verify();
  assert.equal(status, 0, stderr);
  assert.equal(out.failed, 0, JSON.stringify(out.checks.filter((c) => !c.pass), null, 1));
  assert.equal(out.passed, 18);
});
