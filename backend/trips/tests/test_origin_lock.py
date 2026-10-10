"""Verifies that the origin allowlist holds for callers that ignore CORS.

Requesting with an explicit HTTP_ORIGIN is what a browser does. Requesting with
none is what curl, Postman and a scraper do -- those clients never consult the
CORS headers, so the middleware is the only thing standing between them and the
API, and these tests drive that path deliberately.
"""

from django.test import Client, TestCase, override_settings

FRONTEND = 'https://spotterai-web.vercel.app'
PREVIEW = 'https://spotterai-web-git-main-akshitjain.vercel.app'
ATTACKER = 'https://evil.example'


@override_settings(
    API_ORIGIN_LOCK_STRICT=True,
    ALLOWED_ORIGINS=[FRONTEND],
    ALLOWED_ORIGIN_REGEXES=[r'^https://spotterai-web-[a-z0-9-]+\.vercel\.app$'],
    API_ORIGIN_LOCKED_PREFIXES=('/api/',),
)
class OriginLockStrictTestCase(TestCase):
    """Production behaviour: the lock is on."""

    def setUp(self):
        self.client = Client()

    def test_frontend_origin_is_served(self):
        res = self.client.get('/api/health/', HTTP_ORIGIN=FRONTEND)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get('Access-Control-Allow-Origin'), FRONTEND)

    def test_preview_deployment_origin_is_served(self):
        """Vercel mints a hostname per branch, so previews must still work."""
        res = self.client.get('/api/health/', HTTP_ORIGIN=PREVIEW)
        self.assertEqual(res.status_code, 200)

    def test_foreign_origin_is_refused(self):
        res = self.client.get('/api/health/', HTTP_ORIGIN=ATTACKER)
        self.assertEqual(res.status_code, 403)
        self.assertNotIn('Access-Control-Allow-Origin', res.headers)

    def test_lookalike_vercel_origin_is_refused(self):
        res = self.client.get('/api/health/', HTTP_ORIGIN='https://spotterai.evil.vercel.app')
        self.assertEqual(res.status_code, 403)

    def test_request_with_no_origin_is_refused(self):
        """curl and Postman send no Origin at all."""
        self.assertEqual(self.client.get('/api/health/').status_code, 403)

    def test_preflight_from_a_foreign_origin_is_refused(self):
        """A preflight is the browser's first move, so it must not get an empty 200."""
        res = self.client.options(
            '/api/trips/calculate/',
            HTTP_ORIGIN=ATTACKER,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
        )
        self.assertEqual(res.status_code, 403)

    def test_preflight_from_the_frontend_origin_is_answered(self):
        res = self.client.options(
            '/api/trips/calculate/',
            HTTP_ORIGIN=FRONTEND,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get('Access-Control-Allow-Origin'), FRONTEND)

    def test_refusal_varies_on_origin(self):
        """The refusal is origin-dependent, so it must not be cached for a good caller."""
        res = self.client.get('/api/health/', HTTP_ORIGIN=ATTACKER)
        self.assertIn('Origin', res.headers.get('Vary', ''))

    def test_write_endpoint_is_refused_from_a_foreign_origin(self):
        res = self.client.post(
            '/api/trips/calculate/',
            data='{}',
            content_type='application/json',
            HTTP_ORIGIN=ATTACKER,
        )
        self.assertEqual(res.status_code, 403)

    def test_write_endpoint_accepts_the_frontend_origin(self):
        """The lock must not be so tight that it blocks the real app."""
        res = self.client.post(
            '/api/trips/calculate/',
            data='{}',
            content_type='application/json',
            HTTP_ORIGIN=FRONTEND,
        )
        self.assertNotEqual(res.status_code, 403)

    def test_admin_is_outside_the_locked_prefix(self):
        res = self.client.get('/admin/login/', HTTP_ORIGIN=ATTACKER)
        self.assertNotEqual(res.status_code, 403)


@override_settings(
    API_ORIGIN_LOCK_STRICT=False,
    ALLOWED_ORIGINS=[FRONTEND],
    ALLOWED_ORIGIN_REGEXES=[r'^https://spotterai-web-[a-z0-9-]+\.vercel\.app$'],
    API_ORIGIN_LOCKED_PREFIXES=('/api/',),
)
class OriginLockLocalDevTestCase(TestCase):
    """Off Vercel the lock stays out of the way of local tools and the suite."""

    def test_originless_request_is_allowed(self):
        self.assertEqual(Client().get('/api/health/').status_code, 200)

    def test_foreign_origin_is_still_refused(self):
        """Relaxing the no-Origin rule must not relax the allowlist itself."""
        res = Client().get('/api/health/', HTTP_ORIGIN=ATTACKER)
        self.assertEqual(res.status_code, 403)
