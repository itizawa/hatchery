import { useRef, type ReactElement } from "react";
import { Avatar, Box, CircularProgress, Tooltip } from "./uiParts";

import { useUploadCommunityImage, type CommunityImageKind } from "../api/communities.js";

export interface CommunityImageUploadProps {
  /** 対象 Community の ID */
  communityId: string;
  /** アイコン / カバーの種別（#457） */
  kind: CommunityImageKind;
  /** コミュニティ名（Avatar のイニシャル・alt テキストに使用） */
  name: string;
  /** 現在の画像 URL（null の場合はプレースホルダ） */
  currentImageUrl: string | null;
  /** アップロード成功後のコールバック */
  onSuccess?: (result: { id: string; iconUrl?: string | null; coverUrl?: string | null }) => void;
}

const ICON_SIZE = 64;
const COVER_HEIGHT = 96;
const ACCEPTED_MIME = "image/png,image/jpeg,image/webp,image/gif";

/**
 * コミュニティのアイコン / カバー画像アップロードコンポーネント（#457）。
 * WorkerImageUpload（#204）を community 向けに流用した汎用版。
 * - kind="icon": 丸い Avatar（未設定はイニシャルのフォールバック）。
 * - kind="cover": 横長の矩形（未設定はテーマ色のプレースホルダ）。
 * クリックするとファイル選択ダイアログが開き、選択後に即時アップロードする。
 * admin のみが使用する（管理画面でのみ表示すること）。
 */
export const CommunityImageUpload = ({
  communityId,
  kind,
  name,
  currentImageUrl,
  onSuccess,
}: CommunityImageUploadProps): ReactElement => {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCommunityImage();

  const kindLabel = kind === "icon" ? "アイコン" : "カバー";

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const result = await upload.mutateAsync({ communityId, kind, file });
    onSuccess?.(result);
  };

  const preview =
    kind === "icon" ? (
      <Avatar
        src={currentImageUrl ?? undefined}
        alt={name}
        sx={{ width: ICON_SIZE, height: ICON_SIZE, opacity: upload.isPending ? 0.5 : 1 }}
      >
        {name[0]}
      </Avatar>
    ) : (
      <Box
        sx={{
          width: "100%",
          height: COVER_HEIGHT,
          borderRadius: 1,
          overflow: "hidden",
          opacity: upload.isPending ? 0.5 : 1,
          bgcolor: "action.hover",
        }}
      >
        {currentImageUrl && (
          <Box
            component="img"
            src={currentImageUrl}
            alt={name}
            sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
      </Box>
    );

  return (
    <Tooltip title={`クリックして${kindLabel}画像をアップロード`} placement="top">
      <Box
        sx={{
          position: "relative",
          display: kind === "icon" ? "inline-block" : "block",
          width: kind === "cover" ? "100%" : undefined,
          cursor: upload.isPending ? "not-allowed" : "pointer",
        }}
        onClick={upload.isPending ? undefined : handleClick}
        role="button"
        aria-label={`${name} の${kindLabel}画像をアップロード`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!upload.isPending) handleClick();
          }
        }}
      >
        {preview}
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
          onChange={(e) => {
            void handleFileChange(e);
          }}
          aria-hidden="true"
        />
      </Box>
    </Tooltip>
  );
};
