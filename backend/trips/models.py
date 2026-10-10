from django.db import models
from django.conf import settings

class Trip(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trips',
        null=True,
        blank=True
    )
    title = models.CharField(max_length=255, blank=True, null=True)
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    current_cycle_hours = models.FloatField(default=0.0)
    
    # Carrier & Vehicle details recorded for log output
    driver_name = models.CharField(max_length=150, default='John Driver')
    carrier_name = models.CharField(max_length=255, default='Spotter Transport LLC')
    main_office_address = models.CharField(max_length=255, default='100 Logistics Way, Chicago, IL')
    home_terminal_address = models.CharField(max_length=255, default='500 Transport Blvd, Dallas, TX')
    truck_number = models.CharField(max_length=50, default='TRK-8801')
    trailer_number = models.CharField(max_length=50, default='TRL-9942')
    timezone_str = models.CharField(max_length=50, default='America/New_York')

    # Route & Schedule statistics
    total_distance_miles = models.FloatField(default=0.0)
    total_duration_hours = models.FloatField(default=0.0)
    total_driving_hours = models.FloatField(default=0.0)
    num_days = models.IntegerField(default=1)
    num_rest_stops = models.IntegerField(default=0)
    num_fuel_stops = models.IntegerField(default=0)

    # Polylines & Full JSON timeline
    route_geometry = models.TextField(blank=True, null=True)
    timeline_json = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Trip #{self.id}: {self.pickup_location} → {self.dropoff_location}"

class TripStop(models.Model):
    STOP_TYPES = (
        ('pickup', 'Pickup Location'),
        ('dropoff', 'Dropoff Location'),
        ('rest', '10-Hour Mandatory Rest'),
        ('break', '30-Minute Rest Break'),
        ('fuel', 'Fuel Stop (1,000 mi)'),
    )

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='stops')
    stop_type = models.CharField(max_length=20, choices=STOP_TYPES)
    location_name = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    arrival_time = models.CharField(max_length=50)
    departure_time = models.CharField(max_length=50)
    duration_hours = models.FloatField(default=0.5)
    reason = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.get_stop_type_display()} at {self.location_name}"

class DailyLog(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='daily_logs')
    day_number = models.IntegerField()
    date_str = models.CharField(max_length=50)
    total_miles = models.FloatField(default=0.0)
    
    off_duty_hours = models.FloatField(default=0.0)
    sleeper_hours = models.FloatField(default=0.0)
    driving_hours = models.FloatField(default=0.0)
    on_duty_hours = models.FloatField(default=0.0)
    
    events = models.JSONField(default=list)
    remarks = models.JSONField(default=list)
    recap = models.JSONField(default=dict)

    class Meta:
        ordering = ['day_number']

    def __str__(self):
        return f"Day {self.day_number} ({self.date_str}) - Trip #{self.trip_id}"
