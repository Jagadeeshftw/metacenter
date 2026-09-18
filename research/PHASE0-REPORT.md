# Phase 0 findings (19 Sept 2026, Bitcoin block 967,589)

Raw data behind these findings lives in this folder:

| Path | Contents |
|---|---|
| `pox-5.deployed.clar` | Deployed mainnet source (from Hiro `/v2/contracts/source`). Identical to stacks-core tag 4.0.1 @62e03cc. |
| `gh-*.clar` | GitHub copies of pox-5 at each tag. Tag 4.0.0 differs only in the admin addresses. |
| `hiro/` | Raw responses: v3 staking cycles 0–1e9, bonds, signers and rewards; all pox-5 contract events (`pox5_all_events.json`); the pox-5 interface; read-only call results. |
| `burnchain-rewards/` | Hiro `/extended/v1/burnchain/rewards` pages (miner payouts to the sBTC deposit address). |
| `clarinet-probe/` | Clarinet 3.24.0 test projects. `probe` is plain simnet with pox-5; `probe-mxs` is a mainnet-fork read of pox-5. |
| `forum/` | forum.stacks.org thread 18862 as JSON (friedger's post #14 has the 171 sats/STX table). |
| `call-read-client/`, `bitcoin-staking-sdk-probe/` | Throwaway Node clients (node_modules removed). |

## Key facts (line numbers refer to `pox-5.deployed.clar`)

### Bond payouts

- Bonds are paid in **descending stx-value-ratio order**, with ties going to the lower bond index. The contract enforces this in `calculate-bond-rewards` at L2285–2299 and fails with `ERR_INVALID_BOND_PERIOD_ORDERING` otherwise.
- **Within a bond**, rewards are flat per token (L2304–2309).
- Target payout per interval = `shares * target-rate / 10000 / 50` (L2266). If the pool is short, the bond being processed gets whatever is left and later bonds get 0 (L2269–2272).

### Reserve

- The reserve takes 15% of what remains *after* bonds are paid (L2190). STX-only stakers get 85% (L2191–2201). If no STX is staked, the 85% also goes to the reserve (L2203–2207).
- **The reserve never pays bonds.** `transfer-from-reserve` (L2696) is private and nothing calls it.

### Distribution schedule

- One distribution interval = 1,050 burn blocks, so each cycle has 2 intervals.
- `calculate-rewards` runs once per interval, at calculation height = interval start − 1.
- The first PoX-5 cycle is 141.

### Hiro API

- `/extended/v3/staking/cycles/{n}` returns real data for 141–143.
- Every other cycle number also returns 200, but zero-filled.
- It gives per-cycle totals only.
- **`waterfall.bonds` is the amount *paid*, not the target.**
- Per-interval figures exist only in `calculate-rewards` print events.

### Coverage and reserve (cycle 143, interval 286)

| Figure | Value |
|---|---|
| Gross pool | 230,327,835 sats |
| Bond target | 13,810,222 sats |
| Coverage | 16.68× |
| Reserve | 152,669,889 sats |
| Hypothetical cover | 5.53 cycles |

### Miner payouts vs pool

- Over blocks 966,350–967,399, miner commits to the sBTC deposit address totalled 230,952,500 sats, against 230,327,835 accrued (0.27% gap).
- Only 705 of the 1,050 blocks paid a reward.

### Cliff

- friedger's 171.2 sats/STX = 90 BTC ÷ (1,000 STX × 52,560 blocks), using the SIP launch book.
- Live figure: 339 / 16.68 ≈ 20.3 sats/STX.
- With a 3,000 BTC book at today's pool: ≈ 265 sats/STX.

### Tooling

- Clarinet 3.21 or later is needed for epoch 4.0 and pox-5. 3.24.0 was tested, including mainnet-fork mode.
