/**
 * Turn a calculated trip into the placard of measured rule checks.
 *
 * These read the same event stream the log sheets are drawn from, so the numbers
 * on the placard and the lines on the sheet can never disagree.
 */

const SPEED_MPH = 55;
const FUEL_INTERVAL_MILES = 1000;

/** Longest unbroken driving stretch: any non-driving period of 30+ min resets it. */
export function longestDrivingStretch(events = []) {
  let stretch = 0;
  let longest = 0;

  for (const event of events) {
    const hours = Number(event.duration_hours) || 0;
    if (event.status === 'driving') {
      stretch += hours;
      longest = Math.max(longest, stretch);
    } else if (hours >= 0.5) {
      stretch = 0;
    }
  }

  return round(longest);
}

/**
 * Longest elapsed duty window. The 14-hour window is wall-clock time from coming
 * on duty, so breaks count toward it and only a 10-hour rest closes it.
 *
 * The rest that closes a shift is counted as a consecutive run, not as one
 * event: a 10-hour sleeper break that straddles midnight arrives here as two
 * five-hour events, and treating those individually reported a 28-hour duty
 * window on a trip that was well inside the limit.
 */
export function longestDutyWindow(events = []) {
  let elapsed = 0;
  let longest = 0;
  let onShift = false;
  let restRun = 0;

  for (const event of events) {
    const hours = Number(event.duration_hours) || 0;

    if (event.status === 'off_duty' || event.status === 'sleeper_berth') {
      restRun += hours;
      if (restRun >= 10) {
        // The shift is closed. The rest itself is not duty time, so it never
        // joins the window it just ended.
        elapsed = 0;
        onShift = false;
        restRun = 0;
      } else if (onShift) {
        elapsed += hours;
      }
      continue;
    }

    restRun = 0;
    onShift = true;
    elapsed += hours;
    longest = Math.max(longest, elapsed);
  }

  return round(longest);
}

/** Largest distance covered between fuel stops, including the run-up to the first. */
export function longestFuelInterval(stops = [], totalMiles = 0) {
  const fuelMiles = stops
    .filter((stop) => stop.type === 'fuel')
    .map((stop) => Number(stop.cumulative_miles) || 0)
    .sort((a, b) => a - b);

  if (fuelMiles.length === 0) {
    // No fuel stop was needed, which means the whole trip is the interval. That
    // is the honest reading of an empty list, not a zero.
    return { interval: round(totalMiles), fuelStops: 0 };
  }

  let longest = fuelMiles[0];
  for (let index = 1; index < fuelMiles.length; index += 1) {
    longest = Math.max(longest, fuelMiles[index] - fuelMiles[index - 1]);
  }

  return { interval: round(longest), fuelStops: fuelMiles.length };
}

/**
 * The placard rows. `status` is 'ok' when the trip is inside the limit and
 * 'warn' when the limit is what shaped the plan — both are useful to a dispatcher,
 * and neither is a claim about the reader's own fleet.
 */
export function buildSpecs(trip) {
  if (!trip) return [];

  const events = (trip.daily_logs || []).flatMap((day) => day.events || []);
  const summary = trip.summary || {};
  const driving = longestDrivingStretch(events);
  const duty = longestDutyWindow(events);
  const fuel = longestFuelInterval(trip.stops, summary.total_distance_miles || 0);
  const cycle = Number(summary.final_cycle_hours) || 0;

  return [
    {
      name: '11-hour driving limit',
      value: driving,
      unit: 'hr',
      limit: '11.00 hr',
      status: driving > 11.01 ? 'warn' : 'ok',
      note:
        driving > 11.01
          ? 'A stretch exceeded the limit.'
          : 'No unbroken driving stretch crosses 11 hours; the 10-hour rest closes each shift first.',
    },
    {
      name: '14-hour duty window',
      value: duty,
      unit: 'hr',
      limit: '14.00 hr',
      status: duty > 14.01 ? 'warn' : 'ok',
      note: 'Wall-clock time from coming on duty, breaks included, measured across every shift in the trip.',
    },
    {
      name: 'Fuel interval',
      value: fuel.interval,
      unit: 'mi',
      limit: '1,000 mi',
      status: fuel.interval > FUEL_INTERVAL_MILES + 1 ? 'warn' : 'ok',
      note:
        fuel.fuelStops === 0
          ? 'The whole trip fits inside one tank range, so no fuel stop was scheduled.'
          : `Longest gap between fuel stops across ${fuel.fuelStops} stop${fuel.fuelStops === 1 ? '' : 's'} on the routed line.`,
    },
    {
      name: '70-hour / 8-day cycle',
      value: cycle,
      unit: 'hr',
      limit: '70.00 hr',
      status: cycle > 70 ? 'warn' : 'ok',
      note: 'Cycle hours carried in plus everything this trip adds. A 34-hour restart is inserted automatically when it would overflow.',
    },
  ];
}

/** Total miles implied by the simulated driving hours, at the engine's 55 mph. */
export function milesFromDrivingHours(hours) {
  return Math.round((Number(hours) || 0) * SPEED_MPH * 10) / 10;
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
