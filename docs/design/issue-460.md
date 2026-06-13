# 設計書: Suspense クエリ移行の基盤（react-error-boundary 導入と共通 QueryBoundary）を整える (#460)

> 親 Issue #459 のサブタスク（1/4・**基盤。他サブの前提**）

## 1. 目的 / 背景

#459 で client のサーバ状態取得を `useSuspenseQuery` へ統一するにあたり、Suspense の `fallback`（ローディング）と取得失敗時の表示を担う **ErrorBoundary 基盤**が必要。現状 `react-error-boundary` は未導入で、ErrorBoundary も存在しない。ルートは既に `lazyRouteComponent` + `<Suspense>`（`client/src/router.tsx`・`client/src/routes/RootLayout.tsx`）でコード分割済み。

本 Issue は **基盤の用意のみ**を行い、実データの `useSuspenseQuery` 移行（#459 の他サブ）は行わない。既存挙動を壊さないことを最優先とする。

## 2. スコープ（やること / やらないこと）

### やること
- `react-error-boundary` を client の依存に追加する。
- `QueryErrorResetBoundary`（TanStack Query）+ `react-error-boundary` の `ErrorBoundary` + `<Suspense>` を合成した共通コンポーネント `client/src/components/QueryBoundary.tsx` を追加する。
- 既定のエラーフォールバック UI（メッセージ + 「再試行」ボタン）を提供しつつ、`fallback`（ローディング）と `errorFallback`（エラー表示）を差し替え可能にする。
- 単体テスト（`QueryBoundary.test.tsx`）で受け入れ条件 (a)(b)(c) を検証する。

### やらないこと
- 実データの `useSuspenseQuery` 移行（#459 の他サブで実施）。
- 既存ルートの `<Suspense fallback>` の差し替え（基盤を import するだけで挙動を変えない）。
- `queryClient.ts` の `throwOnError` 等の方針変更（実データ移行時に各サブで判断する。本 Issue では既定挙動を変えない）。

## 3. 設計

### コンポーネント API（`QueryBoundary`）

```tsx
export interface QueryBoundaryProps {
  /** Suspense 中に表示するローディング（未指定なら null）。 */
  fallback?: ReactNode;
  /**
   * エラー時に表示する内容。reset（再試行）関数と error を受け取り ReactNode を返す。
   * 未指定なら既定の DefaultQueryErrorFallback（メッセージ + 再試行ボタン）を表示する。
   */
  errorFallback?: (props: QueryErrorFallbackProps) => ReactNode;
  children: ReactNode;
}

export interface QueryErrorFallbackProps {
  error: Error;
  /** ErrorBoundary と QueryErrorResetBoundary の両方をリセットして再取得を試みる。 */
  reset: () => void;
}
```

合成構造（外→内）:

```
<QueryErrorResetBoundary>            // TanStack Query: 失敗 query の reset 手段を提供
  {({ reset }) => (
    <ErrorBoundary                    // react-error-boundary
      onReset={reset}                 // 再試行で query キャッシュもリセット
      fallbackRender={({ error, resetErrorBoundary }) =>
        errorFallback({ error, reset: resetErrorBoundary })}
    >
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  )}
</QueryErrorResetBoundary>
```

- `reset`（フォールバックに渡す）は `resetErrorBoundary` を指す。`ErrorBoundary.onReset` で `QueryErrorResetBoundary` の `reset` を呼び、失敗した query を再取得可能状態へ戻す。これにより「再試行」ボタンで子が再レンダリングされ、再フェッチが走る。
- `fallbackRender` は `react-error-boundary` の API。`error` は `Error` 型（throw された値が Error でない場合も RTL 上は Error にラップされる前提だが、型は `Error` で受ける）。

### 既定エラーフォールバック（`DefaultQueryErrorFallback`）

- MUI（`Box` / `Typography` / `Button`、`uiParts` 経由）でメッセージ「データの取得に失敗しました」+ 「再試行」ボタンを表示。
- 「再試行」クリックで `reset` を呼ぶ。
- `role`/`aria` でテスト・アクセシビリティ容易性を確保（ボタンは `name: "再試行"`）。

### import 境界

- client → common の一方向のみ。`react-error-boundary` は外部依存で境界に影響しない。common には何も追加しない。

## 4. 受け入れ条件（テストに落とせる粒度）

- AC1: `react-error-boundary` が `client/package.json` の `dependencies` に追加されている。
- AC2: `client/src/components/QueryBoundary.tsx` が存在し、`fallback` / `errorFallback` を差し替え可能な共通コンポーネントとして `QueryErrorResetBoundary` + `ErrorBoundary` + `Suspense` を合成する。
- AC3-a: 子が throw したとき、エラーフォールバック（既定 or 指定）が表示される。
- AC3-b: 「再試行」クリックで `reset`（`resetErrorBoundary` → `onReset`）が呼ばれ、子が再レンダリングされる（throw しなくなった子が表示される）。
- AC3-c: 子が Suspend している間 `fallback` が表示される。
- AC4: 既存ルート・既存挙動を壊さない（本 Issue では基盤を呼び出す側を変更しない）。
- AC5: `pnpm turbo run build test lint` 緑。client → common 一方向 import を守る。

## 5. テスト方針（TDD）

`client/src/components/QueryBoundary.test.tsx`（RTL + Vitest）:

1. **エラー表示**: 常に throw する子を `QueryBoundary` で包み、既定フォールバックのメッセージが表示されることを assert。
2. **再試行で再レンダリング**: 1 回目は throw・2 回目は正常表示する子（外部フラグで切替）を包み、「再試行」クリック後に正常表示へ切り替わることを assert。`onReset` 経由で reset が呼ばれることも spy で確認。
3. **Suspense fallback**: 解決しない Promise を throw する子を包み、`fallback` が表示されることを assert。
4. **errorFallback 差し替え**: カスタム `errorFallback` を渡すと既定の代わりにそれが表示されることを assert。

エラー throw 時に React が出す `console.error` はテスト内で抑制する。

## 6. e2e ユースケース

本 Issue は **基盤の追加のみ**でユーザー可視の振る舞いを変えない（既存ルートの挙動は不変・新規画面/遷移なし）。よって `e2e/` のユースケース更新は不要。実データ移行（#459 の他サブ）でエラーフォールバックが実画面に現れる時点で、該当サブが usecases を更新する。
