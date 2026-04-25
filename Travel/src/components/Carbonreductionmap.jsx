// src/components/CarbonReductionMap.jsx

import React, { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const CarbonReductionMap = () => {
  const [mapData, setMapData] = useState([]);
  const [popupInfo, setPopupInfo] = useState(null);
  const pinIcon = L.divIcon({
    className: 'carbon-dot',
    html: '<span style="display:block;width:16px;height:16px;border-radius:999px;background:#16a34a;border:2px solid #ffffff"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  useEffect(() => {
    const mockData = [
      {
        name: 'Community Garden',
        description: 'A local garden promoting biodiversity and local food production.',
        longitude: -97.7431,
        latitude: 30.2672,
      },
      {
        name: 'Solar Energy Center',
        description: 'Learn about solar energy and how to implement it in your home.',
        longitude: -95.3698,
        latitude: 29.7604,
      },
      {
        name: 'Recycling Center',
        description: 'Drop off your recyclables and learn about recycling processes.',
        longitude: -122.4194,
        latitude: 37.7749,
      },
      {
        name: 'Bike Sharing Station',
        description: 'Rent bikes to reduce carbon footprint and promote healthy transport.',
        longitude: -77.0369,
        latitude: 38.9072,
      },
      {
        name: 'Environmental Workshop',
        description: 'Participate in workshops about sustainable living.',
        longitude: -118.2437,
        latitude: 34.0522,
      },
    ];

    setMapData(mockData);
  }, []);

  return (
    <div className="h-screen">
      <MapContainer
        center={[39.833333, -98.583333]}
        zoom={4}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mapData.map((resource, index) => (
          <Marker
            key={index}
            position={[resource.latitude, resource.longitude]}
            icon={pinIcon}
          >
            <div
              className="marker"
              style={{
                backgroundColor: 'green',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                cursor: 'pointer',
              }}
              onClick={() => setPopupInfo(resource)}
            ></div>
          </Marker>
        ))}

        {popupInfo && (
          <Popup
            position={[popupInfo.latitude, popupInfo.longitude]}
            closeButton={true}
            closeOnClick={false}
            onClose={() => setPopupInfo(null)}
          >
            <div>
              <h3 className="font-bold">{popupInfo.name}</h3>
              <p>{popupInfo.description}</p>
            </div>
          </Popup>
        )}
      </MapContainer>
    </div>
  );
};

export default CarbonReductionMap;