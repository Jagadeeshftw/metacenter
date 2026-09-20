import { defineConfig } from "vitest/config";
import { vitestSetupFilePath } from "@stacks/clarinet-sdk/vitest";

// Mainnet-fork tests at the current tip; the manifest is written by scripts/verify-at-tip.mjs.
export default defineConfig({
  test: {
    include: ["tests-tip/**/*.test.ts"],
    environment: "clarinet",
    pool: "forks",
    isolate: false,
    maxWorkers: 1,
    testTimeout: 300_000,
    hookTimeout: 300_000,
    setupFiles: [vitestSetupFilePath],
    environmentOptions: { clarinet: { manifestPath: "./Clarinet.tip.toml" } },
  },
});
