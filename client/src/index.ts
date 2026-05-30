import { CHANNEL_IDS } from "@hatchery/common";

/**
 * @hatchery/client 雛形。許可方向 client → common を実コードで示す。
 * 実体（Vite + React / MUI / TanStack）は #7 で差し替える。
 */
export const channelCount = (): number => CHANNEL_IDS.length;
