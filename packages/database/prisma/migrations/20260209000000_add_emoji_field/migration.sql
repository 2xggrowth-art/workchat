-- Add missing columns and tables that were in schema but not in previous migrations

-- Users: add emoji
ALTER TABLE "users" ADD COLUMN "emoji" TEXT;

-- Messages: add duration
ALTER TABLE "messages" ADD COLUMN "duration" INTEGER;

-- Tasks: add tags and sop_instructions
ALTER TABLE "tasks" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "tasks" ADD COLUMN "sop_instructions" TEXT;

-- CreateTable: message_reads
CREATE TABLE "message_reads" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_reads_message_id_user_id_key" ON "message_reads"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "message_reads_user_id_read_at_idx" ON "message_reads"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
