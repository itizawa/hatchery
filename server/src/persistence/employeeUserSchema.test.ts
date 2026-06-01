import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// #49: Employee ↔ User の 1:1 リレーションと isBot フラグの定義を schema / migration レベルで検証する。
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

describe("Prisma schema: Employee に isBot / userId（#49）", () => {
  it("Employee に isBot Boolean @default(false) がある（AC-1）", () => {
    expect(schema).toMatch(/isBot\s+Boolean\s+@default\(false\)/);
  });

  it("Employee に userId String? @unique がある（AC-2）", () => {
    expect(schema).toMatch(/userId\s+String\?\s+@unique/);
  });

  it("Employee が User への任意リレーションを持つ（AC-2）", () => {
    expect(schema).toMatch(/user\s+User\?\s+@relation\(fields:\s*\[userId\],\s*references:\s*\[id\]\)/);
  });

  it("User が Employee への逆リレーションを持つ（AC-2）", () => {
    // schema 全体だと Task.employee も一致してしまうため、User モデル定義ブロックに限定して検証する。
    const userModel = schema.match(/model User \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(userModel).toMatch(/employee\s+Employee\?/);
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

  it("userId の一意インデックスを作成する（AC-3）", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX\s+"Employee_userId_key"\s+ON\s+"Employee"\("userId"\)/i);
  });

  it("userId の外部キー（User 参照）を定義する（AC-3）", () => {
    expect(sql).toMatch(/FOREIGN KEY\s+\("userId"\)\s+REFERENCES\s+"User"\("id"\)/i);
  });
});
