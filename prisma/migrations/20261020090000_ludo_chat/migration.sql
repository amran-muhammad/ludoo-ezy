BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ludo_messages" (
    "id" SERIAL NOT NULL,
    "room_code" VARCHAR(8) NOT NULL,
    "player_name" VARCHAR(30) NOT NULL,
    "color" VARCHAR(10) NOT NULL,
    "body" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ludo_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ludo_messages_room_code_id_idx" ON "ludo_messages"("room_code", "id");

COMMIT;
