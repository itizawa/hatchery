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
// get / set / destroy は in-memory Map で実装し、DB 接続なしでセッション操作を検証する。
const pgSessionOptions = vi.fn();
const sessionDb = new Map<string, session.SessionData>();
vi.mock("connect-pg-simple", () => {
  return {
    default: () =>
      class DummyPgStore extends session.Store {
        constructor(options: unknown) {
          super();
          pgSessionOptions(options);
        }
        // eslint-disable-next-line max-params
        override get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void) {
          callback(null, sessionDb.get(sid) ?? null);
        }
        // eslint-disable-next-line max-params
        override set(sid: string, data: session.SessionData, callback?: (err?: unknown) => void) {
          sessionDb.set(sid, data);
          callback?.();
        }
        // eslint-disable-next-line max-params
        override destroy(sid: string, callback?: (err?: unknown) => void) {
          sessionDb.delete(sid);
          callback?.();
        }
      },
  };
});

import { createPgSessionStore } from "./pgSessionStore.js";

describe("createPgSessionStore", () => {
  beforeEach(() => {
    poolConstructor.mockClear();
    pgSessionOptions.mockClear();
    sessionDb.clear();
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

  describe("set / get / destroy", () => {
    it("set でセッションを DB に保存する（コールバックが呼ばれる）", () => {
      const store = createPgSessionStore("postgres://test/db");
      const callback = vi.fn();
      store.set("sid-set", { cookie: { originalMaxAge: null } }, callback);
      expect(callback).toHaveBeenCalledOnce();
    });

    it("get で存在するセッションを取得できる", () => {
      const store = createPgSessionStore("postgres://test/db");
      const data: session.SessionData = { cookie: { originalMaxAge: null } };
      const setCallback = vi.fn();
      store.set("sid-get-exists", data, setCallback);

      const getCallback = vi.fn();
      store.get("sid-get-exists", getCallback);

      expect(getCallback).toHaveBeenCalledWith(null, data);
    });

    it("get で存在しないセッションは null を返す", () => {
      const store = createPgSessionStore("postgres://test/db");
      const callback = vi.fn();
      store.get("non-existent-sid", callback);
      expect(callback).toHaveBeenCalledWith(null, null);
    });

    it("destroy でセッションを DB から削除する（コールバックが呼ばれ get で null を返す）", () => {
      const store = createPgSessionStore("postgres://test/db");
      const sid = "sid-destroy";
      store.set(sid, { cookie: { originalMaxAge: null } });
      const destroyCallback = vi.fn();
      store.destroy(sid, destroyCallback);

      expect(destroyCallback).toHaveBeenCalledOnce();

      const getCallback = vi.fn();
      store.get(sid, getCallback);
      expect(getCallback).toHaveBeenCalledWith(null, null);
    });
  });
});
