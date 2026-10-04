// Record or replay every HTTP request a script makes, so its behaviour can be tested against a
// fixed snapshot of real public data. Loaded with `node --import`:
//
//   RECORD=fixtures/x.json node --import ./scripts/test/http-fixture.mjs scripts/verify.mjs
//   REPLAY=fixtures/x.json node --import ./scripts/test/http-fixture.mjs scripts/verify.mjs
//
// Replay answers only requests that were recorded; anything else is a test failure, so a script
// that starts calling a new endpoint (or an old, broken one) cannot pass by accident. Every
// replayed request is appended to REQUEST_LOG when it is set.
import fs from "node:fs";

const key = (url, init = {}) => `${(init.method ?? "GET").toUpperCase()} ${url}${init.body ? ` ${init.body}` : ""}`;
const real = globalThis.fetch;

if (process.env.RECORD) {
  const file = process.env.RECORD;
  const store = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  globalThis.fetch = async (url, init) => {
    const r = await real(url, init);
    const body = await r.text();
    if (r.status !== 429) {
      store[key(String(url), init)] = { status: r.status, body };
      fs.writeFileSync(file, JSON.stringify(store, null, 1) + "\n");
    }
    return new Response(body, { status: r.status, headers: r.headers });
  };
} else if (process.env.REPLAY) {
  const store = JSON.parse(fs.readFileSync(process.env.REPLAY, "utf8"));
  globalThis.fetch = async (url, init) => {
    const k = key(String(url), init);
    if (process.env.REQUEST_LOG) fs.appendFileSync(process.env.REQUEST_LOG, k + "\n");
    const hit = store[k];
    if (!hit) throw new Error(`not in the fixture: ${k.slice(0, 200)}`);
    return new Response(hit.body, { status: hit.status, headers: { "content-type": "application/json" } });
  };
}
