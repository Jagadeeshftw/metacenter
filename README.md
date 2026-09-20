# Metacenter

Risk feed for Stacks Bitcoin Staking (PoX-5). It measures:

- bond coverage
- the reserve
- STX-only yield
- stress tests

Everything is computed from public data and published as:

- a Clarity contract on mainnet,
- a mirrored feed on testnet,
- a public JSON API.

**Live:** https://metacenter.0xo.in · **API:** https://metacenter.0xo.in/api

A ship's metacentric height is its stability margin. This project measures the same thing for PoX-5: how far the reward pool can fall before bonds are short-paid.

## Provenance labels

Every metric carries exactly one label, in the API and in the UI:

| Label | Meaning |
|---|---|
| `onchain` | Computed by `pox5-reader` on mainnet from `SP000000000000000000002Q6VF78.pox-5` state. |
| `mirrored` | Posted by the publisher: mainnet events, Hiro API data, anything price-based. Per-interval values also go to the testnet `risk-feed` together with their raw inputs. |
| `hypothetical` | Stress tests and what-ifs, always with their assumptions. |

A figure that can't be recomputed from public data is left out.

## How pox-5 pays out (checked against the deployed source, `research/pox-5.deployed.clar`)

Once per distribution interval (1,050 Bitcoin blocks, two per cycle), `calculate-rewards` splits the new sBTC:

1. **Bonds first, in descending `stx-value-ratio`.** Ties go to the lower bond index (L2285–2299). Each bond gets `min(target, remaining)`, where `target = shares × rate ÷ 10000 ÷ 50`. Within a bond, every sat earns the same.
2. **15% of what remains goes to the reserve.**
3. **STX-only stakers get the other 85%.**

**The reserve never pays bonds.** `transfer-from-reserve` is private and never called. In a shortfall, the reserve stays flat.

## Layout

| Path | What |
|---|---|
| `contracts/` | Clarinet 3.24.0 project. |
| `contracts/contracts/pox5-reader.clar` | Mainnet, read-only computation plus a permissionless `snapshot()`. |
| `contracts/contracts/risk-feed.clar` | Testnet, publisher-gated mirror. It derives the metrics itself from the posted raw inputs. |
| `contracts/contracts/risk-feed-trait.clar` | The shared read interface (`get-coverage-summary`). |
| `contracts/contracts/coverage-guard.clar` | Example consumer: returns `ok` or `paused` based on coverage and staleness. |
| `indexer/` | Node/TS indexer and public API (Railway, Postgres). |
| `web/` | Next.js landing page (from the Aceternity Cryptgen template, recoloured) and dashboard, deployed on Vercel at https://metacenter.0xo.in. The browser only talks to the site's own domain: `/api/*` is proxied to the indexer. |
| `research/` | Phase 0 raw data and findings. `research/missing-blocks/` explains the reward-paying fraction. |

## Running it

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

## Contracts

| Contract | Network | Address |
|---|---|---|
| pox5-reader | mainnet | [`SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader`](https://explorer.hiro.so/txid/SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader?chain=mainnet) |
| risk-feed-trait | mainnet | [`SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.risk-feed-trait`](https://explorer.hiro.so/txid/SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.risk-feed-trait?chain=mainnet) |
| coverage-cache | mainnet | [`SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.coverage-cache`](https://explorer.hiro.so/txid/SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.coverage-cache?chain=mainnet) |
| risk-feed-trait | testnet | `ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed-trait` |
| risk-feed | testnet | `ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed` |
| coverage-guard | testnet | `ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.coverage-guard` |

- Testnet feed values mirror mainnet data.
- Nine of pox5-reader's thirteen read-onlys cannot be called through Hiro's public `/v2/contracts/call-read`: each `contract-call?` into pox-5 loads that contract, about 569k of read length, over the endpoint's 500,000 cap. A transaction has no such limit, so `coverage-cache::refresh` calls pox5-reader on-chain and stores its answers, and the public API reads the stored copy. The figures stay `onchain`, sourced to the refresh transaction and the burn height it ran at.
- `contracts/scripts/verify-at-tip.mjs` checks the reader and the cache against live mainnet state (a fork at the chain tip, expectations fetched from pox-5 at the same tip). `contracts/scripts/verify-mainnet.mjs` calls what the public endpoint allows and records which functions it refuses.
- The keeper in the indexer calls `pox5-reader::snapshot` once per distribution index and `coverage-cache::refresh` when a distribution lands, the cycle rolls over, or the reading is about a week old. Both calls are permissionless and take no arguments, so the keeper chooses only when a reading is taken. It runs with its own key (`SPKD48VPM45ACPEV9WKSF07SP1MJD4Q03ENCKC0X`), funded with fees only.
- `ST24…vault-guard` on testnet is an earlier deployment of the example, superseded by `coverage-guard`.

### Error codes

| Contract | Code | Meaning |
|---|---|---|
| pox5-reader | u100 | Snapshot already recorded for this distribution index. |
| risk-feed | u100 | Not owner. |
| risk-feed | u101 | Not publisher. |
| risk-feed | u102 | Index already posted. |
| risk-feed | u103 | Inputs don't add up the way pox-5 splits them. |
| risk-feed | u104 | No data. |
| coverage-guard | u200 | Untrusted feed. |
| coverage-guard | u201 | Not owner. |

## API

Base URL: `https://metacenter.0xo.in/api` (for example `https://metacenter.0xo.in/api/metrics/current`). The site proxies `/api/*` to the indexer on Railway, so browsers never call Railway directly.

| Endpoint | What |
|---|---|
| `/metrics/current` | Coverage, headroom, obligation, pending pool, reserve and hypothetical cover, payout order, latest interval, cliff figures. |
| `/metrics/cycles/:n` | `pox5-reader::get-coverage-for-cycle(n)`, the Hiro cycle record, and the cycle's intervals. |
| `/intervals` | Every distribution since cycle 141, with cross-check results and the testnet publication status. |
| `/bonds/order?cycle=` | Bond payout order in contract order. |
| `/stress?commit_drop=&price_drop=&book_btc=&bonds=` | Hypothetical waterfall. |

Every metric is returned as `{ value, unit, provenance, source, note? }`.

### Data pipeline

The indexer doesn't use the deprecated contract-events endpoint. For each distribution it:

1. binary-searches historical chain state (`call-read ?tip=`) for the block where `last-reward-compute-height` reached the interval's calculation height,
2. reads the exact figures from that transaction's print events,
3. recomputes them independently from pox-5 state just before and after that block.

All distributions so far match within 2 sats, and the reserve delta matches exactly.

## Development

```sh
# contracts: Clarinet 3.24.0 (epoch 4.0 / pox-5 needs >= 3.21)
cd contracts && npm install
npm test            # simnet suite
npm run test:fork   # pox5-reader against mainnet state pinned at Stacks block 9,019,000

# web (METACENTER_API_ORIGIN defaults to the Railway API)
cd web && npm install && npm run dev

# indexer
cd indexer && npm install
DATABASE_URL=postgres://... npm run once   # one poll, including backfill
DATABASE_URL=postgres://... npm run dev    # API + poll every 10 min
```

Deploying uses key files kept outside the repo:

```sh
node scripts/deploy.mjs <network> <key-file> <contract>...
```

## Branding

Drop `logo.svg` / `logo.png` into `web/public/`. The header, sidebar and favicon then use them; until then a text wordmark is shown. The X handle is the single value `X_HANDLE` in `web/lib/site.ts`; the footer shows the X link once it is set.

## Licence

MIT
