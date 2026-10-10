"""
Edge-case and regression coverage for the HOS engine.

Each test here pins a defect that the original suite could not see because it
only asserted the friendly cases: the demo route starts at 06:00 on a single
day, so nothing ever straddled midnight, no day ever ended mid-window, and no
route was short enough to expose the fabricated deadhead.

Run with:
    python manage.py test trips.tests.test_hos_edge_cases
"""

from datetime import datetime

from django.test import TestCase

from trips.services.hos_engine import HOSEngine
from trips.services.log_generator import LogGenerator

DAY_MINUTES = 24 * 60
EPSILON = 0.06  # one hundredth of an hour per segment, accumulated


def clock_to_minutes(value, is_end=False, previous_minutes=0):
    """HH:MM -> minutes past midnight, reading a trailing 00:00 as end-of-day."""
    hours, minutes = (int(part) for part in str(value).split(':'))
    total = hours * 60 + minutes
    if is_end and total <= previous_minutes:
        return DAY_MINUTES
    return total


def build_route(miles, driving_hours, geometry=None):
    return {
        'total_distance_miles': miles,
        'total_driving_hours': driving_hours,
        'geometry': geometry or [[32.77, -96.79], [33.74, -84.38]],
    }


def calculate(route, cycle_hours=0.0, start_time=None, **overrides):
    payload = {
        'current_location': 'Dallas, TX',
        'pickup_location': 'Dallas, TX',
        'dropoff_location': 'Atlanta, GA',
        'current_cycle_hours': cycle_hours,
        'route_info': route,
    }
    payload.update(overrides)
    if start_time is not None:
        payload['start_time'] = start_time
    return HOSEngine.calculate_trip_schedule(payload)


class DailyLogInvariantMixin:
    """Shared invariants that every 24-hour log sheet must satisfy."""

    def assert_day_is_a_complete_24_hour_window(self, day):
        events = day['events']
        self.assertTrue(events, f"Day {day['day_number']} has no events")

        expected_start = 0
        for event in events:
            actual_start = clock_to_minutes(event['start_time'])
            self.assertEqual(
                actual_start,
                expected_start,
                f"Day {day['day_number']} has a gap or overlap at {event['start_time']} "
                f"(expected the log to resume at "
                f"{expected_start // 60:02d}:{expected_start % 60:02d})",
            )
            expected_start = clock_to_minutes(
                event['end_time'], is_end=True, previous_minutes=actual_start
            )

        self.assertEqual(
            expected_start,
            DAY_MINUTES,
            f"Day {day['day_number']} stops at the wrong place; the 24-hour grid "
            f"must run all the way to midnight",
        )

        segment_sum = round(sum(e['duration_hours'] for e in events), 2)
        self.assertAlmostEqual(
            segment_sum,
            24.0,
            delta=EPSILON,
            msg=f"Day {day['day_number']} segments sum to {segment_sum}, not 24.0",
        )

        totals = day['totals']
        statuses = ('off_duty', 'sleeper_berth', 'driving', 'on_duty_not_driving')
        self.assertAlmostEqual(
            sum(totals[key] for key in statuses), 24.0, delta=0.001
        )
        self.assertEqual(totals['grand_total'], 24.0)

        for status in ('off_duty', 'sleeper_berth', 'driving', 'on_duty_not_driving'):
            drawn = round(sum(e['duration_hours'] for e in events if e['status'] == status), 2)
            self.assertAlmostEqual(
                totals[status],
                drawn,
                delta=EPSILON,
                msg=(
                    f"Day {day['day_number']} reports {status}={totals[status]} but its "
                    f"event stream only accounts for {drawn}"
                ),
            )


