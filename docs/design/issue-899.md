# 設計書: e2e/community の UC-COMM-16 を Playwright テストとして実装する (#899)

## 1. 目的 / 背景

`e2e/community/community.spec.ts` の `test.todo("UC-COMM-16: ...")` を実際の Playwright テストとして実装する。
対応機能（#748: vote 連打防止）は実装済みだが、コミュニティフィードでの e2e 検証が存在しない。
ホームフィード側の UC-HOME-20（#896 で実装済み）と対称的な検証を追加し、リグレッション検知を可能にする。

## 2. スコープ（やること / やらないこと）

### やること
- `test.todo("UC-COMM-16: ...")` を実際のテストに変換する
- コミュニティフィード（`/communities/$slug`）でvote ミューテーション進行中に vote ボタンが disabled になることを検証
- ミューテーション完了後にボタンが再有効化されることを検証

### やらないこと
- ホームフィード側の修正（#896 で完了済み）
- vote 機能自体の実装変更
- 他の UC-COMM-XX テストの追加

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `e2e/community/community.spec.ts` の `test.todo("UC-COMM-16: ...")` が実テストになっている
2. コミュニティフィードの投稿カードで vote ミューテーション進行中に vote ボタンが disabled になる
3. API 応答後にボタンが再び有効になる
4. `e2e/community/usecases.md` の UC-COMM-16 定義と整合している

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 実装パターン（UC-HOME-20 を参照）

UC-HOME-20 の実装（`e2e/home-feed/home-feed.spec.ts`）のパターンをコミュニティフィードに適用する:

1. `page.route("**/api/posts/*/vote", ...)` で vote API を pending 状態（Promise 未解決）にする
2. ログイン済みユーザーとして `/communities/$slug` を開く（UC-COMM-16 前提条件: ログイン済み）
3. up vote ボタンをクリック → `waitForRequest` で route handler が実行されるまで待つ
4. `expect(upVoteButton).toBeDisabled()` で disabled を確認
5. Promise を resolve → `expect(upVoteButton).not.toBeDisabled()` で再有効化を確認

### 追加するモックデータ

既存の `MOCK_POST` に `my_vote: null` を追加したバリアント（community spec 内で vote テスト専用に定義）:
```ts
const MOCK_POST_FOR_VOTE = { ...MOCK_POST, my_vote: null };
```

### コミュニティページ固有の考慮

- コミュニティフィードは `/communities/$slug` であり、vote API は home-feed と同じ `**/api/posts/*/vote` を使用
- ログイン済み状態: `mockAuthenticated` を使用
- 投票後のレスポンスは `{ ...MOCK_POST, score: 4, my_vote: "up" }` 形式

## 5. 影響範囲 / 既存への変更

対象ワークスペース: **e2e のみ**（client / server / common / docs に変更なし）

変更ファイル:
- `e2e/community/community.spec.ts`: `test.todo` → 実テストに変換（1 テスト追加）

## 6. テスト計画

### 実装するテスト

| テスト | 検証内容 |
|--------|----------|
| UC-COMM-16: vote ミューテーション進行中はコミュニティフィードの vote ボタンが disabled になる | vote 中は disabled、完了後は enabled |

### 実行コマンド

```bash
pnpm --filter @hatchery/e2e test -- --grep "UC-COMM-16"
```

ただし e2e テストはサーバー起動が必要なため、ローカル実行は限定的。テストコードの論理的な正しさを重視する。

## 7. リスク・未決事項

- e2e テストは実 UI（開発サーバー + バックエンド）が必要なため、CI 環境での動作確認が本番確認になる
- UC-HOME-20 と同一パターンを採用するため、リスクは最小
