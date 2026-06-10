# 設計書: Zod スキーマから画面項目（入力フィールド）一覧を生成し Storybook に表示 (#201)

## 1. 目的 / 背景

`common` の Zod 入力スキーマを正本（`CLAUDE.md` バリデーションルール #91）として、
各フォームの「画面項目（入力フィールド）一覧」（項目名 / 型 / 必須 / 制約(min・max・format・enum 等) / 説明）を
**自動生成**し、Storybook の Docs ページで閲覧できるようにする。

手書きで項目表を書くと Zod 定義と二重管理になり drift する。そこで Zod を正本に生成由来にすることで、
Zod を変えれば一覧も自動で追従し drift しない状態を作る。

## 2. スコープ（やること / やらないこと）

### やること

- `common` の Zod 入力スキーマから項目メタデータ（型・必須・min/max・format・enum・description）を抽出する純粋関数 `extractFieldSpecs` を `docs` に実装する。
- 抽出対象スキーマのレジストリ（`FORM_SPECS`）を `docs` に定義する。Issue 記載のスキーマ名は Employee→Worker / channel→community / message→post 等のリネーム後の現行スキーマに読み替え、実際にユーザーが入力するフォームの入力系スキーマを採用する。
- 抽出結果を生成 JSON（`docs/src/generated/field-specs.gen.json`）として書き出す生成スクリプト（`gen-field-specs`）を実装する。
- 生成 JSON を import して項目一覧を表組みで表示する Storybook Docs ページ（MDX）を追加する。
- 生成物を `.gitignore` し、turbo の依存順序に `gen-field-specs → storybook:build` を組み込む。
- 抽出結果が Zod 定義と一致することを vitest で検証する。

### やらないこと（スコープ外）

- 入力系スキーマへの `.max()` 付与（別 Issue。本 Issue は可視化が副次メリット）。
- 各 scene MDX から項目表へのリンク/埋め込み。
- レスポンス系スキーマの項目化。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `extractFieldSpecs(schema)` が Zod `z.object` から各フィールドの `{ name, type, required, constraints(min/max/format/enum), description }` を抽出する。
2. 対象は実際にユーザーが入力するフォームの入力系スキーマで、少なくとも次を含む（リネーム後の現行名）:
   - `LoginRequestSchema`（loginId, password）
   - `UpdateProfileSchema`（displayName, avatarUrl）
   - `CreateCommunitySchema` / `UpdateCommunitySchema`（旧 channel）
   - `CreateWorkerSchema` / `UpdateWorkerSchema`（旧 employee / message 相当のワーカー入力）
   - `UpdateAppSettingSchema`（key, value）
   - `AcceptInvitationSchema`（招待受諾の入力）
3. 生成された項目一覧が Storybook の Docs ページ（MDX）として閲覧できる（`docs/src/**/*.mdx` グロブに乗る）。
4. 項目一覧の 型・必須(min/optional)・桁数(max)・format が Zod 定義と一致する（生成由来であり、Zod を変えると一覧も変わることを vitest で検証可能）。
5. 生成物（`docs/src/generated/field-specs.gen.json`）はコミットしない（`.gitignore` 済み）。生成ステップが turbo の依存順序に組み込まれている（`gen-field-specs → @hatchery/docs#storybook:build` の順を保証）。
6. `pnpm turbo run build test lint`（および `pnpm test`）が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **生成元の選択: 案B（`common` の Zod から直接抽出）** を採用する。`docs` は既に `@hatchery/common` に依存し Storybook で alias 済みのため、`docs→server` 依存を増やさず最小構成で済む。`zod-to-json-schema` 等の新規依存は追加せず、Zod の `_def`（`checks` / `values` / `typeName` / `isOptional` / `description`）を走査して必要なメタデータのみを取り出す。
- **データ構造**（`docs/src/fieldSpec/types.ts`）:
  ```ts
  type FieldConstraints = {
    min?: number; max?: number; format?: string; enum?: string[];
    int?: boolean; positive?: boolean;
  };
  type FieldSpec = { name: string; type: string; required: boolean; constraints: FieldConstraints; description?: string };
  type FormSpec = { id: string; title: string; description?: string; fields: FieldSpec[] };
  ```
