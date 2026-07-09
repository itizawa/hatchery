# 設計書: fix: formatRelativeTime の differenceInDays をタイムゾーン非依存の実装に置き換える (#1043)

## 1. 目的 / 背景

`common/src/logic/formatRelativeTime.ts` の「N日前」分岐は date-fns の `differenceInDays` を使っている。
この関数はローカルタイムゾーンのカレンダー暦日差（DST 考慮）を返すが、他の境界チェック（`diffMs < DAY_MS` /
`diffMs < WEEK_MS`）は UTC ミリ秒差で行っており、計算モデルが一致していない。DST のある環境では両者が
ずれ、「0日前」や「7日前」など誤った表示になり得る（#1016 のセルフレビューで検出）。

JST は DST 非採用のため現行の実害はないが、将来のタイムゾーン拡張に備えて解消する。

## 2. スコープ（やること / やらないこと）

- やる: `differenceInDays(now, target)` を `Math.trunc(diffMs / DAY_MS)` に置き換える。`differenceInDays` の import を削除する。
- やらない: 他の分岐（秒・分・時間・絶対日付表示）のロジック変更、フォーマット文字列の変更。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `formatRelativeTime.ts` から `differenceInDays` の import が削除されている。
2. 「N日前」分岐の計算が `Math.trunc(diffMs / DAY_MS)` になっている。
3. 既存テスト（#1016 の境界テスト含む）が全て緑のまま。
4. DST（夏時間）切り替えを跨ぐケースで、UTC ミリ秒差ベースの一貫した判定になる（回帰テストで検証）。
5. lint 通過。

## 4. 設計方針

`diffMs` は既に算出済みのため、`differenceInHours` と同様に `Math.trunc(diffMs / DAY_MS)` で日数を求める。
これにより日前判定・境界チェックが同一の UTC ミリ秒モデルに統一され、DST の有無に関わらず一貫した結果になる。

## 5. 影響範囲 / 既存への変更

対象ワークスペース: `common` のみ（`common/src/logic/formatRelativeTime.ts` と対応するテスト）。
client / server への直接変更はない（`formatRelativeTime` の呼び出し元の挙動は変わらない）。

## 6. テスト計画（TDD）

- 既存の `formatRelativeTime.test.ts` はそのまま緑を維持することを確認する。
- 新規: DST（America/New_York, 2026-11-01 の fall back）を跨ぐケースで `diffMs` がちょうど `DAY_MS`
  になるよう target/now を設定し、「1日前」が返ることを検証する回帰テストを追加する
  （旧実装では local 暦日差ベースのため「0日前」になってしまうことを事前に確認済み）。

## 7. リスク・未決事項

なし（挙動保存のリファクタ、`priority/low`）。
