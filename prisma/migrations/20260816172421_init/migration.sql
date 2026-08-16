-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HOST', 'ADMIN');

-- CreateEnum
CREATE TYPE "RollStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RevealMode" AS ENUM ('DURING', 'AFTER', 'DELAY');

-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('PENDING', 'READY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "googleId" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'HOST',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Roll" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coverKey" TEXT,
    "coverPreset" INTEGER NOT NULL DEFAULT 0,
    "maxGuests" INTEGER NOT NULL,
    "photosPerGuest" INTEGER NOT NULL,
    "everyoneCanSee" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "finishesAt" TIMESTAMP(3) NOT NULL,
    "revealMode" "RevealMode" NOT NULL DEFAULT 'AFTER',
    "revealDelayHours" INTEGER NOT NULL DEFAULT 0,
    "revealAt" TIMESTAMP(3) NOT NULL,
    "revealedEarly" BOOLEAN NOT NULL DEFAULT false,
    "status" "RollStatus" NOT NULL DEFAULT 'ACTIVE',
    "keptUntil" TIMESTAMP(3) NOT NULL,
    "warnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Roll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "rollId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "userId" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "rollId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "fullKey" TEXT NOT NULL,
    "previewKey" TEXT NOT NULL,
    "blurData" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "status" "PhotoStatus" NOT NULL DEFAULT 'PENDING',
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,
    "redeemedById" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "rollId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Roll_code_key" ON "Roll"("code");

-- CreateIndex
CREATE INDEX "Roll_hostId_idx" ON "Roll"("hostId");

-- CreateIndex
CREATE INDEX "Roll_keptUntil_idx" ON "Roll"("keptUntil");

-- CreateIndex
CREATE INDEX "Guest_rollId_idx" ON "Guest"("rollId");

-- CreateIndex
CREATE INDEX "Guest_userId_idx" ON "Guest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_rollId_nameKey_key" ON "Guest"("rollId", "nameKey");

-- CreateIndex
CREATE INDEX "Photo_rollId_takenAt_idx" ON "Photo"("rollId", "takenAt");

-- CreateIndex
CREATE INDEX "Photo_guestId_idx" ON "Photo"("guestId");

-- CreateIndex
CREATE INDEX "Photo_status_createdAt_idx" ON "Photo"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_rollId_key" ON "Coupon"("rollId");

-- CreateIndex
CREATE INDEX "Coupon_redeemedById_idx" ON "Coupon"("redeemedById");

-- AddForeignKey
ALTER TABLE "Roll" ADD CONSTRAINT "Roll_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "Roll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "Roll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "Roll"("id") ON DELETE SET NULL ON UPDATE CASCADE;
