# Why only 705 of 1,050 blocks paid rewards (Bitcoin blocks 966,350–967,399)

**Answer (high confidence).** In each of the 345 blocks that paid nothing, no Stacks block-commit was confirmed, so there was no sortition. PoX-5 burns nothing, and Hiro is not missing data.

## Evidence

### Sortitions

We queried `https://api.hiro.so/v3/sortitions/burn_height/{h}` for all 1,050 heights (responses in `sortitions.tar.gz`).

- All 345 non-paying heights have `was_sortition: false`.
- 14 paying heights also had no sortition. Their commits were late or invalid, but they still moved BTC on-chain.

### On-chain commits

We parsed the `X2[` OP_RETURN commits sent to the sBTC reward address, using mempool.space, for heights 967,250–967,589 (`commits.json`).

- The per-block sums match Hiro's `reward_amount` in all 340 blocks.
- A sample miner's own address shows no transaction at all in the missing blocks. The commits were never mined; they were not burned.

### Miners

Five miners commit a fixed amount each. Together that is 80,000 + 77,500 + 65,000 + 55,000 + 55,000 = 332,500 sats per block.

The per-block total was 312,500 until about block 965,345, then 322,500, then 332,500 from block 965,936. These are choices by the miners about how much to spend.

680 of the 705 paying blocks carried the full 332,500; 25 carried less.

### Code (stacks-core tag 4.0.1 @62e03cc)

- `leader_block_commit.rs:752-763`: under PoX-5, every block has exactly one output, to the sBTC address. That includes the prepare phase, so there is no burn path.
- `leader_block_commit.rs:797-827` (`check_pox_waterfall`): a commit that doesn't have that single output is invalid.
- `sortdb.rs:6438-6446`: the reward set has size 1.
- `coordinator/mod.rs:876-915`: `reward_amount` is the sum of `burn_fee` over the commits in a block.

### What predicts a missing block

- After a paying block, the next block misses 47% of the time. After an empty block, it misses 4%.
- Block pool and commit feerate have no measurable effect.

The same roughly 30% no-sortition rate existed under PoX-4: blocks 958,100–958,199 had 73 sortitions in 100 blocks. The cause is Stacks commit timing and whether Bitcoin pools include the commit. It is not a PoX-5 effect.

## Model used by the stress test

pool per interval = Σ over blocks in the interval, Σ over confirmed commits of `burn_fee`
                  ≈ 1,050 × paying fraction (0.66–0.72 observed) × per-block spend (~329k sats)
                  ≈ 230.9M sats

`commit_drop` in `/stress` is a fractional cut to this total. It can come from:

- fewer paying blocks,
- fewer miners,
- lower per-miner spend.

## Not explained

- There is a 624,665-sat gap between miner commits (230,952,500) and `gross-accrued-rewards` (230,327,835). The likely cause is sBTC deposit sweep fees or mint lag. This is unverified.
- It is not clear why a fresh commit sometimes misses even a long-interval block. Confirming that would need miner logs or live mempool monitoring.
