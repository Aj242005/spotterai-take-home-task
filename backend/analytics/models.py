from django.db import models
from django.conf import settings
from trips.models import Trip

class TripAnalytics(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='analytics')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    
    distance_miles = models.FloatField()
    total_hours = models.FloatField()
    driving_hours = models.FloatField()
    rest_stops_count = models.IntegerField(default=0)
    fuel_stops_count = models.IntegerField(default=0)
    
    initial_cycle_used = models.FloatField(default=0.0)
    final_cycle_used = models.FloatField(default=0.0)
    efficiency_score = models.FloatField(default=0.0)  # 0 to 100 rating
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Analytics for Trip #{self.trip_id} (Score: {self.efficiency_score}%)"

class SystemMetrics(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)
    total_trips_calculated = models.IntegerField(default=0)
    active_users_count = models.IntegerField(default=0)
    rate_limits_triggered = models.IntegerField(default=0)
    avg_calculation_ms = models.FloatField(default=0.0)

    class Meta:
        ordering = ['-timestamp']
