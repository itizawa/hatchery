# 設計書: client の useLoginModal フックの開閉（URL search param 駆動）をテストする (#588)

## 1. 目的 / 背景

`client/src/hooks/useLoginModal.ts` はログインモーダルの開閉状態を URL の search param（`?login=true`）で表現するフックで、以下の 3 つの機能を持つ：

- `isOpen`: root の search param `login` が `true` のとき `true` を返す
- `openLogin()`: 現在のパスを保ったまま `login: true` を付与してモーダルを開く（既存 params を保持）
- `closeLogin()`: `login` キーのみ削除してモーダルを閉じる（他の params は保持）

URL 駆動な開閉ロジック（prev を保ったまま付与 / login キーのみ削除）が未検証であり、テストで固定する必要がある。

## 2. スコープ（やること / やらないこと）

**やること:**
- `client/src/hooks/useLoginModal.test.tsx` を新設
- 3 つの分岐 (a)(b)(c) を `renderHook` でテストする

**やらないこと:**
- `useLoginModal` 実装の変更（テスト追加のみ）
- Router の統合テスト（モックで単体テストする）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `login=true` のとき `isOpen` が `true` を返す
2. `login` が未設定のとき `isOpen` が `false` を返す
3. `openLogin()` が `navigate` を呼び、渡す search 関数が既存 params を保ったまま `login: true` を追加する
4. `closeLogin()` が `navigate` を呼び、渡す search 関数が `login` キーのみ削除し他を保持する
5. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

`useLoginModal` は `useNavigate` と `useSearch` を TanStack Router から import している。これらをテストで動かすには Router コンテキストが必要だが、`vi.mock("@tanstack/react-router", ...)` で両関数をスタブすることで、ルータのセットアップなしに `renderHook` の単体テストが可能。

`search` 引数に渡す関数オブジェクト（`(prev) => ({...prev, login: true})` 等）を直接取り出してアサートすることで、prev 保持の挙動を実際の引数で検証できる。

## 5. 影響範囲 / 既存への変更

- **client/**: `src/hooks/useLoginModal.test.tsx` を新設するのみ
- 既存コードへの変更なし

## 6. テスト計画（TDDで書くテスト一覧）

```
describe("useLoginModal (#588)")
  ✅ login=true のとき isOpen が true を返す
  ✅ login が未設定のとき isOpen が false を返す
  ✅ openLogin が既存の search param を保ったまま login:true を付与する
  ✅ closeLogin が login キーのみ削除し他を保持する
```

## 7. リスク・未決事項

- `vi.mock` による TanStack Router のモックはファイルスコープに限定されるため、他テストへの影響なし
- `useCallback` は React から import されるため `@tanstack/react-router` のモックと干渉しない
