# ADR-0036: ゲスト（未認証）ユーザーが vote できるよう sessionId を dedup キーにする（ADR-0031 の userId 必須前提を変更）

- ステータス: Accepted（ADR-0031 の Vote.userId 必須前提を変更）
- 日付: 2026-06-20
- 関連 Issue: #777

## コンテキスト（背景）

ADR-0031 で Vote Exclusive Arc を導入した際、`Vote.userId` を `String`（必須）とし、
ユニーク制約を `@@unique([userId, postId])` / `@@unique([userId, commentId])` で担保していた。
vote エンドポイントには `requireAuth` ミドルウェアが設定されており、未認証ユーザーの vote は
クライアント側の `useGuestVoteGuard` で握りつぶし、`LoginPromptSnackbar` でログイン誘導していた（#481）。

この設計の課題:
- 未ログインユーザーがプロダクトの核心機能（vote）を体験できない。
- ゲストの vote はコミュニティ選定の重み算出（ADR-0030 / ADR-0033）に影響しない。
- ページビュー計測（ADR-0032 / #665）がすでに `sessionId` で dedup しているのに、vote だけ別戦略を使っている一貫性のなさ。

## 決定

**`Vote.userId` を nullable に変更し、`Vote.sessionId: String`（必須）を dedup キーとする。
ユニーク制約を `@@unique([sessionId, postId])` / `@@unique([sessionId, commentId])` に変更する。
vote エンドポイントの `requireAuth` を削除し、IP ベースのレート制限に置き換える。**

具体:

- スキーマ: `Vote.userId String` → `Vote.userId String?`（nullable）。
  `Vote.sessionId String`（必須）を追加。ユニーク制約を sessionId ベースに変更。
  userId の FK は `onDelete: Cascade` → `onDelete: SetNull`（ゲストレコードとの整合性のため）。
- バックフィル: 既存レコードに `sessionId = userId` をセットし、NOT NULL 化する。
- sessionId の決定ロジック（クライアント）:
  - ログイン済み: `sessionId = userId`（既存の dedup は維持される）
  - ゲスト: `localStorage["hatchery:guestId"]`（なければ UUID を生成・永続化）
- エンドポイント: `requireAuth` を削除し、IP ベースのレート制限（60 req/分）に置き換える。
- クライアント: `useGuestVoteGuard` フックと `LoginPromptSnackbar` コンポーネントを削除。
  vote 呼び出しを直接 `votePost(...)` / `voteComment(...)` に変更。

## 理由

- **PageView と同じ戦略**: ADR-0032 でページビュー計測が `sessionId` で dedup しており、
  vote も同じパターンを適用することでコードの一貫性が高まる。
- **guestId の localStorage 永続化**: `sessionStorage`（タブを閉じると消える）ではなく
  `localStorage`（タブを閉じても残る）に保存することで、同一ゲストの再訪でも toggle/switch
  が正しく機能する。
- **認証不要 + レート制限**: vote はスコア計算に直接影響するが、未認証でも体験できることの
  価値の方が高い。IP レート制限（60 req/分）で悪用を最低限防ぐ。

## 検討した代替案

- **userId 必須のまま + ゲスト認証セッション**: ゲストにもセッション ID を発行して userId の
  代わりに使う案。仕組みが複雑になり、既存の Google 認証との統合も困難。却下。
- **vote は認証必須のまま**: 現状維持。ゲストが vote できずプロダクトへの参加感が得られない。
  PageView と設計が乖離する。却下。

## 影響（結果）

- 良い影響: ゲストがログイン前から vote でき、コミュニティ選定の重みに影響させられる。
  クライアント側の `useGuestVoteGuard` / `LoginPromptSnackbar` という迂回実装を削除できる。
- トレードオフ: ゲストが localStorage をクリアすると過去の vote 履歴が失われ、重複 vote が
  可能になる。また `userId` が nullable になったため、vote を user に紐づけるクエリが変わる。
- スコープ外（将来拡張）: ゲスト → ログイン時の vote 履歴引き継ぎ（guestId → userId の
  紐づけ）は別 Issue で扱う。
