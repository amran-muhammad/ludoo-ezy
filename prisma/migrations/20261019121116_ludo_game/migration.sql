BEGIN;

/*
  Warnings:

  - You are about to drop the `contact_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscribers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE IF EXISTS "contact_messages";

-- DropTable
DROP TABLE IF EXISTS "subscribers";

COMMIT;

-- CreateTable
CREATE TABLE "ludo_rooms" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "state" TEXT NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'waiting',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ludo_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ludo_rooms_code_key" ON "ludo_rooms"("code");

-- CreateIndex
CREATE INDEX "ludo_rooms_status_updated_at_idx" ON "ludo_rooms"("status", "updated_at");
