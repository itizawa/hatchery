import { add } from "@hatchery/common";

/**
 * @hatchery/server 雛形。許可方向 server → common を実コードで示す。
 * 実体（Express / Prisma / 定時バッチ）は #6 で差し替える。
 */
export const sum = (a: number, b: number): number => add(a, b);
