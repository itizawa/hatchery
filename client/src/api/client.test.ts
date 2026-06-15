import { describe, expect, it } from "vitest";

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
