import { DEFAULT_CHANNELS } from "@hatchery/common";

/**
 * @hatchery/client のパッケージ API（docs(#9)/Storybook 等が参照する純粋な表面）。
 * SPA 本体（React / MUI / TanStack）は main.tsx 以下に実装し、本 barrel には UI を持ち込まない
 * （docs の node 実行時に React を読み込ませないため）。許可方向は client → common の一方向のみ。
 */

/** docs(#9) の placeholder が参照する純粋関数（client → common 契約の最小例）。 */
export const total = (a: number, b: number): number => a + b;

/** client → common の実依存（MVP の既定チャンネル数）。 */
export const channelCount = (): number => DEFAULT_CHANNELS.length;
