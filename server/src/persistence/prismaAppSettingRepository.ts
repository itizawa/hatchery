import type { AppSetting } from "@hatchery/common";
import type { PrismaClient } from "@prisma/client";

import type { AppSettingRepository } from "./appSettingRepository.js";

/** AppSettingRepository の Prisma / PostgreSQL 実装（#152）。 */
export class PrismaAppSettingRepository implements AppSettingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<AppSetting[]> {
    const rows = await this.prisma.appSetting.findMany();
    return rows.map((r) => ({ key: r.key, value: r.value, updatedAt: r.updatedAt }));
  }

  async findByKey(key: string): Promise<AppSetting | null> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    if (!row) return null;
    return { key: row.key, value: row.value, updatedAt: row.updatedAt };
  }

  async upsert(key: string, value: string): Promise<AppSetting> {
    const row = await this.prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return { key: row.key, value: row.value, updatedAt: row.updatedAt };
  }
}
