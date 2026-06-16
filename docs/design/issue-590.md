# 設計書: client の WorkerCommunitiesField のローディング/エラー fallback をテストする (#590)

## 1. 目的 / 背景

`client/src/components/WorkerCommunitiesField.tsx` は `QueryBoundary` で `WorkerCommunitiesFieldInner` を包み、ローディング中は無効化 Select（fallback）、取得失敗時は注意 Alert（errorFallback）を表示する。この境界制御層のテストが存在しないため追加する。

## 2. スコープ（やること / やらないこと）

**やること**:
- `WorkerCommunitiesField.test.tsx` を新設し、3 状態（loading / error / success）を検証する
- `useCommunities` を vi.mock でモックして各状態をシミュレートする

**やらないこと**:
- `WorkerCommunitiesSelect` 内部のテスト（#531 で別途実装済み）
- MSW サーバを使う結合テスト（ユニットレベルで十分）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `(a)` `useCommunities` が Promise を throw する（Suspense 状態）とき、`aria-disabled="true"` の combobox が表示され、fallback Select（無効化済み）が描画される
2. `(b)` `useCommunities` が Error を throw するとき、「参加コミュニティの読み込みに失敗しました。コミュニティの選択はできません。」という Alert テキストが表示される（errorFallback）
3. `(c)` `useCommunities` がコミュニティ配列を返すとき、有効な combobox（`aria-disabled` なし）が描画される（内側の WorkerCommunitiesSelect が表示される）
4. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `vi.mock("../api/communities.js", () => ({ useCommunities: vi.fn() }))` で `useCommunities` をモック
- Suspense 状態: `mockImplementation(() => { throw new Promise(() => {}); })`（永遠に解決しない Promise で Suspense を継続）
- Error 状態: `mockImplementation(() => { throw new Error("fetch failed"); })`（ErrorBoundary を発火）
- Success 状態: `mockReturnValue({ data: [...] })` で通常描画
- `console.error` は `vi.spyOn` で抑制（React/ErrorBoundary がエラーを出すため）

## 5. 影響範囲 / 既存への変更

- **追加のみ**: `client/src/components/WorkerCommunitiesField.test.tsx`（新設）
- 既存コードへの変更なし

## 6. テスト計画

| テスト名 | 検証内容 |
|----------|----------|
| (a) 取得中に無効化された fallback Select が表示される | `aria-disabled="true"` の combobox |
| (b) 取得失敗時に注意 Alert（errorFallback）が表示される | Alert のテキスト確認 |
| (c) 成功時に内側の WorkerCommunitiesSelect が描画される | 有効な combobox が存在する |

## 7. リスク・未決事項

- MUI Select の `FormControl disabled` 伝播により combobox に `aria-disabled="true"` が付くことを前提とする（WorkerCommunitiesSelect.test.tsx の (e) テストで確認済み）
