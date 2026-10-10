import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# Vercel sets VERCEL=1 inside its build and function environments. We use it to
# pick safe production defaults without having to remember to set every var.
ON_VERCEL = bool(os.environ.get('VERCEL'))

# The real key comes from DJANGO_SECRET_KEY in production. The fallback only
# exists so a fresh local checkout runs; it must never sign production tokens.
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-spotter-eld-planner-secret-key-local-dev-only',
)

# Debug defaults on for local work and off on Vercel, where a public stack trace
# is a disclosure bug rather than a convenience.
DEBUG = os.environ.get('DJANGO_DEBUG', 'False' if ON_VERCEL else 'True') == 'True'

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party packages
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',

    # Local apps
    'accounts',
    'trips',
    'analytics',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'middleware.rate_limit.RateLimitAndDDoSProtectionMiddleware',  # Custom DDoS & Rate limiting
    'django.middleware.security.SecurityMiddleware',
    # Serves STATIC_ROOT (admin assets, collected frontend) under DEBUG=False.
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'staticfiles', 'frontend')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Vercel Functions mount the deployment read-only; only /tmp is writable, and
# /tmp is wiped between cold starts. SQLite therefore still works, but the data
# belongs to one instance and does not survive a cold start.
DB_NAME = os.environ.get(
    'DJANGO_DB_PATH',
    '/tmp/db.sqlite3' if ON_VERCEL else str(BASE_DIR / 'db.sqlite3'),
)

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': DB_NAME,
    }
}

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles_collected')
# The built frontend is not in the repository (it is a build artifact), so this
# directory is absent on a clean Vercel build. Filtering it keeps collectstatic
# from warning about — or failing on — a path that only exists on a dev machine.
STATICFILES_DIRS = [
    d for d in [os.path.join(BASE_DIR, 'staticfiles', 'frontend')]
    if os.path.isdir(d)
]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),
}

# Simple JWT Configuration with Token Rotation & Strict Session Expiry
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS Configuration
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Security Headers & Protections
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Behind the Caddy edge (Docker/DuckDNS) Django must trust X-Forwarded-Proto,
# or it will redirect HTTPS requests back to HTTP. Off by default so a direct
# :8000 connection cannot spoof it; docker-compose sets BEHIND_PROXY=True.
if os.environ.get('BEHIND_PROXY') == 'True':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    USE_X_FORWARDED_HOST = True

