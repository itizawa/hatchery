import type { PrismaClient } from "@prisma/client";

import type { User, UserRepository } from "./userRepository.js";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    // #49: User ↔ Employee を JOIN し、紐づく Employee の id を employeeId として詰める。
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: { employee: { select: { id: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      displayName: row.displayName,
      passwordHash: row.passwordHash,
      employeeId: row.employee?.id ?? null,
    };
  }
}