class MidnightPartitionTestCase(DailyLogInvariantMixin, TestCase):
    """A trip that crosses 00:00 is the case the original suite never reached."""

    def test_summary_driving_matches_daily_logs_whatever_hour_the_shift_starts(self):
        """
        Summary totals are computed from the canonical event stream while the
        day partition rewrites the stream as it splits at midnight. When the
        partition mutated the shared list, the summary silently dropped every
        minute that had already been logged before midnight.
        """
        route = build_route(800.0, 14.5)
        for hour in (6, 12, 18, 21, 23):
            with self.subTest(start_hour=hour):
                res = calculate(route, start_time=datetime(2026, 3, 10, hour, 0))
                within_days = round(
                    sum(day['totals']['driving'] for day in res['daily_logs']), 2
                )
                self.assertAlmostEqual(
                    res['summary']['total_driving_hours'], within_days, delta=EPSILON
                )
                total_from_events = round(
                    sum(e['duration_hours'] for e in res['events'] if e['status'] == 'driving'), 2
                )
                self.assertAlmostEqual(
                    res['summary']['total_driving_hours'], total_from_events, delta=EPSILON
                )

    def test_partitioning_never_rewrites_the_reported_event_stream(self):
        """
        A split event used to be written back as a new entry starting at exactly
        00:00, so the API handed the frontend an event whose real start time was
        gone and a shorter duration than the driver actually drove.
        """
        route = build_route(800.0, 14.5)
        for hour in (12, 18, 23):
            with self.subTest(start_hour=hour):
                res = calculate(route, start_time=datetime(2026, 3, 10, hour, 0))
                rewritten = [
                    e for e in res['events'] if e['start_time'].endswith(' 00:00')
                ]
                self.assertEqual(
                    rewritten,
                    [],
                    f"Events were rewritten to start at midnight: {rewritten}",
                )
                # Every raw event must still describe a real forward interval.
                for event in res['events']:
                    self.assertLess(event['start_time'], event['end_time'])

    def test_every_day_of_a_cross_midnight_trip_is_a_contiguous_24_hours(self):
        route = build_route(1400.0, 25.4)
        res = calculate(route, start_time=datetime(2026, 3, 10, 22, 0))
        self.assertGreaterEqual(len(res['daily_logs']), 2)
        for day in res['daily_logs']:
            with self.subTest(day=day['day_number']):
                self.assert_day_is_a_complete_24_hour_window(day)

    def test_final_partial_day_is_padded_to_midnight(self):
        """
        The last day of a trip ends whenever the driver signs off. Previously
        only a *leading* gap was padded, so the trailing unworked hours were
        added to the off-duty total without any matching event and the drawn
        polyline stopped short of midnight.
        """
        route = build_route(700.0, 12.73)
        res = calculate(route, start_time=datetime(2026, 3, 10, 6, 0))
        final = res['daily_logs'][-1]
        self.assert_day_is_a_complete_24_hour_window(final)
        self.assertEqual(final['events'][-1]['end_time'], '24:00')

    def test_day_count_matches_partitioned_logs(self):
        route = build_route(2780.0, 50.5, geometry=[[40.71, -74.00], [34.05, -118.24]])
        res = calculate(route)
        self.assertEqual(res['summary']['num_days'], len(res['daily_logs']))
        self.assertEqual(
            [day['day_number'] for day in res['daily_logs']],
            list(range(1, len(res['daily_logs']) + 1)),
        )

    def test_overnight_shift_keeps_its_hours_in_the_right_day(self):
        """A 22:00 start logs only the pre-midnight hours on day one."""
        route = build_route(900.0, 16.36)
        res = calculate(route, start_time=datetime(2026, 3, 10, 22, 0))
        day_one = res['daily_logs'][0]

        # 22:00 -> midnight is 2 hours of window, of which 0.5 is pre-trip duty.
        self.assertAlmostEqual(day_one['totals']['on_duty_not_driving'], 0.5, delta=0.02)
        self.assertAlmostEqual(day_one['totals']['driving'], 1.5, delta=0.02)
        self.assertAlmostEqual(day_one['totals']['off_duty'], 22.0, delta=0.05)
        self.assertEqual(day_one['events'][0]['start_time'], '00:00')
        self.assertEqual(day_one['events'][-1]['end_time'], '00:00')
        for day in res['daily_logs']:
            self.assert_day_is_a_complete_24_hour_window(day)


class DegenerateInputTestCase(DailyLogInvariantMixin, TestCase):
    """Routes the demo flow never produces."""

    def test_zero_distance_trip_logs_no_driving(self):
        """
        A zero-mile route still booked a 50-mile deadhead because the first leg
        fell back to a hardcoded 50 miles whenever the distance was not positive.
        """
        res = calculate(build_route(0.0, 0.0))
        self.assertEqual(res['summary']['total_distance_miles'], 0.0)
        self.assertEqual(res['summary']['total_driving_hours'], 0.0)
        self.assertEqual(res['summary']['num_fuel_stops'], 0)
        self.assertEqual([e for e in res['events'] if e['status'] == 'driving'], [])
        for day in res['daily_logs']:
            self.assert_day_is_a_complete_24_hour_window(day)

    def test_same_city_pickup_and_dropoff_does_not_invent_driving(self):
        res = calculate(
            build_route(0.0, 0.0),
            current_location='Dallas, TX',
            pickup_location='Dallas, TX',
            dropoff_location='Dallas, TX',
        )
        self.assertEqual(res['summary']['total_driving_hours'], 0.0)
        # The paperwork duties still exist even with no miles to drive.
        stop_types = [s['type'] for s in res['stops']]
        self.assertEqual(stop_types.count('pickup'), 1)
        self.assertEqual(stop_types.count('dropoff'), 1)

    def test_very_short_trip_still_produces_one_balanced_day(self):
        res = calculate(build_route(12.0, 0.22))
        self.assertEqual(res['summary']['num_days'], 1)
        self.assert_day_is_a_complete_24_hour_window(res['daily_logs'][0])


