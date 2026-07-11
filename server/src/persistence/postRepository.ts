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
  /** 投稿に付与されたタグ一覧（#1087）。省略時 `[]`。 */
  tags: string[];
}

/** Post 作成時の入力（バルク用）。 */
export interface PostCreateInput {
  slotKey: string;
  seq: number;
  author: string;
  title: string;
  text: string;
  /**
   * 永続化時の createdAt（#556）。
   * 省略時は DB の `@default(now())`（Prisma）または `new Date()`（インメモリ）を使う。
   * 複数 Post 生成時に軽く stagger させてフィード先頭が一度に埋まらないようにする場合に注入する。
   */
  createdAt?: Date;
  /** 投稿に付与されたタグ一覧（#1087）。省略時 `[]`。 */
  tags?: string[];
}

/** reveal フィルタのオプション（#556）。 */
export interface RevealFilterOptions {
  /**
   * この時刻以降の `createdAt` を持つレコードを除外する。
   * 省略時はフィルタなし（全件返す）。
   */
  now?: Date;
}

/** コミュニティ別の post 統計（#527）。 */
export interface CommunityPostStats {
  postCount: number;
  lastPostAt: Date | null;
}

export interface PostRepository {
  /**
   * community 配下に複数の post をバルク作成する。
   * (communityId, slotKey, seq) はユニーク制約があるため、Cron 二重発火時は upsert で skip する。
   */
  createMany(communityId: string, inputs: PostCreateInput[]): Promise<PostRecord[]>;
  /**
   * community 別に新着順（createdAt 降順）で post を取得する。limit 省略時は 50 件（#556）。
   * options.now を渡すと `createdAt <= now` の reveal フィルタが有効になる。
   */
  listByCommunity(communityId: string, limit?: number, options?: RevealFilterOptions): Promise<PostRecord[]>;
  /**
   * community 別のカーソルページネーション（#881）。新着順（createdAt 降順 → id 降順）。
   * cursor は base64(JSON{ createdAt: ISO文字列, id: string })。
   * nextCursor が null の場合は末尾（追加ページなし）。
   * options.now を渡すと `createdAt <= now` の reveal フィルタが有効になる。
   */
  listByCommunityPaged({
    communityId,
    cursor,
    limit,
    options,
  }: {
    communityId: string;
    cursor?: string;
    limit?: number;
    options?: RevealFilterOptions;
  }): Promise<{ posts: PostRecord[]; nextCursor: string | null }>;
  /** ID で post を取得する。存在しない場合は null を返す。 */
  findById(id: string): Promise<PostRecord | null>;
  /**
   * post の score に delta を加算する。
   * 存在しない場合は null を返す。
   */
  addScore(id: string, delta: number): Promise<PostRecord | null>;
  /**
   * 全 community の post を新着順（createdAt 降順）で取得する。公開ホームフィード用。limit 省略時は 50 件（#556）。
   * options.now を渡すと `createdAt <= now` の reveal フィルタが有効になる。
   */
  listLatest(limit?: number, options?: RevealFilterOptions): Promise<PostRecord[]>;
  /**
   * コミュニティ ID をキー、post 統計（投稿数・最終投稿時刻）をバリューとした Map を返す（#527）。
   * N+1 を避けるため全コミュニティ分を一発集計する。
   * 投稿がないコミュニティはマップに含まれないため、呼び出し元で 0 件扱いにすること。
   */
  getStatsByCommunity(): Promise<Map<string, CommunityPostStats>>;
  /**
   * 全 community の post をカーソルベースのページネーションで取得する（#367 / #556）。
   * cursor は base64(JSON{ createdAt: ISO文字列, id: string })。
   * nextCursor が null の場合は末尾（追加ページなし）。
   * options.now を渡すと `createdAt <= now` の reveal フィルタが有効になる。
   */
  listLatestPaged(
    cursor?: string,
    limit?: number,
    options?: RevealFilterOptions,
  ): Promise<{ posts: PostRecord[]; nextCursor: string | null }>;
  /**
   * 全 community の post を人気順（score 降順 → 同点は createdAt 降順 → id 降順）で
   * カーソルベースのページネーション取得する（#435 / #556）。
   * cursor は base64(JSON{ score, createdAt: ISO文字列, id: string })。
   * nextCursor が null の場合は末尾（追加ページなし）。
   * options.now を渡すと `createdAt <= now` の reveal フィルタが有効になる。
   */
  listPopularPaged(
    cursor?: string,
    limit?: number,
    options?: RevealFilterOptions,
  ): Promise<{ posts: PostRecord[]; nextCursor: string | null }>;
  /**
   * community 別のカーソルページネーション（#886）。人気順（score 降順 → createdAt 降順 → id 降順）。
   * cursor は base64(JSON{ score, createdAt: ISO文字列, id: string })。
   * nextCursor が null の場合は末尾（追加ページなし）。
   * options.now を渡すと `createdAt <= now` の reveal フィルタが有効になる。
   */
  listByCommunityPopularPaged({
    communityId,
    cursor,
    limit,
    options,
  }: {
    communityId: string;
    cursor?: string;
    limit?: number;
    options?: RevealFilterOptions;
  }): Promise<{ posts: PostRecord[]; nextCursor: string | null }>;
  /**
   * community 内で直近 since 以降かつ score >= minScore の post を
   * score 降順で最大 limit 件返す（#558）。
   * 定時バッチの「人気トピック還元」プロンプト構築に使う。
   */
  listTopByCommunity(
    communityId: string,
    params: { since: Date; minScore: number; limit: number },
  ): Promise<PostRecord[]>;
  /**
   * community 内で createdAt >= since の post を createdAt 降順で返す（#673 comment バッチ）。
   * limit 省略時は 100 件。
   */
  listRecentByCommunity(communityId: string, since: Date, limit?: number): Promise<PostRecord[]>;
  /**
   * community 内で createdAt < before かつ score >= 0 の post を score 降順で最大 limit 件返す（#673 古い post 活性化）。
   * limit 省略時は 20 件。
   */
  listOldByCommunity(communityId: string, before: Date, limit?: number): Promise<PostRecord[]>;
  /**
   * 特定ワーカー（author）が投稿した post を新着順（createdAt 降順）で返す（#929）。
   * limit 省略時は 20 件。now を渡すと `createdAt <= now` の reveal フィルタが有効になる。
   */
  listByAuthor(params: { authorId: string; limit?: number; now?: Date }): Promise<PostRecord[]>;
  /**
   * title または text に q を含む post を新着順（createdAt 降順）で返す（#751 全文検索）。
   * limit 省略時は 50 件。options.now を渡すと `createdAt <= now` の reveal フィルタが有効になる。
   * 大文字小文字を区別しない部分一致（ILIKE 相当）で検索する。
   */
  search(params: { q: string; limit?: number; options?: RevealFilterOptions }): Promise<PostRecord[]>;
  /**
   * community 内で指定タグを 1 つ以上共有する post を新着順（createdAt 降順）で返す（#1087）。
   * excludePostId は結果から除外する（通常は問い合わせ元の post 自身）。
   * tags が空配列の場合は常に空配列を返す（DB 問い合わせを行わない）。
   * options.now を渡すと `createdAt <= now` の reveal フィルタが有効になる（ドリップ配信で未公開の post を除外・ADR-0034）。
   */
  listRelatedByTags(params: {
    communityId: string;
    tags: readonly string[];
    excludePostId: string;
    limit: number;
    options?: RevealFilterOptions;
  }): Promise<PostRecord[]>;
  /**
   * post の title/text をまとめて更新する（#1117・過去生成データのURL露出バックフィル用）。
   * 存在しない id は null を返す。
   */
  updateTitleAndText(params: { id: string; title: string; text: string }): Promise<PostRecord | null>;
}

