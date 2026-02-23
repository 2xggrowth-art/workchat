-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_for_everyone" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "message_deleted_for" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_deleted_for_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_deleted_for_user_id_idx" ON "message_deleted_for"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_deleted_for_message_id_user_id_key" ON "message_deleted_for"("message_id", "user_id");

-- AddForeignKey
ALTER TABLE "message_deleted_for" ADD CONSTRAINT "message_deleted_for_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
