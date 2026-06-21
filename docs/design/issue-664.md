# 設計書: トークン使用量を金額換算（$）し管理画面でグラフ可視化する (#664)

## 1. 目的 / 背景

Issue #663 でトークン使用量の記録基盤（TokenUsageLog）が実装済みで、管理画面に生トークン数が表示される状態になった。
本 Issue では記録済みデータをモデル別単価で金額換算し、合計コスト・日別コスト推移グラフを管理画面に追加して
実コスト監視・モデル切替判断をできる状態にする。

## 2. スコープ（やること / やらないこと）

**やること:**
- モデル別単価テーブル定数と `calculateCostUsd` 純粋関数を `common` に追加
- `TokenUsageSummary` に `totalCostUsd` を追加
- `GET /admin/token-usage` レスポンスの `summary` に `totalCostUsd` を含める
- 管理画面トークン使用量タブに合計コスト表示を追加
- 日別コスト推移バーチャートを追加（既存テーブルは残す）

**やらないこと:**
- 予算アラート・閾値通知
- CSV エクスポート
- 為替換算（JPY）
- コミュニティ別/ワーカー別コスト按分

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `calculateCostUsd({ model: "claude-sonnet-4-6", inputTokens: 1_000_000, outputTokens: 1_000_000 })` → `18`（$3 + $15）
2. `calculateCostUsd({ model: "claude-haiku-4-5", inputTokens: 1_000_000, outputTokens: 1_000_000 })` → `6`（$1 + $5）
3. 未知モデルは `0` を返す（既存のトークン数表示を壊さない）
4. `TokenUsageSummary.totalCostUsd` が `summarize()` から返される
5. `GET /admin/token-usage` の `summary` に `totalCostUsd` が含まれる
6. 管理画面トークン使用量タブに `$X.XXXXXX` 形式でコストが表示される
7. 日別コスト推移バーチャートが描画される（`data-testid="daily-cost-bar"` 要素）
8. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### 単価テーブルと計算ロジック（common）

`common/src/domain/tokenUsageLog/tokenPricing.ts` に配置。純粋関数で依存なし。
1M トークンあたりの単価（per-MTok）で管理し、トークン数を割ることで cost を算出。

```
costUsd = (inputTokens × inputPerMToken + outputTokens × outputPerMToken) / 1_000_000
```

### API 拡張（server）

- `TokenUsageSummary` インターフェースに `totalCostUsd: number` を追加
- InMemory 実装: ログ全件の `calculateCostUsd` を合計
- Prisma 実装: `groupBy(model)` で集計後、モデル別にコスト計算して合計（単一クエリ）
- OpenAPI スキーマ: `TokenUsageSummaryComponent` に `totalCostUsd` フィールドを追加

### フロントエンド（client）

- `TokenUsageSummary` 型と Zod スキーマに `totalCostUsd: number` を追加
- `TokenUsageTabInner` に合計コスト表示（`$X.XXXXXX` 形式）を追加
- 日別コストバーチャート（`DailyCostBarChart`）を追加（外部ライブラリなし・SVG/MUI Box のみ）
  - `logs` データを日付 `YYYY-MM-DD` でグループ化し `calculateCostUsd` を合算
  - バーの高さは最大コストに対する相対値（100px ベース）
  - `aria-label` と `data-testid` でテスト可能

## 5. 影響範囲 / 既存への変更

| ワークスペース | ファイル | 変更種別 |
|---|---|---|
| common | `src/domain/tokenUsageLog/tokenPricing.ts` | 新規 |
| common | `src/domain/tokenUsageLog/index.ts` | export 追加 |
| server | `src/persistence/tokenUsageLogRepository.ts` | `TokenUsageSummary` に `totalCostUsd` 追加 |
| server | `src/persistence/prismaTokenUsageLogRepository.ts` | `summarize()` を `groupBy` で拡張 |
| server | `src/openapi/registrations/registerAdmin.ts` | スキーマに `totalCostUsd` 追加 |
| client | `src/api/tokenUsage.ts` | 型・スキーマ拡張 |
| client | `src/routes/SettingsScene.tsx` | コスト表示・グラフ追加 |

## 6. テスト計画

| テストファイル | 内容 |
|---|---|
| `common/src/domain/tokenUsageLog/tokenPricing.test.ts` | 単価テーブル定数、各モデルの計算結果、未知モデル、境界値 |
| `server/src/persistence/tokenUsageLogRepository.test.ts` | `summarize()` が `totalCostUsd` を含む |
| `server/src/routes/token-usage.test.ts` | API レスポンスの `summary.totalCostUsd` |
| `client/src/api/tokenUsage.test.ts` | `fetchTokenUsage` が `totalCostUsd` をパース・返す |
| `client/src/routes/SettingsScene.test.tsx` | コスト表示・グラフ要素の描画確認 |

## 7. リスク・未決事項

- 単価は将来変動する可能性あり → 1 ファイルに集約して対応
- Prisma `groupBy` はログが多いと遅くなる可能性 → 現時点では問題ないが、必要なら日次集計テーブルで対応（別 Issue）
- `totalCostUsd` は `float` 精度の誤差がある → 表示は小数点 6 桁で十分
