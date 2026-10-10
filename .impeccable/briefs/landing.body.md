# Landing surface — Spotter AI

Scope: the public entry surface (`/` when signed out and the top of the app shell) plus the
instrument chrome it hands to the console. Visitor mode: **Persuade**.

Audience: dispatchers, safety managers and owner-operators planning a multi-day haul and needing
a defensible 24-hour log. Job: confirm the number of driving days and mandatory breaks before
committing a driver. Action: plan the actual trip, on the page, in the category's working form —
three locations, cycle hours carried in, and a real calculation. Proof: the product's own output,
the midnight-to-midnight log sheet. Constraints: must run with no third-party network (the backend
already has deterministic geocode/route fallbacks), must respect `prefers-reduced-motion`, and must
not use gradients to signal futurism.

Unresolved: production hosting, pricing, real carrier accounts. Not to be implied anywhere.

## Direction contract

THESIS
The 24-hour duty day is a machined instrument record: the trip revolves once on a printed chart
disc and the pen draws what the driver will sign. The category default — a dark console with a KPI
grid and a map beside a form — is refused outright; this surface is a precision instrument, and
futurism comes from a real mechanism turning on real data, never from a gradient.

OWN-WORLD
Anodised graphite chassis grounds (`#14171a`, `#1d2124`), brushed aluminium faceplate (`#9aa0a4`
plate, `#c9ced1` edge light, `#0b0d0e` edge shadow), chart paper (`#efe9dc`) printed with concentric
time rings in instrument ink (`#1f3b57`), one drafting pen trace (`#d2451f`), lamp amber for status
(`#e0a13c`). Depth is physical: a 1px light edge over a 1px dark edge, plus an offset soft shadow —
never a zero-offset colour halo. Radii are a 4px machined chamfer, never pills; the disc and the
winder are the only circles. Type: self-hosted condensed capitals, wide-tracked, for engraved
legends, and a monospace reserved for measured values because these numerals *are* measurements.
Controls are machined keys that travel 1px when pressed, with printed legends above them.

STORY
The visitor reads the offer in one line, then plans their own trip on the instrument without
leaving the page. When the calculation returns, the disc spins up and the pen inks the duty trace,
so they see the 24-hour sheet being produced rather than described. They leave believing the log
is real output, and either export the sheet or open the console to plan in depth.

FIRST VIEWPORT
One instrument chassis, edge to edge, no floating card. Left third: the engraved route plate —
ORIGIN, PICKUP, DESTINATION as set-in field wells, a cycle-hours winder, and the primary action
`WIND & PLOT`. Centre: the glass-lensed chart disc in real 3D, revolving once per simulated day,
under a pen carriage that inks the duty trace as the HOS result arrives. Right third: the printed
four-state duty legend and the day/cycle counters as engraved numerals. Space above each heading
exceeds space below it, and the whole frame is held with charged emptiness rather than filled.

FORM
Candidate 4 of 7 grounded directions, ordered by resonance — the mechanical chart recorder
(tachograph discs and reefer temperature recorders). Seed key `c77eda4d`. Raised by its declined
challengers: charged emptiness (ikebana ma), rule-by-demonstration (marker zine), and lit-or-unlit
resolution with no midtone hedge (two-state bill).

FINISH
unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
