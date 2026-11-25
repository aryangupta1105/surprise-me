-- CreateEnum
CREATE TYPE "SurpriseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('IDLE', 'PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('CREATED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "isGuest" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT,
    "name" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Surprise" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "SurpriseStatus" NOT NULL DEFAULT 'DRAFT',
    "occasion" TEXT NOT NULL,
    "experienceType" TEXT,
    "recipientName" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "title" TEXT,
    "input" JSONB NOT NULL,
    "content" JSONB,
    "theme" JSONB,
    "generationStatus" "GenerationStatus" NOT NULL DEFAULT 'IDLE',
    "generationError" TEXT,
    "linkTokenHash" TEXT,
    "linkTokenEnc" TEXT,
    "linkRevokedAt" TIMESTAMP(3),
    "linkExpiresAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "lastOpenedAt" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Surprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIGeneration" (
    "id" TEXT NOT NULL,
    "surpriseId" TEXT NOT NULL,
    "section" TEXT,
    "status" "GenerationStatus" NOT NULL,
    "model" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "error" TEXT,
    "output" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "surpriseId" TEXT,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "authId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "surpriseId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surpriseId" TEXT,
    "title" TEXT NOT NULL,
    "occasionDate" TIMESTAMP(3) NOT NULL,
    "remindMinutes" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" "ReminderStatus" NOT NULL,
    "eventId" TEXT,
    "eventLink" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarReminder_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Surprise" ADD CONSTRAINT "Surprise_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIGeneration" ADD CONSTRAINT "AIGeneration_surpriseId_fkey" FOREIGN KEY ("surpriseId") REFERENCES "Surprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_surpriseId_fkey" FOREIGN KEY ("surpriseId") REFERENCES "Surprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_surpriseId_fkey" FOREIGN KEY ("surpriseId") REFERENCES "Surprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarReminder" ADD CONSTRAINT "CalendarReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarReminder" ADD CONSTRAINT "CalendarReminder_surpriseId_fkey" FOREIGN KEY ("surpriseId") REFERENCES "Surprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
