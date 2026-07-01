# 設計書: ゲスト再訪時 WelcomeSection 常時表示を初回限定に修正 (#932)

## 1. 目的 / 背景

`HomeFeedScene` の `showWelcome = !user || !hasPosts` という条件式により、
未ログインゲストは投稿が存在していても常に WelcomeSection が表示され、
投稿一覧がスクロールしないと目に入らない状態になっていた。

WelcomeSection は「初回訪問者のための足場」（concept.md）であり、
再訪ゲストには投稿一覧を即座に見せることでエンゲージメントを高める。

## 2. スコープ（やること / やらないこと）

- **やること**: `localStorage` の `hatchery_visited` フラグで初回/再訪を判定し、ゲストの WelcomeSection 表示を初回のみに限定する
- **やらないこと**: ログインユーザーの挙動変更、セッションストレージ対応、PWA offline 対応、有効期限付きフラグ

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `localStorage.getItem("hatchery_visited")` が `null` のゲストには、投稿があっても WelcomeSection を表示する（初回判定）
2. WelcomeSection を表示したとき、`localStorage.setItem("hatchery_visited", "true")` でフラグを保存する
3. `localStorage.getItem("hatchery_visited") === "true"` のゲストには、投稿がある場合 WelcomeSection を表示しない
4. 投稿が 0 件の場合は `hatchery_visited` フラグの有無に関わらず WelcomeSection を表示する
5. ログインユーザーには従来通り WelcomeSection を表示しない（`!user` 条件を維持）
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### 表示条件の変更

```ts
// Before
const showWelcome = !user || !hasPosts;

// After
const hasVisited = useState(() => localStorage.getItem("hatchery_visited") === "true")[0];
const showWelcome = !hasPosts || (!user && !hasVisited);
```

- `!hasPosts`: 投稿ゼロの場合は常に WelcomeSection を表示（コンテンツがない場合の空状態 UI）
- `!user && !hasVisited`: ゲストかつ初回訪問時のみ WelcomeSection を表示

### フラグの保存タイミング

`useEffect` で `showWelcome === true` かつゲスト (`!user`) のとき `hatchery_visited` をセット。
これにより WelcomeSection が一度でも描画されたらフラグが立つ。

```ts
useEffect(() => {
  if (showWelcome && !user && !hasVisited) {
    localStorage.setItem("hatchery_visited", "true");
  }
}, [showWelcome, user, hasVisited]);
```

### localStorage キー

`HATCHERY_VISITED_KEY = "hatchery_visited"` として定数化（衝突防止）。

## 5. 影響範囲 / 既存への変更

- `client/src/routes/HomeFeedScene.tsx`: `showWelcome` の計算と `useEffect` 追加
- `client/src/routes/HomeFeedScene.test.tsx`: 既存テストの localStorage 初期化 + 新規テスト追加
- `e2e/home-feed/usecases.md`: UC-HOME-17 更新、UC-HOME-35 追加

## 6. テスト計画（TDDで書くテスト一覧）

| テスト | 期待結果 |
|--------|---------|
| ゲスト初回（フラグなし）+ 投稿あり → WelcomeSection 表示 | ✅ |
| ゲスト再訪（フラグあり）+ 投稿あり → WelcomeSection 非表示 | ✅ (新規) |
| ゲスト再訪（フラグあり）+ 投稿なし → WelcomeSection 表示 | ✅ (新規) |
| WelcomeSection 表示時に localStorage フラグが保存される | ✅ (新規) |
| ログインユーザー + 投稿あり → WelcomeSection 非表示 | ✅ (既存維持) |
| ログインユーザー + 投稿なし → WelcomeSection 表示 | ✅ (既存維持) |

## 7. リスク・未決事項

- jsdom の localStorage はテスト間で共有される可能性があるため、各 `describe` の `beforeEach` で `localStorage.clear()` を呼ぶ必要がある
- Safari のプライベートブラウズでは localStorage が read-only になる場合があるが、`try/catch` は不要（localStorage.setItem 失敗時は単に初回表示が続くだけ）
