# Issue #280 設計書: 仮想オフィスをレスポンシブ化し、横スクロールなしで表示領域に収める

## 背景・目的

仮想オフィス（`/office`）は固定サイズ `OFFICE_BOUNDS = { width: 800, height: 500 }` で描画されており、
コンテナ（`main`）幅が 800px 未満だと `OfficeScene` の `overflowX: "auto"` により内部横スクロールが発生する。
本 Issue では、仮想オフィス領域をコンテナ幅に追従するレスポンシブ表示にし、デスクトップ・モバイル
（ドロワー時・#190）いずれでも横スクロールなしで表示領域に収まるようにする。

## 方針

Issue 補足の選択肢 (a)「実コンテナ幅を測って動的 bounds として渡す」を採用する。
理由: テスト容易性（bounds 算出を純粋関数に寄せられる）と座標破綻の少なさ（論理座標とスケール座標の二重管理を避ける）。

- アスペクト比は現行の `800:500`（= 16:10）を維持する。
- bounds の `width` はコンテナ実幅にフィットさせ、上限 `OFFICE_BOUNDS.width`(=800) でクランプする。
- `height` は `width` からアスペクト比で算出する。
- コンテナ実幅は `ResizeObserver` で測定し、リサイズに追従する。
- bounds が変わったとき、既存キャラクターの座標は新 bounds 内に `clampPosition` で収め、領域外（特に右端）の見切れを防ぐ。

## 変更内容

### 1. `client/src/utils/office.ts`（純粋関数の追加）

bounds 算出ロジックを純粋関数として追加し、テスト可能にする。

```ts
export const OFFICE_MAX_BOUNDS: Bounds = { width: 800, height: 500 };

// コンテナ実幅から、上限 800・アスペクト比 800:500 維持の bounds を算出する
export function officeBounds(containerWidth: number, maxBounds?: Bounds): Bounds;
```

仕様（入出力）:

- `containerWidth >= 800` → `{ width: 800, height: 500 }`（上限でクランプ）。
- `0 < containerWidth < 800` → `{ width: containerWidth, height: containerWidth * (500/800) }`。
- `containerWidth <= 0`（測定前など） → `{ width: 0, height: 0 }`（呼び出し側で描画を抑制）。
- `width` は小数を含みうるが、CSS 上は問題ない。`height` はアスペクト比から算出。

### 2. `client/src/components/OfficeView.tsx`

- `OFFICE_BOUNDS` 固定値の代わりに、コンテナ要素の実幅を `ResizeObserver` で測定し、
  `officeBounds(measuredWidth)` で動的 bounds を算出する。
- ルート `Box` の `width` は `"100%"`（上限 `maxWidth: OFFICE_MAX_BOUNDS.width`）、
  `height` は動的 bounds の `height`（測定済みのとき）。`aspectRatio` で高さを安定させる。
- キャラクター初期化は最初の測定後（bounds 確定後）に行う。bounds 変化時は既存座標を `clampPosition` で収める。
- `nextPosition` / `randomPosition` には動的 bounds を渡す。
- `prefers-reduced-motion` 尊重・クリックで Popover 表示は現状維持。
- `ResizeObserver` 未対応環境（テスト用 jsdom 等）では `window` の `resize` イベントで実幅を再測定するフォールバックを用意する。
- 実幅が測定できない（jsdom など `clientWidth === 0`）場合は上限幅 `OFFICE_MAX_BOUNDS.width` にフォールバックし、キャラクターが描画されない事態を避ける（実測されたら追従）。

### 3. `client/src/routes/OfficeScene.tsx`

- レスポンシブ化により内部横スクロールが不要になるため、ラッパー `Box` の `overflowX: "auto"` を削除する
  （受け入れ条件2）。`width: "100%"` は維持し、`data-testid` も維持する。

## テスト

### `client/src/utils/office.test.ts`（純粋関数の追加テスト・先行）

`officeBounds` の入出力を検証:

- コンテナ幅 >= 800 で `{ width: 800, height: 500 }` を返す。
- コンテナ幅 < 800 でコンテナ幅にフィットし、アスペクト比 800:500 を維持する。
- コンテナ幅 0 以下で `{ width: 0, height: 0 }` を返す。
- 算出 bounds は常に `width <= 800`。

### 既存テスト維持

- `client/src/routes/OfficeScene.test.tsx`（heading 表示・キャラクター表示・エラー表示）は変更せず緑を維持する。

## 受け入れ条件との対応

1. → `officeBounds` + `ResizeObserver` で width をコンテナ追従・上限 800。
2. → `OfficeScene` の `overflowX: "auto"` を削除。
3. → 動的 bounds を `nextPosition`/`randomPosition` に渡し、bounds 変化時は `clampPosition`。`ResizeObserver` でリサイズ追従。
4. → 既存挙動維持。bounds 算出は純粋関数 `officeBounds`。
5. → `width: 100%` + 上限 800 でモバイル幅でも `main` に収まる。
6. → `pnpm turbo run build test lint` 緑、client → common 一方向維持（office.ts は client 内）。

## スコープ外

スプライトのデザイン変更、社員数増加時の最適化、ズーム/パン。
