import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Truck, MapPin, History, BarChart3, User, LogOut, ShieldCheck, Clock, ChevronLeft } from 'lucide-react';


export default function Navbar({ activeTab, setActiveTab, onOpenAuth, onExitInstrument }) {
  const { user, logout } = useContext(AuthContext);
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header style={{
      background: 'rgba(246, 244, 236, 0.94)',
      borderBottom: '1px solid var(--border-strong)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      backdropFilter: 'blur(16px)'
    }}>
      <div style={{
        maxWidth: '1540px',
        margin: '0 auto',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        rowGap: '10px'
      }}>
        {/* Brand Identity */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
          onClick={() => setActiveTab('planner')}
        >
          <div style={{
            background: 'var(--text-primary)',
            color: '#fff',
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)'
          }}>
            <Truck size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Spotter AI
              </span>
              <span className="status-pill pill-emerald" style={{ fontSize: '0.65rem' }}>
                <ShieldCheck size={11} /> § 395 READY
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>
              COMMERCIAL FLEET HOS & ELD DISPATCHER
            </div>
          </div>
        </div>

        {/* Center Live Telemetry Clock */}
        <div className="telemetry-clock"
          style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'var(--bg-input)',
          padding: '6px 16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.78rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <Clock size={13} color="var(--primary)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{timeStr}</span>
          </div>
          <div style={{ width: 1, height: 14, background: 'var(--border-subtle)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-emerald)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block' }} />
            <span style={{ fontWeight: 600 }}>TELEMETRY ONLINE</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {onExitInstrument && (
            <button
              onClick={onExitInstrument}
              className="btn btn-sm"
              style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent' }}
            >
              <ChevronLeft size={15} /> Instrument
            </button>
          )}

          <button
            onClick={() => setActiveTab('planner')}
            className="btn btn-sm"
            style={{
              background: activeTab === 'planner' ? 'var(--primary-subtle)' : 'transparent',
              color: activeTab === 'planner' ? 'var(--primary)' : 'var(--text-secondary)',
              border: activeTab === 'planner' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
            }}
          >
            <MapPin size={15} /> Dispatch Console
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className="btn btn-sm"
            style={{
              background: activeTab === 'analytics' ? 'var(--primary-subtle)' : 'transparent',
              color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--text-secondary)',
              border: activeTab === 'analytics' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
            }}
          >
            <BarChart3 size={15} /> Fleet Analytics
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className="btn btn-sm"
            style={{
              background: activeTab === 'history' ? 'var(--primary-subtle)' : 'transparent',
              color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-secondary)',
              border: activeTab === 'history' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
            }}
          >
            <History size={15} /> Trip Archive
          </button>
        </nav>

        {/* User Profile / Auth State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {user.driver_name || user.email}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {user.carrier_name || 'Carrier Fleet'}
                </div>
              </div>
              <button 
                onClick={logout} 
                className="btn btn-secondary btn-sm" 
                title="Sign Out"
                style={{ padding: '7px 10px' }}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button 
              className="btn btn-primary btn-sm" 
              onClick={onOpenAuth}
            >
              <User size={14} /> Driver Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
