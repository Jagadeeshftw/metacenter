# Posting guide: Metacenter on X

Copy-paste order for the 14 launch posts. Nothing in this repo posts anything; you post by hand.

- **Figures refreshed** with `node marketing/scripts/refresh-posts.mjs` at **Bitcoin block 967,731** (2026-09-19 UTC), from distribution 286. The sources for every figure are in [`posts.md`](posts.md).
- **Before each posting day**, run `node marketing/scripts/refresh-posts.mjs`. If it shows CHANGED, run it with `--write` and copy the text from `posts.md`. The next distribution (287) is due after Bitcoin block 968,449, around 24 Sep; after that, the distribution figures change.
- **Post text** is inside each `text` block, exactly as it should appear on X: plain text, no formatting. Copy everything inside the block.
- **Clips** are local files: `.mp4` files are git-ignored, so re-record them with `marketing/scripts/record-clips.mjs` on a fresh checkout. Attach the 1080×1080 version by default; the 1280×720 version is the alternative.
- **The two announcement clips** in `marketing/clips/announce/` (D7·1 and D7·2) carry a title card and an end card with `@metacenterbtc`. Everything in that folder is git-ignored; `marketing/scripts/record-announce.mjs` rebuilds it.
- **Dates** assume Day 1 is Saturday 19 Sep 2026; shift them if Day 1 moves. Slot 1 is the first post of the day and Slot 2 the second. The two Day 7 posts have no fixed date: each goes out when its trigger happens (see below).

**Handles:**

| Handle | Status | Checked against |
|---|---|---|
| @Stacks | VERIFIED | linked from stacks.co (`twitter.com/Stacks`) |
| @StacksEndowment | VERIFIED | linked from stacksendowment.co (`x.com/StacksEndowment`) |
| @hirosystems | VERIFIED | linked from hiro.so (`twitter.com/hirosystems`) |
| @ZestProtocol | VERIFIED | linked from zestprotocol.com (`twitter.com/zestprotocol`) |
| @friedger | TO VERIFY | not linked from github.com/friedger, friedger.de or the forum.stacks.org profile |

"VERIFIED" means the organisation's own website links to that handle. X was not opened.

---

## Day 1 · Slot 1: launch (Sat 19 Sep)

**Status:** ready
**Clip:** `marketing/clips/a-landing-hero-1080x1080.mp4` (alternative: `marketing/clips/a-landing-hero-1280x720.mp4`)
**Tags:** @Stacks VERIFIED, @StacksEndowment VERIFIED

```text
Metacenter is live: a risk feed for Stacks Bitcoin Staking (PoX-5).

It measures bond coverage, the reserve and STX-only yield from public data, and labels every figure onchain, mirrored or hypothetical.

https://metacenter.0xo.in

@Stacks @StacksEndowment
```

> **Pin D1·1 after posting:** pin this post to the profile, and keep it pinned until D7·1, the mainnet post, replaces it.

## Day 1 · Slot 2: missing blocks (Sat 19 Sep)

**Status:** ready
**Clip:** none (text only)
**Tags:** none

```text
Why did only 705 of 1,050 Bitcoin blocks in the latest PoX-5 distribution pay the reward pool?

No miner commit was confirmed in the other 345, so there was no sortition. Nothing is burned under PoX-5: every commit pays the sBTC address. PoX-4 had the same ~30% gap.
```

## Day 2 · Slot 1: coverage and headroom (Sun 20 Sep)

**Status:** ready
**Clip:** `marketing/clips/b-headroom-coverage-1080x1080.mp4` (alternative: `marketing/clips/b-headroom-coverage-1280x720.mp4`)
**Tags:** none

```text
PoX-5 bond coverage today: 16.68×.

The reward pool in the latest distribution was 230.3M sats against 13.8M sats owed to bonds. It could fall 94% before bond yield is hit.

https://metacenter.0xo.in/dashboard
```

## Day 2 · Slot 2: coverage history (Sun 20 Sep)

**Status:** ready
**Clip:** `marketing/clips/c-coverage-history-1080x1080.mp4` (alternative: `marketing/clips/c-coverage-history-1280x720.mp4`)
**Tags:** none

```text
Coverage history for PoX-5, per distribution: n/a for 282–285 because no bonds existed in cycles 141–142, then 16.68× at 286, when the first bond started earning.

The dashed line is the 2.0× coverage target from the Bitcoin Staking SIP discussion.
```

## Day 3 · Slot 1: the reserve (Mon 21 Sep)

**Status:** ready
**Clip:** `marketing/clips/g-reserve-1080x1080.mp4` (alternative: `marketing/clips/g-reserve-1280x720.mp4`)
**Tags:** none

```text
The PoX-5 reserve holds 1.527 BTC, but under the current contract it can't pay bonds.

It gets 15% of what's left after bonds (pox-5 L2190). transfer-from-reserve (L2696) is private and never called: paying out needs a SIP.

Dashboard: "hypothetical cover, 5.52 cycles".
```

## Day 3 · Slot 2: realised STX-only yield (Mon 21 Sep)

