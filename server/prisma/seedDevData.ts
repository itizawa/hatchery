/**
 * seed が必要とする Prisma クライアントの構造的インターフェース。
 * 生成済み Prisma Client（`@prisma/client`）の該当メソッドはこの型に構造的に適合する。
 * ここで具象クライアントを値 import しないことで、生成物・実 DB が無くてもユニットテスト可能にする（設計書 §4）。
 *
 * #305: Message / Channel / ChannelEmployee / Task モデル削除に伴い、
 * seed を Community / Worker / User のみに変更。
 * #329: Employee → Worker へのリネーム。
 * #455: Google 認証のみに統一。loginId / passwordHash を廃止し email / googleId を必須化。
 */
export interface SeedPrisma {
  user: {
    upsert(args: {
      where: { googleId: string };
      update: { role?: "admin" | "member" };
      create: { id: string; email: string; googleId: string; displayName: string; role?: "admin" | "member" };
    }): Promise<unknown>;
  };
  worker: {
    upsert(args: {
      where: { id: string };
      update: Record<string, never>;
      create: {
        id: string;
        displayName: string;
        role: string | null;
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

/**
 * 開発用テストユーザー（#455: Google 認証のみ。loginId / password は廃止）。
 * dev-login エンドポイントはこの googleId でユーザーを検索してログインする。
 */
const DEV_USER = {
  id: "dev-user-1",
  email: "dev@hatchery.local",
  googleId: "dev-google-id",
  displayName: "claude-dev",
} as const;

/** MVP の AI ワーカー定義（#329: Worker へリネーム）。ADR-0019: author = workerId。 */
const DEFAULT_WORKERS = [
  { id: "worker-alice", displayName: "Alice", role: "エンジニア" },
  { id: "worker-bob", displayName: "Bob", role: "デザイナー" },
  { id: "worker-carol", displayName: "Carol", role: "マーケター" },
] as const;

/** MVP のコミュニティ seed（#305 / ADR-0019）。作成 API は #310 で実装済み。 */
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
  {
    // #487: Hatchery（このプロダクト自身）の改善を率直に議論する作風。
    // description は COMMUNITY_DESCRIPTION_MAX_LENGTH（500 文字）以内（#91）。
    slug: "hatchery",
    name: "Hatchery",
    description:
      "Hatchery（このプロダクト自身）について、足りない機能・UX の不満・改善案を率直に議論するコミュニティ。気になった点は遠慮なく挙げ、「あったら嬉しい機能」「使いづらいところ」を具体的に出し合う。個人開発サービスなど他プロダクトを引き合いに出し、参考にしたい点・真似したい工夫を語ってもよい。",
  },
] as const;

/**
 * 開発環境向けのテストデータを冪等に投入する（設計書 §4 / #305 / #329 / #455 / #487）。
 * - dev ユーザー（admin）/ AI ワーカー 3 名 / コミュニティ 3 件（technology / daily / hatchery）を upsert する。
 * - 本番環境（NODE_ENV=production）では何も投入せずスキップする。
 * すべて upsert のため再実行しても安全。
 */
export async function seedDevData(prisma: SeedPrisma): Promise<SeedResult> {
  if (process.env.NODE_ENV === "production") {
    return { skipped: true };
  }

  await prisma.user.upsert({
    where: { googleId: DEV_USER.googleId },
    update: { role: "admin" },
    create: { id: DEV_USER.id, email: DEV_USER.email, googleId: DEV_USER.googleId, displayName: DEV_USER.displayName, role: "admin" },
  });

  // AI ワーカー（3 名）
  for (const worker of DEFAULT_WORKERS) {
    await prisma.worker.upsert({
      where: { id: worker.id },
      update: {},
      create: {
        id: worker.id,
        displayName: worker.displayName,
        role: worker.role,
      },
    });
  }

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
