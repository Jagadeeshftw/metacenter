# Runbook

How Metacenter runs, what happens when a piece fails, and the jobs that are due later.

## Where it runs

| Piece | Where | Restart | State |
|---|---|---|---|
| Site (`web/`) | Vercel, `metacenter.0xo.in` | Vercel serves the last successful build; a failed build never replaces a working one | none; pages are rebuilt from the API every 60 s |
| API and indexer (`indexer/`) | Railway service `metacenter-indexer` | `ON_FAILURE`, up to 10 retries, with `/health` as the deploy health check (`indexer/railway.json`) | none in the container |
| Database | Railway Postgres, volume `postgres-volume` at `/var/lib/postgresql/data` | Railway restarts the service; the volume is not touched | all indexed history |

**A redeploy does not lose history.** The indexer and Postgres are separate services: redeploying the indexer replaces its container only, and the database keeps its volume. The schema is applied at every start and is idempotent.

**If the database is lost entirely, the history rebuilds itself from public chain data.** Nothing in it is private or hand-entered: `syncDistributions` walks every distribution index from the first PoX-5 cycle, binary-searches Stacks blocks for the one whose state first shows that `last-reward-compute-height` (`call-read ?tip=`), reads the `calculate-rewards` events from that transaction, and recomputes each figure from state before and after the block. That is how the current rows were built in the first place, against an empty database. Prices are re-fetched per distribution from CoinGecko, with Coinbase as a fallback.

Restore, in order of preference:

1. **Let it rebuild.** Start the indexer against an empty database. It re-indexes every distribution and cross-checks each one; the API reports `"status": "degraded"` until the first poll lands.
2. **Restore a Railway backup.** The Postgres service keeps automated backups in the Railway dashboard (Service → Backups). Use this to skip the re-index.
3. **Restore a dump** taken with `railway ssh --service Postgres -- pg_dump -Fc railway > metacenter.dump`, replayed with `pg_restore`. The database host is internal to Railway, so both run through `railway ssh`.

**When the API is down**, the site keeps serving: `web/lib/api.ts` falls back to the last good response and then to `web/data/fallback.json`, a committed snapshot, and the dashboard shows "Data as of block N · refreshing". Refresh the snapshot with `node web/scripts/snapshot-fallback.mjs`.

**Health:** `https://metacenter.0xo.in/api/health` returns `status: ok | degraded | down`, with per-check detail (database, indexer poll age, latest distribution indexed, coverage-cache staleness in burn blocks, keeper balance and last action). It answers 503 only when the database is unreachable.


## Monitoring

| Monitor | URL | Expect |
|---|---|---|
| Site | `https://metacenter.0xo.in/` | HTTP 200 |
| API | `https://metacenter.0xo.in/api/metrics/current` | HTTP 200 and the keyword `as_of` |
| Health | `https://metacenter.0xo.in/api/health` | the keyword `"status":"ok"` — its absence also catches `degraded` |

Five-minute interval is enough: the indexer polls every ten minutes and the health endpoint only calls a figure stale after 45. Alerts go to email.

### A transient 403 from Vercel's edge is not an outage

Seen on 22 Sep 2026: three consecutive requests to `/api/health` answered **403** with a Vercel error page (Astro markup, `server: Vercel`), while the Railway origin answered 200 the whole time. It cleared within about ten seconds on its own, and a 40-request burst afterwards was entirely clean. Two `networkidle` page loads timed out in the same window, which fits the same cause.

How to tell it apart from a real outage:

| Check | Edge blip | Real outage |
|---|---|---|
| `curl https://metacenter-indexer-production.up.railway.app/health` | 200 | fails, or `status` is not `ok` |
| Content type of the 403 body | `text/html`, a Vercel error page | n/a |
| Duration | seconds, clears without action | persists |

UptimeRobot may alert on it. Confirm against the Railway origin before doing anything; if the origin is healthy, there is nothing to fix. Automated page checks should not use `networkidle` as their only wait for this reason.

### The health monitor depends on exact bytes

The health monitor matches the raw string `"status":"ok"` — no space after the colon, lowercase, double-quoted, and `status` as the first key of the response. That is a contract with the monitor, not a formatting detail:

- Renaming the field, wrapping the response, pretty-printing the JSON, or adding a space after the colon would leave the endpoint working while the monitor alerted forever. Nobody would trust it after the second false alarm.
- `indexer/src/health.test.ts` fails if any of that changes: it injects a request and asserts the exact byte sequence, that the body is minified, that `status` is the first key, and that the value is one of `ok`, `degraded`, `down`. The tests were checked against deliberate mutations (field rename, pretty-printing) and fail on both.

If the response shape genuinely has to change, change the UptimeRobot keyword in the same sitting, and update this section.

## The keeper

`pox5-reader::snapshot` runs once per distribution index, and `coverage-cache::refresh` when a distribution is computed, the cycle rolls over, or the stored reading is about 1,100 burn blocks old. Both are permissionless, so the keeper chooses only when a reading is taken.

- Address: `SPKD48VPM45ACPEV9WKSF07SP1MJD4Q03ENCKC0X`, fees only, its own key (never the deployer's).
- Fee per call: `KEEPER_FEE_USTX`, 150,000 uSTX by default. It stops below `KEEPER_MIN_BALANCE_USTX` and flags itself below `KEEPER_ALERT_BALANCE_USTX` (1 STX) in `/api/health` and `/api/meta`.
- Top it up with a plain STX transfer. About 0.3 STX a cycle covers it.

## Scheduled work

### Railway config: migrate in November 2026, not during grant review

Railway is deprecating config-as-code (`indexer/railway.json`) in favour of infrastructure-as-code (`.railway/railway.ts`). **Existing files keep working until 2026-12-01**, so there is nothing to do before then, and the migration is deliberately deferred: it carries risk that is not worth taking while judges are reading the site.

What the migration involves, when the time comes:

1. `cd indexer && railway config migrate --apply` writes `.railway/railway.ts` and clears the dashboard's Config File setting.
2. **It needs an npm dependency.** `railway config plan` refuses to run until `npm install railway` is added at the repository root, because the generated file imports `railway/iac`. That package then ships in the repo's dependency tree.
3. **Check the service name before applying.** The generated file declares `service("indexer", ...)`, while the real service is `metacenter-indexer`. Applying it unchanged risks creating a second service rather than configuring the existing one, which would leave the live API on the old service with no health check. Rename it in the file first.
4. The generated file also drops the restart policy from `railway.json`. Re-add `ON_FAILURE` with 10 retries.
5. Review with `railway config plan`, apply with `railway config apply`, then redeploy and confirm `https://metacenter.0xo.in/api/health` answers `ok` and the deploy logs show the health check passing.

Until then `indexer/railway.json` stays as the source of truth and deploys print a deprecation warning, which is expected.
