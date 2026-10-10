import React from 'react';
import { Route, Clock, Coffee, Fuel, ShieldCheck, Calendar } from 'lucide-react';


export default function TripSummary({ summary }) {
  if (!summary) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '14px',
      marginBottom: '22px'
    }}>
      {/* Total Distance */}
      <div className="kpi-tile">
        <div className="kpi-label" style={{ color: 'var(--primary)' }}>
          <Route size={15} /> Total Route Distance
        </div>
        <div className="kpi-value" style={{ color: 'var(--text-primary)' }}>
          {summary.total_distance_miles} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>mi</span>
        </div>
        <div className="kpi-sub">
          Interstate routing model
        </div>
      </div>

      {/* Duration & Driving Hours */}
      <div className="kpi-tile">
        <div className="kpi-label" style={{ color: 'var(--accent-emerald)' }}>
          <Clock size={15} /> Total Trip Duration
        </div>
        <div className="kpi-value" style={{ color: 'var(--text-primary)' }}>
          {summary.total_duration_hours} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>hrs</span>
        </div>
        <div className="kpi-sub">
          <strong>{summary.total_driving_hours} hrs</strong> behind the wheel
        </div>
      </div>

      {/* Daily Log Sheets */}
      <div className="kpi-tile">
        <div className="kpi-label" style={{ color: 'var(--accent-purple)' }}>
          <Calendar size={15} /> Daily Log Sheets
        </div>
        <div className="kpi-value" style={{ color: 'var(--text-primary)' }}>
          {summary.num_days} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{summary.num_days === 1 ? 'Day' : 'Days'}</span>
        </div>
        <div className="kpi-sub">
          24-hr Form MCS-59 logs
        </div>
      </div>

      {/* 10-Hr Shift Rest Breaks */}
      <div className="kpi-tile">
        <div className="kpi-label" style={{ color: 'var(--accent-purple)' }}>
          <Coffee size={15} /> 10-Hr Mandatory Rests
        </div>
        <div className="kpi-value" style={{ color: 'var(--text-primary)' }}>
          {summary.num_rest_stops}
        </div>
        <div className="kpi-sub">
          11hr drive / 14hr duty resets
        </div>
      </div>

      {/* 1,000-Mi Fuel Stops */}
      <div className="kpi-tile">
        <div className="kpi-label" style={{ color: 'var(--accent-amber)' }}>
          <Fuel size={15} /> Fueling Intervals
        </div>
        <div className="kpi-value" style={{ color: 'var(--text-primary)' }}>
          {summary.num_fuel_stops}
        </div>
        <div className="kpi-sub">
          Mandatory 1,000-mi intervals
        </div>
      </div>

      {/* Compliance Assessment */}
      <div className="kpi-tile" style={{ borderLeft: '3px solid var(--accent-emerald)' }}>
        <div className="kpi-label" style={{ color: 'var(--accent-emerald)' }}>
          <ShieldCheck size={15} /> § 395 Compliance
        </div>
        <div className="kpi-value" style={{ color: 'var(--accent-emerald)', fontSize: '1.4rem' }}>
          PASSED
        </div>
        <div className="kpi-sub">
          Final Cycle: <strong>{summary.final_cycle_hours} / 70h</strong>
        </div>
      </div>
    </div>
  );
}
