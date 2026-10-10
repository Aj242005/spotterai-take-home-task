import React, { useRef, useEffect, useState } from 'react';
import { drawELDLogSheet } from '../utils/eldCanvas';
import { Download, FileText, Printer, CheckCircle2, ListFilter } from 'lucide-react';
import jsPDF from 'jspdf';

export default function ELDLogSheet({ logData, dayNumber }) {
  const canvasRef = useRef(null);
  const [showEventsTable, setShowEventsTable] = useState(true);

  useEffect(() => {
    if (canvasRef.current && logData?.canvas_data) {
      drawELDLogSheet(canvasRef.current, logData.canvas_data);
    }
  }, [logData]);

  const handleDownloadPNG = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `ELD_Log_Day_${dayNumber}_${logData.date_str.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const handleDownloadPDF = () => {
    if (!canvasRef.current) return;
    const imgData = canvasRef.current.toDataURL('image/png');
    const pdf = new jsPDF('landscape', 'px', [1100, 760]);
    pdf.addImage(imgData, 'PNG', 0, 0, 1100, 760);
    pdf.save(`ELD_Log_Day_${dayNumber}.pdf`);
  };

  const handlePrint = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const windowContent = `<img src="${dataUrl}" style="width:100%; max-width:1100px;"/>`;
    const printWindow = window.open('', '', 'width=1150,height=800');
    if (printWindow) {
      printWindow.document.write(`<html><head><title>Print Driver Log Sheet (Day ${dayNumber})</title></head><body onload="window.print();window.close()">${windowContent}</body></html>`);
      printWindow.document.close();
    }
  };

  const statusBadge = (st) => {
    switch (st) {
      case 'driving':
        return <span className="status-pill pill-blue">3. DRIVING</span>;
      case 'on_duty_not_driving':
        return <span className="status-pill pill-amber">4. ON DUTY (NOT DRIVING)</span>;
      case 'sleeper_berth':
        return <span className="status-pill pill-purple">2. SLEEPER BERTH</span>;
      case 'off_duty':
      default:
        return <span className="status-pill pill-emerald">1. OFF DUTY</span>;
    }
  };

  return (
    <div className="saas-card" style={{ marginBottom: '24px' }}>
      <div className="saas-card-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="status-pill pill-emerald">
              <CheckCircle2 size={12} /> FMCSA § 395 COMPLIANT
            </span>
            <span className="status-pill pill-blue">DAY {dayNumber} OF SCHEDULE</span>
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
            Driver's Daily Log (Form MCS-59) — {logData.date_str}
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadPNG}>
            <Download size={14} /> Export PNG
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadPDF}>
            <FileText size={14} /> Export PDF
          </button>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            <Printer size={14} /> Print Sheet
          </button>
        </div>
      </div>

      <div className="saas-card-body" style={{ padding: '20px' }}>
        {/* High Resolution Canvas Container */}
        <div style={{
          overflowX: 'auto',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          background: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          marginBottom: '20px'
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', minWidth: '1000px', display: 'block' }} />
        </div>

        {/* Detailed Chronological Duty Table Toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '16px',
          marginBottom: '12px'
        }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ListFilter size={15} color="var(--primary)" /> Day {dayNumber} Chronological Activity Breakdown
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowEventsTable(!showEventsTable)}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            {showEventsTable ? 'Hide Activity Table' : 'Show Activity Table'}
          </button>
        </div>

        {showEventsTable && logData.events && logData.events.length > 0 && (
          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <table className="saas-table">
              <thead>
                <tr>
                  <th>TIME WINDOW</th>
                  <th>STATUS</th>
                  <th>DURATION</th>
                  <th>LOCATION</th>
                  <th>ACTIVITY & REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {logData.events.map((ev, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {ev.start_time} → {ev.end_time}
                    </td>
                    <td>{statusBadge(ev.status)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {ev.duration_hours} hrs
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{ev.location}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ev.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
