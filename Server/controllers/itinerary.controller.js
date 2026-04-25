import { randomUUID } from 'crypto';
import axios from 'axios';
import Itinerary from '../models/itinerary.model.js';

const OTM_BASE = 'https://api.opentripmap.com/0.1/en/places';

function heuristicDestination(query) {
  const q = query.trim();
  let m = q.match(/\bin\s+([^,.!?]+?)(?:\s+for\s+|\s+\d+\s+|$)/i);
  if (m) return m[1].trim().replace(/[?.!]$/, '');
  m = q.match(/^(?:visit|explore|weekend in|trip to)\s+([^,.!?]+)/i);
  if (m) return m[1].trim();
  return q.split(/[,.]/)[0].trim().slice(0, 80) || 'Travel';
}

function normalizePois(features) {
  if (!Array.isArray(features)) return [];
  return features
    .map((f) => {
      const coords = f?.geometry?.coordinates;
      if (!coords || coords.length < 2) return null;
      const [lon, lat] = coords;
      const name = f?.properties?.name;
      if (!name) return null;
      return {
        name,
        lat,
        lon,
        kinds: f.properties.kinds || '',
        xid: f.properties.xid || '',
      };
    })
    .filter(Boolean);
}

async function fetchGeoname(name) {
  const { data } = await axios.get(`${OTM_BASE}/geoname`, {
    params: {
      name,
      lang: 'en',
      format: 'json',
      ...(process.env.OPENTRIPMAP_API_KEY && { apikey: process.env.OPENTRIPMAP_API_KEY }),
    },
    timeout: 20000,
  });
  return data;
}

async function fetchNominatimGeocode(name) {
  const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: name,
      format: 'jsonv2',
      limit: 1,
      addressdetails: 0,
    },
    headers: {
      // Nominatim requires a descriptive user-agent / contact.
      'User-Agent': process.env.NOMINATIM_USER_AGENT || 'Travello/1.0 (dev)',
      Accept: 'application/json',
    },
    timeout: 20000,
  });
  const first = Array.isArray(data) ? data[0] : null;
  if (!first) return null;
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return {
    lat,
    lon,
    name: first.display_name?.split(',')?.[0] || name,
  };
}

function pickLatLonFromGeoname(raw, fallbackName) {
  if (!raw) return null;
  if (typeof raw.lat === 'number' && typeof raw.lon === 'number') {
    return { lat: raw.lat, lon: raw.lon, name: raw.name || fallbackName };
  }
  const f = raw.features?.[0];
  if (f?.geometry?.coordinates?.length >= 2) {
    const [lon, lat] = f.geometry.coordinates;
    return { lat, lon, name: f.properties?.name || raw.name || fallbackName };
  }
  return null;
}

async function fetchRadius(lon, lat, radiusM = 15000, limit = 45) {
  const { data } = await axios.get(`${OTM_BASE}/radius`, {
    params: {
      radius: radiusM,
      lon,
      lat,
      limit,
      format: 'json',
      ...(process.env.OPENTRIPMAP_API_KEY && { apikey: process.env.OPENTRIPMAP_API_KEY }),
    },
    timeout: 20000,
  });
  return normalizePois(data?.features);
}

async function geminiDraft(userQuery, destName, pois, dayCount) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const poiSlice = pois.slice(0, 35);
  const prompt = `You are a travel itinerary assistant.

User request: "${userQuery}"
Primary destination (place name): ${destName}
Target day count (integer): ${dayCount}

Nearby POIs (JSON array; use these names and lat/lon when you pick a place):
${JSON.stringify(poiSlice)}

Return ONLY valid JSON (no markdown) with this shape:
{
  "title": "short trip title",
  "dayCount": ${dayCount},
  "days": [
    {
      "day": 1,
      "activities": [
        { "time": "09:30", "title": "Activity name", "description": "one sentence", "lat": 0, "lon": 0 }
      ]
    }
  ]
}

Rules: Prefer POIs from the list; copy lat/lon from the chosen POI. Include 2–5 activities per day. Times are plausible. If a POI is not in the list, still pick real coordinates near ${destName}.`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini error ${res.status}: ${t.slice(0, 200)}`);
  }
  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
}

async function openRouterDraft(userQuery, destName, pois, dayCount) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001:free';
  const poiSlice = pois.slice(0, 35);
  const prompt = `User request: "${userQuery}". Destination: ${dayCount} days in ${destName}. POIs: ${JSON.stringify(poiSlice)}. Return ONLY JSON: {"title":string,"dayCount":number,"days":[{"day":1,"activities":[{"time":"09:00","title":string,"description":string,"lat":number,"lon":number}]}]} — use lat/lon from POIs when possible.`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${t.slice(0, 200)}`);
  }
  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
}

