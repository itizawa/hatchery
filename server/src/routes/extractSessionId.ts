import { z } from "zod";
import type { Request } from "express";

const SessionIdSchema = z.string().uuid();

/**
 * リクエストの `sessionId` クエリパラメータを UUID 検証付きで取得する（#831）。
 * UUID フォーマット不正または未指定の場合は null を返す。
 * OpenAPI 仕様（z.string().uuid().optional()）と同じ制約をルート層で強制するためのヘルパー。
 */
export function extractSessionId(req: Request): string | null {
  const result = SessionIdSchema.safeParse(req.query["sessionId"]);
  return result.success ? result.data : null;
}
