import { describe, expect, it } from "vitest";

import { decrypt, encrypt, maskApiKey, resolveAppSecret } from "./crypto.js";

describe("crypto", () => {
  it("暗号化した値を復号すると元のテキストが返る", () => {
    const original = "sk-ant-api03-test-key-12345";
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it("同じ平文を2回暗号化すると異なる暗号文になる（IV ランダム性）", () => {
    const original = "sk-ant-api03-test-key-12345";
    const enc1 = encrypt(original);
    const enc2 = encrypt(original);
    expect(enc1).not.toBe(enc2);
  });

  it("不正な形式の暗号文を復号すると例外を投げる", () => {
    expect(() => decrypt("invalid-ciphertext")).toThrow();
  });

  it("区切りが 2 個未満（要素が 3 個に満たない）の暗号文は形式エラーを投げる", () => {
    expect(() => decrypt("only-two:parts")).toThrow("Invalid ciphertext format");
  });

  it("区切りが多すぎる（4 要素以上）暗号文は形式エラーを投げる", () => {
    expect(() => decrypt("a:b:c:d")).toThrow("Invalid ciphertext format");
  });

  it("空文字列を暗号化・復号できる", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });
});

describe("resolveAppSecret", () => {
  it("production + APP_SECRET 未設定 → エラーを投げる", () => {
    expect(() => resolveAppSecret({ NODE_ENV: "production" })).toThrow(
      "APP_SECRET 環境変数が設定されていません",
    );
  });

  it("production + APP_SECRET 設定済み → 設定値を返す", () => {
    expect(resolveAppSecret({ NODE_ENV: "production", APP_SECRET: "my-secret" })).toBe(
      "my-secret",
    );
  });

  it("非 production + APP_SECRET 未設定 → フォールバック値を返す", () => {
    expect(resolveAppSecret({ NODE_ENV: "development" })).toBe("hatchery-dev-secret");
  });

  it("NODE_ENV 未設定 + APP_SECRET 未設定 → フォールバック値を返す", () => {
    expect(resolveAppSecret({})).toBe("hatchery-dev-secret");
  });
});

describe("maskApiKey", () => {
  it("空文字列 → null を返す", () => {
    expect(maskApiKey("")).toBeNull();
  });

  it("11 文字超 → 先頭 11 文字 + **** を返す", () => {
    // "sk-ant-xxxxxxxx" は 15 文字（> 11）
    expect(maskApiKey("sk-ant-xxxxxxxx")).toBe("sk-ant-xxxx****");
  });

  it("12 文字ちょうど（境界の直上）→ 先頭 11 文字 + **** を返す", () => {
    // "sk-ant-12345" は 12 文字（> 11 が真の最小ケース）
    expect(maskApiKey("sk-ant-12345")).toBe("sk-ant-1234****");
  });

  it("11 文字ちょうど → 先頭 3 文字 + ****（else 分岐）を返す", () => {
    // "sk-ant-1234" は 11 文字（> 11 が偽 → else）
    expect(maskApiKey("sk-ant-1234")).toBe("sk-****");
  });

  it("3 文字以下の短い値 → slice(0,3) 相当 + **** を返す", () => {
    // 2 文字。slice(0,3) は範囲超過でも例外なく "ab" を返す
    expect(maskApiKey("ab")).toBe("ab****");
  });
});
