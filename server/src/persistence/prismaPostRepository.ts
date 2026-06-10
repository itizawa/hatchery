import type { PrismaClient } from "@prisma/client";

import type { PostCreateInput, PostRecord, PostRepository } from "./postRepository.js";

function toRecord(row: {
  id: string;
  communityId: string;
  slotKey: string;
  seq: number;
  author: string;
  title: string;
  text: string;
  score: number;
  createdAt: Date;
}): PostRecord {
  return {
    id: row.id,
    communityId: row.communityId,
    slotKey: row.slotKey,
    seq: row.seq,
    author: row.author,
    title: row.title,
    text: row.text,
    score: row.score,
    createdAt: row.createdAt,
  };
}

/** PostRepository の Prisma / PostgreSQL 実装（ADR-0019 / #305）。 */
export function createPrismaPostRepository(prisma: PrismaClient): PostRepository {
  return {
    async createMany(communityId: string, inputs: PostCreateInput[]): Promise<PostRecord[]> {
      const rows = await prisma.$transaction(
        inputs.map((input) =>
          prisma.post.upsert({
            where: {
              communityId_slotKey_seq: {
                communityId,
                slotKey: input.slotKey,
                seq: input.seq,
              },
            },
            update: {},
            create: {
              communityId,
              slotKey: input.slotKey,
              seq: input.seq,
              author: input.author,
              title: input.title,
              text: input.text,
            },
          }),
        ),
      );
      return rows.map(toRecord);
    },

    async listByCommunity(communityId: string, limit = 50): Promise<PostRecord[]> {
      const rows = await prisma.post.findMany({
        where: { communityId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.map(toRecord);
    },

    async findById(id: string): Promise<PostRecord | null> {
      const row = await prisma.post.findUnique({ where: { id } });
      return row ? toRecord(row) : null;
    },

    async addScore(id: string, delta: number): Promise<PostRecord | null> {
      try {
        const row = await prisma.post.update({
          where: { id },
          data: { score: { increment: delta } },
        });
        return toRecord(row);
      } catch {
        return null;
      }
    },

    async listLatest(limit = 50): Promise<PostRecord[]> {
      const rows = await prisma.post.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
      return rows.map(toRecord);
    },
  };
}
