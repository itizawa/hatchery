# 設計書: generateSlotKey を UTC 基準に統一し Cron 二重発火ガードの一貫性を保証する (#469)

## 1. 目的 / 背景

`server/src/batch/runCommunityBatch.ts` の `generateSlotKey()` は `getFullYear` / `getMonth` / `getDate` / `getHours` / `getMinutes` を使っており、実行マシンのローカルタイムゾーンに依存したslot_keyを生成する。

本番（Cloud Run Jobs / Cloud Scheduler）はUTCで動作するが、ローカル開発・テストはJST等で動くため、「同一の定時」が環境によって異なるslot_keyを生む可能性がある。これによりCron二重発火ガードが意図通り機能しないリスクがある。

slot_key生成をUTC基準に統一し、実行環境のタイムゾーンに依存せず同一定時が同一slot_keyになることを保証する。

## 2. スコープ（やること / やらないこと）

**やること**
- `generateSlotKey()` の内部実装を `getUTCXxx()` メソッドに変更
- JSDocコメントを「UTC基準」に修正
- `generateSlotKey` のユニットテストを追加（UTC期待値で検証）

**やらないこと**
- 既存DBに保存済みのslot_keyの移行（鍵の生成規則変更のみ、過去レコードはそのまま）
- `deps.slotKey` 注入経路の変更（テスト用注入は従来通り）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `generateSlotKey()` が `getUTCFullYear` / `getUTCMonth` / `getUTCDate` / `getUTCHours` / `getUTCMinutes` を使うこと
2. JSDocコメントが「UTC基準」になっていること
3. UTC時刻で固定した `Date` オブジェクトを渡したとき、期待するUTC "YYYY-MM-DDTHH:MM" 文字列を返すテストが通ること
4. 月・日・時・分の0埋めが正しいこと（1桁→2桁）
5. `deps.slotKey` を明示注入した既存テストが引き続き動作すること
6. `pnpm turbo run build test lint`（serverワークスペース）が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

変更は `server/src/batch/runCommunityBatch.ts` の `generateSlotKey()` 関数のみ。

```ts
// before
export function generateSlotKey(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

// after
export function generateSlotKey(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const year = now.getUTCFullYear();
  const month = pad(now.getUTCMonth() + 1);
  const day = pad(now.getUTCDate());
  const hour = pad(now.getUTCHours());
  const minute = pad(now.getUTCMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}
```

JSDocコメントも「ローカル時刻基準」→「UTC基準」に修正。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- `server/src/batch/runCommunityBatch.ts` — `generateSlotKey` 実装とJSDoc
- `server/src/batch/runCommunityBatch.test.ts` — `generateSlotKey` のユニットテスト追加（importを更新）

## 6. テスト計画（TDDで書くテスト一覧）

`runCommunityBatch.test.ts` に `describe("generateSlotKey")` ブロックを追加:

| # | テスト内容 | 入力 | 期待値 |
|---|-----------|------|--------|
| 1 | UTC時刻を正しくフォーマット | `new Date("2026-01-15T03:05:00Z")` | `"2026-01-15T03:05"` |
| 2 | 月・日・時・分の0埋め | `new Date("2026-01-01T00:00:00Z")` | `"2026-01-01T00:00"` |
| 3 | 年末 23:59 UTC | `new Date("2026-12-31T23:59:00Z")` | `"2026-12-31T23:59"` |
| 4 | 引数省略時はエラーを投げない（型チェックのみ） | 引数なし | 文字列を返す |

## 7. リスク・未決事項

- 本番環境（Cloud Run Jobs）がUTCで動いているため、実質的な動作変化はない見込み
- ローカル開発者がJSTで動かしている場合、slot_keyが変わるが、それが本来期待される正しい挙動
