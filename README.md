# Spotter AI — FMCSA ELD HOS Route Planner & Daily Log Sheet Generator

A production-grade, full-stack web application designed for property-carrying commercial truck drivers and logistics dispatchers. It calculates FMCSA-compliant driving schedules and dynamically renders pixel-perfect **Driver's Daily Log Sheets** (§ 395) with interactive maps, PDF export, token-rotated authentication, and fleet analytics.

---

## Key Features

1. **FMCSA Hours of Service (HOS) Engine (§ 395)**:
   - **11-Hour Driving Limit**: Mandates 10 consecutive hours off duty after 11 hours of driving.
   - **14-Hour Duty Window**: Prevents driving after 14 consecutive hours from coming on duty.
   - **30-Minute Rest Break**: Automatically schedules a 30-minute rest break after 8 cumulative hours of driving.
   - **70-Hour / 8-Day Cycle**: Enforces rolling 70-hour cycle limits and schedules 34-hour restarts when exceeded.
   - **Fueling Intervals**: Inserts mandatory 30-minute fuel stops every 1,000 miles.
   - **Terminal Operations**: Allocates 1 hour On Duty Not Driving for loading (pickup) and unloading (dropoff).

2. **Pixel-Perfect HTML5 Canvas Log Sheet Generator**:
   - Renders the official 24-hour graph grid (Midnight to Midnight) with 15-minute subdivisions.
   - Continuous duty status lines (Off Duty, Sleeper Berth, Driving, On Duty Not Driving).
   - Dynamic Total Hours calculation (guaranteed 24.0 hours sum per day).
   - Remarks table formatted as `"HH:MM - Location, Activity"`.
   - 70-Hour / 8-Day Recap table showing on-duty history and hours available tomorrow.
   - **Export Capabilities**: One-click export to PNG image, multi-page combined PDF, or direct printing.

3. **Carrier & Vehicle Customization**:
   - Customizable Carrier Name, Driver Name, Main Office Address, Home Terminal Address, Truck Number, and Trailer Number.
   - Automatic local timezone detection from browser context.

4. **Security, Rate Limiting & Token Rotation**:
   - Custom sliding-window **DDoS Protection Shield** (max 15 req/sec).
   - Per-endpoint rate limiting (10 req/min for auth, 30 req/min for calculation).
   - Robust JWT Authentication with automatic refresh token rotation and blacklisting.

5. **Fleet Analytics & AI Heuristics Engine**:
   - Driving efficiency score rating (S-Tier / A-Tier / B-Tier).
   - Optimal departure window calculation to bypass metropolitan traffic congestion.
   - Grouped fuel & rest stop savings projections.
   - Administrator dashboard with fleet mileage totals and audit history.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.12, Django 5.1, Django REST Framework, SimpleJWT |
| **Frontend** | React 18, Vite, Vanilla CSS (Dark Glassmorphism Design System) |
| **Maps & Routing** | OpenStreetMap via Leaflet, OpenRouteService API, Nominatim Geocoding |
| **Export Engines** | HTML5 Canvas API, jsPDF, html2canvas |
| **Containerization** | Docker (Multi-stage), Docker Compose |

---

## Project Structure

```
Spotter AI/
├── backend/
│   ├── config/                  # Django settings, URLs, WSGI, JWT config
│   ├── accounts/                # User authentication & token rotation app
│   ├── trips/                   # Core HOS engine, routing & daily log apps
│   │   ├── services/
│   │   │   ├── route_service.py # Nominatim & OSRM routing
│   │   │   ├── hos_engine.py    # FMCSA HOS simulation engine
│   │   │   └── log_generator.py # Canvas grid coordinate builder
│   ├── analytics/               # Predictive heuristics & admin dashboard app
│   ├── middleware/
│   │   └── rate_limit.py        # DDoS shield & rate limiting middleware
│   ├── db.sqlite3               # SQLite database
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TripForm.jsx           # Location & carrier input form
│   │   │   ├── RouteMap.jsx           # Leaflet route & stop marker map
│   │   │   ├── ELDLogSheet.jsx        # HTML5 Canvas log sheet
│   │   │   ├── LogSheetCarousel.jsx   # Multi-day carousel navigation
│   │   │   ├── TripSummary.jsx        # Route metrics dashboard
│   │   │   ├── AnalyticsDashboard.jsx # AI heuristics & admin stats
│   │   │   └── AuthModal.jsx          # JWT Login & Register modal
│   │   ├── utils/
│   │   │   └── eldCanvas.js           # Canvas drawing renderer
│   │   ├── services/
│   │   │   └── api.js                 # Axios client with JWT refresh interceptor
│   │   ├── App.jsx
│   │   └── index.css                  # Dark glassmorphism styling
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Getting Started (Local Development)

### Prerequisites
- Python 3.12+
- Node.js 18+

### 1. Backend Setup (Django)

```bash
cd backend
python -m venv venv

# On Windows PowerShell:
.\venv\Scripts\activate

# Install dependencies:
pip install -r requirements.txt

# Run migrations:
python manage.py migrate

# Run unit tests:
python manage.py test trips

# Start backend server:
python manage.py runserver 8000
```

The Django API server will run at `http://localhost:8000/api`.

### 2. Frontend Setup (React / Vite)

```bash
cd frontend

# Install dependencies:
npm install

# Start Vite development server:
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## API Endpoints

### Authentication
- `POST /api/accounts/register/` — Register new driver/carrier account
- `POST /api/accounts/login/` — Authenticate and obtain JWT access & refresh tokens
- `POST /api/accounts/token/refresh/` — Rotate refresh token for new access token
- `GET /api/accounts/profile/` — Retrieve user profile details

### Trips & HOS Calculation
- `POST /api/trips/calculate/` — Calculate driving route, HOS schedule & daily logs
- `GET /api/trips/history/` — List saved trips for authenticated user
- `GET /api/trips/<id>/` — Retrieve details for a specific trip

### Analytics & Heuristics
- `GET /api/analytics/heuristics/` — Get AI route optimization heuristics & recommendations
- `GET /api/analytics/dashboard/` — Get administrator fleet metrics and audit logs

---

## Docker & Production Deployment

To run the complete application inside a single production container using Docker Compose:

```bash
docker-compose up --build
```

Access the application at `http://localhost:8000`.

---

## License

Created for Spotter AI Technical Assessment © 2026. All rights reserved.
