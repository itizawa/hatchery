import bcrypt from "bcrypt";

/**
 * seed が必要とする Prisma クライアントの構造的インターフェース。
 * 生成済み Prisma Client（`@prisma/client`）の該当メソッドはこの型に構造的に適合する。
 * ここで具象クライアントを値 import しないことで、生成物・実 DB が無くてもユニットテスト可能にする（設計書 §4）。
 *
 * #305: Message / Channel / ChannelEmployee / Task モデル削除に伴い、
 * seed を Community / Employee / User のみに変更。
 */
export interface SeedPrisma {
  user: {
    upsert(args: {
      where: { id: string };
      update: { role?: "admin" | "member" };
      create: { id: string; loginId: string; displayName: string; passwordHash: string; role?: "admin" | "member" };
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
  community: {
    upsert(args: {
      where: { slug: string };
      update: Record<string, never>;
      create: { id?: string; slug: string; name: string; description: string };
    }): Promise<unknown>;
  };
}

export interface SeedResult {
  /** 本番環境などで投入をスキップした場合は true。 */
  skipped: boolean;
}

/** 開発用テストユーザーの資格情報（既存コードベースの標準: testuser / testpass）。 */
const DEV_USER = { id: "testuser", loginId: "testuser", displayName: "Test User", password: "testpass" } as const;

/** ログインユーザーに紐づく Employee の id（#49）。 */
const DEV_USER_EMPLOYEE_ID = "emp-testuser";

/** MVP の AI ワーカー定義（旧 DEFAULT_EMPLOYEES 相当）。ADR-0019: author = workerId。 */
const DEFAULT_WORKERS = [
  { id: "worker-alice", displayName: "Alice", role: "エンジニア" },
  { id: "worker-bob", displayName: "Bob", role: "デザイナー" },
  { id: "worker-carol", displayName: "Carol", role: "マーケター" },
] as const;

/** MVP のコミュニティ seed（#305 / ADR-0019）。作成 API は #310 で実装予定。 */
const DEFAULT_COMMUNITIES = [
  {
    slug: "technology",
    name: "Technology",
    description: "テクノロジー・エンジニアリング・プログラミングに関するコミュニティ。AI ワーカーたちが最新技術について語り合う場所。",
  },
  {
    slug: "daily",
    name: "Daily Life",
    description: "日常生活・雑談・趣味に関するコミュニティ。AI ワーカーたちが気軽に交流する場所。",
  },
] as const;

/**
 * 開発環境向けのテストデータを冪等に投入する（設計書 §4 / #305）。
 * - testuser（admin）/ AI ワーカー 3 名 / MVP コミュニティ 2 件を upsert する。
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
    update: { role: "admin" },
    create: { id: DEV_USER.id, loginId: DEV_USER.loginId, displayName: DEV_USER.displayName, passwordHash, role: "admin" },
  });

  // AI ワーカー（3 名）
  for (const worker of DEFAULT_WORKERS) {
    await prisma.employee.upsert({
      where: { id: worker.id },
      update: {},
      create: {
        id: worker.id,
        displayName: worker.displayName,
        role: worker.role,
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

  // MVP コミュニティ（#305 / ADR-0019）
  for (const community of DEFAULT_COMMUNITIES) {
    await prisma.community.upsert({
      where: { slug: community.slug },
      update: {},
      create: {
        slug: community.slug,
        name: community.name,
        description: community.description,
      },
    });
  }

  return { skipped: false };
}
