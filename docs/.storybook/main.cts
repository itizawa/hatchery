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
  viteFinal: async (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = Object.assign({}, config.resolve.alias ?? {}, {
      // ワークスペースパッケージをソースから直接解決し、ビルド済み dist に依存しない
      "@hatchery/client": path.resolve(__dirname, "../../client/src"),
      "@hatchery/common": path.resolve(__dirname, "../../common/src"),
    });
    return config;
  },
};

export default config;
