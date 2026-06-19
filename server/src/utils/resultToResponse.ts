import { isOk, type DomainErrorType, type Result } from "@hatchery/common";
import type { Response } from "express";

/**
 * Result<T, DomainError> を Express レスポンスに写像するユーティリティ（ADR-0021）。
 *
 * - Ok の場合: false を返す（呼び出し元が成功レスポンスを送信する責務を持つ）
 * - Err の場合: DomainError.type → HTTP ステータスに変換してレスポンスを送信し、true を返す
 *
 * 典型的な使用パターン:
 * ```ts
 * const result = someResult();
 * if (isErr(result)) { resultToResponse(res, result); return; }
 * res.status(200).json(result.value);
 * ```
 *
 * @returns エラーレスポンスを送信した場合は true、Ok の場合は false
 */
// eslint-disable-next-line max-params
export function resultToResponse<T>(res: Response, result: Result<T, { type: DomainErrorType; message: string }>): boolean {
  if (isOk(result)) return false;

  const statusMap: Record<DomainErrorType, number> = {
    NotFound: 404,
    Conflict: 409,
    Forbidden: 403,
    BadRequest: 400,
    InternalError: 500,
  };

  const status = statusMap[result.error.type];
  res.status(status).json({ error: result.error.message });
  return true;
}
