import { describe, expect, it } from "vitest";

import { InMemoryMessageRepository } from "../persistence/messageRepository.js";

import { createMessages } from "./createMessages.js";
import { listMessages } from "./listMessages.js";

describe("usecases — DB 非依存（InMemory リポジトリ注入）", () => {
  it("createMessages で保存し、listMessages で取得できる", async () => {
    const repo = new InMemoryMessageRepository();
    const created = await createMessages(repo, [
      { createdEmployeeId: "e1", channel: "zatsudan", text: "hi" },
    ]);
    expect(created).toHaveLength(1);
    expect(created[0]?.id).toBeTruthy();

    const all = await listMessages(repo);
    expect(all).toHaveLength(1);
    expect(all[0]?.createdEmployeeId).toBe("e1");
  });

  it("createMessages は複数メッセージを一括保存できる", async () => {
    const repo = new InMemoryMessageRepository();
    const created = await createMessages(repo, [
      { createdEmployeeId: "e1", channel: "zatsudan", text: "hi" },
      { createdEmployeeId: "e2", channel: "shigoto", text: "bye" },
    ]);
    expect(created).toHaveLength(2);
    expect(await listMessages(repo)).toHaveLength(2);
  });
});
