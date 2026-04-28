import { randomUUID } from 'crypto';
import axios from 'axios';
import Itinerary from '../models/itinerary.model.js';

const OTM_BASE = 'https://api.opentripmap.com/0.1/en/places';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function heuristicDestination(query) {
  const q = query.trim();
  
  // First, try to remove "X days in" prefix and get what's after it
  // Query: "3 days in Paris, France, interests:..." -> "Paris, France, interests:..."
  let m = q.match(/^(\d+)\s*days?\s+in\s+(.+)/i);
  if (m) {
    // Take everything after "X days in" up to comma or interests/budget keywords
    let destPart = m[2];
    // Remove trailing ", interests:..." or ", budget:..." 
    destPart = destPart.replace(/,\s*(interests|budget):.*$/i, '');
    return destPart.trim().slice(0, 80) || 'Travel';
  }
  
  // Match "visit Paris, France" or "trip to Goa, India"
  m = q.match(/^(?:visit|explore|weekend in|trip to)\s+(.+?)(?:\s+for\s+|\s+days?\s+|$)/i);
  if (m) return m[1].trim();
  
  // Fallback: take everything before first comma or first 80 chars
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

async function fetchNominatimGeocode(name, query) {
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
  if (!first) {
    try {
      const retry = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: query,
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
      const retryFirst = Array.isArray(retry.data) ? retry.data[0] : null;
      if (retryFirst) {
        return {
          lat: Number(retryFirst.lat),
          lon: Number(retryFirst.lon),
          name: retryFirst.display_name?.split(',')?.[0] || query,
        };
      }
    } catch (e) {
      console.warn('Nominatim failed:', e.message);
    }
    return null;
  }
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

async function callGemini(userQuery, destName, pois, dayCount) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('[Gemini] GEMINI_API_KEY not set - skipping AI draft');
    return null;
  }

  const poiSlice = pois.slice(0, 35);
  const systemPrompt = 'You are an expert travel planner. Always respond with ONLY valid JSON - no markdown, no code fences, no extra text.';
  const userPrompt = `
Plan a ${dayCount}-day trip based on: "${userQuery}"
Destination: ${destName}

Available nearby places (prefer these for lat/lon accuracy):
${JSON.stringify(poiSlice, null, 2)}

Return ONLY this JSON structure (no other text):
{
  "title": "Catchy trip title",
  "dayCount": ${dayCount},
  "days": [
    {
      "day": 1,
      "theme": "Arrival & City Centre",
      "activities": [
        {
          "time": "09:30",
          "title": "Place or activity name",
          "description": "One engaging sentence about why to visit",
          "lat": 48.8584,
          "lon": 2.2945,
          "estimatedCostUSD": 15
        }
      ]
    }
  ]
}

Rules:
- Include 3-5 activities per day with realistic, spaced-out times
- Copy lat/lon from the POIs list when you use one of those places
- estimatedCostUSD: 0 for free attractions, realistic number otherwise
- Keep descriptions helpful and specific, not generic
- Spread activities geographically to minimise travel time
`.trim();

  const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.65,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errText.slice(0, 300)}`);
  }
  const body = await response.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
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

function buildFallbackDraft(destName, pois, dayCount, lat, lon) {
  const genericActivities = (dayNumber) => [
    {
      time: '09:00',
      title: `Explore ${destName} city center`,
      description: 'Start with a relaxed walk through the main local area.',
      lat,
      lon,
      estimatedCostUSD: 0,
    },
    {
      time: '13:00',
      title: `Local lunch in ${destName}`,
      description: 'Try a well-rated local restaurant for regional food.',
      lat,
      lon,
      estimatedCostUSD: 15,
    },
    {
      time: '17:00',
      title: `Evening highlights - Day ${dayNumber}`,
      description: 'Visit one key attraction and wrap up with sunset views.',
      lat,
      lon,
      estimatedCostUSD: 10,
    },
  ];

  return {
    title: `${dayCount} Days in ${destName}`,
    dayCount,
    days: Array.from({ length: dayCount }, (_, i) => {
      const dayPois = pois.slice(i * 4, i * 4 + 4);
      const activities = dayPois.length
        ? dayPois.map((p, j) => ({
            time: ['09:00', '11:30', '14:00', '16:30'][j] || '10:00',
            title: p.name,
            description: p.kinds ? `(${p.kinds.replace(/_/g, ' ')})` : 'Point of interest',
            lat: p.lat,
            lon: p.lon,
            estimatedCostUSD: 0,
          }))
        : genericActivities(i + 1);

      return {
        day: i + 1,
        theme: `Day ${i + 1}`,
        activities,
      };
    }),
  };
}

export async function generateItinerary(req, res) {
  try {
    const { query, dayCount: bodyDayCount } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ message: 'query is required' });
    }

    const dayCount = Math.min(14, Math.max(1, parseInt(bodyDayCount, 10) || 3));
    const destGuess = heuristicDestination(query);
    
    // Try multiple destination variations
    const destVariations = [
      destGuess,
      query.replace(/^\d+\s+days?\s+in\s+/i, '').trim().slice(0, 80), // Remove "3 days in" prefix
      query.trim().slice(0, 80), // Full query
    ];
    
    let geoRaw = null;
    let nominatimPicked = null;
    let picked = null;
    
    // Try each variation until we find coordinates
    for (const dest of destVariations) {
      if (picked) break;
      
      try {
        geoRaw = await fetchGeoname(dest);
        picked = pickLatLonFromGeoname(geoRaw, dest);
      } catch (e) {
        console.warn(`OpenTripMap failed for "${dest}", trying Nominatim:`, e.message);
        try {
          nominatimPicked = await fetchNominatimGeocode(dest, query);
          picked = nominatimPicked;
        } catch (e2) {
          console.warn(`Nominatim failed for "${dest}":`, e2.message);
        }
      }
    }
    
    // If still no result, try the full query directly
    if (!picked) {
      try {
        nominatimPicked = await fetchNominatimGeocode(query.trim().slice(0, 80), query);
        picked = nominatimPicked;
      } catch {
        /* keep null */
      }
    }
    
    const lat = picked?.lat;
    const lon = picked?.lon;
    const destName = picked?.name || geoRaw?.name || destGuess;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      // Log what we tried for debugging
      console.error(`Failed to find destination. Query: "${query}", destGuess: "${destGuess}"`);
      return res.status(404).json({
        message: `Could not find destination "${destGuess}". Try being more specific, e.g. "Paris, France".`,
        hint: destGuess,
      });
    }

    let pois = [];
    try {
      pois = await fetchRadius(lon, lat);
    } catch (e) {
      console.warn('[OTM radius] POI fetch failed, continuing without POIs:', e.message);
    }

    let draft = null;
    try {
      draft = await callGemini(query.trim(), destName, pois, dayCount);
    } catch (e) {
      console.error('[Gemini] draft failed:', e.message);
    }

    if (!draft) {
      console.info('[Generate] Using POI-based fallback draft');
      draft = buildFallbackDraft(destName, pois, dayCount, lat, lon);
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
    return res.status(500).json({ message: err.message || 'Generation failed' });
  }
}

export async function saveItinerary(req, res) {
  try {
    const userId = req.userId || null;
    const { shareId, title, days, budgetItems, allowEditViaLink } = req.body || {};

    if (!Array.isArray(days)) {
      return res.status(400).json({ message: 'days array is required' });
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
          message: 'This trip is view-only. Sign in as the owner to make changes.',
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
    return res.status(500).json({ message: err.message || 'Save failed' });
  }
}

export async function getSharedItinerary(req, res) {
  try {
    const { shareId } = req.params;
    if (!shareId) return res.status(400).json({ message: 'shareId is required' });
    const doc = await Itinerary.findOne({ shareId }).lean();
    if (!doc) return res.status(404).json({ message: 'Itinerary not found' });
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
    return res.status(500).json({ message: err.message || 'Load failed' });
  }
}
