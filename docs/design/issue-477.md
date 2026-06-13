# Issue #477 設計書: community 詳細サイドバーの作成日が「NaN年NaN月NaN日 作成」になる

## 背景・症状

develop 環境 `/communities/hatchery` のコミュニティ詳細右サイドバーで作成日が
**「NaN年NaN月NaN日 作成」** と表示される。観察エンタメとして毎回目に入る位置で「NaN」が
出ており、壊れている印象を与える。

## 原因（2 層）

### (a) サーバ: 公開 `GET /api/communities` が contract 違反のフィールド名で返している（根本原因）

- 公開ルート `server/src/routes/communities.ts` の `GET /` は `communityRepo.list()` の結果
  （`CommunityRecord`）を**そのまま** `res.json()` している。`CommunityRecord` は camelCase の
  `createdAt`（`server/src/persistence/communityRepository.ts:16`）。
- 一方 OpenAPI 契約（`common` の `CommunitySchema`）は **snake_case の `created_at`** を宣言
  （`common/src/domain/community/community.ts:49`）。client の `Community` 型は
  `components["schemas"]["Community"]` 由来で `created_at` を期待する。
- admin ルートは `toCommunityResponse`（`server/src/routes/admin.ts:24-34`）で
  `createdAt → created_at` に変換しているが、**公開ルートは変換していない**。
- 結果、client は `community.created_at` が `undefined` のオブジェクトを受け取り、
  `new Date(undefined)` → `Invalid Date` → `getUTCFullYear()` 等が `NaN` を返す。
- `CommunityScene` / `PostThreadScene` どちらも `usePublicCommunities()`（= `GET /api/communities`）
  からサイドバーの community を取得するため、両画面で NaN が出る。

### (b) client: `formatCreatedAt` が不正日付をガードしていない（防御不足）

- `client/src/components/CommunitySidebarCard.tsx` の `formatCreatedAt(dateStr)` は
  `new Date(dateStr)` の妥当性を検証せず `getUTCFullYear()` 等を呼ぶため、
  `undefined`/空文字/不正値で「NaN年NaN月NaN日 作成」を生成する。

## 方針

両層を直す。(a) で「正しい日付が表示される」（受け入れ条件 3）を満たし、(b) で
「二度と NaN を出さない」防御（受け入れ条件 1）を担保する。

## 変更内容

### サーバ (a)

- `server/src/routes/communities.ts` の `GET /` で `CommunityRecord[]` を OpenAPI 契約
  （snake_case）に変換してから返す。admin の `toCommunityResponse` 相当の整形を行う
  （`synopsis`/`last_slot_key` も `null → undefined`、`createdAt → created_at`）。
- 変換は共有関数に切り出して admin と公開ルートで重複を避ける。
  `server/src/routes/communityResponse.ts` に `toCommunityResponse(r: CommunityRecord)` を新設し、
  admin ルートのローカル関数もこれに置き換える。

### client (b)

- `formatCreatedAt(dateStr: string | undefined)` を、`new Date(...)` が `Invalid Date`
  もしくは `dateStr` が falsy のとき `null` を返すよう変更する。
- カード側は `formatCreatedAt(...)` が `null` のとき**作成日行を描画しない**（Issue の
  「作成日行を非表示にする」フォールバックを採用）。正常値のときのみ
  「YYYY年M月D日 作成」を表示する。

## 受け入れ条件 → 入出力（テスト）

1. **client ガード**（`CommunitySidebarCard.test.tsx`）:
   - `created_at` が `undefined` のとき「作成」テキストを一切描画しない（`/作成/` が無い）。
   - `created_at` が不正値（例 `"not-a-date"`）のときも同様に描画しない。
   - 既存「`2026年6月1日 作成`」表示テストは緑のまま。
2. **CommunityScene 経由**（`CommunityScene.test.tsx`）: 既存
   「サイドバーに `2026年6月1日 作成`」テストが緑。
   **PostThreadScene** の既存「`2026年6月1日 作成`」テストも緑のまま。
3. **実 API（サーバ整形）**（`communities.test.ts`）: `GET /api/communities` のレスポンスが
   `created_at`（snake_case）を含み、camelCase の `createdAt` は含まない。これにより client が
   正しい日付を表示できる。
4. `pnpm turbo run build test lint` が緑（typecheck/lint も）。

## スコープ外

- 作成日の相対表記（「3日前」等）。
- 公開ルートの他フィールドのレスポンス整形仕様変更（既存の `feed`/`recent-workers` 等は対象外）。

## e2e ユースケース

ユーザー可視の振る舞い（サイドバーの作成日表示）が「壊れている → 正しく出る」に変わるため、
`e2e/community/usecases.md` の UC-COMM-03 に「サイドバーに作成日が正しく（NaN にならず）表示される」
旨を明記する。エリア一覧 `e2e/usecases.md` のサマリは UC 範囲が変わらない（既存 UC の期待動作の精緻化）
ため件数行は変更しない。
