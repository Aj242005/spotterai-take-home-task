from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({
        'status': 'healthy',
        'service': 'ELD Trip Planner API',
        'version': '1.0.0',
        'rate_limiting': 'enabled',
        'hos_engine': 'active'
    })

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health_check'),
    path('api/accounts/', include('accounts.urls')),
    path('api/trips/', include('trips.urls')),
    path('api/analytics/', include('analytics.urls')),
]
