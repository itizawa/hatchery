# 設計書: client/src/api/views.ts の閲覧ビーコンにユニットテストを追加する (#783)

## 1. 目的 / 背景

`client/src/api/views.ts`（#665 / ADR-0032 の閲覧ビーコン実装）はテストが存在しない唯一のモジュールである。閲覧数計測（ランキングの土台）のリグレッションを検知できるよう、各関数・フックの主要分岐をユニットテストで固定する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `sendJsonBeacon` の 3 分岐（sendBeacon 成功 / sendBeacon false 返却 / sendBeacon 非対応）
- `getOrCreateSessionId` の動作（同一セッション同 ID / sessionStorage 例外時フォールバック）を exported API 経由で間接検証
- `sendCommentViewsBeacon` の dedup ロジック（未送コメントのみ送信 / 全送済みなら送信なし）
- `useCommentImpressions` の dwell タイマー・可視解除・sendBeacon 送信

**やらないこと:**
- サーバ側の閲覧集計ロジックのテスト
- `sendPostViewBeacon` / `usePostViewBeacon` の E2E テスト

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `client/src/api/views.test.ts` を新設する
2. `sendJsonBeacon` テスト（`sendPostViewBeacon` 経由）:
   - (a) `navigator.sendBeacon` が `true` を返すとき `fetch` を呼ばない
   - (b) `sendBeacon` が `false` を返すとき `fetch(keepalive)` にフォールバックする
   - (c) `navigator.sendBeacon` が未定義の環境で `fetch(keepalive)` を使う
3. `getOrCreateSessionId` テスト（`sendPostViewBeacon` 経由）:
   - 同一セッションで 2 回呼んでも同じ sessionId が beacon body に含まれる
   - `sessionStorage` が例外を投げても beacon が送信される（ID は都度生成）
4. `sendCommentViewsBeacon` テスト:
   - 既送済みコメントを除外し、未送のみ送信する
   - 全て既送なら何も送らない（sendBeacon も fetch も呼ばれない）
5. `useCommentImpressions` テスト:
   - 要素が可視になり dwell(1s) 経過後に未送コメントが送信される（fake timers）
   - 可視解除でタイマがクリアされ、dwell 後も送信されない
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **テスト環境**: jsdom（既存の vitest 設定） + fake timers（`vi.useFakeTimers()`）
- **navigator モック**: `vi.stubGlobal("navigator", { sendBeacon: mockFn })` で制御
- **sessionStorage モック**: `vi.spyOn(Storage.prototype, "getItem/setItem")` or jsdom 標準 storage を直接操作（`sessionStorage.clear()`）
- **IntersectionObserver モック**: setup.ts の no-op スタブを overwrite し、コールバックを手動トリガーできるファクトリーパターンを採用
- **fetch モック**: `vi.stubGlobal("fetch", vi.fn())` で制御（votes.test.ts と同パターン）

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client）

- **新規**: `client/src/api/views.test.ts`
- **既存への変更なし**: `views.ts` 自体は修正しない

## 6. テスト計画（TDD で書くテスト一覧）

| テスト | 検証内容 |
|--------|----------|
| sendBeacon が true → fetch 呼ばれない | `vi.stubGlobal("navigator", { sendBeacon: vi.fn().mockReturnValue(true) })` |
| sendBeacon が false → fetch keepalive フォールバック | `mockReturnValue(false)` + fetch spy |
| sendBeacon 未対応 → fetch keepalive | `navigator` に sendBeacon を含めない |
| 同一セッション同 ID | sendBeacon mock で 2 回分のコール引数を比較 |
| sessionStorage 例外 → ID 生成継続 | `vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error() })` |
| 未送コメントのみ送信 | 既読マーク後に再度 sendCommentViewsBeacon |
| 全送済み → 送信なし | sendBeacon / fetch 呼ばれないことを assert |
| dwell 経過 → 送信 | fake timer + IntersectionObserver コールバック手動トリガー |
| 可視解除 → タイマクリア → 送信なし | intersecting=false エントリをトリガー後 advanceTimersByTime |

## 7. リスク・未決事項

- `IntersectionObserver` の jsdom 未実装をどう扱うか: setup.ts の no-op スタブを each テストで上書きする手法を採用（`beforeEach` で置き換え・`afterEach` で戻す）
- fake timers と async レンダリングの組み合わせ: `vi.runAllTimers()` + `await act()` を使う
