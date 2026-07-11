# 設計書: fix: newsコミュニティに残る#927/#1022以前生成の投稿タイトル・本文からはてなブックマークURLをバックフィルで除去する (#1117)

## 1. 目的 / 背景

#927（本文へのURL露出防止）・#1022（タイトルへのURL露出防止）はいずれも「今後の新規生成を防ぐ」プロンプト修正のみを目的とし、既存データの修正（バックフィル）は明示的にスコープ外としていた。

本番 `GET /api/communities/news/feed` を確認したところ、両修正より前に生成された投稿に実際にURLが残存し、現在も本番のフィードに表示され続けていることが Issue 本文で確認されている。

- 本文冒頭にURL露出（#927 クローズ前生成、計5件）: `https://b.hatena.ne.jp/hotentry/...\n\n` で始まる。
- タイトル末尾にURL露出（#1022 クローズ前生成、1件）: `... / https://b.hatena.ne.jp/hotentry/general` で終わる。

修正済みの生成ロジック（#927/#1022）自体には回帰が無いことは Issue 本文で確認済みのため、本 Issue は純粋にデータクリーンアップ（バックフィル）に限定する。

## 2. スコープ（やること / やらないこと）

### やること

- `news` コミュニティの post のうち、本文冒頭にURL行が残っているものからURL行を除去するワンショットスクリプトを追加する。
- `news` コミュニティの post のうち、タイトル末尾に ` / URL` が残っているものからURL部分を除去するワンショットスクリプトを追加する。
- 上記の検出・除去ロジックを `common` の純粋関数として切り出しユニットテストする（#1057 の `isDeadBoringAvatarsWorkerImageUrl` / `cleanupDeadWorkerAvatarUrls.ts` と同じパターン）。
- `PostRepository` にタイトル・本文をまとめて更新する `updateTitleAndText` を追加する（in-memory / Prisma 両実装）。

### やらないこと

