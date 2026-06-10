import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type { InvitationLinkRecord, InvitationLinkRepository } from "./invitationLinkRepository.js";

function toRecord(r: {
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

export function createPrismaInvitationLinkRepository(
  prisma: PrismaClient,
): InvitationLinkRepository {
  return {
    async create(input: {
      token: string;
      expiresAt: Date;
      createdByUserId: string;
      memo?: string;
    }): Promise<InvitationLinkRecord> {
      const record = await prisma.invitationLink.create({
        data: {
          token: input.token,
          expiresAt: input.expiresAt,
          createdByUserId: input.createdByUserId,
          memo: input.memo,
        },
      });
      return toRecord(record);
    },

    async list(): Promise<InvitationLinkRecord[]> {
      const records = await prisma.invitationLink.findMany({
        orderBy: { createdAt: "desc" },
      });
      return records.map((r) => toRecord(r));
    },

    async findByToken(token: string): Promise<InvitationLinkRecord | null> {
      const record = await prisma.invitationLink.findUnique({
        where: { token },
      });
      return record ? toRecord(record) : null;
    },

    async revoke(id: string): Promise<InvitationLinkRecord | null> {
      try {
        const record = await prisma.invitationLink.update({
          where: { id },
          data: { revokedAt: new Date() },
        });
        return toRecord(record);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return null;
        }
        throw err;
      }
    },

    async markUsed(id: string, usedByUserId: string): Promise<InvitationLinkRecord | null> {
      const now = new Date();
      const result = await prisma.invitationLink.updateMany({
        where: {
          id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now, usedByUserId },
      });
      if (result.count === 0) return null;
      const record = await prisma.invitationLink.findUnique({ where: { id } });
      return record ? toRecord(record) : null;
    },
  };
}
