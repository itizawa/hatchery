import { describe, expect, it } from "vitest";

import { MAX_MESSAGE_LENGTH } from "../domain/message/index.js";
import { DEFAULT_EMPLOYEES } from "../domain/employee/index.js";

import { EMPLOYEE_MESSAGE_TEMPLATES, getEmployeeMessageTemplates } from "./employeeMessages.js";

describe("EMPLOYEE_MESSAGE_TEMPLATES — 静的発言テンプレート（#32 MVP）", () => {
  it("DEFAULT_EMPLOYEES 全員分のテンプレートが存在する", () => {
    for (const employee of DEFAULT_EMPLOYEES) {
      const templates = EMPLOYEE_MESSAGE_TEMPLATES[employee.id];
      expect(templates, `テンプレート未定義: ${employee.id}`).toBeDefined();
      expect(templates.length).toBeGreaterThan(0);
    }
  });

  it("各文言は非空かつ MAX_MESSAGE_LENGTH 以内（MessageSchema と整合）", () => {
    for (const templates of Object.values(EMPLOYEE_MESSAGE_TEMPLATES)) {
      for (const text of templates) {
        expect(text.length).toBeGreaterThan(0);
        expect(text.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
      }
    }
  });

  it("getEmployeeMessageTemplates は既知 id でテンプレートを、未知 id で空配列を返す", () => {
    expect(getEmployeeMessageTemplates("haru").length).toBeGreaterThan(0);
    expect(getEmployeeMessageTemplates("unknown-id")).toEqual([]);
  });
});
