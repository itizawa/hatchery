# 設計書: 編集フォームは初期値から変化がない場合 Submit を無効化し、規約として徹底する (#179)

## 1. 目的 / 背景

編集フォームで初期値と同一のまま送信できてしまい、無意味な API 呼び出し・誤操作の原因になる。
代表例は `AccountScene.tsx` の保存ボタンで、`displayName.trim() === ""` と `isPending` のみ判定しており、
初期値と同一でも送信できていた。今後フォームが増えても同じ抜けが再発しないよう、共通ヘルパーと規約で対処する。

## 2. スコープ（やること / やらないこと）

**やること**
- `client/src/utils/formDirty.ts` に `isShallowDirty` ユーティリティ関数を追加
- `AccountScene.tsx` の保存ボタン無効化条件に dirty 判定を追加
- `CLAUDE.md` の「バリデーションルール」に規約を追記

**やらないこと**
- 新規作成フォーム（空チェックで足りる）
- SettingsScene の ApiTokenSettings（新規上書きで初期値比較が不要）
- AccountScene 以外の編集フォーム（将来の Issue で対応）

## 3. 受け入れ条件（テストに落とせる粒度）

1. 初期値から変化がない場合、保存ボタンが `disabled`
2. いずれかのフィールドを変更すると保存ボタンが `enabled`（ただし displayName が空なら依然 `disabled`）
3. 変更後に初期値へ戻すと保存ボタンが再び `disabled`
4. 既存の無効化条件（displayName が空・isPending 中）は維持
5. `pnpm turbo run build|test|lint` 緑

## 4. 設計方針

### `isShallowDirty` ユーティリティ関数

```typescript
// client/src/utils/formDirty.ts
export function isShallowDirty(
  initial: Record<string, unknown>,
  current: Record<string, unknown>
): boolean {
  return Object.keys(current).some((key) => current[key] !== initial[key]);
}
```

- Hook ではなく純粋関数。React 非依存で単体テスト可能。
- 浅い比較のみ（深い比較は必要なし。フォームフィールドはプリミティブ値）。
- 将来の編集フォームが `import { isShallowDirty } from "../utils/formDirty.js"` で流用可能。

### AccountScene の dirty 判定

- `initialized` ref（既存）が `true` になった後に `authUser` と現在の state を比較。
- `initialized.current` が false の間（初期ロード中）は `isDirty = false` として無効化を維持。
- `authUser` が TanStack Query キャッシュ経由で更新されるため、保存後も自動的に比較ベースが更新される。

```typescript
const isDirty =
  initialized.current &&
  authUser !== undefined &&
  isShallowDirty(
    { displayName: authUser.displayName, avatarUrl: authUser.avatarUrl ?? "" },
    { displayName, avatarUrl }
  );

const isDisabled = displayName.trim() === "" || updateMutation.isPending || !isDirty;
```

## 5. 影響範囲

- **client**: `src/utils/formDirty.ts`（新規）、`src/utils/formDirty.test.ts`（新規）、`src/routes/AccountScene.tsx`（修正）、`src/routes/AccountScene.test.tsx`（テスト追加）
- **common / server**: 変更なし
- **CLAUDE.md**: バリデーションルールに追記

## 6. テスト計画

### ユニットテスト（`formDirty.test.ts`）
1. 全フィールドが同一 → false
2. 1 フィールドが異なる → true
3. 複数フィールドが全て同一 → false
4. 一部のフィールドのみ異なる → true

### コンポーネントテスト（`AccountScene.test.tsx`）
5. 変更なし → 保存ボタンが disabled
6. 変更あり（displayName 変更）→ 保存ボタンが enabled
7. 変更後に初期値へ戻す → 保存ボタンが disabled

## 7. リスク・未決事項

- `isShallowDirty` は浅い比較のみ。フォームフィールドがネストしたオブジェクト（例: 住所オブジェクト）を持つ場合は別途対応が必要（現時点では該当フォームなし）。
