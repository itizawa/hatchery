import { describe, expect, it } from "vitest";

import { createTestDeps } from "./createTestDeps.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { InMemoryChannelRepository } from "../persistence/channelRepository.js";

describe("createTestDeps", () => {
  it("デフォルトで全リポジトリが InMemory 実装で返る", async () => {
    const deps = await createTestDeps();
    expect(deps.messageRepository).toBeDefined();
    expect(deps.userRepository).toBeDefined();
    expect(deps.channelMembershipRepository).toBeDefined();
    expect(deps.channelRepository).toBeDefined();
    expect(deps.employeeRepository).toBeDefined();
    expect(deps.appSettingRepository).toBeDefined();
    expect(deps.batchRunLogRepository).toBeDefined();
    expect(deps.invitationLinkRepository).toBeDefined();
  });

  it("overrides で特定のリポジトリを上書きできる", async () => {
    const customMessageRepo = new InMemoryMessageRepository();
    const deps = await createTestDeps({ messageRepository: customMessageRepo });
    expect(deps.messageRepository).toBe(customMessageRepo);
  });

  it("overrides で channelRepository を上書きできる", async () => {
    const customChannelRepo = new InMemoryChannelRepository();
    const deps = await createTestDeps({ channelRepository: customChannelRepo });
    expect(deps.channelRepository).toBe(customChannelRepo);
  });

  it("デフォルト userRepository には testuser が存在する（createWithTestUser）", async () => {
    const deps = await createTestDeps();
    const user = await deps.userRepository.findByLoginId("testuser");
    expect(user).not.toBeNull();
  });
});
