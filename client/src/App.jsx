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
  
  // AI & Persona State
  const [activeView, setActiveView] = useState('home'); // 'home' or 'settings'
  const [aiConfig, setAiConfig] = useState({
    activeProfileId: 'default',
    profiles: []
  });
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [copyFromId, setCopyFromId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [geminiModels, setGeminiModels] = useState([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  // Helper to get active profile data
  const activeProfile = aiConfig.profiles.find(p => p.id === aiConfig.activeProfileId);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socket.emit('ai-config-get');
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

    socket.on('ai-config-data', (config) => {
      if (config) setAiConfig(config);
    });

    socket.on('ai-config-res', ({ success }) => {
      setSaveStatus({ 
        type: success ? 'success' : 'error', 
        message: success ? 'Konfigurasi profil aktif berhasil disimpan!' : 'Gagal menyimpan konfigurasi.' 
      });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    });

    socket.on('ai-profile-res', ({ success, action }) => {
      let msg = '';
      if (action === 'switch') msg = 'Berpindah profil berhasil!';
      if (action === 'add') msg = 'Profil baru berhasil dibuat!';
      if (action === 'delete') msg = 'Profil berhasil dihapus!';

      setSaveStatus({ 
        type: success ? 'success' : 'error', 
        message: success ? msg : `Gagal ${action} profil.` 
      });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    });

    socket.on('soul-res', ({ success }) => {
      setSaveStatus({ 
        type: success ? 'success' : 'error', 
        message: success ? 'Persona berhasil diperbarui!' : 'Gagal memperbarui persona.' 
      });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    });

    socket.on('ai-test-res', ({ success, message }) => {
      setIsTesting(false);
      setSaveStatus({ 
        type: success ? 'success' : 'error', 
        message: message 
      });
      if (success) {
        setTimeout(() => setSaveStatus({ type: '', message: '' }), 5000);
      } else {
        // Keep error visible longer
        setTimeout(() => setSaveStatus({ type: '', message: '' }), 8000);
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

    socket.on('ai-gemini-models-data', (res) => {
      setIsFetchingModels(false);
      if (res.success) {
        setGeminiModels(res.models);
      } else {
        alert(res.message);
      }
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

  const updateProfileField = (field, value) => {
    const updatedProfiles = aiConfig.profiles.map(p => 
      p.id === aiConfig.activeProfileId ? { ...p, [field]: value } : p
    );
    setAiConfig({ ...aiConfig, profiles: updatedProfiles });
  };

  const handleSaveConfig = () => {
    socket.emit('ai-config-update', activeProfile);
  };

  const handleSaveSoul = () => {
    socket.emit('soul-update', activeProfile.soul);
  };

  const handleProfileSwitch = (id) => {
    socket.emit('ai-profile-switch', id);
  };

  const handleAddProfile = () => {
    if (!newProfileName.trim()) return;
    socket.emit('ai-profile-add', { name: newProfileName, copyFromId });
    setNewProfileName('');
    setCopyFromId('');
    setShowAddModal(false);
  };

  const fetchGeminiModels = () => {
    if (!activeProfile.apiKey) return alert('Masukkan API Key dulu');
    setIsFetchingModels(true);
    socket.emit('ai-gemini-models-fetch', activeProfile.apiKey);
  };

  const handleTestConnection = () => {
    if (isTesting) return;
    setIsTesting(true);
    socket.emit('ai-test', {
      provider: activeProfile.provider,
      baseUrl: activeProfile.baseUrl,
      apiKey: activeProfile.apiKey,
      model: activeProfile.model,
      soul: activeProfile.soul
    });
  };

  const handleDeleteProfile = () => {
    if (aiConfig.profiles.length <= 1) return;
    if (window.confirm(`Hapus profil "${activeProfile.name}"?`)) {
      socket.emit('ai-profile-delete', aiConfig.activeProfileId);
    }
  };

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

        {/* Global Save Status Notification */}
        <AnimatePresence>
          {saveStatus.message && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl border ${
                saveStatus.type === 'success' ? 'bg-green-600 border-green-400' : 'bg-red-600 border-red-400'
              } text-white font-bold flex items-center gap-3`}
            >
              {saveStatus.type === 'success' ? <Zap className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {saveStatus.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Profile Modal */}
        <AnimatePresence>
          {showAddModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowAddModal(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="relative glass p-8 rounded-3xl w-full max-w-md space-y-6"
              >
                <h3 className="text-xl font-bold">Buat Profil AI Baru</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Profil</label>
                    <input 
                      type="text" 
                      value={newProfileName} 
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="Contoh: Bot Sales"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Salin Dari (Opsional)</label>
                    <select 
                      value={copyFromId} 
                      onChange={(e) => setCopyFromId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="" className="bg-[#0f172a]">-- Mulai dari Awal --</option>
                      {aiConfig.profiles.map(p => (
                        <option key={p.id} value={p.id} className="bg-[#0f172a]">{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all">Batal</button>
                  <button onClick={handleAddProfile} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20">Buat Profil</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
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
            <div className="flex items-center gap-2 h-10">
              <button 
                onClick={() => setActiveView(activeView === 'home' ? 'settings' : 'home')}
                className={`p-3 rounded-full transition-all ${activeView === 'settings' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                title={activeView === 'settings' ? 'Kembali ke Dashboard' : 'Buka Pengaturan AI'}
              >
                <LayoutDashboard className="w-5 h-5" />
              </button>
              {status === 'DISCONNECTED' ? (
                <button onClick={startWA} className="h-full px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all font-semibold shadow-lg shadow-blue-600/20 flex items-center gap-2">
                  <Power className="w-4 h-4" /> Start
                </button>
              ) : (
                <button onClick={stopWA} className="h-full px-6 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-full transition-all font-semibold flex items-center gap-2">
                  <Power className="w-4 h-4" /> Stop
                </button>
              )}
            </div>
          </div>
        </header>

        {activeView === 'home' ? (
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

                <div className="mt-8 grid grid-cols-1 gap-4 w-full">
                  <button onClick={resetSession} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Reset Session</span>
                  </button>
                </div>
              </div>

              {/* Quick AI Toggle View */}
              <div className={`glass rounded-3xl p-6 border ${activeProfile?.enabled ? 'border-blue-500/30' : 'border-white/5'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Zap className={`w-5 h-5 ${activeProfile?.enabled ? 'text-blue-400' : 'text-slate-500'}`} />
                    <span className="font-bold">AI: {activeProfile?.name || 'Disabled'}</span>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${activeProfile?.enabled ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-500'}`}>
                    {activeProfile?.enabled ? 'Active' : 'Offline'}
                  </div>
                </div>
                <button 
                  onClick={() => setActiveView('settings')}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold transition-all"
                >
                  {activeProfile ? 'Configure Profile' : 'Setup AI'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Profile Management Toolbar */}
            <div className="glass p-4 rounded-3xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <select 
                    value={aiConfig.activeProfileId}
                    onChange={(e) => handleProfileSwitch(e.target.value)}
                    className="bg-transparent text-sm font-bold outline-none cursor-pointer"
                    disabled={aiConfig.profiles.length === 0}
                  >
                    {aiConfig.profiles.length === 0 && <option value="">No Profiles</option>}
                    {aiConfig.profiles.map(p => (
                      <option key={p.id} value={p.id} className="bg-[#0f172a]">{p.name}</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20"
                >
                   + New Profile
                </button>
              </div>

              {activeProfile && (
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    value={activeProfile.name}
                    onChange={(e) => updateProfileField('name', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all w-48"
                    placeholder="Nama Profil"
                  />
                  <button 
                    onClick={handleDeleteProfile}
                    disabled={aiConfig.profiles.length <= 1}
                    className="p-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-xl transition-all disabled:opacity-20"
                    title="Hapus Profil"
                  >
                    <AlertCircle className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {activeProfile ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* AI Configuration */}
                <div className="glass rounded-3xl p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap className="w-6 h-6 text-blue-400" />
                      <h2 className="text-xl font-bold">Provider Config</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-400">Status</span>
                      <button 
                        onClick={() => updateProfileField('enabled', !activeProfile.enabled)}
                        className={`w-12 h-6 rounded-full transition-all relative ${activeProfile.enabled ? 'bg-blue-600' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${activeProfile.enabled ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Provider</label>
                      <select 
                        value={activeProfile.provider}
                        onChange={(e) => updateProfileField('provider', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all"
                      >
                        <option value="openrouter" className="bg-[#0f172a]">OpenRouter</option>
                        <option value="gemini" className="bg-[#0f172a]">Google Gemini (Native)</option>
                        <option value="custom" className="bg-[#0f172a]">Custom (OpenAI Compatible)</option>
                      </select>
                    </div>

                    {activeProfile.provider !== 'gemini' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Base URL</label>
                        <input 
                          type="text"
                          value={activeProfile.baseUrl}
                          onChange={(e) => updateProfileField('baseUrl', e.target.value)}
                          placeholder="https://api.openai.com/v1"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">API Key</label>
                      <input 
                        type="password"
                        value={activeProfile.apiKey}
                        onChange={(e) => updateProfileField('apiKey', e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Model ID</label>
                          {activeProfile.provider === 'gemini' && (
                            <button 
                              onClick={fetchGeminiModels}
                              disabled={isFetchingModels}
                              className="text-[10px] font-bold text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                            >
                              {isFetchingModels ? 'Fetching...' : '↻ Fetch Models'}
                            </button>
                          )}
                        </div>
                        
                        {activeProfile.provider === 'gemini' && geminiModels.length > 0 ? (
                          <select 
                            value={activeProfile.model}
                            onChange={(e) => updateProfileField('model', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all"
                          >
                            <option value="">Pilih Model Gemini</option>
                            {geminiModels.map(m => (
                              <option key={m.id} value={m.id} className="bg-[#0f172a]">
                                {m.displayName} ({m.id})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input 
                            type="text"
                            value={activeProfile.model}
                            onChange={(e) => updateProfileField('model', e.target.value)}
                            placeholder={activeProfile.provider === 'gemini' ? "Klik 'Fetch Models' atau ketik ID" : "gpt-3.5-turbo"}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trigger Prefix</label>
                        <input 
                          type="text"
                          value={activeProfile.triggerPrefix}
                          onChange={(e) => updateProfileField('triggerPrefix', e.target.value)}
                          placeholder="/ai "
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div>
                        <p className="font-bold">Use Chat History</p>
                        <p className="text-xs text-slate-400">Bot akan ingat 10 pesan terakhir per kontak</p>
                      </div>
                      <button 
                        onClick={() => updateProfileField('useHistory', !activeProfile.useHistory)}
                        className={`w-12 h-6 rounded-full transition-all relative ${activeProfile.useHistory ? 'bg-blue-600' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${activeProfile.useHistory ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className={`flex-1 py-4 rounded-2xl font-bold transition-all border flex items-center justify-center gap-2 ${
                          isTesting 
                          ? 'bg-white/5 border-white/10 text-slate-500' 
                          : 'bg-transparent border-blue-500/50 text-blue-400 hover:bg-blue-500/10'
                        }`}
                      >
                        {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {isTesting ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button 
                        onClick={handleSaveConfig}
                        className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20"
                      >
                        Update Current Profile
                      </button>
                    </div>
                  </div>
                </div>

                {/* Persona SOUL Editor */}
                <div className="glass rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <LayoutDashboard className="w-6 h-6 text-purple-400" />
                    <h2 className="text-xl font-bold">Persona (Soul)</h2>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Instruksi sistem khusus untuk profil <strong>{activeProfile.name}</strong>.
                    </p>
                    <textarea 
                      value={activeProfile.soul}
                      onChange={(e) => updateProfileField('soul', e.target.value)}
                      className="w-full h-[380px] bg-white/5 border border-white/10 rounded-2xl p-6 focus:border-purple-500 outline-none transition-all font-mono text-sm scrollbar-thin scrollbar-thumb-white/10 resize-none"
                      placeholder="# Bot Persona..."
                    />
                    <button 
                      onClick={handleSaveSoul}
                      className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-purple-600/20"
                    >
                      Update Persona
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass rounded-3xl p-20 flex flex-col items-center justify-center text-center space-y-6">
                <div className="p-6 bg-white/5 rounded-full">
                  <Zap className="w-12 h-12 text-slate-500 opacity-20" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Belum Ada Profil AI</h3>
                  <p className="text-slate-400 max-w-sm mx-auto">
                    Klik tombol <strong>+ New Profile</strong> di atas untuk membuat konfigurasi AI pertama Anda.
                  </p>
                </div>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold transition-all"
                >
                  Create Your First Profile
                </button>
              </div>
            )}
          </div>
        )}
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
