# 設計書: invitationLinkRepository（インメモリ実装）のユニットテストを追加する (#377)

## 1. 目的 / 背景

`server/src/persistence/invitationLinkRepository.ts` のインメモリ実装は、招待リンクの token 照合・有効期限・使用済み/失効遷移というセキュリティ上重要な分岐を持つが、対応する単体テストが存在しない（`routes/invitations.test.ts` でルート経由の間接検証のみ）。
リポジトリ単体のユニットテストを追加し、DB 非依存で回帰を検出できるようにする。

## 2. スコープ（やること / やらないこと）

**やること:**
- `server/src/persistence/invitationLinkRepository.test.ts` を新規追加
- `createInMemoryInvitationLinkRepository` の公開メソッド（create / list / findByToken / revoke / markUsed）と `toInvitationLinkResponse` を検証
- TDD: まずテストを書き → 失敗確認（新規テストなので「テストが存在しない状態」からの追加。実装は既存のため緑化はテストのみで完結）

**やらないこと:**
- `prismaInvitationLinkRepository.ts` の実 DB テスト（別 Issue 候補）
- `invitationLinkRepository.ts` の実装変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. create で作成したリンクを `findByToken` で取得できる / 未知 token は `null` を返す
2. 有効期限切れ（`expiresAt` が過去）のリンクは `markUsed` が `null` を返し、`toInvitationLinkResponse` の status が `"expired"` になる
3. `markUsed` 成功後の再 `markUsed` は `null` を返す（使用済みは再使用不可）。`revoke` 済みも `markUsed` 不可
4. memo（任意）を含むレコードが正しく保持される / 未指定は `null`
5. 時間依存は相対時刻（`Date.now()` ± オフセット）または `toInvitationLinkResponse(record, now)` への固定 now 注入でフレークを排除
6. `pnpm turbo run build test lint` が緑 / `server → common` の一方向 import 境界を守る

## 4. 設計方針

- 参照実装 `subscriptionRepository.test.ts` のスタイル（describe をメソッド単位で分割）に合わせる
- 期限判定はテスト側で `expiresAt` に「現在 +1 時間 / −1 時間」の相対時刻を与えることで安定化。境界の厳密判定（`<=`）は `toInvitationLinkResponse` の now 注入で固定時刻比較する
- 返却値が内部レコードのコピー（防御的コピー）であることも検証する

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `server/`
- 新規ファイル: `server/src/persistence/invitationLinkRepository.test.ts`
- 既存コードの変更: なし

## 6. テスト計画（TDD で書くテスト一覧）

- create: token・memo・createdByUserId を保持して作成できる / memo 未指定は null / usedAt・revokedAt は初期 null
- findByToken: 作成済み token で取得できる / 未知 token は null / 返却値はコピー（書き換えても内部状態に影響しない）
- list: createdAt 降順で全件返す
- revoke: revokedAt がセットされる / 存在しない id は null
- markUsed: 有効なリンクは usedAt・usedByUserId がセットされる / 使用済み・revoke 済み・期限切れ・存在しない id は null
- toInvitationLinkResponse: active / expired / used / revoked の status を now 注入で判定。内部情報（usedByUserId・createdByUserId）を含まない
