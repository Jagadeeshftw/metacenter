import { describe, it, expect, vi } from "vitest";

vi.mock("./db.js", () => ({ pool: { query: async () => ({ rows: [] }) } }));

const { checkRoutes, PUBLIC_ROUTES } = await import("./routes-check.js");

/** A stand-in for the server: answers each route with whatever the test puts in the map. */
const fake = (answers: Record<string, { statusCode: number; body: unknown }>) =>
  ({
    inject: async ({ url }: { url: string }) => {
      const a = answers[url] ?? { statusCode: 200, body: { ok: true } };
      return { statusCode: a.statusCode, json: () => a.body };
    },
  }) as any;

describe("the public route check", () => {
  it("passes when every route answers 200 with real data", async () => {
    const results = await checkRoutes(fake({}));
    expect(results).toHaveLength(PUBLIC_ROUTES.length);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("catches a route that starts failing, which is what /api/bonds/order did", async () => {
    const results = await checkRoutes(fake({ "/bonds/order": { statusCode: 500, body: { error: "call-read ... CostBalanceExceeded" } } }));
    const bad = results.find((r) => r.route === "/bonds/order")!;
    expect(bad.ok).toBe(false);
    expect(bad.problem).toBe("HTTP 500");
  });

  it("catches a 200 whose figures were nulled out by a refused read", async () => {
    const hollowBody = {
      cycle: 141,
      coverage: { value: null, unit: "x", provenance: "onchain", source: "pox5-reader::get-coverage-for-cycle", note: "this read-only cannot be called through the public Hiro API" },
      pool: { value: "1", unit: "sats", provenance: "mirrored", source: "events" },
    };
    const results = await checkRoutes(fake({ "/metrics/cycles/143": { statusCode: 200, body: hollowBody } }));
    const bad = results.find((r) => r.route === "/metrics/cycles/143")!;
    expect(bad.ok).toBe(false);
    expect(bad.problem).toContain("unavailable");
    expect(bad.problem).toContain("coverage");
  });

  it("does not mind a null that carries no failure note, such as n/a with no bonds", async () => {
    const body = { coverage: { value: null, unit: "x", provenance: "onchain", source: "s", note: "n/a: no bonds" } };
    const results = await checkRoutes(fake({ "/metrics/current": { statusCode: 200, body } }));
    expect(results.find((r) => r.route === "/metrics/current")!.ok).toBe(true);
  });
});
