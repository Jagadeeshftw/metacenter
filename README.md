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
| `research/` | Phase 0 raw data and findings. `research/missing-blocks/` explains the reward-paying fraction. |

## Contracts

| Contract | Network | Address |
|---|---|---|
| pox5-reader | mainnet | _pending deploy_ |
| risk-feed-trait | testnet | `ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed-trait` |
| risk-feed | testnet | `ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed` |
| coverage-guard | testnet | `ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.coverage-guard` |

- Testnet feed values mirror mainnet data.
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

Base URL: `https://metacenter-indexer-production.up.railway.app`

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

# indexer
cd indexer && npm install
DATABASE_URL=postgres://... npm run once   # one poll, including backfill
DATABASE_URL=postgres://... npm run dev    # API + poll every 10 min
```

Deploying uses key files kept outside the repo:

```sh
node scripts/deploy.mjs <network> <key-file> <contract>...
```

## Licence

MIT
