-- AlterTable
ALTER TABLE "chat_members" ADD COLUMN     "pinned_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "edited_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "chats_org_id_idx" ON "chats"("org_id");

-- CreateIndex
CREATE INDEX "users_org_id_idx" ON "users"("org_id");
