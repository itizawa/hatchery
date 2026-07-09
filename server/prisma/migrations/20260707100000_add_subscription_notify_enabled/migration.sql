-- #1088: コミュニティ単位の Web Push 通知 ON/OFF を Subscription に追加する。
-- デフォルト true で既存の（グローバル ON/OFF のみだった）通知動作を維持する。

ALTER TABLE "Subscription" ADD COLUMN "notifyEnabled" BOOLEAN NOT NULL DEFAULT true;
