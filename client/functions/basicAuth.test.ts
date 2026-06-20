// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseBasicAuth, validateBasicAuth } from "./basicAuth";

describe("parseBasicAuth", () => {
  it("Authorization ヘッダが null の場合は null を返す", () => {
    expect(parseBasicAuth(null)).toBeNull();
  });

  it("'Basic ' プレフィックスが無い場合は null を返す", () => {
    expect(parseBasicAuth("Bearer sometoken")).toBeNull();
  });

  it("不正な Base64 文字列の場合は null を返す", () => {
    expect(parseBasicAuth("Basic !!!invalid!!!")).toBeNull();
  });

  it("':' を含まない decoded 値の場合は null を返す", () => {
    expect(parseBasicAuth("Basic " + btoa("nocolonhere"))).toBeNull();
  });

  it("正しい 'user:password' 形式を parse してオブジェクトを返す", () => {
    const result = parseBasicAuth("Basic " + btoa("user:pass"));
    expect(result).toEqual({ user: "user", password: "pass" });
  });

  it("パスワードに ':' が含まれる場合、最初の ':' でのみ分割する", () => {
    const result = parseBasicAuth("Basic " + btoa("user:pass:with:colons"));
    expect(result).toEqual({ user: "user", password: "pass:with:colons" });
  });
});

describe("validateBasicAuth", () => {
  it("Authorization ヘッダが null の場合は false を返す", () => {
    expect(validateBasicAuth({ authHeader: null, expectedUser: "user", expectedPassword: "pass" })).toBe(false);
  });

  it("Authorization ヘッダが undefined の場合は false を返す", () => {
    expect(validateBasicAuth({ authHeader: undefined, expectedUser: "user", expectedPassword: "pass" })).toBe(false);
  });

  it("'Basic ' プレフィックスが無い場合は false を返す", () => {
    expect(validateBasicAuth({ authHeader: "Bearer token", expectedUser: "user", expectedPassword: "pass" })).toBe(false);
  });

  it("不正な Base64 の場合は false を返す", () => {
    expect(validateBasicAuth({ authHeader: "Basic !!!invalid!!!", expectedUser: "user", expectedPassword: "pass" })).toBe(false);
  });

  it("':' を含まない decoded 値の場合は false を返す", () => {
    expect(validateBasicAuth({ authHeader: "Basic " + btoa("nocolon"), expectedUser: "user", expectedPassword: "pass" })).toBe(false);
  });

  it("正しい資格情報の場合は true を返す", () => {
    expect(validateBasicAuth({ authHeader: "Basic " + btoa("user:pass"), expectedUser: "user", expectedPassword: "pass" })).toBe(true);
  });

  it("パスワード不一致の場合は false を返す", () => {
    expect(validateBasicAuth({ authHeader: "Basic " + btoa("user:wrong"), expectedUser: "user", expectedPassword: "pass" })).toBe(false);
  });

  it("ユーザ名不一致の場合は false を返す", () => {
    expect(validateBasicAuth({ authHeader: "Basic " + btoa("wrong:pass"), expectedUser: "user", expectedPassword: "pass" })).toBe(false);
  });

  it("パスワードに ':' を含む場合でも正しく検証する", () => {
    expect(
      validateBasicAuth({ authHeader: "Basic " + btoa("user:pass:with:colons"), expectedUser: "user", expectedPassword: "pass:with:colons" }),
    ).toBe(true);
  });

  it("空文字列ユーザ名でも正しく検証する", () => {
    expect(validateBasicAuth({ authHeader: "Basic " + btoa(":pass"), expectedUser: "", expectedPassword: "pass" })).toBe(true);
  });
});
