import type { PrismaClient } from "@prisma/client";

import type {
  CommunityRecord,
  CommunityRepository,
  CreateCommunityRecordInput,
  UpdateCommunityRecordInput,
} from "./communityRepository.js";

function toRecord(row: {
  id: string;
  slug: string;
  name: string;
  description: string;
  synopsis: string | null;
  lastSlotKey: string | null;
  iconUrl: string | null;
  coverUrl: string | null;
  createdAt: Date;
}): CommunityRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    synopsis: row.synopsis,
    lastSlotKey: row.lastSlotKey,
    iconUrl: row.iconUrl,
    coverUrl: row.coverUrl,
    createdAt: row.createdAt,
  };
}

/** CommunityRepository の Prisma / PostgreSQL 実装（ADR-0019 / #305）。 */
export function createPrismaCommunityRepository(prisma: PrismaClient): CommunityRepository {
  return {
    async findById(id: string): Promise<CommunityRecord | null> {
      const row = await prisma.community.findUnique({ where: { id } });
      return row ? toRecord(row) : null;
    },

    async findBySlug(slug: string): Promise<CommunityRecord | null> {
      const row = await prisma.community.findUnique({ where: { slug } });
      return row ? toRecord(row) : null;
    },

    async list(): Promise<CommunityRecord[]> {
      const rows = await prisma.community.findMany({
        orderBy: { createdAt: "asc" },
      });
      return rows.map(toRecord);
    },

    async create(input: CreateCommunityRecordInput): Promise<CommunityRecord> {
      const row = await prisma.community.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
        },
      });
      return toRecord(row);
    },

    async update(id: string, input: UpdateCommunityRecordInput): Promise<CommunityRecord | null> {
      try {
        const row = await prisma.community.update({
          where: { id },
          data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.iconUrl !== undefined && { iconUrl: input.iconUrl }),
            ...(input.coverUrl !== undefined && { coverUrl: input.coverUrl }),
          },
        });
        return toRecord(row);
      } catch {
        return null;
      }
    },
  };
}
