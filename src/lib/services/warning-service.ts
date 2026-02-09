import { createHash } from "node:crypto";

import { prisma } from "@/src/lib/db";
import type { OverviewMode } from "@/src/lib/services/overview-service";
import type { OverviewWarning } from "@/src/lib/services/valuation-core";

type PersistWarningsInput = {
  asOfDate: string;
  warnings: OverviewWarning[];
  accountId?: string;
  mode: OverviewMode;
};

function severityForCode(code: OverviewWarning["code"]): "INFO" | "WARNING" | "ERROR" {
  if (
    code === "MISSING_PRICE" ||
    code === "ETF_LOOKTHROUGH_UNAVAILABLE" ||
    code === "UNKNOWN_TICKER"
  ) {
    return "ERROR";
  }
  return "WARNING";
}

function toFingerprintKey(input: {
  code: string;
  accountId: string | null;
  instrumentId: string | null;
  symbol: string;
  mode: OverviewMode;
}): string {
  return [
    input.code,
    input.accountId ?? "",
    input.instrumentId ?? "",
    input.symbol.toUpperCase(),
    input.mode,
  ].join("|");
}

function hashFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function persistWarningLifecycle(input: PersistWarningsInput): Promise<void> {
  const warningDate = new Date(`${input.asOfDate}T00:00:00.000Z`);
  const currentFingerprints = new Set<string>();

  for (const warning of input.warnings) {
    const accountId = input.accountId ?? warning.accountId ?? null;
    const fingerprint = hashFingerprint(
      toFingerprintKey({
        code: warning.code,
        accountId,
        instrumentId: warning.instrumentId,
        symbol: warning.symbol,
        mode: input.mode,
      }),
    );
    currentFingerprints.add(fingerprint);

    await prisma.warningEvent.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        date: warningDate,
        firstSeenAt: warningDate,
        lastSeenAt: warningDate,
        resolvedAt: null,
        code: warning.code,
        severity: severityForCode(warning.code),
        accountId,
        instrumentId: warning.instrumentId,
        metadataJson: {
          message: warning.message,
          symbol: warning.symbol,
          mode: input.mode,
        },
      },
      update: {
        date: warningDate,
        lastSeenAt: warningDate,
        resolvedAt: null,
        severity: severityForCode(warning.code),
        metadataJson: {
          message: warning.message,
          symbol: warning.symbol,
          mode: input.mode,
        },
      },
    });
  }

  const whereScope = {
    resolvedAt: null,
    date: { lte: warningDate },
    metadataJson: {
      path: ["mode"],
      equals: input.mode,
    },
    ...(input.accountId ? { accountId: input.accountId } : {}),
  } as const;

  const activeRows = await prisma.warningEvent.findMany({
    where: whereScope,
    select: { id: true, fingerprint: true },
  });

  const toResolve = activeRows
    .filter((row) => !currentFingerprints.has(row.fingerprint))
    .map((row) => row.id);

  if (toResolve.length === 0) {
    return;
  }

  await prisma.warningEvent.updateMany({
    where: { id: { in: toResolve } },
    data: { resolvedAt: warningDate },
  });
}
