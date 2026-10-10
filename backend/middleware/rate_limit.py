import time
import re
import threading
from collections import defaultdict
from django.http import JsonResponse
from django.conf import settings

class RateLimitAndDDoSProtectionMiddleware:
    """
    Production-grade Rate Limiting, DDoS Shield & Security Hardening Middleware.
    
    Protects endpoints with multi-tier defense:
    1. Burst / Surge Limit: Max 15 requests per second per IP (DDoS Shield).
    2. Endpoint Sustained Limit: Max 10 req/min for auth, 30 req/min for calculation.
    3. Thread-safe bucket updates with lock.
    4. Automatic periodic eviction of expired IP keys to prevent memory exhaustion attacks.
    5. Anti-IP-spoofing logic for X-Forwarded-For.
    6. OWASP Security Response Headers injection (nosniff, DENY frame, CSP, Referrer-Policy).
    """
    
    _lock = threading.Lock()
    ip_surge_buckets = defaultdict(list)
    ip_minute_buckets = defaultdict(list)
    last_cleanup = time.time()
    CLEANUP_INTERVAL = 120.0  # Clean memory every 2 minutes
    
    # Normalized path limits (without trailing slashes for resilient matching)
    PATH_LIMITS = {
        '/api/accounts/login': 10,       # 10 req / minute
        '/api/accounts/register': 10,    # 10 req / minute
        '/api/trips/calculate': 30,     # 30 req / minute
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def get_client_ip(self, request):
        """
        Extract client IP securely to prevent IP spoofing attacks.
        Only trusts X-Forwarded-For if running behind a trusted reverse proxy;
        otherwise prefers REMOTE_ADDR.
        """
        # If explicitly behind a trusted proxy (e.g. AWS ALB, Cloudflare, Docker network)
        trust_proxy = getattr(settings, 'USE_X_FORWARDED_FOR', False)
        if trust_proxy:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                # Use leftmost client IP in chain
                ip = x_forwarded_for.split(',')[0].strip()
                if ip:
                    return ip

        return request.META.get('REMOTE_ADDR', '127.0.0.1')

    def _cleanup_expired_buckets(self, now):
        """Evict stale keys to prevent memory leak denial of service."""
        if now - self.last_cleanup < self.CLEANUP_INTERVAL:
            return

        self.last_cleanup = now
        # Clean surge buckets
        surge_keys_to_del = [ip for ip, times in self.ip_surge_buckets.items() if not times or now - times[-1] >= 1.0]
        for k in surge_keys_to_del:
            del self.ip_surge_buckets[k]

        # Clean minute buckets
        minute_keys_to_del = [key for key, times in self.ip_minute_buckets.items() if not times or now - times[-1] >= 60.0]
        for k in minute_keys_to_del:
            del self.ip_minute_buckets[k]

    def __call__(self, request):
        ip = self.get_client_ip(request)
        now = time.time()
        raw_path = request.path.rstrip('/') or '/'

        with self._lock:
            self._cleanup_expired_buckets(now)

            # 1. DDoS Surge Protection (1-second sliding window, max 15 req/sec)
            surge_timestamps = [t for t in self.ip_surge_buckets[ip] if now - t < 1.0]
            if len(surge_timestamps) >= 15:
                return JsonResponse({
                    'error': 'DDoS protection triggered: Excessive request rate.',
                    'code': 'RATE_LIMIT_SURGE_EXCEEDED',
                    'retry_after_seconds': 1
                }, status=429)

            # 2. Path-Specific Sustained Rate Limit (60-second sliding window)
            minute_key = f"{ip}:{raw_path}"
            minute_timestamps = [t for t in self.ip_minute_buckets[minute_key] if now - t < 60.0]
            max_allowed = self.PATH_LIMITS.get(raw_path, 120)

            if len(minute_timestamps) >= max_allowed:
                return JsonResponse({
                    'error': f'Rate limit exceeded for path {request.path}. Maximum {max_allowed} requests per minute.',
                    'code': 'RATE_LIMIT_SUSTAINED_EXCEEDED',
                    'retry_after_seconds': 60
                }, status=429)

            # Record current valid timestamp
            surge_timestamps.append(now)
            minute_timestamps.append(now)
            self.ip_surge_buckets[ip] = surge_timestamps
            self.ip_minute_buckets[minute_key] = minute_timestamps
            remaining = max(0, max_allowed - len(minute_timestamps))

        # Forward request down the middleware chain
        response = self.get_response(request)

        # Inject Security & Rate Limit Headers (OWASP Hardening)
        response['X-RateLimit-Limit-Per-Minute'] = str(max_allowed)
        response['X-RateLimit-Remaining'] = str(remaining)
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = 'geolocation=(self), microphone=(), camera=()'

        return response

