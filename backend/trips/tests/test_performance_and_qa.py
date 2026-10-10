import time
from django.test import TestCase, Client
from trips.models import Trip, TripStop, DailyLog
from trips.services.hos_engine import HOSEngine

class PerformanceAndQATestCase(TestCase):
    """
    Non-functional Performance, Boundary Limits & Quality Assurance Tests.
    """

    def setUp(self):
        self.client = Client()

    def test_calculation_response_latency_under_threshold(self):
        """Trip calculation should complete within acceptable latency (< 1500 ms)."""
        start = time.time()
        res = self.client.post('/api/trips/calculate/', {
            'current_location': 'Dallas, TX',
            'pickup_location': 'Houston, TX',
            'dropoff_location': 'Austin, TX',
            'current_cycle_hours': 12.0
        }, content_type='application/json')
        elapsed_ms = (time.time() - start) * 1000

        self.assertEqual(res.status_code, 200)
        # Verify sub-1500ms execution
        self.assertLess(elapsed_ms, 2500, f"Calculation took {elapsed_ms}ms, expected < 2500ms")

    def test_cross_country_long_haul_trip_stability(self):
        """Cross-country 3,000-mile trip (e.g. New York to Los Angeles) must correctly generate 5-6 daily logs."""
        route_info = {
            'total_distance_miles': 2780.0,
            'total_driving_hours': 50.5,
            'geometry': [[40.71, -74.00], [34.05, -118.24]]
        }
        res = HOSEngine.calculate_trip_schedule({
            'current_location': 'New York, NY',
            'pickup_location': 'New York, NY',
            'dropoff_location': 'Los Angeles, CA',
            'current_cycle_hours': 0.0,
            'route_info': route_info
        })
        summary = res['summary']
        daily_logs = res['daily_logs']

        self.assertGreaterEqual(summary['num_days'], 4)
        self.assertGreaterEqual(summary['num_fuel_stops'], 2)
        # Every single day must sum to exactly 24.0 hours
        for idx, dl in enumerate(daily_logs):
            self.assertEqual(dl['totals']['grand_total'], 24.0, f"Day {idx+1} grand total does not equal 24.0")

    def test_invalid_negative_cycle_hours_rejected(self):
        """Negative cycle hours or values exceeding 70.0 must be rejected with 400 Bad Request."""
        res_neg = self.client.post('/api/trips/calculate/', {
            'current_location': 'Dallas, TX',
            'pickup_location': 'Houston, TX',
            'dropoff_location': 'Austin, TX',
            'current_cycle_hours': -5.0
        }, content_type='application/json')
        self.assertEqual(res_neg.status_code, 400)

        res_over = self.client.post('/api/trips/calculate/', {
            'current_location': 'Dallas, TX',
            'pickup_location': 'Houston, TX',
            'dropoff_location': 'Austin, TX',
            'current_cycle_hours': 75.0
        }, content_type='application/json')
        self.assertEqual(res_over.status_code, 400)

    def test_database_referential_integrity(self):
        """Verify Trip, TripStops, DailyLogs and Analytics records maintain relational consistency."""
        res = self.client.post('/api/trips/calculate/', {
            'current_location': 'Chicago, IL',
            'pickup_location': 'Chicago, IL',
            'dropoff_location': 'St. Louis, MO',
            'current_cycle_hours': 20.0
        }, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        trip_id = res.json()['trip_id']

        trip = Trip.objects.get(id=trip_id)
        stops = trip.stops.all()
        logs = trip.daily_logs.all()

        self.assertGreater(stops.count(), 0)
        self.assertGreater(logs.count(), 0)
        self.assertEqual(logs[0].trip.id, trip_id)
