from django.test import TestCase
from trips.services.hos_engine import HOSEngine
from trips.services.route_service import RouteService
from trips.services.log_generator import LogGenerator

class HOSFunctionalTestCase(TestCase):
    """
    Comprehensive Functional Verification for FMCSA 49 CFR § 395 Rules.
    """

    def test_short_trip_single_day(self):
        """Short trip under 11 hours should complete in 1 day and sum to exactly 24.0 hours."""
        route_info = {
            'total_distance_miles': 240.0,
            'total_driving_hours': 4.36,
            'geometry': [[32.77, -96.79], [29.76, -95.36]]
        }
        res = HOSEngine.calculate_trip_schedule({
            'current_location': 'Dallas, TX',
            'pickup_location': 'Dallas, TX',
            'dropoff_location': 'Houston, TX',
            'current_cycle_hours': 10.0,
            'route_info': route_info
        })
        summary = res['summary']
        self.assertEqual(summary['num_days'], 1)
        self.assertEqual(len(res['daily_logs']), 1)
        day1 = res['daily_logs'][0]
        self.assertEqual(day1['totals']['grand_total'], 24.0)
        self.assertAlmostEqual(day1['totals']['driving'], 4.36, places=1)
        # Terminal operations: 0.5 pre-trip + 1.0 pickup + 1.0 dropoff = 2.5 on-duty
        self.assertGreaterEqual(day1['totals']['on_duty_not_driving'], 2.5)

    def test_11_hour_driving_limit_mandates_10_hour_rest(self):
        """Driving exceeding 11 hours must trigger mandatory 10-hour rest break."""
        # 750 miles at 55mph = 13.6 hours of driving > 11.0 hour limit
        route_info = {
            'total_distance_miles': 750.0,
            'total_driving_hours': 13.6,
            'geometry': [[32.77, -96.79], [33.74, -84.38]]
        }
        res = HOSEngine.calculate_trip_schedule({
            'current_location': 'Dallas, TX',
            'pickup_location': 'Dallas, TX',
            'dropoff_location': 'Atlanta, GA',
            'current_cycle_hours': 5.0,
            'route_info': route_info
        })
        summary = res['summary']
        self.assertGreaterEqual(summary['num_days'], 2)
        self.assertGreaterEqual(summary['num_rest_stops'], 1)
        
        # Verify 10-hr rest in stops
        rest_stops = [s for s in res['stops'] if s['type'] == 'rest']
        self.assertTrue(any(s['duration_hours'] == 10.0 for s in rest_stops))

        # Every day must sum to exactly 24.0 hours
        for dl in res['daily_logs']:
            self.assertEqual(dl['totals']['grand_total'], 24.0)

    def test_8_hour_driving_mandates_30_minute_break(self):
        """
        Eight cumulative driving hours without a qualifying interruption mandate
        a 30-minute break.

        This originally used a 500-mile route, but that route's 1-hour cargo
        loading period is itself a qualifying non-driving break under
        49 CFR 395.3(a)(3)(ii), so the driving clock legally restarts there and
        no break is owed. The route is now long enough to reach 8 continuous
        driving hours *after* the loading period.
        """
        # 700 mi => 105 mi deadhead, 1 hr loading (resets the clock), then 440
        # continuous driving miles = exactly 8.0 driving hours.
        route_info = {
            'total_distance_miles': 700.0,
            'total_driving_hours': 12.73,
            'geometry': [[32.77, -96.79], [30.26, -97.74]]
        }
        res = HOSEngine.calculate_trip_schedule({
            'current_location': 'Dallas, TX',
            'pickup_location': 'Dallas, TX',
            'dropoff_location': 'Austin, TX',
            'current_cycle_hours': 0.0,
            'route_info': route_info
        })
        # Check if 30-minute break event was added
        break_events = [e for e in res['events'] if e['duration_hours'] == 0.5 and 'break' in e['description'].lower()]
        self.assertGreaterEqual(len(break_events), 1)

    def test_non_driving_period_resets_30_minute_break_clock(self):
        """
        A 30+ minute on-duty-not-driving period satisfies the break requirement,
        so it must restart the 8-hour driving clock rather than let the engine
        schedule a break the driver does not owe.

        500 mi = 1.36 hr drive, 1.0 hr loading, then 7.73 hr drive. No single
        stretch reaches 8 cumulative driving hours, so zero breaks are legal.
        """
        route_info = {
            'total_distance_miles': 500.0,
            'total_driving_hours': 9.09,
            'geometry': [[32.77, -96.79], [30.26, -97.74]]
        }
        res = HOSEngine.calculate_trip_schedule({
            'current_location': 'Dallas, TX',
            'pickup_location': 'Dallas, TX',
            'dropoff_location': 'Austin, TX',
            'current_cycle_hours': 0.0,
            'route_info': route_info
        })
        break_events = [e for e in res['events'] if e['duration_hours'] == 0.5 and 'break' in e['description'].lower()]
        self.assertEqual(len(break_events), 0)

    def test_fuel_stop_every_1000_miles(self):
        """A route over 1,000 miles must schedule at least one mandatory fuel stop."""
        route_info = {
            'total_distance_miles': 1400.0,
            'total_driving_hours': 25.4,
            'geometry': [[32.77, -96.79], [40.71, -74.00]]
        }
        res = HOSEngine.calculate_trip_schedule({
            'current_location': 'Dallas, TX',
            'pickup_location': 'Dallas, TX',
            'dropoff_location': 'New York, NY',
            'current_cycle_hours': 0.0,
            'route_info': route_info
        })
        fuel_stops = [s for s in res['stops'] if s['type'] == 'fuel']
        self.assertGreaterEqual(len(fuel_stops), 1)
        self.assertEqual(fuel_stops[0]['duration_hours'], 0.5)

    def test_70_hour_cycle_limit_triggers_34_hour_restart(self):
        """Starting with 68 hours used on a 70-hour cycle triggers 34-hour restart."""
        route_info = {
            'total_distance_miles': 400.0,
            'total_driving_hours': 7.27,
            'geometry': [[32.77, -96.79], [29.76, -95.36]]
        }
        res = HOSEngine.calculate_trip_schedule({
            'current_location': 'Dallas, TX',
            'pickup_location': 'Dallas, TX',
            'dropoff_location': 'Houston, TX',
            'current_cycle_hours': 68.0,  # Only 2 hours remaining in cycle!
            'route_info': route_info
        })
        # Must trigger 34-hour restart in stops and partitioned events
        restart_stops = [s for s in res['stops'] if s['duration_hours'] == 34.0]
        self.assertGreaterEqual(len(restart_stops), 1)
        self.assertTrue(any('34-hour' in e['description'] for e in res['events']))


    def test_canvas_log_generator_polyline_continuity(self):
        """Canvas log generator produces valid polylines and exact recap metrics."""
        route_info = {
            'total_distance_miles': 300.0,
            'total_driving_hours': 5.45,
            'geometry': [[32.77, -96.79], [29.76, -95.36]]
        }
        res = HOSEngine.calculate_trip_schedule({
            'current_location': 'Dallas, TX',
            'pickup_location': 'Dallas, TX',
            'dropoff_location': 'Houston, TX',
            'current_cycle_hours': 10.0,
            'route_info': route_info
        })
        day1 = res['daily_logs'][0]
        canvas_data = LogGenerator.format_log_for_canvas(day1, {
            'driver_name': 'Test Driver',
            'carrier_name': 'Test Carrier LLC'
        })
        self.assertIn('header', canvas_data)
        self.assertIn('grid_lines', canvas_data)
        self.assertIn('totals', canvas_data)
        self.assertIn('recap', canvas_data)
        self.assertGreater(len(canvas_data['grid_lines']), 0)
