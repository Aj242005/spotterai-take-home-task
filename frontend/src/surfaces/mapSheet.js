/**
 * Course over terrain — the printed orienteering sheet.
 *
 * The world is a standardised map: the terrain is a fixed colour language
 * printed beneath, and the course rides above it in one reserved purple that
 * never edits the terrain. Everything drawn here is either real trip data (the
 * course, its controls, the mileage scale) or authored terrain that is labelled
 * as illustrative wherever it appears.
 */

export const ISOM = {
  paper: '#ffffff',
  paperWarm: '#f6f3ea',
  margin: '#f1eee3',
  ink: '#1b1b1b',
  inkSoft: 'rgba(27,27,27,0.42)',
  contour: '#b08155',
  contourIndex: '#8a5f38',
  olive: '#7f9a4e',
  olivePale: '#c9cf9a',
  open: '#f6cf53',
  marsh: '#7aa7d8',
  marshEdge: '#3f7fb8',
  course: '#a13bd6',
  courseDeep: '#7a1fb0',
  rock: '#2a2a2a',
};

/** Board geometry, shared by the 3D relief and the printed sheet. */
export const BOARD = { width: 3.2, height: 2.0, margin: 0.17 };

const MILES_PER_DEGREE_LAT = 69.0;

/**
 * Whether this browser can give the relief board a WebGL context at all.
 * Lives here rather than beside the canvas component so the page can decide
 * without pulling three.js into its own chunk.
 */
