# 設計書: Storybook に画面（route）単位の設計書を整備する（MSW モックで実画面を表示・画面遷移を再現） (#108)

## 1. 目的 / 背景

現在の Storybook（ADR-0007）はコンポーネント単位（`ChannelView` 等）のみで、
ルートコンポーネント（`HomeScene`・`ChannelScene` 等）は TanStack Query / Router への依存から
Storybook に乗っていなかった。MSW で API レスポンスをモックし、実画面をデータ込みで
Storybook 上に表示できる基盤を整備する。#107 で `QueryClientProvider` が preview.tsx に追加済み。

## 2. スコープ（やること / やらないこと）

**やること:**
- `msw@2` / `msw-storybook-addon` の導入と初期化
- `client/src/mocks/` にハンドラ + fixture データを配置
- `preview.tsx` に TanStack Router（memory history）デコレータを追加
- 5 画面（HomeScene / ChannelScene / LoginScene / SettingsScene / AccountScene）のストーリー + MDX
- `docs/public/mockServiceWorker.js` の生成・コミット

**やらないこと:**
- 書き込み系 API の完全な副作用再現（MSW 固定レスポンスのみ）
- 全エンドポイントの網羅的モック（初期表示に必要な分のみ）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- [ ] `msw` と `msw-storybook-addon` が導入され Storybook 起動時に MSW が初期化される
- [ ] `client/src/mocks/` にハンドラと fixture データが用意され、common Zod スキーマ準拠
- [ ] `preview.tsx` の decorator が QueryClientProvider / ThemeProvider / CssBaseline を提供
- [ ] TanStack Router（memory history）デコレータが用意され、少なくとも 1 つのナビゲーション再現ストーリーがある
- [ ] 5 画面それぞれに `*.stories.tsx` と `docs/src/*.mdx` が存在する
- [ ] 各 MDX に「目的 / URL / 認証要否 / 状態一覧 / データ契約 / 関連」が記載されている
- [ ] `turbo run lint test build` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### MSW 初期化戦略

`msw-storybook-addon@^2.0.4` を使用。Storybook 8 に対応したアドオン。

```ts
// docs/.storybook/preview.tsx
import { initialize, mswLoader } from 'msw-storybook-addon';
initialize({ onUnhandledRequest: 'warn' });
export const loaders = [mswLoader];
```

サービスワーカーは `docs/public/mockServiceWorker.js` に配置し、
`docs/.storybook/main.cts` の `staticDirs: ['../public']` で提供する。

### Router デコレータ戦略

SettingsScene は `useSearch({ from: "/admin" })` 等の厳格な Router フック依存があるため、
RouterProvider（memory history）でラップする。

```tsx
// client/src/mocks/RouterDecorator.tsx
function RouterStory({ path }: { path: string }) {
  const [router] = useState(() => createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  }));
  return <RouterProvider router={router} />;
}
```

RouterProvider は story の `render` 関数から返し、global preview.tsx の
QueryClientProvider をアウターコンテキストとして使う（ネスト問題なし）。

### fixture データの配置

`client/src/mocks/data/fixtures.ts` に AuthUser・Channel・MessageRecord などの
fixture を定義。Zod スキーマで型を保証する（テストで確認）。

### ハンドラの設計

`client/src/mocks/handlers.ts` に MSW `http` ハンドラを定義:
- `GET /auth/me` → admin AuthUser（デフォルト）
- `GET /channels` → Channel[]
- `GET /channels/:channelId/messages` → MessageRecord[]
- `GET /admin/settings` → AppSettingResponse[]
- `GET /admin/batch-logs` → BatchRunLog[]
- `POST /auth/login` → 200 AuthUser
- `POST /auth/logout` → 200
- `PATCH /auth/me` → 更新後 AuthUser

## 5. 影響範囲 / 既存への変更

- `client/package.json`: `msw` devDependency 追加
- `docs/package.json`: `msw-storybook-addon` devDependency 追加
- `docs/.storybook/main.cts`: `staticDirs` / addon 追加
- `docs/.storybook/preview.tsx`: MSW 初期化 + Router decorator 追加
- `client/src/routes/AccountScene.stories.tsx`: MSW ハンドラ追加

## 6. テスト計画（TDD で書くテスト一覧）

| テスト | ファイル | 検証内容 |
|--------|----------|----------|
| fixture AuthUser は AuthUserSchema に準拠 | `client/src/mocks/data/fixtures.test.ts` | Zod parse が通る |
| fixture Channel[] は ChannelSchema[] に準拠 | 同上 | Zod parse が通る |
| fixture MessageRecord[] は MessageRecordSchema[] に準拠 | 同上 | Zod parse が通る |
| storybook preview decorators >= 3 | `docs/src/storybook-preview.test.ts` | decorator 数の確認 |

## 7. リスク・未決事項

- **MSW サービスワーカー**: `docs/public/mockServiceWorker.js` を生成・コミットすること。
  ビルド成果物だが Storybook の実行に必要なため例外的にコミット。
- **beforeLoad の race condition**: RouterProvider の beforeLoad（requireAdminRoute 等）が
  MSW より先に実行される可能性。`msw-storybook-addon` の `mswLoader` で MSW を先に起動して対処。
- **SettingsScene の `useSearch`**: `{ from: "/admin" }` を使うため必ず RouterProvider 内で描画。
  `?tab=users` を含む initialEntries を使えばデフォルトタブが表示される。
