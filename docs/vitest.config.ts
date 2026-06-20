import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@hatchery/client": path.resolve(__dirname, "../client/src"),
      "@hatchery/common": path.resolve(__dirname, "../common/src"),
    },
  },
  // vite/esbuild のデフォルト include は .ts/.mts/.tsx のみで .cts を TS 変換しない。
  // .storybook/main.cts（CommonJS TS）を test から import するため .cts も変換対象に加える。
  esbuild: {
    include: [/\.[cm]?[jt]sx?$/],
    // tsx コンポーネント（MarkdownDoc）を React 17+ の自動 JSX ランタイムで変換する。
    // これがないと `React is not defined` になる（docs は plugin-react を使わないため）。
    jsx: "automatic",
  },
  test: {
    // MarkdownDoc など React コンポーネントのレンダリングを RTL で検証するため jsdom を使う。
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    server: {
      deps: {
        // MUI v9 が内部で使う react-transition-group がディレクトリ import を使うため、
        // Vitest の ESM 解決でエラーになる。インラインバンドルすることで回避する。
        inline: [/@mui\/material/, /react-transition-group/],
      },
    },
  },
});
