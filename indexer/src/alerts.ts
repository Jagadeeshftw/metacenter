// Sending side of the Telegram broadcast prototype: dedup state and the one network call.
//
// Off unless TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL are set. It runs as one isolated step in
// the poll loop, reads this service's own public API, and never logs the token. The rules and
// the wording live in alerts-core.ts.
import { config } from "./config.js";
import { pool } from "./db.js";
import { evaluate, readState, type Posted } from "./alerts-core.js";

const TELEGRAM = "https://api.telegram.org";

const getPosted = async (): Promise<Posted> => (await pool.query("SELECT v FROM kv WHERE k = 'alerts'")).rows[0]?.v ?? {};
const setPosted = (v: Posted) =>
  pool.query("INSERT INTO kv (k, v, updated_at) VALUES ('alerts', $1, now()) ON CONFLICT (k) DO UPDATE SET v = $1, updated_at = now()", [
    JSON.stringify(v),
  ]);

/** Send one message. The token is read here and never logged or returned. */
async function send(text: string): Promise<void> {
  const r = await fetch(`${TELEGRAM}/bot${config.telegramToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: config.telegramChannel, text, disable_web_page_preview: false }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    // strip anything token-shaped before this reaches a log
    throw new Error(`telegram ${r.status}: ${body.replace(/\d{6,}:[A-Za-z0-9_-]{20,}/g, "[token]").slice(0, 200)}`);
  }
}

/** One pass: work out what is new and post it. Off unless the token and channel are set. */
export async function runAlerts(log = console.log) {
  if (!config.telegramToken || !config.telegramChannel) return;
  const state = await readState(`http://127.0.0.1:${config.port}`);
  const posted = await getPosted();
  const due = evaluate(state, posted);
  if (due.length === 0) return;

  const next: Posted = { distributions: [...(posted.distributions ?? [])], active: [...(posted.active ?? [])], bonds: [...(posted.bonds ?? [])] };
  for (const a of due) {
    await send(a.text);
    log(`alerts: posted ${a.key} to ${config.telegramChannel}`);
    if (a.kind === "distribution") next.distributions = [...new Set([...(next.distributions ?? []), state.distribution!])].slice(-50);
    if (a.kind === "bond") next.bonds = [...new Set([...(next.bonds ?? []), Number(a.key.split(":")[1])])];
    if (a.kind === "warning") next.active = [...new Set([...(next.active ?? []), a.key.replace(/^warn:/, "")])];
    if (a.kind === "resolved") next.active = (next.active ?? []).filter((k) => k !== a.key.replace(/^resolved:/, ""));
    await setPosted(next); // after each send, so a failure cannot repost what already went out
  }
}
