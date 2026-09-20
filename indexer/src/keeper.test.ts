import { describe, it, expect } from "vitest";
import { refreshReasons } from "./model.js";

// What the cache holds now: distribution 286 was computed at 967,399, cycle 143, read at 967,793.
const STALE = 1100; // the keeper's default window
const STORED = { cycle: 143, lastComputeHeight: 967399, updatedAt: 967793 };

describe("when the keeper refreshes coverage-cache", () => {
  it("does nothing while the chain has not moved", () => {
    expect(refreshReasons(STORED, { cycle: 143, lastComputeHeight: 967399, burnHeight: 967900 }, STALE)).toEqual([]);
  });

  it("refreshes when distribution 287 is computed at 968,449", () => {
    const reasons = refreshReasons(STORED, { cycle: 143, lastComputeHeight: 968449, burnHeight: 968449 }, STALE);
    expect(reasons).toContain("a distribution was computed at 968449");
  });

  it("refreshes when the cycle rolls over", () => {
    expect(refreshReasons(STORED, { cycle: 144, lastComputeHeight: 968449, burnHeight: 968460 }, STALE)).toContain("cycle 143 -> 144");
  });

  it("refreshes a reading that is about a week old even if nothing moved", () => {
    expect(refreshReasons(STORED, { cycle: 143, lastComputeHeight: 967399, burnHeight: 967793 + 1100 }, STALE)).toEqual([
      "reading is 1100 burn blocks old",
    ]);
    expect(refreshReasons(STORED, { cycle: 143, lastComputeHeight: 967399, burnHeight: 967793 + 1099 }, STALE)).toEqual([]);
  });
});
