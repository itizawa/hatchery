import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { Box, Button, Typography } from "../components/uiParts";

/**
 * グローバル 404 コンポーネント（#529）。
 *
 * 未マッチ URL（TanStack Router が認識しないルート）を開いたときに表示する。
 * アプリシェル（ヘッダー/サイドバー）の内側にレンダリングされるため、
 * `createRootRoute` の `notFoundComponent` に指定して使う。
 *
 * - 日本語で「ページが見つかりません」と明示する
 * - ホーム（/）への MUI Button 導線を提供して回遊を促す
 */
export const NotFoundScene = (): ReactElement => {
  return (
    <Box
      component="section"
      sx={{ textAlign: "center", py: 8, px: 3, maxWidth: 600, mx: "auto" }}
    >
      <Typography variant="h5" component="h1" gutterBottom>
        ページが見つかりません
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        お探しのページは存在しないか、移動・削除された可能性があります。
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        ホームへ戻る
      </Button>
    </Box>
  );
};
