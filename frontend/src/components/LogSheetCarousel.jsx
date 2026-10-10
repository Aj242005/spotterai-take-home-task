import React, { useState } from 'react';
import ELDLogSheet from './ELDLogSheet';
import { drawELDLogSheet } from '../utils/eldCanvas';
import { ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';


export default function LogSheetCarousel({ dailyLogs }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!dailyLogs || dailyLogs.length === 0) return null;

  const currentLog = dailyLogs[currentIndex];

  const handleDownloadAllPDF = () => {
    const pdf = new jsPDF('landscape', 'px', [1100, 760]);

    dailyLogs.forEach((log, idx) => {
      const tempCanvas = document.createElement('canvas');
      drawELDLogSheet(tempCanvas, log.canvas_data);
      const imgData = tempCanvas.toDataURL('image/png');
      
      if (idx > 0) pdf.addPage([1100, 760], 'landscape');
      pdf.addImage(imgData, 'PNG', 0, 0, 1100, 760);
    });

    pdf.save(`Complete_Trip_ELD_Logs_${dailyLogs.length}_Days.pdf`);
  };

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Day Navigation Bar */}
      <div className="saas-card" style={{ padding: '14px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(prev => prev - 1)}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '2px' }}>
            {dailyLogs.map((log, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className="btn btn-sm"
                style={{
                  background: idx === currentIndex ? 'var(--primary)' : 'var(--bg-input)',
                  border: idx === currentIndex ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                  color: idx === currentIndex ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: idx === currentIndex ? 700 : 500
                }}
              >
                Day {log.day_number} ({log.date_str.split(',')[0]})
              </button>
            ))}
          </div>

          <button 
            className="btn btn-secondary btn-sm"
            disabled={currentIndex === dailyLogs.length - 1}
            onClick={() => setCurrentIndex(prev => prev + 1)}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>

        <button 
          className="btn btn-primary btn-sm" 
          onClick={handleDownloadAllPDF}
        >
          <FileDown size={14} /> Download All {dailyLogs.length} Day Logs (PDF)
        </button>
      </div>

      {/* Render Current Day Log Sheet */}
      <ELDLogSheet logData={currentLog} dayNumber={currentLog.day_number} />
    </div>
  );
}
