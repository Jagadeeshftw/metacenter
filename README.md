# Metacenter

Risk feed for Stacks Bitcoin Staking (PoX-5): coverage, reserve, STX-only yield and stress tests, computed from public data.

**Status: under construction.** It is being built for the Stacks Endowment Q3 2026 grant round.

## Provenance labels

Each metric carries exactly one label:

| Label | Meaning |
|---|---|
| `onchain` | Computed by the `pox5-reader` contract from `SP000000000000000000002Q6VF78.pox-5` state. |
| `mirrored` | Posted by the publisher. This includes anything price-based. |
| `hypothetical` | Stress-test and what-if scenarios. |

## Layout

| Path | Contents |
|---|---|
| `contracts/` | Clarinet project: `pox5-reader` (mainnet, read-only), `risk-feed` + trait (testnet) |
| `indexer/` | Node/TS indexer and public JSON API |
| `web/` | Landing page and dashboard |
| `research/` | Phase 0 raw data and findings |

## Toolchain

- Clarinet **3.24.0** (pinned). Epoch 4.0 and pox-5 need Clarinet 3.21 or later.
- Node 24

## Licence

MIT
