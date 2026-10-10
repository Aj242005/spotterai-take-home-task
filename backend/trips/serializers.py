from rest_framework import serializers
from .models import Trip, TripStop, DailyLog

import html
import re

def sanitize_string(value: str) -> str:
    """Strip dangerous characters and escape HTML to prevent XSS attacks."""
    if not value:
        return value
    # Strip script tags, event handlers, and escape
    cleaned = re.sub(r'<\s*script[^>]*>.*?<\s*/\s*script\s*>', '', value, flags=re.IGNORECASE)
    cleaned = re.sub(r'javascript:', '', cleaned, flags=re.IGNORECASE)
    cleaned = html.escape(cleaned.strip())
    return cleaned

class CalculateTripRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=255, default='Dallas, TX')
    pickup_location = serializers.CharField(max_length=255, default='Houston, TX')
    dropoff_location = serializers.CharField(max_length=255, default='Atlanta, GA')
    current_cycle_hours = serializers.FloatField(min_value=0.0, max_value=70.0, default=0.0)
    
    # Optional customizable carrier & driver inputs
    driver_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    carrier_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    main_office_address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    home_terminal_address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    truck_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    trailer_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    timezone_str = serializers.CharField(max_length=50, required=False, default='America/New_York')

    def validate_current_location(self, value):
        return sanitize_string(value)

    def validate_pickup_location(self, value):
        return sanitize_string(value)

    def validate_dropoff_location(self, value):
        return sanitize_string(value)

    def validate_driver_name(self, value):
        return sanitize_string(value)

    def validate_carrier_name(self, value):
        return sanitize_string(value)

    def validate_main_office_address(self, value):
        return sanitize_string(value)

    def validate_home_terminal_address(self, value):
        return sanitize_string(value)

    def validate_truck_number(self, value):
        return sanitize_string(value)

    def validate_trailer_number(self, value):
        return sanitize_string(value)


class TripStopSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripStop
        fields = '__all__'

class DailyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyLog
        fields = '__all__'

class TripSerializer(serializers.ModelSerializer):
    stops = TripStopSerializer(many=True, read_only=True)
    daily_logs = DailyLogSerializer(many=True, read_only=True)

    class Meta:
        model = Trip
        fields = '__all__'

class TripListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = (
            'id', 'current_location', 'pickup_location', 'dropoff_location',
            'current_cycle_hours', 'total_distance_miles', 'total_duration_hours',
            'total_driving_hours', 'num_days', 'created_at', 'driver_name', 'carrier_name'
        )
