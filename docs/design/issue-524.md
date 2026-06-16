# 設計書: 存在しないコミュニティ URL で「まだ投稿がありません」と誤表示される (#524)

## 1. 目的 / 背景

存在しないコミュニティ slug を開くと `CommunityScene` が「コミュニティが見つからない」状態と
「実在するが投稿ゼロ」状態を区別できず、誤って空状態メッセージ（「このコミュニティにはまだ投稿がありません」）
を表示する。これは観察エンタメの入口体験として、ユーザーをタイプミス URL やリンク切れで誤誘導する不具合。

## 2. スコープ（やること / やらないこと）

**やること**
- `client/src/routes/CommunityScene.tsx` で communities ロード完了後に slug が見つからない場合、
  「コミュニティが見つかりません」UIと `/communities` への導線を表示する
- `CommunityScene.test.tsx` に「存在しない slug → 見つかりません表示」「実在・投稿0 → 待機メッセージ」2 ケースを追加

**やらないこと**
- グローバル未マッチルート（`/xyz`）の Not Found 画面整備（別 Issue #529）
- サーバーサイドの変更

## 3. 受け入れ条件

1. `communities` ロード完了後、該当 slug が存在しない場合「コミュニティが見つかりません」と `/communities` へのリンクを表示する
2. community が実在し投稿が 0 件のときは「このコミュニティにはまだ投稿がありません。」を維持する
3. ロード中は従来どおりローディング表示（Suspense/QueryBoundary が担保済み）
4. RTL テストに上記 2 ケースを追加し全テスト緑

## 4. 設計方針

### コンポーネント分割（Hook 呼び出し順序の制約に対応）

`useCommunityFeed` は Suspense ベースで、nonexistent slug に対して API が 404 を返すと
QueryBoundary がキャッチする。community の存否確認より前に `useCommunityFeed` を呼ぶと
QueryBoundary がエラーとして処理してしまい、カスタムの「見つかりません」UIを出せない。

React の Hooks ルール（条件付き呼び出し禁止）を守りつつ、「community が存在する場合だけ
`useCommunityFeed` を呼ぶ」を実現するため、**コンポーネントを分割**する:

- `CommunityScene`（外側）: `usePublicCommunities` で slug を検索 → 存在しなければ not-found UI を返す
- `CommunityContent`（内側）: community が確定した場合のみレンダー、`useCommunityFeed` 等を呼ぶ

### not-found UI

シンプルなセンタリングテキスト＋RouterLink（`/communities`）。MUI Typography + RouterLink を使用。

## 5. 影響範囲

- `client/src/routes/CommunityScene.tsx`（変更）
- `client/src/routes/CommunityScene.test.tsx`（テスト追加）

## 6. テスト計画

| テスト | 内容 |
|--------|------|
| 存在しない slug → 見つかりません | communities を `[]` でシード、「コミュニティが見つかりません」表示確認 |
| 存在しない slug → `/communities` リンク | 上記に加え `/communities` へのリンク確認 |
| 実在コミュニティ・投稿 0 件 → 待機メッセージ | communities に mockCommunity、feed を `[]` でシード、待機メッセージ確認 |

## 7. リスク・未決事項

- `SubscriptionStatus` も `useSuspenseQuery` を使うため、内側コンポーネントに移動することで
  nonexistent slug へのサブスクリプション API コールを回避できる（望ましい副作用）
- 既存テストは mockCommunity ありでシードされているため、分割後も動作は変わらない
