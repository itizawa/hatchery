# 設計書: コミュニティ探索一覧（/communities）にコミュニティアイコンを表示する (#1018)

## 1. 目的 / 背景

`/communities`（コミュニティを探す導線）の `CommunityBrowseScene.tsx` には、コミュニティカードにアイコン（Avatar）が表示されていない。サイドバー（`SidebarCommunitySection.tsx`）では `resolveCommunityIconUrl` + `Avatar` で同じコミュニティのアイコンを正しく表示しており、探索一覧でも同じ視覚的手がかりを提供する必要がある（concept.md の「community 購読」への意思決定支援）。

## 2. スコープ（やること / やらないこと）

### やること
- `CommunityBrowseScene.tsx` の各コミュニティカードに `Avatar` を追加する
- `resolveCommunityIconUrl({ id, iconUrl })` を使いサイドバーと同じ実装パターンを踏襲する
- `iconUrl` が null/undefined のコミュニティはフォールバック画像（自動生成 bauhaus URL）を表示する
- デスクトップ・モバイル双方でレイアウトが崩れないよう、カード内のレイアウトを flex 化して Avatar を左端に配置する
- RTL テスト（`CommunityBrowseScene.test.tsx`）で iconUrl あり/なし の2ケースを追加する

### やらないこと
- カバー画像（`coverUrl`）の一覧表示は今回スコープ外
- 新しいAPIエンドポイントの追加・変更（既存の `/api/communities` に `iconUrl` が含まれているため不要）
- e2e ユースケース更新（ユーザー可視の振る舞いが追加されるため必要・後述）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `CommunityBrowseScene.tsx` の各コミュニティカードに `Avatar` がレンダリングされる
2. `iconUrl` が設定されているコミュニティでは、`Avatar` の `src` が `resolveCommunityIconUrl` の戻り値（設定された URL）になる
3. `iconUrl` が null のコミュニティでは、`Avatar` の `src` が `resolveCommunityIconUrl` の戻り値（bauhaus フォールバック URL）になる
4. デスクトップ・モバイル双方でカードのレイアウトが崩れない（Avatar 追加後もタイトル・説明文・活気指標のレイアウトが維持される）
5. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 実装パターン
`SidebarCommunitySection.tsx` の参照実装を踏襲:
```tsx
import { resolveCommunityIconUrl } from "@hatchery/common";
import { Avatar } from "../components/uiParts";
// ...
<Avatar
  src={resolveCommunityIconUrl({ id: community.id, iconUrl: community.iconUrl })}
  alt={community.name}
  sx={{ width: 40, height: 40, fontSize: "1rem", bgcolor: "primary.main" }}
>
  {community.name[0]}
</Avatar>
```

### カードレイアウト変更
現在のカード本文 (`Box` の中) を flex レイアウトに変更し、Avatar を左端に配置、テキスト部分を右側に配置する:

```tsx
// Before: テキストのみ
<Box sx={{ border: ..., p: 2, ... }}>
  <Typography variant="subtitle1" ...>{community.name}</Typography>
  ...
</Box>

// After: Avatar + テキスト
<Box sx={{ border: ..., p: 2, display: "flex", gap: 1.5, alignItems: "flex-start", ... }}>
  <Avatar src={...} sx={{ width: 40, height: 40 }}>{community.name[0]}</Avatar>
  <Box sx={{ flex: 1, minWidth: 0 }}>
    <Typography variant="subtitle1" ...>{community.name}</Typography>
    ...
  </Box>
</Box>
```

`minWidth: 0` で長いテキストが Avatar を圧迫しないようにする。

### モジュール変更対象
- `client/src/routes/CommunityBrowseScene.tsx`（Avatar 追加・レイアウト変更）
- `client/src/routes/CommunityBrowseScene.test.tsx`（iconUrl あり/なし の Avatar テスト追加・mock データに iconUrl を追加）

## 5. 影響範囲 / 既存への変更

- `client/src/routes/CommunityBrowseScene.tsx`: Avatar import 追加、レイアウト変更（既存テストへの影響は最小限。タイトル・説明文・活気指標は変わらない）
- `client/src/routes/CommunityBrowseScene.test.tsx`: mock データに `iconUrl` フィールドを追加、Avatar 表示テストを追加

server / common への変更: なし（Community スキーマに iconUrl は既存フィールドとして存在）

## 6. テスト計画（TDD で書くテスト一覧）

1. `iconUrl` が設定されているコミュニティでは `Avatar` の `src` が設定値になる
2. `iconUrl` が null のコミュニティでは `Avatar` の `src` が bauhaus フォールバック URL になる

## 7. リスク・未決事項

- `resolveCommunityIconUrl` の bauhaus URL は id を引数にとるため、テスト時に期待値を計算する必要がある。`@hatchery/common` のユニットテスト（`community.test.ts`）での実績があるため、同様の方法で確認可能。
- Avatar サイズ（40px）は参照実装（SidebarCommunitySection: 20px）より大きく設定する。一覧カードはサイドバーより表示領域が広いため。
