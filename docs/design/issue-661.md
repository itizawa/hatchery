# 設計書: 外部リンクを開く前に確認モーダルを表示する（Issue #661）

## 背景・目的

AI ワーカーが生成した本文中の URL、OGP カード、X シェアボタンなど複数の外部リンクが、
クリック時に確認なく新規タブで開く。ユーザーが意図せず外部サイトへ遷移するリスクを防ぐため、
外部リンクのクリックをインターセプトして確認モーダルを表示し、ユーザーの明示操作でのみ遷移させる。

## アーキテクチャ設計

### 共通化方針: Context + Hook + Provider パターン

`useLoginModal.ts` の URL search param 方式とは異なり、外部リンク確認は:
- リロード耐性が不要（クリックに応じた一過性の状態）
- 「今後表示しない」設定が `localStorage` で永続化される

このため、React Context + useState でモーダルの開閉・対象 URL を管理する方式を採用する。

```
ExternalLinkContext (createContext)
  └─ ExternalLinkProvider (useState: pendingUrl | null, skipWarning localStorage)
       └─ useExternalLink() → { openExternalLink(url) }
  └─ ExternalLinkDialog (確認モーダル)
```

Provider は `RootLayout.tsx` と同等レベル（`client/src/main.tsx` or `RootLayout` 内）にマウントする。
実装上は `RootLayout.tsx` の Outlet の外側（または `App.tsx` のルーター設定周辺）に Provider を置く。

調査した結果、`client/src/main.tsx` で TanStack Router のルーターと QueryClientProvider を
ラップしている構造のため、`ExternalLinkProvider` は `RootLayout.tsx` の内部でマウントする形にする。

### 外部リンク判定基準

```typescript
function isExternalUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin !== window.location.origin
    );
  } catch {
    return false;
  }
}
```

### localStorage 永続化キー

```
"hatchery:external-link:skip-warning"
```

値: `"true"` | 未設定。ブラウザ単位・全外部リンク共通。

### 実装ファイル構成

```
client/src/
  hooks/
    useExternalLink.ts          # Context + フック（openExternalLink を提供）
    useExternalLink.test.tsx    # テスト（TDD）
  components/
    ExternalLinkDialog.tsx      # 確認モーダル（MUI Dialog）
    ExternalLinkDialog.test.tsx # テスト（TDD）
    ExternalLinkDialog.stories.tsx # Storybook story
    TextWithLinks.tsx           # 修正: ExternalLink フロー経由に
    MarkdownContent.tsx         # 修正: a / img の onClick で ExternalLink フロー経由に
    OgpCard.tsx                 # 修正: onClick で ExternalLink フロー経由に
    ShareButton.tsx             # 修正: X シェア MenuItem の onClick で ExternalLink フロー経由に
  routes/
    RootLayout.tsx              # 修正: ExternalLinkProvider + ExternalLinkDialog をマウント
```

## 受け入れ条件の実装方針

| 受け入れ条件 | 実装 |
|------------|------|
| 1. 共通フロー（Provider + フック） | `useExternalLink.ts` で Context 定義・`openExternalLink(url)` を提供 |
| 2. 確認モーダル（MUI Dialog） | `ExternalLinkDialog.tsx` — タイトル・遷移先ホスト名・注意文・チェックボックス・ボタン 2 つ |
| 3. 「続行」で新規タブ開く | `window.open(url, "_blank", "noopener,noreferrer")` |
| 4. 「キャンセル」/背景/Esc で閉じる | Dialog の `onClose` + キャンセルボタン |
| 5. 「今後表示しない」localStorage 永続化 | `localStorage.setItem("hatchery:external-link:skip-warning", "true")` |
| 6. 4 箇所すべてが確認フロー経由 | `TextWithLinks` / `MarkdownContent` (a, img) / `OgpCard` / `ShareButton` の X シェア |
| 7. アプリ内遷移は対象外 | `isExternalUrl` 判定。TanStack Router リンクには手を加えない |
| 8. テスト | `useExternalLink.test.tsx` + `ExternalLinkDialog.test.tsx` でカバー |
| 9. UI 文言定数化 | `ExternalLinkDialog.tsx` 内定数でテキスト管理 |
| 10. CI 全緑 | `pnpm turbo run build test lint` |

## e2e ユースケース更新対象

`e2e/home-feed/usecases.md` または新エリアに UC を追加。
外部リンク確認は横断的機能のため、`home-feed` エリアに追記する（post 本文の URL クリックが
最もユーザーが触れやすいエントリポイント）。

## 実装上の注意点

- `TextWithLinks` の `Link` コンポーネントは `onClick` で `preventDefault` してから
  `openExternalLink` を呼ぶ（`href` を残すとブラウザデフォルトが勝つため）
- `MarkdownContent` の `a` コンポーネントも同様
- `OgpCard` は `component="a"` の `Box` を `onClick` + `preventDefault` に変更する
  （または `component="div"` に変更して cursor:pointer で対応）
- `ShareButton` の X シェア MenuItem は `component="a"` を外して `onClick` ハンドラに変更
- `openExternalLink` 内で `skipWarning` が true なら即 `window.open`、false なら Context state を更新してモーダルを開く
