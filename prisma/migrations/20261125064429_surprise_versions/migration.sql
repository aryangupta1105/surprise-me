-- AlterTable
ALTER TABLE "Surprise" ADD COLUMN "publishedVersionId" TEXT;

-- CreateTable
CREATE TABLE "SurpriseVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surpriseId" TEXT NOT NULL,
    "doc" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurpriseVersion_surpriseId_fkey" FOREIGN KEY ("surpriseId") REFERENCES "Surprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SurpriseVersion_surpriseId_createdAt_idx" ON "SurpriseVersion"("surpriseId", "createdAt");
