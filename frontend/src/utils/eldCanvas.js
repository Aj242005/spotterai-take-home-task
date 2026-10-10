/**
 * Canvas Drawing Engine for FMCSA Driver's Daily Log Sheet (24 Hours).
 * Renders a high-resolution pixel-perfect FMCSA paper log grid on HTML5 Canvas.
 */

export function drawELDLogSheet(canvas, data) {
  if (!canvas || !data) return;
  const ctx = canvas.getContext('2d');
  
  // Set canvas scale for crisp high-DPI rendering
  const width = 1100;
  const height = 760;
  canvas.width = width;
  canvas.height = height;

  const header = data.header || {};
  const gridLines = data.grid_lines || [];
  const totals = data.totals || {};
  const remarks = data.remarks || [];
  const recap = data.recap || {};

  // Background - Clean crisp white log paper with subtle border
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Fonts
  const fontTitle = 'bold 16px Inter, sans-serif';
  const fontHeader = 'bold 11px Inter, sans-serif';
  const fontLabel = '10px Inter, sans-serif';
  const fontSmall = '9px Inter, sans-serif';

  // 1. TOP HEADER SECTION
  ctx.fillStyle = '#0f172a';
  ctx.font = fontTitle;
  ctx.fillText("DRIVER'S DAILY LOG", 24, 34);
  ctx.font = fontSmall;
  ctx.fillText("(24 Hours) — Property-Carrying Driver", 24, 46);

  // Top Right Info Box
  ctx.font = fontHeader;
  ctx.fillText(`DATE: ${header.date || ''}`, 600, 32);
  ctx.fillText(`TOTAL MILES TODAY: ${header.total_miles_today || 0} mi`, 850, 32);

  ctx.lineWidth = 1;
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(24, 56);
  ctx.lineTo(1076, 56);
  ctx.stroke();

  // Header Details Grid
  ctx.font = fontSmall;
  ctx.fillStyle = '#475569';
  ctx.fillText("CARRIER NAME:", 24, 72);
  ctx.fillText("MAIN OFFICE ADDRESS:", 400, 72);
  ctx.fillText("TRUCK/TRACTOR #:", 800, 72);

  ctx.font = fontHeader;
  ctx.fillStyle = '#0f172a';
  ctx.fillText(header.carrier_name || 'Spotter Transport LLC', 24, 88);
  ctx.fillText(header.main_office_address || '100 Logistics Way, Chicago, IL', 400, 88);
  ctx.fillText(header.truck_number || 'TRK-8801', 800, 88);

  ctx.font = fontSmall;
  ctx.fillStyle = '#475569';
  ctx.fillText("HOME TERMINAL ADDRESS:", 24, 106);
  ctx.fillText("DRIVER'S NAME:", 400, 106);
  ctx.fillText("TRAILER #:", 800, 106);

  ctx.font = fontHeader;
  ctx.fillStyle = '#0f172a';
  ctx.fillText(header.home_terminal_address || '500 Transport Blvd, Dallas, TX', 24, 122);
  ctx.fillText(header.driver_name || 'John Driver', 400, 122);
  ctx.fillText(header.trailer_number || 'TRL-9942', 800, 122);

  // 2. 24-HOUR GRAPH GRID SETUP
  const gridX = 180;
  const gridY = 150;
  const gridWidth = 792; // 24 hours * 33px per hour
  const gridHeight = 160; // 4 rows * 40px per row
  const hourWidth = gridWidth / 24.0; // 33px per hour
  const rowHeight = 40;

  // Grid Box Outer Stroke
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.strokeRect(gridX, gridY, gridWidth + 80, gridHeight);

  // Row Labels Left Column
  const rows = [
    "1. OFF DUTY",
    "2. SLEEPER BERTH",
    "3. DRIVING",
    "4. ON DUTY (NOT DRIVING)"
  ];

  ctx.font = fontHeader;
  ctx.fillStyle = '#0f172a';
  rows.forEach((label, idx) => {
    const y = gridY + idx * rowHeight + 24;
    ctx.fillText(label, 24, y);
    
    // Row separator horizontal lines
    if (idx > 0) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, gridY + idx * rowHeight);
      ctx.lineTo(gridX + gridWidth + 80, gridY + idx * rowHeight);
      ctx.stroke();
    }
  });

  // Hours Axis Top Labels (Mid, 1, 2... 11, Noon, 1... 11, Mid)
  const hourLabels = [
    "M", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
    "N", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "M"
  ];

  ctx.font = fontSmall;
  ctx.fillStyle = '#334155';
  hourLabels.forEach((lbl, i) => {
    const x = gridX + i * hourWidth;
    ctx.fillText(lbl, x - (lbl.length > 1 ? 6 : 3), gridY - 6);
  });

  // Draw Vertical Hour & 15-min Subdivision Tick Lines
  for (let h = 0; h <= 24; h++) {
    const x = gridX + h * hourWidth;

    // Major Hour Line
    ctx.strokeStyle = h % 6 === 0 ? '#0f172a' : '#cbd5e1';
    ctx.lineWidth = h % 6 === 0 ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x, gridY);
    ctx.lineTo(x, gridY + gridHeight);
    ctx.stroke();

    // 15-min Subdivisions (ticks inside rows)
    if (h < 24) {
      for (let m = 1; m < 4; m++) {
        const subX = x + (m * (hourWidth / 4.0));
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let r = 0; r < 4; r++) {
          const tickY1 = gridY + r * rowHeight + (m === 2 ? 8 : 16);
          const tickY2 = gridY + (r + 1) * rowHeight - (m === 2 ? 8 : 16);
          ctx.moveTo(subX, tickY1);
          ctx.lineTo(subX, tickY2);
        }
        ctx.stroke();
      }
    }
  }

  // Right Side Column: TOTAL HOURS
  const totalColX = gridX + gridWidth;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(totalColX, gridY - 20);
  ctx.lineTo(totalColX, gridY + gridHeight);
  ctx.stroke();

  ctx.font = fontHeader;
  ctx.fillText("TOTAL", totalColX + 20, gridY - 6);
  ctx.fillText("HOURS", totalColX + 20, gridY - 18);

  const totalValues = [
    totals.off_duty || 0,
    totals.sleeper_berth || 0,
    totals.driving || 0,
    totals.on_duty_not_driving || 0
  ];

  totalValues.forEach((val, idx) => {
    ctx.fillStyle = '#0f172a';
    ctx.font = fontHeader;
    ctx.fillText(val.toFixed(2), totalColX + 20, gridY + idx * rowHeight + 24);
  });

  // 3. DRAW DUTY STATUS POLYLINE (THE GRAPH LINE)
  ctx.strokeStyle = '#2563eb';  // Bold Vibrant Blue status line
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  gridLines.forEach((line) => {
    if (line.type === 'horizontal') {
      const x1 = gridX + line.start_hours * hourWidth;
      const x2 = gridX + line.end_hours * hourWidth;
      const y = gridY + (line.row - 1) * rowHeight + (rowHeight / 2.0);
      
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
    } else if (line.type === 'vertical') {
      const x = gridX + line.time_hours * hourWidth;
      const y1 = gridY + (line.from_row - 1) * rowHeight + (rowHeight / 2.0);
      const y2 = gridY + (line.to_row - 1) * rowHeight + (rowHeight / 2.0);
      
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
  });
  ctx.stroke();

  // 4. REMARKS & LOCATION LOG SECTION
  const remarksY = gridY + gridHeight + 30;
  ctx.fillStyle = '#0f172a';
  ctx.font = fontHeader;
  ctx.fillText("REMARKS & DUTY CHANGE LOCATIONS:", 24, remarksY);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, remarksY + 10, 680, 360);

  // Table Headers
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(25, remarksY + 11, 678, 24);
  ctx.fillStyle = '#334155';
  ctx.font = fontSmall;
  ctx.fillText("TIME", 36, remarksY + 27);
  ctx.fillText("LOCATION (CITY, STATE)", 120, remarksY + 27);
  ctx.fillText("DUTY STATUS & ACTIVITY REMARKS", 360, remarksY + 27);

  // Render remarks rows
  remarks.slice(0, 12).forEach((rem, idx) => {
    const ry = remarksY + 48 + idx * 26;
    if (idx % 2 === 1) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(25, ry - 14, 678, 26);
    }
    
    ctx.fillStyle = '#0f172a';
    ctx.font = fontHeader;
    ctx.fillText(rem.time || '', 36, ry);
    ctx.fillText(rem.location || '', 120, ry);
    ctx.font = fontLabel;
    ctx.fillText(rem.remarks || '', 360, ry);

    ctx.strokeStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(25, ry + 10);
    ctx.lineTo(703, ry + 10);
    ctx.stroke();
  });

  // 5. 70-HOUR / 8-DAY RECAP TABLE (BOTTOM RIGHT)
  const recapX = 724;
  const recapY = remarksY + 10;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(recapX, recapY, 350, 360);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(recapX, recapY, 350, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = fontHeader;
  ctx.fillText("DRIVER'S 70-HR / 8-DAY RECAP", recapX + 16, recapY + 21);

  const recapRows = [
    { label: "1. On duty hours today:", val: `${(recap.on_duty_today || 0).toFixed(2)} hrs` },
    { label: "2. Total hours on duty last 7 days:", val: `${(recap.prev_7_days_total || 0).toFixed(2)} hrs` },
    { label: "3. Total hours on duty last 8 days:", val: `${(recap.total_8_days || 0).toFixed(2)} hrs` },
    { label: "4. Hours available tomorrow:", val: `${(recap.available_tomorrow || 0).toFixed(2)} hrs` },
    { label: "5. Hours available 9th day:", val: "70.00 hrs (if 34h restart)" }
  ];

  recapRows.forEach((r, idx) => {
    const ry = recapY + 60 + idx * 45;
    ctx.fillStyle = '#475569';
    ctx.font = fontSmall;
    ctx.fillText(r.label, recapX + 16, ry);
    ctx.fillStyle = '#0f172a';
    ctx.font = fontHeader;
    ctx.fillText(r.val, recapX + 16, ry + 18);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(recapX + 16, ry + 26);
    ctx.lineTo(recapX + 334, ry + 26);
    ctx.stroke();
  });

  // Driver Certification Footer
  ctx.font = fontSmall;
  ctx.fillStyle = '#64748b';
  ctx.fillText("I certify that these entries are true and correct: ____________________________________ (Driver Signature)", 24, height - 18);
}
