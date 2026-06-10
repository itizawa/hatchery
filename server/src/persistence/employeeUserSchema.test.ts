import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// #49: Worker ↔ User の 1:1 リレーションと isBot フラグの定義を schema / migration レベルで検証する。
// #329: Employee → Worker へのリネーム後も同等の制約が維持されることを確認する。
// DB を必要としないユニットテスト（CI で実行可能）。実行時挙動の検証は int テスト（要 DATABASE_URL）が担う。

const here = dirname(fileURLToPath(import.meta.url));
const prismaDir = join(here, "..", "..", "prisma");

const schema = readFileSync(join(prismaDir, "schema.prisma"), "utf8");

/** prisma/migrations 配下の全 migration.sql を結合して返す。 */
function allMigrationSql(): string {
  const migrationsDir = join(prismaDir, "migrations");
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      try {
        return readFileSync(join(migrationsDir, d.name, "migration.sql"), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

describe("Prisma schema: Worker に isBot / userId（#49 / #329）", () => {
  it("Worker に isBot Boolean @default(false) がある（AC-1）", () => {
    expect(schema).toMatch(/isBot\s+Boolean\s+@default\(false\)/);
  });

  it("Worker に userId String? @unique がある（AC-2）", () => {
    expect(schema).toMatch(/userId\s+String\?\s+@unique/);
  });

  it("Worker が User への任意リレーションを持つ（AC-2）", () => {
    expect(schema).toMatch(/user\s+User\?\s+@relation\(fields:\s*\[userId\],\s*references:\s*\[id\]\)/);
  });

  it("User が Worker への逆リレーションを持つ（AC-2）", () => {
    const userModel = schema.match(/model User \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(userModel).toMatch(/worker\s+Worker\?/);
  });
});

describe("Prisma migration: isBot / userId 列の追加（#49）", () => {
  const sql = allMigrationSql();

  it("isBot 列を追加するマイグレーションがある（AC-3）", () => {
    expect(sql).toMatch(/ADD COLUMN\s+"isBot"\s+BOOLEAN/i);
  });

  it("userId 列を追加するマイグレーションがある（AC-3）", () => {
    expect(sql).toMatch(/ADD COLUMN\s+"userId"\s+TEXT/i);
  });

  it("workers テーブルへのリネームマイグレーションがある（#329）", () => {
    expect(sql).toMatch(/ALTER TABLE\s+"Employee"\s+RENAME TO\s+"workers"/i);
  });
});
