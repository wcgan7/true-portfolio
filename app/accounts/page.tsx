"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Skeleton,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { DataTable } from "@/src/components/ui/data-table";
import { EmptyState } from "@/src/components/ui/empty-state";
import { FormSection } from "@/src/components/ui/form-section";
import { InlineAlert } from "@/src/components/ui/inline-alert";
import { PageHeader } from "@/src/components/ui/page-header";
import { SectionCard } from "@/src/components/ui/section-card";

type Account = {
  id: string;
  name: string;
  baseCurrency: string;
  createdAt: string;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAccounts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts");
      const payload = (await res.json()) as { data: Account[]; error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to load accounts");
      }
      setAccounts(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Account name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, baseCurrency: "USD" }),
      });
      const payload = (await res.json()) as { data?: Account; error?: string };
      if (!res.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to create account");
      }
      setAccounts((prev) => [...prev, payload.data!]);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  }

  const hasAccounts = useMemo(() => accounts.length > 0, [accounts.length]);

  return (
    <Box component="main">
      <PageHeader title="Accounts" subtitle="Create and manage portfolio accounts." />

      <Stack spacing={2.5}>
        <FormSection title="Create Account">
          <Box component="form" onSubmit={onSubmit} sx={{ display: "grid", gap: 2, maxWidth: 440 }}>
            <TextField
              id="account-name"
              name="accountName"
              label="Account Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Main Brokerage"
              inputProps={{ "data-testid": "account-name-input" }}
              fullWidth
            />
            <Button type="submit" disabled={submitting} variant="contained" data-testid="create-account-btn">
              {submitting ? "Creating..." : "Create Account"}
            </Button>
          </Box>
        </FormSection>

        {error ? <InlineAlert severity="error">{error}</InlineAlert> : null}

        <SectionCard title="Account List">
          {loading ? (
            <Stack spacing={1.2}>
              <Skeleton variant="rounded" height={36} />
              <Skeleton variant="rounded" height={36} />
              <Skeleton variant="rounded" height={36} />
            </Stack>
          ) : null}
          {!loading && !hasAccounts ? <EmptyState title="No accounts yet." /> : null}
          {!loading && hasAccounts ? (
            <DataTable testId="accounts-table" compact>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Currency</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{account.name}</TableCell>
                    <TableCell>{account.baseCurrency}</TableCell>
                    <TableCell>{new Date(account.createdAt).toISOString().slice(0, 10)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          ) : null}
        </SectionCard>
      </Stack>
    </Box>
  );
}
