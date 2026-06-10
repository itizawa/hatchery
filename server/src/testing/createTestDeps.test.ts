import { describe, expect, it } from "vitest";
import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";

import { createTestDeps } from "./createTestDeps.js";

describe("createTestDeps", () => {
  it("デフォルトで全リポジトリが InMemory 実装で返る", async () => {
    const deps = await createTestDeps();
    expect(deps.userRepository).toBeDefined();
    expect(deps.workerRepository).toBeDefined();
    expect(deps.appSettingRepository).toBeDefined();
    expect(deps.batchRunLogRepository).toBeDefined();
    expect(deps.invitationLinkRepository).toBeDefined();
  });

  it("community / post / comment / subscription / vote / worldState も InMemory 実装で返る（#290）", async () => {
    const deps = await createTestDeps();
    expect(deps.communityRepository).toBeDefined();
    expect(deps.postRepository).toBeDefined();
    expect(deps.commentRepository).toBeDefined();
    expect(deps.subscriptionRepository).toBeDefined();
    expect(deps.voteRepository).toBeDefined();
    expect(deps.worldStateRepository).toBeDefined();
  });

  it("overrides で特定のリポジトリを上書きできる", async () => {
    const customWorkerRepo = createInMemoryWorkerRepository();
    const deps = await createTestDeps({ workerRepository: customWorkerRepo });
    expect(deps.workerRepository).toBe(customWorkerRepo);
  });

  it("デフォルト userRepository には testuser が存在する（createTestUserRepository）", async () => {
    const deps = await createTestDeps();
    const user = await deps.userRepository.findByLoginId("testuser");
    expect(user).not.toBeNull();
  });
});
