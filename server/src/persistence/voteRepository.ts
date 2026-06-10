/**
 * Vote（up vote）の永続化境界（ポート）。ADR-0019 の二重投票防止に従い、
 * (userId, targetType, targetId) の複合ユニーク制約で守る。
 */

export type VoteTargetType = "post" | "comment";

export interface VoteRecord {
  id: string;
  userId: string;
  targetType: VoteTargetType;
  targetId: string;
  createdAt: Date;
}

export interface VoteRepository {
  /** ユーザーが対象に vote 済みかどうかを返す。 */
  hasVoted(userId: string, targetType: VoteTargetType, targetId: string): Promise<boolean>;
  /** vote を記録する。既に vote 済みの場合は ConflictError を投げるのではなく true を返す（呼び出し側で判定）。 */
  create(userId: string, targetType: VoteTargetType, targetId: string): Promise<void>;
}

/** DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。 */
export function createInMemoryVoteRepository(): VoteRepository {
  const records: VoteRecord[] = [];
  let seq = 0;

  return {
    hasVoted(userId: string, targetType: VoteTargetType, targetId: string): Promise<boolean> {
      const exists = records.some(
        (r) => r.userId === userId && r.targetType === targetType && r.targetId === targetId,
      );
      return Promise.resolve(exists);
    },

    create(userId: string, targetType: VoteTargetType, targetId: string): Promise<void> {
      seq += 1;
      records.push({
        id: `vote-${seq}`,
        userId,
        targetType,
        targetId,
        createdAt: new Date(),
      });
      return Promise.resolve();
    },
  };
}
