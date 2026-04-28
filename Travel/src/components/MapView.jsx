import React, { useEffect, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createNumberedIcon(number, color = '#06b6d4') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24S32 26 32 16C32 7.163 24.837 0 16 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="9" fill="white" opacity="0.9"/>
      <text x="16" y="20.5" text-anchor="middle" font-size="10"
            font-weight="700" fill="${color}" font-family="system-ui,sans-serif">
        ${number}
      </text>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
}

const DAY_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

function MapController({ markers }) {
  const map = useMap();
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!markers || markers.length === 0) return;

    if (markers.length !== prevCountRef.current) {
      prevCountRef.current = markers.length;
      const latLngs = markers.map((m) => [m.lat, m.lon]);
      if (latLngs.length === 1) {
        map.flyTo(latLngs[0], 14, { duration: 1 });
      } else {
        map.flyToBounds(L.latLngBounds(latLngs), {
          padding: [40, 40],
          duration: 1,
          maxZoom: 15,
        });
      }
    }
  }, [markers, map]);

  return null;
}

export default function MapView({ markers = [], center = null, minHeight = 420, className = '' }) {
  const defaultCenter = center ? [center.lat, center.lon] : [20, 0];
  const defaultZoom = center ? 12 : 2;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 shadow-xl ${className}`}
      style={{ minHeight, position: 'relative' }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom
        style={{ height: '100%', minHeight }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController markers={markers} />

        {markers.map((marker, i) => {
          const dayColor = DAY_COLORS[(marker.dayIndex ?? 0) % DAY_COLORS.length];
          return (
            <Marker
              key={marker.key ?? i}
              position={[marker.lat, marker.lon]}
              icon={createNumberedIcon(i + 1, dayColor)}
            >
              <Popup>
                <div className="min-w-[140px]">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
                    Stop {i + 1}
                    {marker.dayIndex !== undefined && ` - Day ${marker.dayIndex + 1}`}
                  </p>
                  <p className="mt-0.5 font-medium text-white">{marker.name}</p>
                  {marker.time && <p className="text-[11px] text-slate-400">{marker.time}</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {markers.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="text-3xl opacity-30">Map</div>
          <p className="text-xs text-cyan-100/40">Markers will appear here as you add places</p>
        </div>
      )}
    </div>
  );
}
