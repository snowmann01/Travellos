import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FaHome, FaLink, FaSave } from 'react-icons/fa';
import { server } from '../config/api.js';
import AISearchBar from './AISearchBar';
import DayBuilder from './DayBuilder';
import BudgetTracker from './BudgetTracker';
import MapView from './MapView';

function emptyDays(n) {
  return Array.from({ length: Math.max(1, n) }, () => []);
}

function fromSavedDays(savedDays) {
  if (!savedDays?.length) return emptyDays(3);
  const maxIdx = Math.max(...savedDays.map((d) => d.dayIndex ?? 0));
  const grid = emptyDays(maxIdx + 1);
  for (const d of savedDays) {
    const idx = d.dayIndex ?? 0;
    if (idx >= 0 && idx < grid.length) {
      grid[idx] = (d.items || []).map((item) => ({
        ...item,
        instanceId: item.instanceId || globalThis.crypto?.randomUUID?.() || String(Math.random()),
      }));
    }
  }
  return grid;
}

function toPayloadDays(itemsByDay) {
  return itemsByDay.map((items, dayIndex) => ({
    dayIndex,
    items: items.map(({ instanceId, name, lat, lon, time, notes, kinds, xid }) => ({
      instanceId,
      name,
      lat,
      lon,
      time: time || '',
      notes: notes || '',
      kinds: kinds || '',
      xid: xid || '',
    })),
  }));
}

export default function ItineraryPlanner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const shareParam = searchParams.get('share');
  const modeParam = (searchParams.get('mode') || 'edit').toLowerCase();
  const readOnly = modeParam === 'view';

  const [title, setTitle] = useState('My trip');
  const [suggestions, setSuggestions] = useState([]);
  const [itemsByDay, setItemsByDay] = useState(() => emptyDays(3));
  const [budgetItems, setBudgetItems] = useState([]);
  const [mapCenter, setMapCenter] = useState(null);
  const [shareId, setShareId] = useState(shareParam || '');
  const [allowEditViaLink, setAllowEditViaLink] = useState(true);

  // UI edits whenever not in explicit view mode; save still 403s for non-owners if allowEditViaLink is off.
  const canEdit = !readOnly;

  useEffect(() => {
    if (!shareParam) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${server}/itinerary/shared/${shareParam}`);
        if (cancelled) return;
        setShareId(data.shareId);
        setTitle(data.title || 'Shared trip');
        const grid = fromSavedDays(data.days);
        setItemsByDay(grid);
        setBudgetItems(data.budgetItems || []);
        setAllowEditViaLink(data.allowEditViaLink !== false);
        for (const col of grid) {
          for (const item of col) {
            if (typeof item.lat === 'number' && typeof item.lon === 'number') {
              setMapCenter({ lat: item.lat, lon: item.lon });
              return;
            }
          }
        }
      } catch (e) {
        toast.error(e.response?.data?.message || 'Could not load shared itinerary');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareParam]);

  const onAiResult = useCallback((data) => {
    setTitle(data.title || data.destination || 'My trip');
    setSuggestions(data.pois || []);
    const grid = (data.days || []).map((d) =>
      (d.items || []).map((item) => ({
        ...item,
        instanceId: item.instanceId || globalThis.crypto?.randomUUID?.() || String(Math.random()),
      }))
    );
    if (grid.length) {
      setItemsByDay(grid);
    } else {
      setItemsByDay(emptyDays(data.draft?.dayCount || 3));
    }
    if (typeof data.lat === 'number' && typeof data.lon === 'number') {
      setMapCenter({ lat: data.lat, lon: data.lon });
    }
    toast.success('Draft ready — drag stops to refine');
  }, []);

  const mapMarkers = useMemo(() => {
    const list = [];
    let k = 0;
    for (const col of itemsByDay) {
      for (const item of col) {
        if (typeof item.lat === 'number' && typeof item.lon === 'number') {
          list.push({
            key: item.instanceId || k,
            lat: item.lat,
            lon: item.lon,
            name: item.name,
          });
          k += 1;
        }
      }
    }
    return list;
  }, [itemsByDay]);

  const addDay = () => setItemsByDay((prev) => [...prev, []]);
  const removeLastDay = () =>
    setItemsByDay((prev) => (prev.length <= 1 ? prev : prev.slice(0, -1)));

  const saveTrip = async () => {
    if (!canEdit) return;
    try {
      const payload = {
        shareId: shareId || undefined,
        title,
        days: toPayloadDays(itemsByDay),
        budgetItems,
        allowEditViaLink,
      };
      const { data } = await axios.post(`${server}/itinerary/save`, payload, {
        withCredentials: true,
      });
      setShareId(data.shareId);
      const next = new URLSearchParams(searchParams);
      next.set('share', data.shareId);
      next.set('mode', 'edit');
      setSearchParams(next, { replace: true });
      toast.success(data.updated ? 'Itinerary updated' : 'Itinerary saved — share link ready');
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || 'Save failed');
    }
  };

  const copyShareLink = async () => {
    if (!shareId) {
      toast.error('Save first to create a share link');
      return;
    }
    const url = `${window.location.origin}/itinerary?share=${encodeURIComponent(shareId)}&mode=edit`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Collaboration link copied');
    } catch {
      toast.error('Clipboard blocked — copy URL manually');
    }
  };

  const copyViewLink = async () => {
    if (!shareId) return;
    const url = `${window.location.origin}/itinerary?share=${encodeURIComponent(shareId)}&mode=view`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('View-only link copied');
    } catch {
      toast.error('Clipboard blocked');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-white">
            <FaHome /> Dashboard
          </Link>
          <span className="text-white/25">|</span>
          <h1 className="text-lg font-bold tracking-tight text-white">Itinerary planner</h1>
          {readOnly && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-100">
              View only
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <label className="flex items-center gap-2 text-xs text-cyan-100/80">
                <input
                  type="checkbox"
                  checked={allowEditViaLink}
                  onChange={(e) => setAllowEditViaLink(e.target.checked)}
                />
                Allow edit via link
              </label>
              <button
                type="button"
                onClick={saveTrip}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                <FaSave /> Save
              </button>
            </>
          )}
          <button
            type="button"
            onClick={copyShareLink}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            <FaLink /> Copy edit link
          </button>
          <button
            type="button"
            onClick={copyViewLink}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs text-cyan-100 hover:bg-white/10"
          >
            Copy view link
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-4 p-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-cyan-100/70">Trip title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            readOnly={!canEdit}
            className="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-2 text-base font-medium text-white outline-none focus:border-cyan-400/40 read-only:opacity-80"
          />
          {canEdit && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <button type="button" onClick={addDay} className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/15">
                + Day
              </button>
              <button type="button" onClick={removeLastDay} className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/15">
                − Last day
              </button>
            </div>
          )}
        </div>

        <AISearchBar onResult={onAiResult} readOnly={!canEdit} />

        <div className="grid gap-4 lg:grid-cols-[minmax(280px,400px)_1fr] lg:items-start">
          <div className="space-y-4 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1">
            <DayBuilder
              suggestions={suggestions}
              itemsByDay={itemsByDay}
              onItemsByDayChange={canEdit ? setItemsByDay : () => {}}
              readOnly={!canEdit}
            />
            <BudgetTracker
              items={budgetItems}
              onChange={canEdit ? setBudgetItems : () => {}}
              readOnly={!canEdit}
            />
          </div>
          <MapView markers={mapMarkers} center={mapCenter} minHeight={420} className="lg:sticky lg:top-24" />
        </div>
      </div>
    </div>
  );
}
