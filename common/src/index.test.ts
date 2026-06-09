import { describe, expect, it } from "vitest";

import {
  ChannelSchema,
  EmployeeSchema,
  MessageArraySchema,
  MessageSchema,
  TaskSchema,
} from "./index.js";
import type { Channel, Employee, Message, Task } from "./index.js";

describe("@hatchery/common 公開 API", () => {
  it("全ドメインスキーマが index から再エクスポートされている", () => {
    expect(typeof EmployeeSchema.parse).toBe("function");
    expect(typeof ChannelSchema.parse).toBe("function");
    expect(typeof MessageSchema.parse).toBe("function");
    expect(typeof MessageArraySchema.parse).toBe("function");
    expect(typeof TaskSchema.parse).toBe("function");
  });

  it("MessageArraySchema は 1 件以上の配列を受け付ける", () => {
    const ok = MessageArraySchema.parse([{ createdEmployeeId: "e1", channel: "zatsudan", text: "hi" }]);
    expect(ok).toHaveLength(1);
  });

  it("MessageArraySchema は空配列を拒否する", () => {
    expect(MessageArraySchema.safeParse([]).success).toBe(false);
  });

  it("z.infer 由来の型に最小オブジェクトを代入できる（型レベルは tsc が担保）", () => {
    const employee: Employee = { id: "haru", displayName: "haru" };
    const channel: Channel = { id: "zatsudan", label: "雑談" };
    const message: Message = { createdEmployeeId: "haru", channel: "zatsudan", text: "やあ" };
    const task: Task = { id: "t1", text: "ロゴ案", status: "new" };
    expect([employee, channel, message, task]).toHaveLength(4);
  });
});
