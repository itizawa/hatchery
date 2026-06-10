/**
 * Vote（up/down）の永続化境界（ポート）。ADR-0025 で down vote を追加。
 * (userId, targetType, targetId) の複合ユニーク制約で 1 ユーザー × 1 ターゲットにつき 1 レコードを維持。
 * 同一方向の再押下で toggle off（中立）、異なる方向で switch する。
 */

import type { VoteDirection } from "@hatchery/common";

export type { VoteDirection };
export type VoteTargetType = "post" | "comment";

export interface VoteRecord {
  id: string;
  userId: string;
  targetType: VoteTargetType;
  targetId: string;
  direction: VoteDirection;
  createdAt: Date;
}

export interface VoteRepository {
  /** 既存 vote レコードを取得する。未投票なら null。 */
  findVote(userId: string, targetType: VoteTargetType, targetId: string): Promise<VoteRecord | null>;
  /**
   * vote を記録する（toggle/switch ロジック）。
   * - 未投票 → up: create, scoreDelta = +1
   * - 未投票 → down: create, scoreDelta = -1
   * - up 済み → up: delete (toggle off), scoreDelta = -1
   * - down 済み → down: delete (toggle off), scoreDelta = +1
   * - up 済み → down: update, scoreDelta = -2
   * - down 済み → up: update, scoreDelta = +2
   */
  vote(
    userId: string,
    targetType: VoteTargetType,
    targetId: string,
    direction: VoteDirection,
  ): Promise<{ scoreDelta: number }>;
}

/** DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。 */
export function createInMemoryVoteRepository(): VoteRepository {
  const records: VoteRecord[] = [];
  let seq = 0;

  function findRecord(
    userId: string,
    targetType: VoteTargetType,
    targetId: string,
  ): VoteRecord | null {
    return (
      records.find(
        (r) => r.userId === userId && r.targetType === targetType && r.targetId === targetId,
      ) ?? null
    );
  }

  return {
    findVote(
      userId: string,
      targetType: VoteTargetType,
      targetId: string,
    ): Promise<VoteRecord | null> {
      return Promise.resolve(findRecord(userId, targetType, targetId));
    },

    vote(
      userId: string,
      targetType: VoteTargetType,
      targetId: string,
      direction: VoteDirection,
    ): Promise<{ scoreDelta: number }> {
      const existing = findRecord(userId, targetType, targetId);

      if (!existing) {
        seq += 1;
        records.push({
          id: `vote-${seq}`,
          userId,
          targetType,
          targetId,
          direction,
          createdAt: new Date(),
        });
        return Promise.resolve({ scoreDelta: direction === "up" ? 1 : -1 });
      }

      if (existing.direction === direction) {
        // toggle off: delete
        const idx = records.indexOf(existing);
        records.splice(idx, 1);
        return Promise.resolve({ scoreDelta: direction === "up" ? -1 : 1 });
      }

      // switch direction
      existing.direction = direction;
      return Promise.resolve({ scoreDelta: direction === "up" ? 2 : -2 });
    },
  };
}
