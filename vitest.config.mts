import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only; the app's own routes are exercised against a running
    // server rather than mocked.
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
