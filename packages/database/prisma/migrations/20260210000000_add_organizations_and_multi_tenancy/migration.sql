-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "org_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_org_code_key" ON "organizations"("org_code");

-- Create a default organization for existing data
INSERT INTO "organizations" ("id", "name", "org_code", "created_at")
VALUES ('default_org', 'Default Organization', 'WRK-0000', CURRENT_TIMESTAMP);

-- AlterTable: Add orgId to users (with default for existing rows)
ALTER TABLE "users" ADD COLUMN "org_id" TEXT;
UPDATE "users" SET "org_id" = 'default_org' WHERE "org_id" IS NULL;
ALTER TABLE "users" ALTER COLUMN "org_id" SET NOT NULL;

-- AlterTable: Add status column, migrate from is_approved
ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'PENDING';
UPDATE "users" SET "status" = 'ACTIVE' WHERE "is_approved" = true;
UPDATE "users" SET "status" = 'PENDING' WHERE "is_approved" = false;

-- AlterTable: Add approved_by column
ALTER TABLE "users" ADD COLUMN "approved_by" TEXT;

-- AlterTable: Drop is_approved (no longer needed)
ALTER TABLE "users" DROP COLUMN IF EXISTS "is_approved";

-- AlterTable: Add orgId to chats
ALTER TABLE "chats" ADD COLUMN "org_id" TEXT;
UPDATE "chats" SET "org_id" = 'default_org' WHERE "org_id" IS NULL;
ALTER TABLE "chats" ALTER COLUMN "org_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
