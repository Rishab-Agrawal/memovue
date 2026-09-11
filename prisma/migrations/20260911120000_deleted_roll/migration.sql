-- A roll's note after deletion, so the query topic can tell a host who deleted everything from
-- one whose rolls expired and one who never made any. Nothing deleted before this exists in it.

-- CreateEnum
CREATE TYPE "DeletedBy" AS ENUM ('HOST', 'EXPIRY');

-- CreateTable
CREATE TABLE "DeletedRoll" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "deletedBy" "DeletedBy" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,

    CONSTRAINT "DeletedRoll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeletedRoll_hostId_idx" ON "DeletedRoll"("hostId");

-- AddForeignKey
ALTER TABLE "DeletedRoll" ADD CONSTRAINT "DeletedRoll_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
