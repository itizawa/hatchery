import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    // src 配下に加え prisma 配下の seed テストも対象にする（#487: seedDevData.test.ts が
    // include に含まれず実行されていなかったため明示的に追加し、seed の検証が CI で走るようにする）。
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.int.test.ts"],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
  },
});
