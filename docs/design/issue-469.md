# 設計書: generateSlotKey を UTC 基準に統一 (#469)

## 1. 目的 / 背景

`server/src/batch/runCommunityBatch.ts` の `generateSlotKey()` がローカル時刻 API（`getFullYear` 等）を使っているため、実行環境のタイムゾーンによって同一定時の slot_key が異なる値になる。本番（Cloud Run Jobs / Cloud Scheduler）は UTC 動作だが、ローカル開発・テストは JST 等で動くため、Cron 二重発火ガードの一貫性が崩れるリスクがある。

## 2. スコープ（やること / やらないこと）

**やること:**
- `generateSlotKey()` の実装を UTC API（`getUTCFullYear` 等）に変更
- docstring を「UTC 基準」に修正
- `generateSlotKey` 単体のユニットテストを追加（UTC 固定 Date で入力・タイムゾーン非依存の出力を保証）

**やらないこと:**
- 既存 DB に保存済みの slot_key の移行（鍵の生成規則変更のみ）
- その他ファイルの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `generateSlotKey(new Date("2026-06-10T09:30:00Z"))` が `"2026-06-10T09:30"` を返す（UTC ベース）
2. docstring が「UTC 基準」を明記
3. 既存の `slotKey` 注入経路（`deps.slotKey`）は変わらず機能する
4. `pnpm turbo run build test lint` が緑

## 4. 設計方針

変更は `server/src/batch/runCommunityBatch.ts` の `generateSlotKey()` 1 関数のみ。ローカル時刻メソッド 5 つを UTC 版に置き換え、docstring を更新する。

```ts
// before
const year = now.getFullYear();
const month = pad(now.getMonth() + 1);
const day = pad(now.getDate());
const hour = pad(now.getHours());
const minute = pad(now.getMinutes());

// after
const year = now.getUTCFullYear();
const month = pad(now.getUTCMonth() + 1);
const day = pad(now.getUTCDate());
const hour = pad(now.getUTCHours());
const minute = pad(now.getUTCMinutes());
```

## 5. 影響範囲 / 既存への変更

- 対象: `server/src/batch/runCommunityBatch.ts`（`generateSlotKey` 関数のみ）
- テスト: `server/src/batch/runCommunityBatch.test.ts`（`generateSlotKey` 単体テストを追加）
- client / common / docs への変更なし

## 6. テスト計画（TDD で書くテスト一覧）

`describe("generateSlotKey (#469)")` として追加:

1. UTC 固定日時 `2026-06-10T09:30:00Z` → `"2026-06-10T09:30"` を返す
2. UTC 真夜中 `2026-01-01T00:00:00Z` → `"2026-01-01T00:00"` を返す（ゼロ埋め確認）
3. 引数省略時は `new Date()` から生成（現在時刻）される（型レベルの確認）

## 7. リスク・未決事項

- 既存 DB に JST ローカル時刻で保存された slot_key がある場合、UTC に変更後の slot_key と不一致になり二重発火ガードが機能しなくなる可能性がある。ただし Issue 補足「過去レコードはそのまま」とのことなので、スコープ外とする。
