# 設計書: コミュニティにRSSフィードURLを設定できるようにし、post定時バッチに外部フィード記事を注入する (#1104)

## 1. 目的 / 背景

ADR-0035 と #491 で「community に `feedUrl`（RSS/Atom）を設定し、バッチ生成直前に取得した記事をプロンプトへ注入する」仕組み自体（`fetchExternalFeed.ts` / `buildCommunityPrompt.ts` の注入ロジック）は実装済みだった。しかしその後 ADR-0034 で post/comment バッチが分離され、実際に稼働する post バッチ（`runPostBatch.ts`）は `buildCommunityPrompt` ではなく `buildPostPrompt` を使うようになり、`feedUrl` 取得・注入ロジックが移植されないまま「DB カラムはあるが画面から設定できず、設定してもバッチに使われない」死んだ機能になっている。

本 Issue は ADR-0035 の決定範囲内でこれを実効化する（新規 ADR は不要）。

## 2. スコープ（やること / やらないこと）

**やること**:

- admin のコミュニティ作成・編集フォームに `feedUrl` 入力欄を追加する
- `CreateCommunitySchema` に `feedUrl`（任意・nullable）を追加し、作成時にも設定できるようにする（現状 `UpdateCommunitySchema` にしかない）
- `buildPostPrompt.ts` に `feedArticles` 注入セクションを追加する（`buildCommunityPrompt.ts` の実装を移植）
- `runPostBatch.ts` で community の `feedUrl` が設定されている場合に `fetchExternalFeed` を呼び出し、結果を `buildPostPrompt` に渡す。失敗時はフォールバックする
- 上記に伴う永続化層（in-memory / Prisma）・admin ルート・OpenAPI baseline の配線

**やらないこと**（Issue 本文の「補足」に明記）:

- comment バッチへの注入（ADR-0035 のスコープ外）
- RSS/Atom 以外のデータソース対応・フィード記事の永続化
- 新規 ADR

## 3. 受け入れ条件（テストに落とせる粒度）

1. `CommunityFormFields.tsx` に `feedUrl` 入力欄（任意・URL 形式・`maxLength=COMMUNITY_FEED_URL_MAX_LENGTH`）を追加し、Create/Update 両フォームで送信・表示できる。空文字は `null` として送信する。
2. 不正な URL 形式はフォーム上でエラー表示する（クライアント側 onChange validator）。
3. `buildPostPrompt.ts` に任意パラメータ `feedArticles: FeedArticle[]` を追加し、指定・非空時にプロンプトへ注入する。
4. `runPostBatch.ts` は community の `feedUrl` 設定時に `fetchExternalFeed` を呼び出し、結果を `feedArticles` として `buildPostPrompt` に渡す。取得失敗時は例外を投げず通常生成にフォールバックする。
5. comment バッチは対象外。
6. `runPostBatch.test.ts` / `buildPostPrompt.test.ts` に (a) 未設定時は注入なし (b) 設定時に注入あり (c) 失敗時はフォールバック、の3系統のテストを追加する。
7. `pnpm turbo run build test lint` 緑。server→common の import 境界維持。新規 `.max()` 追加は不要（既存 `COMMUNITY_FEED_URL_MAX_LENGTH` で足りる）。

## 4. 設計方針

### 4.1 common: `CreateCommunitySchema` に `feedUrl` を追加

`UpdateCommunitySchema` と同じ `z.string().url().max(COMMUNITY_FEED_URL_MAX_LENGTH).nullable().optional()` を `CreateCommunitySchema` に追加する。

### 4.2 client: `CommunityFormFields.tsx`

既存の `generationInstruction` フィールドと同じパターン（`form.Field` + `TextField` + `slotProps.htmlInput.maxLength`）で `feedUrl` 欄を追加する。`CommunityFormData` インターフェースに `feedUrl?: string | null | undefined` を追加。

