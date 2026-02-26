-- AlterTable: Add is_favourited to chat_members
ALTER TABLE "chat_members" ADD COLUMN "is_favourited" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: blocked_users
CREATE TABLE "blocked_users" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blocked_users_blocker_id_blocked_id_key" ON "blocked_users"("blocker_id", "blocked_id");

-- CreateIndex
CREATE INDEX "blocked_users_blocker_id_idx" ON "blocked_users"("blocker_id");

-- CreateIndex
CREATE INDEX "blocked_users_blocked_id_idx" ON "blocked_users"("blocked_id");
