-- AlterTable
ALTER TABLE "Surprise" ADD COLUMN "inviteTokenHash" TEXT;
ALTER TABLE "Surprise" ADD COLUMN "linkPasswordHash" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "AiUse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surpriseId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "fromName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reaction_surpriseId_fkey" FOREIGN KEY ("surpriseId") REFERENCES "Surprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surpriseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contribution_surpriseId_fkey" FOREIGN KEY ("surpriseId") REFERENCES "Surprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiUse_userId_createdAt_idx" ON "AiUse"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Reaction_surpriseId_createdAt_idx" ON "Reaction"("surpriseId", "createdAt");

-- CreateIndex
CREATE INDEX "Contribution_surpriseId_createdAt_idx" ON "Contribution"("surpriseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Surprise_inviteTokenHash_key" ON "Surprise"("inviteTokenHash");

