import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  DndContext, PointerSensor, useSensor, useSensors,
  closestCorners, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  MapContainer, TileLayer, Marker, Popup, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { server } from '../config/api.js';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CURRENCIES = ['INR', 'USD', 'EUR'];
const CURRENCY_SYMBOLS = { INR: 'Rs', USD: '$', EUR: 'EUR' };
const DAY_PALETTE = [
  '#f97316', '#06b6d4', '#8b5cf6', '#10b981',
  '#f59e0b', '#ef4444', '#3b82f6', '#ec4899',
];

const INTERESTS_OPTIONS = [
  'History & Culture', 'Food & Cuisine', 'Nature & Outdoors',
  'Adventure Sports', 'Shopping', 'Art & Museums',
  'Nightlife', 'Religious Sites', 'Architecture',
];

const LOADING_PHASES = [
  { icon: '🌍', text: 'Locating your destination...' },
  { icon: '📍', text: 'Gathering nearby attractions...' },
  { icon: '🤖', text: 'AI is crafting your itinerary...' },
  { icon: '✨', text: 'Adding finishing touches...' },
];

const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function geocodePlace(name, cityHint = '') {
  try {
    const q = cityHint ? `${name}, ${cityHint}` : name;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1`,
      { headers: { 'User-Agent': 'Travello/1.0 (student-project)' } }
    );
    const data = await res.json();
    if (data?.[0]) return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
  } catch {
    // silent
  }
  return null;
}

function MapFitter({ markers }) {
  const map = useMap();
  const prevLen = useRef(0);
  useEffect(() => {
    if (!markers.length || markers.length === prevLen.current) return;
    prevLen.current = markers.length;
    const valid = markers.filter((m) => m.lat && m.lon);
    if (!valid.length) return;
    if (valid.length === 1) {
      map.flyTo([valid[0].lat, valid[0].lon], 14, { duration: 1.2 });
    } else {
      map.flyToBounds(
        L.latLngBounds(valid.map((m) => [m.lat, m.lon])),
        { padding: [48, 48], duration: 1.2, maxZoom: 15 }
      );
    }
  }, [markers, map]);
  return null;
}

function makeIcon(num, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".35"/></filter>
    <path d="M17 0C8 0 1 7.2 1 16c0 11.2 16 28 16 28S33 27.2 33 16C33 7.2 26 0 17 0z"
          fill="${color}" filter="url(#s)"/>
    <circle cx="17" cy="16" r="10" fill="white" opacity=".92"/>
    <text x="17" y="20.5" text-anchor="middle" font-size="10.5" font-weight="800"
          fill="${color}" font-family="system-ui,sans-serif">${num}</text>
  </svg>`;
  return L.divIcon({
    html: svg, className: '',
    iconSize: [34, 44], iconAnchor: [17, 44], popupAnchor: [0, -44],
  });
}

const COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'DE', name: 'Germany' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'NP', name: 'Nepal' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
];

