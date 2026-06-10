import { type PrismaClient } from "@prisma/client";

import type {
  VoteDirection,
  VoteRecord,
  VoteRepository,
  VoteTargetType,
} from "./voteRepository.js";

/** VoteRepository の Prisma / PostgreSQL 実装（ADR-0019 / ADR-0025）。 */
export function createPrismaVoteRepository(prisma: PrismaClient): VoteRepository {
  return {
    async findVote(
      userId: string,
      targetType: VoteTargetType,
      targetId: string,
    ): Promise<VoteRecord | null> {
      const row = await prisma.vote.findUnique({
        where: { userId_targetType_targetId: { userId, targetType, targetId } },
      });
      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        targetType: row.targetType as VoteTargetType,
        targetId: row.targetId,
        direction: row.direction as VoteDirection,
        createdAt: row.createdAt,
      };
    },

    async vote(
      userId: string,
      targetType: VoteTargetType,
      targetId: string,
      direction: VoteDirection,
    ): Promise<{ scoreDelta: number }> {
      const existing = await prisma.vote.findUnique({
        where: { userId_targetType_targetId: { userId, targetType, targetId } },
      });

      if (!existing) {
        await prisma.vote.create({ data: { userId, targetType, targetId, direction } });
        return { scoreDelta: direction === "up" ? 1 : -1 };
      }

      if (existing.direction === direction) {
        await prisma.vote.delete({
          where: { userId_targetType_targetId: { userId, targetType, targetId } },
        });
        return { scoreDelta: direction === "up" ? -1 : 1 };
      }

      await prisma.vote.update({
        where: { userId_targetType_targetId: { userId, targetType, targetId } },
        data: { direction },
      });
      return { scoreDelta: direction === "up" ? 2 : -2 };
    },
  };
}
