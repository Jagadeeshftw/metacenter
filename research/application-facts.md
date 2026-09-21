# Metacenter: application facts

Generated 2026-09-20 23:29 UTC by `research/scripts/application-facts.mjs` from public data. Rerun it to refresh.

## Links

| What | URL |
|---|---|
| Site | https://metacenter.0xo.in |
| Dashboard | https://metacenter.0xo.in/dashboard |
| Methodology (every number mapped to its source) | https://metacenter.0xo.in/methodology |
| Public API (base) | https://metacenter.0xo.in/api, e.g. https://metacenter.0xo.in/api/metrics/current |
| Source (MIT) | https://github.com/Jagadeeshftw/metacenter |

`metacenter-chi.vercel.app` 308-redirects to https://metacenter.0xo.in.

## Contracts

| Contract | Network | ID |
|---|---|---|
| pox5-reader | mainnet | [`SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader`](https://explorer.hiro.so/txid/SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader?chain=mainnet) |
| risk-feed-trait | mainnet | [`SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.risk-feed-trait`](https://explorer.hiro.so/txid/SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.risk-feed-trait?chain=mainnet) |
| coverage-cache | mainnet | [`SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.coverage-cache`](https://explorer.hiro.so/txid/SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.coverage-cache?chain=mainnet) |
| coverage-guard-cached (example consumer) | mainnet | [`SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.coverage-guard-cached`](https://explorer.hiro.so/txid/SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.coverage-guard-cached?chain=mainnet) |
| risk-feed | testnet | [`ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed`](https://explorer.hiro.so/txid/ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed?chain=testnet) |
| risk-feed-trait | testnet | [`ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed-trait`](https://explorer.hiro.so/txid/ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed-trait?chain=testnet) |
| coverage-guard (example consumer) | testnet | [`ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.coverage-guard`](https://explorer.hiro.so/txid/ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.coverage-guard?chain=testnet) |
| pox-5 (read by pox5-reader) | mainnet | [`SP000000000000000000002Q6VF78.pox-5`](https://explorer.hiro.so/txid/SP000000000000000000002Q6VF78.pox-5?chain=mainnet) |

The testnet feed mirrors mainnet data. Every distribution below is posted there with its raw inputs.

## Headline numbers

The indexer last polled at Bitcoin block **967,910** (2026-09-20T23:25:58.732Z). Figures that come from the latest distribution are as of that distribution, **286**: cycle 143, calculation height 967,399.

| Figure | Value |
|---|---|
| Coverage | 16.68× _(onchain)_. 230,327,835 sats pool ÷ 13,810,222 sats owed |
| Headroom | 94.0% _(onchain)_. The pool can fall this far before bond yield is impaired |
| Reserve | 152,669,889 sats _(onchain)_ |
| Hypothetical cover | 5.52 cycles. The reserve cannot pay out without a SIP |
| Pending pool | 87,881,831 sats, via pox5-reader::get-pending-pool _(onchain)_, at the Bitcoin tip 967,910 (Stacks 9,035,243) |
| STX-only realised yield | 6.67% a year in BTC terms _(mirrored)_. 0.4202 sats/STX in distribution 286, priced at 315.01 sats/STX (coingecko:market_chart/range @ 1789642800) |
| Cliff price | 18.9 sats/STX _(mirrored; price at distribution 286 × obligation ÷ pool; assumes miner bids scale with STX price)_ |
| Cliff, 3,000 BTC book | ≈ 246.2 sats/STX _(hypothetical; price at distribution 286, 315.01 sats/STX, × 180,000,000 sats ÷ its pool 230,327,835 sats)_ |
| Cliff, friedger's SIP inputs | 171.2 sats/STX _(hypothetical: 3,000 BTC × 3% ÷ (1,000 STX/block × 52,560 blocks/year))_ |

## Tests

| Suite | Tests |
|---|---|
| `contracts/tests` (simnet) | 36, covering every error code |
| `contracts/tests-fork` (pox5-reader against mainnet state pinned at Stacks block 9,019,000) | 11 |
| **Total** | **47** |

## Per-distribution recompute

Each distribution is recomputed independently from pox-5 state just before and after its calculate-rewards block (`call-read ?tip=`), then compared with the event.

| Distribution | Cycle | Gross (sats) | Paid to bonds (sats) | Reserve deposit (sats) | Reserve delta vs event | Match | Worst diff | Source |
|---|---|---|---|---|---|---|---|---|
| 282 | 141 | 162,018,760 | 0 | 24,302,814 | exact | yes | 1 sat | [tx](https://explorer.hiro.so/txid/0xfeedce2f594786b7b18359ba62b1cb11faef3e7cadd43d833e0bfa0507f7cc6e?chain=mainnet) |
| 283 | 141 | 188,232,684 | 0 | 28,234,902 | exact | yes | 1 sat | [tx](https://explorer.hiro.so/txid/0xad67bc938187620f684806ba8573326888d1f5a0b9636d83859a561e81aad05f?chain=mainnet) |
| 284 | 142 | 217,098,316 | 0 | 32,564,747 | exact | yes | 1 sat | [tx](https://explorer.hiro.so/txid/0x94fa52a02c7992d00d9c701c8050d64f9e31b18f1b2e79b59f9e9ac6b5d06f9b?chain=mainnet) |
| 285 | 142 | 233,931,905 | 0 | 35,089,785 | exact | yes | 1 sat | [tx](https://explorer.hiro.so/txid/0x252b558994e82003da52bee4e86cf138570cef440e53dda3c4571b00da52060b?chain=mainnet) |
| 286 | 143 | 230,327,835 | 13,810,222 | 32,477,641 | exact | yes | 2 sats | [tx](https://explorer.hiro.so/txid/0x4a0218d7b13de29ae47015e72345876d362c47159216675d40d03cd09ad1cc5d?chain=mainnet) |

## Missing blocks

In distribution 286, only 705 of 1,050 Bitcoin blocks paid the pool (230,952,500 sats in miner commits).

- **Why:** in every one of the 345 non-paying blocks, no Stacks block-commit was confirmed, so there was no sortition. Hiro's sortition endpoint shows `was_sortition: false` for all 345.
- **Nothing is burned:** under PoX-5 every valid commit pays exactly one output to the sBTC deposit address, including in the prepare phase (stacks-core 4.0.1, `leader_block_commit.rs:752-827`).
- **This is not new:** the same ~30% no-sortition rate existed under PoX-4.
- **Who pays:** five miners commit a combined 332,500 sats per block.
- **Stress model:** the pool per interval ≈ 1,050 × paying fraction (0.66–0.72 observed) × per-block spend. The stress test's commit-drop cuts that total directly. Evidence is in `research/missing-blocks/`.

## pox-5 line references

Line numbers refer to the deployed source, identical to stacks-core tag 4.0.1 @62e03cc (`research/pox-5.deployed.clar`).

| Rule | Where |
|---|---|
| Bond target per interval = shares × target-rate ÷ 10000 ÷ 50 | L2266 |
| Bonds paid in descending stx-value-ratio, ties to the lower bond index | L2285–2299, enforced with `ERR_INVALID_BOND_PERIOD_ORDERING` |
| Within a bond, flat per-token accounting | L2304–2309 |
| Reserve takes 15% of what remains after bonds | L2190 (`RESERVE_RATIO u1500`, L107) |
| The reserve never pays bonds: `transfer-from-reserve` is private and never called | L2696 |

## Infrastructure

| Piece | Where it runs |
|---|---|
| Indexer and API | Railway (Node/TS, Postgres), polling every ~10 minutes; the site proxies https://metacenter.0xo.in/api/* to it |
| Site | Vercel, at https://metacenter.0xo.in |
| DNS | Cloudflare: CNAME `metacenter` → `dfafebc54dafb963.vercel-dns-017.com` (DNS only) |
