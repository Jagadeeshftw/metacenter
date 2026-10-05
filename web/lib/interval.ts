// The distribution interval, spelled out wherever a figure is "per interval".
//
// pox-5 distributes once per interval, so most sats figures on this site are per interval and not
// per year, per cycle or per block. A bare "per interval" means nothing to a reader meeting it for
// the first time, so these phrases carry the length every time.
export const INTERVAL = {
  blocks: 1050,
  days: 7.3,
  perYear: 50,
  /** two intervals make one reward cycle */
  cycleBlocks: 2100,
};

/** Full phrase, for the first or most prominent use on a page. */
export const PER_INTERVAL = "per distribution interval — 1,050 Bitcoin blocks, about 7.3 days, roughly 50 a year";

/** Parenthetical, for labels and table headers where the full phrase would crowd the figure. */
export const PER_INTERVAL_SHORT = "per distribution interval (1,050 Bitcoin blocks, ~7.3 days)";

/** Why our ratio matches the SIP's even though the SIP states it per cycle. */
export const CYCLE_VS_INTERVAL =
  "The SIP draft defines the coverage ratio per reward cycle (2,100 blocks); this site computes it per distribution interval (1,050 blocks). The ratio is the same either way, because a cycle is exactly two intervals and both the pool and the obligation double.";
