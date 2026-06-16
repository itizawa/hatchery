import { type ReactElement } from "react";
import { Avatar, Box, CircularProgress, Tooltip } from "./uiParts";

import { useUploadWorkerImage } from "../api/workers.js";
import { useImageUpload, ACCEPTED_MIME } from "../hooks/useImageUpload.js";

export interface WorkerImageUploadProps {
  /** 対象 Worker の ID */
  workerId: string;
  /** 表示名（Avatar のイニシャルとalt テキストに使用） */
  displayName: string;
  /** 現在の画像 URL（null の場合はイニシャルフォールバック） */
  currentImageUrl: string | null;
  /** アップロード成功後のコールバック */
  onSuccess?: (result: { id: string; imageUrl: string }) => void;
}

const AVATAR_SIZE = 48;

/**
 * ワーカーのアバター画像アップロードコンポーネント（#204 / #329）。
 * Avatar をクリックするとファイル選択ダイアログが開く。
 * アップロード中はオーバーレイでスピナーを表示する。
 * - admin のみが使用する（管理画面でのみ表示すること）。
 * - 未設定時はイニシャルのフォールバック。
 */
export const WorkerImageUpload = ({
  workerId,
  displayName,
  currentImageUrl,
  onSuccess,
}: WorkerImageUploadProps): ReactElement => {
  const upload = useUploadWorkerImage();
  const { inputRef, handleClick, handleFileChange, handleKeyDown } = useImageUpload({
    upload: (file) => upload.mutateAsync({ workerId, file }),
    isPending: upload.isPending,
    onSuccess,
  });

  return (
    <Tooltip title="クリックして画像をアップロード" placement="top">
      <Box
        sx={{
          position: "relative",
          display: "inline-block",
          cursor: upload.isPending ? "not-allowed" : "pointer",
        }}
        onClick={upload.isPending ? undefined : handleClick}
        role="button"
        aria-label={`${displayName} の画像をアップロード`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <Avatar
          src={currentImageUrl ?? undefined}
          alt={displayName}
          sx={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            opacity: upload.isPending ? 0.5 : 1,
          }}
        >
          {displayName[0]}
        </Avatar>
        {upload.isPending && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress size={24} />
          </Box>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME}
          style={{ display: "none" }}
          onChange={(e) => { void handleFileChange(e); }}
          aria-hidden="true"
        />
      </Box>
    </Tooltip>
  );
};