function TripInputForm({ onGenerate, loading }) {
  const [destination, setDestination] = useState('');
  const [country, setCountry] = useState('IN');
  const [days, setDays] = useState(3);
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [interests, setInterests] = useState([]);
  const [customInterest, setCustomInterest] = useState('');
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!loading) {
      setPhase(0);
      return;
    }
    const t = setInterval(() => setPhase((p) => Math.min(p + 1, LOADING_PHASES.length - 1)), 2800);
    return () => clearInterval(t);
  }, [loading]);

  const toggleInterest = (i) =>
    setInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!destination.trim()) {
      toast.error('Please enter a destination');
      return;
    }
    const countryName = COUNTRIES.find(c => c.code === country)?.name || '';
    const allInterests = [...interests, customInterest].filter(Boolean);
    const fullDestination = countryName ? `${destination.trim()}, ${countryName}` : destination.trim();
    onGenerate({
      query: `${days} days in ${fullDestination}${allInterests.length ? ', interests: ' + allInterests.join(', ') : ''}${budget ? ', budget: ' + budget + ' ' + currency : ''}`,
      dayCount: days,
      destination: destination.trim(),
      country: countryName,
      budget: budget ? { amount: Number(budget), currency } : null,
      interests: allInterests,
    });
  };

  const quickDestinations = ['Paris', 'Goa', 'Tokyo', 'Jaipur', 'Bali', 'London', 'New York', 'Dubai'];

  return (
    <div className="travello-form-card">
      <div className="form-hero">
        <div className="form-hero-badge">AI-Powered</div>
        <h1 className="form-hero-title">Plan Your Perfect Trip</h1>
        <p className="form-hero-sub">
          Describe your dream destination - our AI builds a complete day-by-day itinerary in seconds.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form-body">
        <div className="field-group">
          <label className="field-label">
            <span className="field-icon">🌍</span> Where are you going?
          </label>
          <div className="destination-row">
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Paris, Jaipur, Tokyo..."
              className="field-input flex-1"
              disabled={loading}
            />
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="country-select"
              disabled={loading}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="quick-chips">
            {quickDestinations.map((d) => (
              <button key={d} type="button" className="quick-chip" onClick={() => setDestination(d)}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="field-group flex-1">
            <label className="field-label">
              <span className="field-icon">📅</span> Number of days
            </label>
            <div className="days-stepper">
              <button type="button" className="stepper-btn" onClick={() => setDays((d) => Math.max(1, d - 1))}>-</button>
              <span className="stepper-val">{days}</span>
              <button type="button" className="stepper-btn" onClick={() => setDays((d) => Math.min(14, d + 1))}>+</button>
            </div>
          </div>
          <div className="field-group flex-1">
            <label className="field-label">
              <span className="field-icon">💰</span> Budget (optional)
            </label>
            <div className="budget-row">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="currency-select" disabled={loading}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input
                type="number"
                min="0"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. 50000"
                className="field-input budget-input"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">
            <span className="field-icon">✨</span> Your interests
          </label>
          <div className="interests-grid">
            {INTERESTS_OPTIONS.map((i) => (
              <button key={i} type="button" className={`interest-chip ${interests.includes(i) ? 'selected' : ''}`} onClick={() => toggleInterest(i)}>
                {i}
              </button>
            ))}
          </div>
          <input
            value={customInterest}
            onChange={(e) => setCustomInterest(e.target.value)}
            placeholder="Or type your own interest..."
            className="field-input mt-2"
            disabled={loading}
          />
        </div>

        <button type="submit" disabled={loading || !destination.trim()} className="generate-btn">
          {loading ? (
            <span className="loading-content">
              <span className="loading-icon">{LOADING_PHASES[phase].icon}</span>
              <span>{LOADING_PHASES[phase].text}</span>
              <span className="loading-dots">
                <span /><span /><span />
              </span>
            </span>
          ) : (
            <span>Generate My Itinerary</span>
          )}
        </button>
      </form>
    </div>
  );
}

function ActivityCard({ activity, dayColor, onUpdate, onRemove, readOnly, globalIndex }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: activity.instanceId, disabled: readOnly });

  const [editCost, setEditCost] = useState(false);
  const [editNotes, setEditNotes] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className={`activity-card ${isDragging ? 'dragging' : ''}`}>
      <div className="activity-stripe" style={{ background: dayColor }} />
      <div className="activity-body">
        <div className="activity-top">
          <span className="activity-num" style={{ background: dayColor }}>
            {globalIndex + 1}
          </span>
          <div className="activity-title-group">
            {activity.time && <span className="activity-time">{activity.time}</span>}
            <h4 className="activity-name">{activity.name}</h4>
          </div>
          {!readOnly && (
            <button type="button" className="drag-handle" {...listeners} {...attributes} aria-label="Drag to reorder">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
                <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
                <circle cx="5" cy="12" r="1.5" /><circle cx="11" cy="12" r="1.5" />
              </svg>
            </button>
          )}
        </div>

        {editNotes ? (
          <textarea
            autoFocus
            defaultValue={activity.notes || ''}
            rows={2}
            className="activity-edit-input"
            onBlur={(e) => {
              onUpdate({ notes: e.target.value });
              setEditNotes(false);
            }}
            placeholder="Add a description..."
          />
        ) : (
          <p
            className={`activity-notes ${!readOnly ? 'cursor-pointer hover:text-white/80' : ''}`}
            onClick={() => !readOnly && setEditNotes(true)}
            title={!readOnly ? 'Click to edit' : undefined}
          >
            {activity.notes || (!readOnly ? '+ Add description' : '')}
          </p>
        )}

        <div className="activity-footer">
          {editCost ? (
            <div className="cost-edit-row">
              <select
                defaultValue={activity.costCurrency || 'INR'}
                className="cost-currency-select"
                onChange={(e) => onUpdate({ costCurrency: e.target.value })}
              >
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input
                autoFocus
                type="number"
                min="0"
                defaultValue={activity.cost || ''}
                className="cost-input"
                placeholder="0"
                onBlur={(e) => {
                  onUpdate({ cost: Number(e.target.value) || 0 });
                  setEditCost(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
              />
            </div>
          ) : (
            <button
              type="button"
              className="cost-badge"
              onClick={() => !readOnly && setEditCost(true)}
              disabled={readOnly}
            >
              {activity.cost
                ? `${CURRENCY_SYMBOLS[activity.costCurrency || 'INR']}${activity.cost.toLocaleString()}`
                : (!readOnly ? '+ Add cost' : 'Free')}
            </button>
          )}
          {!readOnly && (
            <button type="button" className="remove-btn" onClick={onRemove} aria-label="Remove activity">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day, dayIndex, activities, onUpdate, onRemove, onAdd,
  readOnly, globalOffset,
}) {
  const color = DAY_PALETTE[dayIndex % DAY_PALETTE.length];
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customTime, setCustomTime] = useState('');
  const ids = activities.map((a) => a.instanceId);

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    onAdd(dayIndex, {
      instanceId: uid(),
      name: customName.trim(),
      time: customTime,
      notes: '',
      cost: 0,
      costCurrency: 'INR',
      lat: null,
      lon: null,
    });
    setCustomName('');
    setCustomTime('');
    setAddingCustom(false);
  };

  return (
    <div className="day-column">
      <div className="day-header" style={{ borderColor: color }}>
        <div className="day-badge" style={{ background: color }}>
          Day {dayIndex + 1}
        </div>
        <span className="day-theme">{day.theme || ''}</span>
        <span className="day-count">{activities.length} stops</span>
      </div>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="activities-list">
          {activities.length === 0 && (
            <div className="empty-day">
              <span>Drop activities here</span>
            </div>
          )}
          {activities.map((act, i) => (
            <ActivityCard
              key={act.instanceId}
              activity={act}
              dayColor={color}
              globalIndex={globalOffset + i}
              onUpdate={(patch) => onUpdate(dayIndex, act.instanceId, patch)}
              onRemove={() => onRemove(dayIndex, act.instanceId)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </SortableContext>

      {!readOnly && (
        addingCustom ? (
          <div className="add-custom-form">
            <input
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Activity name..."
              className="custom-name-input"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
            />
            <div className="add-custom-row">
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="custom-time-input"
              />
              <button type="button" className="add-confirm-btn" style={{ background: color }} onClick={handleAddCustom}>Add</button>
              <button type="button" className="add-cancel-btn" onClick={() => setAddingCustom(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="add-activity-btn" onClick={() => setAddingCustom(true)} style={{ '--day-color': color }}>
            + Add activity
          </button>
        )
      )}
    </div>
  );
}

function BudgetPanel({ itemsByDay, tripBudget }) {
  const [displayCurrency, setDisplayCurrency] = useState(tripBudget?.currency || 'INR');
  const toINR = { INR: 1, USD: 83, EUR: 90 };
  const fromINR = { INR: 1, USD: 1 / 83, EUR: 1 / 90 };

  const totals = useMemo(() => {
    const acc = { INR: 0, USD: 0, EUR: 0 };
    for (const col of itemsByDay) {
      for (const act of col) {
        if (act.cost) acc[act.costCurrency || 'INR'] += Number(act.cost) || 0;
      }
    }
    return acc;
  }, [itemsByDay]);

  const grandTotal = useMemo(() =>
    Object.entries(totals).reduce((sum, [cur, amt]) => {
      const inr = amt * (toINR[cur] || 1);
      return sum + inr * (fromINR[displayCurrency] || 1);
    }, 0),
  [totals, displayCurrency]);

  const budget = tripBudget?.amount
    ? tripBudget.amount * (toINR[tripBudget.currency] || 1) * (fromINR[displayCurrency] || 1)
    : null;

  const pct = budget ? Math.min(100, (grandTotal / budget) * 100) : null;
  const sym = CURRENCY_SYMBOLS[displayCurrency] || '';

  return (
    <div className="budget-panel">
      <div className="budget-header">
        <h3 className="budget-title">💰 Budget Tracker</h3>
        <select value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value)} className="budget-currency-select">
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="budget-total">
        <span className="budget-total-label">Total spent</span>
        <span className="budget-total-amount">
          {sym}{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
      </div>

      {budget !== null && (
        <div className="budget-bar-wrap">
          <div className="budget-bar-track">
            <div
              className={`budget-bar-fill ${pct > 90 ? 'over' : pct > 70 ? 'warn' : 'ok'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="budget-bar-labels">
            <span>{sym}{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })} spent</span>
            <span>Budget: {sym}{budget.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      )}

      <div className="budget-breakdown">
        {CURRENCIES.filter((c) => totals[c] > 0).map((c) => (
          <div key={c} className="breakdown-chip">
            <span className="breakdown-currency">{c}</span>
            <span className="breakdown-amount">
              {CURRENCY_SYMBOLS[c]}{totals[c].toLocaleString()}
            </span>
          </div>
        ))}
        {!Object.values(totals).some((v) => v > 0) && (
          <p className="breakdown-empty">Add costs to activities to track spending</p>
        )}
      </div>
    </div>
  );
}

export default function ItineraryPlanner() {
  const [stage, setStage] = useState('input');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [tripBudget, setTripBudget] = useState(null);
  const [days, setDays] = useState([]);
  const [itemsByDay, setItemsByDay] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [activeDrag, setActiveDrag] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [loadIdInput, setLoadIdInput] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [mapCenter, setMapCenter] = useState([20, 78]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const geocodeItems = useCallback(async (grid, dest) => {
    const updated = grid.map((col) => [...col]);
    const tasks = [];
    updated.forEach((col, di) =>
      col.forEach((act, ai) => {
        if (!act.lat || !act.lon) {
          tasks.push(
            geocodePlace(act.name, dest).then((geo) => {
              if (geo) updated[di][ai] = { ...updated[di][ai], ...geo };
            })
          );
        }
      })
    );
    if (tasks.length) await Promise.allSettled(tasks);
    return updated;
  }, []);

  useEffect(() => {
    let k = 0;
    const list = [];
    itemsByDay.forEach((col, di) =>
      col.forEach((act) => {
        if (act.lat && act.lon) {
          list.push({
            key: act.instanceId,
            lat: act.lat,
            lon: act.lon,
            name: act.name,
            time: act.time,
            notes: act.notes,
            dayIndex: di,
            num: ++k,
          });
        }
      })
    );
    setMarkers(list);
    if (list.length) setMapCenter([list[0].lat, list[0].lon]);
  }, [itemsByDay]);

  const handleGenerate = async (formData) => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${server}/itinerary/generate`, {
        query: formData.query,
        dayCount: formData.dayCount,
      });

      setTitle(data.title || `Trip to ${formData.destination}`);
      setDestination(formData.destination);
      setTripBudget(formData.budget);

      const grid = (data.days || []).map((d) =>
        (d.items || []).map((item) => ({
          instanceId: item.instanceId || uid(),
          name: item.name || 'Stop',
          time: item.time || '',
          notes: item.notes || '',
          lat: item.lat || null,
          lon: item.lon || null,
          cost: 0,
          costCurrency: formData.budget?.currency || 'INR',
          kinds: item.kinds || '',
        }))
      );

      setDays((data.days || []).map((d) => ({ theme: d.theme || '' })));
      const geocoded = await geocodeItems(grid, formData.destination);
      setItemsByDay(geocoded);
      setActiveTab(0);
      setStage('planner');
      toast.success(`${data.title || 'Itinerary'} is ready!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed - please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = ({ active }) => setActiveDrag(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveDrag(null);
    if (!over || active.id === over.id) return;

    setItemsByDay((prev) => {
      const findDay = (id) => {
        for (let d = 0; d < prev.length; d += 1) {
          if (prev[d].find((a) => a.instanceId === id)) return d;
        }
        return -1;
      };

      const srcDay = findDay(active.id);
      if (srcDay < 0) return prev;

      let dstDay = findDay(over.id);
      if (dstDay < 0) {
        const m = String(over.id).match(/^day-(\d+)$/);
        if (m) dstDay = Number(m[1]);
      }
      if (dstDay < 0) return prev;

      const next = prev.map((d) => [...d]);

      if (srcDay === dstDay) {
        const col = next[srcDay];
        const oldI = col.findIndex((a) => a.instanceId === active.id);
        const newI = col.findIndex((a) => a.instanceId === over.id);
        if (oldI >= 0 && newI >= 0) next[srcDay] = arrayMove(col, oldI, newI);
      } else {
        const si = next[srcDay].findIndex((a) => a.instanceId === active.id);
        const [moved] = next[srcDay].splice(si, 1);
        const di = next[dstDay].findIndex((a) => a.instanceId === over.id);
        if (di >= 0) next[dstDay].splice(di, 0, moved);
        else next[dstDay].push(moved);
      }
      return next;
    });
  };

  const updateActivity = (dayIndex, instanceId, patch) => {
    setItemsByDay((prev) => {
      const next = prev.map((d) => [...d]);
      next[dayIndex] = next[dayIndex].map((a) =>
        a.instanceId === instanceId ? { ...a, ...patch } : a
      );
      return next;
    });
  };

  const removeActivity = (dayIndex, instanceId) => {
    setItemsByDay((prev) => {
      const next = prev.map((d) => [...d]);
      next[dayIndex] = next[dayIndex].filter((a) => a.instanceId !== instanceId);
      return next;
    });
  };

  const addActivity = (dayIndex, activity) => {
    setItemsByDay((prev) => {
      const next = prev.map((d) => [...d]);
      next[dayIndex] = [...next[dayIndex], activity];
      return next;
    });
    geocodePlace(activity.name, destination).then((geo) => {
      if (geo) updateActivity(dayIndex, activity.instanceId, geo);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title,
        days: itemsByDay.map((items, dayIndex) => ({
          dayIndex,
          theme: days[dayIndex]?.theme || '',
          items: items.map(({ instanceId, name, lat, lon, time, notes, cost, costCurrency, kinds }) => ({
            instanceId,
            name,
            lat,
            lon,
            time,
            notes,
            kinds,
            cost: cost || 0,
            costCurrency: costCurrency || 'INR',
          })),
        })),
        budgetItems: [],
        allowEditViaLink: true,
      };
      const { data } = await axios.post(`${server}/itinerary/save`, payload, {
        withCredentials: true,
      });
      setSavedId(data.shareId || data._id || data.id);
      toast.success('Itinerary saved! ✓');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async () => {
    const id = loadIdInput.trim();
    if (!id) return;
    try {
      const { data } = await axios.get(`${server}/itinerary/shared/${id}`);
      setTitle(data.title || 'Saved trip');
      setDays((data.days || []).map((d) => ({ theme: d.theme || '' })));
      const grid = (data.days || []).map((d) =>
        (d.items || []).map((item) => ({
          instanceId: item.instanceId || uid(),
          name: item.name,
          time: item.time || '',
          notes: item.notes || '',
          lat: item.lat || null,
          lon: item.lon || null,
          cost: item.cost || 0,
          costCurrency: item.costCurrency || 'INR',
          kinds: item.kinds || '',
        }))
      );
      setItemsByDay(grid);
      setSavedId(id);
      setStage('planner');
      toast.success('Itinerary loaded!');
    } catch {
      toast.error('Could not load - check the ID');
    }
  };

  const dayOffsets = useMemo(() => {
    const offsets = [];
    let sum = 0;
    for (const col of itemsByDay) {
      offsets.push(sum);
      sum += col.length;
    }
    return offsets;
  }, [itemsByDay]);

  const activeDragItem = useMemo(() => {
    if (!activeDrag) return null;
    for (const col of itemsByDay) {
      const found = col.find((a) => a.instanceId === activeDrag);
      if (found) return found;
    }
    return null;
  }, [activeDrag, itemsByDay]);

  if (stage === 'input') {
    return (
      <>
        <style>{styles}</style>
        <div className="tp-root input-stage">
          <nav className="tp-nav">
            <Link to="/dashboard" className="tp-nav-back">
              ← Dashboard
            </Link>
            <div className="load-row">
              <input value={loadIdInput} onChange={(e) => setLoadIdInput(e.target.value)} placeholder="Paste saved ID to load..." className="load-input" />
              <button type="button" className="load-btn" onClick={handleLoad}>Load</button>
            </div>
          </nav>
          <div className="input-center">
            <TripInputForm onGenerate={handleGenerate} loading={loading} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="tp-root planner-stage">
        <header className="tp-topbar">
          <div className="topbar-left">
            <button type="button" className="back-to-input" onClick={() => setStage('input')}>← New trip</button>
            <h1 className="topbar-title">{title}</h1>
          </div>
          <div className="topbar-right">
            {savedId && <span className="saved-badge">Saved ✓</span>}
            <button type="button" className="save-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : '💾 Save'}
            </button>
            {savedId && (
              <button
                type="button"
                className="share-btn"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/itinerary?share=${savedId}&mode=view`
                  );
                  toast.success('Share link copied!');
                }}
              >
                🔗 Share
              </button>
            )}
          </div>
        </header>

        <div className="planner-layout">
          <aside className="planner-sidebar">
            <div className="day-tabs">
              {itemsByDay.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`day-tab ${activeTab === i ? 'active' : ''}`}
                  style={activeTab === i ? { background: DAY_PALETTE[i % DAY_PALETTE.length] } : {}}
                  onClick={() => setActiveTab(i)}
                >
                  Day {i + 1}
                </button>
              ))}
            </div>

            <BudgetPanel itemsByDay={itemsByDay} tripBudget={tripBudget} />

            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="active-day-wrap">
                {itemsByDay.map((col, di) =>
                  di === activeTab ? (
                    <DayColumn
                      key={di}
                      day={days[di] || {}}
                      dayIndex={di}
                      activities={col}
                      onUpdate={updateActivity}
                      onRemove={removeActivity}
                      onAdd={addActivity}
                      readOnly={false}
                      globalOffset={dayOffsets[di] || 0}
                    />
                  ) : null
                )}
              </div>

              <DragOverlay dropAnimation={null}>
                {activeDragItem && (
                  <div className="drag-ghost">{activeDragItem.name}</div>
                )}
              </DragOverlay>
            </DndContext>

            <div className="all-days-nav">
              <p className="all-days-label">All days overview</p>
              {itemsByDay.map((col, di) => (
                <button
                  key={di}
                  type="button"
                  className={`all-day-row ${activeTab === di ? 'active' : ''}`}
                  onClick={() => setActiveTab(di)}
                >
                  <span className="all-day-dot" style={{ background: DAY_PALETTE[di % DAY_PALETTE.length] }} />
                  <span className="all-day-name">Day {di + 1}</span>
                  <span className="all-day-count">{col.length} stops</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="planner-map-wrap">
            <MapContainer
              center={mapCenter}
              zoom={markers.length ? 12 : 5}
              className="the-map"
              scrollWheelZoom
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <MapFitter markers={markers} />
              {markers.map((m) => (
                <Marker key={m.key} position={[m.lat, m.lon]} icon={makeIcon(m.num, DAY_PALETTE[m.dayIndex % DAY_PALETTE.length])}>
                  <Popup>
                    <div className="map-popup">
                      <span className="popup-day" style={{ color: DAY_PALETTE[m.dayIndex % DAY_PALETTE.length] }}>
                        Day {m.dayIndex + 1} · Stop {m.num}
                      </span>
                      <strong className="popup-name">{m.name}</strong>
                      {m.time && <span className="popup-time">{m.time}</span>}
                      {m.notes && <p className="popup-notes">{m.notes}</p>}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {markers.length > 0 && (
              <div className="map-legend">
                {itemsByDay.map((col, di) => col.length > 0 && (
                  <div key={di} className="legend-item">
                    <span className="legend-dot" style={{ background: DAY_PALETTE[di % DAY_PALETTE.length] }} />
                    Day {di + 1}
                  </div>
                ))}
              </div>
            )}

            {markers.length === 0 && (
              <div className="map-empty">
                <div className="map-empty-icon">🗺️</div>
                <p>Map markers will appear as locations are added to your itinerary</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');
  @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
  :root {
    --bg: #0b0f1a;
    --surface: #141927;
    --surface2: #1c2333;
    --border: rgba(255,255,255,0.08);
    --text: #e8eaf0;
    --text-muted: rgba(232,234,240,0.5);
    --radius: 16px;
    --radius-sm: 10px;
  }
  .tp-root { font-family: 'DM Sans', sans-serif; background: var(--bg); min-height: 100vh; color: var(--text); }
  .leaflet-popup-content-wrapper { background: #141927 !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 12px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important; color: var(--text) !important; }
  .leaflet-popup-tip { background: #141927 !important; }
  .leaflet-popup-close-button { color: rgba(255,255,255,0.4) !important; top: 8px !important; right: 8px !important; }
  .tp-nav { display: flex; align-items: center; justify-content: space-between; padding: 16px 28px; border-bottom: 1px solid var(--border); background: rgba(11,15,26,0.8); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 40; }
  .tp-nav-back { color: rgba(232,234,240,0.6); font-size: 14px; text-decoration: none; transition: color .2s; }
  .tp-nav-back:hover { color: var(--text); }
  .load-row { display: flex; gap: 8px; }
  .load-input { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 14px; color: var(--text); font-size: 13px; width: 240px; outline: none; }
  .load-input::placeholder { color: var(--text-muted); }
  .load-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 16px; color: var(--text); font-size: 13px; cursor: pointer; transition: background .2s; }
  .load-btn:hover { background: rgba(255,255,255,0.1); }
  .input-stage { background: radial-gradient(ellipse at 50% -10%, rgba(249,115,22,.12) 0%, var(--bg) 65%); }
  .input-center { max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; }
  .travello-form-card { background: var(--surface); border: 1px solid var(--border); border-radius: 24px; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,0.5); }
  .form-hero { background: linear-gradient(135deg, rgba(249,115,22,.15) 0%, rgba(6,182,212,.08) 100%); padding: 48px 40px 40px; border-bottom: 1px solid var(--border); text-align: center; }
  .form-hero-badge { display: inline-block; background: rgba(249,115,22,.15); border: 1px solid rgba(249,115,22,.3); color: #fb923c; border-radius: 100px; padding: 4px 14px; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 20px; }
  .form-hero-title { font-family: 'Sora', sans-serif; font-size: clamp(28px,5vw,44px); font-weight: 800; line-height: 1.1; color: #fff; margin: 0 0 12px; }
  .form-hero-sub { color: var(--text-muted); font-size: 16px; max-width: 440px; margin: 0 auto; }
  .form-body { padding: 36px 40px; display: flex; flex-direction: column; gap: 28px; }
  @media (max-width: 600px) { .form-body { padding: 24px 20px; } .form-hero { padding: 32px 20px; } }
  .field-group { display: flex; flex-direction: column; gap: 8px; }
  .field-label { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; display: flex; align-items: center; gap: 6px; }
  .field-icon { font-size: 15px; }
  .field-input { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 13px 16px; color: var(--text); font-size: 15px; font-family: inherit; outline: none; transition: border-color .2s, box-shadow .2s; }
  .field-input:focus { border-color: rgba(249,115,22,.5); box-shadow: 0 0 0 3px rgba(249,115,22,.08); }
  .field-input::placeholder { color: rgba(232,234,240,.28); }
  .field-input:disabled { opacity: .5; }
  .destination-row { display: flex; gap: 10px; }
  .country-select { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 13px 12px; color: var(--text); font-size: 14px; outline: none; cursor: pointer; min-width: 140px; }
  .country-select:focus { border-color: rgba(249,115,22,.5); }
  .quick-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .quick-chip { background: var(--surface2); border: 1px solid var(--border); border-radius: 100px; padding: 5px 13px; font-size: 12px; color: var(--text-muted); cursor: pointer; transition: all .2s; }
  .quick-chip:hover { border-color: rgba(249,115,22,.4); color: #fb923c; }
  .form-row { display: flex; gap: 20px; }
  @media (max-width: 520px) { .form-row { flex-direction: column; } }
  .flex-1 { flex: 1; }
  .days-stepper { display: flex; align-items: center; gap: 0; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; width: fit-content; }
  .stepper-btn { background: transparent; border: none; color: var(--text-muted); padding: 10px 18px; font-size: 20px; cursor: pointer; transition: background .2s; }
  .stepper-btn:hover { background: rgba(255,255,255,.06); color: var(--text); }
  .stepper-val { padding: 10px 20px; font-size: 18px; font-weight: 700; color: var(--text); border-left: 1px solid var(--border); border-right: 1px solid var(--border); min-width: 54px; text-align: center; }
  .budget-row { display: flex; gap: 8px; }
  .currency-select { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 13px 10px; color: var(--text); font-size: 14px; outline: none; cursor: pointer; }
  .budget-input { flex: 1; }
  .interests-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .interest-chip { background: var(--surface2); border: 1px solid var(--border); border-radius: 100px; padding: 7px 16px; font-size: 13px; color: var(--text-muted); cursor: pointer; transition: all .2s; }
  .interest-chip:hover { border-color: rgba(249,115,22,.4); color: #fb923c; }
  .interest-chip.selected { background: rgba(249,115,22,.15); border-color: rgba(249,115,22,.5); color: #fb923c; }
  .mt-2 { margin-top: 8px; }
  .generate-btn { background: linear-gradient(135deg, #f97316, #ea580c); border: none; border-radius: var(--radius-sm); padding: 16px 32px; color: #fff; font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700; cursor: pointer; transition: all .25s; box-shadow: 0 8px 28px rgba(249,115,22,.3); letter-spacing: .01em; }
  .generate-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(249,115,22,.4); }
  .generate-btn:disabled { opacity: .6; cursor: not-allowed; transform: none; }
  .loading-content { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .loading-icon { font-size: 18px; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
  .loading-dots { display: flex; gap: 4px; }
  .loading-dots span { width: 5px; height: 5px; background: rgba(255,255,255,.7); border-radius: 50%; animation: bounce .8s ease-in-out infinite; }
  .loading-dots span:nth-child(2) { animation-delay: .15s; }
  .loading-dots span:nth-child(3) { animation-delay: .3s; }
  @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
  .planner-stage { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  .tp-topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; z-index: 30; }
  .topbar-left { display: flex; align-items: center; gap: 16px; min-width: 0; }
  .back-to-input { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 14px; color: var(--text-muted); font-size: 13px; cursor: pointer; white-space: nowrap; transition: all .2s; }
  .back-to-input:hover { color: var(--text); border-color: rgba(255,255,255,.15); }
  .topbar-title { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 380px; }
  .topbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .saved-badge { background: rgba(16,185,129,.15); border: 1px solid rgba(16,185,129,.3); color: #34d399; border-radius: 100px; padding: 4px 12px; font-size: 12px; font-weight: 600; }
  .save-btn { background: linear-gradient(135deg,#f97316,#ea580c); border: none; border-radius: var(--radius-sm); padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; transition: all .2s; box-shadow: 0 4px 14px rgba(249,115,22,.25); }
  .save-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(249,115,22,.35); }
  .save-btn:disabled { opacity: .6; cursor: not-allowed; }
  .share-btn { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 18px; color: var(--text); font-size: 14px; cursor: pointer; transition: all .2s; }
  .share-btn:hover { border-color: rgba(255,255,255,.2); }
  .planner-layout { display: grid; grid-template-columns: 420px 1fr; flex: 1; overflow: hidden; }
  @media (max-width: 900px) { .planner-layout { grid-template-columns: 1fr; } .planner-map-wrap { display: none; } }
  .planner-sidebar { display: flex; flex-direction: column; gap: 0; border-right: 1px solid var(--border); overflow-y: auto; background: var(--bg); }
  .day-tabs { display: flex; gap: 6px; padding: 14px 16px 12px; border-bottom: 1px solid var(--border); overflow-x: auto; flex-shrink: 0; scrollbar-width: none; }
  .day-tabs::-webkit-scrollbar { display: none; }
  .day-tab { border: 1px solid var(--border); border-radius: 100px; padding: 6px 16px; font-size: 13px; font-weight: 600; color: var(--text-muted); background: transparent; cursor: pointer; white-space: nowrap; transition: all .2s; }
  .day-tab.active { color: #fff; border-color: transparent; }
  .day-tab:not(.active):hover { border-color: rgba(255,255,255,.15); color: var(--text); }
  .budget-panel { padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .budget-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .budget-title { font-size: 14px; font-weight: 700; color: var(--text); margin: 0; }
  .budget-currency-select { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 4px 8px; color: var(--text); font-size: 12px; outline: none; }
  .budget-total { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
  .budget-total-label { font-size: 12px; color: var(--text-muted); }
  .budget-total-amount { font-family: 'Sora',sans-serif; font-size: 22px; font-weight: 800; color: #fff; }
  .budget-bar-wrap { margin-bottom: 10px; }
  .budget-bar-track { height: 6px; background: var(--surface2); border-radius: 100px; overflow: hidden; }
  .budget-bar-fill { height: 100%; border-radius: 100px; transition: width .4s ease; }
  .budget-bar-fill.ok { background: linear-gradient(90deg,#10b981,#34d399); }
  .budget-bar-fill.warn { background: linear-gradient(90deg,#f59e0b,#fbbf24); }
  .budget-bar-fill.over { background: linear-gradient(90deg,#ef4444,#f87171); }
  .budget-bar-labels { display: flex; justify-content: space-between; margin-top: 4px; }
  .budget-bar-labels span { font-size: 11px; color: var(--text-muted); }
  .budget-breakdown { display: flex; flex-wrap: wrap; gap: 6px; }
  .breakdown-chip { display: flex; align-items: center; gap: 6px; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 4px 10px; }
  .breakdown-currency { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
  .breakdown-amount { font-size: 13px; font-weight: 600; color: var(--text); }
  .breakdown-empty { font-size: 11px; color: var(--text-muted); margin: 0; }
  .active-day-wrap { flex: 1; padding: 12px 16px; }
  .day-column { display: flex; flex-direction: column; gap: 10px; }
  .day-header { display: flex; align-items: center; gap: 8px; border-left: 3px solid; padding-left: 10px; margin-bottom: 4px; }
  .day-badge { border-radius: 100px; padding: 3px 12px; font-size: 11px; font-weight: 800; color: #fff; letter-spacing: .04em; text-transform: uppercase; }
  .day-theme { font-size: 13px; color: var(--text-muted); flex: 1; }
  .day-count { font-size: 11px; color: var(--text-muted); margin-left: auto; }
  .activities-list { display: flex; flex-direction: column; gap: 8px; }
  .empty-day { border: 1px dashed rgba(255,255,255,.12); border-radius: var(--radius-sm); padding: 28px; text-align: center; color: var(--text-muted); font-size: 13px; }
  .activity-card { display: flex; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--border); overflow: hidden; transition: box-shadow .2s, border-color .2s; }
  .activity-card:hover { border-color: rgba(255,255,255,.14); box-shadow: 0 4px 16px rgba(0,0,0,.3); }
  .activity-card.dragging { box-shadow: 0 12px 40px rgba(0,0,0,.5); border-color: rgba(255,255,255,.2); }
  .activity-stripe { width: 4px; flex-shrink: 0; }
  .activity-body { flex: 1; padding: 12px 12px 10px 12px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .activity-top { display: flex; align-items: flex-start; gap: 8px; }
  .activity-num { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #fff; margin-top: 1px; }
  .activity-title-group { flex: 1; min-width: 0; }
  .activity-time { font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 1px; }
  .activity-name { font-size: 14px; font-weight: 600; color: #fff; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .drag-handle { color: rgba(255,255,255,.25); background: none; border: none; cursor: grab; padding: 2px; border-radius: 6px; flex-shrink: 0; transition: color .2s; touch-action: none; }
  .drag-handle:hover { color: rgba(255,255,255,.5); }
  .drag-handle:active { cursor: grabbing; }
  .activity-notes { font-size: 12px; color: var(--text-muted); line-height: 1.5; margin: 0; transition: color .2s; }
  .activity-edit-input { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 8px 10px; color: var(--text); font-size: 12px; font-family: inherit; resize: none; outline: none; width: 100%; }
  .activity-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .cost-badge { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 4px 10px; font-size: 12px; color: var(--text-muted); cursor: pointer; transition: all .2s; }
  .cost-badge:hover:not(:disabled) { border-color: rgba(249,115,22,.35); color: #fb923c; }
  .cost-badge:disabled { cursor: default; }
  .cost-edit-row { display: flex; gap: 4px; }
  .cost-currency-select { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 4px 6px; color: var(--text); font-size: 12px; outline: none; }
  .cost-input { background: var(--surface2); border: 1px solid rgba(249,115,22,.35); border-radius: 6px; padding: 4px 8px; color: var(--text); font-size: 12px; width: 80px; outline: none; }
  .remove-btn { color: rgba(255,255,255,.2); background: none; border: none; cursor: pointer; padding: 4px; border-radius: 6px; display: flex; align-items: center; transition: color .2s; line-height: 1; }
  .remove-btn:hover { color: #f87171; }
  .add-activity-btn { background: rgba(255,255,255,.03); border: 1px dashed rgba(255,255,255,.12); border-radius: var(--radius-sm); padding: 10px; color: var(--text-muted); font-size: 13px; cursor: pointer; width: 100%; text-align: center; transition: all .2s; }
  .add-activity-btn:hover { border-color: var(--day-color, rgba(249,115,22,.4)); color: var(--day-color, #fb923c); }
  .add-custom-form { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .custom-name-input { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; color: var(--text); font-size: 13px; outline: none; width: 100%; transition: border-color .2s; }
  .custom-name-input:focus { border-color: rgba(249,115,22,.4); }
  .add-custom-row { display: flex; gap: 6px; align-items: center; }
  .custom-time-input { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; color: var(--text); font-size: 12px; outline: none; }
  .add-confirm-btn { border: none; border-radius: 8px; padding: 7px 16px; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; transition: opacity .2s; }
  .add-confirm-btn:hover { opacity: .85; }
  .add-cancel-btn { background: transparent; border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px; color: var(--text-muted); font-size: 13px; cursor: pointer; transition: all .2s; }
  .add-cancel-btn:hover { border-color: rgba(255,255,255,.2); color: var(--text); }
  .all-days-nav { border-top: 1px solid var(--border); padding: 12px 16px; flex-shrink: 0; }
  .all-days-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); margin: 0 0 8px; }
  .all-day-row { display: flex; align-items: center; gap: 8px; width: 100%; background: none; border: none; padding: 7px 8px; border-radius: 8px; cursor: pointer; transition: background .2s; text-align: left; }
  .all-day-row:hover { background: rgba(255,255,255,.04); }
  .all-day-row.active { background: rgba(255,255,255,.06); }
  .all-day-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .all-day-name { font-size: 13px; font-weight: 500; color: var(--text); flex: 1; }
  .all-day-count { font-size: 11px; color: var(--text-muted); }
  .drag-ghost { background: var(--surface2); border: 1px solid rgba(249,115,22,.5); border-radius: var(--radius-sm); padding: 10px 14px; font-size: 14px; font-weight: 600; color: #fff; box-shadow: 0 12px 40px rgba(0,0,0,.5); pointer-events: none; }
  .planner-map-wrap { position: relative; background: #0b1120; }
  .the-map { width: 100%; height: 100%; }
  .leaflet-container { height: 100% !important; background: #0b1120; }
  .map-legend { position: absolute; bottom: 20px; left: 16px; z-index: 500; background: rgba(11,15,26,.85); backdrop-filter: blur(12px); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; display: flex; flex-direction: column; gap: 5px; }
  .legend-item { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-muted); }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .map-empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; pointer-events: none; }
  .map-empty-icon { font-size: 48px; opacity: .2; }
  .map-empty p { font-size: 13px; color: rgba(255,255,255,.2); max-width: 200px; text-align: center; }
  .map-popup { display: flex; flex-direction: column; gap: 2px; }
  .popup-day { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
  .popup-name { font-size: 14px; font-weight: 700; color: #fff; margin: 0; }
  .popup-time { font-size: 11px; color: rgba(232,234,240,.5); }
  .popup-notes { font-size: 12px; color: rgba(232,234,240,.65); margin: 2px 0 0; }
  .planner-sidebar::-webkit-scrollbar { width: 4px; }
  .planner-sidebar::-webkit-scrollbar-track { background: transparent; }
  .planner-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 4px; }
`;
