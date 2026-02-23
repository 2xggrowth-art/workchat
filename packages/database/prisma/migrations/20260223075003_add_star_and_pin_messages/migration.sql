-- CreateTable
CREATE TABLE "message_starred" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "starred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_starred_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_pinned" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "pinned_by" TEXT NOT NULL,
    "pinned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pinned_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_starred_user_id_starred_at_idx" ON "message_starred"("user_id", "starred_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_starred_message_id_user_id_key" ON "message_starred"("message_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_pinned_message_id_key" ON "message_pinned"("message_id");

-- CreateIndex
CREATE INDEX "message_pinned_chat_id_pinned_at_idx" ON "message_pinned"("chat_id", "pinned_at");

-- AddForeignKey
ALTER TABLE "message_starred" ADD CONSTRAINT "message_starred_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_pinned" ADD CONSTRAINT "message_pinned_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_pinned" ADD CONSTRAINT "message_pinned_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
