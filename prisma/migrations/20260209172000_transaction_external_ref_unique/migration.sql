-- Enforce idempotency key uniqueness per account when externalRef is provided.
ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_accountId_externalRef_key" UNIQUE ("accountId", "externalRef");

