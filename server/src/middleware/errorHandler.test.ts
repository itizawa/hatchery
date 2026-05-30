import express, { type Express, type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { errorHandler } from "./errorHandler.js";

/** next(err) で任意のエラーを投げるルートを持つテスト用アプリ。 */
function appThrowing(thrower: RequestHandler): Express {
  const app = express();
  app.get("/t", thrower);
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("status 413 を持つエラーは 413 PayloadTooLarge に変換する", async () => {
    const res = await request(
      appThrowing((_req, _res, next) => {
        const err = Object.assign(new Error("too large"), {
          status: 413,
          type: "entity.too.large",
        });
        next(err);
      }),
    ).get("/t");
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("PayloadTooLarge");
  });

  it("その他のエラーは 500 InternalServerError を返す", async () => {
    const res = await request(
      appThrowing((_req, _res, next) => {
        next(new Error("boom"));
      }),
    ).get("/t");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("InternalServerError");
  });

  it("応答開始後のエラーは二重送信せず、既に送った応答を維持する", async () => {
    // タイムアウト 503 送出後に遅延ハンドラが next(err) するケースの再現。
    // headersSent ガードにより 200 のまま（500 で上書きしない）であることを確認。
    const res = await request(
      appThrowing((_req, res, next) => {
        res.status(200).json({ ok: true });
        next(new Error("late error after response"));
      }),
    ).get("/t");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
