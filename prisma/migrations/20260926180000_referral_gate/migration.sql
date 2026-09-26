-- Every roll now needs a referral code: one-time for a person, a set number of rolls for a
-- business. The per-address allowance goes, and the requests it collected are kept.

-- CreateEnum
CREATE TYPE "CodeKind" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- AlterTable
ALTER TABLE "Referrer" ADD COLUMN     "kind" "CodeKind" NOT NULL DEFAULT 'BUSINESS',
ADD COLUMN     "maxUses" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "used" INTEGER NOT NULL DEFAULT 0;

-- Business codes were unlimited until now: count what each has created, and leave ten more.
UPDATE "Referrer" SET "used" = (SELECT count(*) FROM "Roll" WHERE "Roll"."referrerId" = "Referrer"."id");
UPDATE "Referrer" SET "maxUses" = "used" + 10;

-- DropTable
DROP TABLE "BetaAccess";

-- RenameTable
ALTER TABLE "BetaRequest" RENAME TO "CodeRequest";
ALTER TABLE "CodeRequest" RENAME CONSTRAINT "BetaRequest_pkey" TO "CodeRequest_pkey";
ALTER INDEX "BetaRequest_createdAt_idx" RENAME TO "CodeRequest_createdAt_idx";

-- A request is an address and nothing else.
ALTER TABLE "CodeRequest" DROP COLUMN "name",
DROP COLUMN "phone",
DROP COLUMN "eventType",
DROP COLUMN "remarks";

-- CreateTable
CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rollName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Redemption_referrerId_idx" ON "Redemption"("referrerId");

-- CreateIndex
CREATE INDEX "Redemption_userId_idx" ON "Redemption"("userId");

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
