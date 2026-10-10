/**
 * Runnable checks for the § 395 placard math.
 *
 * The project ships no frontend test runner, and hosSpecs.js is dependency-free,
 * so this runs on plain node without adding a framework:
 *
 *   npm run check:specs
 *
 * These numbers are printed to a dispatcher as compliance facts, so a wrong one
 * is worse than a missing one.
 */
import assert from 'node:assert/strict';
import {
  buildSpecs,
  longestDrivingStretch,
  longestDutyWindow,
  longestFuelInterval,
} from '../src/surfaces/hosSpecs.js';

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

/** A compliant single shift: 0.5 pre-trip, 1.5 deadhead, 1.0 loading, 8.0 drive, rest. */
const shiftEvents = [
  { status: 'off_duty', duration_hours: 5, start_time: '00:00', end_time: '05:00' },
  { status: 'on_duty_not_driving', duration_hours: 0.5, start_time: '05:00', end_time: '05:30' },
  { status: 'driving', duration_hours: 1.5, start_time: '05:30', end_time: '07:00' },
  { status: 'on_duty_not_driving', duration_hours: 1, start_time: '07:00', end_time: '08:00' },
  { status: 'driving', duration_hours: 8, start_time: '08:00', end_time: '16:00' },
  { status: 'off_duty', duration_hours: 0.5, start_time: '16:00', end_time: '16:30' },
  { status: 'on_duty_not_driving', duration_hours: 1, start_time: '16:30', end_time: '17:30' },
  { status: 'off_duty', duration_hours: 6.5, start_time: '17:30', end_time: '00:00' },
];

/**
 * A 10-hour sleeper rest that straddles midnight, exactly as the API returns it:
 * two five-hour events on two different sheets.
 */
const midnightSplitRest = [
  { status: 'on_duty_not_driving', duration_hours: 0.5, start_time: '00:00', end_time: '00:30' },
  { status: 'driving', duration_hours: 6, start_time: '00:30', end_time: '06:30' },
  { status: 'sleeper_berth', duration_hours: 5, start_time: '06:30', end_time: '11:30' },
];

const afterMidnightShift = [
  { status: 'sleeper_berth', duration_hours: 5, start_time: '00:00', end_time: '05:00' },
  { status: 'on_duty_not_driving', duration_hours: 0.5, start_time: '05:00', end_time: '05:30' },
  { status: 'driving', duration_hours: 5.5, start_time: '05:30', end_time: '11:00' },
];

check('a 10-hour sleeper rest split across midnight still closes the shift', () => {
  const window = longestDutyWindow([...midnightSplitRest, ...afterMidnightShift]);
  assert.ok(
    window <= 14,
    `duty window came back as ${window}h on a trip inside the 14-hour limit`,
  );
  // 0.5 pre-trip + 6 drive ends the first shift; the second shift is the longer one.
  assert.equal(window, 6.5);
});

check('the duty window on a single compliant shift is the shift, not the day', () => {
  // 0.5 pre-trip + 1.5 + 1.0 loading + 8.0 + the 0.5 break (breaks are inside the
  // window) + 1.0 unloading = 12.5. The 6.5-hour evening rest closes nothing, so
  // it never joins the window.
  assert.equal(longestDutyWindow(shiftEvents), 12.5);
});

check('a 30-minute break does not reset the 8-hour driving clock by accident', () => {
  // 3 h drive, a real 30-minute break, then 5 h drive: longest unbroken stretch is 5.
  const events = [
    { status: 'driving', duration_hours: 3 },
    { status: 'off_duty', duration_hours: 0.5 },
    { status: 'driving', duration_hours: 5 },
  ];
  assert.equal(longestDrivingStretch(events), 5);
});

check('a 20-minute pause does not count as a qualifying break', () => {
  const events = [
    { status: 'driving', duration_hours: 4 },
    { status: 'on_duty_not_driving', duration_hours: 0.33 },
    { status: 'driving', duration_hours: 4.5 },
  ];
  // The pause is under 30 minutes, so the clock keeps running: 4 + 4.5, and the
  // pause itself is not driving time.
  assert.equal(longestDrivingStretch(events), 8.5);
});

check('no fuel stop means the whole trip is the interval, not zero', () => {
  const result = longestFuelInterval([{ type: 'pickup' }, { type: 'dropoff' }], 843.7);
  assert.equal(result.fuelStops, 0);
  assert.equal(result.interval, 843.7);
});

check('fuel intervals measure the gap between consecutive stops', () => {
  const stops = [
    { type: 'fuel', cumulative_miles: 300 },
    { type: 'rest', cumulative_miles: 700 },
    { type: 'fuel', cumulative_miles: 1100 },
  ];
  assert.equal(longestFuelInterval(stops, 1500).interval, 800);
});

check('a driving stretch keeps counting across a midnight sheet change', () => {
  // The API cuts the event stream at midnight-to-midnight days. A stretch that
  // straddles the cut arrives as two events on two sheets and must still read as
  // one unbroken run of driving.
  const dayOne = [{ status: 'driving', duration_hours: 7, start_time: '17:00', end_time: '00:00' }];
  const dayTwo = [{ status: 'driving', duration_hours: 3.5, start_time: '00:00', end_time: '03:30' }];
  assert.equal(longestDrivingStretch([...dayOne, ...dayTwo]), 10.5);
});

