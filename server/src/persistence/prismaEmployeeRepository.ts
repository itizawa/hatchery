import type { UpdateEmployeeInput } from "@hatchery/common";
import { Prisma, type PrismaClient } from "@prisma/client";

import type { EmployeeRecord, EmployeeRepository } from "./employeeRepository.js";

export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<EmployeeRecord | null> {
    const row = await this.prisma.employee.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      displayName: row.displayName,
      role: row.role,
      isBot: row.isBot,
      personality: row.personality,
    };
  }

  async update(id: string, input: UpdateEmployeeInput): Promise<EmployeeRecord | null> {
    try {
      const row = await this.prisma.employee.update({
        where: { id },
        data: {
          ...(input.displayName !== undefined && { displayName: input.displayName }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.personality !== undefined && { personality: input.personality }),
        },
      });
      return {
        id: row.id,
        displayName: row.displayName,
        role: row.role,
        isBot: row.isBot,
        personality: row.personality,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return null;
      }
      throw err;
    }
  }

  async listByIds(ids: string[]): Promise<EmployeeRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.employee.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    // 入力 id の順序を保って返す（存在しない id は除外）。
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => row != null)
      .map((row) => ({
        id: row.id,
        displayName: row.displayName,
        role: row.role,
        isBot: row.isBot,
        personality: row.personality,
      }));
  }

  async listBotEmployees(): Promise<EmployeeRecord[]> {
    const rows = await this.prisma.employee.findMany({ where: { isBot: true } });
    return rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      role: row.role,
      isBot: row.isBot,
      personality: row.personality,
    }));
  }
}
