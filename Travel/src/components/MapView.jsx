import React, { useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pinIcon = L.divIcon({
  className: 'travello-leaflet-pin',
  html: '<span style="display:block;width:14px;height:14px;border-radius:999px;background:#22d3ee;border:2px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/**
 * @param {{ lat: number, lon: number, name?: string, key?: string }[]} markers
 * @param {{ lat: number, lon: number } | null} center — map center when no markers
 */
export default function MapView({ markers = [], center = null, className = '', minHeight = 320 }) {
  const valid = useMemo(
    () =>
      markers.filter(
        (m) => typeof m.lat === 'number' && typeof m.lon === 'number' && !Number.isNaN(m.lat + m.lon)
      ),
    [markers]
  );

  const lon = valid[0]?.lon ?? center?.lon ?? 2.3522;
  const lat = valid[0]?.lat ?? center?.lat ?? 48.8566;

  return (
    <div className={`overflow-hidden rounded-2xl border border-white/10 shadow-lg ${className}`} style={{ minHeight }}>
      <MapContainer
        center={[lat, lon]}
        zoom={valid.length ? 12 : 4}
        scrollWheelZoom
        style={{ width: '100%', height: '100%', minHeight }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {valid.map((m, i) => (
          <Marker key={m.key || `${m.lon},${m.lat},${i}`} position={[m.lat, m.lon]} icon={pinIcon}>
            <Popup>{m.name || 'Stop'}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