function cloneRecord(r: PostRecord): PostRecord {
  return { ...r, tags: [...r.tags] };
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
// eslint-disable-next-line max-params
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
    // eslint-disable-next-line max-params
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
        // createdAt は input から注入可能（#556 ドリップ割当）。省略時は now。
        const record: PostRecord = {
          id: randomUUID(),
          communityId,
          slotKey: input.slotKey,
          seq: input.seq,
          author: input.author,
          title: input.title,
          text: input.text,
          score: 0,
          createdAt: input.createdAt ?? new Date(),
          tags: input.tags ?? [],
        };
        records.push(record);
        created.push(cloneRecord(record));
      }
      return Promise.resolve(created);
    },

    // eslint-disable-next-line max-params
    listByCommunity(communityId: string, limit = 50, options?: RevealFilterOptions): Promise<PostRecord[]> {
      const now = options?.now;
      const filtered = records
        .filter((r) => r.communityId === communityId)
        // reveal フィルタ（#556）: now が渡された場合、createdAt > now の post を除外する。
        .filter((r) => now === undefined || r.createdAt.getTime() <= now.getTime())
        // eslint-disable-next-line max-params
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
      return Promise.resolve(filtered.map(cloneRecord));
    },

    listByCommunityPaged({
      communityId,
      cursor,
      limit = 20,
      options,
    }: {
      communityId: string;
      cursor?: string;
      limit?: number;
      options?: RevealFilterOptions;
    }): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      let cursorPayload: CursorPayload | null = null;
      if (cursor !== undefined) {
        cursorPayload = decodeCursor(cursor);
        if (!cursorPayload) {
          return Promise.reject(new Error("INVALID_CURSOR"));
        }
      }

      const now = options?.now;
      const sorted = [...records]
        .filter((r) => r.communityId === communityId)
        .filter((r) => now === undefined || r.createdAt.getTime() <= now.getTime())
        // eslint-disable-next-line max-params
        .sort((a, b) => {
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
      const last = posts.at(-1);
      const nextCursor = hasMore && last ? encodeCursor(last) : null;

      return Promise.resolve({ posts: posts.map(cloneRecord), nextCursor });
    },

    listByCommunityPopularPaged({
      communityId,
      cursor,
      limit = 20,
      options,
    }: {
      communityId: string;
      cursor?: string;
      limit?: number;
      options?: RevealFilterOptions;
    }): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      let cursorPayload: PopularCursorPayload | null = null;
      if (cursor !== undefined) {
        cursorPayload = decodePopularCursor(cursor);
        if (!cursorPayload) {
          return Promise.reject(new Error("INVALID_CURSOR"));
        }
      }

      const now = options?.now;
      const sorted = [...records]
        .filter((r) => r.communityId === communityId)
        .filter((r) => now === undefined || r.createdAt.getTime() <= now.getTime())
        .sort(comparePopular);

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
      const last = posts.at(-1);
      const nextCursor = hasMore && last ? encodePopularCursor(last) : null;

      return Promise.resolve({ posts: posts.map(cloneRecord), nextCursor });
    },

    findById(id: string): Promise<PostRecord | null> {
      const found = records.find((r) => r.id === id);
      return Promise.resolve(found ? cloneRecord(found) : null);
    },

    // eslint-disable-next-line max-params
    addScore(id: string, delta: number): Promise<PostRecord | null> {
      const record = records.find((r) => r.id === id);
      if (!record) return Promise.resolve(null);
      record.score += delta;
      return Promise.resolve(cloneRecord(record));
    },

    // eslint-disable-next-line max-params
    listLatest(limit = 50, options?: RevealFilterOptions): Promise<PostRecord[]> {
      const now = options?.now;
      const sorted = [...records]
        // reveal フィルタ（#556）: now が渡された場合、createdAt > now の post を除外する。
        .filter((r) => now === undefined || r.createdAt.getTime() <= now.getTime())
        // eslint-disable-next-line max-params
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
      return Promise.resolve(sorted.map(cloneRecord));
    },

    // eslint-disable-next-line max-params
    listLatestPaged(
      cursor?: string,
      limit = 20,
      options?: RevealFilterOptions,
    ): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      let cursorPayload: CursorPayload | null = null;
      if (cursor !== undefined) {
        cursorPayload = decodeCursor(cursor);
        if (!cursorPayload) {
          return Promise.reject(new Error("INVALID_CURSOR"));
        }
      }

      const now = options?.now;
      const sorted = [...records]
        // reveal フィルタ（#556）: now が渡された場合、createdAt > now の post を除外する。
        .filter((r) => now === undefined || r.createdAt.getTime() <= now.getTime())
        // eslint-disable-next-line max-params
        .sort((a, b) => {
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
      const last = posts.at(-1);
      const nextCursor = hasMore && last ? encodeCursor(last) : null;

      return Promise.resolve({ posts: posts.map(cloneRecord), nextCursor });
    },

    // eslint-disable-next-line max-params
    listPopularPaged(
      cursor?: string,
      limit = 20,
      options?: RevealFilterOptions,
    ): Promise<{ posts: PostRecord[]; nextCursor: string | null }> {
      let cursorPayload: PopularCursorPayload | null = null;
      if (cursor !== undefined) {
        cursorPayload = decodePopularCursor(cursor);
        if (!cursorPayload) {
          return Promise.reject(new Error("INVALID_CURSOR"));
        }
      }

      const now = options?.now;
      const sorted = [...records]
        // reveal フィルタ（#556）: now が渡された場合、createdAt > now の post を除外する。
        .filter((r) => now === undefined || r.createdAt.getTime() <= now.getTime())
        .sort(comparePopular);

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
      const last = posts.at(-1);
      const nextCursor = hasMore && last ? encodePopularCursor(last) : null;

      return Promise.resolve({ posts: posts.map(cloneRecord), nextCursor });
    },

    getStatsByCommunity(): Promise<Map<string, CommunityPostStats>> {
      const statsMap = new Map<string, CommunityPostStats>();
      for (const record of records) {
        const existing = statsMap.get(record.communityId);
        if (!existing) {
          statsMap.set(record.communityId, {
            postCount: 1,
            lastPostAt: record.createdAt,
          });
        } else {
          existing.postCount += 1;
          if (record.createdAt > existing.lastPostAt!) {
            existing.lastPostAt = record.createdAt;
          }
        }
      }
      return Promise.resolve(statsMap);
    },

    // eslint-disable-next-line max-params
    listTopByCommunity(
      communityId: string,
      params: { since: Date; minScore: number; limit: number },
    ): Promise<PostRecord[]> {
      const { since, minScore, limit } = params;
      const result = records
        .filter(
          (r) =>
            r.communityId === communityId &&
            r.score >= minScore &&
            r.createdAt.getTime() >= since.getTime(),
        )
        // eslint-disable-next-line max-params
        .sort((a, b) => {
          if (a.score !== b.score) return b.score - a.score;
          return b.createdAt.getTime() - a.createdAt.getTime();
        })
        .slice(0, limit)
        .map(cloneRecord);
      return Promise.resolve(result);
    },

    // eslint-disable-next-line max-params
    listRecentByCommunity(communityId: string, since: Date, limit = 100): Promise<PostRecord[]> {
      const result = records
        .filter(
          (r) => r.communityId === communityId && r.createdAt.getTime() >= since.getTime(),
        )
        // eslint-disable-next-line max-params
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
        .map(cloneRecord);
      return Promise.resolve(result);
    },

    // eslint-disable-next-line max-params
    listOldByCommunity(communityId: string, before: Date, limit = 20): Promise<PostRecord[]> {
      const result = records
        .filter(
          (r) =>
            r.communityId === communityId &&
            r.createdAt.getTime() < before.getTime() &&
            r.score >= 0,
        )
        // eslint-disable-next-line max-params
        .sort((a, b) => {
          if (a.score !== b.score) return b.score - a.score;
          return b.createdAt.getTime() - a.createdAt.getTime();
        })
        .slice(0, limit)
        .map(cloneRecord);
      return Promise.resolve(result);
    },

    listByAuthor({ authorId, limit = 20, now }: { authorId: string; limit?: number; now?: Date }): Promise<PostRecord[]> {
      const result = records
        .filter((r) => r.author === authorId)
        .filter((r) => now === undefined || r.createdAt.getTime() <= now.getTime())
        // eslint-disable-next-line max-params
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
        .map(cloneRecord);
      return Promise.resolve(result);
    },

    search({ q, limit = 50, options }: { q: string; limit?: number; options?: RevealFilterOptions }): Promise<PostRecord[]> {
      const lower = q.toLowerCase();
      const now = options?.now;
      const result = records
        .filter((r) => r.title.toLowerCase().includes(lower) || r.text.toLowerCase().includes(lower))
        .filter((r) => now === undefined || r.createdAt.getTime() <= now.getTime())
        // eslint-disable-next-line max-params
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
        .map(cloneRecord);
      return Promise.resolve(result);
    },

    listRelatedByTags({
      communityId,
      tags,
      excludePostId,
      limit,
      options,
    }: {
      communityId: string;
      tags: readonly string[];
      excludePostId: string;
      limit: number;
      options?: RevealFilterOptions;
    }): Promise<PostRecord[]> {
      if (tags.length === 0) return Promise.resolve([]);
      const tagSet = new Set(tags);
      const now = options?.now;
      const result = records
        .filter(
          (r) =>
            r.communityId === communityId &&
            r.id !== excludePostId &&
            r.tags.some((t) => tagSet.has(t)),
        )
        // reveal フィルタ（#1087 / ADR-0034）: now が渡された場合、createdAt > now の post を除外する。
        .filter((r) => now === undefined || r.createdAt.getTime() <= now.getTime())
        // eslint-disable-next-line max-params
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
        .map(cloneRecord);
      return Promise.resolve(result);
    },

    updateTitleAndText({ id, title, text }: { id: string; title: string; text: string }): Promise<PostRecord | null> {
      const record = records.find((r) => r.id === id);
      if (!record) return Promise.resolve(null);
      record.title = title;
      record.text = text;
      return Promise.resolve(cloneRecord(record));
    },
  };
}
