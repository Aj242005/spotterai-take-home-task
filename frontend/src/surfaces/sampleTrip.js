/**
 * A synthetic two-day sheet so the instrument has paper on first paint.
 *
 * The app used to POST a demo trip on every page load, which wrote a Trip row
 * per visit. Nothing here touches the API: it is authored demonstration data,
 * labelled as synthetic everywhere it appears, and it obeys the same § 395 rules
 * the engine enforces (10.5 h driving, 13.0 h duty window, fuel inside 1,000 mi,
 * a full 10-hour rest across the midnight boundary, every day summing to 24.0).
 */

export const SAMPLE_LABEL = 'SYNTHETIC SAMPLE SHEET — NOT A CALCULATED TRIP';

const dayOneEvents = [
  { status: 'off_duty', start_time: '00:00', end_time: '05:00', duration_hours: 5.0, location: 'Terminal', description: 'Off duty (rest/overnight)' },
  { status: 'on_duty_not_driving', start_time: '05:00', end_time: '05:30', duration_hours: 0.5, location: 'Dallas, TX', description: 'Pre-trip inspection & log initialization' },
  { status: 'driving', start_time: '05:30', end_time: '07:00', duration_hours: 1.5, location: 'En route to Memphis, TN', description: 'Driving (82.5 mi)' },
  { status: 'on_duty_not_driving', start_time: '07:00', end_time: '08:00', duration_hours: 1.0, location: 'Memphis, TN', description: 'Loading cargo at pickup location' },
  { status: 'driving', start_time: '08:00', end_time: '13:30', duration_hours: 5.5, location: 'En route to Nashville, TN', description: 'Driving (302.5 mi)' },
  { status: 'off_duty', start_time: '13:30', end_time: '14:00', duration_hours: 0.5, location: 'Rest Area near Nashville, TN', description: '30-minute mandatory rest break' },
  { status: 'driving', start_time: '14:00', end_time: '16:00', duration_hours: 2.0, location: 'En route to Nashville, TN', description: 'Driving (110.0 mi)' },
  { status: 'on_duty_not_driving', start_time: '16:00', end_time: '16:30', duration_hours: 0.5, location: 'Travel Plaza (Fuel Station)', description: 'Fueling truck & pre-trip check (1,000 mi interval)' },
  { status: 'driving', start_time: '16:30', end_time: '18:00', duration_hours: 1.5, location: 'En route to Nashville, TN', description: 'Driving (82.5 mi)' },
  { status: 'on_duty_not_driving', start_time: '18:00', end_time: '18:30', duration_hours: 0.5, location: 'Nashville, TN', description: 'Unloading cargo at dropoff location' },
  { status: 'off_duty', start_time: '18:30', end_time: '19:00', duration_hours: 0.5, location: 'Nashville, TN', description: 'Post-trip inspection & shift wrap-up' },
  { status: 'sleeper_berth', start_time: '19:00', end_time: '00:00', duration_hours: 5.0, location: 'Truck Stop near Nashville, TN', description: '10-hour mandatory shift rest break' },
];

const dayTwoEvents = [
  { status: 'sleeper_berth', start_time: '00:00', end_time: '05:00', duration_hours: 5.0, location: 'Truck Stop near Nashville, TN', description: '10-hour mandatory shift rest break (continued)' },
  { status: 'on_duty_not_driving', start_time: '05:00', end_time: '05:30', duration_hours: 0.5, location: 'Nashville, TN', description: 'Pre-trip inspection & log initialization' },
  { status: 'driving', start_time: '05:30', end_time: '11:00', duration_hours: 5.5, location: 'En route to Knoxville, TN', description: 'Driving (302.5 mi)' },
  { status: 'off_duty', start_time: '11:00', end_time: '11:30', duration_hours: 0.5, location: 'Rest Area near Knoxville, TN', description: '30-minute mandatory rest break' },
  { status: 'driving', start_time: '11:30', end_time: '15:30', duration_hours: 4.0, location: 'En route to Knoxville, TN', description: 'Driving (220.0 mi)' },
  { status: 'on_duty_not_driving', start_time: '15:30', end_time: '16:00', duration_hours: 0.5, location: 'Travel Plaza (Fuel Station)', description: 'Fueling truck & pre-trip check (1,000 mi interval)' },
  { status: 'driving', start_time: '16:00', end_time: '16:30', duration_hours: 0.5, location: 'En route to Knoxville, TN', description: 'Driving (27.5 mi)' },
  { status: 'on_duty_not_driving', start_time: '16:30', end_time: '17:30', duration_hours: 1.0, location: 'Knoxville, TN', description: 'Unloading cargo at dropoff location' },
  { status: 'off_duty', start_time: '17:30', end_time: '18:00', duration_hours: 0.5, location: 'Knoxville, TN', description: 'Post-trip inspection & shift wrap-up' },
  { status: 'off_duty', start_time: '18:00', end_time: '00:00', duration_hours: 6.0, location: 'Knoxville, TN', description: 'Off duty (rest/overnight)' },
];

