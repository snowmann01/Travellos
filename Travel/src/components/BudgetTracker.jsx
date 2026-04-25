import React, { useMemo, useState } from 'react';

const CURRENCIES = ['USD', 'EUR', 'INR', 'GBP'];

export default function BudgetTracker({ items = [], onChange, readOnly = false }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');

  const totalsByCurrency = useMemo(() => {
    const map = {};
    for (const row of items) {
      const c = row.currency || 'USD';
      map[c] = (map[c] || 0) + (Number(row.amount) || 0);
    }
    return map;
  }, [items]);

  const addRow = () => {
    if (readOnly) return;
    const n = parseFloat(amount);
    if (!label.trim() || Number.isNaN(n)) return;
    onChange([...items, { label: label.trim(), amount: n, currency }]);
    setLabel('');
    setAmount('');
  };

  const removeAt = (idx) => {
    if (readOnly) return;
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-cyan-100">Budget</h3>
      {!readOnly && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-xs text-cyan-100/70">
            Label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
              placeholder="Hotels, meals…"
            />
          </label>
          <label className="w-full text-xs text-cyan-100/70 sm:w-28">
            Amount
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
              placeholder="0"
            />
          </label>
          <label className="w-full text-xs text-cyan-100/70 sm:w-24">
            Curr.
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
          >
            Add
          </button>
        </div>
      )}

      <ul className="mb-3 max-h-40 space-y-2 overflow-y-auto text-sm">
        {items.length === 0 && (
          <li className="text-cyan-100/50">No line items yet — add planned costs above.</li>
        )}
        {items.map((row, idx) => (
          <li
            key={`${row.label}-${idx}`}
            className="flex items-center justify-between gap-2 rounded-lg bg-black/25 px-3 py-2"
          >
            <span className="truncate text-white">{row.label}</span>
            <span className="shrink-0 text-cyan-200">
              {Number(row.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
              {row.currency || 'USD'}
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="shrink-0 text-xs text-rose-300 hover:text-rose-200"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm">
        <p className="mb-2 font-medium text-cyan-100">Totals</p>
        {Object.keys(totalsByCurrency).length === 0 ? (
          <p className="text-cyan-100/50">—</p>
        ) : (
          <ul className="space-y-1">
            {Object.entries(totalsByCurrency).map(([c, sum]) => (
              <li key={c} className="flex justify-between text-white">
                <span>{c}</span>
                <span>{sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
