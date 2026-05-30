import type { RequestHandler } from "express";
import type { ZodType } from "zod";

/**
 * common の Zod スキーマでリクエストボディを検証するミドルウェアを生成する。
 * 失敗時は 400 と issues を返し、成功時は parse 済みデータで req.body を上書きして next する。
 * スキーマを common と共有することで二重定義を避ける（ADR-0005 / ADR-0006）。
 */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: "ValidationError", issues: result.error.issues });
      return;
    }
    req.body = result.data;
    next();
  };
}
