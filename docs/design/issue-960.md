# 設計書: コミュニティに画像未設定時、id をシードにした自動生成アイコンを表示する (#960)

## 1. 目的 / 背景

コミュニティの `iconUrl` が未設定（null）の場合、現状は Avatar コンポーネントが名前の頭文字 1 文字をプレースホルダとして表示するだけで、コミュニティ間の視覚的識別性が低い。ワーカーが DiceBear/Boring Avatars で自動生成アイコンを持つのに対し、コミュニティだけ頭文字になっており一貫性も欠ける。

コミュニティ id をシードにした Boring Avatars `bauhaus` スタイルの自動生成アイコンを表示することで、視覚的識別性を高め、ワーカー（`beam` スタイル）と種別を視覚的に区別する。

## 2. スコープ（やること / やらないこと）

**やること**:
- `common`: `generateCommunityIconUrl` / `resolveCommunityIconUrl` ドメイン関数を追加
- `common` テスト: 上記 2 関数のユニットテストを追加
- `client`: 3 コンポーネント（`CommunitySidebarCard.tsx` / `CommunityHeader.tsx` / `SidebarCommunitySection.tsx`）の Avatar src を置き換え
- `client` テスト: 既存テストに自動生成アイコンの検証ケースを追加
- `e2e`: UC-COMM-22 を追記

**やらないこと**:
- npm パッケージ追加（URL API を直接使うだけなので不要）
- カバー画像の自動生成（対象外）
- admin の画像アップロード機能の変更（iconUrl 設定時は既存動作を維持）
- ワーカー自動生成と共通化リファクタ（バリアントが違うため別 Issue）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `generateCommunityIconUrl({ id })` が `https://source.boringavatars.com/bauhaus/40/{encodeURIComponent(id)}` を返す
2. `generateCommunityIconUrl` は特殊文字を含む id でも `encodeURIComponent` でエンコードされた URL を返す
3. `generateCommunityIconUrl` の URL パスに `/bauhaus/` が含まれる
4. `resolveCommunityIconUrl({ id, iconUrl: "https://..." })` は iconUrl をそのまま返す
5. `resolveCommunityIconUrl({ id, iconUrl: null })` は自動生成 URL を返す
6. `resolveCommunityIconUrl({ id, iconUrl: undefined })` は自動生成 URL を返す
7. `CommunitySidebarCard`: iconUrl 未設定時の Avatar src が `resolveCommunityIconUrl` の戻り値（`bauhaus` URL）になる
8. `CommunitySidebarCard`: iconUrl 設定時の Avatar src はその URL を優先する
9. `CommunityHeader`: iconUrl 未設定時の Avatar src が `resolveCommunityIconUrl` の戻り値になる
10. `CommunityHeader`: iconUrl 設定時の Avatar src はその URL を優先する
11. `SidebarCommunitySection`: iconUrl 未設定時の Avatar src が自動生成 URL になる
12. `SidebarCommunitySection`: iconUrl 設定時の Avatar src はその URL を優先する

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### URL 生成ロジック

Boring Avatars の外部 URL API を使用:
```
https://source.boringavatars.com/bauhaus/{size}/{seed}
```
- `size`: 40（Avatar デフォルトサイズに合わせる）
- `seed`: `encodeURIComponent(id)` でエンコードしたコミュニティ id

ワーカー（`beam` スタイル、現状は DiceBear）と別バリアント（`bauhaus`）にすることで種別を視覚的に区別する。

### common ドメイン関数

`common/src/domain/community/community.ts` に追加:

```ts
const BORING_AVATARS_BASE_URL = "https://source.boringavatars.com/bauhaus/40";

export function generateCommunityIconUrl({ id }: { id: string }): string {
  return `${BORING_AVATARS_BASE_URL}/${encodeURIComponent(id)}`;
}

export function resolveCommunityIconUrl({
  id,
  iconUrl,
}: {
  id: string;
  iconUrl?: string | null;
}): string {
  return iconUrl ?? generateCommunityIconUrl({ id });
}
```

### client コンポーネント変更

3 コンポーネントの Avatar `src` を変更:
- Before: `community.iconUrl ?? undefined`
- After: `resolveCommunityIconUrl({ id: community.id, iconUrl: community.iconUrl })`

`client → common` の一方向 import 境界は維持（common のドメイン関数を client から利用する正方向）。

## 5. 影響範囲 / 既存への変更

- `common/src/domain/community/community.ts`: 関数 2 つ追加
- `common/src/domain/community/community.test.ts`: テスト追加
- `client/src/components/CommunitySidebarCard.tsx`: Avatar src 変更 + import 追加
- `client/src/components/CommunityHeader.tsx`: Avatar src 変更 + import 追加
- `client/src/components/SidebarCommunitySection.tsx`: Avatar src 変更 + import 追加
- `client/src/components/CommunitySidebarCard.test.tsx`: テスト追加
- `client/src/components/CommunityHeader.test.tsx`: テスト追加
- `client/src/components/SidebarCommunitySection.test.tsx`: テスト追加
- `e2e/community/usecases.md`: UC-COMM-22 追記
- `e2e/usecases.md`: サマリ更新

## 6. テスト計画（TDDで書くテスト一覧）

### common/community.test.ts

- `generateCommunityIconUrl` が bauhaus URL を返す
- `generateCommunityIconUrl` が URL パスに `/bauhaus/` を含む
- `generateCommunityIconUrl` が特殊文字 id を encodeURIComponent でエンコードする
- `resolveCommunityIconUrl` が iconUrl 設定時はそれを返す
- `resolveCommunityIconUrl` が iconUrl null 時は自動生成 URL を返す
- `resolveCommunityIconUrl` が iconUrl undefined 時は自動生成 URL を返す

### client テスト（各コンポーネント）

- iconUrl 未設定時の Avatar src が `bauhaus` URL になる
- iconUrl 設定時の Avatar src がその URL を優先する

## 7. リスク・未決事項

- Boring Avatars の外部 API（`source.boringavatars.com`）は CDN 依存。テストは URL パターン検証のみで実際のネットワーク通信は不要。
- size=40 はデフォルト Avatar サイズに合わせているが、`CommunityHeader` の ICON_SIZE=88 と異なる。ただし実際の表示サイズは CSS で制御されるので URL の size パラメータは表示品質への影響は限定的（受け入れ条件に含めない）。
