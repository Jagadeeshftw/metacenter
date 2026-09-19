# Metacenter: X launch posts (drafts)

Drafts only. Nothing here has been posted, and no social account has been touched.

## Numbers and handles

**Where the numbers come from:** all figures were read from the live public API at `https://metacenter.0xo.in/api`.

- Indexer poll at **Bitcoin block 967,720** (2026-09-19 15:44:31 UTC).
- Distribution figures are from **distribution 286**: cycle 143, calculation height 967,399.
- Re-read them before posting. The next distribution is due after Bitcoin block 968,449, and any post can cite that one instead.

**Handles:** "VERIFIED" means the organisation's own website links to the handle (checked 2026-09-19; X itself was not opened).

| Organisation | Handle | Status |
|---|---|---|
| Stacks | @Stacks | VERIFIED (stacks.co) |
| Stacks Endowment | @StacksEndowment | VERIFIED (stacksendowment.co) |
| Hiro | @hirosystems | VERIFIED (hiro.so) |
| Zest | @ZestProtocol | VERIFIED (zestprotocol.com) |
| friedger | @friedger | TO VERIFY (not linked from his GitHub, site or forum profile) |

**Clips** are in `marketing/clips/`: `<id>-1280x720.mp4` and `<id>-1080x1080.mp4`, plus a still `.png` of each for the fallback.

**Status key:**
- **ready**: can be posted now (check the @friedger tag first).
- **waits for mainnet**: needs pox5-reader deployed on mainnet.
- **waits for submission**: needs your confirmation that the grant application is submitted.

---

## Day 1 · Slot 1 (launch)

**Status:** ready · **Clip:** a-landing-hero · **Tags:** @Stacks, @StacksEndowment (VERIFIED)

```text
Metacenter is live: a risk feed for Stacks Bitcoin Staking (PoX-5).

It measures bond coverage, the reserve and STX-only yield from public data, and labels every figure onchain, mirrored or hypothetical.

https://metacenter.0xo.in

@Stacks @StacksEndowment
```

**Sources:** none (no figures).

## Day 1 · Slot 2

**Status:** ready · **Clip:** none (text) · **Tags:** none (moved from Day 3 · Slot 2)

```text
Why did only 705 of 1,050 Bitcoin blocks in the latest PoX-5 distribution pay the reward pool?

No miner commit was confirmed in the other 345, so there was no sortition. Nothing is burned under PoX-5: every commit pays the sBTC address. PoX-4 had the same ~30% gap.
```

**Sources:**
- 705 / 1,050 and 345: Hiro `/extended/v1/burnchain/rewards` and `/v3/sortitions/burn_height/{h}` over blocks 966,350–967,399 (distribution 286); see `research/missing-blocks/README.md`.
- Nothing burned: stacks-core 4.0.1 `leader_block_commit.rs:752-827`.
- ~30% under PoX-4: 73 of 100 sortitions at blocks 958,100–958,199.

## Day 2 · Slot 1

**Status:** ready · **Clip:** b-headroom-coverage · **Tags:** none

```text
PoX-5 bond coverage today: 16.68×.

The reward pool in the latest distribution was 230.3M sats against 13.8M sats owed to bonds. It could fall 94% before bond yield is hit.

https://metacenter.0xo.in/dashboard
```

**Sources:**
- 16.68×: `/api/intervals` → distribution 286 `coverage` = 16.678.
- 230.3M sats: `gross_pool` = 230,327,835 sats.
- 13.8M sats: `obligation` = 13,810,222 sats.
- 94%: `headroom` = 0.9400.
- Block: calculation height 967,399; read at block 967,686.

## Day 2 · Slot 2

**Status:** ready · **Clip:** c-coverage-history · **Tags:** none

```text
Coverage history for PoX-5, per distribution: n/a for 282–285 because no bonds existed in cycles 141–142, then 16.68× at 286, when the first bond started earning.

The dashed line is the 2.0× coverage target from the Bitcoin Staking SIP discussion.
```

**Sources:**
- 282–285 n/a: `/api/intervals` → distributions 282–285 `coverage` = null (obligation 0).
- 16.68× at 286: distribution 286 `coverage` = 16.678.
- 2.0× target: forum.stacks.org/t/18862, post #14.
- Block: read at block 967,686.

## Day 3 · Slot 1

**Status:** ready · **Clip:** g-reserve · **Tags:** none

```text
The PoX-5 reserve holds 1.527 BTC, but under the current contract it can't pay bonds.

It gets 15% of what's left after bonds (pox-5 L2190). transfer-from-reserve (L2696) is private and never called: paying out needs a SIP.

Dashboard: "hypothetical cover, 5.52 cycles".
```