const dayOneRemarks = dayOneEvents
  .filter((event) => (event.status !== 'off_duty' || event.duration_hours > 1.0))
  .map((event) => ({
    time: event.start_time,
    location: event.location,
    remarks: `${event.description} (${event.duration_hours} hrs)`,
  }));

const dayTwoRemarks = dayTwoEvents
  .filter((event) => (event.status !== 'off_duty' || event.duration_hours > 1.0))
  .map((event) => ({
    time: event.start_time,
    location: event.location,
    remarks: `${event.description} (${event.duration_hours} hrs)`,
  }));

export const SAMPLE_TRIP = {
  sample: true,
  trip_id: null,
  summary: {
    total_distance_miles: 1127.5,
    total_duration_hours: 37.0,
    total_driving_hours: 20.5,
    num_days: 2,
    num_rest_stops: 2,
    num_fuel_stops: 2,
    final_cycle_hours: 58.0,
    start_time: '2026-10-09 05:00',
    end_time: '2026-10-10 18:00',
  },
  meta: {
    driver_name: 'Sample Driver',
    carrier_name: 'Sample Carrier (synthetic)',
    main_office_address: 'Sample Office, Chicago, IL',
    home_terminal_address: 'Sample Terminal, Dallas, TX',
    truck_number: 'SAMPLE-01',
    trailer_number: 'SAMPLE-01',
    current_location: 'Dallas, TX',
    dropoff_location: 'Knoxville, TN',
  },
  waypoints: {
    current: { lat: 32.7767, lng: -96.797, display_name: 'Dallas, TX' },
    pickup: { lat: 35.1495, lng: -90.049, display_name: 'Memphis, TN' },
    dropoff: { lat: 35.9606, lng: -83.9207, display_name: 'Knoxville, TN' },
  },
  stops: [
    { type: 'pickup', location_name: 'Memphis, TN', cumulative_miles: 82.5, latitude: 35.1495, longitude: -90.049, duration_hours: 1.0 },
    { type: 'rest', location_name: 'Truck Stop near Nashville, TN', cumulative_miles: 605.0, latitude: 36.1627, longitude: -86.7816, duration_hours: 10.0 },
    { type: 'fuel', location_name: 'Travel Plaza (Fuel Station)', cumulative_miles: 660.0, latitude: 36.0, longitude: -86.5, duration_hours: 0.5 },
    { type: 'fuel', location_name: 'Travel Plaza (Fuel Station)', cumulative_miles: 1045.0, latitude: 35.98, longitude: -84.2, duration_hours: 0.5 },
    { type: 'dropoff', location_name: 'Knoxville, TN', cumulative_miles: 1127.5, latitude: 35.9606, longitude: -83.9207, duration_hours: 1.0 },
  ],
  route_geometry: [
    [32.7767, -96.797],
    [33.5, -94.2],
    [34.4, -92.1],
    [35.1495, -90.049],
    [35.7, -88.4],
    [36.1627, -86.7816],
    [35.98, -84.2],
    [35.9606, -83.9207],
  ],
  daily_logs: [
    {
      day_number: 1,
      date_str: 'October 09, 2026',
      total_miles: 577.5,
      totals: {
        off_duty: 6.0,
        sleeper_berth: 5.0,
        driving: 10.5,
        on_duty_not_driving: 2.5,
        grand_total: 24.0,
      },
      events: dayOneEvents,
      remarks: dayOneRemarks,
      recap: {
        on_duty_today: 13.0,
        prev_7_days_total: 46.0,
        total_8_days: 59.0,
        available_tomorrow: 11.0,
      },
    },
    {
      day_number: 2,
      date_str: 'October 10, 2026',
      total_miles: 550.0,
      totals: {
        off_duty: 7.0,
        sleeper_berth: 5.0,
        driving: 10.0,
        on_duty_not_driving: 2.0,
        grand_total: 24.0,
      },
      events: dayTwoEvents,
      remarks: dayTwoRemarks,
      recap: {
        on_duty_today: 12.0,
        prev_7_days_total: 51.0,
        total_8_days: 63.0,
        available_tomorrow: 7.0,
      },
    },
  ],
};

/** The header block the chart sheet prints from. */
export function chartHeaderFor(trip, day) {
  if (!trip || !day) return {};
  return {
    date: day.date_str,
    total_miles_today: day.total_miles,
    driver_name: trip.meta?.driver_name,
    carrier_name: trip.meta?.carrier_name,
    truck_number: trip.meta?.truck_number,
    trailer_number: trip.meta?.trailer_number,
  };
}
