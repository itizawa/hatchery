-- AddColumn: Community.iconUrl / Community.coverUrl（#457）
-- admin がコミュニティのアイコン・カバー画像をアップロードする GCS 保存基盤（ADR-0022 を流用）。
-- iconUrl / coverUrl は GCS の公開 URL を格納する任意フィールド（最大 500 文字・#91）。

ALTER TABLE "Community" ADD COLUMN "iconUrl" TEXT;
ALTER TABLE "Community" ADD COLUMN "coverUrl" TEXT;
