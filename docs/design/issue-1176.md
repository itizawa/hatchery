# 設計書: server/src/routes の authorWorker/commentCount/communityResponse ヘルパー関数をオブジェクト引数化する (#1176)

## 1. 目的 / 背景

CLAUDE.md「関数引数規約（#720）」は引数2個以上の関数をオブジェクト引数（名前付き引数）に統一するよう定めており、ESLint `max-params: 1` で機械的に強制している。しかし以下の4関数は Express ミドルウェアでも配列コールバックでもないのに位置引数のまま `eslint-disable-next-line max-params` で例外扱いになっている:

- `server/src/routes/authorWorker.ts` の `enrichWith` / `attachAuthorWorker`
- `server/src/routes/commentCount.ts` の `attachCommentCount`
- `server/src/routes/communityResponse.ts` の `toCommunityResponse`

post/comment/community のレスポンス整形・enrich という横断的に呼ばれる経路であるため、規約準拠を徹底する。

## 2. スコープ（やること / やらないこと）

**やること**

- 上記4関数のシグネチャをオブジェクト引数に変更する。
- 呼び出し元（`routes/posts.ts` / `routes/communities.ts` / `routes/feed.ts` / `routes/admin.ts` / `routes/workers.ts` および各 `*.test.ts`）を新シグネチャに追従させる。
- 対象関数の `eslint-disable-next-line max-params` コメントを削除する。

**やらないこと**

- `attachAuthorWorker` / `attachCommentCount` のジェネリクス設計自体の変更（Issue 本文で明記されたスコープ外）。
- レスポンス整形結果（JSON 形状）の変更。
- `toAdminCommunityResponse`（引数1個のため対象外・変更不要）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `enrichWith(records, resolve)` → `enrichWith({ records, resolve })` に変更し、既存の `enrichWith` の振る舞い（author 解決できたレコードのみ `author_worker` 付与）が変わらないこと。
2. `attachAuthorWorker(records, workerRepo)` → `attachAuthorWorker({ records, workerRepo })` に変更し、既存の全テスト（空配列・解決成功・解決失敗混在等）が新シグネチャで緑になること。
3. `attachCommentCount(records, commentRepo, options?)` → `attachCommentCount({ records, commentRepo, options })` に変更し、既存の全テスト（空配列・countByPostIds の呼び出し・options.now 伝播）が新シグネチャで緑になること。
4. `toCommunityResponse(r, stats?, subscriberCount = 0)` → `toCommunityResponse({ r, stats, subscriberCount = 0 })` に変更し、`subscriberCount` の既定値 `0` が維持されること。既存の全テスト（stats 未指定時の 0 埋め・null 正規化等）が新シグネチャで緑になること。
5. `toAdminCommunityResponse` 内部で `toCommunityResponse(r)` を呼んでいる箇所を `toCommunityResponse({ r })` に更新する。
6. 全呼び出し元（`posts.ts` / `communities.ts` / `feed.ts` / `admin.ts` / `workers.ts`）が新シグネチャで呼び出すよう更新され、`pnpm turbo run build test lint` が緑であること。
7. 対象4関数から `eslint-disable-next-line max-params` コメントが削除されていること。

## 4. 設計方針

- 既存のジェネリクス（`<T extends HasAuthor>` 等）はそのまま維持し、引数だけをオブジェクトに包む。TypeScript のオブジェクト引数でジェネリック型推論は問題なく効くため、呼び出し側の型安全性に影響はない。
- `attachCommentCount` の `options` はオブジェクト引数の中でも既定値なしの任意プロパティ（`options?: RevealFilterOptions`）のまま扱う（呼び出し時に省略可能にするため）。
- `toCommunityResponse` の `subscriberCount` はオブジェクト引数の分割代入デフォルト値（`{ subscriberCount = 0 }`）で維持する。
- `enrichWith` は `authorWorker.ts` 内部でのみ使われる非 export 関数のため、呼び出し元は同ファイル内の `buildAuthorWorkerEnricher` のみ。

## 5. 影響範囲 / 既存への変更

対象ワークスペース: **server** のみ（common/client への影響なし）。

- `server/src/routes/authorWorker.ts`（シグネチャ変更）
- `server/src/routes/authorWorker.test.ts`（呼び出し更新）
- `server/src/routes/commentCount.ts`（シグネチャ変更）
- `server/src/routes/commentCount.test.ts`（呼び出し更新）
- `server/src/routes/communityResponse.ts`（シグネチャ変更）
- `server/src/routes/communityResponse.test.ts`（呼び出し更新）
- `server/src/routes/posts.ts`（呼び出し更新）
- `server/src/routes/communities.ts`（呼び出し更新）
- `server/src/routes/feed.ts`（呼び出し更新）
- `server/src/routes/admin.ts`（呼び出し更新）
- `server/src/routes/workers.ts`（呼び出し更新）

## 6. テスト計画（TDD）

既存テストファイルを新シグネチャ呼び出しに書き換える形で TDD を回す:

1. まず `authorWorker.test.ts` / `commentCount.test.ts` / `communityResponse.test.ts` の呼び出しをオブジェクト引数に書き換える（実装はまだ変更しない）→ 型エラー/失敗を確認。
2. `authorWorker.ts` / `commentCount.ts` / `communityResponse.ts` の実装をオブジェクト引数に変更 → テスト緑にする。
3. 呼び出し元（`posts.ts` 等）を新シグネチャに追従。
4. `pnpm --filter @hatchery/server test` / `pnpm --filter @hatchery/server lint` / `pnpm --filter @hatchery/server typecheck` で確認。

## 7. リスク・未決事項

- レスポンス整形結果の JSON 形状は変えないため、client 側・e2e への影響はない（ユーザー可視の振る舞い変更なし）。よって `e2e/usecases.md` の更新は不要。