export function hasWebGL() {
  try {
    const probe = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (probe.getContext('webgl2') || probe.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Everything the trip knows about where it goes. */
export function coursePoints(trip) {
  const points = [];
  const waypoints = trip?.waypoints;
  if (waypoints) {
    for (const key of ['current', 'pickup', 'dropoff']) {
      const point = waypoints[key];
      if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
        points.push({ lat: point.lat, lng: point.lng, label: point.display_name });
      }
    }
  }
  const geometry = trip?.route_geometry;
  if (Array.isArray(geometry)) {
    for (const pair of geometry) {
      if (Array.isArray(pair) && Number.isFinite(pair[0]) && Number.isFinite(pair[1])) {
        points.push({ lat: pair[0], lng: pair[1] });
      }
    }
  }
  return points;
}

/**
 * A single aspect-preserving projection shared by the 2D sheet and the 3D
 * course, so the ribbon laid over the board sits exactly on the printed line.
 * Returns unit coordinates in [0,1]² with y increasing southward.
 */
export function makeProjection(trip) {
  const points = coursePoints(trip);
  if (points.length === 0) {
    return {
      toUnit: () => [0.5, 0.5],
      milesPerUnit: 100,
      bounds: null,
    };
  }

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const meanLat = (minLat + maxLat) / 2;
  const kx = Math.max(0.15, Math.cos((meanLat * Math.PI) / 180));

  const centreX = ((minLng + maxLng) / 2) * kx;
  const centreY = (minLat + maxLat) / 2;
  const spanX = Math.max(0.02, (maxLng - minLng) * kx);
  const spanY = Math.max(0.02, maxLat - minLat);

  const aspect = BOARD.width / BOARD.height;
  const dataAspect = spanX / spanY;
  // Fit width or height, whichever keeps the scale uniform — a map's metric
  // scale is not allowed to stretch.
  const scale = dataAspect > aspect ? 1 / spanX : 1 / spanY;

  const toUnit = (lat, lng) => {
    const x = lng * kx - centreX;
    const y = lat - centreY;
    return [0.5 + (x * scale) / 2, 0.5 - (y * scale) / 2];
  };

  return {
    toUnit,
    // One unit of board space covers 1/scale degrees of latitude.
    milesPerUnit: MILES_PER_DEGREE_LAT / scale,
    bounds: { minLat, maxLat, minLng, maxLng },
  };
}

/** A rounded number a cartographer would actually print on a scale bar. */
export function niceScaleMiles(milesPerUnit, targetUnits) {
  const target = milesPerUnit * targetUnits;
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  let best = steps[0];
  for (const step of steps) {
    if (Math.abs(Math.log(step / target)) < Math.abs(Math.log(best / target))) best = step;
  }
  return best;
}

/** A nested, non-self-intersecting contour family around one hill. */
function contourRing(ctx, cx, cy, radius, noise, index) {
  const steps = 220;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const theta = (i / steps) * Math.PI * 2;
    const wobble = 1 + 0.17 * noise(theta) + 0.07 * noise(theta * 2.3 + 1.7);
    const r = radius * wobble;
    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = index % 3 === 0 ? ISOM.contourIndex : ISOM.contour;
  ctx.lineWidth = index % 3 === 0 ? 2.1 : 1.2;
  ctx.stroke();
}

function terrainNoise(seed) {
  const random = mulberry32(seed);
  const phases = Array.from({ length: 5 }, () => ({ k: 1 + random() * 6, p: random() * Math.PI * 2, a: random() }));
  return (theta) =>
    phases.reduce((sum, phase) => sum + Math.sin(phase.k * theta + phase.p) * phase.a, 0) /
    phases.reduce((sum, phase) => sum + phase.a, 0);
}

function organicBlob(ctx, cx, cy, radius, noise, squash = 1) {
  const steps = 200;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const theta = (i / steps) * Math.PI * 2;
    const r = radius * (1 + 0.24 * noise(theta));
    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r * squash;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * The terrain is generated once per board size and reused.
 *
 * It is the expensive half of the sheet (contours, vegetation dots, rock) and
 * it never changes, while the course layer repaints on every step of the ink
 * animation. Redrawing the terrain each frame made the reveal crawl.
 */
const terrainCache = new Map();

function terrainLayer(width, height, seed) {
  const key = `${width}x${height}:${seed}`;
  const cached = terrainCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawTerrain(canvas.getContext('2d'), width, height, seed);
  terrainCache.set(key, canvas);
  return canvas;
}

/** The terrain plate: a fixed symbol language that the course never edits. */
function drawTerrain(ctx, width, height, seed) {
  const noiseA = terrainNoise(seed + 11);
  const noiseB = terrainNoise(seed + 29);
  const noiseC = terrainNoise(seed + 47);
  const random = mulberry32(seed + 71);

  // Vegetation first, as a pale wash under everything.
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = ISOM.olivePale;
  organicBlob(ctx, width * 0.16, height * 0.24, width * 0.16, noiseB, 1.4);
  ctx.fill();
  organicBlob(ctx, width * 0.87, height * 0.78, width * 0.13, noiseB, 1.2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Open land.
  ctx.fillStyle = ISOM.open;
  organicBlob(ctx, width * 0.74, height * 0.2, width * 0.11, noiseC, 1.1);
  ctx.fill();
  organicBlob(ctx, width * 0.26, height * 0.83, width * 0.1, noiseC, 1);
  ctx.fill();

  // Vegetation symbol: scattered olive dots over the pale wash.
  ctx.fillStyle = ISOM.olive;
  for (let i = 0; i < 520; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const inBlobA = Math.hypot((x - width * 0.16) / 1.4, y - height * 0.24) < width * 0.14;
    const inBlobB = Math.hypot((x - width * 0.87) / 1.2, y - height * 0.78) < width * 0.115;
    if (!inBlobA && !inBlobB) continue;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Marsh.
  ctx.fillStyle = ISOM.marsh;
  ctx.globalAlpha = 0.82;
  organicBlob(ctx, width * 0.6, height * 0.9, width * 0.09, noiseA, 0.7);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ISOM.marshEdge;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Contours: perfectly nested families, index contours every third line.
  const hills = [
    { x: 0.09, y: 0.52, r: 0.2, rings: 9 },
    { x: 0.42, y: 0.14, r: 0.15, rings: 7 },
    { x: 0.95, y: 0.42, r: 0.17, rings: 8 },
    { x: 0.52, y: 0.62, r: 0.11, rings: 5 },
  ];
  for (const hill of hills) {
    const noise = terrainNoise(seed + Math.round(hill.x * 1000));
    for (let ring = 1; ring <= hill.rings; ring += 1) {
      const fraction = ring / hill.rings;
      contourRing(
        ctx,
        hill.x * width,
        hill.y * height,
        hill.r * width * Math.pow(fraction, 0.72),
        noise,
        ring,
      );
    }
  }

  // Rock and boulder symbols.
  ctx.fillStyle = ISOM.rock;
  for (let i = 0; i < 26; i += 1) {
    const x = random() * width;
    const y = random() * height;
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x + 3, y + 2);
    ctx.lineTo(x - 3, y + 2);
    ctx.closePath();
    ctx.fill();
  }
}

/** Cartographic furniture: graticule, frame and edge ticks. */
function drawMargins(ctx, width, height, margin) {
  ctx.fillStyle = ISOM.margin;
  ctx.fillRect(0, 0, width, margin);
  ctx.fillRect(0, height - margin, width, margin);
  ctx.fillRect(0, 0, margin, height);
  ctx.fillRect(width - margin, 0, margin, height);

  ctx.strokeStyle = ISOM.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

  ctx.strokeStyle = ISOM.inkSoft;
  ctx.lineWidth = 1;
  const divisions = 10;
  for (let i = 1; i < divisions; i += 1) {
    const x = margin + ((width - margin * 2) * i) / divisions;
    ctx.beginPath();
    ctx.moveTo(x, margin - 6);
    ctx.lineTo(x, margin);
    ctx.moveTo(x, height - margin);
    ctx.lineTo(x, height - margin + 6);
    ctx.stroke();
  }
  for (let i = 1; i < divisions; i += 1) {
    const y = margin + ((height - margin * 2) * i) / divisions;
    ctx.beginPath();
    ctx.moveTo(margin - 6, y);
    ctx.lineTo(margin, y);
    ctx.moveTo(width - margin, y);
    ctx.lineTo(width - margin + 6, y);
    ctx.stroke();
  }
}

function sheetPoint(unit, width, height, margin) {
  const innerW = width - margin * 2;
  const innerH = height - margin * 2;
  return [margin + unit[0] * innerW, margin + unit[1] * innerH];
}

/**
 * Draw the complete printed sheet.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 * @param {object} options.trip     a calculate response (or the labelled sample)
 * @param {number} options.progress 0..1 of the course that has been inked in
 */
export function drawCourseSheet(canvas, { trip, progress = 1 } = {}) {
  if (!canvas) return canvas;
  const width = canvas.width || 1600;
  const height = canvas.height || 1000;
  const ctx = canvas.getContext('2d');
  const margin = Math.round(Math.min(width, height) * 0.048);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = ISOM.paper;
  ctx.fillRect(margin, margin, width - margin * 2, height - margin * 2);

  const terrain = terrainLayer(width, height, 9871);
  ctx.save();
  ctx.beginPath();
  ctx.rect(margin, margin, width - margin * 2, height - margin * 2);
  ctx.clip();
  ctx.drawImage(terrain, 0, 0);
  ctx.restore();

  const projection = makeProjection(trip);

  // The course. Purple is reserved for it and never used for terrain.
  const geometry = Array.isArray(trip?.route_geometry) ? trip.route_geometry : [];
  const course = geometry.map((pair) => sheetPoint(projection.toUnit(pair[0], pair[1]), width, height, margin));

  if (course.length > 1) {
    const revealed = Math.max(1, Math.round(course.length * Math.min(1, Math.max(0, progress))));
    ctx.save();
    ctx.strokeStyle = ISOM.course;
    ctx.lineWidth = Math.max(3, width * 0.0028);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < revealed; i += 1) {
      if (i === 0) ctx.moveTo(course[i][0], course[i][1]);
      else ctx.lineTo(course[i][0], course[i][1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  const controls = (trip?.stops || []).filter((stop) =>
    ['pickup', 'rest', 'fuel', 'dropoff'].includes(stop.type),
  );

  controls.forEach((stop, index) => {
    if (!Number.isFinite(stop.latitude) || !Number.isFinite(stop.longitude)) return;
    const [x, y] = sheetPoint(projection.toUnit(stop.latitude, stop.longitude), width, height, margin);
    const reached = index / Math.max(1, controls.length) <= progress;
    const radius = Math.max(11, width * 0.0095);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = ISOM.paper;
    ctx.fill();
    ctx.strokeStyle = ISOM.course;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // A punched control is a real hole, not a colour change.
    if (reached) {
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = ISOM.courseDeep;
      ctx.fill();
    }

    ctx.font = `700 ${Math.round(radius * 1.25)}px 'Archivo', sans-serif`;
    ctx.fillStyle = ISOM.courseDeep;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), x + radius + 4, y - radius * 0.6);
  });

  // Start triangle and finish double circle, the two symbols every course has.
  if (course.length > 1) {
    const [sx, sy] = course[0];
    const size = Math.max(12, width * 0.011);
    ctx.beginPath();
    ctx.moveTo(sx, sy - size);
    ctx.lineTo(sx + size * 0.9, sy + size * 0.6);
    ctx.lineTo(sx - size * 0.9, sy + size * 0.6);
    ctx.closePath();
    ctx.fillStyle = ISOM.course;
    ctx.fill();

    const [fx, fy] = course[course.length - 1];
    ctx.strokeStyle = ISOM.course;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(fx, fy, size * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(fx, fy, size * 0.42, 0, Math.PI * 2);
    ctx.stroke();
  }

  // North arrow and a real mileage scale bar.
  const northX = width - margin - Math.round(width * 0.05);
  const northY = margin + Math.round(height * 0.09);
  ctx.strokeStyle = ISOM.ink;
  ctx.fillStyle = ISOM.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(northX, northY + 22);
  ctx.lineTo(northX, northY - 22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(northX, northY - 30);
  ctx.lineTo(northX + 6, northY - 18);
  ctx.lineTo(northX - 6, northY - 18);
  ctx.closePath();
  ctx.fill();
  ctx.font = `700 ${Math.round(width * 0.011)}px 'Archivo', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('N', northX, northY + 26);

  const barUnits = 0.28;
  const barMiles = niceScaleMiles(projection.milesPerUnit, barUnits);
  const barWidth = (barMiles / projection.milesPerUnit) * (width - margin * 2);
  const barX = margin + Math.round(width * 0.035);
  const barY = height - margin - Math.round(height * 0.075);

  ctx.fillStyle = ISOM.paper;
  ctx.fillRect(barX - 8, barY - 20, barWidth + 16, 34);
  ctx.strokeStyle = ISOM.ink;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(barX - 8, barY - 20, barWidth + 16, 34);
  const segments = 4;
  for (let i = 0; i < segments; i += 1) {
    const segmentWidth = barWidth / segments;
    ctx.fillStyle = i % 2 === 0 ? ISOM.ink : ISOM.paper;
    ctx.fillRect(barX + i * segmentWidth, barY - 8, segmentWidth, 10);
  }
  ctx.strokeRect(barX, barY - 8, barWidth, 10);
  ctx.fillStyle = ISOM.ink;
  ctx.font = `600 ${Math.round(width * 0.0092)}px 'Archivo', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`0`, barX, barY - 22);
  ctx.textAlign = 'right';
  ctx.fillText(`${barMiles} mi`, barX + barWidth, barY - 22);

  drawMargins(ctx, width, height, margin);

  return canvas;
}

/** Service grain for the page ground: paper tooth, not a gradient. */
export function paperGrainDataUrl(size = 320) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f1e7';
  ctx.fillRect(0, 0, size, size);

  const random = mulberry32(4242);
  for (let i = 0; i < 24000; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const dark = random() > 0.52;
    ctx.fillStyle = dark
      ? `rgba(120,112,92,${(random() * 0.09).toFixed(3)})`
      : `rgba(255,255,255,${(random() * 0.5).toFixed(3)})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return canvas.toDataURL('image/png');
}

/**
 * A soft daylight studio so the course ribbon and the control pillars have
 * something to reflect. Generated locally: no HDR is fetched at runtime.
 */
export function makeStudioEnvTexture(THREE, width = 256, height = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#dcdad2';
  ctx.fillRect(0, 0, width, height);

  const panels = [
    { x: 0.24, y: 0.16, rx: 0.3, ry: 0.34, intensity: 0.95, tint: '255,255,252' },
    { x: 0.72, y: 0.3, rx: 0.22, ry: 0.26, intensity: 0.5, tint: '238,244,255' },
    { x: 0.5, y: 0.95, rx: 0.6, ry: 0.2, intensity: 0.34, tint: '200,186,150' },
  ];

  for (const panel of panels) {
    const gradient = ctx.createRadialGradient(
      panel.x * width,
      panel.y * height,
      0,
      panel.x * width,
      panel.y * height,
      Math.max(panel.rx, panel.ry) * width,
    );
    gradient.addColorStop(0, `rgba(${panel.tint},${panel.intensity})`);
    gradient.addColorStop(0.5, `rgba(${panel.tint},${(panel.intensity * 0.3).toFixed(3)})`);
    gradient.addColorStop(1, `rgba(${panel.tint},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
