import type { NextFunction, Request, Response } from "express";
import multer from "multer";

import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from "../services/storageService.js";

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  // eslint-disable-next-line max-params
  fileFilter(_req, file, callback) {
    const allowedMimes: readonly string[] = ALLOWED_IMAGE_MIME_TYPES;
    if (allowedMimes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
});

// eslint-disable-next-line max-params
export function singleImageUpload(req: Request, res: Response, next: NextFunction): void {
  imageUpload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "FileTooLarge: image must be 5MB or less" });
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}
