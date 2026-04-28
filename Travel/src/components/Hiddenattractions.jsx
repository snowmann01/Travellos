import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { server } from '../Config/api';

const INDIA_CENTER = [20.5937, 78.9629];
const INDIA_ZOOM = 5;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MapAutoFit = ({ markers }) => {
  const map = useMap();

  useEffect(() => {
    if (!markers.length) {
      map.setView(INDIA_CENTER, INDIA_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(markers.map((marker) => [marker.latitude, marker.longitude]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
  }, [map, markers]);

  return null;
};

const HiddenAttractions = () => {
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const loadHiddenAttractions = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${server}/hidden-attractions`, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }

        const data = await response.json();
        setAttractions(Array.isArray(data) ? data : []);
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setError('Failed to load hidden attractions. Please try again.');
          setAttractions([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadHiddenAttractions();

    return () => controller.abort();
  }, []);

  const markers = useMemo(() => {
    return attractions
      .map((item) => {
        const coords = item?.location?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) {
          return null;
        }

        const [longitude, latitude] = coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        return {
          ...item,
          latitude,
          longitude,
        };
      })
      .filter(Boolean);
  }, [attractions]);

  return (
    <div className="relative h-screen">
      <MapContainer
        center={INDIA_CENTER}
        zoom={INDIA_ZOOM}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapAutoFit markers={markers} />

        {markers.map((item) => (
          <Marker key={item._id} position={[item.latitude, item.longitude]}>
            <Popup>
              <div className="w-56">
                <img
                  src={item.imageUrl}
                  alt={item.challengeId || 'Hidden attraction'}
                  className="w-full h-32 object-cover rounded-md mb-2"
                />
                <p className="text-sm text-gray-700 mb-1">{item.description}</p>
                <p className="text-xs text-gray-500 mb-1">By: {item.user?.username || 'Anonymous'}</p>
                {item.challengeId ? (
                  <p className="text-xs font-medium text-teal-700">Challenge: {item.challengeId}</p>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute top-4 left-4 right-4 bg-white bg-opacity-90 rounded-lg shadow-lg p-4 pointer-events-none">
        <h2 className="text-2xl font-bold text-teal-800 text-center">Hidden Attractions</h2>
        {loading ? (
          <div className="mt-2 flex items-center justify-center">
            <div className="h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : null}
        {!loading && error ? (
          <p className="mt-2 text-center text-red-600 text-sm">{error}</p>
        ) : null}
        {!loading && !error && markers.length === 0 ? (
          <p className="mt-2 text-center text-gray-600 text-sm">
            No hidden attractions yet. Complete a challenge to add one.
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default HiddenAttractions;

