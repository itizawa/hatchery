import { z } from "zod";

import { WORKER_DISPLAY_NAME_MAX_LENGTH, WORKER_IMAGE_URL_MAX_LENGTH } from "./worker.js";

/**
 * post / comment の発言者を画面に表示するための最小ワーカー情報（#479）。
 * フィード / コミュニティフィード / スレッドの各レスポンスに `author_worker` として埋め込み、
 * client がアバター画像 + 表示名を描画するために使う。
 * - ユーザー入力ではなく DB ワーカー由来のため `.max()` は表示崩れ防止の保険として付ける（#91 準拠）。
 */
export const AuthorWorkerSchema = z.object({
  id: z.string().min(1),
  display_name: z.string().min(1).max(WORKER_DISPLAY_NAME_MAX_LENGTH),
  image_url: z.string().url().max(WORKER_IMAGE_URL_MAX_LENGTH).nullable(),
});

export type AuthorWorker = z.infer<typeof AuthorWorkerSchema>;

/** `buildAuthorWorkerResolver` が受け取るワーカーの最小形（id / displayName / imageUrl）。 */
export interface AuthorWorkerSource {
  id: string;
  displayName: string;
  imageUrl?: string | null;
}

/**
 * post / comment の `author` 値（id か displayName）から表示用 {@link AuthorWorker} を解決する
 * 純粋関数を組み立てる（#479・author→Worker 解決は #478 のセマンティクスと整合）。
 *
 * - author をまず **id** で照合し、見つからなければ **displayName** で照合する（id 一致を優先）。
 * - 同名 displayName が複数あるときは先勝ち（最初の 1 件）。
 * - 解決できない author は `undefined` を返す（client 側で生の author 文字列にフォールバックする）。
 *
 * バッチが author に UUID id を保存する新データと、displayName を保存していた旧データの双方を解決する。
 */
export function buildAuthorWorkerResolver(
  workers: readonly AuthorWorkerSource[],
): (author: string) => AuthorWorker | undefined {
  const byId = new Map<string, AuthorWorkerSource>();
  const byDisplayName = new Map<string, AuthorWorkerSource>();
  for (const worker of workers) {
    if (!byId.has(worker.id)) byId.set(worker.id, worker);
    // 同名 displayName は先勝ち。
    if (!byDisplayName.has(worker.displayName)) byDisplayName.set(worker.displayName, worker);
  }

  return (author: string): AuthorWorker | undefined => {
    // id 一致を displayName 一致より優先する。
    const matched = byId.get(author) ?? byDisplayName.get(author);
    if (!matched) return undefined;
    return {
      id: matched.id,
      display_name: matched.displayName,
      image_url: matched.imageUrl ?? null,
    };
  };
}
