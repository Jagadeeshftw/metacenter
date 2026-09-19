# Metacenter: application facts

Verified facts for the Stacks Endowment Q3 2026 application (Getting Started track). Each line can be checked against the linked source.

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

| Contract | Network | Address | Status |
|---|---|---|---|
| pox5-reader | mainnet | pending | waiting for deployer funding |
| risk-feed-trait | mainnet | pending | deploys with pox5-reader |
| risk-feed | testnet | `ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed` | live |
| risk-feed-trait | testnet | `ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed-trait` | live |
| coverage-guard (example consumer) | testnet | `ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.coverage-guard` | live |

The testnet feed mirrors mainnet data. Distributions 282–286 are posted and confirmed.

## Tests

- 36 simnet tests, covering every error code.
- 11 tests that run pox5-reader against mainnet state (a Clarinet fork pinned at Stacks block 9,019,000).
- They match the calculate-rewards events within 2 sats.

## Findings the project rests on

Line numbers refer to the deployed pox-5 source, identical to stacks-core tag 4.0.1 @62e03cc.

- **Payout order:** bonds are paid in descending stx-value-ratio, with ties going to the lower bond index (L2285–2299). Within a bond, payout is flat per token.
- **Reserve:** the reserve takes 15% of what remains after bonds (L2190) and never pays bonds. `transfer-from-reserve` (L2696) is private and never called.
- **Miner payouts:** under PoX-5, every block-commit pays one output to the sBTC deposit address, and nothing is burned. In distribution 286, 705 of 1,050 Bitcoin blocks paid, and the other 345 had no sortition (`research/missing-blocks/`).

## Figures as of distribution 286 (Bitcoin block 967,399, cycle 143)

Source: mainnet calculate-rewards tx `0x4a0218d7…cc5d`.

| Figure | Value |
|---|---|
| Coverage | 230,327,835 ÷ 13,810,222 sats = 16.68× |
| Headroom | 94.0% |
| Reserve | 152,669,889 sats, hypothetical cover 5.52 cycles (cannot pay out without a SIP) |
| STX-only realised yield | 6.67% a year in BTC terms, at 315.01 sats/STX at that distribution |

**Cliff reproduction:** friedger's ~171 sats/STX is 3,000 BTC × 3% ÷ (1,000 STX/block × 52,560 blocks/year), under the SIP's launch-book inputs.

## Infrastructure

| Piece | Where it runs |
|---|---|
| Indexer and API | Railway (Node/TS, Postgres), polling every ~10 minutes |
| Site | Vercel, at metacenter.0xo.in |
| DNS | Cloudflare: CNAME `metacenter` → `dfafebc54dafb963.vercel-dns-017.com` (DNS only) |
