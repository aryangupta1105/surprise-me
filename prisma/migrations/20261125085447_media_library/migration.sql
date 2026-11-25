-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Upload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "surpriseId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'image',
    "status" TEXT NOT NULL DEFAULT 'ready',
    "name" TEXT NOT NULL DEFAULT '',
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT,
    "data" BLOB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Upload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Upload_surpriseId_fkey" FOREIGN KEY ("surpriseId") REFERENCES "Surprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Upload" ("createdAt", "data", "id", "mime", "ownerId", "size", "surpriseId") SELECT "createdAt", "data", "id", "mime", "ownerId", "size", "surpriseId" FROM "Upload";
DROP TABLE "Upload";
ALTER TABLE "new_Upload" RENAME TO "Upload";
CREATE INDEX "Upload_ownerId_idx" ON "Upload"("ownerId");
CREATE INDEX "Upload_surpriseId_kind_idx" ON "Upload"("surpriseId", "kind");
CREATE INDEX "Upload_storageKey_idx" ON "Upload"("storageKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
