# 設計書: vote ウィジェットを投票済みで塗りつぶし表示にし up/down 排他を UI で明示する (#813)

## 1. 目的 / 背景

`VoteControl` コンポーネントは現状、投票済みをアイコン文字色（up=primary / down=error）でのみ区別している。視覚的に分かりにくく「両方押せる」誤解を生む。Box 背景の塗りつぶしで投票済みを明示し、up/down 排他をテストで担保する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `VoteControl.tsx`: `currentVote` に応じた Box 背景塗りつぶしスタイルを追加（up=primary 色、down=error 色、null=透明）
- 塗りつぶし時の内部アイコン・数字を白（contrastText）表示
- `VoteControl.test.tsx`: 排他性テスト・塗りつぶし状態テストを追加
- `e2e/home-feed/usecases.md`: vote 済み塗りつぶし表示のユースケースを追記

**やらないこと:**
- common / server / OpenAPI スキーマの変更
- vote 件数表示の変更（up 件数化は #814 で対応）
- vote ボタンのツールチップ（#755）
- ゲスト vote の変更（#777）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `currentVote === "up"` のとき Box 背景が primary 色で塗りつぶされる（`data-voted="up"` 属性 or class で検証）
2. `currentVote === "down"` のとき Box 背景が error 色で塗りつぶされる（`data-voted="down"` 属性 or class で検証）
3. `currentVote === null` のとき Box が透明（voted なし）である
4. `currentVote="up"` のとき: up ボタンのみ `aria-pressed="true"`、down ボタンは `aria-pressed="false"`
5. `currentVote="down"` のとき: down ボタンのみ `aria-pressed="true"`、up ボタンは `aria-pressed="false"`
6. 既存テストが全て緑のまま

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **Box の `data-voted` 属性で状態管理**: `data-voted={currentVote ?? "none"}` を Box に付与。sx は `currentVote` で条件分岐しスタイルを適用。
- **塗りつぶし状態のスタイル**: `bgcolor: currentVote === "up" ? "primary.main" : currentVote === "down" ? "error.main" : "transparent"` で Box 背景を制御。
- **テキスト/アイコン色**: 塗りつぶし時は `color: "primary.contrastText"` 相当で白系統にする。具体的には Box の `color` プロパティでコンテナ全体に白色を適用し、内部のアイコン・数字を一括で上書き。
- **排他担保**: `currentVote` は `"up" | "down" | null` の単一値。「同時に両方が active」は型レベルで不可能。テストで `currentVote="up"` → down が `aria-pressed="false"` を明示検証。
- **アクセシビリティ**: 各ボタンの `aria-pressed` は現状仕様を維持（active のみ `true`）。

## 5. 影響範囲 / 既存への変更

- **client のみ**:
  - `client/src/components/VoteControl.tsx`: スタイル変更（Box に `data-voted` + 塗りつぶし bgcolor）
  - `client/src/components/VoteControl.test.tsx`: 排他性テスト・塗りつぶし状態テストを追加
  - `e2e/home-feed/usecases.md`: UC-HOME-21 を追加
  - `e2e/usecases.md`: home-feed サマリに UC-HOME-01〜21 を更新

## 6. テスト計画（TDD で書くテスト一覧）

| テスト | 説明 |
|--------|------|
| `currentVote="up"` のとき Box に `data-voted="up"` が付く | 塗りつぶし状態の検証 |
| `currentVote="down"` のとき Box に `data-voted="down"` が付く | 塗りつぶし状態の検証 |
| `currentVote=null` のとき Box に `data-voted="none"` が付く | 透明表示の検証 |
| `currentVote="up"` のとき up のみ active で down は非 active | 排他性の検証（受け入れ条件 4） |
| `currentVote="down"` のとき down のみ active で up は非 active | 排他性の検証（受け入れ条件 5） |

## 7. リスク・未決事項

- MUI の `sx` による `bgcolor` は jsdom ではスタイル値として取得できないため、`data-voted` 属性で状態を検証する（スタイル値の直接テストは避ける）。
- 塗りつぶし時の `color: "primary.contrastText"` は MUI テーマ依存。jsdom ではテーマ色の実値取得が困難なため、色の直接検証はせず `data-voted` 属性で代替。