**Sources:**
- 1.527 BTC: `/api/intervals` → distribution 286 `reserve_balance` = 152,669,889 sats.
- 5.52 cycles: reserve_balance ÷ (2 × `obligation` 13,810,222), truncated (the same formula as `pox5-reader::get-reserve-cover-cycles`).
- L2190 and L2696: `research/pox-5.deployed.clar` (stacks-core 4.0.1 @62e03cc).
- Block: calculation height 967,399; read at block 967,686.

## Day 3 · Slot 2
**Status:** ready · **Clip:** none (use the `b-headroom-coverage-1280x720.png` still if an image is wanted) · **Tags:** none (moved from Day 1 · Slot 2; the StackingDAO tag is removed)

```text
Realised STX-only yield in PoX-5 distribution 286: 0.42 sats per STX, or 6.67% a year in BTC terms at that distribution's STX/BTC price.

It's mirrored and price-based: sBTC paid after bonds and the 15% reserve cut, not an STX APY.

https://metacenter.0xo.in/dashboard/yield
```

**Sources:**
- 0.42 sats per STX: `/api/intervals` → distribution 286 `stx_only_yield` = 0.4202.
- 6.67%: `stx_only_apy_btc` = 0.0667, priced at 315.01 sats/STX (`price`, CoinGecko hourly at the distribution).
- 15%: pox-5 `RESERVE_RATIO u1500` (L107, applied at L2190).
- Block: distribution 286, calculation height 967,399.

**Wording rule:** keep "realised", "in BTC terms" and "not an STX APY", so it can't be read as contradicting a liquid-stacking protocol's published STX APY.

## Day 4 · Slot 1

**Status:** ready · **Clip:** f-bond-payout-order · **Tags:** none

```text
Who gets short-paid first if the PoX-5 pool is too small? It's enforced in the contract.

Bonds are paid in descending stx-value-ratio, ties to the lower bond index (pox-5 L2285–2299). Each gets min(target, what's left). Within a bond, every sat earns the same.
```

**Sources:**
- L2285–2299 (ordering, `ERR_INVALID_BOND_PERIOD_ORDERING`), L2269–2272 (min(target, remaining)), L2304–2309 (flat per token): `research/pox-5.deployed.clar`.
- No figures.

## Day 4 · Slot 2

**Status:** ready · **Clip:** none (text) · **Tags:** @ZestProtocol (VERIFIED)

```text
Contracts can read Metacenter too: one trait, get-coverage-summary.

Example included: coverage-guard pauses when coverage falls below 2.0× or the feed goes stale. That's the kind of check a levered staking vault could run.

Code: https://github.com/Jagadeeshftw/metacenter

@ZestProtocol
```

**Sources:** 2.0× threshold: `contracts/contracts/coverage-guard.clar` (`MIN_COVERAGE_BPS u20000`), live on testnet at `ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.coverage-guard`.

**Wording rule:** this post says what could use the feed. It must not say or imply Zest asked for it or uses it. Keep the "could".

## Day 5 · Slot 1

**Status:** ready · **Clip:** d-stress-commit-drop · **Tags:** none

```text
Stress test, hypothetical: cut miner BTC commits by 50% and PoX-5 coverage drops from 16.68× to 8.34×. The bond is still paid in full; STX-only yield falls to 3.12% (BTC terms).

Drag the sliders yourself: https://metacenter.0xo.in/dashboard/stress
```

**Sources:**
- 8.34× and 3.12%: `/api/stress?commit_drop=0.5` → `coverage` = 8.339, `stx_only_apy_btc` = 0.0312.
- Base: distribution 286 at 315.01 sats/STX (`inputs.base`, `inputs.price`).
- 16.68×: distribution 286 `coverage`.
- Block: read at block 967,686.

## Day 5 · Slot 2 (thread, 2 parts)

**Status:** ready · **Clip:** e-stress-3000btc-book · **Tags:** @friedger (TO VERIFY)

```text
1/ Hypothetical: the SIP's 3,000 BTC launch book at 3% would owe 180M sats per distribution. Against today's pool that's 1.28× coverage.

With a 30% STX price drop on top, the last bond in the payout order would be short-paid by 18.8M sats.
```

```text
2/ At today's pool, that hypothetical book puts the zero-yield cliff near 293 sats/STX (assuming miner bids track the STX price).

Credit to @friedger for the original derivation: 171.2 sats/STX under the SIP's launch inputs. Both are hypothetical.
```

