import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import api from '../services/api';
import { drawELDLogSheet } from '../utils/eldCanvas';
import { ISOM, drawCourseSheet, hasWebGL, paperGrainDataUrl } from './mapSheet';
import { DUTY_ORDER } from './dutyMeta';
import { buildSpecs } from './hosSpecs';
import { SAMPLE_LABEL, SAMPLE_TRIP } from './sampleTrip';
import './instrument.css';

const CourseRelief = lazy(() => import('./CourseRelief'));

const PRESETS = [
  { label: 'Regional · IL → GA', origin: 'Chicago, IL', pickup: 'Chicago, IL', dropoff: 'Atlanta, GA', cycle: 20 },
  { label: 'Coast to coast · NY → LA', origin: 'New York, NY', pickup: 'New York, NY', dropoff: 'Los Angeles, CA', cycle: 5 },
  { label: 'Gulf run · TX → FL', origin: 'Dallas, TX', pickup: 'Houston, TX', dropoff: 'Miami, FL', cycle: 15 },
];

const CONTROL_MEANING = {
  pickup: 'Cargo loading — pickup facility',
  rest: 'Mandatory shift reset — rest plaza',
  fuel: 'Fueling — 1,000-mile interval',
  dropoff: 'Cargo unloading — receiver facility',
};

const CONTROL_CODE = { pickup: 'P', rest: 'R', fuel: 'F', dropoff: 'D' };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => {};
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (event) => setReduced(event.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/** The printed symbols of the world, drawn as the map draws them. */
function SymbolMark({ kind }) {
  const frame = (
    <rect x="0.7" y="0.7" width="28.6" height="20.6" fill={ISOM.paper} stroke={ISOM.ink} strokeWidth="1.4" />
  );

  if (kind === 'driving') {
    return (
      <svg viewBox="0 0 30 22" className="symbol-mark" role="img" aria-label="Driving">
        {frame}
        <line x1="2.5" y1="11" x2="27.5" y2="11" stroke={ISOM.course} strokeWidth="5" strokeLinecap="butt" />
      </svg>
    );
  }
  if (kind === 'on_duty_not_driving') {
    return (
      <svg viewBox="0 0 30 22" className="symbol-mark" role="img" aria-label="On duty, not driving">
        {frame}
        <rect x="4" y="5" width="22" height="12" fill={ISOM.open} stroke={ISOM.contourDeep} strokeWidth="1.2" />
      </svg>
    );
  }
  if (kind === 'sleeper_berth') {
    return (
      <svg viewBox="0 0 30 22" className="symbol-mark" role="img" aria-label="Sleeper berth">
        {frame}
        <path d="M4 15 L12 7 L20 15 Z" fill={ISOM.marsh} stroke={ISOM.marshEdge} strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 30 22" className="symbol-mark" role="img" aria-label="Off duty">
      {frame}
      <circle cx="15" cy="11" r="4.6" fill={ISOM.paper} stroke={ISOM.ink} strokeWidth="1.4" />
    </svg>
  );
}

/** The sheet as a flat plate for machines with no WebGL context to give. */
function FlatSheet({ trip }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) drawCourseSheet(ref.current, { trip, progress: 1 });
  }, [trip]);
  return <canvas ref={ref} width={1600} height={1000} className="board-flat" />;
}

function SheetFrame({ log }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && log?.canvas_data) drawELDLogSheet(ref.current, log.canvas_data);
  }, [log]);

  if (!log?.canvas_data) return null;

  const exportPng = () => {
    if (!ref.current) return;
    const link = document.createElement('a');
    link.download = `ELD_Log_Day_${log.day_number}.png`;
    link.href = ref.current.toDataURL('image/png');
    link.click();
  };

  const print = () => {
    if (!ref.current) return;
    const popup = window.open('', '', 'width=1150,height=820');
    if (!popup) return;
    popup.document.write(
      `<html><head><title>Driver's Daily Log — ${log.date_str}</title></head>` +
        `<body style="margin:0" onload="window.print();window.close()">` +
        `<img src="${ref.current.toDataURL('image/png')}" style="width:100%" /></body></html>`,
    );
    popup.document.close();
  };

  return (
    <>
      <canvas ref={ref} width={1100} height={760} />
      <div className="sheet-actions">
        <button type="button" className="key key-bare" onClick={exportPng}>
          Export PNG
        </button>
        <button type="button" className="key key-bare" onClick={print}>
          Print the sheet
        </button>
      </div>
    </>
  );
}

