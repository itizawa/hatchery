/**
 * Vote（up/down）の永続化境界（ポート）。ADR-0025 で down vote を追加・ADR-0031 で Exclusive Arc 化（#453）。
 * 1 ユーザー × 1 ターゲット（post または comment）につき 1 レコードを維持する
 *（DB では (userId, postId) / (userId, commentId) の複合ユニークで担保）。
 * 同一方向の再押下で toggle off（中立）、異なる方向で switch する。
 *
 * ポートの公開シグネチャは引き続き多態的な (targetType, targetId) を取り、
 * Prisma 実装が postId / commentId の本物 FK にマップする（#453）。
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
  /**
   * vote の記録（toggle/switch）と対象 score の更新を「単一の整合操作」として行う（#453 / AC7）。
   * vote 作成/更新/削除と score 加算が片方だけ成功する中間状態を排除する。
   *
   * - `vote()` と同じ toggle/switch ロジックで `scoreDelta` を決め、その delta を対象 score に適用する。
   * - 戻り値 `score` は更新後の対象スコア。対象が存在しない場合は null。
   *
   * @param applyScore score を `delta` 加算し更新後スコア（対象が無ければ null）を返す関数。
   *   in-memory 実装はこのコールバックで対象 store（PostRepository/CommentRepository）を更新する。
   *   Prisma 実装は同一 DB トランザクション内で対象 score を直接更新するため、このコールバックは呼ばない。
   */
  voteAndApplyScore(
    userId: string,
    targetType: VoteTargetType,
    targetId: string,
    direction: VoteDirection,
    applyScore: (delta: number) => Promise<number | null>,
  ): Promise<{ scoreDelta: number; score: number | null }>;
  /**
   * 直近の vote から community 別の純スコア（up: +1 / down: -1）合計を集計する（#486 / ADR-0030）。
   * 定時バッチの「vote 重み付き 1 コミュニティ選定」の重み算出に使う。
   *
   * @param since この日時以降（`createdAt >= since`）の vote のみ集計する。
   * @returns communityId → 純スコア合計の Map。集計対象が無い community はキーを持たない。
   */
  netScoresByCommunitySince(since: Date): Promise<Map<string, number>>;
}

/**
 * targetId（Post / Comment の id）を所属 community id に解決する関数。
 * インメモリ実装の `netScoresByCommunitySince` で targetId を community に紐づけるために使う。
 * 解決できない（存在しない）ターゲットは null を返す。
 */
export type ResolveCommunityId = (
  targetType: VoteTargetType,
  targetId: string,
) => string | null;

/**
 * DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。
 *
 * @param resolveCommunityId `netScoresByCommunitySince` で targetId → communityId を解決する関数。
 *   省略時は全ターゲットが解決不能（純スコア集計は常に空）になる。
 * @param clock `createdAt` に使う現在時刻供給関数（テストで固定するため）。既定は `() => new Date()`。
 */
export function createInMemoryVoteRepository(
  resolveCommunityId?: ResolveCommunityId,
  clock: () => Date = () => new Date(),
): VoteRepository {
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

  /** toggle/switch ロジックで records を変異させ scoreDelta を返す（vote と voteAndApplyScore で共有）。 */
  function applyVoteMutation(
    userId: string,
    targetType: VoteTargetType,
    targetId: string,
    direction: VoteDirection,
  ): number {
    const existing = findRecord(userId, targetType, targetId);

    if (!existing) {
      seq += 1;
      records.push({
        id: `vote-${seq}`,
        userId,
        targetType,
        targetId,
        direction,
        createdAt: clock(),
      });
      return direction === "up" ? 1 : -1;
    }

    if (existing.direction === direction) {
      // toggle off: delete
      const idx = records.indexOf(existing);
      records.splice(idx, 1);
      return direction === "up" ? -1 : 1;
    }

    // switch direction
    existing.direction = direction;
    return direction === "up" ? 2 : -2;
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
      const scoreDelta = applyVoteMutation(userId, targetType, targetId, direction);
      return Promise.resolve({ scoreDelta });
    },

    async voteAndApplyScore(
      userId: string,
      targetType: VoteTargetType,
      targetId: string,
      direction: VoteDirection,
      applyScore: (delta: number) => Promise<number | null>,
    ): Promise<{ scoreDelta: number; score: number | null }> {
      const scoreDelta = applyVoteMutation(userId, targetType, targetId, direction);
      const score = await applyScore(scoreDelta);
      return { scoreDelta, score };
    },

    netScoresByCommunitySince(since: Date): Promise<Map<string, number>> {
      const scores = new Map<string, number>();
      for (const record of records) {
        if (record.createdAt.getTime() < since.getTime()) continue;
        const communityId = resolveCommunityId?.(record.targetType, record.targetId) ?? null;
        if (communityId === null) continue;
        const delta = record.direction === "up" ? 1 : -1;
        scores.set(communityId, (scores.get(communityId) ?? 0) + delta);
      }
      return Promise.resolve(scores);
    },
  };
}
