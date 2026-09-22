import { describe, it, expect } from "vitest";
import { evaluate, renderDistribution, seedPosted, type AlertState } from "./alerts-core.js";

const base: AlertState = {
  burnHeight: 967910,
  takenAt: new Date().toISOString(),
  distribution: 286,
  cycle: 143,
  coverage: { value: 16.678, provenance: "onchain" },
  headroom: { value: 0.94, provenance: "onchain" },
  pool: "230327835",
  obligation: "13810222",
  reserve: { value: "152669889", provenance: "onchain" },
  reserveCover: 5.52,
  yieldPerStx: 0.4202,
  apyBtc: 0.0667,
  bondIndexes: [1],
  cacheBehind: 117,
  keeper: { lowBalance: false, lastStatus: "success", lastKind: "refresh" },
};
const seen = { distributions: [286], active: [], bonds: [1] };
const keys = (s: AlertState, posted = seen) => evaluate(s, posted).map((a) => a.key);

describe("what the channel posts", () => {
  it("posts a distribution summary once", () => {
    expect(keys(base, { distributions: [285], active: [], bonds: [1] })).toContain("distribution:286");
    expect(keys(base)).not.toContain("distribution:286");
  });

  it("posts the next distribution when it lands", () => {
    expect(keys({ ...base, distribution: 287 })).toContain("distribution:287");
  });

  it("names every headline figure with its provenance and the block", () => {
    const text = renderDistribution(base);
    expect(text).toContain("Coverage: 16.68× [onchain]");
    expect(text).toContain("Headroom: 94.00% [onchain]");
    expect(text).toContain("230,327,835 sats vs 13,810,222 sats owed");
    expect(text).toContain("152,669,889 sats [onchain]");
    expect(text).toContain("0.4202 sats per STX");
    expect(text).toContain("6.67% a year in BTC terms [mirrored]");
    expect(text).toContain("Bitcoin block 967,910");
    expect(text).toContain("https://metacenter.0xo.in/dashboard");
    expect(text).toContain("accrual-only in this iteration");
  });

  it("warns under 3.0x and escalates under 2.0x, never both", () => {
    const warn = keys({ ...base, coverage: { value: 2.4, provenance: "onchain" } });
    expect(warn).toContain("warn:coverage-warn");
    expect(warn).not.toContain("warn:coverage-critical");
    const crit = keys({ ...base, coverage: { value: 1.4, provenance: "onchain" } });
    expect(crit).toContain("warn:coverage-critical");
    expect(crit).not.toContain("warn:coverage-warn");
  });

  it("warns on thin headroom, a stale cache and a keeper that is stuck or broke", () => {
    expect(keys({ ...base, headroom: { value: 0.41, provenance: "onchain" } })).toContain("warn:headroom-warn");
    expect(keys({ ...base, cacheBehind: 1500 })).toContain("warn:cache-stale");
    expect(keys({ ...base, keeper: { lowBalance: true, lastStatus: "success", lastKind: "refresh" } })).toContain("warn:keeper-balance");
    expect(keys({ ...base, keeper: { lowBalance: false, lastStatus: "abort_by_response", lastKind: "refresh" } })).toContain("warn:keeper-failed");
  });

  it("does not repeat a warning that is already active", () => {
    const thin = { ...base, coverage: { value: 1.4, provenance: "onchain" } };
    expect(keys(thin, { ...seen, active: ["coverage-critical"] })).not.toContain("warn:coverage-critical");
  });

  it("posts one resolved message when a condition ends, and then nothing", () => {
    const after = evaluate(base, { ...seen, active: ["coverage-critical"] });
    expect(after.map((a) => a.key)).toEqual(["resolved:coverage-critical"]);
    expect(after[0].text).toContain("back above the 2.0× level");
    expect(keys(base)).toEqual([]); // the sender clears it from `active`, so nothing follows
  });

  it("does not announce bonds that were already active when the bot went live", () => {
    // first run, with the Genesis Bond long since active and nothing recorded
    const seeded = seedPosted(base, {});
    expect(seeded.bonds).toEqual([1]);
    expect(evaluate(base, seeded).map((a) => a.key)).not.toContain("bond:1");
    // and the distribution summary still goes out on that first run
    expect(evaluate(base, seeded).map((a) => a.key)).toContain("distribution:286");
  });

  it("announces a bond that appears after the bot went live", () => {
    const seeded = seedPosted(base, {});
    const later = { ...base, bondIndexes: [1, 2] };
    expect(evaluate(later, seeded).map((a) => a.key)).toContain("bond:2");
    expect(evaluate(later, seeded).map((a) => a.key)).not.toContain("bond:1");
  });

  it("seeds only once, so later bonds are not swallowed", () => {
    const seeded = seedPosted(base, {});
    const again = seedPosted({ ...base, bondIndexes: [1, 2] }, seeded);
    expect(again.bonds).toEqual([1]);
  });

  it("announces a bond index once", () => {
    expect(keys({ ...base, bondIndexes: [1, 2] })).toContain("bond:2");
    expect(keys({ ...base, bondIndexes: [1, 2] }, { ...seen, bonds: [1, 2] })).not.toContain("bond:2");
  });

  it("says nothing at all when nothing has changed", () => {
    expect(evaluate(base, seen)).toEqual([]);
  });
});
