// Every public route, called against this service on each poll.
//
// /api/bonds/order answered 500 for days without anyone noticing: the dashboard did not use it,
// so nothing watched it. The uptime monitors watch the site and /health, not each documented
// route. This closes that gap: the poll calls every route, and a failure turns /health
// "degraded", which the monitor's "status":"ok" keyword already catches.
//
// It also looks past the status code. A route that answers 200 with its figures nulled out
// because a read was refused is the same kind of silent failure, so a response whose fields are
// null and carry a "cannot be called" note counts as degraded too.
import type { FastifyInstance } from "fastify";
import { pool } from "./db.js";

/** The routes the docs and the grant application point at. Keep in step with /docs/api. */
export const PUBLIC_ROUTES = [
  "/",
  "/meta",
  "/health",
  "/metrics/current",
  "/metrics/cycles/143",
  "/intervals",
  "/bonds/order",
  "/stress",
  "/stress?commit_drop=0.5",
  "/stress?book_btc=3000&bonds=6",
];

export type RouteResult = { route: string; status: number; ok: boolean; problem?: string };

/** Fields nulled out with a reason are a failure too, not a healthy 200. */
function hollow(body: unknown): string | null {
  const dead: string[] = [];
  const walk = (v: any, key: string) => {
    if (!v || typeof v !== "object") return;
    if ("value" in v && "provenance" in v && v.value === null && typeof v.note === "string" && /cannot be called|not deployed/i.test(v.note))
      dead.push(key);
    else for (const [k, child] of Object.entries(v)) walk(child, k);
  };
  walk(body, "root");
  return dead.length ? `${dead.length} field(s) unavailable: ${[...new Set(dead)].slice(0, 6).join(", ")}` : null;
}

export async function checkRoutes(app: FastifyInstance): Promise<RouteResult[]> {
  const out: RouteResult[] = [];
  for (const route of PUBLIC_ROUTES) {
    try {
      const res = await app.inject({ method: "GET", url: route });
      const status = res.statusCode;
      if (status !== 200) {
        out.push({ route, status, ok: false, problem: `HTTP ${status}` });
        continue;
      }
      let problem: string | null = null;
      try {
        problem = hollow(res.json());
      } catch {
        problem = "response was not JSON";
      }
      out.push({ route, status, ok: problem === null, ...(problem ? { problem } : {}) });
    } catch (e: any) {
      out.push({ route, status: 0, ok: false, problem: String(e?.message ?? e).slice(0, 120) });
    }
  }
  return out;
}

export async function recordRouteCheck(app: FastifyInstance, log = console.log) {
  const results = await checkRoutes(app);
  const failing = results.filter((r) => !r.ok);
  for (const r of failing) log(`routes: ${r.route} -> ${r.problem}`);
  await pool.query(
    "INSERT INTO kv (k, v, updated_at) VALUES ('routes', $1, now()) ON CONFLICT (k) DO UPDATE SET v = $1, updated_at = now()",
    [JSON.stringify({ checked_at: new Date().toISOString(), results })],
  );
  return results;
}

export async function lastRouteCheck(): Promise<{ checked_at: string; results: RouteResult[] } | null> {
  return (await pool.query("SELECT v FROM kv WHERE k = 'routes'")).rows[0]?.v ?? null;
}
