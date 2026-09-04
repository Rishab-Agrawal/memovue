-- Roll creation stops costing a single-use code and starts costing an allowance on an email.
--
-- `Coupon` goes rather than being left behind unread: every row in it is a beta code that
-- has either been spent on a roll that still exists, or was never handed out.

-- DropTable
DROP TABLE "Coupon";

-- CreateTable
CREATE TABLE "BetaAccess" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rollsLeft" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetaAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "eventType" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BetaAccess_email_key" ON "BetaAccess"("email");

-- CreateIndex
CREATE INDEX "BetaRequest_createdAt_idx" ON "BetaRequest"("createdAt");
