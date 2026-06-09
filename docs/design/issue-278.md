# 設計書: チャンネルのメッセージで発言者を Employee の表示名で表示し、投稿時刻も表示する (#278)

## 1. 目的 / 背景

チャンネル詳細のメッセージ一覧で、発言者が `createdEmployeeId`（生の ID）のまま表示されており、投稿時刻も見えない。原因は2点:

1. `ChannelScene` が `ChannelView` に `employees` を渡していない（`DEFAULT_EMPLOYEES` にフォールバック、seed 外の ID は解決不能）
2. `ChannelView.messages` prop が `Message[]` 型（`postedAt` を持たない）のため時刻を取得・表示できない

## 2. スコープ（やること / やらないこと）

**やること:**
- `ChannelScene` に `useBotEmployees()` を追加し `ChannelView` に `employees` を渡す
- `ChannelView.messages` prop 型を `MessageRecord[]`（`postedAt` を含む）に変更する
- 各メッセージの `postedAt` を `HH:mm` 形式で表示する
- テストを追加・更新する

**やらないこと:**
- ユーザー投稿メッセージの名前解決（`useBotEmployees()` が返す範囲に依存）
- 定時バッチ単位のスレッドグルーピング（#250）
- `postedAt` 以外のフィールド追加

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `ChannelScene` が `useBotEmployees()`（GET /api/employees）でEmployees一覧を取得し `ChannelView` に `employees` として渡す
2. `ChannelView.messages` の型が `readonly MessageRecord[]` になり `postedAt` にアクセスできる
3. 各メッセージに `postedAt` の `HH:mm` 形式の時刻が表示される
4. `ChannelView` テスト: `postedAt` を含むメッセージで時刻が表示されること
5. `ChannelScene` テスト: `employees` API モックを追加し displayName が表示される（生の ID が出ない）こと
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 型変更: `Message[]` → `MessageRecord[]`

`ChannelView.messages` の型を `Message`（`createdEmployeeId` + `channel` + `text` のみ）から `MessageRecord`（`id` / `postedAt` / `createdAt` / `order` も含む）に変更する。

- `ChannelScene` がAPIから取得するメッセージは既に `MessageRecord[]` 型であるため（`useChannelMessages` の戻り値、`mockMessages` の型が `MessageRecord[]`）、型を変更しても呼び出し元の修正は不要。
- `ChannelView` テストの fixture を `MessageRecord` 型に更新する。

### 時刻フォーマット

`Intl.DateTimeFormat` を使い、`ChannelView` コンポーネント内でインライン実装する。

```typescript
const formatPostedAt = (date: Date): string =>
  new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
```

純粋関数として切り出す必要性が低いため `ChannelView.tsx` 内に配置（将来的に共通化が必要になれば `common/` に移動）。

### `ChannelScene` への `useBotEmployees()` 追加

`OfficeScene.tsx` の実装パターン（`useBotEmployees()` → `{ data: employees }`）を参照し、`employees ?? []` として `ChannelView` に渡す。`isLoading` / `error` の個別ハンドリングは不要（`ChannelView` が空配列の場合 ID フォールバックを維持する）。

## 5. 影響範囲 / 既存への変更

| ワークスペース | ファイル | 変更内容 |
|---|---|---|
| client | `src/components/ChannelView.tsx` | `messages` 型を `MessageRecord[]` に変更、時刻表示を追加 |
| client | `src/routes/ChannelScene.tsx` | `useBotEmployees()` 追加、`employees` を `ChannelView` に渡す |
| client | `src/components/ChannelView.test.tsx` | fixture を `MessageRecord` 型に更新、時刻表示テストを追加 |
| client | `src/routes/ChannelScene.test.tsx` | employees API モック追加、displayName テストを追加 |

## 6. テスト計画（TDDで書くテスト一覧）

### `ChannelView.test.tsx`（追加・更新）
- `postedAt` を持つ `MessageRecord` 型のメッセージで時刻（`HH:mm` 形式）が表示される
- 既存の displayName 解決テストは fixture を `MessageRecord` に変更して維持

### `ChannelScene.test.tsx`（追加）
- `../api/employees.js` の `useBotEmployees` をモックして `employees` を注入
- モックした employeeの displayName が表示されること（生のIDが表示されないこと）

## 7. リスク・未決事項

- `HH:mm` フォーマットは `Intl.DateTimeFormat` + テスト実行環境（Node.js / jsdom）のタイムゾーンに依存する。テストでは時刻の数値ではなく「`HH:mm` パターンに合う文字列が存在する」または aria-label 等でアサートするか、固定UTCオフセットでDate生成して期待値を計算する方針で対応する。
