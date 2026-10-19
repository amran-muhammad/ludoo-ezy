BEGIN;

-- CreateTable
CREATE TABLE "subscribers" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "first_name" VARCHAR(60),
    "tier" VARCHAR(10) NOT NULL DEFAULT 'free',
    "source" VARCHAR(30) NOT NULL DEFAULT 'home',
    "status" VARCHAR(15) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "topic" VARCHAR(20) NOT NULL DEFAULT 'general',
    "body" VARCHAR(4000) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers"("email");

-- CreateIndex
CREATE INDEX "subscribers_status_id_idx" ON "subscribers"("status", "id");

COMMIT;
