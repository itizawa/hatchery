import { ForbiddenError, UnauthorizedError, isAdmin } from "@hatchery/common";
import type { NextFunction, Request, Response } from "express";

// #603: Bearer トークン（MCP Server 等のサーバサイドクライアント）と
// session 認証（ブラウザ）の両方を受け付ける admin 認可ミドルウェア。
// eslint-disable-next-line max-params
export function requireAdminAccess(req: Request, _res: Response, next: NextFunction): void {
  const adminToken = process.env.HATCHERY_ADMIN_TOKEN;
  if (adminToken) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (token === adminToken) {
      next();
      return;
    }
  }

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
