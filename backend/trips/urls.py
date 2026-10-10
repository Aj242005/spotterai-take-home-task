from django.urls import path
from .views import CalculateTripView, TripListView, TripDetailView

urlpatterns = [
    path('calculate/', CalculateTripView.as_view(), name='trip_calculate'),
    path('history/', TripListView.as_view(), name='trip_history'),
    path('<int:pk>/', TripDetailView.as_view(), name='trip_detail'),
]
