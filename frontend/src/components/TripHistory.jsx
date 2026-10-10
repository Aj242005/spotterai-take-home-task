import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { History, ArrowRight, Search, FileText } from 'lucide-react';

export default function TripHistory({ onLoadTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.get('/trips/history/')
      .then((res) => setTrips(res.data))
      .catch((err) => console.error('Trip history fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <span className="animate-spin" />
        <div style={{ marginTop: '8px', fontWeight: 600 }}>Loading dispatch audit archive...</div>
      </div>
    );
  }

  const filteredTrips = trips.filter(t => 
    t.pickup_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.dropoff_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="saas-card">
      <div className="saas-card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={17} color="var(--primary)" /> Trip Dispatch History & Regulatory Audit Archive
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            All calculated trips, HOS timetables and generated Form MCS-59 logs
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px', fontSize: '0.8rem', padding: '7px 12px 7px 32px' }}
            placeholder="Search by city, facility, driver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="saas-card-body" style={{ padding: 0 }}>
        {filteredTrips.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={36} color="var(--border-strong)" style={{ marginBottom: '10px' }} />
            <div style={{ fontWeight: 600 }}>No matching trips found</div>
            <div style={{ fontSize: '0.8rem' }}>Calculate new trips in the Dispatch Console to save them here.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="saas-table">
              <thead>
                <tr>
                  <th>TRIP ID</th>
                  <th>ORIGIN FACILITY → DESTINATION</th>
                  <th>DISTANCE</th>
                  <th>DURATION</th>
                  <th>DRIVER & CARRIER</th>
                  <th>RECORDED</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map((trip) => (
                  <tr key={trip.id}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                      #{trip.id}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        {trip.pickup_location} <ArrowRight size={12} color="var(--primary)" /> {trip.dropoff_location}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{trip.total_distance_miles} mi</td>
                    <td>
                      <span className="status-pill pill-purple">
                        {trip.num_days} {trip.num_days === 1 ? 'Day' : 'Days'} ({trip.total_driving_hours}h drive)
                      </span>
                    </td>
                    <td>
                      <div><strong>{trip.driver_name}</strong></div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{trip.carrier_name}</div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(trip.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onLoadTrip(trip.id)}
                      >
                        Load Full Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
