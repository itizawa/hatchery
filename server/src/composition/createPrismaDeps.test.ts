import { describe, expect, it, vi } from "vitest";

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(),
}));

vi.mock("../persistence/prismaAppSettingRepository.js", () => ({
  createPrismaAppSettingRepository: vi.fn(() => ({})),
}));
vi.mock("../persistence/prismaBatchRunLogRepository.js", () => ({
  createPrismaBatchRunLogRepository: vi.fn(() => ({})),
}));
vi.mock("../persistence/prismaWorkerRepository.js", () => ({
  createPrismaWorkerRepository: vi.fn(() => ({})),
}));
vi.mock("../persistence/prismaTokenUsageLogRepository.js", () => ({
  createPrismaTokenUsageLogRepository: vi.fn(() => ({})),
}));
vi.mock("../persistence/prismaUserRepository.js", () => ({
  createPrismaUserRepository: vi.fn(() => ({})),
}));
vi.mock("../persistence/prismaCommunityRepository.js", () => ({
  createPrismaCommunityRepository: vi.fn(() => ({})),
}));
vi.mock("../persistence/prismaPostRepository.js", () => ({
  createPrismaPostRepository: vi.fn(() => ({})),
}));
vi.mock("../persistence/prismaCommentRepository.js", () => ({
  createPrismaCommentRepository: vi.fn(() => ({})),
}));
vi.mock("../persistence/prismaSubscriptionRepository.js", () => ({
  createPrismaSubscriptionRepository: vi.fn(() => ({})),
}));
vi.mock("../persistence/prismaVoteRepository.js", () => ({
  createPrismaVoteRepository: vi.fn(() => ({})),
}));
vi.mock("../persistence/prismaWorldStateRepository.js", () => ({
  createPrismaWorldStateRepository: vi.fn(() => ({})),
}));

import { GcsStorageService, InMemoryStorageService } from "../services/storageService.js";
import { createPrismaDeps } from "./createPrismaDeps.js";

const fakePrisma = {} as Parameters<typeof createPrismaDeps>[0];

describe("createPrismaDeps", () => {
  it("gcsBucketName を渡すと GcsStorageService が使われる", () => {
    const deps = createPrismaDeps(fakePrisma, "my-bucket");
    expect(deps.storageService).toBeInstanceOf(GcsStorageService);
  });

  it("gcsBucketName が undefined のとき InMemoryStorageService が使われる", () => {
    const deps = createPrismaDeps(fakePrisma, undefined);
    expect(deps.storageService).toBeInstanceOf(InMemoryStorageService);
  });

  it("gcsBucketName を省略したとき InMemoryStorageService が使われる", () => {
    const deps = createPrismaDeps(fakePrisma);
    expect(deps.storageService).toBeInstanceOf(InMemoryStorageService);
  });
});
