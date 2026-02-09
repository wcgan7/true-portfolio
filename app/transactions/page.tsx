"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  name: string;
};

type Instrument = {
  id: string;
  symbol: string;
  kind: "CASH" | "STOCK" | "ETF" | "OPTION" | "CUSTOM";
};

type Transaction = {
  id: string;
  accountId: string;
  instrumentId: string | null;
  type: "BUY" | "SELL" | "DIVIDEND" | "FEE" | "DEPOSIT" | "WITHDRAWAL";
  tradeDate: string;
  quantity: string | null;
  price: string | null;
  amount: string;
  feeAmount: string;
};

type TxType = Transaction["type"];

const TX_TYPES: TxType[] = ["BUY", "SELL", "DIVIDEND", "FEE", "DEPOSIT", "WITHDRAWAL"];

function isTradeType(type: TxType): boolean {
  return type === "BUY" || type === "SELL";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function TransactionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<TxType>("BUY");
  const [instrumentId, setInstrumentId] = useState("");
  const [tradeDate, setTradeDate] = useState(todayIso());
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [feeAmount, setFeeAmount] = useState("0");
  const [externalRef, setExternalRef] = useState("");
  const [notes, setNotes] = useState("");
  const [filterAccountId, setFilterAccountId] = useState("");

  const [symbol, setSymbol] = useState("");
  const [instrumentName, setInstrumentName] = useState("");
  const [kind, setKind] = useState<Instrument["kind"]>("STOCK");

  const [loading, setLoading] = useState(true);
  const [submittingTx, setSubmittingTx] = useState(false);
  const [submittingInstrument, setSubmittingInstrument] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAccountsAndInstruments() {
    const [accountsRes, instrumentsRes] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/instruments"),
    ]);
    const accountsPayload = (await accountsRes.json()) as { data?: Account[]; error?: string };
    const instrumentsPayload = (await instrumentsRes.json()) as {
      data?: Instrument[];
      error?: string;
    };
    if (!accountsRes.ok || !accountsPayload.data) {
      throw new Error(accountsPayload.error ?? "Failed to load accounts");
    }
    if (!instrumentsRes.ok || !instrumentsPayload.data) {
      throw new Error(instrumentsPayload.error ?? "Failed to load instruments");
    }
    setAccounts(accountsPayload.data);
    setInstruments(instrumentsPayload.data);
    if (!accountId && accountsPayload.data.length > 0) {
      setAccountId(accountsPayload.data[0].id);
    }
  }

  async function loadTransactions(nextAccountFilter?: string) {
    const accountFilter = nextAccountFilter ?? filterAccountId;
    const query = accountFilter ? `?accountId=${encodeURIComponent(accountFilter)}` : "";
    const res = await fetch(`/api/transactions${query}`);
    const payload = (await res.json()) as { data?: Transaction[]; error?: string };
    if (!res.ok || !payload.data) {
      throw new Error(payload.error ?? "Failed to load transactions");
    }
    setTransactions(payload.data);
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await loadAccountsAndInstruments();
      await loadTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const instrumentOptions = useMemo(
    () => instruments.filter((item) => item.kind !== "CASH"),
    [instruments],
  );

  function validateTransactionForm(): string | null {
    if (!accountId) {
      return "Account is required.";
    }
    if (isTradeType(type)) {
      if (!instrumentId) return "Instrument is required for BUY/SELL.";
      if (!quantity || Number(quantity) <= 0) return "Quantity must be > 0.";
      if (!price || Number(price) <= 0) return "Price must be > 0.";
      if (Number(feeAmount) < 0) return "Fee cannot be negative.";
      return null;
    }
    if (!amount || Number(amount) <= 0) {
      return "Amount must be > 0.";
    }
    if (Number(feeAmount) < 0) return "Fee cannot be negative.";
    return null;
  }

  async function onCreateTransaction(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const validation = validateTransactionForm();
    if (validation) {
      setError(validation);
      return;
    }
    setSubmittingTx(true);
    try {
      const body: Record<string, unknown> = {
        accountId,
        type,
        tradeDate,
        feeAmount: Number(feeAmount || 0),
        notes: notes || undefined,
        externalRef: externalRef || undefined,
      };
      if (isTradeType(type)) {
        body.instrumentId = instrumentId;
        body.quantity = Number(quantity);
        body.price = Number(price);
      } else {
        body.amount = Number(amount);
      }

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to create transaction");
      }
      await loadTransactions();
      setQuantity("");
      setPrice("");
      setAmount("");
      setFeeAmount("0");
      setExternalRef("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create transaction");
    } finally {
      setSubmittingTx(false);
    }
  }

  async function onCreateInstrument(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!symbol.trim()) {
      setError("Instrument symbol is required.");
      return;
    }
    if (!instrumentName.trim()) {
      setError("Instrument name is required.");
      return;
    }
    setSubmittingInstrument(true);
    try {
      const res = await fetch("/api/instruments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          name: instrumentName.trim(),
          kind,
          currency: "USD",
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to create instrument");
      }
      await loadAccountsAndInstruments();
      setSymbol("");
      setInstrumentName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create instrument");
    } finally {
      setSubmittingInstrument(false);
    }
  }

  async function onFilterChange(next: string) {
    setFilterAccountId(next);
    setError(null);
    try {
      await loadTransactions(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Transactions</h1>
      <p>Create instruments and enter portfolio transactions manually.</p>

      {loading ? <p>Loading...</p> : null}

      <section>
        <h2>Create Instrument</h2>
        <form onSubmit={onCreateInstrument} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
          <label htmlFor="instrument-symbol">Symbol</label>
          <input
            id="instrument-symbol"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            data-testid="instrument-symbol-input"
          />

          <label htmlFor="instrument-name">Name</label>
          <input
            id="instrument-name"
            value={instrumentName}
            onChange={(event) => setInstrumentName(event.target.value)}
            data-testid="instrument-name-input"
          />

          <label htmlFor="instrument-kind">Kind</label>
          <select
            id="instrument-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as Instrument["kind"])}
            data-testid="instrument-kind-select"
          >
            <option value="STOCK">STOCK</option>
            <option value="ETF">ETF</option>
            <option value="CUSTOM">CUSTOM</option>
            <option value="OPTION">OPTION</option>
            <option value="CASH">CASH</option>
          </select>

          <button
            type="submit"
            disabled={submittingInstrument}
            data-testid="create-instrument-btn"
          >
            {submittingInstrument ? "Creating..." : "Create Instrument"}
          </button>
        </form>
      </section>

      <section>
        <h2>Create Transaction</h2>
        <form onSubmit={onCreateTransaction} style={{ display: "grid", gap: 8, maxWidth: 560 }}>
          <label htmlFor="tx-account">Account</label>
          <select
            id="tx-account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            data-testid="tx-account-select"
          >
            <option value="">Select account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>

          <label htmlFor="tx-type">Type</label>
          <select
            id="tx-type"
            value={type}
            onChange={(event) => setType(event.target.value as TxType)}
            data-testid="tx-type-select"
          >
            {TX_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          {isTradeType(type) ? (
            <>
              <label htmlFor="tx-instrument">Instrument</label>
              <select
                id="tx-instrument"
                value={instrumentId}
                onChange={(event) => setInstrumentId(event.target.value)}
                data-testid="tx-instrument-select"
              >
                <option value="">Select instrument</option>
                {instrumentOptions.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.symbol} ({instrument.kind})
                  </option>
                ))}
              </select>

              <label htmlFor="tx-quantity">Quantity</label>
              <input
                id="tx-quantity"
                type="number"
                step="0.000001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                data-testid="tx-quantity-input"
              />

              <label htmlFor="tx-price">Price</label>
              <input
                id="tx-price"
                type="number"
                step="0.000001"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                data-testid="tx-price-input"
              />
            </>
          ) : (
            <>
              <label htmlFor="tx-amount">Amount</label>
              <input
                id="tx-amount"
                type="number"
                step="0.000001"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                data-testid="tx-amount-input"
              />
            </>
          )}

          <label htmlFor="tx-trade-date">Trade Date</label>
          <input
            id="tx-trade-date"
            type="date"
            value={tradeDate}
            onChange={(event) => setTradeDate(event.target.value)}
            data-testid="tx-trade-date-input"
          />

          <label htmlFor="tx-fee">Fee</label>
          <input
            id="tx-fee"
            type="number"
            step="0.000001"
            value={feeAmount}
            onChange={(event) => setFeeAmount(event.target.value)}
            data-testid="tx-fee-input"
          />

          <label htmlFor="tx-external-ref">External Ref</label>
          <input
            id="tx-external-ref"
            value={externalRef}
            onChange={(event) => setExternalRef(event.target.value)}
            data-testid="tx-external-ref-input"
          />

          <label htmlFor="tx-notes">Notes</label>
          <input
            id="tx-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            data-testid="tx-notes-input"
          />

          <button type="submit" disabled={submittingTx} data-testid="create-tx-btn">
            {submittingTx ? "Creating..." : "Create Transaction"}
          </button>
        </form>
      </section>

      {error ? (
        <p role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      ) : null}

      <section>
        <h2>Transaction Table</h2>
        <label htmlFor="filter-account">Filter by Account</label>
        <select
          id="filter-account"
          value={filterAccountId}
          onChange={(event) => void onFilterChange(event.target.value)}
          data-testid="tx-filter-account-select"
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>

        {transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <table data-testid="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Account</th>
                <th>Instrument</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{new Date(tx.tradeDate).toISOString().slice(0, 10)}</td>
                  <td>{tx.type}</td>
                  <td>{accounts.find((a) => a.id === tx.accountId)?.name ?? tx.accountId}</td>
                  <td>{instruments.find((i) => i.id === tx.instrumentId)?.symbol ?? "-"}</td>
                  <td>{tx.quantity ?? "-"}</td>
                  <td>{tx.price ?? "-"}</td>
                  <td>{tx.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

