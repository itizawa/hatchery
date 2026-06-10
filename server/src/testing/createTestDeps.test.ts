import { describe, expect, it } from "vitest";
import { InMemoryWorkerRepository } from "../persistence/workerRepository.js";

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

  it("overrides で特定のリポジトリを上書きできる", async () => {
    const customWorkerRepo = new InMemoryWorkerRepository();
    const deps = await createTestDeps({ workerRepository: customWorkerRepo });
    expect(deps.workerRepository).toBe(customWorkerRepo);
  });

  it("デフォルト userRepository には testuser が存在する（createWithTestUser）", async () => {
    const deps = await createTestDeps();
    const user = await deps.userRepository.findByLoginId("testuser");
    expect(user).not.toBeNull();
  });
});
