import type { Prisma } from "@prisma/client";

export interface CommentRecord {
  id: string;
  postId: string;
  text: string;
  author: string;
  score: number;
  parentCommentId: string | null;
  communityId: string;
  createdAt: Date;
}

export interface CreateCommentInput {
  postId: string;
  slotKey: string;
  seq: number;
  author: string;
  text: string;
  createdAt?: Date;
}

export type RawCommentRow = Prisma.CommentGetPayload<{
  select: {
    id: true;
    postId: true;
    text: true;
    author: true;
    score: true;
    parentCommentId: true;
    communityId: true;
    createdAt: true;
  };
}>;

export interface CommentRepository {
  /**
   * community に属するコメントを作成する（バッチ生成で使用）。
   * eslint-disable-next-line max-params は createMany のシグネチャが
   * communityId + CreateCommentInput[] の 2 引数のため不要だが、interface 上の宣言は
   * オブジェクトパターンに統一しない（ADR-0006 の外部 I/F の例外に相当するため）。
   */
  createMany(
    communityId: string,
    inputs: CreateCommentInput[],
  ): Promise<CommentRecord[]>;
  /** postId に紐づくコメントを取得する（スレッド表示で使用）。 */
  listByPost({ postId }: { postId: string }): Promise<CommentRecord[]>;
  /**
   * community に属するコメントを取得する（バッチ: あらすじ生成で使用）。
   * `options.maxCreatedAt` が指定されたときはその日時以前のコメントのみ返す（reveal フィルタ）。
   * @deprecated 新規利用は listByPost を使うこと
   */
  listByCommunity(
    communityId: string,
    limit?: number,
    options?: { maxCreatedAt?: Date },
  ): Promise<CommentRecord[]>;
  /** コメントのスコアを加算する（vote で使用）。 */
  addScore({ id, delta }: { id: string; delta: number }): Promise<CommentRecord | null>;
  /** コメントの parent_comment_id を更新する（返信コメントのネスト処理で使用）。 */
  // eslint-disable-next-line max-params
  updateParentCommentId?: (id: string, parentCommentId: string | null) => Promise<CommentRecord | null>;
  /**
   * ワーカー別にコメントを createdAt 降順で取得する（#690）。
   * カーソルページネーション対応。cursor は直前のページ最終コメントの id。
   * limit 省略時は 20 件。
   */
  listByWorker(opts: { workerId: string; limit?: number; cursor?: string }): Promise<{
    comments: CommentRecord[];
    nextCursor: string | null;
  }>;
}

function cloneRecord(r: CommentRecord): CommentRecord {
  return { ...r };
}

function generateId(): string {
  return Math.random().toString(36).slice(2);
}

export function createInMemoryCommentRepository(): CommentRepository {
  const records: CommentRecord[] = [];

  return {
    async createMany(communityId: string, inputs: CreateCommentInput[]): Promise<CommentRecord[]> {
      const created: CommentRecord[] = [];
      for (const input of inputs) {
        const id = `${input.slotKey}-${input.seq}-${generateId()}`;
        const record: CommentRecord = {
          id,
          postId: input.postId,
          text: input.text,
          author: input.author,
          score: 0,
          parentCommentId: null,
          communityId,
          createdAt: input.createdAt ?? new Date(),
        };
        records.push(record);
        created.push(cloneRecord(record));
      }
      return created;
    },

    listByPost({ postId }: { postId: string }): Promise<CommentRecord[]> {
      return Promise.resolve(
        records.filter((r) => r.postId === postId).map(cloneRecord),
      );
    },

    listByCommunity(
      communityId: string,
      limit?: number,
      options?: { maxCreatedAt?: Date },
    ): Promise<CommentRecord[]> {
      let filtered = records.filter((r) => r.communityId === communityId);
      if (options?.maxCreatedAt) {
        const cutoff = options.maxCreatedAt;
        filtered = filtered.filter((r) => r.createdAt <= cutoff);
      }
      const sliced = limit !== undefined ? filtered.slice(-limit) : filtered;
      return Promise.resolve(sliced.map(cloneRecord));
    },

    addScore({ id, delta }: { id: string; delta: number }): Promise<CommentRecord | null> {
      const record = records.find((r) => r.id === id);
      if (!record) return Promise.resolve(null);
      record.score += delta;
      return Promise.resolve(cloneRecord(record));
    },

    updateParentCommentId(
      id: string,
      parentCommentId: string | null,
    ): Promise<CommentRecord | null> {
      const record = records.find((r) => r.id === id);
      if (!record) return Promise.resolve(null);
      record.parentCommentId = parentCommentId;
      return Promise.resolve(cloneRecord(record));
    },

    async listByWorker({
      workerId,
      limit = 20,
      cursor,
    }: {
      workerId: string;
      limit?: number;
      cursor?: string;
    }): Promise<{ comments: CommentRecord[]; nextCursor: string | null }> {
      // createdAt 降順でソート（同一時刻は id の辞書順逆で安定化）。
      const sorted = records
        .filter((r) => r.author === workerId)
        // eslint-disable-next-line max-params
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));

      // cursor が指定された場合、cursor を持つ要素の次から返す。
      // cursor が見つからない場合は Prisma 実装と同様にエラーを投げる。
      let start = 0;
      if (cursor) {
        const idx = sorted.findIndex((r) => r.id === cursor);
        if (idx === -1) throw new Error(`Cursor not found: ${cursor}`);
        start = idx + 1;
      }

      const page = sorted.slice(start, start + limit + 1);
      const hasNext = page.length > limit;
      const comments = page.slice(0, limit).map(cloneRecord);
      const nextCursor = hasNext ? (comments[comments.length - 1]?.id ?? null) : null;
      return { comments, nextCursor };
    },
  };
}
