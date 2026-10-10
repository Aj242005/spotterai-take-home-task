from django.test import TestCase
from trips.services.hos_engine import HOSEngine
from trips.services.route_service import RouteService

class HOSEngineTestCase(TestCase):
    def test_short_trip_calculation(self):
        """Test a short trip under 11 hours driving (Dallas -> Houston)."""
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

    def test_long_trip_calculation_triggers_rest(self):
        """Test a long trip (Dallas -> Atlanta ~800mi) forcing 10-hour rest."""
        route_info = {
            'total_distance_miles': 800.0,
            'total_driving_hours': 14.5,
            'geometry': [[32.77, -96.79], [33.74, -84.38]]
        }
        res = HOSEngine.calculate_trip_schedule({
            'current_location': 'Dallas, TX',
            'pickup_location': 'Dallas, TX',
            'dropoff_location': 'Atlanta, GA',
            'current_cycle_hours': 0.0,
            'route_info': route_info
        })
        summary = res['summary']
        self.assertGreaterEqual(summary['num_days'], 2)
        self.assertGreaterEqual(summary['num_rest_stops'], 1)
        for dl in res['daily_logs']:
            self.assertEqual(dl['totals']['grand_total'], 24.0)
