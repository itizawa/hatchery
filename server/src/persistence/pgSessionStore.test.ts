import session from "express-session";
import { beforeEach, describe, expect, it, vi } from "vitest";

// pg.Pool をコンストラクタモックにして connectionString を検証する。
const poolConstructor = vi.fn();
vi.mock("pg", () => ({
  default: {
    Pool: class {
      constructor(...args: unknown[]) {
        poolConstructor(...args);
      }
    },
  },
}));

// connect-pg-simple のファクトリをモックし、session.Store を継承したダミー Store を返す。
// new PgSession(options) の options を捕捉して tableName / pool を検証する。
const pgSessionOptions = vi.fn();
vi.mock("connect-pg-simple", () => {
  return {
    default: () =>
      class DummyPgStore extends session.Store {
        constructor(options: unknown) {
          super();
          pgSessionOptions(options);
        }
      },
  };
});

import { createPgSessionStore } from "./pgSessionStore.js";

describe("createPgSessionStore", () => {
  beforeEach(() => {
    poolConstructor.mockClear();
    pgSessionOptions.mockClear();
  });

  it("session.Store を返す", () => {
    const store = createPgSessionStore("postgres://user:pass@localhost:5432/db");
    expect(store).toBeInstanceOf(session.Store);
  });

  it("tableName: \"session\" を含む options でストアを構成する", () => {
    createPgSessionStore("postgres://user:pass@localhost:5432/db");
    expect(pgSessionOptions).toHaveBeenCalledOnce();
    const options = pgSessionOptions.mock.calls[0]![0] as { tableName: string; pool: unknown };
    expect(options.tableName).toBe("session");
    expect(options.pool).toBeDefined();
  });

  it("pg.Pool を connectionString 付きで生成する", () => {
    const url = "postgres://user:pass@localhost:5432/db";
    createPgSessionStore(url);
    expect(poolConstructor).toHaveBeenCalledOnce();
    expect(poolConstructor).toHaveBeenCalledWith({ connectionString: url });
  });
});
