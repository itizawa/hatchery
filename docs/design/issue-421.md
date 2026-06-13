# 設計書: 購読状態取得 API を追加し useSubscriptionStatus をサーバー状態に切り替える (#421)

## 1. 目的 / 背景

`useSubscriptionStatus` は `queryFn: () => false` 固定で、リロード後に購読状態がリセットされるバグがある。
サーバ側には購読の永続化は実装済みだが、購読状態を読み出す API が存在しない。
本 Issue では `GET /api/communities/{slug}/subscription` を追加し、フックをサーバー呼び出しに切替える。

## 2. スコープ（やること / やらないこと）

**やること:**
- common に `SubscriptionStatusSchema`（`{ subscribed: boolean }`）を追加
- server に `GET /api/communities/{slug}/subscription` ルートを追加（認証済み: DB 参照、未認証: `{ subscribed: false }`）
- OpenAPI registry に登録（ADR-0006 一方向フロー）
- client の `useSubscriptionStatus` を新 API の queryFn に切替え
- `useSubscribe`/`useUnsubscribe` を `invalidateQueries` に変更（`setQueryData` 廃止）
- server ルートテスト・フックユニットテストを追加

**やらないこと:**
- 購読 community でのフィード絞り込み
- 購読一覧 API（複数 community 購読状態の一括取得）

## 3. 受け入れ条件

1. 認証済みユーザーが `GET /api/communities/{slug}/subscription` を呼ぶと `{ subscribed: true/false }` が返る
2. 未認証ユーザーが同 API を呼ぶと `{ subscribed: false }` が返る（401 ではなく 200）
3. 存在しない slug は 404 を返す
4. `useSubscriptionStatus` がリロード後（QueryClient 新規）も正しい購読状態を返す
5. member/非ログインで既存挙動（ボタン表示・非表示）が壊れない
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### API エンドポイント

```
GET /api/communities/{slug}/subscription
- 認証: 任意（未認証 = subscribed: false として扱う）
- 200: { subscribed: boolean }
- 404: { error: "CommunityNotFound" }
```

未認証でも 200 を返す設計にする理由: クライアント側で認証状態を確認してから条件付きでフックを呼ぶ実装より、
フック内で統一的に扱えるため。

### common スキーマ

```ts
export const SubscriptionStatusSchema = z.object({
  subscribed: z.boolean(),
});
```

### useSubscriptionStatus の変更

```ts
queryFn: () => fetchSubscriptionStatus(communitySlug)
staleTime: Infinity → 30_000（サーバーデータに切替えのため）
```

### useSubscribe / useUnsubscribe の変更

`setQueryData` を廃止し `invalidateQueries` に変更。
API 成功後に subscription クエリを invalidate することで再取得が走る。

## 5. 影響範囲

- `common/src/domain/subscription/subscription.ts` — スキーマ追加
- `common/src/domain/index.ts` — export 追加
- `server/src/routes/communities.ts` — GET ルート追加
- `server/src/openapi/registry.ts` — エンドポイント登録
- `client/src/api/communities.ts` — API 関数追加・useSubscribe/useUnsubscribe 修正
- `client/src/hooks/useSubscriptionStatus.ts` — queryFn 切替
- `server/src/routes/communities.test.ts` — テスト追加
- `client/src/hooks/useSubscriptionStatus.test.ts` — 新規テスト追加

## 6. テスト計画

**server (Vitest + supertest):**
- `GET /api/communities/technology/subscription` — 未購読時 `{ subscribed: false }`
- `GET /api/communities/technology/subscription` — 購読後 `{ subscribed: true }`
- `GET /api/communities/technology/subscription` — 未認証時 `{ subscribed: false }`
- `GET /api/communities/not-exists/subscription` — 404

**client (Vitest + React Testing Library):**
- `useSubscriptionStatus` が初期状態（未購読）で `false` を返す
- `useSubscriptionStatus` が購読済み状態で `true` を返す

## 7. リスク・未決事項

なし。`SubscriptionRepository.hasSubscription` は既に実装済み（インメモリ・Prisma 両方）。
