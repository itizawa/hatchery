# Issue #532 設計書: client/api の fetch エラーハンドリングを共通アンラップヘルパーに集約する

## 背景・目的

`client/src/api/*.ts` の各 fetcher が openapi-fetch の戻り値（`{ data, error, response }`）を検証して
`if (error || !response.ok || !data) throw new Error(\`... failed: ${response.status}\`)` する同一パターンを
30 箇所超で反復している。重複に加え、サーバが返すエラーボディ（`{ error: string }`）を捨てて status だけの
汎用 Error にしているため、呼び出し側でユーザーに具体的な失敗理由を出せない（#472 / #476 の遠因）。

レスポンス検証＋エラー化を `client/src/api/client.ts` の共通ヘルパーに一本化し、重複を排除しつつ
サーバのエラーメッセージを保持した Error を投げられるようにする。

## 受け入れ条件（Issue より）

1. `client/src/api/client.ts` に openapi-fetch の戻り（`{ data, error, response }`）を検証して `data` を返す
   共通ヘルパーを追加する。サーバのエラーボディがあれば Error message に含める。
2. `communities.ts` / `admin.ts` / `auth.ts` / `workers.ts` / `tokenUsage.ts` / `workerCommunities.ts` /
   `batchLogs.ts` の手書き `if (error || !response.ok || !data) throw ...` をヘルパー呼び出しに置き換える。
3. ヘルパーの単体テスト（成功・error あり・!response.ok・data 無しの各分岐）を追加する。
4. `pnpm turbo run build test lint` が緑。OpenAPI 一方向フロー（生成型を直接利用）を崩さない。

## 設計判断

### 既存パターンの分類

各 fetcher の検証は大きく 3 系統に分かれる:

- **A. data 必須**（多数）: `if (error || !response.ok || !data) throw`; `return data`。
  成功時は `data` が必ず存在することを期待する（POST/PATCH の戻り、フィード取得など）。
- **B. data 任意**（settings/workers 一覧・token-usage・batch-logs）: `if (error || !response.ok) throw`;
  `return data ?? []` のように空ボディを許容する（非 2xx + 空ボディで openapi-fetch は `error=undefined` を返すため
  `response.ok` も併せて見る必要がある）。
- **C. data 不要（void）**: `logout` / `unsubscribeCommunity`。レスポンスの成否のみ検証する。

### 追加するヘルパー（`client.ts`）

openapi-fetch の戻り値型は `{ data?: T; error?: E; response: Response }`。これに対し 2 つの薄いヘルパーを追加する。

- `unwrap(result, label)` — 系統 A 用。`error || !response.ok || data == null` のとき throw、そうでなければ
  `data`（non-null に絞った型）を返す。
- `ensureOk(result, label)` — 系統 B/C 用。`error || !response.ok` のとき throw、そうでなければ `data`
  （`undefined` を取り得る）を返す。呼び出し側で `data ?? []` 等のフォールバックや void 破棄ができる。

両ヘルパーとも、throw する際は**サーバのエラーボディ（`{ error: string }`）があれば `buildApiErrorMessage`
で抽出して Error message に含める**。これにより既存の `buildApiErrorMessage(error, ...)` 直叩き箇所
（admin.patchSetting / workers.useUpdateWorker / workerCommunities.setWorkerCommunities）も同じ経路に統合できる。

fallback 文言は引数 `label`（例: `"GET /api/admin/settings"`）を使い、`buildApiErrorMessage` が
`"<label> (<status>)"` 形式に整形する。これにより従来の `\`... failed: ${response.status}\`` と同等以上の
情報量（label + status、加えてサーバメッセージがあればそれ）を保つ。

`unwrap` の戻り型は `NonNullable<T>` 相当に絞り、呼び出し側の `data` non-null 前提（後続の `.parse(...)` や
プロパティアクセス）を型レベルで満たす。

### 既存 `errors.ts` との関係

`buildApiErrorMessage` / `getApiErrorMessage`（#476）は既存。本 Issue ではこれを**再利用**し、
新ヘルパーは `client.ts` から `buildApiErrorMessage` を呼ぶ。`getApiErrorMessage`（UI 側の reject 値整形）は
本 Issue のスコープ外（変更しない）。

### スコープ外

- `uploadWorkerImage` / `fetchRecentWorkers` / `fetchSubscriptionStatus` は openapi-fetch を通さない
  **生 fetch** を使っているため本ヘルパーの対象外（戻り値の形が `{ data, error, response }` ではない）。
- 個別画面のエラー表示 UI 改善（#472 / #476）。

## テスト方針（TDD）

`client/src/api/client.test.ts` を新設し、`unwrap` / `ensureOk` を直接テストする:

- 成功（`data` あり・`response.ok`）→ `data` を返す。
- `error` あり → throw（サーバボディ `{ error }` を message に含む）。
- `!response.ok`（error は undefined・空ボディ）→ throw（label + status を含む）。
- `data` 無し（`unwrap` のみ）→ throw。
- `ensureOk` は `data` 無しでも throw しない（`undefined` を返す）。

各 fetcher の置換は既存の `*.test.ts`（communities / admin / auth / workers / tokenUsage /
workerCommunities / batchLogs）が振る舞い（成功・失敗時 throw・サーバメッセージ保持）を継続検証する。

## ユーザー可視の振る舞い

純粋な内部リファクタ。エラー時にサーバメッセージを Error に乗せる経路を全 fetcher に広げるため、
画面側で `getApiErrorMessage` を使う箇所（#476 既存）では失敗理由がより具体的に出るようになり得るが、
画面・遷移・空状態の構造は変わらない。e2e ユースケースの更新は不要（その旨 PR に明記）。