export default function Landing({ onEnterConsole, onOpenAuth, onTripCalculated }) {
  const [origin, setOrigin] = useState('Dallas, TX');
  const [pickup, setPickup] = useState('Memphis, TN');
  const [dropoff, setDropoff] = useState('Knoxville, TN');
  const [cycle, setCycle] = useState(33);

  const [trip, setTrip] = useState(SAMPLE_TRIP);
  const [activeDay, setActiveDay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inkState, setInkState] = useState(true);

  const reducedMotion = usePrefersReducedMotion();
  // The context either exists on first paint or it never will; probing in an
  // effect would render an empty board first and a canvas a frame later.
  const [webgl] = useState(() => hasWebGL());
  const running = inkState && !reducedMotion;

  const grain = useMemo(() => paperGrainDataUrl(320), []);

  const days = trip?.daily_logs || [];
  const day = days.find((entry) => entry.day_number === activeDay) || days[0];
  const specs = useMemo(() => buildSpecs(trip), [trip]);
  const isSample = Boolean(trip?.sample);

  const controls = useMemo(() => {
    const stops = (trip?.stops || []).filter((stop) => CONTROL_CODE[stop.type]);
    return stops.map((stop, index) => {
      const previous = index === 0 ? 0 : Number(stops[index - 1].cumulative_miles) || 0;
      return {
        key: `${stop.type}-${index}`,
        number: index + 1,
        code: CONTROL_CODE[stop.type],
        type: stop.type,
        name: stop.location_name,
        meaning: CONTROL_MEANING[stop.type],
        leg: Math.round(((Number(stop.cumulative_miles) || 0) - previous) * 10) / 10,
        dwell: stop.duration_hours,
      };
    });
  }, [trip]);

  const totalControlsMiles = controls.reduce((sum, control) => sum + control.leg, 0);

  const handleCalculate = useCallback(
    async (event) => {
      event.preventDefault();
      setLoading(true);
      setError('');
      try {
        const res = await api.post('/trips/calculate/', {
          current_location: origin,
          pickup_location: pickup,
          dropoff_location: dropoff,
          current_cycle_hours: Math.min(70, Math.max(0, Number(cycle) || 0)),
        });
        setTrip(res.data);
        setActiveDay(res.data?.daily_logs?.[0]?.day_number ?? 1);
        setInkState(true);
        // The console reuses this calculation instead of recomputing (and writing
        // a duplicate Trip row) when it is opened.
        onTripCalculated?.(res.data);
      } catch (err) {
        if (err.response?.status === 429) {
          setError('The planner is rate limited right now. Wait a moment and plot the course again.');
        } else {
          setError(
            err.response?.data?.error ||
              err.response?.data?.detail ||
              'No schedule came back. Check that both endpoints are real places.',
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [origin, pickup, dropoff, cycle, onTripCalculated],
  );

  const stepCycle = (delta) => {
    setCycle((current) =>
      Math.min(70, Math.max(0, Math.round((Number(current) + delta) * 2) / 2)),
    );
  };

  return (
    <div className="instrument" style={{ '--grain': `url(${grain})` }}>
      <div className="instrument-frame">
        <header className="instrument-head">
          <div className="plate-mark">
            <span className="plate-mark-name">Spotter AI</span>
            <span className="plate-mark-meta">HOS course planner · 49 CFR § 395</span>
          </div>

          <nav className="instrument-nav" aria-label="Sections">
            <a className="nav-key" href="#course">
              The course
            </a>
            <a className="nav-key" href="#controls">
              Control sheet
            </a>
            <a className="nav-key" href="#limits">
              § 395 limits
            </a>
            <button type="button" className="nav-key" onClick={onOpenAuth}>
              Driver sign-in
            </button>
            <button type="button" className="nav-key" onClick={onEnterConsole}>
              Dispatch console
            </button>
          </nav>

          <span className="lamp">
            <span className={`lamp-dot${loading ? '' : ' is-dim'}`} aria-hidden="true" />
            <span className="lamp-text">{loading ? 'Running the course' : 'Engine ready'}</span>
          </span>
        </header>

        <main id="top">
        <div className="headline">
          <div>
            <h1 className="plate-title">Plan the course. See the sheet it produces.</h1>
            <p className="plate-sub">
              Three places and the hours already on the driver&apos;s cycle are all the planner
              needs. The trip is simulated in sequence under § 395 — rest, break, fuel and cycle
              limits applied in the order they actually bind — then printed as one course over the
              map and returned as the 24-hour log sheet for every day it would take.
            </p>
          </div>

          <div className="scale-strip">
            <div className="scale-item">
              <span className="legend legend-quiet">Course</span>
              <span className="measure">{trip?.summary?.total_distance_miles ?? 0} mi</span>
            </div>
            <div className="scale-item">
              <span className="legend legend-quiet">Controls</span>
              <span className="measure">{controls.length}</span>
            </div>
            <div className="scale-item">
              <span className="legend legend-quiet">Sheets</span>
              <span className="measure">{trip?.summary?.num_days ?? 0}</span>
            </div>
            <div className="scale-item">
              <span className="legend legend-quiet">Cycle after</span>
              <span className="measure">{trip?.summary?.final_cycle_hours ?? 0} / 70</span>
            </div>
          </div>
        </div>

        <section className="viewport" id="course">
          {/* The route plate: the offer in its working form. */}
          <form className="field-panel" onSubmit={handleCalculate}>
            <div className="field-head">
              <span className="legend">Plot a course</span>
              <span className="legend legend-quiet">
                {isSample ? 'Sample loaded' : `Trip #${trip.trip_id}`}
              </span>
            </div>

            {[
              { label: 'Origin', value: origin, set: setOrigin, placeholder: 'Dallas, TX' },
              { label: 'Pickup', value: pickup, set: setPickup, placeholder: 'Memphis, TN' },
              { label: 'Destination', value: dropoff, set: setDropoff, placeholder: 'Knoxville, TN' },
            ].map((field, index) => (
              <div className="field" key={field.label}>
                <label className="field-label" htmlFor={`field-${field.label}`}>
                  <span className="field-index measure">{String(index + 1).padStart(2, '0')}</span>
                  <span className="legend">{field.label}</span>
                </label>
                <div className="input-well">
                  <input
                    id={`field-${field.label}`}
                    className="field-input"
                    value={field.value}
                    placeholder={field.placeholder}
                    onChange={(event) => field.set(event.target.value)}
                    autoComplete="off"
                    required
                  />
                </div>
              </div>
            ))}

            <div className="field">
              <span className="legend" style={{ display: 'block', marginBottom: 6 }}>
                Cycle hours already used
              </span>
              <div className="winder">
                <button
                  type="button"
                  className="winder-key"
                  onClick={() => stepCycle(-0.5)}
                  aria-label="Decrease cycle hours by half an hour"
                >
                  −
                </button>
                <div className="input-well" style={{ border: '1px solid var(--rule)' }}>
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    max="70"
                    step="0.5"
                    value={cycle}
                    onChange={(event) => setCycle(event.target.value)}
                    aria-label="Cycle hours already used in the 70-hour window"
                  />
                </div>
                <button
                  type="button"
                  className="winder-key"
                  onClick={() => stepCycle(0.5)}
                  aria-label="Increase cycle hours by half an hour"
                >
                  +
                </button>
              </div>
              <p className="legend legend-quiet" style={{ marginTop: 8 }}>
                {Math.max(0, 70 - (Number(cycle) || 0)).toFixed(1)} hr left in the cycle
              </p>
            </div>

            <button type="submit" className="key" disabled={loading}>
              {loading ? 'Running the course…' : 'Plot the course'}
            </button>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="legend"
                  style={{
                    background: 'none',
                    border: '1px solid var(--rule-soft)',
                    padding: '5px 9px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setOrigin(preset.origin);
                    setPickup(preset.pickup);
                    setDropoff(preset.dropoff);
                    setCycle(preset.cycle);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>

          {/* The relief board: the printed sheet with the course raised above it. */}
          <div>
            <div className="board-well">
              <div className="board-stage">
                {webgl && !reducedMotion ? (
                  <Suspense fallback={<FlatSheet trip={trip} />}>
                    <CourseRelief
                      trip={trip}
                      running={running}
                      onInked={() => setInkState(false)}
                    />
                  </Suspense>
                ) : (
                  <FlatSheet trip={trip} />
                )}
              </div>

              <div className="board-caption">
                <span className="board-caption-note">
                  {isSample
                    ? SAMPLE_LABEL
                    : `Trip #${trip.trip_id} · ${trip?.meta?.current_location} → ${trip?.meta?.dropoff_location}`}
                </span>
                <div className="day-tabs">
                  {days.map((entry) => (
                    <button
                      key={entry.day_number}
                      type="button"
                      className="day-tab"
                      aria-pressed={entry.day_number === activeDay}
                      onClick={() => setActiveDay(entry.day_number)}
                    >
                      Sheet {entry.day_number}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p
              className="legend legend-quiet"
              style={{ marginTop: 10, letterSpacing: '0.1em', textTransform: 'none' }}
            >
              Terrain is illustrative. The purple course, its controls and the mileage scale are
              your calculation.
            </p>
          </div>

          <div className="viewport-readouts readouts">
            <div className="field-panel field-open">
              <div className="field-head">
                <span className="legend">Course statistics</span>
                <span className="legend legend-quiet">{day ? `Sheet ${day.day_number}` : '—'}</span>
              </div>
              <div className="readout-row">
                <span className="legend legend-quiet">Days on the road</span>
                <span className="readout-value">
                  {trip?.summary?.num_days ?? 0}
                  <small>sheets</small>
                </span>
              </div>
              <div className="readout-row">
                <span className="legend legend-quiet">Hours driving</span>
                <span className="readout-value">
                  {trip?.summary?.total_driving_hours ?? 0}
                  <small>hr</small>
                </span>
              </div>
              <div className="readout-row">
                <span className="legend legend-quiet">Shift resets</span>
                <span className="readout-value">{trip?.summary?.num_rest_stops ?? 0}</span>
              </div>
              <div className="readout-row">
                <span className="legend legend-quiet">Fuel stops</span>
                <span className="readout-value">{trip?.summary?.num_fuel_stops ?? 0}</span>
              </div>
              <div className="readout-row">
                <span className="legend legend-quiet">Cycle after trip</span>
                <span className="readout-value is-course">
                  {trip?.summary?.final_cycle_hours ?? 0}
                  <small>/ 70 hr</small>
                </span>
              </div>
            </div>

            <div className="field-panel field-olive">
              <div className="field-head">
                <span className="legend">Symbol table</span>
                <span className="legend legend-quiet">{day?.date_str || '—'}</span>
              </div>
              <div className="symbol-table">
                {DUTY_ORDER.map((entry) => (
                  <div className="symbol-row" key={entry.key}>
                    <SymbolMark kind={entry.key} />
                    <span>
                      <span className="symbol-name">{entry.label}</span>
                      <br />
                      <span className="symbol-meaning">{entry.legend}</span>
                    </span>
                    <span className="symbol-hours">
                      {(day?.totals?.[entry.key] ?? 0).toFixed(2)} h
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Control description sheet + duty strip: the dense passage. */}
        <section className="sheet-section" id="controls">
          <div className="section-head">
            <div>
              <span className="legend">Control description sheet</span>
              <h2 className="section-title">Every stop the course depends on</h2>
            </div>
            <p className="section-note">
              Controls are placed at the mile they actually occur at, on the routed line — not at
              the pickup and dropoff of the trip. {controls.length} control
              {controls.length === 1 ? '' : 's'} over {Math.round(totalControlsMiles)} miles.
            </p>
          </div>

          <div className="data-table" role="table" aria-label="Course controls">
            <div className="data-row data-head cols-control" role="row">
              <span className="legend" role="columnheader">
                No.
              </span>
              <span className="legend" role="columnheader">
                Symbol
              </span>
              <span className="legend" role="columnheader">
                Description
              </span>
              <span className="legend" role="columnheader" style={{ textAlign: 'right' }}>
                Leg
              </span>
              <span className="legend" role="columnheader" style={{ textAlign: 'right' }}>
                Dwell
              </span>
            </div>

            {controls.length ? (
              controls.map((control) => (
                <div className="data-row cols-control" role="row" key={control.key}>
                  <span className="cell-code" role="cell">
                    {String(control.number).padStart(2, '0')}
                  </span>
                  <span className="cell-symbol" role="cell">
                    <SymbolMark kind={control.type === 'rest' ? 'sleeper_berth' : control.type === 'fuel' ? 'on_duty_not_driving' : 'off_duty'} />
                  </span>
                  <span className="cell-strong cell-break" role="cell">
                    {control.meaning}
                    <br />
                    <span className="cell-quiet">{control.name}</span>
                  </span>
                  <span className="cell-num" role="cell">
                    {control.leg.toFixed(1)} mi
                  </span>
                  <span className="cell-num" role="cell">
                    {Number(control.dwell).toFixed(2)} h
                  </span>
                </div>
              ))
            ) : (
              <p className="table-empty">Plot a course to place its controls.</p>
            )}
          </div>

          <div className="section-head" style={{ marginTop: 'clamp(28px, 3.4vw, 46px)' }}>
            <div>
              <span className="legend">Recorder strip</span>
              <h2 className="section-title">Where the pen sat, to the minute</h2>
            </div>
            <p className="section-note">
              The event stream the sheet is drawn from. The polyline, the remarks line and the
              recap are all read from these rows, so nothing is summarised twice.
            </p>
          </div>

          <div className="data-table" role="table" aria-label={`Duty events for sheet ${day?.day_number ?? 1}`}>
            <div className="data-row data-head cols-duty" role="row">
              <span className="legend" role="columnheader">
                Window
              </span>
              <span className="legend" role="columnheader">
                Row
              </span>
              <span className="legend" role="columnheader">
                Activity
              </span>
              <span className="legend cell-hide-sm" role="columnheader">
                Location
              </span>
              <span className="legend" role="columnheader" style={{ textAlign: 'right' }}>
                Hours
              </span>
            </div>

            {day?.events?.length ? (
              day.events.map((event, index) => (
                <div className="data-row cols-duty" role="row" key={`${event.start_time}-${index}`}>
                  <span className="cell-code" role="cell">
                    {event.start_time}–{event.end_time}
                  </span>
                  <span className="cell-symbol" role="cell">
                    <SymbolMark kind={event.status} />
                  </span>
                  <span className="cell-strong cell-break" role="cell">
                    {event.description}
                  </span>
                  <span className="cell-quiet cell-hide-sm" role="cell">
                    {event.location}
                  </span>
                  <span className="cell-num" role="cell">
                    {Number(event.duration_hours).toFixed(2)} h
                  </span>
                </div>
              ))
            ) : (
              <p className="table-empty">No sheet loaded.</p>
            )}
          </div>
        </section>

        {/* Measured rule checks and the real MCS-59 output. */}
        <section className="sheet-section" id="limits">
          <div className="section-head">
            <div>
              <span className="legend">Measured, not claimed</span>
              <h2 className="section-title">What the course proves</h2>
            </div>
            <p className="section-note">
              Each figure is read back out of this trip&apos;s own event stream at the moment it is
              displayed, so the plan and its placard cannot drift apart.
            </p>
          </div>

          <div className="placard">
            <div className="placard-head">
              <span className="legend">
                § 395 specification · property-carrying, 70-hour / 8-day
              </span>
              <span className="legend">{isSample ? 'Sample values' : `Trip #${trip.trip_id}`}</span>
            </div>
            {specs.map((spec) => (
              <div className="spec-row" key={spec.name}>
                <span className="spec-name">{spec.name}</span>
                <span className={`spec-value is-${spec.status}`}>
                  {typeof spec.value === 'number' ? spec.value.toFixed(2) : spec.value}
                  <small style={{ fontSize: '0.62rem', marginLeft: 4 }}>{spec.unit}</small>
                </span>
                <span className="spec-note">
                  Limit {spec.limit}. {spec.note}
                </span>
              </div>
            ))}
          </div>

          {!isSample && day?.canvas_data && (
            <div style={{ marginTop: 'clamp(24px, 3vw, 40px)' }}>
              <div className="section-head" style={{ marginBottom: 14 }}>
                <div>
                  <span className="legend">
                    Form MCS-59 output · sheet {day.day_number} of {days.length}
                  </span>
                  <h2 className="section-title" style={{ fontSize: '1.25rem' }}>
                    The sheet that goes in the binder
                  </h2>
                </div>
              </div>
              <div className="sheet-frame">
                <SheetFrame log={day} />
              </div>
            </div>
          )}

          {isSample && (
            <p className="table-empty" style={{ marginTop: 18, border: '1px solid var(--rule-soft)' }}>
              {SAMPLE_LABEL}. It is loaded so the board has something on it before you start.
              Plot a course to replace it with a real calculation and its own MCS-59 output — no
              account needed.
            </p>
          )}
        </section>

        <section className="close-plate">
          <div>
            <span className="legend">Full console</span>
            <h2 className="section-title" style={{ marginTop: 10 }}>
              Work a stack of loads with the map, the stop list and every sheet open at once.
            </h2>
            <p className="section-note" style={{ marginTop: 12 }}>
              The same engine, laid out for a dispatcher: interactive route map, stop-by-stop
              playback, multi-day sheet export, saved history and aggregate heuristics.
            </p>
          </div>
          <div>
            <button type="button" className="key" onClick={onEnterConsole}>
              Open the dispatch console
            </button>
            <p className="close-note">
              Planning needs no account. Signing in keeps your trips, carrier details and truck
              numbers in your own history — and nobody else&apos;s.
            </p>
          </div>
        </section>
        </main>

        <footer className="instrument-footer">
          <span>
            Spotter AI — FMCSA Hours of Service (§ 395) course planner and ELD daily log generator
          </span>
          <span>
            Geocoding and routing fall back to local deterministic models, so planning never
            depends on a third party being up.
          </span>
        </footer>
      </div>
    </div>
  );
}
