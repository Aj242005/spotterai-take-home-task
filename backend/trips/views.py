from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction

from .serializers import (
    CalculateTripRequestSerializer,
    TripSerializer,
    TripListSerializer
)
from .models import Trip, TripStop, DailyLog
from .services.route_service import RouteService
from .services.hos_engine import HOSEngine
from .services.log_generator import LogGenerator
from analytics.models import TripAnalytics


def resolve_stop_coordinates(stops, geometry, total_miles, waypoints):
    """
    Place every en-route stop at the mile it actually happens at.

    TripStops used to be written with the pickup's coordinates for every stop
    that was not a dropoff, and the map then guessed marker positions by index.
    Rest and fuel stops therefore sat nowhere near the road. Each stop now
    carries the odometer reading recorded by the HOS engine, which is
    interpolated onto the routed polyline here.
    """
    fallbacks = {
        'pickup': (waypoints[1][0], waypoints[1][1]) if len(waypoints) > 1 else None,
        'dropoff': (waypoints[2][0], waypoints[2][1]) if len(waypoints) > 2 else None,
        'origin': (waypoints[0][0], waypoints[0][1]) if waypoints else None,
    }

    resolved = []
    for stop in stops:
        point = None
        if stop.get('cumulative_miles') is not None:
            point = RouteService.point_at_distance(
                geometry, stop['cumulative_miles'], total_miles
            )
        if point is None:
            point = fallbacks.get(stop['type']) or fallbacks['origin'] or (0.0, 0.0)
        resolved.append({
            **stop,
            'latitude': round(float(point[0]), 5),
            'longitude': round(float(point[1]), 5),
        })
    return resolved


class CalculateTripView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = CalculateTripRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        curr_loc_str = data['current_location']
        pickup_loc_str = data['pickup_location']
        dropoff_loc_str = data['dropoff_location']
        cycle_hours = data.get('current_cycle_hours', 0.0)

        # Retrieve user default settings if authenticated and not overridden
        user = request.user if request.user.is_authenticated else None
        driver_name = data.get('driver_name') or (user.driver_name if user else 'John Driver')
        carrier_name = data.get('carrier_name') or (user.carrier_name if user else 'Spotter Transport LLC')
        main_office = data.get('main_office_address') or (user.main_office_address if user else '100 Logistics Way, Chicago, IL')
        home_terminal = data.get('home_terminal_address') or (user.home_terminal_address if user else '500 Transport Blvd, Dallas, TX')
        truck_num = data.get('truck_number') or (user.truck_number if user else 'TRK-8801')
        trailer_num = data.get('trailer_number') or (user.trailer_number if user else 'TRL-9942')

        # 1. Geocode locations
        geo_curr = RouteService.geocode(curr_loc_str)
        geo_pickup = RouteService.geocode(pickup_loc_str)
        geo_dropoff = RouteService.geocode(dropoff_loc_str)

        waypoints = [
            (geo_curr['lat'], geo_curr['lng'], geo_curr['display_name']),
            (geo_pickup['lat'], geo_pickup['lng'], geo_pickup['display_name']),
            (geo_dropoff['lat'], geo_dropoff['lng'], geo_dropoff['display_name']),
        ]

        # 2. Get route statistics & geometry
        route_info = RouteService.get_route(waypoints)

        # 3. Execute HOS Engine simulation
        hos_result = HOSEngine.calculate_trip_schedule({
            'current_location': geo_curr['display_name'],
            'pickup_location': geo_pickup['display_name'],
            'dropoff_location': geo_dropoff['display_name'],
            'current_cycle_hours': cycle_hours,
            'route_info': route_info
        })

        summary = hos_result['summary']
        daily_logs_raw = hos_result['daily_logs']
        geometry = hos_result['geometry']
        stops_raw = resolve_stop_coordinates(
            hos_result['stops'], geometry, summary['total_distance_miles'], waypoints
        )
        # The persisted timeline is what the history view replays, so it stores
        # the resolved coordinates rather than the raw placeholders.
        hos_result['stops'] = stops_raw

        trip_meta = {
            'driver_name': driver_name,
            'carrier_name': carrier_name,
            'main_office_address': main_office,
            'home_terminal_address': home_terminal,
            'truck_number': truck_num,
            'trailer_number': trailer_num,
            'current_location': geo_curr['display_name'],
            'dropoff_location': geo_dropoff['display_name']
        }

        # 4. Generate canvas-ready formatted log sheets for each day
        formatted_daily_logs = []
        for dl in daily_logs_raw:
            canvas_data = LogGenerator.format_log_for_canvas(dl, trip_meta)
            formatted_daily_logs.append({
                'day_number': dl['day_number'],
                'date_str': dl['date_str'],
                'total_miles': dl['total_miles'],
                'totals': dl['totals'],
                'events': dl['events'],
                'remarks': dl['remarks'],
                'recap': dl['recap'],
                'canvas_data': canvas_data
            })

        # 5. Persist trip in database
        with transaction.atomic():
            trip = Trip.objects.create(
                user=user,
                title=f"{geo_pickup['display_name']} → {geo_dropoff['display_name']}",
                current_location=geo_curr['display_name'],
                pickup_location=geo_pickup['display_name'],
                dropoff_location=geo_dropoff['display_name'],
                current_cycle_hours=cycle_hours,
                driver_name=driver_name,
                carrier_name=carrier_name,
                main_office_address=main_office,
                home_terminal_address=home_terminal,
                truck_number=truck_num,
                trailer_number=trailer_num,
                timezone_str=data.get('timezone_str', 'America/New_York'),
                total_distance_miles=summary['total_distance_miles'],
                total_duration_hours=summary['total_duration_hours'],
                total_driving_hours=summary['total_driving_hours'],
                num_days=summary['num_days'],
                num_rest_stops=summary['num_rest_stops'],
                num_fuel_stops=summary['num_fuel_stops'],
                route_geometry=str(geometry),
                timeline_json=hos_result
            )

            # Create stop objects
            for s in stops_raw:
                TripStop.objects.create(
                    trip=trip,
                    stop_type=s['type'],
                    location_name=s['location_name'],
                    latitude=s['latitude'],
                    longitude=s['longitude'],
                    arrival_time=s['arrival_time'],
                    departure_time=s['departure_time'],
                    duration_hours=s['duration_hours'],
                    reason=s['reason']
                )

            # Create daily log objects
            for fdl in formatted_daily_logs:
                DailyLog.objects.create(
                    trip=trip,
                    day_number=fdl['day_number'],
                    date_str=fdl['date_str'],
                    total_miles=fdl['total_miles'],
                    off_duty_hours=fdl['totals']['off_duty'],
                    sleeper_hours=fdl['totals']['sleeper_berth'],
                    driving_hours=fdl['totals']['driving'],
                    on_duty_hours=fdl['totals']['on_duty_not_driving'],
                    events=fdl['events'],
                    remarks=fdl['remarks'],
                    recap=fdl['recap']
                )

            # Record Analytics for heuristic insight engine
            TripAnalytics.objects.create(
                trip=trip,
                user=user,
                distance_miles=summary['total_distance_miles'],
                total_hours=summary['total_duration_hours'],
                driving_hours=summary['total_driving_hours'],
                rest_stops_count=summary['num_rest_stops'],
                fuel_stops_count=summary['num_fuel_stops'],
                initial_cycle_used=cycle_hours,
                final_cycle_used=summary['final_cycle_hours'],
                efficiency_score=min(100.0, round(100.0 * (summary['total_driving_hours'] / max(1.0, summary['total_duration_hours'] - summary['num_rest_stops'] * 10.0)), 1))
            )

        return Response({
            'trip_id': trip.id,
            'summary': summary,
            'meta': trip_meta,
            'waypoints': {
                'current': geo_curr,
                'pickup': geo_pickup,
                'dropoff': geo_dropoff
            },
            'stops': stops_raw,
            'daily_logs': formatted_daily_logs,
            'route_geometry': geometry,
            'message': 'Trip calculated successfully.'
        }, status=status.HTTP_200_OK)

class TripListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = TripListSerializer

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Trip.objects.filter(user=self.request.user)
        # Anonymous visitors see the anonymous demo trips only. Returning
        # Trip.objects.all() here exposed every registered carrier's routes,
        # driver names and terminal addresses to anyone who opened the page.
        return Trip.objects.filter(user__isnull=True).order_by('-created_at')[:20]

class TripDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        try:
            trip = Trip.objects.get(pk=pk)
        except Trip.DoesNotExist:
            return Response({'error': 'Trip not found.'}, status=status.HTTP_404_NOT_FOUND)

        # A trip owned by an account is private to that account. Unauthenticated
        # demo trips (user is null) stay readable so the public planner works.
        if trip.user_id is not None:
            if not request.user.is_authenticated or request.user.id != trip.user_id:
                return Response({'error': 'Trip not found.'}, status=status.HTTP_404_NOT_FOUND)

        timeline = trip.timeline_json or {}
        summary = timeline.get('summary', {
            'total_distance_miles': trip.total_distance_miles,
            'total_duration_hours': trip.total_duration_hours,
            'total_driving_hours': trip.total_driving_hours,
            'num_days': trip.num_days,
            'num_rest_stops': trip.num_rest_stops,
            'num_fuel_stops': trip.num_fuel_stops,
            'final_cycle_hours': trip.current_cycle_hours,
        })
        stops_raw = timeline.get('stops', [])
        geometry = timeline.get('geometry', [])
        daily_logs_raw = timeline.get('daily_logs', [])

        trip_meta = {
            'driver_name': trip.driver_name,
            'carrier_name': trip.carrier_name,
            'main_office_address': trip.main_office_address,
            'home_terminal_address': trip.home_terminal_address,
            'truck_number': trip.truck_number,
            'trailer_number': trip.trailer_number,
            'current_location': trip.current_location,
            'dropoff_location': trip.dropoff_location,
        }

        geo_curr = RouteService.geocode(trip.current_location)
        geo_pickup = RouteService.geocode(trip.pickup_location)
        geo_dropoff = RouteService.geocode(trip.dropoff_location)

        formatted_daily_logs = []
        for dl in daily_logs_raw:
            canvas_data = LogGenerator.format_log_for_canvas(dl, trip_meta)
            formatted_daily_logs.append({
                'day_number': dl.get('day_number', 1),
                'date_str': dl.get('date_str', ''),
                'total_miles': dl.get('total_miles', 0.0),
                'totals': dl.get('totals', {}),
                'events': dl.get('events', []),
                'remarks': dl.get('remarks', []),
                'recap': dl.get('recap', {}),
                'canvas_data': canvas_data
            })

        return Response({
            'trip_id': trip.id,
            'summary': summary,
            'meta': trip_meta,
            'waypoints': {
                'current': geo_curr,
                'pickup': geo_pickup,
                'dropoff': geo_dropoff
            },
            'stops': stops_raw,
            'daily_logs': formatted_daily_logs,
            'route_geometry': geometry,
            'message': 'Trip loaded successfully.'
        }, status=status.HTTP_200_OK)

