-- AlterTable: Post にタグ一覧カラムを追加（#1087）
ALTER TABLE "Post" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