- 生成ロジック自体の再修正（#927/#1022 で対応済み・回帰なしを確認済みのため対象外）。
- news 以外のコミュニティのデータ修正（Issue のスコープは news コミュニティのみ）。
- 本文・タイトルの意味内容（要約・コメント部分）の変更（URL部分のみを機械的に除去する）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. 本文が `http(s)://` から始まる post を対象として、先頭のURL行（改行込み）を除去する純粋関数 `stripLeadingUrlLineFromPostText(text: string): string` を `common` に実装する。URLで始まらない本文は変更しない。
2. タイトル末尾が ` / http(s)://...` の形式である post を対象として、その部分を除去する純粋関数 `stripTrailingUrlSuffixFromPostTitle(title: string): string` を `common` に実装する。該当パターンが無いタイトルは変更しない。
3. 上記2関数それぞれに対応する判定関数 `hasLeadingUrlExposure` / `hasTrailingUrlExposure` を `common` に実装し、対象/非対象を判定できる。
4. `PostRepository`（in-memory・Prisma 両実装）に `updateTitleAndText(id, { title, text }): Promise<PostRecord | null>` を追加する。存在しない id は null を返す。
5. `server/src/scripts/backfillNewsPostUrls.ts` に、`CommunityRepository.findBySlug("news")` で community を解決し、対象 community の全 post を走査して上記判定関数に該当する post のみ `updateTitleAndText` で更新するコアロジック `runBackfillNewsPostUrls` を実装する。community が存在しない場合は空の結果を返す。対象0件のときは何もしない。
6. `runBackfillNewsPostUrls` は実際に更新に成功した post の id のみを集計し、`{ updatedCount, updatedIds }` を返す。
7. 本文・タイトルの意味内容（要約・コメント部分）は変更せず、URL部分のみが除去されることをテストで検証する。
8. `tsx` 直接実行時のみ CLI の `main()` が走る（`isDirectRun` パターン、#1057 と同様）。
9. `pnpm turbo run build test lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

#1057（`cleanupDeadWorkerAvatarUrls`）と同一のパターンを踏襲する。

- **common**: 判定・除去ロジックを `common/src/domain/post/post.ts` に純粋関数として追加する（DB非依存・高速にユニットテスト可能）。
- **server（永続化層）**: 新規 DB アクセスは既存の `PostRepository`（永続化層）経由でのみ行う。スクリプト専用の Prisma 直叩きクライアントは作らない（#1057 セルフレビューで指摘された「アーキテクチャ逸脱」を最初から避ける）。
- **server（スクリプト）**: `server/src/scripts/backfillNewsPostUrls.ts` はコアロジック `runBackfillNewsPostUrls(postRepository, communityRepository)` と CLI エントリポイント `main()` を分離する。テストは `createInMemoryPostRepository` / `createInMemoryCommunityRepository` を注入して DB 接続なしで行う。
- **対象 post の取得**: `PostRepository` に新規の全件取得メソッドは追加せず、既存の `listByCommunity(communityId, limit)` を大きめの limit（`Number.MAX_SAFE_INTEGER` 相当ではなく明示的な定数 `BACKFILL_SCAN_LIMIT = 10000`）で呼び出し、news コミュニティの全 post を走査する。件数超過時は取りこぼす可能性があるが、news コミュニティの実データ件数（Issue 本文時点で対象6件、総投稿数もそれよりずっと少ない）を踏まえ実用上十分と判断する。
- **`server/package.json`**: `backfill:news-post-urls` script を追加する（#1057 の `cleanup:worker-avatars` と同じ命名パターン）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- `common`: `common/src/domain/post/post.ts` に関数追加（既存エクスポートの変更なし）。
- `server`: `server/src/persistence/postRepository.ts` / `prismaPostRepository.ts` に `updateTitleAndText` 追加。`server/src/scripts/backfillNewsPostUrls.ts` を新設。`server/package.json` に script 追加。
- `client` / `docs`: 変更なし。

## 6. テスト計画（TDDで書くテスト一覧）

1. `common/src/domain/post/post.test.ts`: `stripLeadingUrlLineFromPostText` / `hasLeadingUrlExposure`（URL行あり・なし・複数行本文でURL行のみ除去・末尾余分な空行が残らないこと）。
2. `common/src/domain/post/post.test.ts`: `stripTrailingUrlSuffixFromPostTitle` / `hasTrailingUrlExposure`（末尾URL付き・末尾URLなし・本文中間にURLを含むタイトルは対象外であること）。
3. `server/src/persistence/postRepository.test.ts`: `updateTitleAndText` の in-memory 実装（更新成功・存在しない id で null）。
4. `server/src/persistence/prismaPostRepository.test.ts`: `updateTitleAndText` の Prisma 実装（更新成功・P2025 で null）。
5. `server/src/scripts/backfillNewsPostUrls.test.ts`: `runBackfillNewsPostUrls`（本文URL露出のみ・タイトルURL露出のみ・両方・対象なし・news以外のコミュニティは対象外・news コミュニティ自体が存在しない場合）。

## 7. リスク・未決事項

- 本番実行は `develop → main` 昇格後に運用者（人間）が `DATABASE_URL` を指定して手動実行する（#1057 と同じ運用）。本 PR ではスクリプトの実装・テストまでを範囲とし、本番実行自体は本 PR のスコープに含めない。
- `BACKFILL_SCAN_LIMIT` は決め打ちの定数だが、news コミュニティの実際の投稿数がこれを超えるほど増えている場合は取りこぼす。現状の実データ規模（Issue 本文記載の対象6件、コミュニティ全体でも高々数百件程度）を踏まえ許容する。
- ユーザー可視の振る舞い変更（データクリーンアップのみ、UI・APIレスポンス形状の変更なし）は無いため `e2e/usecases.md` の更新は不要と判断する（#1057 と同様の判断）。
