# 設計書: attachCommentCount テスト追加 (#586)

## 1. 目的 / 背景

`server/src/routes/commentCount.ts` の `attachCommentCount` は N+1 回避・空配列早期 return・
`?? 0` フォールバックという 3 つの境界を持つが、専用ユニットテストが存在しない（#500 のフィード件数表示の正しさに直結）。
`server/src/routes/commentCount.test.ts` を新設してこれらの境界を固定する（#586）。

## 2. スコープ（やること / やらないこと）

- やること: `server/src/routes/commentCount.test.ts` を新設してユニットテストを追加する
- やらないこと: `commentCount.ts` 本体の実装変更、他ファイルへの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- 空配列入力のとき `[]` を即返す（early return / DB 呼び出し 0 回）
- Map に存在する post には正しい commentCount が付く
- Map に存在しない post は commentCount=0（`?? 0` フォールバック）
- `countByPostIds` は複数 post に対して 1 回だけ呼ばれる（N+1 でない）

## 4. 設計方針

- `countByPostIds` を `vi.fn()` でスタブ化した fake `CommentRepository` を使う
- `vi.fn().mockResolvedValue(map)` で返り値を制御し、呼び出し回数を `expect(...).toHaveBeenCalledTimes(1)` で検証する
- `postResponse.test.ts` / `communityResponse.test.ts` と同じパターンを踏襲する

## 5. 影響範囲 / 既存への変更

- 追加: `server/src/routes/commentCount.test.ts`（新規ファイルのみ）
- 変更なし: 本体実装・他ルート・共通層

## 6. テスト計画（TDDで書くテスト一覧）

1. 空配列入力 → `[]` を返し、`countByPostIds` は呼ばれない
2. Map にある post → 正しい件数が付く
3. Map にない post → `commentCount=0`（フォールバック）
4. 複数 post → `countByPostIds` は 1 回だけ呼ばれる

## 7. リスク・未決事項

なし（純粋なテスト追加のため実装リスクなし）
