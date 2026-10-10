"""
API-level coverage for trip calculation: stop placement and access control.

Two defects lived only at this layer and were invisible to the engine tests:
en-route stops were persisted with placeholder coordinates, and trip history
was readable by anyone regardless of who owned the trip.
"""

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from rest_framework_simplejwt.tokens import RefreshToken

from middleware.rate_limit import RateLimitAndDDoSProtectionMiddleware
from trips.models import Trip, TripStop

User = get_user_model()


class TripApiTestCase(TestCase):
    def setUp(self):
        RateLimitAndDDoSProtectionMiddleware.ip_surge_buckets.clear()
        RateLimitAndDDoSProtectionMiddleware.ip_minute_buckets.clear()
        self.client = Client()

    def calculate(self, **overrides):
        payload = {
            'current_location': 'Dallas, TX',
            'pickup_location': 'Houston, TX',
            'dropoff_location': 'New York, NY',
            'current_cycle_hours': 0.0,
        }
        payload.update(overrides)
        return self.client.post(
            '/api/trips/calculate/', payload, content_type='application/json'
        )

    def auth_header(self, user):
        token = RefreshToken.for_user(user)
        return f'Bearer {str(token.access_token)}'


class StopPlacementTestCase(TripApiTestCase):
    """En-route stops must sit at the mile they happen at, not on the pickup."""

    def test_stops_are_placed_along_the_route_rather_than_on_the_pickup(self):
        res = self.calculate(current_cycle_hours=0.0, dropoff_location='Los Angeles, CA')
        self.assertEqual(res.status_code, 200)
        stops = res.json()['stops']

        pickup = next(s for s in stops if s['type'] == 'pickup')
        dropoff = next(s for s in stops if s['type'] == 'dropoff')
        en_route = [s for s in stops if s['type'] in ('rest', 'fuel')]
        self.assertTrue(en_route, "A 1,400-mile trip must schedule rest or fuel stops")

        for stop in stops:
            self.assertIsInstance(stop['latitude'], float)
            self.assertIsInstance(stop['longitude'], float)

        for stop in en_route:
            self.assertNotEqual(
                (stop['latitude'], stop['longitude']),
                (pickup['latitude'], pickup['longitude']),
                f"{stop['type']} stop was pinned to the pickup coordinates",
            )
            self.assertNotEqual(
                (stop['latitude'], stop['longitude']),
                (dropoff['latitude'], dropoff['longitude']),
                f"{stop['type']} stop was pinned to the dropoff coordinates",
            )

        # Every stop reports the odometer reading it occurs at, and the readings
        # never move backwards along the trip.
        readings = [s['cumulative_miles'] for s in stops]
        self.assertEqual(readings, sorted(readings))
        self.assertGreater(readings[-1], 0.0)
        # The pickup sits at the end of the deadhead, not at the origin.
        self.assertGreater(pickup['cumulative_miles'], 0.0)
        self.assertGreater(
            dropoff['cumulative_miles'], pickup['cumulative_miles']
        )

    @staticmethod
    def stop_signature(stops):
        """Stops can share a location label, so compare the whole tuple set."""
        return sorted(
            (s['type'], s['location_name'], round(s['latitude'], 4), round(s['longitude'], 4))
            for s in stops
        )

    def test_persisted_stop_rows_carry_the_resolved_coordinates(self):
        res = self.calculate(dropoff_location='Los Angeles, CA')
        trip = Trip.objects.get(id=res.json()['trip_id'])

        self.assertGreater(trip.stops.count(), 0)
        stored = sorted(
            (row.stop_type, row.location_name, round(row.latitude, 4), round(row.longitude, 4))
            for row in trip.stops.all()
        )
        self.assertEqual(stored, self.stop_signature(res.json()['stops']))

    def test_reloaded_trip_keeps_its_stop_coordinates(self):
        res = self.calculate(dropoff_location='Los Angeles, CA')
        trip_id = res.json()['trip_id']
        fresh = self.client.get(f'/api/trips/{trip_id}/')
        self.assertEqual(fresh.status_code, 200)
        self.assertEqual(
            self.stop_signature(fresh.json()['stops']),
            self.stop_signature(res.json()['stops']),
        )

    def test_short_trip_places_its_two_terminals_correctly(self):
        res = self.calculate(
            pickup_location='Dallas, TX',
            dropoff_location='Houston, TX',
            current_cycle_hours=5.0,
        )
        stops = res.json()['stops']
        pickup = next(s for s in stops if s['type'] == 'pickup')
        dropoff = next(s for s in stops if s['type'] == 'dropoff')
        self.assertNotEqual(pickup['location_name'], dropoff['location_name'])
        self.assertNotEqual(
            (pickup['latitude'], pickup['longitude']),
            (dropoff['latitude'], dropoff['longitude']),
        )


class TripAccessControlTestCase(TripApiTestCase):
    """Trip history is private to the account that owns it."""

    def setUp(self):
        super().setUp()
        self.owner = User.objects.create_user(
            username='owner_driver', email='owner@spotter.ai', password='SecurePassword123!'
        )
        self.other = User.objects.create_user(
            username='other_driver', email='other@spotter.ai', password='SecurePassword123!'
        )

    def create_owned_trip(self):
        res = self.client.post(
            '/api/trips/calculate/',
            {
                'current_location': 'Dallas, TX',
                'pickup_location': 'Houston, TX',
                'dropoff_location': 'Atlanta, GA',
                'current_cycle_hours': 4.0,
            },
            content_type='application/json',
            HTTP_AUTHORIZATION=self.auth_header(self.owner),
        )
        self.assertEqual(res.status_code, 200)
        return res.json()['trip_id']

    def test_anonymous_visitor_cannot_read_an_owned_trip(self):
        trip_id = self.create_owned_trip()
        res = self.client.get(f'/api/trips/{trip_id}/')
        self.assertEqual(res.status_code, 404)

    def test_another_account_cannot_read_the_trip(self):
        trip_id = self.create_owned_trip()
        res = self.client.get(
            f'/api/trips/{trip_id}/', HTTP_AUTHORIZATION=self.auth_header(self.other)
        )
        self.assertEqual(res.status_code, 404)

    def test_the_owner_can_read_their_own_trip(self):
        trip_id = self.create_owned_trip()
        res = self.client.get(
            f'/api/trips/{trip_id}/', HTTP_AUTHORIZATION=self.auth_header(self.owner)
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['trip_id'], trip_id)

    def test_anonymous_history_excludes_owned_trips(self):
        trip_id = self.create_owned_trip()
        res = self.client.get('/api/trips/history/')
        self.assertEqual(res.status_code, 200)
        self.assertNotIn(trip_id, [t['id'] for t in res.json()])

    def test_anonymous_demo_trips_stay_readable(self):
        """The public planner still works: unowned trips remain public."""
        res = self.calculate(dropoff_location='Atlanta, GA')
        trip_id = res.json()['trip_id']
        self.assertEqual(Trip.objects.get(id=trip_id).user_id, None)

        listed = self.client.get('/api/trips/history/')
        self.assertIn(trip_id, [t['id'] for t in listed.json()])
        self.assertEqual(self.client.get(f'/api/trips/{trip_id}/').status_code, 200)
