import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck, MapPin } from 'lucide-react';

// Custom SVG DivIcons
const createCustomIcon = (color) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="#ffffff"/>
    </svg>
  `;
  return L.divIcon({
    className: 'custom-map-icon',
    html: svg,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -38]
  });
};

const iconStart = createCustomIcon('#3f7a4e');   // Terrain green, the start control
const iconPickup = createCustomIcon('#2563eb');  // Blue
const iconDropoff = createCustomIcon('#f43f5e'); // Rose
const iconRest = createCustomIcon('#8b5cf6');    // Purple
const iconFuel = createCustomIcon('#f59e0b');    // Amber

function RecenterMap({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

export default function RouteMap({ waypoints, stops, geometry }) {
  if (!waypoints || !geometry || geometry.length === 0) {
    return (
      <div className="saas-card" style={{ height: '530px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <MapPin size={36} color="var(--border-strong)" style={{ marginBottom: '12px' }} />
        <div style={{ fontWeight: 600 }}>Interactive Map View</div>
        <div style={{ fontSize: '0.8rem' }}>Enter route details on the left to visualize waypoints, path & rest stops.</div>
      </div>
    );
  }

  const polylineCoords = geometry;
  const curr = waypoints.current;
  const pickup = waypoints.pickup;
  const dropoff = waypoints.dropoff;

  const bounds = polylineCoords.length > 0 ? polylineCoords : [[curr.lat, curr.lng], [dropoff.lat, dropoff.lng]];

  return (
    <div className="saas-card" style={{ overflow: 'hidden' }}>
      <div className="saas-card-header">
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Truck size={17} color="var(--primary)" /> Interstate Route & En Route Stops
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
          <span style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-emerald)' }} /> Start
          </span>
          <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} /> Pickup
          </span>
          <span style={{ color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f43f5e' }} /> Dropoff
          </span>
          <span style={{ color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} /> 10-Hr Rest
          </span>
          <span style={{ color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> Fuel
          </span>
        </div>
      </div>

      <div style={{ height: '470px', position: 'relative' }}>
        <MapContainer center={[curr.lat, curr.lng]} zoom={5} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Polyline positions={polylineCoords} color="#2563eb" weight={4.5} opacity={0.9} />
          
          {/* Start Marker */}
          <Marker position={[curr.lat, curr.lng]} icon={iconStart}>
            <Popup>
              <strong>Start Position:</strong><br />{curr.display_name}
            </Popup>
          </Marker>

          {/* Pickup Marker */}
          <Marker position={[pickup.lat, pickup.lng]} icon={iconPickup}>
            <Popup>
              <strong>Pickup Facility:</strong><br />{pickup.display_name}<br />
              <small>1 hr On-Duty Cargo Loading Scheduled</small>
            </Popup>
          </Marker>

          {/* Dropoff Marker */}
          <Marker position={[dropoff.lat, dropoff.lng]} icon={iconDropoff}>
            <Popup>
              <strong>Final Dropoff:</strong><br />{dropoff.display_name}<br />
              <small>1 hr On-Duty Cargo Unloading Scheduled</small>
            </Popup>
          </Marker>

          {/* Intermediate Stops */}
          {stops && stops.map((stop, idx) => {
            if (stop.type === 'pickup' || stop.type === 'dropoff') return null;
            const icon = stop.type === 'fuel' ? iconFuel : iconRest;
            const pos = polylineCoords[Math.min(polylineCoords.length - 1, Math.floor((idx + 1) * (polylineCoords.length / (stops.length + 1))))] || [pickup.lat, pickup.lng];
            
            return (
              <Marker key={idx} position={pos} icon={icon}>
                <Popup>
                  <strong>{stop.type === 'fuel' ? 'Mandatory Fuel Stop' : '10-Hour Shift Rest'}</strong><br />
                  {stop.location_name}<br />
                  <small>Duration: {stop.duration_hours} hrs</small>
                </Popup>
              </Marker>
            );
          })}

          <RecenterMap bounds={bounds} />
        </MapContainer>
      </div>
    </div>
  );
}
