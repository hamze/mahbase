import React from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const IRAN_CENTER = [32.4279, 53.688];

const pinIcon = L.divIcon({
  html: '<div style="font-size:30px;line-height:30px">📍</div>',
  className: '',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function ClickCapture({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Optional delivery pin; ``value`` is ``{lat, lng}`` or null. Clicking the map or dragging the pin moves it. */
export default function LocationPicker({ value, onChange }) {
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : IRAN_CENTER}
      zoom={value ? 15 : 5}
      scrollWheelZoom
      className="z-0 h-64 w-full rounded-xl border border-border"
      dir="ltr"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      <ClickCapture onPick={onChange} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const point = e.target.getLatLng();
              onChange({ lat: point.lat, lng: point.lng });
            },
          }}
        />
      )}
    </MapContainer>
  );
}
