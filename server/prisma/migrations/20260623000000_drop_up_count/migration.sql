-- AlterTable: Post.upCount を削除（#856 - display 専用で score で代替）
ALTER TABLE "Post" DROP COLUMN "upCount";

-- AlterTable: Comment.upCount を削除（#856 - display 専用で score で代替）
ALTER TABLE "Comment" DROP COLUMN "upCount";
