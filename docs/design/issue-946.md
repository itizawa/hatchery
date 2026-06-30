# 設計書: client/src/api/views.ts の usePostViewBeacon / useCommentImpressions フックの単体テストを追加する (#946)

## 1. 目的 / 背景

`client/src/api/views.ts` には `usePostViewBeacon`（マウント時に post 閲覧ビーコンを送信）と `useCommentImpressions`（IntersectionObserver でコメントの可視性を監視してバッチ送信）という 2 つの React フックがある。
`views.test.ts` では生関数（`sendJsonBeacon`・`sendPostViewBeacon`・`sendCommentViewsBeacon`）はテストされているが、`usePostViewBeacon` フックは完全に未テスト。`useCommentImpressions` は一部テストされているが、`observe`/`disconnect` の明示的な検証や既送除外のホックレベル検証が欠けている。

## 2. スコープ（やること / やらないこと）

**やること:**
- `usePostViewBeacon` のフックレベルテスト 2 件を追加
  - マウント時に `sendPostViewBeacon(postId)` が呼ばれる
  - `postId` が変わると再度 beacon が送信される
- `useCommentImpressions` の既存テストを補完
  - `IntersectionObserver.observe` が呼ばれることを明示的に検証
  - `useCommentImpressions` のアンマウント時に `disconnect` が呼ばれることを検証
  - 一度送信済みのコメントがフックレベルで再送されないことを検証

**やらないこと:**
- `sendJsonBeacon`・`sendPostViewBeacon`・`sendCommentViewsBeacon` 生関数の既存テストの変更
- Cloudflare Analytics ビーコン（`useCfPageViewTracking`）のテスト

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `usePostViewBeacon`: マウント時に `sendPostViewBeacon(postId)` が 1 回呼ばれる
2. `usePostViewBeacon`: `postId` が変わると `sendPostViewBeacon` が再度呼ばれる（合計 2 回）
3. `useCommentImpressions`: `commentRef(commentId)(el)` を呼ぶと `IntersectionObserver.observe` が el に対して呼ばれる
4. `useCommentImpressions`: アンマウント時に `IntersectionObserver.disconnect` が呼ばれる
5. `useCommentImpressions`: 一度 dwell 送信済みのコメントが再び visible になっても再送されない
6. `pnpm turbo run test --filter=@hatchery/client` が緑

## 4. 設計方針

- `usePostViewBeacon` テストは `sendPostViewBeacon` を `vi.spyOn` でモックし、`renderHook` + `rerender` で検証する
- `useCommentImpressions` の `observe`/`disconnect` 検証は既存 `MockIntersectionObserver` に `vi.fn()` を追加して明示的に assert する
- 既存のモック構造（`lastObserverCallback`・`observedElements`）は維持しつつ、`disconnectMock` と `observeMock` を追加する

## 5. 影響範囲 / 既存への変更

- 変更対象ワークスペース: `client/`
- 変更ファイル: `client/src/api/views.test.ts`（テスト追加のみ。実装ファイル変更なし）

## 6. テスト計画

| テスト | 検証内容 |
|--------|----------|
| usePostViewBeacon: マウント時に beacon が送信される | renderHook → sendPostViewBeacon が 1 回呼ばれる |
| usePostViewBeacon: postId 変更で再送信される | rerender で postId 変更 → 合計 2 回呼ばれる |
| useCommentImpressions: observe が呼ばれる | commentRef(id)(el) → observer.observe(el) が呼ばれる |
| useCommentImpressions: disconnect が呼ばれる | unmount → observer.disconnect が呼ばれる |
| useCommentImpressions: 既送コメントは再送されない | dwell 後に再 intersect → beacon は追加送信されない |

## 7. リスク・未決事項

- `sendPostViewBeacon` は `usePostViewBeacon` 内部で直接呼ばれるため、モジュールレベルの `vi.spyOn` でモックする必要がある
- `useCommentImpressions` のタイマー制御は `vi.useFakeTimers()` が必須
