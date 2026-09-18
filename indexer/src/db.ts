import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config } from "./config.js";

// numeric -> string (never lossy)
pg.types.setTypeParser(1700, (v) => v);
pg.types.setTypeParser(20, (v) => v);

const internal = /\.railway\.internal/.test(config.databaseUrl);
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: internal || /localhost|127\.0\.0\.1/.test(config.databaseUrl) ? false : { rejectUnauthorized: false },
  max: 5,
});

export async function migrate() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  // schema.sql sits next to src/ files; in dist it is copied by the build step
  const candidates = [path.join(dir, "schema.sql"), path.join(dir, "..", "src", "schema.sql")];
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) throw new Error("schema.sql not found");
  await pool.query(fs.readFileSync(file, "utf8"));
}

export async function kvGet<T>(k: string): Promise<T | null> {
  const r = await pool.query("SELECT v FROM kv WHERE k = $1", [k]);
  return r.rows[0]?.v ?? null;
}

export async function kvSet(k: string, v: unknown) {
  await pool.query(
    "INSERT INTO kv (k, v, updated_at) VALUES ($1, $2, now()) ON CONFLICT (k) DO UPDATE SET v = $2, updated_at = now()",
    [k, JSON.stringify(v)],
  );
}
