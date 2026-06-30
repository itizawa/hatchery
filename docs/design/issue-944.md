# 設計書: HomeFeedScene の IntersectionObserver 無限スクロールのインタラクションテストを追加 (#944)

## 1. 目的 / 背景

`client/src/routes/HomeFeedScene.tsx` は `IntersectionObserver` と `sentinelRef` で無限スクロールを実装しているが、
対応するインタラクションテストが存在しない。番兵要素の交差検知ロジックが壊れても検出できない状態を解消する。

## 2. スコープ（やること / やらないこと）

**やること**:
- `HomeFeedScene.test.tsx` に `IntersectionObserver` 関連テストを追加する（3 ケース）
- `vi.stubGlobal("IntersectionObserver", ...)` で jsdom 上のモックを実施する

**やらないこと**:
- コミュニティフィードの無限スクロールテスト（#881 未実装）
- 実際の IntersectionObserver ブラウザ動作の E2E テスト

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `hasNextPage=true` かつ番兵要素が `isIntersecting=true` で intersect するとき `fetchNextPage` が呼ばれる（cursor=... 付きのフィード API リクエストが発生する）
2. `hasNextPage=false` のとき番兵要素が intersect しても `fetchNextPage` は呼ばれない（cursor=... リクエストが発生しない）
3. `isFetchingNextPage=true` のとき番兵要素が再 intersect しても重複 fetch しない（cursor=... リクエストが 1 回のみ）

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `vi.stubGlobal("IntersectionObserver", vi.fn((callback) => { ... }))` で IntersectionObserver をモック
- callback を変数に保持し、テスト中に `callback([{ isIntersecting: true }])` で手動トリガー
- `hasNextPage` 制御: フィードレスポンスの `nextCursor` で制御（null → false、"cursor1" → true）
- `isFetchingNextPage` 制御: 2 ページ目フェッチを deferred Promise で遅延させ、React re-render 後（新 IntersectionObserver 作成を `waitFor` で確認）に再 intersect

## 5. 影響範囲 / 既存への変更

- **client**: `client/src/routes/HomeFeedScene.test.tsx` にテスト 3 件追加（既存テストへの変更なし）
- server / common / docs: 変更なし

## 6. テスト計画（TDDで書くテスト一覧）

| テスト | 確認内容 |
|--------|----------|
| `hasNextPage=true + intersect → fetchNextPage が呼ばれる` | cursor=... 付きフィード呼び出しが発生 |
| `hasNextPage=false + intersect → fetchNextPage が呼ばれない` | cursor=... 付き呼び出しが 0 件のまま |
| `isFetchingNextPage=true + intersect → 重複 fetch しない` | cursor=... 付き呼び出しが 1 件のみ |

## 7. リスク・未決事項

- jsdom では `IntersectionObserver` がネイティブ実装されていないため、全テストをモックで代替する。ブラウザ実際の Viewport 動作（threshold=0.1）は E2E で検証すべき領域
- `isFetchingNextPage` の状態遷移タイミングはフレームワーク実装依存。`waitFor(() => MockIntersectionObserver.mock.calls.length > N)` で re-render を待つことで安定化させる
- ユーザー可視の振る舞いは変わらないため、`e2e/usecases.md` の更新は不要（PR 本文に明記）
