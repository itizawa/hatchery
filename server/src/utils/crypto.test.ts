import { describe, expect, it } from "vitest";

import { decrypt, encrypt } from "./crypto.js";

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

  it("空文字列を暗号化・復号できる", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });
});