**Status:** ready
**Clip:** none (text only). If you want an image: `marketing/clips/b-headroom-coverage-1080x1080.png` (alternative: `marketing/clips/b-headroom-coverage-1280x720.png`)
**Tags:** none
**Check before posting:** 6.67% is price-based. It uses the STX/BTC price at distribution 286 (315.01 sats/STX), so it holds until distribution 287. After that, run `refresh-posts.mjs` and cite the new distribution and figures.

```text
Realised STX-only yield in PoX-5 distribution 286: 0.42 sats per STX, or 6.67% a year in BTC terms at that distribution's STX/BTC price.

It's mirrored and price-based: sBTC paid after bonds and the 15% reserve cut, not an STX APY.

https://metacenter.0xo.in/dashboard/yield
```

## Day 4 · Slot 1: payout order (Tue 22 Sep)

**Status:** ready
**Clip:** `marketing/clips/f-bond-payout-order-1080x1080.mp4` (alternative: `marketing/clips/f-bond-payout-order-1280x720.mp4`)
**Tags:** none

```text
Who gets short-paid first if the PoX-5 pool is too small? It's enforced in the contract.

Bonds are paid in descending stx-value-ratio, ties to the lower bond index (pox-5 L2285–2299). Each gets min(target, what's left). Within a bond, every sat earns the same.
```

## Day 4 · Slot 2: contracts can read it (Tue 22 Sep)

**Status:** ready
**Clip:** none (text only)
**Tags:** @ZestProtocol VERIFIED

This post must not say or imply that Zest asked for the feed or uses it. Keep "could".

```text
Contracts can read Metacenter too: one trait, get-coverage-summary.

Example included: coverage-guard pauses when coverage falls below 2.0× or the feed goes stale. That's the kind of check a levered staking vault could run.

Code: https://github.com/Jagadeeshftw/metacenter

@ZestProtocol
```

## Day 5 · Slot 1: stress, 50% commit drop (Wed 23 Sep)

**Status:** ready
**Clip:** `marketing/clips/d-stress-commit-drop-1080x1080.mp4` (alternative: `marketing/clips/d-stress-commit-drop-1280x720.mp4`)
**Tags:** none
**Check before posting:** 3.12% is price-based (STX/BTC price at distribution 286). Re-run `refresh-posts.mjs`: it changes after distribution 287.

```text
Stress test, hypothetical: cut miner BTC commits by 50% and PoX-5 coverage drops from 16.68× to 8.34×. The bond is still paid in full; STX-only yield falls to 3.12% (BTC terms).

Drag the sliders yourself: https://metacenter.0xo.in/dashboard/stress
```

## Day 5 · Slot 2: the 3,000 BTC hypothetical, thread of 2 (Wed 23 Sep)

**Status:** ready (untagged)
**Clip (on 1/):** `marketing/clips/e-stress-3000btc-book-1080x1080.mp4` (alternative: `marketing/clips/e-stress-3000btc-book-1280x720.mp4`)
**Tags:** none. @friedger is TO VERIFY, so this post tags nobody until the handle is confirmed. Use the untagged 2/.
**Check before posting:** the cliff is price-based. It is the price at the latest distribution × 180,000,000 sats ÷ that distribution's pool: 315.01 sats/STX (distribution 286, CoinGecko) × 180,000,000 ÷ 230,327,835 = 246.18. It changes only when a new distribution lands, and so do 1.28× and 18.8M. Run `refresh-posts.mjs` before posting: it prints the cliff's inputs, and which one moved if it changed.

Post 1/ first, then reply to it with 2/.

```text
1/ Hypothetical: the SIP's 3,000 BTC launch book at 3% would owe 180M sats per distribution. Against the latest distribution's pool that's 1.28× coverage.

With a 30% STX price drop on top, the last bond in the payout order would be short-paid by 18.8M sats.
```

2/, untagged (use this one):

```text
2/ At the latest distribution's pool and price, that book puts the zero-yield cliff near 246 sats/STX (if miner bids track the STX price).

friedger derived the original on the Stacks forum: 171.2 sats/STX under the SIP's launch inputs. Both are hypothetical.
```

2/, tagged. Use it only once @friedger is VERIFIED:

```text
2/ At the latest distribution's pool and price, that book puts the zero-yield cliff near 246 sats/STX (if miner bids track the STX price).

Credit to @friedger for the original derivation: 171.2 sats/STX under the SIP's launch inputs. Both are hypothetical.
```

> **Why the cliff changed from ~293 to ~246:** until 20 Sep `/api/metrics/current` multiplied the **current** STX price by distribution 286's pool. So the figure moved every hour with the price: ~269 → ~278 → ~276 → ~296 → ~293 over 18–19 Sep, as STX/BTC rose from 343.8 to 379.3 sats. That was wrong, because under the linear-bid assumption today's price cancels out. It now uses the price at that distribution, the same as `/api/stress`, `/api/intervals` and the `risk-feed` contract. See `posts.md` for the full inputs.

## Day 6 · Slot 1: methodology and open API (Thu 24 Sep)