- **抽出関数**（`docs/src/fieldSpec/extractFieldSpecs.ts`）: `z.ZodObject` の `.shape` を走査し、各フィールドの Optional/Default を剥がして基底型を判定、`checks` から min/max/format(int/url/email/uuid 等)、`ZodEnum` の `values` を抽出する。`required` は `isOptional()` の否定。
- **対象レジストリ**（`docs/src/fieldSpec/formSpecs.ts`）: `@hatchery/common` から入力系スキーマを import し、`FORM_SPECS: FormSpec[]` を `extractFieldSpecs` で構築する。これが「正本=Zod、生成由来」の本体。
- **生成スクリプト**（`docs/scripts/gen-field-specs.ts`）: `FORM_SPECS` を JSON として `docs/src/generated/field-specs.gen.json` に書き出す。`docs` package.json に `gen-field-specs` script を追加。
- **表示**（`docs/src/field-specs.mdx`）: 生成 JSON（`./generated/field-specs.gen.json`）を import し、各 `FormSpec` をセクション＋表で描画する。
- **turbo 連携**（`turbo.json`）: `gen-field-specs` タスク（`dependsOn: ["@hatchery/common#build"]`, `outputs: ["src/generated/**"]`）を追加し、`@hatchery/docs#storybook:build` の `dependsOn` に `@hatchery/docs#gen-field-specs` を追加する。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: docs / ルート turbo・gitignore）

- 追加: `docs/src/fieldSpec/{types.ts,extractFieldSpecs.ts,formSpecs.ts}`、`docs/scripts/gen-field-specs.ts`、`docs/src/field-specs.mdx`、テスト `docs/src/fieldSpec/extractFieldSpecs.test.ts`。
- 変更: `docs/package.json`（`gen-field-specs` script・`tsx` などは使わず Node 直実行 or vite-node。型は tsc build に乗せない生成専用）、`turbo.json`、`.gitignore`（`*.gen.json` 追記）。
- client / server / common のコードは変更しない（common はスキーマ正本のため読むのみ）。
- import 境界: `docs → common` は許可方向。`docs → server` は作らない。

## 6. テスト計画（TDDで書くテスト一覧）

`docs/src/fieldSpec/extractFieldSpecs.test.ts`:
1. `z.string().min(1).max(50)` 必須フィールド → `{ required: true, constraints: { min:1, max:50 }, type:"string" }`。
2. `z.string().url().max(2048).optional()` → `{ required: false, constraints: { format:"url", max:2048 } }`。
3. `z.enum([...])` → `{ type:"enum", constraints: { enum:[...] } }`。
4. `z.number().int().positive().max(720)` → `{ type:"number", constraints: { int:true, positive:true, max:720 } }`。
5. `.describe()` の説明が `description` に入る。
6. `FORM_SPECS` に AC #2 の全スキーマ（id）が含まれ、各 `fields` が空でない。
7. `FORM_SPECS` の各フィールドの max が、対応する Zod スキーマの実際の max と一致する（生成由来の検証＝Zod を変えれば一覧も変わる）。

## 7. リスク・未決事項

- Issue の AC #2 はリネーム前のスキーマ名（channel/employee/message）を列挙しているが、現行コードでは community/worker/post 等にリネーム済み。AC 本文に「実装時に最新を確認」とあるため、現行の入力系スキーマに読み替えて採用する（ユーザー入力フォームの入力系という意図を満たす）。
- 生成スクリプトは ESM の TS を実行する必要がある。tsc ビルド対象（`docs/dist`）には含めず、Storybook の Vite が解決できるソース（`docs/src/fieldSpec/*`）を生成スクリプトから import する。Node 実行は型を落とすため、生成スクリプトは `.gen.json` 出力に必要な JS ロジックのみで完結させる（vite-node 経由で実行）。
