# DESIGN — Spotter AI

## World: Course Over Terrain

The product plans a route under FMCSA § 395 and returns the 24-hour log sheets the trip
would legally produce. Its visual world is therefore not "truck SaaS" — it is the
**orienteering map**: a printed sheet where terrain is flat colour, the course is a
reserved purple line, controls are numbered circles, and every measurement is printed,
not implied. The instrument (landing) is that map made interactive; the console is the
same sheet laid on a dispatcher's desk.

The world is chosen, not decorative: a dispatcher signing a daily log is reading a
printed artifact, so the whole product speaks in print. The prior dark "telemetry"
treatment is the anti-reference — replaced, not polished.

### Non-negotiables

- **Flat print.** No gradients on cards or buttons, no drop shadows, no glass. Depth
  exists only in the 3D relief board (the sheet lifted off the desk), where it is the
  subject rather than a style.
- **Ink rules over shadows.** Separation is a 1px rule (`--border-subtle` 26%, `--border-strong` 68%).
- **Purple is reserved.** `--primary` #a13bd6 belongs to the course and the primary
  action. Nothing else may take it.
- **Terrain colours carry duty states**, consistently across sheets, tables and pills:
  runnable ground (off duty) = paper white; water (sleeper berth) = blue; open land
  (on duty, not driving) = yellow; the course (driving) = purple.
- **No emoji as icons.** Spinners and glyphs are authored (CSS ring, lucide, canvas).

### Palette

| Token | Hex | Role |
|---|---|---|
| `--bg-app` | #f6f4ec | Map-margin paper (app ground) |
| `--bg-surface` | #ffffff | The sheet itself (cards) |
| `--text-primary` | #1b1b1b | Ink |
| `--primary` | #a13bd6 | Course purple — action + active state |
| `--accent-emerald` | #3f7a4e | Terrain green — ok / health |
| `--accent-amber` | #b3691b | Open land — fuel, caution |
| `--accent-rose` | #b3382b | Out of bounds — violation, error |
| `--accent-purple` | #a13bd6 | Course metadata |

### Typography

- **Archivo** (variable, condensed widths) for display and UI — a cartographic grotesk;
  headings use the condensed axis (`font-stretch: 76–82%`) like map lettering.
- **JetBrains Mono** for every measured figure: times, miles, hours, recap columns.
  Tabular numerals so columns align.
- Map-legend voice: small caps, letter-spacing .14–.16em for section labels.

### Motion

Purposeful only: the course line draws itself on plot (progressive reveal), the 3D
board drifts on pointer (parallax, never orbit), sheets cross-fade. All motion respects
`prefers-reduced-motion`.

### The 3D relief board (landing)

Lazy-loaded chunk (`three`, `@react-three/fiber`); the painted sheet is one cached
canvas texture, terrain generated deterministically from the trip geometry so no two
loads differ. WebGL failure degrades to the 2D sheet — the board is never the only path
to the data.

### Surfaces

- **Landing (Persuade/Experience):** the instrument — the map is the hero; the form is
  a set of numbered fields like control descriptions.
- **Console (Operate):** same tokens, familiar app anatomy (navbar, panels, tables).
  Scanability outranks expression; brand lives in the terrain-coded pills and the ink
  rules. Responsive: console grid collapses to one column ≤1080px; the live clock is
  desk furniture and hides on phones.
- **The placard:** § 395 figures are measured from the trip's own event stream at
  render time (hosSpecs.js) — the plan and its placard cannot drift apart.
