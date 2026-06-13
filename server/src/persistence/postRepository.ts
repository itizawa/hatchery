/**
 * Post の永続化境界（ポート）。ADR-0004 の層分離に従い、
 * ユースケースはこのインターフェースにのみ依存する。
 */

import { randomUUID } from "node:crypto";

export interface PostRecord {
  id: string;
  communityId: string;
  slotKey: string;
  seq: number;
  author: string;
  title: string;
  text: string;
  score: number;
  createdAt: Date;
}

/** Post 作成時の入力（バルク用）。 */
export interface PostCreateInput {
  slotKey: string;
  seq: number;
  author: string;
  title: string;
  text: string;
}

export interface PostRepository {
  /**
   * community 配下に複数の post をバルク作成する。
   * (communityId, slotKey, seq) はユニーク制約があるため、Cron 二重発火時は upsert で skip する。
   */
  createMany(communityId: string, inputs: PostCreateInput[]): Promise<PostRecord[]>;
  /** community 別に新着順（createdAt 降順）で post を取得する。limit 省略時は 50 件。 */
  listByCommunity(communityId: string, limit?: number): Promise<PostRecord[]>;
  /** ID で post を取得する。存在しない場合は null を返す。 */
  findById(id: string): Promise<PostRecord | null>;
  /**
   * post の score に delta を加算する。
   * 存在しない場合は null を返す。
   */
  addScore(id: string, delta: number): Promise<PostRecord | null>;
  /** 全 community の post を新着順（createdAt 降順）で取得する。公開ホームフィード用。limit 省略時は 50 件。 */
  listLatest(limit?: number): Promise<PostRecord[]>;
  /**
   * 全 community の post をカーソルベースのページネーションで取得する（#367）。
   * cursor は base64(JSON{ createdAt: ISO文字列, id: string })。
   * nextCursor が null の場合は末尾（追加ページなし）。
   */
  listLatestPaged(
    cursor?: string,
    limit?: number,
  ): Promise<{ posts: PostRecord[]; nextCursor: string | null }>;
  /**
   * 全 community の post を人気順（score 降順 → 同点は createdAt 降順 → id 降順）で
   * カーソルベースのページネーション取得する（#435）。
   * cursor は base64(JSON{ score, createdAt: ISO文字列, id: string })。
   * nextCursor が null の場合は末尾（追加ページなし）。
   */
  listPopularPaged(
    cursor?: string,
    limit?: number,
  ): Promise<{ posts: PostRecord[]; nextCursor: string | null }>;
}

function cloneRecord(r: PostRecord): PostRecord {
  return { ...r };
}

interface CursorPayload {
  createdAt: string;
  id: string;
}

