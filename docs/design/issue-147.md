# 設計書: 仮想オ���ィスページ（ドット絵キャラが歩き回る俯瞰ビュー） (#147)

## 1. 目的 / 背景

Hatchery の中核体験「観察 → 関与 → 変化の実感」を強化するため、AI 社員を俯瞰視点で眺められる「仮想オフィス」ページを追加する。現状は Slack 風チャンネル/タイムラインのみで、社員を一堂に眺めるビューがない。

## 2. スコープ（やること / やらないこと）

**やること:**
- `/office` ルートの追加（`beforeLoad: requireAuth`��
- `OfficeScene.tsx` コンテナ（`DEFAULT_EMPLOYEES` を `OfficeView` に渡���）
- `OfficeView.tsx` プレゼンテーション（アニメーション状態管理・Popover）
- `CharacterSprite.tsx` プレゼンテーション（ドット絵 SVG・クリック/キーボードハンドラ）
- 座標計算純粋関数 `client/src/utils/office.ts`（クランプ・次フレーム計算）
- サイドバーへの導線追���（`RootLayout.tsx`）

**やらな��こと:**
- 社員一覧の新規 API エンドポイント（`DEFAULT_EMPLOYEES` を使用）
- DB スキーマ変更（座標をサーバに永続化しない）
- 経験値・進化イベント・関係値などの MVP 外機能

## 3. 受け入れ条件（テストに落とせる粒度）

1. `/office` ルートが存在し、サイドバーから遷移できる
2. `OfficeScene` は「���想オフィス」見出しを持つ
3. `DEFAULT_EMPLOYEES` 全員のキャラクターが `role="button"` + `aria-label={displayName}` で描画��れる
4. キャラクタークリックで MUI Popover が開き `displayName`・`role`・`isBot` バッジが表示される
5. Enter/Space キーでも同 Popover が開く
6. `clampPosition` は境界外を正しく境界内に制約する
7. `nextPosition` は壁に当たると方向を反転し、位置を境界内にクランプする
8. `prefers-reduced-motion: reduce` 時はアニメーションを停止する
9. 各キャラクターに `aria-label` で社員名の代替テキストが付く
10. `pnpm --filter @hatchery/client test` と `pnpm --filter @hatchery/client lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュ��ル）

### コンポーネント分離

```
OfficeScene (routes/OfficeScene.tsx)  ← コンテナ
  └─ OfficeView (components/OfficeView.tsx)  ← アニメーション状態管理・Popover
       └─ CharacterSprite (components/CharacterSprite.tsx)  ← キャラクター描画
```

### 純粋関数

`client/src/utils/office.ts`：

- `clampPosition(pos, bounds, charSize): Position` — 境界内にクランプ
- `nextPosition(pos, dir, speed, bounds, charSize): { position, direction }` — 次フレーム座標・反射方向計算
- `randomPosition(bounds, charSize): Position` — 初期ランダム配置
- `randomDirection(): Direction` — 初期ランダム方向

### アニメーション

- `requestAnimationFrame` ループ（`useEffect` で開始・クリーンアップ）
- `window.matchMedia('(prefers-reduced-motion: reduce)')` が true の場合はループを開始しない
- 速度: `SPEED = 1.5 px/frame`、境界: `OFFICE_BOUNDS = { width: 800, height: 500 }`
- キャラクターサイズ: `CHAR_SIZE = 48 px`

### キャラクタービジュアル

インライン SVG（16×16 ビューポート、48px 表示）でロボット風ドット絵を描画。`aria-hidden="true"` で装飾として扱い、wrapper の `aria-label` で代替テキストを提供。

### Popover

MUI `Popover`（`anchorOrigin: top/center`、`transformOrigin: bottom/center`）。表示内容: `displayName`（見出し）、`role?`（本文）、`isBot` 時は「AI社員」Chip、`personality?` があれば本文。

## 5. 影響範囲 / 既存への変更

- **追加**: `client/src/utils/office.ts`、`client/src/utils/office.test.ts`、`client/src/components/CharacterSprite.tsx`、`client/src/components/OfficeView.tsx`、`client/src/routes/OfficeScene.tsx`、`client/src/routes/OfficeScene.test.tsx`
- **変更**: `client/src/router.tsx`（`/office` ルート追加）、`client/src/routes/RootLayout.tsx`（サイドバーにリンク追加）
- **server / common / DB**: 変更なし

## 6. テスト計画（TDD で書くテスト一覧）

| テストファイル | テスト内容 |
|---|---|
| `office.test.ts` | `clampPosition`: 範囲内・左右上下境界クラン��� |
| `office.test.ts` | `nextPosition`: 直進・右壁・左壁・下壁・上壁でバウンス |
| `OfficeScene.test.tsx` | 「仮��オフィス」見出しのレ���ダリング |
| `OfficeScene.test.tsx` | DEFAULT_EMPLOYEES 全員分の `role="button"` キャラクター |
| `OfficeScene.test.tsx` | クリックで Popover（role/isBot バッジ）が��く |
| `OfficeScene.test.tsx` | Enter キーで Popover が開く |

## 7. リスク・未決事項

- `requestAnimationFrame` は jsdom 非対応のため、テスト中はアニメーション実行不要（`prefers-reduced-motion: reduce` を mock して抑制）
- オフィス領域 800×500px はビューポートより大きい場合があるため `overflowX: "auto"` で対応
- 将来 `GET /employees` API が実装された際は `OfficeScene` 側のデータソースを差し替えるだけで対応可能
