"""Server-side origin allowlist for the JSON API.

CORS is a browser-side convention. The response headers tell a browser whether
to hand a cross-origin response to page JavaScript, but the request still
reaches the server, and a caller that is not a browser -- curl, Postman, a
scraper -- reads the response without ever consulting them. Declaring the
allowlist in CORS_ALLOWED_ORIGINS is therefore necessary but not sufficient:
it stops other sites reading this API from a browser tab, not other sites
calling it.

This middleware applies the same allowlist where it cannot be ignored, so the
promise "only the frontend can call this API" holds past the browser.

What it does not do: authenticate. An Origin header is supplied by the client,
so a determined caller can copy the frontend's value. This raises the bar
against drive-by requests and scanners, which is most of what hits a public
endpoint; genuine access control needs a credential the caller cannot guess.
"""

import re

from django.conf import settings
from django.http import JsonResponse
from django.utils.cache import patch_vary_headers

DEFAULT_LOCKED_PREFIXES = ('/api/',)


class OriginLockMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self._is_locked(request) and not self._is_allowed(request):
            response = JsonResponse(
                {
                    'error': 'Origin not allowed',
                    'detail': 'This API only serves the Spotter AI frontend.',
                },
                status=403,
            )
            # Whether this response is correct depends on the Origin header, so a
            # shared cache must not hand the refusal to an allowed caller.
            patch_vary_headers(response, ('Origin',))
            return response

        return self.get_response(request)

    def _is_locked(self, request):
        prefixes = getattr(settings, 'API_ORIGIN_LOCKED_PREFIXES', DEFAULT_LOCKED_PREFIXES)
        return request.path.startswith(tuple(prefixes))

    def _is_allowed(self, request):
        origin = request.META.get('HTTP_ORIGIN', '').rstrip('/')

        if not origin:
            # Nothing was sent to compare against: either a non-browser client or
            # a same-origin navigation. Only a strict lock refuses these, because
            # off Vercel they are the local dev server, curl and the test suite.
            return not getattr(settings, 'API_ORIGIN_LOCK_STRICT', False)

        if origin in tuple(getattr(settings, 'ALLOWED_ORIGINS', ())):
            return True

        return any(
            re.match(pattern, origin)
            for pattern in getattr(settings, 'ALLOWED_ORIGIN_REGEXES', ())
        )
