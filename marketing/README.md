# Marketing: X launch content

Files only. Nothing is posted from here, and no social account is touched.

| Path | What |
|---|---|
| `posts.md` | 14 post drafts (7 days, 2 per day) and 5 reply templates. Each draft lists the sources of its numbers. |
| `clips/` | 6-second clips recorded from the live site in the dark theme, with real data. Each clip has a 1280×720 and a 1080×1080 version, H.264 at 30 fps with no audio, plus a still PNG of each size. The `.mp4` files are git-ignored; the PNG stills are committed. |
| `scripts/record-clips.mjs` | Records the clips again. Run it after the mainnet deploy for clip i, and whenever figures change. |

## Clips

| Clip | Shows |
|---|---|
| a-landing-hero | Landing hero with its motion, then "Open dashboard" |
| b-headroom-coverage | Headroom 94.0% and coverage 16.68× cards, with the provenance tag explained on hover |
| c-coverage-history | Coverage chart: the n/a band, the tooltip on distribution 286, and the 2.0× target line |
| d-stress-commit-drop | Miner-commit drop from 0 to 50% while coverage falls live from 16.68× to 8.34× |
| e-stress-3000btc-book | The book switched to the hypothetical 3,000 BTC book (hypothetical label visible) |
| f-bond-payout-order | Bond payout order panel |
| g-reserve | Reserve with "hypothetical cover: reserve cannot currently pay out (requires SIP)" |
| h-methodology-source | A methodology row clicked through to `get-obligation-per-interval` at line 283 of the contract source |
| i | **Not recorded yet.** Needs the mainnet deploy: the explorer page for pox5-reader, and the dashboard reading "onchain". |

Recorded at Bitcoin block 967,686 (2026-09-19).

## Posts

| Post | Clip | Tags (TO VERIFY) | Status |
|---|---|---|---|
| D1 · 1: launch | a | @Stacks @StacksEndowment | ready |
| D1 · 2: 705 of 1,050 blocks paid, nothing burned | none | none | ready |
| D2 · 1: coverage 16.68×, headroom 94% | b | none | ready |
| D2 · 2: coverage history, first bond | c | none | ready |
| D3 · 1: reserve can't pay bonds (L2190/L2696) | g | none | ready |
| D3 · 2: realised STX-only yield 6.67% (BTC terms, mirrored) | still b (optional) | none | ready |
| D4 · 1: payout order enforced (L2285–2299) | f | none | ready |
| D4 · 2: contracts can read it (coverage-guard) | none | @ZestProtocol | ready |
| D5 · 1: stress, 50% commit drop → 8.34× | d | none | ready |
| D5 · 2: 3,000 BTC hypothetical, ~296 cliff, friedger 171.2 (thread) | e | @friedger | ready |
| D6 · 1: methodology and open API | h | @hirosystems | ready |
| D6 · 2: every distribution recomputed within 2 sats | c or still h | none | ready |
| D7 · 1: pox5-reader live on mainnet | i | none | waits for mainnet |
| D7 · 2: applied to Stacks Endowment Q3 grants | a | @Stacks @StacksEndowment | waits for mainnet and submission |

## Re-recording

The scripts use Playwright and ffmpeg. Chromium must be launched with `--force-device-scale-factor=2`; the script does this.

```sh
node marketing/scripts/record-clips.mjs marketing/clips [--only a,b]
```
