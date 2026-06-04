import type { AuthUser } from "@hatchery/common";

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthUser {}
  }
}
