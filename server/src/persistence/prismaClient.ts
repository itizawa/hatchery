import { PrismaClient } from "@prisma/client";

/**
 * PrismaClient のシングルトン。API（server.ts）と定時バッチ（batch/index.ts）の
 * エントリポイントから利用する。テスト/ユースケースはこれを直接 import しない
 * （SceneRepository を注入する）。
 */
export const prisma = new PrismaClient();
