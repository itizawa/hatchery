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
    }): Promise<{ id: string }>;
  };
  post: {
    upsert(args: {
      where: { communityId_slotKey_seq: { communityId: string; slotKey: string; seq: number } };
      update: Record<string, never>;
      create: { id: string; communityId: string; slotKey: string; seq: number; author: string; title: string; text: string; createdAt: Date };
    }): Promise<{ id: string }>;
  };
  comment: {
    upsert(args: {
      where: { communityId_slotKey_seq: { communityId: string; slotKey: string; seq: number } };
      update: Record<string, never>;
      create: { id: string; communityId: string; postId: string; slotKey: string; seq: number; author: string; text: string; createdAt: Date; parentCommentId?: string };
    }): Promise<{ id: string }>;
  };
}

export interface SeedResult {
  /** 本番環境などで投入をスキップした場合は true。 */
  skipped: boolean;
}

import {
  DEV_USER,
  DEFAULT_WORKERS,
  DEFAULT_COMMUNITIES,
  SEED_POSTS,
  SEED_COMMENTS,
} from "./seedData.js";

/**
 * 開発環境向けのテストデータを冪等に投入する（設計書 §4 / #305 / #329 / #455 / #487）。
 * - dev ユーザー（admin）/ AI ワーカー 3 名 / コミュニティ 3 件（technology / daily / hatchery）を upsert する。
 * - 各コミュニティにサンプル Post と Comment を upsert する。
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

  // MVP コミュニティ（#305 / ADR-0019）。upsert 後に実 ID を取得してポスト作成に使う。
  const communityIdBySlug = new Map<string, string>();
  for (const community of DEFAULT_COMMUNITIES) {
    const result = await prisma.community.upsert({
      where: { slug: community.slug },
      update: {},
      create: {
        slug: community.slug,
        name: community.name,
        description: community.description,
      },
    });
    communityIdBySlug.set(community.slug, result.id);
  }

  // サンプル Post（communityId は slug から解決した実 ID を使う）
  const postIds = new Map<string, string>();
  for (const post of SEED_POSTS) {
    const communityId = communityIdBySlug.get(post.communitySlug);
    if (!communityId) continue;
    const result = await prisma.post.upsert({
      where: { communityId_slotKey_seq: { communityId, slotKey: post.slotKey, seq: post.seq } },
      update: {},
      create: {
        id: post.id,
        communityId,
        slotKey: post.slotKey,
        seq: post.seq,
        author: post.author,
        title: post.title,
        text: post.text,
        createdAt: post.createdAt,
      },
    });
    postIds.set(post.id, result.id);
  }

  // サンプル Comment（communityId・postId を実 ID で解決する）
  for (const comment of SEED_COMMENTS) {
    const communityId = communityIdBySlug.get(comment.communitySlug);
    const postId = postIds.get(comment.postId);
    if (!communityId || !postId) continue;
    await prisma.comment.upsert({
      where: { communityId_slotKey_seq: { communityId, slotKey: comment.slotKey, seq: comment.seq } },
      update: {},
      create: {
        id: comment.id,
        communityId,
        postId,
        slotKey: comment.slotKey,
        seq: comment.seq,
        author: comment.author,
        text: comment.text,
        createdAt: comment.createdAt,
      },
    });
  }

  return { skipped: false };
}
