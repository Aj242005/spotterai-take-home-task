# Spotter AI — Demo Run-of-Show

A scene-by-scene script for presenting or recording the site. Every button label
below is the literal text on screen, so you can follow it without re-reading this
mid-take.

---

## 0. Before you record

Two terminals, both from the project root:

```bash
# Terminal 1 — API (port 8000)
cd backend
venv\Scripts\python manage.py runserver

# Terminal 2 — site (port 5173)
cd frontend
npm run dev
```

Open **http://127.0.0.1:5173** in the browser panel. Wait for the 3D board to
finish its first paint (the header lamp reads "Engine ready").

**On camera, avoid:** signing in (needs an account you'd have to create live) and
spamming **Plot the course** (the API rate-limits rapid calculations — wait a few
seconds between plots).

---

## Scene 1 — 0:00 · The instrument (landing)

**On screen:** a printed orienteering sheet. Terrain in flat colour, the route as a
purple course line with numbered control circles, a legend and a scale bar. A 3D
relief board floats above the print.

**Do:** move the mouse slowly across the board — it drifts on parallax (the board is
rigid; the camera moves). Scroll down past the hero.

**Say:** *"This is not a dashboard. Every surface here is printed-map notation,
because the thing this product produces is a printed artifact a driver signs and an
auditor reads."*

**Click:** the hero preset **COAST TO COAST · NY → LA**, then **PLOT THE COURSE**.

**Watch for:** the course line *draws itself* across the sheet left-to-right, the
control numbers appear in order, and the header scale strip counts up (course miles,
controls, sheets, cycle after). This is the money shot — don't cut away until the
placard at the bottom settles.

---

## Scene 2 — ~0:45 · The sheet the trip produces

**On screen:** below the board — **COURSE STATISTICS**, **SYMBOL TABLE**, the
**CONTROL DESCRIPTION SHEET**, and the **RECORDER STRIP**.

**Do:**
1. Click **Sheet 2** above the board, then back to **Sheet 1** — each day of the
   trip is its own midnight-to-midnight sheet.
2. Point at the **SYMBOL TABLE** row colors: driving is the reserved purple,
   sleeper berth is water-blue, on-duty is open-land yellow, off-duty is white.
   Same four colors as the terrain — that's the whole visual system.
3. Scroll to the **RECORDER STRIP**: *"Where the pen sat, to the minute — this is
   the event stream the sheet is drawn from, not a summary of it."*

**Say:** *"Controls sit at the mile they actually happen at on the routed line —
the fuel stop at 1,185 miles, the shift reset at 522 — not at the pickup and
dropoff."*

---

## Scene 3 — ~1:30 · Measured, not claimed (the placard)

**On screen:** the **§ 395 placard** — 11-hour driving limit, 14-hour duty window,
fuel interval, 70-hour/8-day cycle, each with the measured value, the limit, and a
one-line justification.

**Say:** *"Each number is read back out of this trip's own event stream at the
moment it's displayed. If the plan changes, the placard can't drift — there is no
second copy of the math. The 13.5-hour duty window includes the break, because the
14-hour window is wall-clock time."*

**Optional flex:** the duty-window engine handles a 10-hour rest split across
midnight (arrives as two 5-hour events on two sheets) as one reset — that bug was
found and is pinned by a runnable test (`npm run check:specs`, 13 checks, no test
framework needed).

---

## Scene 4 — ~2:00 · Into the console (the SaaS surface)

**Do:** click **OPEN THE DISPATCH CONSOLE** (bottom of the landing), or
**DISPATCH CONSOLE** in the header.

**On screen:** the same map world, laid out as a working desk — form on the left,
live route map on the right, same paper, same ink rules, same purple.

**Do:**
1. Change the **03 DESTINATION** field to any city, nudge **CYCLE HOURS ALREADY
   USED** with the **+** stepper (watch "HR LEFT IN THE CYCLE" respond), then
   **Calculate Route** in the form.
2. Point at the KPI strip that appears (distance, duration, days, rests, fuel).
3. Scroll to the **log sheets**: per-sheet **Export PNG** / **Export PDF**, and the
   carousel's **Download All N Day Logs (PDF)** — one click, every day of the trip,
   Form MCS-59 style.

**Say:** *"Same engine, different chair. This is the dispatcher's view: map, stop
list, and every daily sheet open at once, exportable the moment the plan is
accepted."*

---

## Scene 5 — ~2:45 · Fleet surfaces

**Do:** click **Fleet Analytics**, then **Trip Archive**.

**Analytics:** efficiency grade, cycle-exhaustion risk, fuel savings, fleet miles —
terrain-colored tiles, no chart junk. **Archive:** every calculated trip with search;
**Load Full Logs** reopens one in the planner.

**Say:** *"Trips persist per driver. Loading from the archive restores the exact
sheets — it does not recalculate, so the audit trail never mutates."*

**Do:** click **Instrument** (navbar, left of the tabs) to return to the landing
for the closing frame — the board re-entering is a natural end shot.

---

## Where each scene lives (to change copy or look before recording)

| Scene | File |
|---|---|
| Hero copy, all landing sections, form labels | `frontend/src/surfaces/Landing.jsx` |
| Sheet terrain, course line, controls, palette | `frontend/src/surfaces/mapSheet.js` |
| 3D relief board, lighting, parallax | `frontend/src/surfaces/CourseRelief.jsx` |
| Landing CSS (paper, ink, type) | `frontend/src/surfaces/instrument.css` |
| Console CSS (panels, tables, pills) | `frontend/src/index.css` |
| § 395 placard numbers/notes | `frontend/src/surfaces/hosSpecs.js` |
| Console tabs, app shell | `frontend/src/App.jsx`, `frontend/src/components/Navbar.jsx` |

Palette lives in two places on purpose: `mapSheet.js` (ISOM object, printed line-work)
and the CSS custom properties in `index.css` (UI chrome). Change one, change its
partner.

---

## Deployment (recap for the last slide)

**Vercel** (frontend only): `vercel.json` at the repo root — builds `frontend/`,
SPA-falls-back to `index.html`, proxies `/api/*` to your backend. Replace
`YOUR-SUBDOMAIN.duckdns.org` in it with your DuckDNS host (or set
`VITE_API_BASE_URL` at build time instead and drop the proxy).

**Docker + DuckDNS** (full stack, HTTPS):

```bash
# one-time: point your DuckDNS A record at this machine, then
echo "DUCKDNS_DOMAIN=yourname.duckdns.org" > .env
docker compose up -d --build
```

- `web` — gunicorn/Django on :8000 (API + admin, whitenoise-served statics)
- `edge` — Caddy on :80/:443 — auto Let's Encrypt cert for the DuckDNS name,
  proxies `/api` and `/admin` to `web`, serves the built SPA itself

Same-origin by design: the frontend calls relative `/api`, so there is no CORS
configuration anywhere in production.
