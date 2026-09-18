-- Metacenter indexer schema. Idempotent: applied at every start.

-- One row per pox-5 distribution (calculate-rewards call), mainnet.
CREATE TABLE IF NOT EXISTS intervals (
  distribution_index   integer PRIMARY KEY,   -- (calculation_height - first_burn) / (cycle_length / 2)
  stx_cycle            integer NOT NULL,       -- reward cycle the distribution is booked to
  calculation_height   integer NOT NULL,       -- pox-5 calculation-height (burn height)
  txid                 text NOT NULL UNIQUE,   -- mainnet calculate-rewards tx
  stacks_block_height  integer NOT NULL,
  burn_block_height    integer NOT NULL,
  burn_block_time      bigint NOT NULL,        -- unix seconds
  gross_pool_sats      numeric NOT NULL,       -- gross-accrued-rewards
  bond_target_sats     numeric NOT NULL,       -- sum of bond-distribution target-yield
  bond_paid_sats       numeric NOT NULL,       -- total-bond-rewards
  stx_only_sats        numeric NOT NULL,       -- total-stx-staker-rewards
  reserve_deposit_sats numeric NOT NULL,       -- reserve-deposit
  reserve_balance_sats numeric NOT NULL,       -- reserve-balance after
  stx_shares_ustx      numeric NOT NULL,       -- cycle-staked-ustx
  cumulative_rpt_stx   numeric NOT NULL,       -- cumulative-rewards-per-ustx
  raw_event            jsonb NOT NULL,
  -- independent recomputation from historical state (call-read ?tip=)
  tip_before           text,
  tip_after            text,
  tip_gross_pool_sats  numeric,
  tip_reserve_deposit_sats numeric,
  tip_stx_only_sats    numeric,
  tip_bond_paid_sats   numeric,
  crosscheck_ok        boolean,
  crosscheck_note      text,
  -- price at the distribution (mirrored)
  price_sats_per_stx   numeric,
  price_source         text,
  price_timestamp      bigint,
  -- testnet risk-feed publication
  published_txid       text,
  published_status     text,
  published_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interval_bonds (
  distribution_index integer NOT NULL REFERENCES intervals(distribution_index),
  bond_index         integer NOT NULL,
  target_yield_sats  numeric NOT NULL,
  bond_rewards_sats  numeric NOT NULL,
  bond_staked_sats   numeric NOT NULL,
  payout_position    integer NOT NULL,      -- order in which pox-5 processed it (0 first)
  PRIMARY KEY (distribution_index, bond_index)
);

-- Hiro /extended/v3/staking/cycles/{n}, latest fetch per cycle.
CREATE TABLE IF NOT EXISTS cycles (
  cycle      integer PRIMARY KEY,
  status     text NOT NULL,
  raw        jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- Every poll: pox5-reader (mainnet) reads + chain tip.
CREATE TABLE IF NOT EXISTS live_snapshots (
  id            bigserial PRIMARY KEY,
  taken_at      timestamptz NOT NULL DEFAULT now(),
  burn_height   integer NOT NULL,
  stacks_height integer NOT NULL,
  current_cycle integer NOT NULL,
  reader        jsonb,          -- null when pox5-reader is not deployed yet
  pox5          jsonb NOT NULL  -- direct pox-5 reads used for cross-checks
);

CREATE TABLE IF NOT EXISTS prices (
  id              bigserial PRIMARY KEY,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  source          text NOT NULL,
  sats_per_stx    numeric NOT NULL,
  price_timestamp bigint NOT NULL,
  raw             jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS kv (
  k text PRIMARY KEY,
  v jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
