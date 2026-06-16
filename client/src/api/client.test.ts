import { afterEach, describe, expect, it, vi } from "vitest";

import { ensureOk, unwrap } from "./client.js";

/** openapi-fetch の戻り値（{ data, error, response }）を模した結果を組み立てる小ヘルパ。 */
function result<T, E>(opts: { data?: T; error?: E; status: number; body?: unknown }) {
  const response = new Response(opts.body === undefined ? null : JSON.stringify(opts.body), {
    status: opts.status,
    headers: { "Content-Type": "application/json" },
  });
  return { data: opts.data, error: opts.error, response };
}

describe("unwrap（#532）", () => {
  it("成功（data あり・response.ok）は data をそのまま返す", () => {
    const r = result<{ ok: boolean }, never>({ data: { ok: true }, status: 200 });
    expect(unwrap(r, "GET /api/foo")).toEqual({ ok: true });
  });

  it("error があれば throw する（サーバの { error } メッセージを含む）", () => {
    const r = result<undefined, { error: string }>({
      error: { error: "権限がありません" },
      status: 403,
    });
    expect(() => unwrap(r, "GET /api/foo")).toThrow("権限がありません");
  });

  it("!response.ok（error 無し・空ボディ）でも throw する（label と status を含む）", () => {
    const r = result<undefined, never>({ status: 500 });
    expect(() => unwrap(r, "GET /api/foo")).toThrow("GET /api/foo (500)");
  });

  it("data が無い（null/undefined）なら 2xx でも throw する", () => {
    const r = result<undefined, never>({ status: 200 });
    expect(() => unwrap(r, "GET /api/foo")).toThrow("GET /api/foo (200)");
  });

  it("error が { error: string } 形でも response.ok でなければ status フォールバックを使う", () => {
    // error はあるが文字列メッセージを持たない（空文字）→ label + status を採用する。
    const r = result<undefined, { error: string }>({ error: { error: "" }, status: 502 });
    expect(() => unwrap(r, "POST /api/bar")).toThrow("POST /api/bar (502)");
  });
});

describe("ensureOk（#532）", () => {
  it("成功（data あり）は data を返す", () => {
    const r = result<{ ok: boolean }, never>({ data: { ok: true }, status: 200 });
    expect(ensureOk(r, "GET /api/foo")).toEqual({ ok: true });
  });

  it("data が無くても 2xx なら throw せず undefined を返す（空ボディ許容）", () => {
    const r = result<undefined, never>({ status: 200 });
    expect(ensureOk(r, "GET /api/foo")).toBeUndefined();
  });

  it("error があれば throw する（サーバの { error } メッセージを含む）", () => {
    const r = result<undefined, { error: string }>({
      error: { error: "Unauthorized" },
      status: 401,
    });
    expect(() => ensureOk(r, "GET /api/foo")).toThrow("Unauthorized");
  });

  it("!response.ok（error 無し・空ボディ）でも throw する（label と status を含む）", () => {
    const r = result<undefined, never>({ status: 503 });
    expect(() => ensureOk(r, "GET /api/foo")).toThrow("GET /api/foo (503)");
  });
});

// #591: apiBaseUrl 解決優先順位（env > window.origin > 空文字）のテスト。
// apiBaseUrl はモジュール評価時に計算される定数のため、vi.resetModules + vi.doMock + 動的 import で
// テストごとに異なる env / window 状態を差し込む。
// vi.resetModules() を vi.doMock より先に呼ぶことで、このファイル上部の静的 import による
// キャッシュをクリアし、次の動的 import で新たにモジュールを評価させる。
describe("apiBaseUrl 解決優先順位（#591）", () => {
  afterEach(() => {
    vi.doUnmock("../config/env.js");
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("(a) clientEnv.apiBaseUrl が設定されているときはその値を採用する", async () => {
    vi.resetModules();
    vi.doMock("../config/env.js", () => ({
      clientEnv: { apiBaseUrl: "https://api.example.com", logLevel: "info" },
    }));
    const { apiBaseUrl } = await import("./client.js");
    expect(apiBaseUrl).toBe("https://api.example.com");
  });

  it("(b) clientEnv.apiBaseUrl 未設定かつ window ありのとき window.location.origin を採用する", async () => {
    vi.resetModules();
    vi.doMock("../config/env.js", () => ({
      clientEnv: { apiBaseUrl: undefined, logLevel: "info" },
    }));
    vi.stubGlobal("window", { location: { origin: "https://app.example.com" } });
    const { apiBaseUrl } = await import("./client.js");
    expect(apiBaseUrl).toBe("https://app.example.com");
  });

  it("(c) clientEnv.apiBaseUrl 未設定かつ window 無しのとき空文字を採用する", async () => {
    vi.resetModules();
    vi.doMock("../config/env.js", () => ({
      clientEnv: { apiBaseUrl: undefined, logLevel: "info" },
    }));
    // jsdom 環境では window が常に存在するため、一時的に globalThis.window を削除する
    const savedWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
    try {
      const { apiBaseUrl } = await import("./client.js");
      expect(apiBaseUrl).toBe("");
    } finally {
      globalThis.window = savedWindow;
    }
  });
});
