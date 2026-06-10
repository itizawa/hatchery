import { UserRoleSchema } from "@hatchery/common";
import { Prisma, type PrismaClient } from "@prisma/client";

import { LoginIdAlreadyExistsError, type User, type UserRepository } from "./userRepository.js";

function mapRow(row: {
  id: string;
  loginId: string;
  displayName: string;
  passwordHash: string;
  role: string;
  avatarUrl: string | null;
}): User {
  return {
    id: row.id,
    loginId: row.loginId,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    role: UserRoleSchema.parse(row.role ?? "member"),
    avatarUrl: row.avatarUrl ?? null,
  };
}

export function createPrismaUserRepository(prisma: PrismaClient): UserRepository {
  return {
    async findById(id: string): Promise<User | null> {
      const row = await prisma.user.findUnique({
        where: { id },
      });
      if (!row) return null;
      return mapRow(row);
    },

    async findByLoginId(loginId: string): Promise<User | null> {
      const row = await prisma.user.findUnique({
        where: { loginId },
      });
      if (!row) return null;
      return mapRow(row);
    },

    async updateProfile(
      id: string,
      data: { displayName: string; avatarUrl?: string },
    ): Promise<User> {
      try {
        const row = await prisma.user.update({
          where: { id },
          data: {
            displayName: data.displayName,
            ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
          },
        });
        return mapRow(row);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          throw new Error(`User not found: ${id}`);
        }
        throw err;
      }
    },

    async create(input: {
      loginId: string;
      displayName: string;
      passwordHash: string;
    }): Promise<User> {
      try {
        const row = await prisma.user.create({
          data: {
            loginId: input.loginId,
            displayName: input.displayName,
            passwordHash: input.passwordHash,
            role: "member",
          },
        });
        return mapRow(row);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new LoginIdAlreadyExistsError(input.loginId);
        }
        throw err;
      }
    },
  };
}
