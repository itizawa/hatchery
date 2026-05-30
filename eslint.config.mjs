import path from "node:path";

import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import tseslint from "typescript-eslint";

const ROOT = import.meta.dirname;
const ws = (name) => path.join(ROOT, name, "tsconfig.json");

/**
 * ADR-0001 / ADR-0007 の依存方向を機械的に強制する flat config。
 *
 * - 主軸: import/no-restricted-paths（zone）。相対 import まで解決して塞ぐ。
 *   basePath を本ファイルの位置（リポジトリルート）に固定し、各ワークスペースで
 *   `eslint .` を実行しても zone の解決基準がぶれないようにする。
 * - 補助: no-restricted-imports。`@hatchery/*` パッケージ名経由の抜け道を塞ぐ。
 */
export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: { import: importPlugin },
    settings: {
      "import/resolver": {
        typescript: {
          project: [ws("common"), ws("server"), ws("client"), ws("docs")],
        },
      },
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          basePath: ROOT,
          zones: [
            { target: "./client", from: "./server", message: "client → server は禁止" },
            { target: "./server", from: "./client", message: "server → client は禁止" },
            {
              target: "./common",
              from: "./client",
              message: "common はアプリ固有（client）に依存しない",
            },
            {
              target: "./common",
              from: "./server",
              message: "common はアプリ固有（server）に依存しない",
            },
            {
              target: "./common",
              from: "./docs",
              message: "common はアプリ固有（docs）に依存しない",
            },
            {
              target: "./docs",
              from: "./server",
              message: "docs は client/common のみ参照可（server 禁止）",
            },
          ],
        },
      ],
    },
  },
  // client はブラウザ実行（React SPA）。document/window 等のブラウザ globals を許可する。
  {
    files: ["client/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  // 補助: パッケージ名（@hatchery/*）経由の依存方向違反をワークスペースごとに塞ぐ。
  {
    files: ["client/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@hatchery/server", "@hatchery/server/*"] }],
    },
  },
  {
    files: ["server/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@hatchery/client", "@hatchery/client/*"] }],
    },
  },
  {
    files: ["common/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@hatchery/client",
            "@hatchery/client/*",
            "@hatchery/server",
            "@hatchery/server/*",
            "@hatchery/docs",
            "@hatchery/docs/*",
          ],
        },
      ],
    },
  },
  {
    files: ["docs/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@hatchery/server", "@hatchery/server/*"] }],
    },
  },
  // テストフィクスチャ文字列を扱う検証テストは境界ルールの対象外（実ファイルではない）。
  {
    files: ["tests/**/*.ts"],
    rules: {
      "import/no-restricted-paths": "off",
      "no-restricted-imports": "off",
    },
  },
  prettierConfig,
);
