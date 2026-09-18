import { defineConfig } from "vitest/config";
import { vitestSetupFilePath } from "@stacks/clarinet-sdk/vitest";

// Mainnet-fork tests: pox5-reader against real pox-5 state at a pinned height.
export default defineConfig({
  test: {
    include: ["tests-fork/**/*.test.ts"],
    environment: "clarinet",
    pool: "forks",
    isolate: false,
    maxWorkers: 1,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    setupFiles: [vitestSetupFilePath],
    environmentOptions: {
      clarinet: { manifestPath: "./Clarinet.fork.toml" },
    },
  },
});
