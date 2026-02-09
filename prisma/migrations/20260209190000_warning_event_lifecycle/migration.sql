ALTER TABLE "WarningEvent"
ADD COLUMN "fingerprint" TEXT,
ADD COLUMN "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "resolvedAt" TIMESTAMP(3);

UPDATE "WarningEvent"
SET "fingerprint" = md5(
  concat_ws(
    '|',
    "code",
    coalesce("accountId", ''),
    coalesce("instrumentId", ''),
    "id"
  )
)
WHERE "fingerprint" IS NULL;

ALTER TABLE "WarningEvent"
ALTER COLUMN "fingerprint" SET NOT NULL;

CREATE UNIQUE INDEX "WarningEvent_fingerprint_key" ON "WarningEvent"("fingerprint");
