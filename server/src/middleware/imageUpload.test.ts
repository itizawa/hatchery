import type { NextFunction, Request, Response } from "express";
import express, { type Express } from "express";
import multer from "multer";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { MAX_IMAGE_SIZE_BYTES } from "../services/storageService.js";
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
    app.post("/t", singleImageUpload, (req, res) => {
      res.status(200).json({ hasFile: req.file != null });
    });
    app.use(
      // eslint-disable-next-line max-params
      (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        const code = err instanceof multer.MulterError ? err.code : undefined;
        res.status(599).json({ viaNext: true, code });
      },
    );
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

  it("LIMIT_FILE_SIZE 以外のエラーでは next(err) でエラーハンドラーに委譲される", async () => {
    const small = Buffer.from("not a real image but small");

    const res = await request(appWithUpload())
      .post("/t")
      .attach("wrongField", small, "x.png");

    expect(res.status).toBe(599);
    expect(res.body).toEqual({ viaNext: true, code: "LIMIT_UNEXPECTED_FILE" });
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
