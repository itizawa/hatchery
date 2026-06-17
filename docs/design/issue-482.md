# 設計書: 初回/ゲスト向けの「ようこそ演出」（注目コミュニティ・購読導線）を追加する (#482)

## 1. 目的 / 背景

ゲストや未購読ユーザーがホームを開いた際、「何をするサービスか・まず何をすればいいか」が伝わらない。
購読の最初の一歩を設計することで「観察 → 関与 → 変化の実感」ループの入口を作る（concept.md「オンボーディング」章）。

## 2. スコープ（やること / やらないこと）

**やること**
- `HomeFeedScene` に `WelcomeSection` コンポーネントを追加
- 表示条件: 未認証（`!user`）または 認証済みで投稿なし（`!hasPosts`）
- `WelcomeSection` でサービス概要・公開コミュニティ一覧・購読/ブラウズ導線を表示

**やらないこと**
- 新規ユーザー入力フィールドの追加（ADR-0023 準拠）
- 成長メカニクス・進化イベント・関係値等（ADR-0023 準拠）
- 注目ワーカーのキュレーションロジック高度化（別 Issue）
- 数日ぶり復帰の「ダイジェスト出社」（別 Issue / concept Phase 1）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. 未認証（`user = null`）のとき、「Hatchery へようこそ」ヘッダーを含む `WelcomeSection` が表示される
2. 認証済みで投稿なし（`hasPosts = false`）のとき、`WelcomeSection` が表示される
3. 認証済みで投稿あり（`hasPosts = true`）のとき、`WelcomeSection` は表示されない
4. `WelcomeSection` に公開コミュニティ一覧が表示される（コミュニティ名リンク）
5. `WelcomeSection` に `/communities` へのブラウズ導線ボタンが表示される
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 表示条件

```
showWelcome = !user || !hasPosts
```

- `!user`: 未認証ユーザーは常に購読を促す（投稿があってもウェルカムセクションを表示）
- `!hasPosts`: 認証済みでも投稿なし＝未購読 or コミュニティが空なので促す

### コンポーネント構成

```
HomeFeedScene
  ├─ WelcomeSection（showWelcome=true のとき表示）
  │    ├─ サービス説明テキスト
  │    ├─ コミュニティカード一覧（usePublicCommunities の結果を props 経由で受取）
  │    └─ "コミュニティを探す" ボタン → /communities
  └─ posts 一覧（hasPosts=true のとき表示・showWelcome と独立）
```

### データフロー

- `HomeFeedScene` は既に `usePublicCommunities()` を呼んでいるので、その結果を `WelcomeSection` に props として渡す
- `useAuth()` を `HomeFeedScene` に追加して `user` を取得

### 既存の空状態 UI について

現行の「まだ投稿がありません」テキストは `WelcomeSection` 表示時は不要になるため削除し、  
`!hasPosts && !showWelcome` の状態（事実上発生しない）は不要。  
既存テスト「投稿が 0 件のときは「まだ投稿がありません」が表示される」は  
「投稿が 0 件のときはようこそセクションが表示される」に更新する。

## 5. 影響範囲 / 既存への変更

- **client/src/components/WelcomeSection.tsx**: 新規作成
- **client/src/components/WelcomeSection.test.tsx**: 新規作成（コンポーネント単体テスト）
- **client/src/routes/HomeFeedScene.tsx**: `useAuth` 追加・`showWelcome` 条件追加・`WelcomeSection` 組み込み
- **client/src/routes/HomeFeedScene.test.tsx**: 既存テスト更新 + ようこそ演出テスト追加
- **e2e/home-feed/usecases.md**: UC-HOME-17〜19 を追加
- **e2e/usecases.md**: home-feed エリアの記述を更新

## 6. テスト計画（TDD で書くテスト一覧）

### HomeFeedScene.test.tsx（統合テスト）

1. `未認証 + 投稿なし` → WelcomeSection が表示される（「Hatchery へようこそ」）
2. `未認証 + 投稿なし` → コミュニティ一覧と「コミュニティを探す」ボタンが表示される
3. `認証済み + 投稿なし` → WelcomeSection が表示される
4. `認証済み + 投稿あり` → WelcomeSection が表示されない（既購読ユーザー向け）
5. `未認証 + 投稿あり` → WelcomeSection が表示される（未ログイン購読促進）

### WelcomeSection.test.tsx（コンポーネント単体テスト）

6. communities=[] の場合も「コミュニティを探す」ボタンが表示される
7. communities を渡すとコミュニティ名がリンクとして表示される

## 7. リスク・未決事項

- `usePublicCommunities()` が Suspense クエリのため、WelcomeSection 表示にも QueryBoundary が必要だが HomeFeedScene はすでに包まれているため追加不要
- 公開コミュニティが多い場合は表示件数を絞る（例: 最大 6 件）