class RuleBoundaryTestCase(DailyLogInvariantMixin, TestCase):
    """The limits themselves, at their exact boundaries."""

    def test_no_shift_ever_exceeds_eleven_hours_of_driving_or_fourteen_of_duty(self):
        route = build_route(2780.0, 50.5, geometry=[[40.71, -74.00], [34.05, -118.24]])
        res = calculate(route)

        shift_drive = 0.0
        shift_duty = 0.0
        for event in res['events']:
            if event['status'] == 'driving':
                shift_drive += event['duration_hours']
                shift_duty += event['duration_hours']
            elif event['status'] == 'on_duty_not_driving':
                shift_duty += event['duration_hours']
            else:
                if event['duration_hours'] >= 10.0:
                    self.assertLessEqual(round(shift_drive, 2), 11.01)
                    self.assertLessEqual(round(shift_duty, 2), 14.01)
                    shift_drive = 0.0
                    shift_duty = 0.0
                else:
                    shift_duty += event['duration_hours']
        self.assertLessEqual(round(shift_drive, 2), 11.01)
        self.assertLessEqual(round(shift_duty, 2), 14.01)

    def test_cycle_exhausted_at_exactly_seventy_hours_forces_a_restart(self):
        route = build_route(400.0, 7.27)
        res = calculate(route, cycle_hours=70.0)
        restarts = [s for s in res['stops'] if s['duration_hours'] == 34.0]
        self.assertGreaterEqual(len(restarts), 1)
        self.assertTrue(any('34-hour' in e['description'] for e in res['events']))

    def test_cycle_hours_reset_after_a_restart(self):
        route = build_route(2780.0, 50.5, geometry=[[40.71, -74.00], [34.05, -118.24]])
        res = calculate(route, cycle_hours=72.0)
        self.assertLess(res['summary']['final_cycle_hours'], 70.0)

    def test_fuel_stops_never_exceed_the_thousand_mile_interval(self):
        route = build_route(3200.0, 58.2, geometry=[[40.71, -74.00], [34.05, -118.24]])
        res = calculate(route)
        fuel_stops = [s for s in res['stops'] if s['type'] == 'fuel']
        self.assertGreaterEqual(len(fuel_stops), 3)

        interval = 0.0
        for event in res['events']:
            if event['status'] == 'driving':
                interval += event['duration_hours'] * HOSEngine.SPEED_MPH
                self.assertLessEqual(
                    round(interval, 1),
                    HOSEngine.FUEL_INTERVAL_MILES + 1.0,
                    "The engine drove more than 1,000 miles between fuel stops",
                )
            elif event['description'].startswith('Fueling'):
                interval = 0.0

    def test_recap_never_reports_more_than_seventy_hours_in_eight_days(self):
        route = build_route(2780.0, 50.5, geometry=[[40.71, -74.00], [34.05, -118.24]])
        res = calculate(route, cycle_hours=60.0)
        for day in res['daily_logs']:
            self.assertLessEqual(day['recap']['total_8_days'], 70.01)
            self.assertGreaterEqual(day['recap']['available_tomorrow'], 0.0)


class CanvasRenderingTestCase(TestCase):
    """The canvas payload is what the driver actually signs."""

    def test_polyline_covers_the_full_twenty_four_hour_axis(self):
        route = build_route(1400.0, 25.4)
        res = calculate(route, start_time=datetime(2026, 3, 10, 22, 0))

        for day in res['daily_logs']:
            with self.subTest(day=day['day_number']):
                canvas = LogGenerator.format_log_for_canvas(
                    day, {'driver_name': 'Test Driver', 'carrier_name': 'Test Carrier LLC'}
                )
                horizontals = [
                    g for g in canvas['grid_lines'] if g['type'] == 'horizontal'
                ]
                self.assertTrue(horizontals)

                cursor = 0.0
                for segment in horizontals:
                    self.assertAlmostEqual(
                        segment['start_hours'],
                        cursor,
                        delta=0.02,
                        msg=(
                            f"Day {day['day_number']} polyline jumps from {cursor} "
                            f"to {segment['start_hours']}"
                        ),
                    )
                    cursor = segment['end_hours']
                self.assertAlmostEqual(
                    cursor,
                    24.0,
                    delta=0.02,
                    msg=f"Day {day['day_number']} polyline stops at {cursor}, not 24.0",
                )

    def test_canvas_totals_mirror_the_day_totals(self):
        route = build_route(800.0, 14.5)
        res = calculate(route, start_time=datetime(2026, 3, 10, 18, 0))
        for day in res['daily_logs']:
            canvas = LogGenerator.format_log_for_canvas(
                day, {'driver_name': 'Test Driver', 'carrier_name': 'Test Carrier LLC'}
            )
            self.assertEqual(canvas['totals'], day['totals'])
            self.assertEqual(canvas['recap'], day['recap'])

    def test_remarks_are_chronological_and_within_the_day(self):
        route = build_route(1400.0, 25.4)
        res = calculate(route, start_time=datetime(2026, 3, 10, 22, 0))
        for day in res['daily_logs']:
            times = [remark['time'] for remark in day['remarks']]
            self.assertEqual(times, sorted(times))
            for remark in day['remarks']:
                hours, minutes = (int(p) for p in remark['time'].split(':'))
                self.assertLessEqual(hours * 60 + minutes, DAY_MINUTES)
