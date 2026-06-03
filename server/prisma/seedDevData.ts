import { DEFAULT_CHANNELS, DEFAULT_EMPLOYEES } from "@hatchery/common";
import bcrypt from "bcrypt";

/**
 * seed が必要とする Prisma クライアントの構造的インターフェース。
 * 生成済み Prisma Client（`@prisma/client`）の該当メソッドはこの型に構造的に適合する。
 * ここで具象クライアントを値 import しないことで、生成物・実 DB が無くてもユニットテスト可能にする（設計書 §4）。
 */
export interface SeedPrisma {
  user: {
    upsert(args: {
      where: { id: string };
      update: Record<string, never>;
      create: { id: string; displayName: string; passwordHash: string };
    }): Promise<unknown>;
  };
  employee: {
    upsert(args: {
      where: { id: string };
      update: Record<string, never>;
      create: {
        id: string;
        displayName: string;
        role: string | null;
        isBot: boolean;
        userId?: string | null;
      };
    }): Promise<unknown>;
  };
  channel: {
    upsert(args: {
      where: { id: string };
      update: { type: "zatsudan" | "task" };
      create: { id: string; label: string; type: "zatsudan" | "task" };
    }): Promise<unknown>;
  };
  channelEmployee: {
    upsert(args: {
      where: { channelId_employeeId: { channelId: string; employeeId: string } };
      update: Record<string, never>;
      create: { channelId: string; employeeId: string };
    }): Promise<unknown>;
  };
}

export interface SeedResult {
  /** 本番環境などで投入をスキップした場合は true。 */
  skipped: boolean;
}

/** 開発用テストユーザーの資格情報（既存コードベースの標準: testuser / testpass）。 */
const DEV_USER = { id: "testuser", displayName: "Test User", password: "testpass" } as const;

/** ログインユーザーに紐づく Employee の id（#49）。 */
const DEV_USER_EMPLOYEE_ID = "emp-testuser";

/**
 * 開発環境向けのテストデータを冪等に投入する（設計書 §4 / #49）。
 * - common の DEFAULT_EMPLOYEES / DEFAULT_CHANNELS を単一情報源として upsert する（ADR-0005）。
 * - AI 社員は isBot=true / userId=null、ログインユーザー所有の Employee は isBot=false / userId 紐付けで投入する（#49）。
 * - 全 Employee を全 Channel に所属させ、観察ループの最小データを用意する。
 * - 本番環境（NODE_ENV=production）では何も投入せずスキップする。
 * すべて upsert のため再実行しても安全。
 */
export async function seedDevData(prisma: SeedPrisma): Promise<SeedResult> {
  if (process.env.NODE_ENV === "production") {
    return { skipped: true };
  }

  const passwordHash = await bcrypt.hash(DEV_USER.password, 10);
  await prisma.user.upsert({
    where: { id: DEV_USER.id },
    update: {},
    create: { id: DEV_USER.id, displayName: DEV_USER.displayName, passwordHash },
  });

  // AI 社員（既定 3 名）は isBot=true / userId は紐付けない（#49）。
  for (const employee of DEFAULT_EMPLOYEES) {
    await prisma.employee.upsert({
      where: { id: employee.id },
      update: {},
      create: {
        id: employee.id,
        displayName: employee.displayName,
        role: employee.role ?? null,
        isBot: true,
      },
    });
  }

  // ログインユーザーに対応する Employee は isBot=false / userId で User と 1:1 紐付け（#49）。
  await prisma.employee.upsert({
    where: { id: DEV_USER_EMPLOYEE_ID },
    update: {},
    create: {
      id: DEV_USER_EMPLOYEE_ID,
      displayName: DEV_USER.displayName,
      role: null,
      isBot: false,
      userId: DEV_USER.id,
    },
  });

  for (const channel of DEFAULT_CHANNELS) {
    await prisma.channel.upsert({
      where: { id: channel.id },
      update: { type: channel.type },
      create: { id: channel.id, label: channel.label, type: channel.type },
    });
  }

  for (const employee of DEFAULT_EMPLOYEES) {
    for (const channel of DEFAULT_CHANNELS) {
      await prisma.channelEmployee.upsert({
        where: {
          channelId_employeeId: { channelId: channel.id, employeeId: employee.id },
        },
        update: {},
        create: { channelId: channel.id, employeeId: employee.id },
      });
    }
  }

  return { skipped: false };
}
