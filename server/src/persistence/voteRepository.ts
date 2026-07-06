import type { TrendingItem, VoteDirection } from "@hatchery/common";

import { buildTrendingExcerpt } from "./trendingItemBuilder.js";

export type { VoteDirection };

/** vote 対象の種別（post / comment）。 */
export type VoteTargetType = "post" | "comment";

/** vote の永続化レコード。 */
export interface VoteRecord {
  id: string;
  sessionId: string;
  userId: string | null;
  targetType: VoteTargetType;
  targetId: string;
  direction: VoteDirection;
  createdAt: Date;
}

/** VoteRepository のポート定義（ADR-0025 / ADR-0031 / ADR-0036 / #453 / #777）。 */
export interface VoteRepository {
  /**
   * 指定セッション・対象の vote を 1 件取得する。
   * Exclusive Arc の where（sessionId_postId / sessionId_commentId）で引く。
   */
  findVote(params: {
    sessionId: string;
    targetType: VoteTargetType;
    targetId: string;
  }): Promise<VoteRecord | null>;

  /**
   * vote を記録する（toggle / switch ロジックは実装側で担う）。
   * scoreDelta を返す（+1 / -1 / +2 / -2）。
   * voteAndApplyScore と異なり score 更新は呼び出し元が行う（in-memory 用）。
   */
  vote(params: {
    sessionId: string;
    userId: string | null;
    targetType: VoteTargetType;
    targetId: string;
    direction: VoteDirection;
  }): Promise<{ scoreDelta: number }>;

  /**
   * vote を記録し、対象（post / comment）の score を原子的に更新する。
   * Prisma 実装では同一 TX で post / comment の score を直接 increment する。
   * in-memory 実装では applyScore コールバックで score を更新する。
   * score（更新後）を返す（null = 対象が見つからなかった場合）。
   * currentDirection: 操作後の vote 方向（toggle off 時は null）（#853）。
   */
  voteAndApplyScore(params: {
    sessionId: string;
    userId: string | null;
    targetType: VoteTargetType;
    targetId: string;
    direction: VoteDirection;
    applyScore: (delta: number) => Promise<number | null>;
  }): Promise<{ scoreDelta: number; score: number | null; currentDirection: VoteDirection | null }>;

  /**
   * 指定セッション・対象種別で複数 targetId の vote 状態を一括取得する（#831・N+1 回避）。
   * 返り値は targetId → direction の Map（未投票の targetId はエントリなし）。
   */
  findVotesBySessionAndTargets(params: {
    sessionId: string;
    targetType: VoteTargetType;
    targetIds: string[];
  }): Promise<Map<string, VoteDirection>>;

  /** 指定日時以降の vote を worker 単位で集計し、workerId → netScore の Map を返す（#665 / ADR-0032）。 */
  netScoresByWorkerSince(since: Date): Promise<Map<string, number>>;

  /** 指定日時以降の vote を community 単位で集計し、communityId → netScore の Map を返す（#486 / ADR-0030）。 */
  netScoresByCommunitySince(since: Date): Promise<Map<string, number>>;

  /**
   * 指定日時以降の vote をユーザー×コミュニティ単位で集計する（#761 独占的ロイヤリティ計算用）。
   * 返り値: userId → (communityId → vote 件数) の Map。
   * 未認証（userId=null）の vote は除外する。
   */
  voteCountsPerUserPerCommunitySince(since: Date): Promise<Map<string, Map<string, number>>>;

  /** 指定日時以降の vote をワーカー単位で生カウントする。author → 総 vote 件数 の Map。 */
  rawVoteCountsByWorkerSince(since: Date): Promise<Map<string, number>>;

  /**
   * 指定日時以降の vote を Post 単位・Comment 単位で集計し、net_score 降順で上位 limit 件を返す（#1065）。
   * ランキング画面右サイドバーの「直近7日間で評価を多く獲得した Post / Comment」表示に使う。
   */
  trendingItemsSince(params: { since: Date; limit: number }): Promise<TrendingItem[]>;
}

/**
 * trendingItemsSince（in-memory）で対象（post / comment）のメタデータを解決するための情報。
 * comment の場合 postId は親 post の id、post の場合は自身の id。
 */
export interface TrendingTargetMeta {
  postId: string;
  communityId: string;
  communitySlug: string;
  text: string;
  createdAt: Date;
}

/**
 * in-memory trendingItemsSince で targetId → 対象メタデータを解決する関数。
 * 対象が見つからない（削除済み等）場合は null を返す（呼び出し元でスキップする）。
 */
export type ResolveTrendingTargetMeta = (
  targetType: VoteTargetType,
  targetId: string,
) => Promise<TrendingTargetMeta | null>;

// ──────────────────────────────────────────────────────────────────────────────────
// In-Memory 実装
// ──────────────────────────────────────────────────────────────────────────────────

