# 設計書: チャンネル詳細画面に SNS 共有ボタン（URL コピー / X シェアリンク）を追加する (#257)

## 1. 目的 / 背景

ゲストユーザーがチャンネル（コミュニティ）を閲覧できるようになると（#255）、「このチャンネルを誰かに見せたい」というシェア行動が発生する。現在はシェア導線がなく URL バーからの手動コピーに依存している。`concept.md` の Phase 2（バイラル堀）でも SNS 共有は CAC を下げる鍵とされている。

コミュニティ詳細画面にワンクリックで URL をコピー・X(Twitter) でシェアできるボタンを追加し、認証済み・未認証いずれのユーザーも知人にサービスを紹介しやすくする。

> 注: Issue 本文は旧名称（`ChannelView` / `ChannelScene` / `/channels/$channelId` / `onEditName`）を参照しているが、現行コードでは「Community」へリネーム済み。実体は `client/src/routes/CommunityScene.tsx`（`/communities/$slug`）であり、そのヘッダー（コミュニティ名・購読ボタンを並べる `Box`）に共有ボタンを追加する。購読ボタン（`SubscribeButton`、認証済みのみ表示）が Issue の `onEditName`（認証済みのみ表示の編集ボタン）に相当する「認証済み限定アクション」であり、共有ボタンはそれと視覚的に区別する。

## 2. スコープ（やること / やらないこと）

### やること
- コミュニティ詳細画面ヘッダーに「共有」ボタン（アイコン）を追加する。
- 「URL をコピー」で現在ページの URL をクリップボードへコピーし、完了フィードバック（Snackbar トースト）を表示する。
- 「X でシェア」でコミュニティ名と URL を含むシェアテキストの X 投稿画面（`https://twitter.com/intent/tweet?text=...&url=...`）を新規タブで開く。
- 認証済み・未認証いずれでも共有ボタンを表示する。
- 共有ボタンを認証済み限定アクション（購読ボタン）と視覚的に区別する。

### やらないこと
- ネイティブ Web Share API（`navigator.share`）対応（将来拡張）。
- SNS 別シェアカード / OGP 画像最適化（別 Issue）。
- サーバ側の変更（client のみ完結）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `ShareButton` コンポーネントは「共有」を表すボタン（aria-label「共有」）を表示する。
2. 共有ボタン押下でメニューが開き「URL をコピー」「X でシェア」の項目が表示される。
3. 「URL をコピー」押下で `navigator.clipboard.writeText` が共有 URL 引数で呼ばれる。
4. コピー成功後に完了フィードバック（Snackbar「URL をコピーしました」）が表示される。
5. 「X でシェア」項目は `https://twitter.com/intent/tweet` 形式の href を持ち、`text`（コミュニティ名を含む）と `url`（共有 URL）をクエリに含み、`target="_blank"` / `rel="noopener noreferrer"` で開く。
6. `ShareButton` は props（`shareUrl` / `shareTitle`）のみで動作し DOM/window への副作用は X の遷移と clipboard 呼び出しのみ（純粋に単体テスト可能）。
7. `CommunityScene` のヘッダーに `ShareButton` が認証状態に関わらず描画される。
8. `pnpm turbo run build test lint` 相当（client の test / lint / build）が緑。`client → common` の一方向 import 境界を遵守する。

## 4. 設計方針

- 再利用可能な `client/src/components/ShareButton.tsx` を新設。props は `shareUrl: string`・`shareTitle: string`。
- 共有 UI は MUI `IconButton`（`ShareIcon`）＋ `Menu`。メニュー項目:
  - 「URL をコピー」: `MenuItem` の onClick で `navigator.clipboard.writeText(shareUrl)` → 成功で `Snackbar` を開く。
  - 「X でシェア」: `MenuItem` を `component="a"` でレンダリングし `href` に intent URL、`target="_blank"` `rel="noopener noreferrer"`。
- intent URL 生成は純粋関数 `buildXShareUrl(shareTitle, shareUrl)` としてコンポーネント内（または近接）に置き `encodeURIComponent` でエスケープ。`text` にはコミュニティ名ベースのシェア文言を入れる。
- `CommunityScene` では `window.location.href` を `shareUrl`、`community?.name ?? r/${slug}` を `shareTitle` として `ShareButton` を購読ボタンと並べて配置。共有ボタンは常時表示（認証ガードの外）、購読ボタンは従来どおり `authUser` 条件付き。視覚区別は IconButton（アイコンのみ）vs テキスト Button（購読）で達成。
- 文字列上限: `shareTitle` は表示・URL 長を考慮し共有テキスト生成時に過度に長くならないよう、コミュニティ名は既存の `.max()` 済みフィールドを使う（新規ユーザー入力フィールドは増やさないため #91 のスキーマ追加は不要）。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **client のみ**。
- 新規: `client/src/components/ShareButton.tsx`、`client/src/components/ShareButton.test.tsx`。
- 変更: `client/src/routes/CommunityScene.tsx`（ヘッダーに `ShareButton` を追加）。
- common / server / docs への変更なし。

## 6. テスト計画（TDD で書くテスト一覧）

`client/src/components/ShareButton.test.tsx`:
1. 「共有」ボタン（aria-label）が表示される。
2. 共有ボタン押下でメニューが開き「URL をコピー」「X でシェア」が表示される。
3. 「URL をコピー」押下で `navigator.clipboard.writeText` が `shareUrl` で呼ばれる。
4. コピー成功後に Snackbar フィードバックが表示される。
5. 「X でシェア」が intent URL（`twitter.com/intent/tweet`）を href に持ち、`text`（title 含む）・`url`（shareUrl）を含み、`target=_blank` / `rel=noopener noreferrer` を持つ。

## 7. リスク・未決事項

- `navigator.clipboard` は jsdom で未定義のためテストでモックする（既存 `InvitationsTab.test.tsx` と同様）。
- Issue の旧名称（Channel）と現行（Community）のズレは §1 注記のとおり Community を正とする。
- X(Twitter) のドメインは `twitter.com/intent/tweet`（Issue 受け入れ条件 3 の指定形式）を採用する。
