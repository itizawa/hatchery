# 設計書: 投稿共有をX限定から複数SNS対応の共有シートに拡張する (#1068)

## 1. 目的 / 背景

`client/src/components/ShareButton.tsx` の共有メニューは「URL をコピー」「X でシェア」の2択のみ。
ユーザーから YouTube のネイティブ共有シートのように複数 SNS へ共有したいという要望があり、
`concept.md` の Phase 2「バイラル堀」ロードマップにも沿う。既存の X 共有・URL コピーの挙動・
アクセシビリティは変更せず、`ShareButton` 内部だけで LINE・Facebook 共有と OS ネイティブ共有
シート（`navigator.share`）を追加する。

## 2. スコープ（やること / やらないこと）

**やること**

- LINE 共有 URL 組み立て関数 `buildLineShareUrl({ shareUrl })` の追加
- Facebook 共有 URL 組み立て関数 `buildFacebookShareUrl({ shareUrl })` の追加
- 共有メニューに「LINE でシェア」「Facebook でシェア」項目を追加（`openExternalLink` 経由）
- `navigator.share` が使える環境でのみ「その他のアプリで共有」項目を追加（feature detection）
- 既存の呼び出し元（`PostCard` / `CommentCard` / `CommunitySidebarCard` / `CommunityScene`）は
  `shareUrl` / `shareTitle` props を変更せず、`ShareButton` 内部の変更のみで完結させる

**やらないこと（スコープ外）**

- embed（iframe 埋め込み・oEmbed）機能の新設
- Messages / WhatsApp 個別の共有ボタン（`navigator.share` の OS 共有シートでカバー）
- OGP 画像生成・SNS 用シェアカードの最適化

## 3. 受け入れ条件（テストに落とせる粒度）

1. `buildLineShareUrl({ shareUrl })` が `https://social-plugins.line.me/lineit/share?url=<encoded>` を返す。
2. `buildFacebookShareUrl({ shareUrl })` が `https://www.facebook.com/sharer/sharer.php?u=<encoded>` を返す。
3. 共有メニューを開くと「URL をコピー」「X でシェア」に加え「LINE でシェア」「Facebook でシェア」が表示される。
4. 「LINE でシェア」クリックで `openExternalLink(buildLineShareUrl(...))` 相当の外部リンクフローが呼ばれる（`window.open` に LINE の共有 URL が渡る）。
5. 「Facebook でシェア」クリックで同様に Facebook の共有 URL が渡る。
6. `navigator.share` が関数として存在する環境でのみ「その他のアプリで共有」がメニューに表示され、クリックで `navigator.share({ title: shareTitle, url: shareUrl })` が呼ばれる。
7. `navigator.share` が存在しない環境ではメニューに「その他のアプリで共有」自体が存在しない。
8. 既存の「URL をコピー」「X でシェア」の表示・挙動・`aria-label`（共有ボタン）は変更されない（既存テストが継続して通る）。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

`ShareButton.tsx` 内に完結させる（新規ファイルは作らない）。既存の `buildXShareUrl` と
同じ形（オブジェクト引数・`URLSearchParams` で encode）で 2 関数を追加する。

```ts
export function buildLineShareUrl({ shareUrl }: { shareUrl: string }): string {
  const params = new URLSearchParams({ url: shareUrl });
  return `https://social-plugins.line.me/lineit/share?${params.toString()}`;
}

export function buildFacebookShareUrl({ shareUrl }: { shareUrl: string }): string {
  const params = new URLSearchParams({ u: shareUrl });
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}
```

メニュー項目は既存の「X でシェア」`MenuItem` と同じパターン（`handleClose` → `openExternalLink(...)`）
をそのまま複製する。「その他のアプリで共有」は `typeof navigator.share === "function"` を
レンダー時に直接評価し、真の場合のみ `MenuItem` を描画する（state 化しない。テストで
`Object.defineProperty(navigator, "share", ...)` を差し替えれば再レンダーで反映される）。

### アイコン選定（CLAUDE.md アイコン規約）

- **Facebook**: `@mui/icons-material` は `FacebookRounded` を提供している（tarball 展開で
  ファイル存在を確認済み）ため Rounded バリアントをそのまま使う。ブランド例外リストに
  追加する必要はない。
- **LINE**: `@mui/icons-material` に LINE 専用アイコンは存在しない（tarball 展開で確認）。
  Issue の受け入れ条件 7 が認める「適切な代替アイコン」として汎用の `ChatRounded` を使う。
- **その他のアプリで共有**: 汎用の `IosShareRounded`（OS 共有シートを想起させる標準アイコン）を使う。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- `client/src/components/ShareButton.tsx` のみ変更。呼び出し元（`PostCard.tsx` /
  `CommentCard.tsx` / `CommunitySidebarCard.tsx` / `CommunityScene.tsx`）は無変更。
- `server` / `common` への変更なし。

## 6. テスト計画（TDD で書くテスト一覧）

`client/src/components/ShareButton.test.tsx` に追記する:

- `buildLineShareUrl` が正しい URL を組み立てる
- `buildFacebookShareUrl` が正しい URL を組み立てる
- メニューに「LINE でシェア」「Facebook でシェア」が表示される
- 「LINE でシェア」クリックで LINE 共有 URL が `window.open` に渡る
- 「Facebook でシェア」クリックで Facebook 共有 URL が `window.open` に渡る
- `navigator.share` がある場合に「その他のアプリで共有」が表示され、クリックで
  `navigator.share({ title, url })` が呼ばれる
- `navigator.share` が無い場合に「その他のアプリで共有」が表示されない

既存 7 テストは変更せずそのまま通す。

## 7. リスク・未決事項

- `navigator.share` は jsdom（vitest 環境）に存在しないため、既存テスト実行環境では
  デフォルトで「その他のアプリで共有」が非表示になる。テストでは
  `Object.defineProperty(navigator, "share", ...)` して存在する場合の挙動を検証する。
- LINE 共有 URL の仕様（`social-plugins.line.me/lineit/share?url=`）は LINE 公式の
  一般的な共有ボタン実装パターンに準拠（OAuth 等の追加パラメータは不要）。