- URL 形式バリデーションは `onChange` validator で行う（空文字は許可・値がある場合のみ `new URL()` で検証）。
- 送信直前に空文字 → `null` へ変換するのは呼び出し元（`AddCommunityScene` / `EditCommunityScene`）の責務ではなく、フィールド自体が `handleChange` 時に空文字をそのまま保持し、`onSubmit` 側でサニタイズすると影響範囲が広がるため、**フィールド側で空文字入力時は `null` を `handleChange` に渡す**（`generationInstruction` は空文字のまま送信して許容されている＝サーバ側 Zod で optional String のため実害がないが、`feedUrl` は `.url()` 検証があるため空文字はスキーマ違反になる。よって feedUrl のみ空文字→null 変換が必須）。
- `AddCommunityScene` の `defaultValues` に `feedUrl: null` を追加。

### 4.3 server: `buildPostPrompt.ts`

`buildCommunityPrompt.ts` の `feedArticlesSection` 構築ロジック（URL 除外・summary 内 URL 除外・author 有無分岐）をそのまま移植する。`BuildPostPromptParams` に `feedArticles?: readonly FeedArticle[]` を追加し、`FeedArticle` 型は `fetchExternalFeed.ts` から re-export された型を使う（`buildCommunityPrompt.ts` と同じ import 元）。

### 4.4 server: `runPostBatch.ts`

`processCommunitePosts` 内で `buildPostPrompt` 呼び出し前に:

```ts
const feedArticles = community.feedUrl
  ? await deps.fetchFeed({ feedUrl: community.feedUrl })
  : [];
```

`fetchFeed` は `RunPostBatchDeps` に注入可能な依存として追加する（デフォルト `fetchExternalFeed`）。`fetchExternalFeed` 自体が既にタイムアウト・HTTPエラー・パース失敗を全て catch して空配列を返す設計（ADR-0035 の失敗時挙動）なので、`runPostBatch` 側で追加の try/catch は不要（`fetchExternalFeed` の契約に委ねる）。

### 4.5 永続化層・admin ルートの配線

- `communityRepository.ts`: `CreateCommunityRecordInput` に `feedUrl?: string | null` を追加。in-memory `create()` で `feedUrl: input.feedUrl ?? null` を設定。
- `prismaCommunityRepository.ts`: `create()` の `data` に `feedUrl: input.feedUrl ?? null` を追加。
- `admin.ts`: `POST /communities` ハンドラで `feedUrl` を分割代入し `communityRepository.create()` に渡す。

## 5. 影響範囲

- **common**: `domain/community/community.ts`（`CreateCommunitySchema`）
- **server**: `batch/buildPostPrompt.ts`, `batch/runPostBatch.ts`, `persistence/communityRepository.ts`, `persistence/prismaCommunityRepository.ts`, `routes/admin.ts`, `openapi/__fixtures__/openapi.baseline.json`（再生成）
- **client**: `components/CommunityFormFields.tsx`, `routes/AddCommunityScene.tsx`（defaultValues）

## 6. テスト計画（TDD）

- `common/src/domain/community/community.test.ts`: `CreateCommunitySchema` の `feedUrl`（省略可・null許容・不正URL拒否・上限超過拒否）
- `client/src/components/CommunityFormFields.test.tsx`: `feedUrl` 欄描画・maxLength・不正URL入力時のエラー表示
- `server/src/batch/buildPostPrompt.test.ts`: `feedArticles` 注入（あり/なし/URL非露出）
- `server/src/batch/runPostBatch.test.ts`: (a) `feedUrl` 未設定時は `fetchFeed` を呼ばない (b) 設定時に `fetchFeed` を呼び結果がプロンプトに反映される (c) `fetchFeed` が空配列を返す（失敗相当）場合も通常生成が継続する

## 7. リスク・未決事項

- 特になし。ADR-0035 の決定範囲内での実装完成であり、既存の `fetchExternalFeed` のフォールバック契約にそのまま乗せられる。
- e2e ユースケース: admin 専用フォーム項目追加とバッチ内部処理変更であり、一般ユーザーから見た振る舞いは変わらないため `e2e/` の更新は不要（Issue 本文の補足どおり）。
