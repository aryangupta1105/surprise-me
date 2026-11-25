-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT,
    "name" TEXT,
    "externalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Surprise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "occasion" TEXT NOT NULL,
    "experienceType" TEXT,
    "recipientName" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "title" TEXT,
    "input" JSONB NOT NULL,
    "content" JSONB,
    "theme" JSONB,
    "generationStatus" TEXT NOT NULL DEFAULT 'IDLE',
    "generationError" TEXT,
    "linkTokenHash" TEXT,
    "linkTokenEnc" TEXT,
    "linkRevokedAt" DATETIME,
    "linkExpiresAt" DATETIME,
    "publishedAt" DATETIME,
    "archivedAt" DATETIME,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "lastOpenedAt" DATETIME,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Surprise_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIGeneration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surpriseId" TEXT NOT NULL,
    "section" TEXT,
    "status" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "error" TEXT,
    "output" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIGeneration_surpriseId_fkey" FOREIGN KEY ("surpriseId") REFERENCES "Surprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "surpriseId" TEXT,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Upload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Upload_surpriseId_fkey" FOREIGN KEY ("surpriseId") REFERENCES "Surprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "authId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntegrationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surpriseId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledFor" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" DATETIME,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Delivery_surpriseId_fkey" FOREIGN KEY ("surpriseId") REFERENCES "Surprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalendarReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "surpriseId" TEXT,
    "title" TEXT NOT NULL,
    "occasionDate" DATETIME NOT NULL,
    "remindMinutes" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "eventId" TEXT,
    "eventLink" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CalendarReminder_surpriseId_fkey" FOREIGN KEY ("surpriseId") REFERENCES "Surprise" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Surprise_linkTokenHash_key" ON "Surprise"("linkTokenHash");

-- CreateIndex
CREATE INDEX "Surprise_ownerId_status_idx" ON "Surprise"("ownerId", "status");

-- CreateIndex
CREATE INDEX "AIGeneration_surpriseId_createdAt_idx" ON "AIGeneration"("surpriseId", "createdAt");

-- CreateIndex
CREATE INDEX "Upload_ownerId_idx" ON "Upload"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_userId_app_key" ON "IntegrationConnection"("userId", "app");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_idempotencyKey_key" ON "Delivery"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Delivery_status_scheduledFor_idx" ON "Delivery"("status", "scheduledFor");
