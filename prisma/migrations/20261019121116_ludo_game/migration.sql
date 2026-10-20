BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ludo_rooms" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "state" TEXT NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'waiting',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ludo_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ludo_rooms_code_key" ON "ludo_rooms"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ludo_rooms_status_updated_at_idx" ON "ludo_rooms"("status", "updated_at");

COMMIT;
