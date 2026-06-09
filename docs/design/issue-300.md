# 設計書: Issue #300 — チャンネルのメッセージ一覧で発言者（Employee）の画像をメッセージの左に表示する

## 概要

チャンネル詳細画面（`ChannelView.tsx`）のメッセージ一覧に、各メッセージの左側に発言者（Employee）のアバター画像を表示する。画像未設定の Employee はイニシャルのフォールバックを表示し、Slack のような「アイコン + 名前 + 本文」のレイアウトを実現する。

## 前提フィールド名

`Employee.imageUrl`（`string | undefined`）。

`#220` の実装により、`EmployeeSchema` には既に以下が追加されている：

```typescript
imageUrl: z.string().url().max(EMPLOYEE_IMAGE_URL_MAX_LENGTH).optional()
```

`#204` では GCS へのアップロード基盤と実際の画像データの入れ方が実装される予定。本 Issue はフィールドが `undefined` の状態でも正しく動作する（イニシャルフォールバック）。

## 実装方針

### 1. common: `createAvatarUrlResolver` 関数の追加

`common/src/domain/employee/employee.ts` に純粋関数を追加する。

```typescript
createAvatarUrlResolver(employees): (employeeId: string) => string | undefined
```

- `employees` を受け取り、`id → imageUrl` のマップを 1 度だけ構築する（O(1) 解決）。
- 指定 `employeeId` が見つかれば `imageUrl`（`string | undefined`）を返す。
- `employeeId` が未解決の場合は `undefined` を返す。
- React/DOM 非依存の純粋関数として実装する。

### 2. client: `ChannelView.tsx` のレイアウト変更

各メッセージ `ListItem` を「左にアバター列・右に発言者名＋本文」の横並びレイアウトに変更する。

**レイアウト構造（変更後）:**

```
ListItem
  Stack direction="row"
    Avatar (左列・発言者画像またはイニシャル)
    Stack (右列)
      Stack direction="row" (発言者名 + 時刻)
      Typography (本文)
```

- `Avatar` は `uiParts` から import する（既にエクスポート済み）。
- `src={resolveAvatarUrl(message.createdEmployeeId)}` で画像 URL を渡す。
- `alt={resolveDisplayName(message.createdEmployeeId)}` でアクセシビリティを確保する。
- 画像未設定時は `children` にイニシャル（`displayName[0]`）を渡す。
- タイピングインジケータ（`typingEmployeeId`）でも同様のアバターを表示する。

### 3. client テスト: `ChannelView.test.tsx` の拡張

**追加するテストケース（TDD: 先にテストを書く）:**
- 画像 URL を持つ Employee の発言で `<img>` 要素（Avatar）が描画される
- 画像未設定の Employee ではイニシャルのフォールバックが表示される
- 既存テスト群は変更しない（全て通過させる）

### 4. Storybook: `ChannelView.stories.tsx` の更新

`Default` ストーリーに画像あり / 画像なしの Employee が混在するフィクスチャを追加し、両者の見た目を確認できるようにする。

## 参照実装

- `client/src/components/EmployeeTable.tsx` — 同じ Avatar + src + イニシャルフォールバックパターンの参照実装
- `client/src/components/uiParts/index.ts` — `Avatar` は既にエクスポート済み

## 依存関係

- `Employee.imageUrl` フィールドは `#220` で既にスキーマ追加済み
- `#204` は GCS アップロード基盤・管理画面アップロード UI（本 Issue のスコープ外）
- 本 Issue は表示のみ担当

## スコープ外

- 画像アップロード UI・GCS 保存（→ #204）
- 管理画面の EmployeeTable での画像表示（→ #220 で実装済み）
- 連続発言時のアバター省略（Slack 風グルーピング）
- メッセージのスレッド表示
