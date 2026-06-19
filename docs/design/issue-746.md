# 設計書: コメントスレッドのコネクター線を Reddit 風にアバター起点のカーブ付き縦線に改善する (#746)

## 1. 目的 / 背景

現在の `CommentCard.tsx` のコネクターラインは `top: 0` から `bottom: 0` までの直線であり、アバターの位置を考慮していない。Reddit 風 UI では縦線がアバターの底辺を起点として始まり、子コメントへ L 字曲線で接続する。本 Issue はその視覚的改善を行う。

## 2. スコープ（やること / やらないこと）

**やること:**
- `CommentCard.tsx` の縦コネクターライン（`depth > 0` 時）の `top` を `30px` に変更
- `depth > 0` の各コメントに L 字曲線コネクター（`borderLeft + borderBottom + borderRadius`）を追加

**やらないこと:**
- `AuthorByline.tsx` や他のコンポーネントの変更
- アニメーションの追加
- コネクター色の変更（`CONNECTOR_COLOR = "divider"` を維持）
- トップレベルコメント（`depth === 0`）への変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `depth > 0` のコメントに `data-testid="comment-l-connector"` の L 字コネクター要素が存在する
2. `depth = 0` のコメントには L 字コネクター要素が存在しない
3. 縦コネクターラインの `top` が `30px`（Avatar 底辺位置）以降（既存テストは引き続き通過）
4. `pnpm turbo run build lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### アバター座標の算出

`AuthorByline.tsx` の Avatar:
- `width: 24, height: 24`
- コンテンツボックスの `py: 0.75`（= 6px top padding）内に配置

アバター底辺 = 6px (padding-top) + 24px (height) = **30px**
アバター中心 = 6px + 12px = **18px**

### 縦コネクターライン（変更）

| プロパティ | 変更前 | 変更後 |
|-----------|--------|--------|
| `top` | `0` | `"30px"` |

### L 字コネクター（新規追加）

```jsx
{depth > 0 && (
  <Box
    data-testid="comment-l-connector"
    aria-hidden="true"
    sx={{
      position: "absolute",
      left: `${indentLeft - 8}px`,  // 縦線と同一 x 位置
      top: 0,
      height: "18px",               // アバター中心まで（6px + 12px）
      width: "16px",                // 縦線位置からアバター左辺まで
      borderLeft: "2px solid",
      borderBottom: "2px solid",
      borderColor: CONNECTOR_COLOR,
      borderRadius: "0 0 0 4px",    // 左下コーナーのみカーブ（右下方向の曲線）
    }}
  />
)}
```

縦コネクターと L 字コネクターの `borderLeft` が同一 x 位置に連続し、視覚的に一本の線として見える。

## 5. 影響範囲 / 既存への変更

対象ワークスペース: **client のみ**
変更ファイル:
- `client/src/components/CommentCard.tsx`
- `client/src/components/CommentCard.test.tsx`（L 字コネクター存在確認テスト追加）
- `e2e/post-thread/usecases.md`（UC-POST-16 追加）

## 6. テスト計画（TDD で書くテスト一覧）

| # | テスト内容 | ファイル | 状態 |
|---|-----------|---------|------|
| 1 | `depth > 0` で `comment-l-connector` 要素が存在する | CommentCard.test.tsx | 追加 |
| 2 | `depth = 0` で `comment-l-connector` 要素が存在しない | CommentCard.test.tsx | 追加 |
| 3 | 既存テスト（comment 本文・author・score・vote ボタン・時刻等）が引き続き通過 | CommentCard.test.tsx | 維持 |

## 7. リスク・未決事項

- CSS-in-JS の実際の見た目は jsdom では確認できない。e2e / 目視確認が必要。
- `indentLeft - 8` 位置は現行コードと同じ計算なので、ピクセルが期待通りに揃う。
