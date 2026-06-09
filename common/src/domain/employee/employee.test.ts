import { describe, expect, it } from "vitest";

import {
  EMPLOYEE_DISPLAY_NAME_MAX_LENGTH,
  EMPLOYEE_IMAGE_URL_MAX_LENGTH,
  EMPLOYEE_ROLE_MAX_LENGTH,
  createDisplayNameResolver,
  createAvatarUrlResolver,
  DEFAULT_EMPLOYEES,
  EmployeeSchema,
  UpdateEmployeeSchema,
} from "./employee.js";

describe("EmployeeSchema (A-1 / A-2)", () => {
  it("id / displayName を持つ社員は parse 成功する（role は任意）", () => {
    expect(EmployeeSchema.parse({ id: "haru", displayName: "haru" }).id).toBe("haru");
    const withRole = EmployeeSchema.parse({
      id: "mei",
      displayName: "mei",
      role: "新人",
    });
    expect(withRole.role).toBe("新人");
  });

  it("id / displayName が空文字なら parse に失敗する", () => {
    expect(EmployeeSchema.safeParse({ id: "", displayName: "haru" }).success).toBe(false);
    expect(EmployeeSchema.safeParse({ id: "haru", displayName: "" }).success).toBe(false);
  });

  // #49: AI 社員とユーザー所有社員を区別する isBot フラグ。
  it("isBot を省略すると既定で false になる（AC-4）", () => {
    const parsed = EmployeeSchema.parse({ id: "haru", displayName: "haru" });
    expect(parsed.isBot).toBe(false);
  });

  it("isBot: true を指定するとそのまま反映される（AC-5）", () => {
    const parsed = EmployeeSchema.parse({ id: "haru", displayName: "haru", isBot: true });
    expect(parsed.isBot).toBe(true);
  });
});

