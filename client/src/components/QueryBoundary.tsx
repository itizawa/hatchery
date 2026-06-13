import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense, type ReactElement, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { Box, Button, Typography } from "./uiParts";

/** エラーフォールバックへ渡す props（取得失敗時の表示と再試行に必要な最小限）。 */
export interface QueryErrorFallbackProps {
  /** throw されたエラー。 */
  error: Error;
  /**
   * ErrorBoundary と QueryErrorResetBoundary の両方をリセットして再取得を試みる。
   * 「再試行」操作で呼ぶと失敗した query が再フェッチ可能状態に戻り、子が再レンダリングされる。
   */
  reset: () => void;
}

export interface QueryBoundaryProps {
  /** Suspense 中（データ取得待ち）に表示するローディング。未指定なら null。 */
  fallback?: ReactNode;
  /**
   * エラー時に表示する内容を返す関数。未指定なら DefaultQueryErrorFallback
   * （メッセージ + 「再試行」ボタン）を表示する。
   */
  errorFallback?: (props: QueryErrorFallbackProps) => ReactNode;
  /** Suspense / ErrorBoundary を適用する子要素（useSuspenseQuery を使うコンポーネント等）。 */
  children: ReactNode;
}

/**
 * 既定のエラーフォールバック。取得失敗メッセージと「再試行」ボタンを表示する。
 * 「再試行」で reset を呼び、失敗した query を再フェッチ可能状態へ戻して子を再レンダリングする。
 */
const DefaultQueryErrorFallback = ({ reset }: QueryErrorFallbackProps): ReactElement => (
  <Box
    role="alert"
    sx={{
      p: 3,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 1.5,
    }}
  >
    <Typography color="text.secondary">データの取得に失敗しました。</Typography>
    <Button variant="outlined" onClick={reset}>
      再試行
    </Button>
  </Box>
);

/**
 * Suspense クエリ移行の共通基盤（#460）。
 *
 * `QueryErrorResetBoundary`（TanStack Query）+ `react-error-boundary` の `ErrorBoundary`
 * + `<Suspense>` を合成し、ローディング（fallback）と再取得可能なエラー表示（errorFallback）を
 * まとめて適用する。`useSuspenseQuery` を使う子をこれで包むと、取得待ちは fallback、
 * 取得失敗はエラーフォールバック（既定では「再試行」ボタン付き）で表示できる。
 *
 * 「再試行」（reset）は ErrorBoundary のリセットと query キャッシュのリセットを同時に行うため、
 * ボタン押下で失敗した query が再フェッチされる。
 */
export const QueryBoundary = ({
  fallback = null,
  errorFallback,
  children,
}: QueryBoundaryProps): ReactElement => (
  <QueryErrorResetBoundary>
    {({ reset }) => (
      <ErrorBoundary
        onReset={reset}
        fallbackRender={({ error, resetErrorBoundary }) => {
          const props: QueryErrorFallbackProps = {
            error: error as Error,
            reset: resetErrorBoundary,
          };
          return errorFallback ? errorFallback(props) : <DefaultQueryErrorFallback {...props} />;
        }}
      >
        <Suspense fallback={fallback}>{children}</Suspense>
      </ErrorBoundary>
    )}
  </QueryErrorResetBoundary>
);
