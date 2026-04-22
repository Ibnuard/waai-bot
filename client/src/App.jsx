import React, { useState, useEffect, Component } from 'react';
import { io } from 'socket.io-client';
import QRCodeLib from 'react-qr-code';
import { 
  MessageSquare, 
  Send, 
  Activity, 
  Clock, 
  Terminal, 
  AlertCircle, 
  Zap,
  Power,
  RefreshCw,
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const socket = io('http://localhost:3000');

// Error Boundary untuk menangkap crash rendering React
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '2rem',
            borderRadius: '1.5rem',
            maxWidth: '28rem',
            width: '100%',
            textAlign: 'center',
            color: '#e2e8f0'
          }}>
            <AlertCircle style={{ width: 64, height: 64, color: '#f87171', margin: '0 auto 1rem' }} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
              Dashboard Crash
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {this.state.error?.message || 'Terjadi kesalahan saat merender dashboard.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#2563eb',
                color: 'white',
                borderRadius: '9999px',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Resolve QRCode component — handle default vs named export
const QRCodeComponent = QRCodeLib?.default || QRCodeLib;

// Komponen QR yang aman — menangkap error sendiri
function SafeQRCode({ value }) {
  if (!value || typeof value !== 'string' || value.length < 10) {
    return (
      <div className="w-[200px] h-[200px] flex items-center justify-center text-slate-400">
        <span className="text-xs">QR Data tidak valid</span>
      </div>
    );
  }

  return (
    <QRCodeComponent
      value={value}
      size={200}
      level="L"
      style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
    />
  );
}

function Dashboard() {
  const [status, setStatus] = useState('DISCONNECTED');
  const [qr, setQr] = useState(null);
  const [stats, setStats] = useState({ messagesSent: 0, messagesReceived: 0, startTime: null });
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('init-state', (state) => {
      console.log('init-state:', state);
      if (state) {
        setStatus(state.status || 'DISCONNECTED');
        setQr(typeof state.qr === 'string' ? state.qr : null);
        setStats(state.stats || { messagesSent: 0, messagesReceived: 0, startTime: null });
        setLogs(Array.isArray(state.logs) ? state.logs : []);
      }
    });

    socket.on('status-update', (data) => {
      console.log('status-update:', data);
      if (data && data.status) {
        setStatus(data.status);
        if (data.status === 'CONNECTED' || data.status === 'DISCONNECTED') {
          setQr(null);
        }
      }
    });

    socket.on('qr-update', (newQr) => {
      console.log('qr-update received, type:', typeof newQr, 'length:', newQr?.length);
      if (typeof newQr === 'string' && newQr.length > 0) {
        setQr(newQr);
      } else {
        setQr(null);
      }
    });

    socket.on('stats-update', (newStats) => {
      if (newStats) setStats(prev => ({ ...prev, ...newStats }));
    });

    socket.on('new-log', (log) => {
      if (log && log.message) {
        setLogs(prev => [log, ...prev].slice(0, 50));
      }
    });

    socket.on('connect_error', (err) => {
      console.error('Socket error:', err);
    });

    return () => {
      socket.off('connect');
      socket.off('init-state');
      socket.off('status-update');
      socket.off('qr-update');
      socket.off('stats-update');
      socket.off('new-log');
      socket.off('connect_error');
    };
  }, []);

  const startWA = () => socket.emit('start-wa');
  const stopWA = () => socket.emit('stop-wa');
  const resetSession = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus sesi dan login ulang?')) {
      socket.emit('reset-session');
    }
  };

  const formatTime = (val) => {
    if (!val) return '-';
    try {
      const d = new Date(val);
      return isNaN(d.getTime()) ? '-' : d.toLocaleTimeString();
    } catch { return '-'; }
  };

  const statusColor = (() => {
    switch (status) {
      case 'CONNECTED': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'CONNECTING':
      case 'STARTING':
      case 'AUTHENTICATING': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'QR_REQUIRED': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-red-400 bg-red-400/10 border-red-400/20';
    }
  })();

  const statusLabel = (() => {
    switch (status) {
      case 'STARTING': return 'Mempersiapkan...';
      case 'CONNECTING': return 'Menghubungkan...';
      case 'QR_REQUIRED': return 'Menunggu Scan QR';
      case 'AUTHENTICATING': return 'Autentikasi...';
      case 'CONNECTED': return 'Aktif';
      case 'DISCONNECTED': return 'Offline';
      default: return status || 'Unknown';
    }
  })();

  const isLoading = ['STARTING', 'CONNECTING', 'AUTHENTICATING'].includes(status);
  const dotColor = status === 'CONNECTED' ? 'bg-green-400'
    : isLoading ? 'bg-yellow-400'
    : status === 'QR_REQUIRED' ? 'bg-blue-400'
    : 'bg-red-400';

  const ss = stats || { messagesSent: 0, messagesReceived: 0, startTime: null };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass p-6 rounded-3xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-2xl">
              <MessageSquare className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text">WAAI Dashboard</h1>
              <p className="text-slate-400 text-sm">WhatsApp AI Bot Manager</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium ${statusColor} border`}>
              <div className={`w-2 h-2 rounded-full ${isLoading || status === 'CONNECTED' ? 'animate-pulse' : ''} ${dotColor}`} />
              {statusLabel}
            </div>
            {status === 'DISCONNECTED' ? (
              <button onClick={startWA} className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all font-semibold shadow-lg shadow-blue-600/20">
                <Power className="w-4 h-4" /> Start
              </button>
            ) : (
              <button onClick={stopWA} className="flex items-center gap-2 px-6 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-full transition-all font-semibold">
                <Power className="w-4 h-4" /> Stop
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <StatsCard icon={<Send className="w-5 h-5 text-blue-400" />} label="Pesan Terkirim" value={ss.messagesSent ?? 0} />
              <StatsCard icon={<MessageSquare className="w-5 h-5 text-purple-400" />} label="Pesan Diterima" value={ss.messagesReceived ?? 0} />
              <StatsCard icon={<Clock className="w-5 h-5 text-emerald-400" />} label="Waktu Aktif" value={formatTime(ss.startTime)} />
            </div>

            {/* Logs */}
            <div className="glass rounded-3xl overflow-hidden flex flex-col h-[500px]">
              <div className="p-6 border-b border-white/10 flex items-center gap-3">
                <Terminal className="w-5 h-5 text-blue-400" />
                <h2 className="font-bold">System Logs</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm">
                <AnimatePresence initial={false}>
                  {Array.isArray(logs) && logs.map((log, i) => (
                    <motion.div
                      key={log?.id || `log-${i}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-xl border border-white/5 ${
                        log?.type === 'error' ? 'bg-red-400/5 text-red-300' :
                        log?.type === 'message' ? 'bg-blue-400/5 text-blue-300' :
                        log?.type === 'success' ? 'bg-green-400/5 text-green-300' : 'bg-white/5'
                      }`}
                    >
                      <span className="opacity-40 mr-3">[{formatTime(log?.timestamp)}]</span>
                      {String(log?.message || '')}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {(!logs || logs.length === 0) && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 italic">
                    <Activity className="w-8 h-8 mb-2 opacity-20" />
                    Belum ada log aktivitas...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">

            {/* QR Section */}
            <div className="glass rounded-3xl p-8 flex flex-col items-center text-center">
              <h2 className="text-xl font-bold mb-2">WhatsApp Auth</h2>
              <p className="text-slate-400 text-sm mb-6">Scan QR code di bawah untuk menghubungkan bot</p>

              <div className="relative p-6 bg-white rounded-3xl shadow-2xl shadow-blue-500/10">
                {qr && typeof qr === 'string' ? (
                  <ErrorBoundary>
                    <SafeQRCode value={qr} />
                  </ErrorBoundary>
                ) : status === 'CONNECTED' ? (
                  <div className="w-[200px] h-[200px] flex flex-col items-center justify-center text-green-600">
                    <Zap className="w-16 h-16 mb-4 animate-bounce" />
                    <span className="font-bold">WhatsApp Linked!</span>
                  </div>
                ) : (
                  <div className="w-[200px] h-[200px] flex flex-col items-center justify-center text-slate-300">
                    {isLoading || status === 'QR_REQUIRED' ? (
                      <>
                        <RefreshCw className="w-12 h-12 mb-4 animate-spin opacity-50" />
                        <span className="text-xs opacity-50 italic">Memproses koneksi...</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                        <span className="text-xs opacity-50">Service Offline</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                <button onClick={resetSession} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all flex flex-col items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Reset Session</span>
                </button>
                <button className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all flex flex-col items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Settings</span>
                </button>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-600 p-6 rounded-3xl relative overflow-hidden group">
              <Zap className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12 group-hover:scale-125 transition-transform" />
              <h3 className="text-white font-bold mb-2">Bot Tips</h3>
              <p className="text-white/80 text-xs leading-relaxed">
                Gunakan dashboard ini untuk memantau aktivitas bot secara real-time. Anda bisa melihat statistik pesan dan log sistem secara detail.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ icon, label, value }) {
  return (
    <div className="glass p-6 rounded-3xl flex items-center gap-4 hover:border-white/20 transition-all group">
      <div className="p-3 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold">{String(value)}</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}

export default App;
