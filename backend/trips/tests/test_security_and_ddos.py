import json
import time
from datetime import timedelta
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from middleware.rate_limit import RateLimitAndDDoSProtectionMiddleware

User = get_user_model()

class SecurityAndDDoSTestCase(TestCase):
    """
    Penetration Testing, DDoS Simulation, Session Hijacking & Vulnerability Verification.
    """

    def setUp(self):
        # Reset rate limiting buckets between tests
        RateLimitAndDDoSProtectionMiddleware.ip_surge_buckets.clear()
        RateLimitAndDDoSProtectionMiddleware.ip_minute_buckets.clear()
        self.client = Client()
        self.user = User.objects.create_user(
            username='security_test_driver',
            email='security_driver@spotter.ai',
            password='SecurePassword123!',
            driver_name='Security Driver',
            carrier_name='Secure Carrier LLC'
        )

    def test_ddos_surge_protection_triggers_429(self):
        """Simulate a DDoS rapid fire attack (>15 req/sec from single IP) and verify 429 response."""
        ip = '198.51.100.10'
        # Rapidly send 16 requests within 1 second
        responses = []
        for i in range(16):
            res = self.client.get('/api/health/', REMOTE_ADDR=ip)
            responses.append(res.status_code)

        # First 15 should pass (200), 16th MUST trigger 429 DDoS Surge limit
        self.assertEqual(responses[14], 200)
        self.assertEqual(responses[15], 429)
        self.assertEqual(self.client.get('/api/health/', REMOTE_ADDR=ip).status_code, 429)

    def test_sustained_rate_limiting_on_auth_endpoint(self):
        """Verify strict sustained rate limit of 10 req/min on /api/accounts/login/."""
        ip = '198.51.100.20'
        # Send 10 login requests (allowed), 11th should be blocked (429)
        statuses = []
        for i in range(11):
            # Slow down slightly to not hit 1-sec surge limit
            time.sleep(0.08)
            res = self.client.post('/api/accounts/login/', {
                'email': 'security_driver@spotter.ai',
                'password': 'WrongPassword!'
            }, content_type='application/json', REMOTE_ADDR=ip)
            statuses.append(res.status_code)

        # 11th request must receive 429
        self.assertEqual(statuses[-1], 429)

    def test_ip_spoofing_resistance(self):
        """Attacker sending fake X-Forwarded-For cannot evade rate limiting when behind direct connection."""
        real_ip = '203.0.113.50'
        statuses = []
        # Attacker tries to bypass by rotating fake X-Forwarded-For headers
        for i in range(16):
            fake_ip = f"10.0.0.{i}"
            res = self.client.get(
                '/api/health/',
                REMOTE_ADDR=real_ip,
                HTTP_X_FORWARDED_FOR=fake_ip
            )
            statuses.append(res.status_code)

        # Should still be rate-limited by real IP on the 16th request
        self.assertEqual(statuses[15], 429)

    def test_session_hijacking_tampered_jwt(self):
        """Forged or tampered JWT access token must be immediately rejected with 401."""
        refresh = RefreshToken.for_user(self.user)
        valid_token = str(refresh.access_token)
        
        # Tamper with the token signature (append 'tampered')
        tampered_token = valid_token[:-4] + "fake"

        res = self.client.get('/api/accounts/profile/', HTTP_AUTHORIZATION=f'Bearer {tampered_token}')
        self.assertEqual(res.status_code, 401)

    def test_refresh_token_rotation_and_replay_protection(self):
        """
        Verify Token Rotation & Blacklisting:
        Using an old refresh token after it was already rotated must fail (prevents replay/hijacking).
        """
        refresh = RefreshToken.for_user(self.user)
        initial_refresh_str = str(refresh)

        # Rotate refresh token
        res = self.client.post('/api/accounts/token/refresh/', {
            'refresh': initial_refresh_str
        }, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        new_refresh_str = data.get('refresh')
        self.assertIsNotNone(new_refresh_str)

        # Attempt to REPLAY the old refresh token (Session Hijack replay attack)
        replay_res = self.client.post('/api/accounts/token/refresh/', {
            'refresh': initial_refresh_str
        }, content_type='application/json')
        # SimpleJWT blacklisting must reject replayed token with 401
        self.assertEqual(replay_res.status_code, 401)

    def test_xss_payload_sanitization(self):
        """Malicious XSS script tags in trip inputs must be sanitized."""
        xss_payload = "<script>alert('xss_attack')</script>Dallas, TX"
        res = self.client.post('/api/trips/calculate/', {
            'current_location': xss_payload,
            'pickup_location': 'Houston, TX',
            'dropoff_location': 'Austin, TX',
            'driver_name': '<img src=x onerror=alert(1)>John'
        }, content_type='application/json')
        
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Verify script tag was stripped / escaped
        self.assertNotIn('<script>', data['meta']['current_location'])
        self.assertNotIn('<img', data['meta']['driver_name'])

    def test_owasp_security_headers_present(self):
        """Verify OWASP-mandated security headers are present on all API responses."""
        res = self.client.get('/api/health/')
        self.assertEqual(res['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(res['X-Frame-Options'], 'DENY')
        self.assertIn('X-RateLimit-Limit-Per-Minute', res)
        self.assertIn('X-RateLimit-Remaining', res)
