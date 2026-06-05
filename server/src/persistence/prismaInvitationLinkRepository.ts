import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type {
  InvitationLinkRecord,
  InvitationLinkRepository,
} from "./invitationLinkRepository.js";

export class PrismaInvitationLinkRepository implements InvitationLinkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    token: string;
    expiresAt: Date;
    createdByUserId: string;
    memo?: string;
  }): Promise<InvitationLinkRecord> {
    const record = await this.prisma.invitationLink.create({
      data: {
        token: input.token,
        expiresAt: input.expiresAt,
        createdByUserId: input.createdByUserId,
        memo: input.memo,
      },
    });
    return this.toRecord(record);
  }

  async list(): Promise<InvitationLinkRecord[]> {
    const records = await this.prisma.invitationLink.findMany({
      orderBy: { createdAt: "desc" },
    });
    return records.map((r) => this.toRecord(r));
  }

  async findByToken(token: string): Promise<InvitationLinkRecord | null> {
    const record = await this.prisma.invitationLink.findUnique({
      where: { token },
    });
    return record ? this.toRecord(record) : null;
  }

  async revoke(id: string): Promise<InvitationLinkRecord | null> {
    try {
      const record = await this.prisma.invitationLink.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
      return this.toRecord(record);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return null;
      }
      throw err;
    }
  }

  private toRecord(r: {
    id: string;
    token: string;
    expiresAt: Date;
    usedAt: Date | null;
    usedByUserId: string | null;
    revokedAt: Date | null;
    createdByUserId: string;
    memo: string | null;
    createdAt: Date;
  }): InvitationLinkRecord {
    return {
      id: r.id,
      token: r.token,
      expiresAt: r.expiresAt,
      usedAt: r.usedAt,
      usedByUserId: r.usedByUserId,
      revokedAt: r.revokedAt,
      createdByUserId: r.createdByUserId,
      memo: r.memo,
      createdAt: r.createdAt,
    };
  }
}
