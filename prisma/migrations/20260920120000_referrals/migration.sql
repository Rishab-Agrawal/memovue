-- Wedding businesses that send hosts here, and the roll each one sent.
--
-- The code is a name rather than a coupon: nothing is spent, nothing expires, and a roll keeps
-- pointing at the business even after its code is retired. Deleting a business therefore nulls
-- the column rather than taking the roll with it.

-- CreateTable
CREATE TABLE "Referrer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referrer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Referrer_code_key" ON "Referrer"("code");

-- AlterTable
ALTER TABLE "Roll" ADD COLUMN "referrerId" TEXT;

-- CreateIndex
CREATE INDEX "Roll_referrerId_idx" ON "Roll"("referrerId");

-- AddForeignKey
ALTER TABLE "Roll" ADD CONSTRAINT "Roll_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
