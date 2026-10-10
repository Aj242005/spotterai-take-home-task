# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing codebase answers this: Django 5 + DRF + SimpleJWT backend, React 19 + Vite frontend, HTML5 Canvas for log rendering. The 3D surface was explicitly approved to add `three`, `@react-three/fiber`, and `@react-three/drei`.

## Users

Primary: dispatchers, safety managers, and owner-operators at small-to-mid commercial trucking carriers (roughly 5–200 power units). They plan a multi-day haul under FMCSA Hours of Service rules and must be able to hand a clean, defensible daily log to a DOT auditor. Secondary: independent drivers who need to produce a compliant paper log for a route they are about to run. They work at a desk with the routing screen open, often with a load board, phone, and the previous log in front of them.

## Product Purpose

Spotter AI plans a commercial route end to end — current position, pickup, dropoff — and returns the daily driver's log sheets (Form MCS-59 style, 24-hour) that the trip would legally produce, plus the rest, fuel, and cycle events that create them. Success means: a dispatcher sees the true number of driving days and mandatory breaks before committing a driver, and the exported log set survives audit scrutiny without manual correction.

## Positioning

The route is simulated chronologically as a single event stream under § 395 rules — 11-hour drive limit, 14-hour duty window, 30-minute break after 8 cumulative driving hours, 70-hour/8-day cycle with 34-hour restart, fuel every 1,000 miles, pre/post-trip and loading/unloading duty — and then that stream is cut at **midnight-to-midnight days** and force-balanced so every daily log sums to exactly 24.0 hours. Competitors draw a driving-hours estimate; this produces the actual grid the driver will sign.

## Operating Context

DOT compliance review is the evaluation ritual: an auditor reads a signed 24-hour grid, checks the recap totals, and cross-references the cycle. Therefore the canvas log renderer is a first-class artifact, not decoration, and every exported sheet must be legible from twelve inches away. Trips are typically 1–4 days. Cycle hours carried in from previous days are real user-supplied input (`current_cycle_hours`), and the timezone of the driver's home terminal governs the midnight boundary.

## Capabilities and Constraints

Confirmed:

- Trip calculation: geocode three locations, route them, run the HOS engine, persist `Trip`, `TripStop`, `DailyLog`, `TripAnalytics`.
- Output: per-day canvas log sheets, PNG/PDF single-day export, combined multi-day PDF, browser print.
- Accounts: email login, JWT access/refresh with rotation + blacklist, protected history and analytics endpoints.
- Analytics: aggregate trip/cycle/duty metrics for the logged-in carrier.
- Rate limiting on calculate endpoints.

Constraints:

- SQLite is the only database in use; no background task runner; the frontend is a single-page tab shell with no router.
- Log sheet must remain a true 24-hour grid with exact midnight partitioning — a "close enough" split is a defect, not a preference.
- Geocoding falls back to a hardcoded US-city cache, and routing falls back to haversine × 1.25 at 55 mph, so the app works with no third-party network.

Explicitly undecided: production hosting target, real carrier accounts, and any paid tier or pricing. Do not invent them.

## Brand Commitments

Name: **Spotter AI**. Existing voice is plain and operational ("Dispatch Console", "§ 395 Compliance"). Existing incumbent palette is a dark navy dispatch-console scheme (bg `#080c16`, surface `#0f172a`, primary blue `#2563eb`) with Inter and JetBrains Mono. No logo file or legal asset exists; the favicon is a placeholder.

User-pinned constraint for this work: the new surface must read as **futuristic and genuinely cool**, must render **actual 3D** (approved three.js + R3F + drei), and explicitly must **not** rely on gradients to signal futurism.

## Evidence on Hand

- `info-about-task/` — the assessment brief (`Frontend Task.docx`), the FMCSA § 395 reference guide PDF, and blank daily-log reference images. Real, supplied.
- `spotter_qa_security_report.html` — an existing QA/security write-up of this codebase.
- Backend test modules under `backend/trips/tests/` and `backend/accounts/tests/`.

Absent and must not be fabricated: customers, testimonials, press, benchmarks, DOT certification, pricing, SOC reports, uptime numbers, or screenshots of real carrier accounts. Any demonstration trip, load, or driver name shown in new surfaces is synthetic and must be labeled as such.

## Product Principles

1. **The log is the product.** Every surface earns its place by making the 24-hour grid more trustworthy, faster to read, or easier to hand to an auditor.
2. **Simulate, do not estimate.** Rules are enforced in sequence; when a limit binds, the plan says so plainly rather than hiding the cost.
3. **Legible under pressure.** A dispatcher reads this in ten seconds and a DOT auditor reads it for ten minutes. Both must succeed.
4. **Show the physics of the trip.** Distance, time, rest, fuel, and cycle are the same thing seen five ways; the interface should let a user feel that relationship instead of reading five unrelated numbers.
5. **Work offline-gracefully.** Every external dependency has a local deterministic fallback; nothing critical depends on a third party being up.

## Accessibility & Inclusion

No product-specific standard was established by the brief or the code. Baseline applies: keyboard reachable controls, visible focus, WCAG AA contrast on text, and respect `prefers-reduced-motion` for any motion added in this work — including the 3D scene, which must degrade to a static composed state rather than an empty canvas.
