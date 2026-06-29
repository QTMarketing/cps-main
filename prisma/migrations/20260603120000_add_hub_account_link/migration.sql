-- CreateTable
CREATE TABLE "HubAccountLink" (
    "id" SERIAL NOT NULL,
    "hub_user_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "linked_via" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubAccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HubAccountLink_hub_user_id_key" ON "HubAccountLink"("hub_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "HubAccountLink_user_id_key" ON "HubAccountLink"("user_id");

-- AddForeignKey
ALTER TABLE "HubAccountLink" ADD CONSTRAINT "HubAccountLink_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
