import path from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: [
    // client のコンポーネント stories を取り込む（ADR-0007）
    "../../client/src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    // docs の設計 MDX ドキュメントを取り込む
    "../src/**/*.mdx",
  ],
  addons: ["@storybook/addon-essentials"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {},
  viteFinal: async (config, { configType }) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = Object.assign({}, config.resolve.alias ?? {}, {
      // ワークスペースパッケージをソースから直接解決し、ビルド済み dist に依存しない
      "@hatchery/client": path.resolve(__dirname, "../../client/src"),
      "@hatchery/common": path.resolve(__dirname, "../../common/src"),
    });
    // GitHub Project Pages は https://<owner>.github.io/<repo>/ のサブパスで配信される。
    // 本番ビルドのみ Vite の base をそのサブパスに合わせ、プレビュー iframe のアセットが
    // ルート絶対パス（/assets/...）で参照されて 404 になるのを防ぐ（Issue #46）。
    // STORYBOOK_BASE_PATH で上書き可（リポジトリ名変更・フォーク対応）。storybook dev は / のまま。
    if (configType === "PRODUCTION") {
      config.base = process.env.STORYBOOK_BASE_PATH ?? "/ai-workspace/";
    }
    return config;
  },
};

export default config;
