import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("本番環境ではシードを実行しません");
    return;
  }

  const passwordHash = await bcrypt.hash("testpass", 10);
  await prisma.user.upsert({
    where: { id: "testuser" },
    update: {},
    create: {
      id: "testuser",
      displayName: "Test User",
      passwordHash,
    },
  });

  console.log("シードユーザーを作成しました: testuser / testpass");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
