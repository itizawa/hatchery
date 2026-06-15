# Issue #540 設計書: maskApiKey のユニットテスト追加

## 背景

`server/src/utils/crypto.ts` の `maskApiKey`（API キーのマスク表示。管理画面 `admin.ts:45` で利用）には分岐があるがテストが無い。秘密情報の表示に関わるため境界の取り違えは漏洩・表示崩れにつながる。

## 対象実装（変更しない）

```ts
export function maskApiKey(value: string): string | null {
  if (!value) return null;
  return value.length > 11 ? value.slice(0, 11) + "****" : value.slice(0, 3) + "****";
}
```

## 受け入れ条件 → テストケース

`server/src/utils/crypto.test.ts` に `describe("maskApiKey", ...)` を追加し、以下を検証する。

| # | 入力 | 期待 | 根拠分岐 |
|---|------|------|----------|
| a | `""`（空文字） | `null` | `if (!value) return null;` |
| b | 11 文字超（例 `sk-ant-xxxxxxxx` = 15 文字） | 先頭 11 文字 + `****`（`sk-ant-xxxx****`） | `value.length > 11` 真 |
| c | 11 文字ちょうど（例 `sk-ant-1234` = 11 文字） | 先頭 3 文字 + `****`（`sk-****`） | `> 11` 偽の else 分岐 |
| d | 3 文字以下（例 `ab` = 2 文字） | `value.slice(0,3)` + `****`（`ab****`） | else 分岐・slice が範囲を超えても安全 |

補足: 12 文字ちょうど（境界の直上）も追加し `> 11` の境界を両側から固定する。

## 設計判断

- **実装は変更しない**。テスト追加のみ（Issue スコープ）。
- 境界値（11 文字ちょうど = else、12 文字 = if）を両方テストして off-by-one を防ぐ。
- `slice(0, 3)` は値が 3 文字未満でも例外を投げずその長さまでを返す JS の仕様を期待値に反映（`"ab".slice(0,3) === "ab"`）。
- ユーザー可視の振る舞いは変わらない（純粋なテスト追加）ため e2e ユースケース更新は不要。

## スコープ外

- encrypt / decrypt / resolveAppSecret（既存テスト済み）。
