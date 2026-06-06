import { UnauthorizedError } from "@hatchery/common";
import type { NextFunction, Request, Response } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    next();
    return;
  }
  next(new UnauthorizedError("Unauthorized"));
}
