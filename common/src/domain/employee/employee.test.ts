import { describe, expect, it } from "vitest";

import { createDisplayNameResolver, DEFAULT_EMPLOYEES, EmployeeSchema } from "./employee.js";

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
