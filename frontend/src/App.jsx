import React, { useState, useCallback } from 'react';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import TripForm from './components/TripForm';
import TripSummary from './components/TripSummary';
import RouteMap from './components/RouteMap';
import LogSheetCarousel from './components/LogSheetCarousel';
import TripHistory from './components/TripHistory';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AuthModal from './components/AuthModal';
import Landing from './surfaces/Landing';
import api from './services/api';
import { AlertCircle, ChevronLeft } from 'lucide-react';

export default function App() {
  // The instrument is the entry surface; the console is where a dispatcher works.
  const [surface, setSurface] = useState('landing');
  const [activeTab, setActiveTab] = useState('planner');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [tripResult, setTripResult] = useState(null);
  const [error, setError] = useState('');

  const handleCalculateTrip = useCallback(async (formData) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/trips/calculate/', formData);
      setTripResult(res.data);
    } catch (err) {
      console.error('Trip calculation error:', err);
      if (err.response?.status === 429) {
        setError('Rate limit triggered: Too many calculation requests. Please wait a moment.');
      } else {
        setError(err.response?.data?.error || 'Failed to calculate trip route. Please verify locations.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadTripFromHistory = async (tripId) => {
    setLoading(true);
    try {
      const res = await api.get(`/trips/${tripId}/`);
      if (res.data) {
        setTripResult(res.data);
      }
      setActiveTab('planner');
    } catch (err) {
      console.error('Error loading trip history item:', err);
      setError('That trip could not be loaded. It may belong to another account.');
    } finally {
      setLoading(false);
    }
  };

  // A trip planned on the instrument is carried straight into the console rather
  // than being recalculated (which used to write a duplicate Trip row on load).
  const handleTripFromInstrument = useCallback((trip) => {
    if (!trip) return;
    setTripResult(trip);
  }, []);

  return (
    <AuthProvider>
      {surface === 'landing' ? (
        <>
          <Landing
            onEnterConsole={() => setSurface('console')}
            onOpenAuth={() => setAuthModalOpen(true)}
            onTripCalculated={handleTripFromInstrument}
          />
          <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        </>
      ) : (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenAuth={() => setAuthModalOpen(true)}
            onExitInstrument={() => setSurface('landing')}
          />

          <main className="app-container" style={{ flex: 1 }}>
            {activeTab === 'planner' && (
              <div className="animate-fade-in">
                {error && (
                  <div style={{
                    background: 'var(--accent-rose-subtle)',
                    border: '1px solid var(--accent-rose)',
                    color: 'var(--accent-rose)',
                    padding: '12px 18px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '20px',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <AlertCircle size={16} /> {error}
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSurface('landing')}
                  >
                    <ChevronLeft size={14} /> Back to the instrument
                  </button>
                </div>

                {/* Trip Summary KPI Metric Bar */}
                {tripResult && <TripSummary summary={tripResult.summary} />}

                {/* Main 2-Column Console Grid */}
                <div className="console-grid">
                  {/* Left Column: Dispatch Controls */}
                  <div>
                    <TripForm onSubmit={handleCalculateTrip} loading={loading} />
                  </div>

                  {/* Right Column: Route Map */}
                  <div>
                    <RouteMap
                      waypoints={tripResult?.waypoints}
                      stops={tripResult?.stops}
                      geometry={tripResult?.route_geometry}
                    />
                  </div>
                </div>

                {/* Log Sheet Carousel */}
                {tripResult?.daily_logs && (
                  <LogSheetCarousel dailyLogs={tripResult.daily_logs} />
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="animate-fade-in">
                <TripHistory onLoadTrip={handleLoadTripFromHistory} />
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="animate-fade-in">
                <AnalyticsDashboard />
              </div>
            )}
          </main>

          <footer style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '18px 24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.78rem',
            marginTop: '40px'
          }}>
            Spotter AI — FMCSA Hours of Service (§ 395) Commercial Route Dispatcher & ELD Daily Log Generator © 2026
          </footer>

          <AuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
          />
        </div>
      )}
    </AuthProvider>
  );
}
