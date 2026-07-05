/**
 * 投稿スレッド外枠共通スタイル（PostThreadScene / PostThreadSkeleton で共用・#1077）。
 * RootLayout の main（column flex）直下では cross軸の auto margin（mx:"auto"）が
 * align-items/align-self の stretch 効果を無効化するため、width:"100%" で明示的な
 * cross size を与える（実測は docs/design/issue-1077.md 参照）。
 * この 2 ファイルは #955 でも sx を手動同期する必要があった経緯があるため、
 * 定数として一元化しズレを防ぐ。
 */
export const postThreadContainerSx = {
  p: 3,
  maxWidth: 1200,
  mx: "auto",
  width: "100%",
} as const;