**Sources:**
- 180M sats: 3,000 BTC × 3% ÷ 50 = 180,000,000 sats; `/api/stress?book_btc=3000&bonds=6` → `obligation` = 180,000,000.
- 1.28×: same call, `coverage` = 1.2795.
- 30% drop: `/api/stress?book_btc=3000&bonds=6&price_drop=0.3` → the 6th bond `partial`, `shortfall` = 18,770,516 sats.
- ~293 sats/STX: `/api/metrics/current` → `cliff.sip_book_scenario` = 293.46 (at current price 375.52 sats/STX, `price`, CoinGecko; block 967,720).
- 171.2: `cliff.friedger_sip_inputs` = 171.23; forum.stacks.org/t/18862, post #14.
- Block: read at block 967,686.

**Before posting:** re-read `cliff.sip_book_scenario`. It moves with the STX price; it was ~269 in an earlier brief and ~278 on 19 Sep 08:34 UTC.

## Day 6 · Slot 1

**Status:** ready · **Clip:** h-methodology-source · **Tags:** @hirosystems (VERIFIED)

```text
Every Metacenter number links to its source: a contract function, a mainnet event or an API field. The data comes from pox-5 through the Hiro API, and the public API is open, no key needed.

Methodology: https://metacenter.0xo.in/methodology
API: https://metacenter.0xo.in/api/metrics/current

@hirosystems
```

**Sources:** none (no figures).

## Day 6 · Slot 2

**Status:** ready · **Clip:** c-coverage-history, or the `h-methodology-source` still · **Tags:** none

```text
How we check the data: each PoX-5 distribution is recomputed from contract state just before and after its calculate-rewards block.

All five so far (282–286) match the event within 2 sats, and the reserve change matches exactly.
```

**Sources:** `/api/intervals` → `crosscheck` for 282–286. Worst differences are gross −1, −1, −1, −1, −2 sats; the reserve differs by 0 in every case. Read at block 967,686.

## Day 7 · Slot 1

**Status:** waits for mainnet · **Clip:** i (to be recorded after the deploy) · **Tags:** none

```text
pox5-reader is live on Stacks mainnet: a read-only contract that computes PoX-5 coverage, headroom and the bond payout order straight from pox-5 state. The dashboard's headline figures now read "onchain".

[MAINNET CONTRACT ID + explorer link]
```

**Sources:** fill in the contract ID from `/api/meta` → `reader`. Re-read coverage and headroom from `/api/metrics/current` (onchain) with their block height, if you add figures.

## Day 7 · Slot 2

**Status:** waits for mainnet and waits for submission · **Clip:** a-landing-hero · **Tags:** @Stacks, @StacksEndowment (VERIFIED)

```text
We've applied to the Stacks Endowment Q3 2026 grants with Metacenter: an open risk feed for Bitcoin Staking, with a mainnet reader contract, a public API and a dashboard.

https://metacenter.0xo.in

@Stacks @StacksEndowment
```

**Wording rule:** "applied" only, never "awarded". Post only after you confirm the submission.

---

## Reply templates

For joining existing Bitcoin Staking conversations: helpful, one number and a link, no tags. Re-read the number and its block height from the API before each use.

**R1**, on "is Bitcoin Staking yield safe?":
```text
One way to look at it: in the latest distribution the reward pool was 16.68× what bonds were owed, so it could fall 94% before bond yield is hit. Live figures: https://metacenter.0xo.in/dashboard
```

**R2**, on "can the reserve bail out bonds?":
```text
Not under the current contract: transfer-from-reserve in pox-5 is private and never called (L2696), so paying bonds from the reserve would need a SIP. The reserve is 1.527 BTC today: https://metacenter.0xo.in/dashboard/reserve
```

**R3**, on "who loses first in a shortfall?":
```text
pox-5 pays bonds in descending stx-value-ratio, ties to the lower index (L2285–2299), so the last bond in that order is short-paid first. Within a bond it's flat per sat. https://metacenter.0xo.in/dashboard/bonds
```

**R4**, on STX-only yield:
```text
STX-only stakers get 85% of what's left after bonds and the reserve cut. Latest distribution: 0.42 sats per STX, about 6.67% a year in BTC terms at that day's price. https://metacenter.0xo.in/dashboard/yield
```

**R5**, on "what if miners spend less?":
```text
Hypothetical: with 50% less miner BTC, coverage in the latest distribution would go from 16.68× to 8.34× and bonds would still be paid in full. Try it: https://metacenter.0xo.in/dashboard/stress
```

**Sources for the replies:** the same as the posts above (distribution 286; stress calls at block 967,686).
