import type { NextFunction, Request, Response } from "express";
import express, { type Express } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_IMAGE_SIZE_BYTES } from "../services/storageService.js";
import { errorHandler } from "./errorHandler.js";
import { imageFileFilter, singleImageUpload } from "./imageUpload.js";

describe("imageFileFilter", () => {
  it("許可された MIME タイプ (image/png) では callback(null, true) が呼ばれる", () => {
    const callback = vi.fn();
    imageFileFilter(
      {} as Request,
      { mimetype: "image/png" } as Express.Multer.File,
      callback,
    );
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it("許可されない MIME タイプ (text/plain) では callback(null, false) が呼ばれる", () => {
    const callback = vi.fn();
    imageFileFilter(
      {} as Request,
      { mimetype: "text/plain" } as Express.Multer.File,
      callback,
    );
    expect(callback).toHaveBeenCalledWith(null, false);
  });
});

describe("singleImageUpload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("非 multipart なリクエストでは next() が呼ばれ、レスポンスに書き込みが行われない", () => {
    const req = { headers: {} } as Request;
    const res = {
      status: vi.fn(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    singleImageUpload(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect((res.status as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect((res.json as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  function appWithUpload(): Express {
    const app = express();
    app.post(
      "/t",
      singleImageUpload,
      // eslint-disable-next-line max-params
      (req, res) => {
        res.status(200).json({ hasFile: req.file != null });
      },
    );
    app.use(errorHandler);
    return app;
  }

  it("5MB を超えるファイルでは 400 と FileTooLarge メッセージを返す", async () => {
    const oversized = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1);

    const res = await request(appWithUpload())
      .post("/t")
      .attach("image", oversized, "big.png");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "FileTooLarge: image must be 5MB or less",
    });
  });

  it("LIMIT_FILE_SIZE 以外のエラーでは next(err) でエラーハンドラーに委譲される（singleImageUpload 自身は 400 を返さない）", async () => {
    // 想定外エラーは errorHandler の 500 経路（console.error にログ出力）に到達する。
    // テスト出力を汚さないようモックする（errorHandler.test.ts と同じパターン）。
    vi.spyOn(console, "error").mockImplementation(() => {});
    const small = Buffer.from("not a real image but small");

    const res = await request(appWithUpload())
      .post("/t")
      .attach("wrongField", small, "x.png");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "InternalServerError" });
  });

  it("正常なアップロードでは next() が呼ばれ req.file が設定される", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    const res = await request(appWithUpload())
      .post("/t")
      .attach("image", png, { filename: "ok.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasFile: true });
  });
});
