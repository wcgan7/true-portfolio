"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  LinearProgress,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { DataTable } from "@/src/components/ui/data-table";
import { EmptyState } from "@/src/components/ui/empty-state";
import { FilterBar } from "@/src/components/ui/filter-bar";
import { FormSection } from "@/src/components/ui/form-section";
import { InlineAlert } from "@/src/components/ui/inline-alert";
import { PageHeader } from "@/src/components/ui/page-header";
import { SectionCard } from "@/src/components/ui/section-card";

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
  notes: string | null;
  externalRef: string | null;
};

type TxType = Transaction["type"];

const TX_TYPES: TxType[] = ["BUY", "SELL", "DIVIDEND", "FEE", "DEPOSIT", "WITHDRAWAL"];

function isTradeType(type: TxType): boolean {
  return type === "BUY" || type === "SELL";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type EditDraft = {
  tradeDate: string;
  quantity: string;
  price: string;
  amount: string;
  feeAmount: string;
  notes: string;
  externalRef: string;
};

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
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const [symbol, setSymbol] = useState("");
  const [instrumentName, setInstrumentName] = useState("");
  const [kind, setKind] = useState<Instrument["kind"]>("STOCK");

  const [loading, setLoading] = useState(true);
  const [submittingTx, setSubmittingTx] = useState(false);
  const [submittingInstrument, setSubmittingInstrument] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
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

  async function loadTransactions(next?: {
    accountId?: string;
    from?: string;
    to?: string;
  }) {
    const accountFilter = next?.accountId ?? filterAccountId;
    const fromFilter = next?.from ?? filterFrom;
    const toFilter = next?.to ?? filterTo;
    const params = new URLSearchParams();
    if (accountFilter) params.set("accountId", accountFilter);
    if (fromFilter) params.set("from", fromFilter);
    if (toFilter) params.set("to", toFilter);
    const query = params.toString();
    const res = await fetch(`/api/transactions${query ? `?${query}` : ""}`);
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

  function hasInvalidDateRange(fromValue?: string, toValue?: string): boolean {
    return Boolean(fromValue && toValue && fromValue > toValue);
  }

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
    if (hasInvalidDateRange(filterFrom, filterTo)) {
      setError("Filter from date must be <= to date.");
      return;
    }
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
      setEditingId(null);
      setEditDraft(null);
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
    if (hasInvalidDateRange(filterFrom, filterTo)) {
      setError("Filter from date must be <= to date.");
      return;
    }
    try {
      await loadTransactions({ accountId: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    }
  }

  async function onApplyFilters() {
    setError(null);
    if (hasInvalidDateRange(filterFrom, filterTo)) {
      setError("Filter from date must be <= to date.");
      return;
    }
    try {
      await loadTransactions({
        accountId: filterAccountId || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    }
  }

  function startEdit(tx: Transaction) {
    setEditingId(tx.id);
    setEditDraft({
      tradeDate: new Date(tx.tradeDate).toISOString().slice(0, 10),
      quantity: tx.quantity ?? "",
      price: tx.price ?? "",
      amount: tx.amount,
      feeAmount: tx.feeAmount,
      notes: tx.notes ?? "",
      externalRef: tx.externalRef ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  function validateEditDraft(tx: Transaction, draft: EditDraft): string | null {
    if (!draft.tradeDate) {
      return "Trade date is required.";
    }
    if (Number(draft.feeAmount || 0) < 0) {
      return "Fee cannot be negative.";
    }
    if (isTradeType(tx.type)) {
      if (!tx.instrumentId) {
        return "Trade transaction is missing instrument.";
      }
      if (!draft.quantity || Number(draft.quantity) <= 0) {
        return "Quantity must be > 0.";
      }
      if (!draft.price || Number(draft.price) <= 0) {
        return "Price must be > 0.";
      }
      return null;
    }
    if (!draft.amount || Number(draft.amount) <= 0) {
      return "Amount must be > 0.";
    }
    return null;
  }

  async function saveEdit(tx: Transaction) {
    if (!editDraft) {
      return;
    }
    setError(null);
    const validation = validateEditDraft(tx, editDraft);
    if (validation) {
      setError(validation);
      return;
    }
    setSavingEdit(true);
    try {
      const body: Record<string, unknown> = {
        accountId: tx.accountId,
        type: tx.type,
        tradeDate: editDraft.tradeDate,
        feeAmount: Number(editDraft.feeAmount || 0),
        notes: editDraft.notes.trim() || undefined,
        externalRef: editDraft.externalRef.trim() || undefined,
      };
      if (isTradeType(tx.type)) {
        body.instrumentId = tx.instrumentId;
        body.quantity = Number(editDraft.quantity);
        body.price = Number(editDraft.price);
      } else {
        body.amount = Number(editDraft.amount);
      }

      const res = await fetch(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to update transaction");
      }

      setEditingId(null);
      setEditDraft(null);
      await loadTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update transaction");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <Box component="main">
      <PageHeader
        title="Transactions"
        subtitle="Create instruments and enter portfolio transactions manually."
      />

      {loading ? <LinearProgress sx={{ mb: 2 }} /> : null}

      <Stack spacing={2.5}>
        <FormSection title="Create Instrument">
          <Box component="form" onSubmit={onCreateInstrument} sx={{ display: "grid", gap: 2, maxWidth: 580 }}>
            <TextField
              id="instrument-symbol"
              label="Symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              inputProps={{ "data-testid": "instrument-symbol-input" }}
            />

            <TextField
              id="instrument-name"
              label="Name"
              value={instrumentName}
              onChange={(event) => setInstrumentName(event.target.value)}
              inputProps={{ "data-testid": "instrument-name-input" }}
            />

            <Box>
              <label htmlFor="instrument-kind">Kind</label>
              <Box
                component="select"
                id="instrument-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as Instrument["kind"])}
                data-testid="instrument-kind-select"
                sx={{
                  mt: 0.5,
                  width: "100%",
                  borderRadius: 1.25,
                  border: "1px solid",
                  borderColor: "divider",
                  px: 1.25,
                  py: 1,
                  bgcolor: "background.paper",
                }}
              >
                <option value="STOCK">STOCK</option>
                <option value="ETF">ETF</option>
                <option value="CUSTOM">CUSTOM</option>
                <option value="OPTION">OPTION</option>
                <option value="CASH">CASH</option>
              </Box>
            </Box>

            <Button
              type="submit"
              disabled={submittingInstrument}
              data-testid="create-instrument-btn"
              variant="contained"
            >
              {submittingInstrument ? "Creating..." : "Create Instrument"}
            </Button>
          </Box>
        </FormSection>

        <FormSection title="Create Transaction">
          <Box component="form" onSubmit={onCreateTransaction} sx={{ display: "grid", gap: 2, maxWidth: 640 }}>
            <Box>
              <label htmlFor="tx-account">Account</label>
              <Box
                component="select"
                id="tx-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                data-testid="tx-account-select"
                sx={{
                  mt: 0.5,
                  width: "100%",
                  borderRadius: 1.25,
                  border: "1px solid",
                  borderColor: "divider",
                  px: 1.25,
                  py: 1,
                  bgcolor: "background.paper",
                }}
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Box>
            </Box>

            <Box>
              <label htmlFor="tx-type">Type</label>
              <Box
                component="select"
                id="tx-type"
                value={type}
                onChange={(event) => setType(event.target.value as TxType)}
                data-testid="tx-type-select"
                sx={{
                  mt: 0.5,
                  width: "100%",
                  borderRadius: 1.25,
                  border: "1px solid",
                  borderColor: "divider",
                  px: 1.25,
                  py: 1,
                  bgcolor: "background.paper",
                }}
              >
                {TX_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Box>
            </Box>

            {isTradeType(type) ? (
              <>
                <Box>
                  <label htmlFor="tx-instrument">Instrument</label>
                  <Box
                    component="select"
                    id="tx-instrument"
                    value={instrumentId}
                    onChange={(event) => setInstrumentId(event.target.value)}
                    data-testid="tx-instrument-select"
                    sx={{
                      mt: 0.5,
                      width: "100%",
                      borderRadius: 1.25,
                      border: "1px solid",
                      borderColor: "divider",
                      px: 1.25,
                      py: 1,
                      bgcolor: "background.paper",
                    }}
                  >
                    <option value="">Select instrument</option>
                    {instrumentOptions.map((instrument) => (
                      <option key={instrument.id} value={instrument.id}>
                        {instrument.symbol} ({instrument.kind})
                      </option>
                    ))}
                  </Box>
                </Box>

                <TextField
                  id="tx-quantity"
                  type="number"
                  label="Quantity"
                  inputProps={{ step: "0.000001", "data-testid": "tx-quantity-input" }}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />

                <TextField
                  id="tx-price"
                  type="number"
                  label="Price"
                  inputProps={{ step: "0.000001", "data-testid": "tx-price-input" }}
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </>
            ) : (
              <TextField
                id="tx-amount"
                type="number"
                label="Amount"
                inputProps={{ step: "0.000001", "data-testid": "tx-amount-input" }}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            )}

            <TextField
              id="tx-trade-date"
              label="Trade Date"
              type="date"
              value={tradeDate}
              onChange={(event) => setTradeDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ "data-testid": "tx-trade-date-input" }}
            />

            <TextField
              id="tx-fee"
              type="number"
              label="Fee"
              inputProps={{ step: "0.000001", "data-testid": "tx-fee-input" }}
              value={feeAmount}
              onChange={(event) => setFeeAmount(event.target.value)}
            />

            <TextField
              id="tx-external-ref"
              label="External Ref"
              value={externalRef}
              onChange={(event) => setExternalRef(event.target.value)}
              inputProps={{ "data-testid": "tx-external-ref-input" }}
            />

            <TextField
              id="tx-notes"
              label="Notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              inputProps={{ "data-testid": "tx-notes-input" }}
            />

            <Button type="submit" disabled={submittingTx} variant="contained" data-testid="create-tx-btn">
              {submittingTx ? "Creating..." : "Create Transaction"}
            </Button>
          </Box>
        </FormSection>

        {error ? <InlineAlert severity="error">{error}</InlineAlert> : null}

        <SectionCard title="Transaction Table">
          <Stack spacing={1.5}>
            <FilterBar>
              <Box sx={{ minWidth: { xs: "100%", md: 220 } }}>
                <label htmlFor="filter-account">Filter by Account</label>
                <Box
                  component="select"
                  id="filter-account"
                  value={filterAccountId}
                  onChange={(event) => void onFilterChange(event.target.value)}
                  data-testid="tx-filter-account-select"
                  style={{ marginTop: 4 }}
                  sx={{
                    width: "100%",
                    borderRadius: 1.25,
                    border: "1px solid",
                    borderColor: "divider",
                    px: 1.25,
                    py: 1,
                    bgcolor: "background.paper",
                  }}
                >
                  <option value="">All accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Box>
              </Box>
              <TextField
                id="filter-from"
                label="From"
                type="date"
                value={filterFrom}
                onChange={(event) => setFilterFrom(event.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ "data-testid": "tx-filter-from-input" }}
                sx={{ minWidth: { xs: "100%", md: 170 } }}
              />
              <TextField
                id="filter-to"
                label="To"
                type="date"
                value={filterTo}
                onChange={(event) => setFilterTo(event.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ "data-testid": "tx-filter-to-input" }}
                sx={{ minWidth: { xs: "100%", md: 170 } }}
              />
              <Button
                type="button"
                onClick={() => void onApplyFilters()}
                data-testid="tx-apply-filters-btn"
                variant="outlined"
              >
                Apply Filters
              </Button>
            </FilterBar>

            {transactions.length === 0 ? (
              <EmptyState title="No transactions yet." />
            ) : (
              <DataTable testId="transactions-table" compact>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Account</TableCell>
                    <TableCell>Instrument</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Fee</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>External Ref</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((tx) => {
                    const isEditing = editingId === tx.id && editDraft != null;
                    const isTrade = isTradeType(tx.type);
                    const computedTradeAmount = isTrade
                      ? (
                          (Number(editDraft?.quantity || tx.quantity || 0) || 0) *
                          (Number(editDraft?.price || tx.price || 0) || 0)
                        ).toFixed(6)
                      : null;

                    return (
                      <TableRow key={tx.id}>
                        <TableCell>
                          {isEditing ? (
                            <TextField
                              type="date"
                              size="small"
                              value={editDraft.tradeDate}
                              onChange={(event) =>
                                setEditDraft((prev) =>
                                  prev ? { ...prev, tradeDate: event.target.value } : prev,
                                )
                              }
                              inputProps={{ "data-testid": "edit-tx-trade-date-input" }}
                            />
                          ) : (
                            new Date(tx.tradeDate).toISOString().slice(0, 10)
                          )}
                        </TableCell>
                        <TableCell>{tx.type}</TableCell>
                        <TableCell>{accounts.find((a) => a.id === tx.accountId)?.name ?? tx.accountId}</TableCell>
                        <TableCell>{instruments.find((i) => i.id === tx.instrumentId)?.symbol ?? "-"}</TableCell>
                        <TableCell>
                          {isEditing && isTrade ? (
                            <TextField
                              type="number"
                              size="small"
                              value={editDraft.quantity}
                              onChange={(event) =>
                                setEditDraft((prev) =>
                                  prev ? { ...prev, quantity: event.target.value } : prev,
                                )
                              }
                              inputProps={{ step: "0.000001", "data-testid": "edit-tx-quantity-input" }}
                            />
                          ) : (
                            tx.quantity ?? "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing && isTrade ? (
                            <TextField
                              type="number"
                              size="small"
                              value={editDraft.price}
                              onChange={(event) =>
                                setEditDraft((prev) => (prev ? { ...prev, price: event.target.value } : prev))
                              }
                              inputProps={{ step: "0.000001", "data-testid": "edit-tx-price-input" }}
                            />
                          ) : (
                            tx.price ?? "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing && !isTrade ? (
                            <TextField
                              type="number"
                              size="small"
                              value={editDraft.amount}
                              onChange={(event) =>
                                setEditDraft((prev) => (prev ? { ...prev, amount: event.target.value } : prev))
                              }
                              inputProps={{ step: "0.000001", "data-testid": "edit-tx-amount-input" }}
                            />
                          ) : isEditing && isTrade ? (
                            computedTradeAmount
                          ) : (
                            tx.amount
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <TextField
                              type="number"
                              size="small"
                              value={editDraft.feeAmount}
                              onChange={(event) =>
                                setEditDraft((prev) =>
                                  prev ? { ...prev, feeAmount: event.target.value } : prev,
                                )
                              }
                              inputProps={{ step: "0.000001", "data-testid": "edit-tx-fee-input" }}
                            />
                          ) : (
                            tx.feeAmount
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <TextField
                              size="small"
                              value={editDraft.notes}
                              onChange={(event) =>
                                setEditDraft((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                              }
                              inputProps={{ "data-testid": "edit-tx-notes-input" }}
                            />
                          ) : (
                            tx.notes ?? "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <TextField
                              size="small"
                              value={editDraft.externalRef}
                              onChange={(event) =>
                                setEditDraft((prev) =>
                                  prev ? { ...prev, externalRef: event.target.value } : prev,
                                )
                              }
                              inputProps={{ "data-testid": "edit-tx-external-ref-input" }}
                            />
                          ) : (
                            tx.externalRef ?? "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Stack direction="row" spacing={1}>
                              <Button
                                type="button"
                                onClick={() => void saveEdit(tx)}
                                disabled={savingEdit}
                                size="small"
                                variant="contained"
                                data-testid="save-tx-edit-btn"
                              >
                                {savingEdit ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                type="button"
                                onClick={cancelEdit}
                                size="small"
                                variant="outlined"
                                data-testid="cancel-tx-edit-btn"
                              >
                                Cancel
                              </Button>
                            </Stack>
                          ) : (
                            <Button
                              type="button"
                              onClick={() => startEdit(tx)}
                              size="small"
                              variant="outlined"
                              data-testid="edit-tx-btn"
                            >
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </DataTable>
            )}
          </Stack>
        </SectionCard>
      </Stack>
    </Box>
  );
}
