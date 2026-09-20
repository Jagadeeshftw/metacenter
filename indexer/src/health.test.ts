// The uptime monitor matches the raw bytes `"status":"ok"` in the /health response body.
//
// That makes the exact serialisation a contract, not an implementation detail: renaming the
// field, reordering it behind a wrapper, pretty-printing the JSON, or quoting it differently
// would all keep the endpoint "working" while silently turning the monitor into a permanent
// false alarm. These tests fail first instead.
//
// If you need to change the shape of this response, change the monitor's keyword at the same
// time and update docs/RUNBOOK.md, where the dependency is written down.
import { describe, it, expect, beforeAll, vi } from "vitest";

process.env.DATABASE_URL ??= "postgres://test/test";
process.env.READER_CONTRACT ??= "SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader";
process.env.CACHE_CONTRACT ??= "SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.coverage-cache";

const now = new Date().toISOString();
const healthyRows = (sql: string) => {
  if (/FROM live_snapshots/.test(sql))
    return {
      rows: [
        {
          taken_at: now,
          burn_height: 967910,
          stacks_height: 9035231,
          current_cycle: 143,
          reader: { cache: { contract: process.env.CACHE_CONTRACT, updated_at: 967793 } },
          pox5: { "get-last-reward-compute-height": "967399" },
        },
      ],
    };
  if (/FROM intervals/.test(sql))
    return { rows: [{ distribution_index: 286, calculation_height: 967399, crosscheck_ok: true }] };
  if (/FROM kv/.test(sql)) return { rows: [] };
  return { rows: [{ "?column?": 1 }] };
};

// The database is the only thing /health needs that a test cannot have.
const query = vi.fn(async (sql: string) => healthyRows(sql));
vi.mock("./db.js", () => ({ pool: { query: (sql: string) => query(sql) }, migrate: async () => {} }));

let buildApi: typeof import("./api.js").buildApi;
beforeAll(async () => {
  ({ buildApi } = await import("./api.js"));
});

const get = async () => {
  const app = await buildApi();
  const res = await app.inject({ method: "GET", url: "/health" });
  await app.close();
  return res;
};

describe("/health, as the uptime monitor reads it", () => {
  it('emits exactly "status":"ok" when everything is healthy', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    // the monitored byte sequence: no space after the colon, lowercase, double quotes
    expect(res.body).toContain('"status":"ok"');
    expect(res.body.indexOf('"status":"ok"')).toBe(1); // first key in the object
  });

  it("is minified JSON: no pretty-printing, no spaces after colons", async () => {
    const res = await get();
    expect(res.body).not.toMatch(/"status"\s*:\s+"/);
    expect(res.body).not.toContain("\n");
    expect(res.body.startsWith("{")).toBe(true);
  });

  it("uses the same field and the same spelling when degraded", async () => {
    query.mockImplementationOnce(async (sql: string) => healthyRows(sql)); // SELECT 1
    query.mockImplementationOnce(async () => ({ rows: [] })); // no live snapshot: degraded
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('"status":"degraded"');
    expect(res.body).not.toContain('"status":"ok"');
  });

  it('answers 503 with "status":"down" when the database is unreachable', async () => {
    query.mockImplementationOnce(async () => {
      throw new Error("ECONNREFUSED");
    });
    const res = await get();
    expect(res.statusCode).toBe(503);
    expect(res.body).toContain('"status":"down"');
  });

  it("keeps the status values the monitor can see to a known set", async () => {
    const res = await get();
    const status = JSON.parse(res.body).status;
    expect(["ok", "degraded", "down"]).toContain(status);
  });
});
