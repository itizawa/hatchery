import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "@hatchery/common";
import express, { type Express, type RequestHandler } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "./errorHandler.js";

/** next(err) で任意のエラーを投げるルートを持つテスト用アプリ。 */
function appThrowing(thrower: RequestHandler): Express {
  const app = express();
  app.get("/t", thrower);
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("NotFoundError は 404 と error メッセージを返す", async () => {
    const res = await request(
      // eslint-disable-next-line max-params
      appThrowing((_req, _res, next) => {
        next(new NotFoundError("ChannelNotFound"));
      }),
    ).get("/t");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("ChannelNotFound");
  });

  it("BadRequestError は 400 と error メッセージを返す", async () => {
    const res = await request(
      // eslint-disable-next-line max-params
      appThrowing((_req, _res, next) => {
        next(new BadRequestError("EmployeeNotLinked"));
      }),
    ).get("/t");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("EmployeeNotLinked");
  });

  it("UnauthorizedError は 401 と error メッセージを返す", async () => {
    const res = await request(
      // eslint-disable-next-line max-params
      appThrowing((_req, _res, next) => {
        next(new UnauthorizedError("Unauthorized"));
      }),
    ).get("/t");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("ForbiddenError は 403 と error メッセージを返す", async () => {
    const res = await request(
      // eslint-disable-next-line max-params
      appThrowing((_req, _res, next) => {
        next(new ForbiddenError("Forbidden"));
      }),
    ).get("/t");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });

  it("status 413 を持つエラーは 413 PayloadTooLarge に変換する", async () => {
    const res = await request(
      // eslint-disable-next-line max-params
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
    // 500 経路は console.error を出すため、テスト出力を汚さないようモックする。
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(
      // eslint-disable-next-line max-params
      appThrowing((_req, _res, next) => {
        next(new Error("boom"));
      }),
    ).get("/t");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("InternalServerError");
  });

  it("500 に変換する想定外エラーは構造化 JSON（event/method/path/error/stack）で console.error にログ出力する", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = new Error("boom");
    await request(
      // eslint-disable-next-line max-params
      appThrowing((_req, _res, next) => {
        next(boom);
      }),
    ).get("/t");

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.event).toBe("http.500");
    expect(parsed.level).toBe("error");
    expect(parsed.severity).toBe("ERROR");
    expect(parsed.method).toBe("GET");
    expect(parsed.path).toBe("/t");
    expect(parsed.error).toBe("boom");
    expect(typeof parsed.stack).toBe("string");
    expect(parsed.stack).toContain("Error: boom");
  });

  it("5xx の AppError（InternalServerError 等）も構造化 JSON（event/statusCode）で console.error にログ出力する", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new InternalServerError("SceneGenerationFailed");
    const res = await request(
      // eslint-disable-next-line max-params
      appThrowing((_req, _res, next) => {
        next(err);
      }),
    ).get("/t");

    expect(res.status).toBe(500);
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.event).toBe("http.error");
    expect(parsed.statusCode).toBe(500);
    expect(parsed.error).toBe("SceneGenerationFailed");
  });

  it("AppError（4xx）や 413 など想定内エラーは console.error しない", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await request(
      // eslint-disable-next-line max-params
      appThrowing((_req, _res, next) => {
        next(new NotFoundError("ChannelNotFound"));
      }),
    ).get("/t");
    await request(
      // eslint-disable-next-line max-params
      appThrowing((_req, _res, next) => {
        const err = Object.assign(new Error("too large"), {
          status: 413,
          type: "entity.too.large",
        });
        next(err);
      }),
    ).get("/t");

    expect(spy).not.toHaveBeenCalled();
  });

  it("応答開始後のエラーは二重送信せず、既に送った応答を維持する", async () => {
    // タイムアウト 503 送出後に遅延ハンドラが next(err) するケースの再現。
    // headersSent ガードにより 200 のまま（500 で上書きしない）であることを確認。
    const res = await request(
      // eslint-disable-next-line max-params
      appThrowing((_req, res, next) => {
        res.status(200).json({ ok: true });
        next(new Error("late error after response"));
      }),
    ).get("/t");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