function draftToDays(draft, fallbackDayCount) {
  const count = Math.min(
    14,
    Math.max(1, draft?.dayCount || draft?.days?.length || fallbackDayCount || 3)
  );
  const daysArr = Array.from({ length: count }, (_, i) => ({ dayIndex: i, items: [] }));
  const days = draft?.days || draft?.schedule || [];
  for (const block of days) {
    const idx = (block.day ?? block.dayIndex ?? 1) - 1;
    if (idx < 0 || idx >= daysArr.length) continue;
    const acts = block.activities || block.items || [];
    for (const a of acts) {
      daysArr[idx].items.push({
        instanceId: randomUUID(),
        name: a.title || a.name || 'Stop',
        lat: typeof a.lat === 'number' ? a.lat : undefined,
        lon: typeof a.lon === 'number' ? a.lon : undefined,
        time: a.time || '',
        notes: a.description || a.notes || '',
        kinds: a.kinds || '',
        xid: a.xid || '',
      });
    }
  }
  return daysArr;
}

export async function generateItinerary(req, res) {
  try {
    const { query, dayCount: bodyDayCount } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ message: 'query is required' });
    }

    const dayCount = Math.min(14, Math.max(1, parseInt(bodyDayCount, 10) || 3));
    const destGuess = heuristicDestination(query);
    let geoRaw = null;
    let nominatimPicked = null;
    try {
      geoRaw = await fetchGeoname(destGuess);
    } catch (e) {
      console.warn('OpenTripMap geoname failed, trying Nominatim fallback:', e.message);
      nominatimPicked = await fetchNominatimGeocode(destGuess);
    }

    let picked = pickLatLonFromGeoname(geoRaw, destGuess) || nominatimPicked;
    if (!picked && destGuess !== query.trim()) {
      try {
        const again = await fetchGeoname(query.trim().slice(0, 60));
        picked = pickLatLonFromGeoname(again, query.trim());
      } catch {
        try {
          picked = await fetchNominatimGeocode(query.trim().slice(0, 60));
        } catch {
          /* keep null */
        }
      }
    }
    const lat = picked?.lat;
    const lon = picked?.lon;
    const destName = picked?.name || geoRaw?.name || destGuess;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return res.status(404).json({
        message: 'Could not resolve destination',
        hint: destGuess,
      });
    }

    let pois = [];
    try {
      pois = await fetchRadius(lon, lat);
    } catch (e) {
      // Keep going with empty POIs so itinerary generation still works.
      console.warn('OpenTripMap radius failed, continuing with empty POIs:', e.message);
    }

    let draft = null;
    try {
      if (process.env.GEMINI_API_KEY) {
        draft = await geminiDraft(query.trim(), destName, pois, dayCount);
      }
      if (!draft && process.env.OPENROUTER_API_KEY) {
        draft = await openRouterDraft(query.trim(), destName, pois, dayCount);
      }
    } catch (e) {
      console.error('LLM draft failed:', e);
    }

    if (!draft) {
      draft = {
        title: `Ideas for ${destName}`,
        dayCount,
        days: Array.from({ length: dayCount }, (_, i) => ({
          day: i + 1,
          activities: pois.slice(i * 3, i * 3 + 3).map((p) => ({
            time: '10:00',
            title: p.name,
            description: p.kinds || 'Point of interest',
            lat: p.lat,
            lon: p.lon,
          })),
        })),
      };
    }

    const days = draftToDays(draft, dayCount);

    return res.json({
      destination: destName,
      lat,
      lon,
      pois,
      draft,
      days,
      title: draft.title || `Trip to ${destName}`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || 'generate failed' });
  }
}

export async function saveItinerary(req, res) {
  try {
    const userId = req.userId || null;
    const { shareId, title, days, budgetItems, allowEditViaLink } = req.body || {};

    if (!Array.isArray(days)) {
      return res.status(400).json({ message: 'days array required' });
    }

    if (shareId) {
      const doc = await Itinerary.findOne({ shareId });
      if (!doc) return res.status(404).json({ message: 'Itinerary not found' });
      const isOwner =
        req.userId &&
        doc.userId &&
        String(doc.userId) === String(req.userId);
      if (!doc.allowEditViaLink && !isOwner) {
        return res.status(403).json({
          message: 'This shared trip is view-only for others (sign in as the owner to save)',
        });
      }
      doc.title = title ?? doc.title;
      doc.days = days;
      doc.budgetItems = Array.isArray(budgetItems) ? budgetItems : doc.budgetItems;
      if (typeof allowEditViaLink === 'boolean') doc.allowEditViaLink = allowEditViaLink;
      if (userId && !doc.userId) doc.userId = userId;
      await doc.save();
      return res.json({ shareId: doc.shareId, updated: true });
    }

    const newShareId = randomUUID();
    await Itinerary.create({
      shareId: newShareId,
      userId,
      title: title || 'My trip',
      days,
      budgetItems: Array.isArray(budgetItems) ? budgetItems : [],
      allowEditViaLink: allowEditViaLink !== false,
    });

    return res.json({ shareId: newShareId, updated: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || 'save failed' });
  }
}

export async function getSharedItinerary(req, res) {
  try {
    const { shareId } = req.params;
    const doc = await Itinerary.findOne({ shareId }).lean();
    if (!doc) return res.status(404).json({ message: 'Not found' });
    return res.json({
      shareId: doc.shareId,
      title: doc.title,
      days: doc.days,
      budgetItems: doc.budgetItems || [],
      allowEditViaLink: doc.allowEditViaLink,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || 'load failed' });
  }
}
