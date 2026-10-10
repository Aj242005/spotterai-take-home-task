import React, { useState } from 'react';
import { MapPin, Navigation, Truck, Settings, Sparkles, Compass, ShieldAlert } from 'lucide-react';

const ROUTE_PRESETS = [
  { label: 'Short-Haul (TX)', curr: 'Dallas, TX', pickup: 'Dallas, TX', drop: 'Houston, TX', cycle: 10.0 },
  { label: 'Regional (IL → GA)', curr: 'Chicago, IL', pickup: 'Chicago, IL', drop: 'Atlanta, GA', cycle: 20.0 },
  { label: 'Long-Haul (TX → FL)', curr: 'Dallas, TX', pickup: 'Houston, TX', drop: 'Miami, FL', cycle: 15.0 },
  { label: 'Transcontinental (NY → LA)', curr: 'New York, NY', pickup: 'New York, NY', drop: 'Los Angeles, CA', cycle: 5.0 },
];

export default function TripForm({ onSubmit, loading }) {
  const [currentLocation, setCurrentLocation] = useState('Dallas, TX');
  const [pickupLocation, setPickupLocation] = useState('Houston, TX');
  const [dropoffLocation, setDropoffLocation] = useState('Atlanta, GA');
  const [cycleHours, setCycleHours] = useState(15.0);

  // Advanced Carrier Customization
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [driverName, setDriverName] = useState('John Driver');
  const [carrierName, setCarrierName] = useState('Spotter Transport LLC');
  const [mainOffice, setMainOffice] = useState('100 Logistics Way, Chicago, IL');
  const [homeTerminal, setHomeTerminal] = useState('500 Transport Blvd, Dallas, TX');
  const [truckNumber, setTruckNumber] = useState('TRK-8801');
  const [trailerNumber, setTrailerNumber] = useState('TRL-9942');
  const [detectedTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    } catch {
      return 'America/New_York';
    }
  });

  const handleApplyPreset = (preset) => {
    setCurrentLocation(preset.curr);
    setPickupLocation(preset.pickup);
    setDropoffLocation(preset.drop);
    setCycleHours(preset.cycle);
  };

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(4);
          const lng = position.coords.longitude.toFixed(4);
          setCurrentLocation(`${lat}, ${lng}`);
        },
        () => alert('Unable to access device location. Please specify city/state manually.')
      );
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      current_location: currentLocation,
      pickup_location: pickupLocation,
      dropoff_location: dropoffLocation,
      current_cycle_hours: parseFloat(cycleHours),
      driver_name: driverName,
      carrier_name: carrierName,
      main_office_address: mainOffice,
      home_terminal_address: homeTerminal,
      truck_number: truckNumber,
      trailer_number: trailerNumber,
      timezone_str: detectedTimezone
    });
  };

  const hoursRemaining = Math.max(0, 70.0 - cycleHours);
  const isHighCycle = cycleHours >= 60.0;

  return (
    <div className="saas-card">
      <div className="saas-card-header">
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={18} color="var(--primary)" /> Dispatch Route & HOS Console
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Configure origin, terminal facilities, and duty cycle under FMCSA § 395
          </p>
        </div>
        <span className="status-pill pill-blue" style={{ fontSize: '0.7rem' }}>
          {detectedTimezone}
        </span>
      </div>

      <div className="saas-card-body">
        {/* Quick Route Presets */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
            Quick Route Scenarios:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ROUTE_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className="preset-pill"
                onClick={() => handleApplyPreset(p)}
              >
                <Sparkles size={11} color="var(--primary)" /> {p.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Current Location */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label" style={{ margin: 0 }}>Current Location</label>
              <button
                type="button"
                onClick={handleUseMyLocation}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Navigation size={11} /> Auto-Detect
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <MapPin size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--primary)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
                placeholder="e.g. Dallas, TX or Lat, Lng"
                required
              />
            </div>
          </div>

          {/* Pickup Terminal */}
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Pickup Terminal / Facility</label>
            <div style={{ position: 'relative' }}>
              <MapPin size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--accent-emerald)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="e.g. Houston, TX"
                required
              />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              * Automatically allocates 1 hr On-Duty Not Driving for cargo loading
            </div>
          </div>

          {/* Dropoff Facility */}
          <div style={{ marginBottom: '18px' }}>
            <label className="form-label">Dropoff Facility / Receiver</label>
            <div style={{ position: 'relative' }}>
              <MapPin size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#f43f5e' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.target.value)}
                placeholder="e.g. Atlanta, GA"
                required
              />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              * Automatically allocates 1 hr On-Duty Not Driving for cargo unloading
            </div>
          </div>

          {/* 70-Hr / 8-Day Cycle Gauge */}
          <div style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                70-HR / 8-DAY CYCLE ACCUMULATION
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '0.9rem',
                color: isHighCycle ? 'var(--accent-rose)' : 'var(--primary)'
              }}>
                {cycleHours.toFixed(1)} / 70.0 hrs
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="70"
              step="0.5"
              value={cycleHours}
              onChange={(e) => setCycleHours(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: isHighCycle ? '#f43f5e' : '#2563eb', cursor: 'pointer' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span>Available Duty: <strong>{hoursRemaining.toFixed(1)} hrs</strong></span>
              {isHighCycle && (
                <span style={{ color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldAlert size={12} /> Near 70-hr limit (34h restart required)
                </span>
              )}
            </div>
          </div>

          {/* Collapsible Carrier Info Toggle */}
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ width: '100%', justifyContent: 'space-between' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Settings size={13} /> Carrier, Truck & Driver Settings
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {showAdvanced ? 'Collapse ▲' : 'Expand ▼'}
              </span>
            </button>
          </div>

          {showAdvanced && (
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label className="form-label">Driver Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Carrier Company</label>
                  <input
                    type="text"
                    className="form-input"
                    value={carrierName}
                    onChange={(e) => setCarrierName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label className="form-label">Truck / Tractor #</label>
                  <input
                    type="text"
                    className="form-input"
                    value={truckNumber}
                    onChange={(e) => setTruckNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Trailer #</label>
                  <input
                    type="text"
                    className="form-input"
                    value={trailerNumber}
                    onChange={(e) => setTrailerNumber(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label className="form-label">Main Office Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={mainOffice}
                  onChange={(e) => setMainOffice(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Home Terminal Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={homeTerminal}
                  onChange={(e) => setHomeTerminal(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Primary CTA */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
          >
            {loading ? (
              <>
                <span className="animate-spin" /> Calculating Schedule & Drawing Logs...
              </>
            ) : (
              <>
                <Truck size={17} /> Calculate Route & Generate Daily Logs
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
