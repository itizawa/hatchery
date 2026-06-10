import { Prisma, type PrismaClient } from "@prisma/client";
import { ConflictError } from "@hatchery/common";

import type { VoteRepository, VoteTargetType } from "./voteRepository.js";

/** VoteRepository の Prisma / PostgreSQL 実装（ADR-0019 / #305）。 */
export function createPrismaVoteRepository(prisma: PrismaClient): VoteRepository {
  return {
    async hasVoted(userId: string, targetType: VoteTargetType, targetId: string): Promise<boolean> {
      const row = await prisma.vote.findUnique({
        where: {
          userId_targetType_targetId: {
            userId,
            targetType,
            targetId,
          },
        },
      });
      return row !== null;
    },

    async create(userId: string, targetType: VoteTargetType, targetId: string): Promise<void> {
      try {
        await prisma.vote.create({
          data: { userId, targetType, targetId },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new ConflictError("AlreadyVoted");
        }
        throw err;
      }
    },
  };
}
