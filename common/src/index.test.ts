import { describe, expect, it } from "vitest";

import {
  ChannelSchema,
  EmployeeSchema,
  MessageSchema,
  SceneSchema,
  TaskSchema,
} from "./index.js";
import type { Channel, Employee, Message, Scene, Task } from "./index.js";

describe("@hatchery/common 公開 API (A-1 / A-2)", () => {
  it("全ドメインスキーマが index から再エクスポートされている", () => {
    expect(typeof EmployeeSchema.parse).toBe("function");
    expect(typeof ChannelSchema.parse).toBe("function");
    expect(typeof MessageSchema.parse).toBe("function");
    expect(typeof SceneSchema.parse).toBe("function");
    expect(typeof TaskSchema.parse).toBe("function");
  });

  it("z.infer 由来の型に最小オブジェクトを代入できる（型レベルは tsc が担保）", () => {
    const employee: Employee = { id: "haru", displayName: "haru" };
    const channel: Channel = { id: "zatsudan", label: "#雑談" };
    const message: Message = { speaker: "haru", channel: "zatsudan", text: "やあ" };
    const scene: Scene = { scene: "朝", messages: [message] };
    const task: Task = { id: "t1", text: "ロゴ案", status: "new" };
    expect([employee, channel, message, scene, task]).toHaveLength(5);
  });
});
