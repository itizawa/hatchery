# 設計書: client/src/api/errors.ts・communities.ts の位置引数関数をオブジェクト引数化する (#1177)

## 1. 目的 / 背景

CLAUDE.md「関数引数規約（#720）」は引数 2 個以上の関数をオブジェクト引数に統一するよう定めている。#790 で `client/src/api` の一部関数（`votes.ts`・`views.ts`・`client.ts`）は是正済みだが、`errors.ts`（`getApiErrorMessage` / `buildApiErrorMessage`）と `communities.ts`（`uploadCommunityImage`）は未対応のまま `eslint-disable-next-line max-params` で残っている。特に `uploadCommunityImage(communityId, kind, file)` は呼び出し側でも位置引数のため `communityId` と `kind` の取り違えリスクがある。

## 2. スコープ（やること / やらないこと）

**やること**:
- `client/src/api/errors.ts` の `getApiErrorMessage` / `buildApiErrorMessage` をオブジェクト引数化する。
- `client/src/api/communities.ts` の `uploadCommunityImage` をオブジェクト引数化する。
- 上記の呼び出し元（`client.ts` / `errors.test.ts` / `communities.test.ts` / 各 route コンポーネント）を新シグネチャに追従させる。
- 対象関数の `eslint-disable-next-line max-params` コメントを削除する。

**やらないこと**:
- `uploadCommunityImage` のレスポンス型の変更（Issue 本文で明示的にスコープ外）。
- `errors.ts` / `communities.ts` 以外の位置引数関数の是正（本 Issue のスコープ外）。
- サーバ側 API のオブジェクト引数化。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `getApiErrorMessage({ error, fallback? })` がオブジェクト引数で呼び出せ、既存の挙動（Error インスタンス / `{ error: string }` 形 / null・undefined・不明形 / fallback 指定）を維持する。
2. `buildApiErrorMessage({ errorBody, status, fallback })` がオブジェクト引数で呼び出せ、既存の挙動（`{ error: string }` 優先 / 無ければ `"<fallback> (<status>)"`）を維持する。
3. `uploadCommunityImage({ communityId, kind, file })` がオブジェクト引数で呼び出せ、既存の挙動（multipart POST・成功時レスポンス返却・非 2xx で throw）を維持する。
4. 全呼び出し元（`client.ts` の `unwrap`/`ensureOk`、各 route コンポーネントの `getApiErrorMessage` 呼び出し、`useUploadCommunityImage` の `mutationFn`）が新シグネチャで呼び出されている。
5. 対象 3 関数から `eslint-disable-next-line max-params` が削除されている。
6. `pnpm turbo run build test lint` が緑。

## 4. 設計方針

- #790 の先行パターンに倣い、型は関数シグネチャにインラインのオブジェクト型（`{ error: unknown; fallback?: string }` 等）で定義する（既存 `unwrap`/`ensureOk` と同じスタイル）。
- 呼び出し元のコールサイトはすべてオブジェクトリテラル `{ ... }` に置き換える。振る舞い・戻り値・エラーメッセージ文言は一切変更しない（純粋なシグネチャ変更）。

## 5. 影響範囲 / 既存への変更

対象ワークスペース: **client** のみ（common / server / docs（本設計書除く）は影響なし）。

- `client/src/api/errors.ts`（関数定義）
- `client/src/api/errors.test.ts`（呼び出し元）
- `client/src/api/client.ts`（`buildApiErrorMessage` 呼び出し元 ×2）
- `client/src/api/communities.ts`（関数定義・`useUploadCommunityImage` 呼び出し元）
- `client/src/api/communities.test.ts`（呼び出し元）
- `client/src/routes/AccountScene.tsx` / `AddCommunityScene.tsx` / `AddWorkerScene.tsx` / `EditCommunityScene.tsx` / `EditWorkerScene.tsx`（`getApiErrorMessage` 呼び出し元）

## 6. テスト計画（TDD）

既存の `errors.test.ts` / `communities.test.ts` を新シグネチャ（オブジェクト引数）の呼び出しに書き換え、まず失敗（型エラー / 実装未対応）を確認してから実装を追従させる。アサーション内容（期待するメッセージ文言・戻り値）は変更しない。

## 7. リスク・未決事項

- ユーザー可視の振る舞いは変わらない（内部シグネチャの変更のみ）ため、e2e usecases の更新は不要。PR 本文にその旨を明記する。
