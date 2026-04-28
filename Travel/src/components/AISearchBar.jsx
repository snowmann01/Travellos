import React, { useState } from 'react';
import axios from 'axios';
import { server } from '../config/api.js';

const EXAMPLE_PROMPTS = [
  'Romantic weekend in Paris',
  '5 days exploring Tokyo on a budget',
  'Family trip to Jaipur for 3 days',
  'Solo adventure in Iceland, 7 days',
  'Honeymoon in Bali, 5 days',
];

export default function AISearchBar({
  onResult,
  defaultDayCount = 3,
  readOnly = false,
}) {
  const [query, setQuery] = useState('');
  const [dayCount, setDayCount] = useState(defaultDayCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('');

  const PHASES = [
    'Finding destination...',
    'Loading nearby places...',
    'Gemini is planning your trip...',
    'Almost ready...',
  ];

  const runSearch = async (e) => {
    e?.preventDefault();
    if (readOnly || !query.trim()) return;

    setLoading(true);
    setError('');

    let phaseIndex = 0;
    setPhase(PHASES[0]);
    const phaseInterval = setInterval(() => {
      phaseIndex = Math.min(phaseIndex + 1, PHASES.length - 1);
      setPhase(PHASES[phaseIndex]);
    }, 2500);

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
        'Could not generate itinerary - check your internet connection';
      setError(msg);
    } finally {
      clearInterval(phaseInterval);
      setLoading(false);
      setPhase('');
    }
  };

  const handleExample = (prompt) => {
    if (readOnly || loading) return;
    setQuery(prompt);
  };

  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-cyan-300/80">
        Plan with AI
      </label>
      <p className="mb-3 text-[11px] text-cyan-100/50">
        Describe your dream trip in plain English - Gemini will build a draft itinerary.
      </p>

      <form onSubmit={runSearch} className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={readOnly || loading}
            placeholder='e.g. "romantic weekend in Paris" or "5 days in Jaipur"'
            className="w-full rounded-xl border border-white/15 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-cyan-100/30 focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 disabled:opacity-50 transition-colors"
          />
        </div>

        <label className="flex w-full shrink-0 flex-col gap-1 text-xs text-cyan-100/60 lg:w-24">
          Days
          <input
            type="number"
            min={1}
            max={14}
            value={dayCount}
            onChange={(e) => setDayCount(e.target.value)}
            disabled={readOnly || loading}
            className="rounded-xl border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50 disabled:opacity-50"
          />
        </label>

        <button
          type="submit"
          disabled={readOnly || loading || !query.trim()}
          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg transition-all hover:from-cyan-400 hover:to-teal-400 hover:shadow-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Planning...
            </span>
          ) : (
            'Generate'
          )}
        </button>
      </form>

      {loading && phase && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-xs text-cyan-200/70">{phase}</p>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2">
          <span className="text-rose-300">!</span>
          <p className="text-sm text-rose-200">{error}</p>
        </div>
      )}

      {!readOnly && !loading && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="mr-1 self-center text-[10px] text-cyan-100/40">Try:</span>
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleExample(prompt)}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-cyan-100/70 transition-colors hover:border-cyan-400/30 hover:bg-cyan-500/10 hover:text-cyan-200"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
