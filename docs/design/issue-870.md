# 設計書: コミュニティヘッダーでコミュニティ名がカバー画像と重なって読みにくい (#870)

## 1. 目的 / 背景

`CommunityHeader.tsx`（#457）では `mt: -44px` の負マージンでアイコン Avatar をカバー画像の左下に重ねている。同じ flex 行に並ぶコミュニティ名（Typography h5）もカバー画像上に配置されてしまい、カバー画像の色・模様によっては名前がほぼ読めない状態になる。

## 2. スコープ（やること / やらないこと）

**やること:**
- `client/src/components/CommunityHeader.tsx` のレイアウトを修正して、コミュニティ名をカバー画像の下部に移動する
- `client/src/components/CommunityHeader.test.tsx` のテストを更新・追加する

**やらないこと:**
- `CommunitySidebarCard.tsx` のレイアウト変更（スコープ外）
- common / server への変更（一方向 import 境界を守る）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `CommunityHeader` のコミュニティ名（h5）がカバー画像の下（アイコン行の外）に配置される
2. カバー画像未設定でもレイアウトが崩れない
3. アイコン画像未設定（頭文字フォールバック）でもレイアウトが崩れない
4. `CommunityHeader.test.tsx` のテストが通る
5. `pnpm turbo run build test lint` が緑
6. client ワークスペースのみ変更

## 4. 設計方針（アーキ・データ構造・主要モジュール）

**案 A を採用**: 名前・説明テキストを flex 行から切り離し、カバー画像の下部（アイコン下段）に独立した Box として配置する。

変更後のレイアウト構造:
```
<Box mb=3>
  <Box>  ← カバー画像エリア（height=160px）
    [img or placeholder]
  </Box>
  <Box mt=-44px flexRow justifyContent=space-between>  ← アイコン行（負マージン）
    <Avatar>  ← アイコンのみ
    [actions]  ← アクションボタン（右端）
  </Box>
  <Box pt=1 px>  ← 名前・説明エリア（カバー画像の下）
    <Typography h5>  ← コミュニティ名
    <Typography body2>  ← 説明（sm以上のみ表示）
  </Box>
</Box>
```

名前エリアに `data-testid="community-name-section"` を付与してテストで構造確認可能にする。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client）

- `client/src/components/CommunityHeader.tsx`: レイアウト変更
- `client/src/components/CommunityHeader.test.tsx`: 新規テスト追加・既存テスト維持

## 6. テスト計画（TDDで書くテスト一覧）

1. `コミュニティ名は community-name-section コンテナ内に表示される` ← 新規
2. `actions が指定されたときアイコン行の右端にレンダリングされる` ← 新規
3. 既存テスト（heading 表示・iconUrl・coverUrl・フォールバック）は変更せず維持

## 7. リスク・未決事項

- なし（既存テストがすべて維持される設計のため変更リスクは低い）
