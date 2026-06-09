import type { PrismaClient } from "@prisma/client";

import type { CommunityRecord, CommunityRepository } from "./communityRepository.js";

function toRecord(row: {
  id: string;
  slug: string;
  name: string;
  description: string;
  synopsis: string | null;
  lastSlotKey: string | null;
  createdAt: Date;
}): CommunityRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    synopsis: row.synopsis,
    lastSlotKey: row.lastSlotKey,
    createdAt: row.createdAt,
  };
}

/** CommunityRepository の Prisma / PostgreSQL 実装（#306）。 */
export class PrismaCommunityRepository implements CommunityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<CommunityRecord | null> {
    const row = await this.prisma.community.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findBySlug(slug: string): Promise<CommunityRecord | null> {
    const row = await this.prisma.community.findUnique({ where: { slug } });
    return row ? toRecord(row) : null;
  }

  async list(): Promise<CommunityRecord[]> {
    const rows = await this.prisma.community.findMany({
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  }
}