export function encodeCursor(record: PostRecord): string {
  const payload: CursorPayload = { createdAt: record.createdAt.toISOString(), id: record.id };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "createdAt" in parsed &&
      "id" in parsed &&
      typeof (parsed as Record<string, unknown>).createdAt === "string" &&
      typeof (parsed as Record<string, unknown>).id === "string"
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

interface PopularCursorPayload {
  score: number;
  createdAt: string;
  id: string;
}

export function encodePopularCursor(record: PostRecord): string {
  const payload: PopularCursorPayload = {
    score: record.score,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decodePopularCursor(cursor: string): PopularCursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "score" in parsed &&
      "createdAt" in parsed &&
      "id" in parsed &&
      typeof (parsed as Record<string, unknown>).score === "number" &&
      typeof (parsed as Record<string, unknown>).createdAt === "string" &&
      typeof (parsed as Record<string, unknown>).id === "string"
    ) {
      return parsed as PopularCursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** 人気順（score 降順 → createdAt 降順 → id 降順）の比較関数。 */
function comparePopular(a: PostRecord, b: PostRecord): number {
  if (a.score !== b.score) return b.score - a.score;
  const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
  if (timeDiff !== 0) return timeDiff;
  return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
}

/** DB 非依存のインメモリ実装。ユースケース/ルートのテストで注入する。 */
export function createInMemoryPostRepository(): PostRepository {
  const records: PostRecord[] = [];

  return {
    createMany(communityId: string, inputs: PostCreateInput[]): Promise<PostRecord[]> {
      const created: PostRecord[] = [];
      for (const input of inputs) {
        // 重複チェック（(communityId, slotKey, seq) ユニーク）
        const exists = records.find(
          (r) =>
            r.communityId === communityId && r.slotKey === input.slotKey && r.seq === input.seq,
        );
        if (exists) {
          // 既存レコードをそのまま返す（upsert で skip）
          created.push(cloneRecord(exists));
          continue;
        }
        // 本番（Prisma）は uuid(7) を採番するため、in-memory も UUID を採番して整合させる（#433）。
        const record: PostRecord = {
          id: randomUUID(),
          communityId,
          slotKey: input.slotKey,
          seq: input.seq,
          author: input.author,
          title: input.title,
          text: input.text,
          score: 0,
          createdAt: new Date(),
        };
        records.push(record);
        created.push(cloneRecord(record));
      }
      return Promise.resolve(created);
    },

    listByCommunity(communityId: string, limit = 50): Promise<PostRecord[]> {
      const filtered = records
        .filter((r) => r.communityId === communityId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
      return Promise.resolve(filtered.map(cloneRecord));
    },

    findById(id: string): Promise<PostRecord | null> {
      const found = records.find((r) => r.id === id);
      return Promise.resolve(found ? cloneRecord(found) : null);
    },

    addScore(id: string, delta: number): Promise<PostRecord | null> {
      const record = records.find((r) => r.id === id);
      if (!record) return Promise.resolve(null);
      record.score += delta;
      return Promise.resolve(cloneRecord(record));
    },

    listLatest(limit = 50): Promise<PostRecord[]> {
      const sorted = [...records]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
      return Promise.resolve(sorted.map(cloneRecord));
    },

    listLatestPaged(
      cursor?: string,
      limit = 20,
    ): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      let cursorPayload: CursorPayload | null = null;
      if (cursor !== undefined) {
        cursorPayload = decodeCursor(cursor);
        if (!cursorPayload) {
          return Promise.reject(new Error("INVALID_CURSOR"));
        }
      }

      const sorted = [...records].sort((a, b) => {
        const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
      });

      let filtered = sorted;
      if (cursorPayload) {
        const cursorTime = new Date(cursorPayload.createdAt).getTime();
        const cursorId = cursorPayload.id;
        filtered = sorted.filter((r) => {
          const rTime = r.createdAt.getTime();
          if (rTime < cursorTime) return true;
          if (rTime === cursorTime) return r.id < cursorId;
          return false;
        });
      }

      const fetched = filtered.slice(0, limit + 1);
      const hasMore = fetched.length > limit;
      const posts = hasMore ? fetched.slice(0, limit) : fetched;
      const nextCursor = hasMore ? encodeCursor(posts[posts.length - 1]!) : null;

      return Promise.resolve({ posts: posts.map(cloneRecord), nextCursor });
    },

    listPopularPaged(
      cursor?: string,
      limit = 20,
    ): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      let cursorPayload: PopularCursorPayload | null = null;
      if (cursor !== undefined) {
        cursorPayload = decodePopularCursor(cursor);
        if (!cursorPayload) {
          return Promise.reject(new Error("INVALID_CURSOR"));
        }
      }

      const sorted = [...records].sort(comparePopular);

      let filtered = sorted;
      if (cursorPayload) {
        const cursorScore = cursorPayload.score;
        const cursorTime = new Date(cursorPayload.createdAt).getTime();
        const cursorId = cursorPayload.id;
        filtered = sorted.filter((r) => {
          if (r.score < cursorScore) return true;
          if (r.score > cursorScore) return false;
          const rTime = r.createdAt.getTime();
          if (rTime < cursorTime) return true;
          if (rTime === cursorTime) return r.id < cursorId;
          return false;
        });
      }

      const fetched = filtered.slice(0, limit + 1);
      const hasMore = fetched.length > limit;
      const posts = hasMore ? fetched.slice(0, limit) : fetched;
      const nextCursor = hasMore ? encodePopularCursor(posts[posts.length - 1]!) : null;

      return Promise.resolve({ posts: posts.map(cloneRecord), nextCursor });
    },
  };
}
