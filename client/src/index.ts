import { CHANNEL_IDS } from "@hatchery/common";

/**
 * @hatchery/client のパッケージ API（docs(#9)/Storybook 等が参照する純粋な表面）。
 * SPA 本体（React / MUI / TanStack）は main.tsx 以下に実装し、本 barrel には UI を持ち込まない
 * （docs の node 実行時に React を読み込ませないため）。
 *
 * client → common の実依存をここ（MVP のチャンネル数）と SPA 側（ChannelList が DEFAULT_CHANNELS を描画）の
 * 双方で表現する。許可方向（client → common の一方向）は #4 の ESLint 境界で機械的に強制される。
 */

/** docs(#9) が参照するパッケージ API（MVP の既定チャンネル数 = CHANNEL_IDS の件数）。 */
export const channelCount = (): number => CHANNEL_IDS.length;
