# Issue #591 設計書: client の apiBaseUrl 解決ロジックのテスト追加

## 目的

`client/src/api/client.ts` に定義された `apiBaseUrl` 定数の三分岐（env 設定あり / window あり / window なし）を
テストで固定し、将来の回帰を防ぐ。

## 受け入れ条件

1. `client/src/api/client.test.ts` に `apiBaseUrl` 解決の 3 ケースを追加する
   - (a) `clientEnv.apiBaseUrl` が設定されているときはその値を採用する
   - (b) `clientEnv.apiBaseUrl` が未設定かつ `window` が存在するときは `window.location.origin` を採用する
   - (c) `clientEnv.apiBaseUrl` が未設定かつ `window` が存在しないときは空文字列を採用する
2. `pnpm turbo run build test lint` が緑

## 対象コード

```typescript
// client/src/api/client.ts
export const apiBaseUrl =
  clientEnv.apiBaseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
```

この式は **モジュール評価時（import 時）** に一度だけ計算される。

## 実装方針

### 問題

`apiBaseUrl` はモジュールの top-level に定数として計算されるため、通常の `vi.mock` では
テスト間で値を変えられない（モジュールは一度しかロードされない）。

### 解決策: `vi.doMock` + 動的 import（テストごとにモジュールをリセット）

Vitest では `vi.doMock(modulePath, factory)` → `await import(...)` の組み合わせで
モジュールキャッシュを都度クリアし、各テストで異なるモック環境を作れる。

```
各テストケースの流れ:
1. vi.doMock("../config/env.js", () => ({ clientEnv: { apiBaseUrl: ... } }))
2. vi.stubGlobal("window", ...) もしくは window を undefined に差し替え
3. const { apiBaseUrl } = await import("./client.js?...");
4. expect(apiBaseUrl).toBe(...)
5. vi.doUnmock / vi.unstubAllGlobals でリセット
```

Vitest は `?query` 付きの動的 import を別モジュールとして扱うため、各テストが独立した
モジュールインスタンスを取得できる。ただしクエリパラメータを使うよりも `vi.resetModules()`
を `beforeEach` / `afterEach` で呼ぶ方が安全でシンプルなため、そちらを採用する。

### テスト構造

```typescript
describe("apiBaseUrl 解決優先順位", () => {
  afterEach(() => {
    vi.doUnmock("../config/env.js");
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("(a) clientEnv.apiBaseUrl 設定時はその値を採用する", async () => {
    vi.doMock("../config/env.js", () => ({
      clientEnv: { apiBaseUrl: "https://api.example.com" },
    }));
    const { apiBaseUrl } = await import("./client.js");
    expect(apiBaseUrl).toBe("https://api.example.com");
  });

  it("(b) apiBaseUrl 未設定かつ window ありのとき window.location.origin を採用する", async () => {
    vi.doMock("../config/env.js", () => ({
      clientEnv: { apiBaseUrl: undefined },
    }));
    vi.stubGlobal("window", { location: { origin: "https://app.example.com" } });
    const { apiBaseUrl } = await import("./client.js");
    expect(apiBaseUrl).toBe("https://app.example.com");
  });

  it("(c) apiBaseUrl 未設定かつ window 無しのとき空文字を採用する", async () => {
    vi.doMock("../config/env.js", () => ({
      clientEnv: { apiBaseUrl: undefined },
    }));
    // jsdom 環境では window は常に存在するため、typeof window を undefined にするには
    // globalThis.window を削除する必要がある
    const savedWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
    try {
      const { apiBaseUrl } = await import("./client.js");
      expect(apiBaseUrl).toBe("");
    } finally {
      globalThis.window = savedWindow;
    }
  });
});
```

### jsdom 環境での注意点

Vitest の client テストは jsdom 環境で動くため、`window` は常に存在する。
`typeof window !== "undefined"` を `false` にするには `globalThis.window` を一時的に削除する必要がある。
削除は finally ブロックで復元する。

## TDD 手順

1. テストを `client/src/api/client.test.ts` に追記する（失敗状態）
2. `pnpm --filter @hatchery/client test` で失敗を確認してコミット
3. 実装コードはすでに存在するため、モックの設定が正しければテストが通る
4. `pnpm turbo run build test lint` で全体緑を確認

## ユーザー可視の振る舞い変化

なし（純粋なテスト追加。e2e/usecases.md の更新不要）。
