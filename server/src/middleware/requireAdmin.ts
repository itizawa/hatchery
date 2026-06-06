import { ForbiddenError, UnauthorizedError, isAdmin } from "@hatchery/common";
import type { NextFunction, Request, Response } from "express";

// #136: admin ロールを持つ認証済みユーザーのみを通す。requireAuth の後段で使う。
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.isAuthenticated() || !req.user) {
    next(new UnauthorizedError("Unauthorized"));
    return;
  }
  if (!isAdmin(req.user)) {
    next(new ForbiddenError("Forbidden: admin role required"));
    return;
  }
  next();
}
