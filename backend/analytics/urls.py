from django.urls import path
from .views import HeuristicsView, AdminDashboardView

urlpatterns = [
    path('heuristics/', HeuristicsView.as_view(), name='analytics_heuristics'),
    path('dashboard/', AdminDashboardView.as_view(), name='analytics_dashboard'),
]
