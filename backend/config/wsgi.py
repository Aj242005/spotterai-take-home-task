import logging
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()

# On Vercel the database is /tmp/db.sqlite3, which is recreated empty for every
# new function instance. Without this, the first request served by a fresh
# instance fails with "no such table". Importing the WSGI module runs once per
# cold start, which is exactly when the schema needs to exist. Any failure is
# logged rather than raised so it cannot take down the whole deployment.
if os.environ.get('VERCEL'):
    from django.core.management import call_command

    try:
        call_command('migrate', interactive=False, verbosity=0)
    except Exception:
        logging.getLogger('django').exception(
            'Cold-start migrate failed; the API may be missing tables.'
        )
