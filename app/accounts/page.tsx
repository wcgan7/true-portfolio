"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
    <main style={{ padding: 24 }}>
      <h1>Accounts</h1>
      <p>Create and manage portfolio accounts.</p>

      <section>
        <h2>Create Account</h2>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, maxWidth: 420 }}>
          <label htmlFor="account-name">Account Name</label>
          <input
            id="account-name"
            name="accountName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Main Brokerage"
            data-testid="account-name-input"
          />
          <button type="submit" disabled={submitting} data-testid="create-account-btn">
            {submitting ? "Creating..." : "Create Account"}
          </button>
        </form>
      </section>

      {error ? (
        <p role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      ) : null}

      <section>
        <h2>Account List</h2>
        {loading ? <p>Loading accounts...</p> : null}
        {!loading && !hasAccounts ? <p>No accounts yet.</p> : null}
        {!loading && hasAccounts ? (
          <table data-testid="accounts-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Currency</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>{account.baseCurrency}</td>
                  <td>{new Date(account.createdAt).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}