describe("DEFAULT_EMPLOYEES (#25)", () => {
  it("全要素が EmployeeSchema を満たす", () => {
    for (const employee of DEFAULT_EMPLOYEES) {
      expect(EmployeeSchema.safeParse(employee).success).toBe(true);
    }
  });

  it("MVP の 3 人（haru / ken / mei）を含む", () => {
    expect(DEFAULT_EMPLOYEES.map((e) => e.id)).toEqual(["haru", "ken", "mei"]);
  });

  it("id が一意である", () => {
    const ids = DEFAULT_EMPLOYEES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // #49: 既定 AI 社員は全員 bot（ユーザー所有社員と区別する）。
  it("全員が isBot=true（AC-7）", () => {
    expect(DEFAULT_EMPLOYEES.every((e) => e.isBot === true)).toBe(true);
  });
});

describe("EmployeeSchema: personality フィールド (#38)", () => {
  it("personality が 500 文字以内なら parse 成功する", () => {
    const result = EmployeeSchema.safeParse({
      id: "haru",
      displayName: "haru",
      personality: "a".repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it("personality が 501 文字なら parse に失敗する", () => {
    const result = EmployeeSchema.safeParse({
      id: "haru",
      displayName: "haru",
      personality: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("personality を省略しても parse 成功する（任意フィールド）", () => {
    const result = EmployeeSchema.safeParse({ id: "haru", displayName: "haru" });
    expect(result.success).toBe(true);
  });

  it("displayName が EMPLOYEE_DISPLAY_NAME_MAX_LENGTH 文字ちょうどなら parse 成功する（#91）", () => {
    const result = EmployeeSchema.safeParse({ id: "haru", displayName: "a".repeat(EMPLOYEE_DISPLAY_NAME_MAX_LENGTH) });
    expect(result.success).toBe(true);
  });

  it("displayName が EMPLOYEE_DISPLAY_NAME_MAX_LENGTH + 1 文字なら parse 失敗する（#91）", () => {
    const result = EmployeeSchema.safeParse({ id: "haru", displayName: "a".repeat(EMPLOYEE_DISPLAY_NAME_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  it("role が EMPLOYEE_ROLE_MAX_LENGTH 文字ちょうどなら parse 成功する（#91）", () => {
    const result = EmployeeSchema.safeParse({ id: "haru", displayName: "haru", role: "a".repeat(EMPLOYEE_ROLE_MAX_LENGTH) });
    expect(result.success).toBe(true);
  });

  it("role が EMPLOYEE_ROLE_MAX_LENGTH + 1 文字なら parse 失敗する（#91）", () => {
    const result = EmployeeSchema.safeParse({ id: "haru", displayName: "haru", role: "a".repeat(EMPLOYEE_ROLE_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });
});

describe("EmployeeSchema: imageUrl フィールド (#220)", () => {
  it("imageUrl が有効な URL なら parse 成功する", () => {
    const result = EmployeeSchema.safeParse({
      id: "haru",
      displayName: "haru",
      imageUrl: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
  });

  it("imageUrl を省略しても parse 成功する（任意フィールド）", () => {
    const result = EmployeeSchema.safeParse({ id: "haru", displayName: "haru" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imageUrl).toBeUndefined();
    }
  });

  it("imageUrl が不正な URL 形式なら parse 失敗する", () => {
    const result = EmployeeSchema.safeParse({
      id: "haru",
      displayName: "haru",
      imageUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it(`imageUrl が EMPLOYEE_IMAGE_URL_MAX_LENGTH 文字ちょうどなら parse 成功する（#91）`, () => {
    // EMPLOYEE_IMAGE_URL_MAX_LENGTH 文字の有効な URL を生成
    const base = "https://example.com/";
    const padding = "a".repeat(EMPLOYEE_IMAGE_URL_MAX_LENGTH - base.length);
    const url = base + padding;
    expect(url.length).toBe(EMPLOYEE_IMAGE_URL_MAX_LENGTH);
    const result = EmployeeSchema.safeParse({ id: "haru", displayName: "haru", imageUrl: url });
    expect(result.success).toBe(true);
  });

  it(`imageUrl が EMPLOYEE_IMAGE_URL_MAX_LENGTH + 1 文字なら parse 失敗する（#91）`, () => {
    const base = "https://example.com/";
    const padding = "a".repeat(EMPLOYEE_IMAGE_URL_MAX_LENGTH - base.length + 1);
    const url = base + padding;
    expect(url.length).toBe(EMPLOYEE_IMAGE_URL_MAX_LENGTH + 1);
    const result = EmployeeSchema.safeParse({ id: "haru", displayName: "haru", imageUrl: url });
    expect(result.success).toBe(false);
  });
});

describe("UpdateEmployeeSchema (#38)", () => {
  it("displayName / role / personality を部分更新できる", () => {
    const result = UpdateEmployeeSchema.safeParse({
      displayName: "new name",
      role: "マネージャー",
      personality: "明るく積極的",
    });
    expect(result.success).toBe(true);
  });

  it("displayName が空文字なら invalid", () => {
    const result = UpdateEmployeeSchema.safeParse({ displayName: "" });
    expect(result.success).toBe(false);
  });

  it("personality が 501 文字なら invalid", () => {
    const result = UpdateEmployeeSchema.safeParse({ personality: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("すべてのフィールドを省略できる（空更新は valid）", () => {
    const result = UpdateEmployeeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("displayName が EMPLOYEE_DISPLAY_NAME_MAX_LENGTH 文字ちょうどなら valid（#91）", () => {
    const result = UpdateEmployeeSchema.safeParse({ displayName: "a".repeat(EMPLOYEE_DISPLAY_NAME_MAX_LENGTH) });
    expect(result.success).toBe(true);
  });

  it("displayName が EMPLOYEE_DISPLAY_NAME_MAX_LENGTH + 1 文字なら invalid（#91）", () => {
    const result = UpdateEmployeeSchema.safeParse({ displayName: "a".repeat(EMPLOYEE_DISPLAY_NAME_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  it("role が EMPLOYEE_ROLE_MAX_LENGTH 文字ちょうどなら valid（#91）", () => {
    const result = UpdateEmployeeSchema.safeParse({ role: "a".repeat(EMPLOYEE_ROLE_MAX_LENGTH) });
    expect(result.success).toBe(true);
  });

  it("role が EMPLOYEE_ROLE_MAX_LENGTH + 1 文字なら invalid（#91）", () => {
    const result = UpdateEmployeeSchema.safeParse({ role: "a".repeat(EMPLOYEE_ROLE_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });
});

describe("createDisplayNameResolver", () => {
  const employees = [
    { id: "haru", displayName: "ハル" },
    { id: "ken", displayName: "ケン" },
  ];

  it("既知の employee ID を displayName に解決する", () => {
    const resolve = createDisplayNameResolver(employees);
    expect(resolve("haru")).toBe("ハル");
    expect(resolve("ken")).toBe("ケン");
  });

  it("未知の ID はその ID をそのままフォールバック表示する", () => {
    const resolve = createDisplayNameResolver(employees);
    expect(resolve("unknown-id")).toBe("unknown-id");
  });

  it("引数省略時は DEFAULT_EMPLOYEES で解決する", () => {
    const resolve = createDisplayNameResolver();
    const haru = DEFAULT_EMPLOYEES.find((e) => e.id === "haru")!;
    expect(resolve("haru")).toBe(haru.displayName);
  });
});

describe("createAvatarUrlResolver (#300)", () => {
  const employees = [
    { id: "haru", displayName: "ハル", imageUrl: "https://example.com/haru.png", isBot: true as const },
    { id: "ken", displayName: "ケン", isBot: true as const },
  ];

  it("imageUrl が設定されている employee ID は URL を返す", () => {
    const resolve = createAvatarUrlResolver(employees);
    expect(resolve("haru")).toBe("https://example.com/haru.png");
  });

  it("imageUrl が未設定の employee ID は undefined を返す", () => {
    const resolve = createAvatarUrlResolver(employees);
    expect(resolve("ken")).toBeUndefined();
  });

  it("未解決の employee ID は undefined を返す", () => {
    const resolve = createAvatarUrlResolver(employees);
    expect(resolve("unknown-id")).toBeUndefined();
  });

  it("引数省略時は DEFAULT_EMPLOYEES で解決する（全員 imageUrl 未設定 → undefined）", () => {
    const resolve = createAvatarUrlResolver();
    expect(resolve("haru")).toBeUndefined();
  });
});
