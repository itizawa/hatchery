# 設計書: formatRelativeTime / formatAbsoluteTime を date-fns に切り替え、相対表示を秒単位まで対応する (#848)

## 1. 目的 / 背景

`common/src/logic/formatRelativeTime.ts` と `common/src/logic/formatAbsoluteTime.ts` は
手動のミリ秒計算・UTC 日付取得で実装されていた。`date-fns` の採用で保守性を高め、
`formatRelativeTime` が 60 秒未満（1 秒以上）を「たった今」と表示していた問題を解消する。

## 2. スコープ（やること / やらないこと）

### やること
- `date-fns` を `common/package.json` の `dependencies` に追加
- `@date-fns/utc` を合わせて追加（UTC 対応）
- `formatRelativeTime` を `date-fns` + `@date-fns/utc` ベースに再実装（秒単位表示を追加）
- `formatAbsoluteTime` を `date-fns` + `@date-fns/utc` の `format` + `UTCDate` で再実装
- `formatRelativeTime.test.ts` を更新（「N秒前」ケースを追加）

### やらないこと
- 分+秒の組み合わせ表示（「1分30秒前」等）
- `formatAbsoluteTime` の出力仕様変更
- client / server への `date-fns` 直接依存追加（common 経由を継続）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `date-fns` と `@date-fns/utc` が `common/package.json` の `dependencies` に存在する
2. `formatRelativeTime` の仕様:
   - `diffMs <= 0`（未来）または `diffMs < 1_000`（1 秒未満）→ `"たった今"`
   - `1_000 <= diffMs < 60_000`（1〜59 秒）→ `"N秒前"`
   - `60_000 <= diffMs < 3_600_000`（1〜59 分）→ `"N分前"`（端数切り捨て）
   - `3_600_000 <= diffMs < 86_400_000`（1〜23 時間）→ `"N時間前"`（端数切り捨て）
   - `86_400_000 <= diffMs` → `"YYYY/M/D"`（UTC 基準）
   - 不正な Date（NaN）→ `""`
3. `formatAbsoluteTime` の出力仕様は変更なし（`"YYYY/M/D H:MM:SS"` 形式・UTC 基準）
4. `formatRelativeTime.test.ts` に「N秒前」・「0秒・未来は たった今」ケースが網羅されている
5. `formatAbsoluteTime.test.ts` の既存テストが全件通る
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### date-fns の使用方法

- `formatRelativeTime`: `differenceInSeconds`, `differenceInMinutes`, `differenceInHours` を `date-fns` から import して単位ごとの差分計算に使用
- `formatAbsoluteTime` + `formatRelativeTime` の絶対日付部分: `format` from `date-fns` + `UTCDate` from `@date-fns/utc` で UTC 基準フォーマット

```typescript
// formatRelativeTime.ts
import { differenceInSeconds, differenceInMinutes, differenceInHours, format } from "date-fns";
import { UTCDate } from "@date-fns/utc";

// formatAbsoluteTime.ts
import { format } from "date-fns";
import { UTCDate } from "@date-fns/utc";
```

### UTCDate の役割

`UTCDate` は `Date` のサブクラスで、`getFullYear()`/`getMonth()` 等のローカル時刻メソッドが
UTC 値を返すように振る舞う。`format(new UTCDate(date), pattern)` とすることで
`date-fns` の `format` が UTC 基準でフォーマットを行う。

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|----------|
| `common/package.json` | `date-fns` + `@date-fns/utc` を `dependencies` に追加 |
| `common/src/logic/formatRelativeTime.ts` | `date-fns` + `@date-fns/utc` ベースに再実装・秒単位追加 |
| `common/src/logic/formatAbsoluteTime.ts` | `date-fns` + `@date-fns/utc` ベースに再実装（出力仕様変更なし） |
| `common/src/logic/formatRelativeTime.test.ts` | 秒単位のテストケースを追加・「たった今」の閾値を 1 秒未満に更新 |

client / server には変更なし（common 経由で引き続き利用）。

## 6. テスト計画（TDDで書くテスト一覧）

`formatRelativeTime.test.ts`:
- `diffMs < 1_000` の境界値（0ms, 999ms）→ "たった今"
- 未来の日時 → "たった今"
- 1 秒（1000ms）→ "1秒前"
- 30 秒（30000ms）→ "30秒前"
- 59 秒（59000ms）→ "59秒前"
- 60 秒（60000ms）→ "1分前"
- 1 分 30 秒（90000ms）→ "1分前"（端数切り捨て）
- 59 分（3540000ms）→ "59分前"
- 1 時間（3600000ms）→ "1時間前"
- 23 時間（82800000ms）→ "23時間前"
- 24 時間（86400000ms）→ "YYYY/M/D"
- NaN → ""

## 7. リスク・未決事項

- `@date-fns/utc` の `UTCDate` は `date-fns` v3+ と互換。pnpm の peer deps 解決を要確認。
- `format` の `"yyyy/M/d"` トークンが期待通りにゼロパディングなしで出力することをテストで確認。
