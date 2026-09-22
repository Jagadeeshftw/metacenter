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

## Quickstart

```sh
git clone https://github.com/Jagadeeshftw/metacenter.git
cd metacenter
npm run verify          # rebuild every headline figure from public data and compare it with the site
```

Node 22 or newer, no install step, no keys. It reads `pox-5` through the public Hiro API, the sBTC
token contract, the deployed Metacenter contracts and CoinGecko, recomputes each figure, and prints
both sides with the Bitcoin block each was read at. Exit code 0 means every check passed.

```
  figure                               recomputed here           published
  --------------------------------  ------------------  ------------------  ---
  Reward pool (sats)                       230,327,833         230,327,835  ok
  Coverage (x)                                  16.678              16.678  ok
  Headroom                                      0.9400              0.9400  ok
  Reserve (sats)                           152,669,889         152,669,889  ok
  STX-only yield (sats per STX)                 0.4202              0.4202  ok
  pox5-reader source                      2a0ebc3a3003        2a0ebc3a3003  ok
```

It also checks that each deployed contract is byte-identical to the source in this repository.
`npm run verify -- --json` prints the same as JSON. See [Verify it yourself](#verify-it-yourself).

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

The site is on Vercel, the API and indexer on Railway with a Postgres volume that indexer redeploys never touch. If the database is lost, the history rebuilds itself from public chain data.

- Health: [`/api/health`](https://metacenter.0xo.in/api/health) — `ok`, `degraded` or `down`, with per-check detail.
- When the API is unreachable the site keeps serving the last known figures and says "Data as of block N · refreshing".
- Operations, restore paths, monitoring and scheduled work: [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Verify it yourself

Nothing here asks to be trusted. Three ways to check, in increasing depth:

| | How | What it proves |
|---|---|---|
| Fastest | `npm run verify` | Every headline figure, rebuilt from public sources, matches what the site publishes, and each deployed contract matches this repository |
| By hand | [Recompute it yourself](https://metacenter.0xo.in/docs/verification/recompute) | The same arithmetic, step by step, with the exact API calls |
| Deepest | `cd contracts && node scripts/verify-at-tip.mjs` | The deployed `pox5-reader` against live mainnet state, in a fork pinned at the chain tip, with every expected value fetched from `pox-5` at that same tip |

Each figure on the site carries its provenance label and the block it was read at. Where a
figure cannot be produced honestly it is left out and the reason is stated: see
[Read limits and coverage-cache](https://metacenter.0xo.in/docs/verification/read-limits) for the
one case where a public node refuses to run the contract's own read-onlys.

## Integrate

A contract reads the feed through `risk-feed-trait` in five lines. The live example on mainnet is
[`coverage-guard-cached`](https://metacenter.0xo.in/docs/contracts/coverage-guard-cached):

```clarity
(use-trait risk-feed .risk-feed-trait.risk-feed-trait)
(define-constant TRUSTED_FEED 'SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.coverage-cache)
(define-constant MIN_COVERAGE_BPS u20000) ;; 2.0x

(define-public (deposit (feed <risk-feed>) (amount uint))
    (let ((s (try! (contract-call? feed get-coverage-summary))))
        (asserts! (is-eq (contract-of feed) TRUSTED_FEED) (err u200))
        (asserts! (match (get coverage-bps s) c (>= c MIN_COVERAGE_BPS) true) (err u202))
        (asserts! (<= (- burn-block-height (get updated-at s)) u1300) (err u203))
        (ok amount)
    )
)
```

From an app or an agent, the JSON API needs no key: `GET https://metacenter.0xo.in/api/metrics/current`.
Every field carries `value`, `unit`, `provenance` and `source`. See
[Integrate](https://metacenter.0xo.in/docs/integrate/read-coverage).

## Contributing

Issues and pull requests are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). The rule that matters
most is that no number ships without a traceable source.

## Contracts

| Contract | Network | Address |
|---|---|---|
| pox5-reader | mainnet | [`SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader`](https://explorer.hiro.so/txid/SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader?chain=mainnet) |
| risk-feed-trait | mainnet | [`SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.risk-feed-trait`](https://explorer.hiro.so/txid/SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.risk-feed-trait?chain=mainnet) |
| coverage-cache | mainnet | [`SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.coverage-cache`](https://explorer.hiro.so/txid/SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.coverage-cache?chain=mainnet) |
| coverage-guard-cached (example consumer) | mainnet | [`SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.coverage-guard-cached`](https://explorer.hiro.so/txid/SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.coverage-guard-cached?chain=mainnet) |
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
