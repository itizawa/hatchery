import { UserRoleSchema } from "@hatchery/common";
import { Prisma, type PrismaClient } from "@prisma/client";

import { GoogleIdAlreadyExistsError, type User, type UserRepository } from "./userRepository.js";

function mapRow(row: {
  id: string;
  email: string;
  googleId: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
}): User {
  return {
    id: row.id,
    email: row.email,
    googleId: row.googleId,
    displayName: row.displayName,
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

    async findByGoogleId(googleId: string): Promise<User | null> {
      const row = await prisma.user.findUnique({
        where: { googleId },
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
      email: string;
      googleId: string;
      displayName: string;
    }): Promise<User> {
      try {
        const row = await prisma.user.create({
          data: {
            email: input.email,
            googleId: input.googleId,
            displayName: input.displayName,
            role: "member",
          },
        });
        return mapRow(row);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new GoogleIdAlreadyExistsError(input.googleId);
        }
        throw err;
      }
    },
  };
}
