# =========================================================
# Stage 1: Build React Frontend
# =========================================================
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# =========================================================
# Stage 2: Django Backend API & Production Server
# =========================================================
FROM python:3.12-slim AS web
WORKDIR /app

# Prevent Python from writing .pyc files & enable unbuffered stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./staticfiles/frontend

# Collect static files and run database migrations
RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]

# =========================================================
# Stage 3: Caddy edge — public HTTPS entry (DuckDNS)
#
# Terminates TLS for the DuckDNS domain, reverse-proxies /api and /admin to
# the Django container, and serves the built SPA itself. Select this stage
# with `--target edge` (docker-compose does).
# =========================================================
FROM caddy:2-alpine AS edge
COPY --from=frontend-build /app/frontend/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