**Status:** ready
**Clip:** `marketing/clips/h-methodology-source-1080x1080.mp4` (alternative: `marketing/clips/h-methodology-source-1280x720.mp4`)
**Tags:** @hirosystems VERIFIED

```text
Every Metacenter number links to its source: a contract function, a mainnet event or an API field. The data comes from pox-5 through the Hiro API, and the public API is open, no key needed.

Methodology: https://metacenter.0xo.in/methodology
API: https://metacenter.0xo.in/api/metrics/current

@hirosystems
```

## Day 6 · Slot 2: recompute check (Thu 24 Sep)

**Status:** ready
**Clip:** `marketing/clips/c-coverage-history-1080x1080.mp4` (alternative: `marketing/clips/c-coverage-history-1280x720.mp4`, or the still `marketing/clips/h-methodology-source-1080x1080.png`)
**Tags:** none

If distribution 287 has landed by then, check `/api/intervals` and update "All five so far (282–286)".

```text
How we check the data: each PoX-5 distribution is recomputed from contract state just before and after its calculate-rewards block.

All five so far (282–286) match the event within 2 sats, and the reserve change matches exactly.
```

## Day 7 · Slot 1: pox5-reader on mainnet (post the same day the mainnet deploy lands)

**Status:** ready. **Trigger:** the mainnet deploy, which landed on 20 Sep 2026 (Stacks block 9,029,707, Bitcoin 967,790).
**Clip:** `marketing/clips/announce/mainnet-live-1080x1080.mp4`
**Alternatives:** `marketing/clips/announce/mainnet-live-720.gif` (GIF), `marketing/clips/announce/mainnet-live-1280x720.mp4` (16:9), or the plain screen recording `marketing/clips/i-mainnet-reader-1080x1080.mp4`
**Tags:** none

When this goes out, pin it in place of D1·1.

```text
pox5-reader is live on Stacks mainnet: a read-only contract that computes PoX-5 coverage, headroom and the bond payout order from pox-5 state. The dashboard's headline figures now read "onchain".

SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader
https://metacenter.0xo.in/dashboard
```

## Day 7 · Slot 2: grant application (post on your submission, planned 23 Sep evening IST)

**Status:** waits for submission. **Trigger:** your grant submission, planned for the evening of 23 Sep IST. Post it after submitting. The text mentions a mainnet reader contract, so if the deploy hasn't landed by then, use the variant below.
**Clip:** `marketing/clips/announce/applied-1080x1080.mp4`
**Alternatives:** `marketing/clips/announce/applied-720.gif` (GIF), `marketing/clips/announce/applied-1280x720.mp4` (16:9), or `marketing/clips/a-landing-hero-1080x1080.mp4`
**Tags:** @Stacks VERIFIED, @StacksEndowment VERIFIED

Say "applied" only, never "awarded". Post only after you have submitted.

```text
We've applied to the Stacks Endowment Q3 2026 grants with Metacenter: an open risk feed for Bitcoin Staking, with a mainnet reader contract, a public API and a dashboard.

https://metacenter.0xo.in

@Stacks @StacksEndowment
```

Variant for when the mainnet deploy hasn't landed yet:

```text
We've applied to the Stacks Endowment Q3 2026 grants with Metacenter: an open risk feed for Bitcoin Staking, with a public API, a dashboard and Clarity contracts other protocols can read.

https://metacenter.0xo.in

@Stacks @StacksEndowment
```

---

## Summary

| Post | Clip | Date / slot | Status |
|---|---|---|---|
| D1·1 launch (**pin**) | a-landing-hero | Sat 19 Sep · 1 | ready |
| D1·2 missing blocks | none | Sat 19 Sep · 2 | ready |
| D2·1 coverage and headroom | b-headroom-coverage | Sun 20 Sep · 1 | ready |
| D2·2 coverage history | c-coverage-history | Sun 20 Sep · 2 | ready |
| D3·1 the reserve | g-reserve | Mon 21 Sep · 1 | ready |
| D3·2 realised STX-only yield | none (optional still b) | Mon 21 Sep · 2 | ready (price-based: check) |
| D4·1 payout order | f-bond-payout-order | Tue 22 Sep · 1 | ready |
| D4·2 contracts can read it | none | Tue 22 Sep · 2 | ready |
| D5·1 stress, 50% commit drop | d-stress-commit-drop | Wed 23 Sep · 1 | ready (price-based: check) |
| D5·2 3,000 BTC thread (2 parts) | e-stress-3000btc-book | Wed 23 Sep · 2 | ready, untagged (price-based: check; @friedger TO VERIFY) |
| D6·1 methodology and API | h-methodology-source | Thu 24 Sep · 1 | ready |
| D6·2 recompute check | c-coverage-history | Thu 24 Sep · 2 | ready |
| D7·1 pox5-reader on mainnet | announce/mainnet-live (i as fallback) | deploy landed 20 Sep; post when you're ready | ready |
| D7·2 grant application | announce/applied | on your submission (planned 23 Sep evening IST) | waits for submission |
