import React, { useState } from 'react';
import axios from 'axios';
import { server } from '../config/api.js';

export default function AISearchBar({
  onResult,
  defaultDayCount = 3,
  readOnly = false,
}) {
  const [query, setQuery] = useState('');
  const [dayCount, setDayCount] = useState(defaultDayCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async (e) => {
    e?.preventDefault();
    if (readOnly || !query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${server}/itinerary/generate`, {
        query: query.trim(),
        dayCount: Math.min(14, Math.max(1, Number(dayCount) || 3)),
      });
      onResult?.(data);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.message ||
        'Could not generate suggestions';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={runSearch} className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-cyan-100/80">
        Plan with AI + OpenTripMap
      </label>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={readOnly || loading}
            placeholder='Try "romantic weekend in Paris" or "3 days in Jaipur"'
            className="w-full rounded-xl border border-white/15 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-cyan-100/35 focus:border-cyan-400/40 disabled:opacity-50"
          />
        </div>
        <label className="flex w-full flex-col text-xs text-cyan-100/70 lg:w-24">
          Days
          <input
            type="number"
            min={1}
            max={14}
            value={dayCount}
            onChange={(e) => setDayCount(e.target.value)}
            disabled={readOnly || loading}
            className="mt-1 rounded-xl border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white outline-none disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={readOnly || loading || !query.trim()}
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:from-cyan-400 hover:to-teal-400 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? 'Planning…' : 'Suggest'}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
    </form>
  );
}