check('a rest run interrupted by duty does not close the shift', () => {
  // 7 hours sleeper, a 30-minute on-duty interruption, then 3 more hours: the
  // rest is not consecutive, so the 14-hour window it was meant to close keeps
  // running through it.
  const events = [
    { status: 'on_duty_not_driving', duration_hours: 0.5, start_time: '00:00', end_time: '00:30' },
    { status: 'driving', duration_hours: 6, start_time: '00:30', end_time: '06:30' },
    { status: 'sleeper_berth', duration_hours: 7, start_time: '06:30', end_time: '13:30' },
    { status: 'on_duty_not_driving', duration_hours: 0.5, start_time: '13:30', end_time: '14:00' },
    { status: 'sleeper_berth', duration_hours: 3, start_time: '14:00', end_time: '17:00' },
  ];
  // The window keeps accruing through the non-qualifying rest because only 10
  // consecutive hours close it: 0.5 + 6 + 7 + 0.5 = 14.0 at the last duty moment,
  // exactly at the limit. A driver may not drive past it without a full reset.
  assert.equal(longestDutyWindow(events), 14);
});

check('a rest split into two consecutive runs still closes the shift', () => {
  // 7 hours sleeper immediately followed by 3 hours off duty: consecutive rest
  // totals 10, which closes the shift even though no single event says "10".
  const events = [
    { status: 'on_duty_not_driving', duration_hours: 0.5, start_time: '00:00', end_time: '00:30' },
    { status: 'driving', duration_hours: 6, start_time: '00:30', end_time: '06:30' },
    { status: 'sleeper_berth', duration_hours: 7, start_time: '06:30', end_time: '13:30' },
    { status: 'off_duty', duration_hours: 3, start_time: '13:30', end_time: '16:30' },
    { status: 'on_duty_not_driving', duration_hours: 0.5, start_time: '16:30', end_time: '17:00' },
  ];
  // The first shift is 0.5 + 6; the rest after it closes it, so the window is the
  // second shift's 0.5.
  assert.equal(longestDutyWindow(events), 6.5);
});

check('limits at exactly the number are compliant, and a hair over is flagged', () => {
  const atLimit = {
    summary: { total_distance_miles: 1000, final_cycle_hours: 70 },
    stops: [{ type: 'fuel', cumulative_miles: 1000 }],
    daily_logs: [{
      events: [
        { status: 'driving', duration_hours: 11, start_time: '00:00', end_time: '11:00' },
        { status: 'sleeper_berth', duration_hours: 10, start_time: '11:00', end_time: '21:00' },
        { status: 'driving', duration_hours: 3, start_time: '21:00', end_time: '00:00' },
      ],
    }],
  };
  for (const spec of buildSpecs(atLimit)) {
    assert.equal(spec.status, 'ok', `${spec.name} flagged at exactly its limit`);
  }

  const overLimit = {
    ...atLimit,
    daily_logs: [{
      events: [
        { status: 'driving', duration_hours: 11.5, start_time: '00:00', end_time: '11:30' },
        { status: 'sleeper_berth', duration_hours: 10, start_time: '11:30', end_time: '21:30' },
        { status: 'driving', duration_hours: 2.5, start_time: '21:30', end_time: '00:00' },
      ],
    }],
  };
  const drivingSpec = buildSpecs(overLimit).find((spec) => spec.name.startsWith('11-hour'));
  assert.equal(drivingSpec.status, 'warn');
  assert.equal(drivingSpec.value, 11.5);
});

check('unsorted stop lists still measure the fuel gaps correctly', () => {
  const stops = [
    { type: 'fuel', cumulative_miles: 1100 },
    { type: 'pickup', cumulative_miles: 0 },
    { type: 'fuel', cumulative_miles: 300 },
  ];
  assert.equal(longestFuelInterval(stops, 1500).interval, 800);
});

check('a trip with no logs or summary renders zeros instead of crashing', () => {
  const specs = buildSpecs({ stops: [] });
  assert.equal(specs.length, 4);
  for (const spec of specs) {
    assert.equal(spec.value, 0);
    assert.equal(spec.status, 'ok');
  }
  assert.deepEqual(buildSpecs(null), []);
});

check('a compliant trip is reported as inside every limit', () => {
  const trip = {
    summary: { total_distance_miles: 843.7, final_cycle_hours: 50.6 },
    stops: [
      { type: 'pickup', cumulative_miles: 125 },
      { type: 'rest', cumulative_miles: 605 },
      { type: 'dropoff', cumulative_miles: 843.7 },
    ],
    daily_logs: [
      { events: midnightSplitRest },
      { events: afterMidnightShift },
    ],
  };
  const specs = buildSpecs(trip);
  assert.equal(specs.length, 4);
  for (const spec of specs) {
    assert.equal(
      spec.status,
      'ok',
      `${spec.name} was flagged ${spec.status} at ${spec.value}${spec.unit}`,
    );
  }
});

let failed = 0;
for (const [name, fn] of checks) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}

console.log(`\n${checks.length - failed}/${checks.length} placard checks passed`);
process.exit(failed === 0 ? 0 : 1);
