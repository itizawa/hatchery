# Design: Issue #598 — CLAUDE.md の client api パス参照を現状に更新

## 背景・目的

`CLAUDE.md` L84「client ↔ server の型共有」節が `client/src/api/{auth,channels,scenes,admin}.ts` を参照しているが、実体は `channels.ts` / `scenes.ts` が存在せず、以下のファイルに移行済み:

- `auth.ts`
- `communities.ts`
- `workers.ts`
- `workerCommunities.ts`
- `admin.ts`
- `batchLogs.ts`
- `feed.ts`
- `posts.ts`
- `subscriptions.ts`
- `tokenUsage.ts`
- `votes.ts`
- `errors.ts`

また同節で「参照実装: `client/src/routes/LoginScene.tsx`」と記載していたが、`LoginScene.tsx` は存在せず、実際のフォーム参照実装は `client/src/routes/AccountScene.tsx` に該当する。

## 受け入れ条件の実装方針

1. `CLAUDE.md` L84 の `{auth,channels,scenes,admin}.ts` → 実在ファイル群の列挙に更新
2. L109 の `LoginScene.tsx` → `AccountScene.tsx` に更新（フォーム参照実装として実在する）
3. その他の旧パス参照を全文 grep で確認・更新

## 変更対象ファイル

- `CLAUDE.md` のみ（ドキュメント修正）
- コード変更なし → TDD 対象外（受け入れ条件は grep コマンドで検証可能）

## 検証方法

```sh
# 受け入れ条件 1: 旧パス参照が 0 件
grep -c "channels,scenes" CLAUDE.md  # => 0

# 受け入れ条件 2: LoginScene 参照が 0 件
grep -c "LoginScene" CLAUDE.md  # => 0
```