/**
 * in-memory VoteRepository（テスト / ローカル dev 用）。
 * @param options.resolveTrendingTargetMeta trendingItemsSince で targetId → 対象メタデータを
 *   解決する関数。省略時は trendingItemsSince が常に空配列を返す（#1065）。
 */
export function createInMemoryVoteRepository(
  options: { resolveTrendingTargetMeta?: ResolveTrendingTargetMeta } = {},
): VoteRepository {
  const { resolveTrendingTargetMeta } = options;
  const records: VoteRecord[] = [];

  function findExisting({
    sessionId,
    targetType,
    targetId,
  }: {
    sessionId: string;
    targetType: VoteTargetType;
    targetId: string;
  }): VoteRecord | undefined {
    return records.find(
      (r) => r.sessionId === sessionId && r.targetType === targetType && r.targetId === targetId,
    );
  }

  /**
   * toggle/switch ロジックを in-memory records に適用し scoreDelta / currentDirection を返す。
   * currentDirection: 操作後の vote 方向（toggle off 時は null）（#853）。
   */
  function applyMutation({
    sessionId,
    userId,
    targetType,
    targetId,
    direction,
  }: {
    sessionId: string;
    userId: string | null;
    targetType: VoteTargetType;
    targetId: string;
    direction: VoteDirection;
  }): { scoreDelta: number; currentDirection: VoteDirection | null } {
    const existing = findExisting({ sessionId, targetType, targetId });

    if (!existing) {
      records.push({
        id: `vote-${records.length + 1}`,
        sessionId,
        userId,
        targetType,
        targetId,
        direction,
        createdAt: new Date(),
      });
      return { scoreDelta: direction === "up" ? 1 : -1, currentDirection: direction };
    }

    if (existing.direction === direction) {
      const idx = records.indexOf(existing);
      records.splice(idx, 1);
      return { scoreDelta: direction === "up" ? -1 : 1, currentDirection: null };
    }

    existing.direction = direction;
    return { scoreDelta: direction === "up" ? 2 : -2, currentDirection: direction };
  }

  return {
    async findVote({ sessionId, targetType, targetId }) {
      return findExisting({ sessionId, targetType, targetId }) ?? null;
    },

    async vote({ sessionId, userId, targetType, targetId, direction }) {
      const { scoreDelta } = applyMutation({ sessionId, userId, targetType, targetId, direction });
      return { scoreDelta };
    },

    async voteAndApplyScore({ sessionId, userId, targetType, targetId, direction, applyScore }) {
      const { scoreDelta, currentDirection } = applyMutation({ sessionId, userId, targetType, targetId, direction });
      const score = await applyScore(scoreDelta);
      return { scoreDelta, score, currentDirection };
    },

    async findVotesBySessionAndTargets({ sessionId, targetType, targetIds }) {
      const map = new Map<string, VoteDirection>();
      for (const record of records) {
        if (
          record.sessionId === sessionId &&
          record.targetType === targetType &&
          targetIds.includes(record.targetId)
        ) {
          map.set(record.targetId, record.direction);
        }
      }
      return map;
    },

    async netScoresByWorkerSince() {
      // in-memory では createdAt フィルタを省略（テスト用途では全件を返す）
      const scoreMap = new Map<string, number>();
      for (const r of records) {
        const delta = r.direction === "up" ? 1 : -1;
        scoreMap.set(r.targetId, (scoreMap.get(r.targetId) ?? 0) + delta);
      }
      return scoreMap;
    },

    async netScoresByCommunitySince() {
      return new Map();
    },

    async voteCountsPerUserPerCommunitySince() {
      return new Map();
    },

    async rawVoteCountsByWorkerSince() {
      return new Map();
    },

    async trendingItemsSince({ since, limit }): Promise<TrendingItem[]> {
      if (!resolveTrendingTargetMeta) return [];

      interface Aggregate {
        targetType: VoteTargetType;
        targetId: string;
        netScore: number;
      }
      const aggregates = new Map<string, Aggregate>();
      for (const r of records) {
        if (r.createdAt.getTime() < since.getTime()) continue;
        const key = `${r.targetType} ${r.targetId}`;
        const delta = r.direction === "up" ? 1 : -1;
        const existing = aggregates.get(key);
        if (existing) {
          existing.netScore += delta;
        } else {
          aggregates.set(key, { targetType: r.targetType, targetId: r.targetId, netScore: delta });
        }
      }

      const items: TrendingItem[] = [];
      for (const { targetType, targetId, netScore } of aggregates.values()) {
        const meta = await resolveTrendingTargetMeta(targetType, targetId);
        if (!meta) continue;
        items.push({
          type: targetType,
          id: targetId,
          post_id: targetType === "post" ? targetId : meta.postId,
          excerpt: buildTrendingExcerpt(meta.text),
          community_id: meta.communityId,
          community_slug: meta.communitySlug,
          net_score: netScore,
          created_at: meta.createdAt.toISOString(),
        });
      }

      // eslint-disable-next-line max-params
      items.sort((a, b) => b.net_score - a.net_score);
      return items.slice(0, limit);
    },
  };
}
