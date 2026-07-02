# 設計書: コミュニティカバー画像フォールバック（自動生成パターン）(#1021)

## 1. 目的 / 背景

`coverUrl` が未設定のコミュニティで、単色プレースホルダの代わりに community id ベースの決定的な幾何学パターンをクライアントサイド SVG で描画する。外部サービス（source.boringavatars.com）は SSL 証明書期限切れ・サービス終了済みであり、URL 方式は採用しない。

## 2. スコープ（やること / やらないこと）

**やること**
- `common/src/domain/community/community.ts` に `generateCommunityCoverPattern({ id })` 純粋関数を追加
- `client/src/components/CommunityCoverPlaceholder.tsx` 新規作成（SVG レンダリング）
- `CommunityHeader.tsx` の coverUrl 未設定分岐を CommunityCoverPlaceholder に置き換え
- Vitest テスト追加（common 単体 + client コンポーネント）

**やらないこと**
- GCS ストレージ / admin アップロード API の変更
- Prisma スキーマ変更
- iconUrl 側（source.boringavatars.com 依存）の解消（別 Issue）
- SSR / サーバ側の変更

## 3. 受け入れ条件

1. `generateCommunityCoverPattern({ id })` が同じ id → 常に同じ結果、異なる id → 異なるパラメータを返す（Vitest 単体テスト）
2. `CommunityCoverPlaceholder` が data-testid="community-cover-placeholder" を持つ SVG をレンダリングする
3. coverUrl 未設定時に CommunityHeader 内で CommunityCoverPlaceholder が表示される
4. coverUrl 設定済みの場合は従来通り実画像を優先表示（既存テスト維持）
5. `pnpm turbo run build test lint` が緑になる

## 4. 設計方針

### `generateCommunityCoverPattern`

id 文字列を 32bit 整数ハッシュに変換し、各ビット列でパラメータを決定する：

```ts
type CommunityCoverPattern = {
  variant: number;   // 0–3: geometry タイプ（ストライプ/ドット/菱形/交差）
  shade: number;     // 0–3: 色の濃淡
  angleDeg: number;  // 0, 45, 90, 135: パターン回転角度
  density: number;   // 1–4: パターン密度
};
```

### `CommunityCoverPlaceholder`

- viewBox: `0 0 800 160`（COVER_HEIGHT=160 に合わせる）
- SLACK_COLORS.blue (#1164A3) 系 4 段階濃淡パレット（外部 import 不可のため定数定義）
- SVG `<pattern>` 要素 + `patternTransform="rotate(angleDeg)"` でバリエーション表現
- `aria-hidden="true"` で装飾的な SVG として処理

### カラーパレット（SLACK_COLORS.blue ベース）

| shade | bg | fg |
|-------|----|-|
| 0 | #0A3A5E | #1164A3 |
| 1 | #0D4F82 | #1A7AC8 |
| 2 | #1164A3 | #5DA8D8 |
| 3 | #1A7AC8 | #E8F4FC |

## 5. 影響範囲 / 既存への変更

- `common/src/domain/community/community.ts` — 関数・型追加
- `common/src/domain/community/community.test.ts` — テスト追加
- `client/src/components/CommunityCoverPlaceholder.tsx` — 新規
- `client/src/components/CommunityCoverPlaceholder.test.tsx` — 新規
- `client/src/components/CommunityHeader.tsx` — 分岐置き換え
- `client/src/components/CommunityHeader.test.tsx` — テスト追加

## 6. テスト計画

### common 単体テスト（generateCommunityCoverPattern）
- 同じ id → 常に同じ結果を返す
- 異なる id → variant が変わる（または shade/angleDeg/density が変わる）
- variant が 0–3 の範囲に収まる
- shade が 0–3 の範囲に収まる
- density が 1–4 の範囲に収まる

### client コンポーネントテスト（CommunityCoverPlaceholder）
- data-testid="community-cover-placeholder" が存在する
- 同じ id を渡すと同じ SVG 構造（同じ fill 色）になる
- 異なる id を渡すと SVG の fill 属性の色またはパターンが変わる

### CommunityHeader テスト
- coverUrl 未設定時 CommunityCoverPlaceholder（data-testid）が表示される
- coverUrl 設定済みの場合は community-cover-image（実画像）が表示され CommunityCoverPlaceholder は表示されない

## 7. リスク・未決事項

- SVG `<pattern>` の patternId を id 文字列から生成する際、特殊文字の除去が必要（`/[^a-zA-Z0-9]/g` → `-`）
- e2e ユースケース: ユーザー可視の見た目は変わる（空プレースホルダ→生成パターン）が操作フローは変わらないため更新不要と判断
