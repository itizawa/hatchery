/**
 * Comment の永続化境界（ポート）。ADR-0004 の層分離に従い、
 * ユースケースはこのインターフェースにのみ依存する。
 */

export interface CommentRecord {
  id: string;
  communityId: string;
  postId: string;
  slotKey: string;
  seq: number;
  author: string;
  text: string;
  score: number;
  createdAt: Date;
}

/** Comment 作成時の入力（バルク用）。 */
export interface CommentCreateInput {
  postId: string;
  slotKey: string;
  seq: number;
  author: string;
  text: string;
}

export interface CommentRepository {
  /**
   * community 配下に複数の comment をバルク作成する。
   * (communityId, slotKey, seq) はユニーク制約があるため、Cron 二重発火時は upsert で skip する。
   */
  createMany(communityId: string, inputs: CommentCreateInput[]): Promise<CommentRecord[]>;
  /** post 別に createdAt 昇順でコメントを取得する。 */
  listByPost(postId: string): Promise<CommentRecord[]>;
  /** community 別に createdAt 昇順でコメントを取得する。バッチのコンテキスト構築用。limit 省略時は 50 件。 */
  listByCommunity(communityId: string, limit?: number): Promise<CommentRecord[]>;
  /** ID で comment を取得する。存在しない場合は null を返す。 */
  findById(id: string): Promise<CommentRecord | null>;
  /**
   * comment の score に delta を加算する。
   * 存在しない場合は null を返す。
   */
  addScore(id: string, delta: number): Promise<CommentRecord | null>;
}

function cloneRecord(r: CommentRecord): CommentRecord {
  return { ...r };
}

/** DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。 */
export class InMemoryCommentRepository implements CommentRepository {
  private readonly records: CommentRecord[] = [];
  private seq = 0;

  createMany(communityId: string, inputs: CommentCreateInput[]): Promise<CommentRecord[]> {
    const created: CommentRecord[] = [];
    for (const input of inputs) {
      // 重複チェック（(communityId, slotKey, seq) ユニーク）
      const exists = this.records.find(
        (r) =>
          r.communityId === communityId && r.slotKey === input.slotKey && r.seq === input.seq,
      );
      if (exists) {
        created.push(cloneRecord(exists));
        continue;
      }
      this.seq += 1;
      const record: CommentRecord = {
        id: `comment-${this.seq}`,
        communityId,
        postId: input.postId,
        slotKey: input.slotKey,
        seq: input.seq,
        author: input.author,
        text: input.text,
        score: 0,
        createdAt: new Date(),
      };
      this.records.push(record);
      created.push(cloneRecord(record));
    }
    return Promise.resolve(created);
  }

  listByPost(postId: string): Promise<CommentRecord[]> {
    const filtered = this.records
      .filter((r) => r.postId === postId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return Promise.resolve(filtered.map(cloneRecord));
  }

  listByCommunity(communityId: string, limit = 50): Promise<CommentRecord[]> {
    const filtered = this.records
      .filter((r) => r.communityId === communityId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
    return Promise.resolve(filtered.map(cloneRecord));
  }

  findById(id: string): Promise<CommentRecord | null> {
    const found = this.records.find((r) => r.id === id);
    return Promise.resolve(found ? cloneRecord(found) : null);
  }

  addScore(id: string, delta: number): Promise<CommentRecord | null> {
    const record = this.records.find((r) => r.id === id);
    if (!record) return Promise.resolve(null);
    record.score += delta;
    return Promise.resolve(cloneRecord(record));
  }
}
