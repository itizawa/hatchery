import { DEFAULT_CHANNELS } from "@hatchery/common";

/**
 * @hatchery/server 雛形。許可方向 server → common を実コードで示す。
 * 実体（Express / Prisma / 定時バッチ）は #6 で差し替える。
 *
 * #5 で common の placeholder `add` が実ドメイン API（DEFAULT_CHANNELS 等）へ置き換わったため、
 * #7 で本ファイルの参照を実 API へ最小修復し develop の CI を緑化する（実体は #6 で差し替え）。
 */
export const sum = (a: number, b: number): number => a + b;

/** server → common の実依存（MVP の既定チャンネル数）。 */
export const channelCount = (): number => DEFAULT_CHANNELS.length;
