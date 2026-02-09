-- CreateEnum
CREATE TYPE "RefreshJobStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED_CONFLICT');

-- CreateEnum
CREATE TYPE "RefreshJobTrigger" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateTable
CREATE TABLE "RefreshJob" (
    "id" TEXT NOT NULL,
    "status" "RefreshJobStatus" NOT NULL,
    "trigger" "RefreshJobTrigger" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "inputJson" JSONB,
    "resultJson" JSONB,

    CONSTRAINT "RefreshJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefreshJob_startedAt_idx" ON "RefreshJob"("startedAt");

-- CreateIndex
CREATE INDEX "RefreshJob_status_idx" ON "RefreshJob"("status");

-- CreateIndex
CREATE INDEX "RefreshJob_trigger_idx" ON "RefreshJob"("trigger");
