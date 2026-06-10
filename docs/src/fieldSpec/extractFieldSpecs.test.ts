import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  LoginRequestSchema,
  UpdateProfileSchema,
  UpdateAppSettingSchema,
  AcceptInvitationSchema,
  AVATAR_URL_MAX_LENGTH,
  LOGIN_ID_MAX_LENGTH,
} from "@hatchery/common";

import { extractFieldSpecs } from "./extractFieldSpecs.js";
import { FORM_SPECS } from "./formSpecs.js";

describe("extractFieldSpecs", () => {
  it("必須の文字列フィールド（min/max）を抽出する", () => {
    const specs = extractFieldSpecs(z.object({ name: z.string().min(1).max(50) }));
    expect(specs).toEqual([
      {
        name: "name",
        type: "string",
        required: true,
        constraints: { min: 1, max: 50 },
      },
    ]);
  });

  it("optional な url フィールドを required=false・format=url で抽出する", () => {
    const specs = extractFieldSpecs(
      z.object({ avatarUrl: z.string().url().max(2048).optional() }),
    );
    expect(specs).toEqual([
      {
        name: "avatarUrl",
        type: "string",
        required: false,
        constraints: { format: "url", max: 2048 },
      },
    ]);
  });

  it("enum フィールドを type=enum・enum 値付きで抽出する", () => {
    const specs = extractFieldSpecs(z.object({ role: z.enum(["admin", "member"]) }));
    expect(specs).toEqual([
      {
        name: "role",
        type: "enum",
        required: true,
        constraints: { enum: ["admin", "member"] },
      },
    ]);
  });

  it("number の int/positive/max 制約を抽出する", () => {
    const specs = extractFieldSpecs(
      z.object({ hours: z.number().int().positive().max(720) }),
    );
    expect(specs).toEqual([
      {
        name: "hours",
        type: "number",
        required: true,
        constraints: { int: true, positive: true, max: 720 },
      },
    ]);
  });

  it(".describe() の説明を description に取り込む", () => {
    const specs = extractFieldSpecs(
      z.object({ id: z.string().min(1).describe("ログインID") }),
    );
    expect(specs[0].description).toBe("ログインID");
  });

  it("optional 以外でも default を剥がして基底型を判定する", () => {
    const specs = extractFieldSpecs(z.object({ flag: z.boolean().default(false) }));
    expect(specs[0]).toMatchObject({ name: "flag", type: "boolean", required: false });
  });
});

describe("FORM_SPECS（生成由来のフォーム項目レジストリ）", () => {
  const ids = FORM_SPECS.map((f) => f.id);

  it("AC #2 の入力系スキーマを少なくとも含む", () => {
    for (const id of [
      "LoginRequestSchema",
      "UpdateProfileSchema",
      "CreateCommunitySchema",
      "UpdateCommunitySchema",
      "CreateWorkerSchema",
      "UpdateWorkerSchema",
      "UpdateAppSettingSchema",
      "AcceptInvitationSchema",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("各フォームは 1 つ以上の項目を持ち、id が一意である", () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const form of FORM_SPECS) {
      expect(form.fields.length).toBeGreaterThan(0);
    }
  });

  it("生成された項目が Zod 定義と一致する（生成由来の検証）", () => {
    const login = FORM_SPECS.find((f) => f.id === "LoginRequestSchema")!;
    const loginId = login.fields.find((f) => f.name === "loginId")!;
    // Zod の正本（LoginRequestSchema）の max と一致すること。
    expect(loginId.constraints.max).toBe(LOGIN_ID_MAX_LENGTH);
    expect(loginId.required).toBe(true);

    const profile = FORM_SPECS.find((f) => f.id === "UpdateProfileSchema")!;
    const avatar = profile.fields.find((f) => f.name === "avatarUrl")!;
    expect(avatar.constraints.max).toBe(AVATAR_URL_MAX_LENGTH);
    expect(avatar.constraints.format).toBe("url");
    expect(avatar.required).toBe(false);
  });

  it("extractFieldSpecs を実際の Zod スキーマに適用した結果と一致する（手書きでない）", () => {
    const expectedLogin = extractFieldSpecs(LoginRequestSchema);
    const login = FORM_SPECS.find((f) => f.id === "LoginRequestSchema")!;
    expect(login.fields).toEqual(expectedLogin);

    const expectedProfile = extractFieldSpecs(UpdateProfileSchema);
    const profile = FORM_SPECS.find((f) => f.id === "UpdateProfileSchema")!;
    expect(profile.fields).toEqual(expectedProfile);

    const expectedAppSetting = extractFieldSpecs(UpdateAppSettingSchema);
    const appSetting = FORM_SPECS.find((f) => f.id === "UpdateAppSettingSchema")!;
    expect(appSetting.fields).toEqual(expectedAppSetting);

    const expectedInvitation = extractFieldSpecs(AcceptInvitationSchema);
    const invitation = FORM_SPECS.find((f) => f.id === "AcceptInvitationSchema")!;
    expect(invitation.fields).toEqual(expectedInvitation);
  });
});
