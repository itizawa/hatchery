import type { InvitationStatus } from "@hatchery/common";
import { getInvitationStatus } from "@hatchery/common";

/** 永続化用の招待リンクエンティティ（内部情報を含む）。 */
export interface InvitationLinkRecord {
  id: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  usedByUserId: string | null;
  revokedAt: Date | null;
  createdByUserId: string;
  memo: string | null;
  createdAt: Date;
}

/** レスポンスに使う招待リンク（内部情報を除く）。 */
export interface InvitationLinkResponse {
  id: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  memo: string | null;
  createdAt: Date;
  status: InvitationStatus;
}

export interface InvitationLinkRepository {
  /** 招待リンクを作成する。 */
  create(input: {
    token: string;
    expiresAt: Date;
    createdByUserId: string;
    memo?: string;
  }): Promise<InvitationLinkRecord>;
  /** 全招待リンクを createdAt 降順で取得する。 */
  list(): Promise<InvitationLinkRecord[]>;
  /** トークンで招待リンクを検索する。 */
  findByToken(token: string): Promise<InvitationLinkRecord | null>;
  /** 招待リンクを手動失効させる（revokedAt をセット）。 */
  revoke(id: string): Promise<InvitationLinkRecord | null>;
  /**
   * 招待リンクを使用済みにする（#132）。
   * 条件付き更新: usedAt IS NULL かつ revokedAt IS NULL かつ expiresAt > now のときのみ。
   * 条件を満たさない場合は null を返す（競合・使用済み・失効・期限切れ）。
   */
  markUsed(id: string, usedByUserId: string): Promise<InvitationLinkRecord | null>;
}

/** ステータス付きレスポンスに変換する純粋関数。 */
export function toInvitationLinkResponse(
  record: InvitationLinkRecord,
  now: Date = new Date(),
): InvitationLinkResponse {
  return {
    id: record.id,
    token: record.token,
    expiresAt: record.expiresAt,
    usedAt: record.usedAt,
    revokedAt: record.revokedAt,
    memo: record.memo,
    createdAt: record.createdAt,
    status: getInvitationStatus(
      { revokedAt: record.revokedAt, usedAt: record.usedAt, expiresAt: record.expiresAt },
      now,
    ),
  };
}

export function createInMemoryInvitationLinkRepository(): InvitationLinkRepository {
  const records: InvitationLinkRecord[] = [];
  let seq = 0;

  return {
    create(input: {
      token: string;
      expiresAt: Date;
      createdByUserId: string;
      memo?: string;
    }): Promise<InvitationLinkRecord> {
      const record: InvitationLinkRecord = {
        id: `invitation-${++seq}`,
        token: input.token,
        expiresAt: input.expiresAt,
        usedAt: null,
        usedByUserId: null,
        revokedAt: null,
        createdByUserId: input.createdByUserId,
        memo: input.memo ?? null,
        createdAt: new Date(),
      };
      records.push(record);
      return Promise.resolve({ ...record });
    },

    list(): Promise<InvitationLinkRecord[]> {
      return Promise.resolve(
        [...records]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((r) => ({ ...r })),
      );
    },

    findByToken(token: string): Promise<InvitationLinkRecord | null> {
      const record = records.find((r) => r.token === token);
      return Promise.resolve(record ? { ...record } : null);
    },

    revoke(id: string): Promise<InvitationLinkRecord | null> {
      const record = records.find((r) => r.id === id);
      if (!record) return Promise.resolve(null);
      record.revokedAt = new Date();
      return Promise.resolve({ ...record });
    },

    markUsed(id: string, usedByUserId: string): Promise<InvitationLinkRecord | null> {
      const now = new Date();
      const record = records.find((r) => r.id === id);
      if (!record) return Promise.resolve(null);
      if (record.usedAt !== null || record.revokedAt !== null || record.expiresAt <= now) {
        return Promise.resolve(null);
      }
      record.usedAt = now;
      record.usedByUserId = usedByUserId;
      return Promise.resolve({ ...record });
    },
  };
}
