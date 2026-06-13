# Issue #475 設計書: crypto.ts / postRepository.ts の非 null assertion(!) を型ガードで解消する

## 背景・目的

本番コードで非 null assertion（`!`）に頼って型エラーを抑えている箇所があり、防御済みとはいえ
型推論で安全性を表現できていない。`!` は将来のリファクタで防御コードが外れた際に実行時 `undefined`
を見逃す温床になるため、明示的な分割・ガードで型レベルの安全性を回復する。

対象（本番コードの `!` のみ。テストコードの `as unknown` 等はスコープ外）:

- `server/src/utils/crypto.ts:45-47` — `decrypt` の `ivB64!` / `authTagB64!` / `encryptedB64!`
- `server/src/persistence/postRepository.ts:241,278` — `posts[posts.length - 1]!`

## 受け入れ条件 → 入出力

| # | 受け入れ条件 | 検証方法 |
|---|--------------|----------|
| 1 | `decrypt` の 3 要素分割を `!` なしで安全に表現 | `crypto.test.ts`: 復号往復・不正形式 throw が緑のまま。要素欠落（区切りはあるが空要素）の throw も確認 |
| 2 | `postRepository.ts:241,278` の `posts[posts.length - 1]!` を `!` なしで表現 | `postRepository.test.ts`: `listLatestPaged` / `listPopularPaged` のページネーション（カーソル往復・重複欠落なし）が緑 |
| 3 | 挙動は不変（リファクタのみ）。既存テストが緑のまま | 既存 `crypto.test.ts` / `postRepository.test.ts` が無修正で緑 |
| 4 | `pnpm turbo run build test lint` 緑。新たな `!` 由来の警告を増やさない | CI |

## 設計判断

### crypto.ts `decrypt`

`parts.length !== 3` のガードは TypeScript の配列分割代入には narrowing として効かない。
分割代入後に各要素を明示的に `undefined` チェックして throw する形に変える。

```ts
const [ivB64, authTagB64, encryptedB64] = ciphertext.split(":");
if (ivB64 === undefined || authTagB64 === undefined || encryptedB64 === undefined) {
  throw new Error("Invalid ciphertext format");
}
```

- これにより `length !== 3` チェックを undefined チェックに統合できる。`split(":")` の結果が
  ちょうど 3 要素でなくても（4 要素以上でも）、先頭 3 要素が全て string なら復号を試みる挙動になり得るため、
  従来の「ちょうど 3 要素」制約を維持するために **`length !== 3` チェックは残しつつ**、その後の
  `Buffer.from(...!, ...)` の `!` を undefined ガードで除去する方針とする。
- 具体的には `length !== 3` を残し、分割後に 3 変数の undefined チェックを足して narrowing する。
  これで挙動（4 要素以上を拒否）は完全に不変。

### postRepository.ts `listLatestPaged` / `listPopularPaged`

`posts[posts.length - 1]!` を `posts.at(-1)` を変数に取り、`if (last)` でガードする形に変える。
`hasMore` が true のとき `posts.length >= 1` は保証されるが、型上 `at()` は `undefined` を返し得るため
明示ガードする。`last` が `undefined`（理論上ありえない）なら `nextCursor = null` にフォールバック。

```ts
const last = posts.at(-1);
const nextCursor = hasMore && last ? encodeCursor(last) : null;
```

## テスト方針（TDD）

挙動不変のリファクタのため既存テストが回帰検出の主役。加えて回帰に強くするため:

- `crypto.test.ts`: 「区切りはあるが要素が空（`":"`）の暗号文は復号で例外」を追加（undefined ガード相当の境界）。
- `postRepository.test.ts`: 未テストだった `listLatestPaged` のカーソル往復（重複・欠落なし・nextCursor の遷移）を追加。

これらをまず追加 → 現状実装でも緑（挙動不変なので）であることを確認 → リファクタ後も緑を維持する。
