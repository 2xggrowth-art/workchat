-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STAFF');

-- AlterTable: Remove OTP fields, add password auth fields
ALTER TABLE "users" DROP COLUMN IF EXISTS "otp_code";
ALTER TABLE "users" DROP COLUMN IF EXISTS "otp_expires_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "is_verified";

ALTER TABLE "users" ADD COLUMN "password" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'STAFF';
ALTER TABLE "users" ADD COLUMN "is_approved" BOOLEAN NOT NULL DEFAULT false;
