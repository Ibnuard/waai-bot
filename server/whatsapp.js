const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const aiManager = require('./ai');
const configManager = require('./config_manager');

class WhatsAppManager {
    constructor() {
        this.sock = null;
        this.state = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, CONNECTED
        this.qr = null;
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            startTime: null
        };
        this.logs = [];
        this.io = null; // Socket.io instance
    }

    setIO(io) {
        this.io = io;
    }

    addLog(message, type = 'info') {
        const log = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            message,
            type
        };
        this.logs.push(log);
        if (this.logs.length > 100) this.logs.shift(); // Keep last 100 logs
        
        if (this.io) {
            this.io.emit('new-log', log);
        }
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    updateStatus(status) {
        this.state = status;
        if (this.io) {
            this.io.emit('status-update', { status: this.state });
        }
    }

    updateStats() {
        if (this.io) {
            this.io.emit('stats-update', this.stats);
        }
    }

    // Helper untuk membersihkan JID menjadi nomor telepon saja
    normalizeJid(jid) {
        return jid ? jid.split('@')[0] : 'Unknown';
    }

    async init() {
        if (this.state !== 'DISCONNECTED') return;

        try {
            this.updateStatus('STARTING');
            this.addLog('Menyiapkan file sistem dan konfigurasi...');

            const authPath = path.join(__dirname, '../auth_info_baileys');
            
            if (!fs.existsSync(authPath)){
                fs.mkdirSync(authPath, { recursive: true });
                this.addLog('Folder sesi baru dibuat.');
            }

            this.addLog('Memuat database autentikasi...');
            const { state, saveCreds } = await useMultiFileAuthState(authPath);
            
            this.addLog('Mengecek versi WhatsApp terbaru...');
            const { version, isLatest } = await fetchLatestBaileysVersion();
            this.addLog(`Menggunakan WA v${version.join('.')}, Terbaru: ${isLatest}`);

            this.updateStatus('CONNECTING');
            this.addLog('Menghubungkan ke server WhatsApp (WebSocket)...');

            this.sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
                },
                printQRInTerminal: false,
                authTimeoutMs: 60000,
                connectTimeoutMs: 60000,
            });

            this.sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.qr = qr;
                    this.updateStatus('QR_REQUIRED');
                    if (this.io) this.io.emit('qr-update', qr);
                    this.addLog('QR Code diterima. Menunggu untuk di-scan...', 'info');
                }

                if (connection === 'close') {
                    const statusCode = (lastDisconnect.error instanceof Boom)?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    
                    this.updateStatus('DISCONNECTED');
                    this.qr = null;
                    
                    this.addLog(`Koneksi terputus: ${lastDisconnect.error?.message || 'Reason unknown'} (Code: ${statusCode})`, 'error');
                    
                    if (shouldReconnect) {
                        this.addLog('Mencoba menyambung kembali otomatis dalam 5 detik...', 'info');
                        setTimeout(() => this.init(), 5000);
                    }
                } else if (connection === 'connecting') {
                    this.updateStatus('AUTHENTICATING');
                    this.addLog('Melakukan sinkronisasi data dan autentikasi...');
                } else if (connection === 'open') {
                    this.updateStatus('CONNECTED');
                    this.qr = null;
                    this.stats.startTime = new Date().toISOString();
                    this.addLog('Koneksi Terbuka! Bot sudah siap beraksi.', 'success');
                    this.updateStats();
                }
            });

            this.sock.ev.on('creds.update', saveCreds);

            this.sock.ev.on('messages.upsert', async (m) => {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) {
                    if (msg.key.fromMe && msg.message) {
                        this.stats.messagesSent++;
                        this.updateStats();
                    }
                    return;
                }

                this.stats.messagesReceived++;
                this.updateStats();

                const from = msg.key.remoteJid;
                const pushName = msg.pushName || 'User';
                const content = msg.message.conversation || 
                                msg.message.extendedTextMessage?.text || 
                                msg.message.imageMessage?.caption || 
                                msg.message.videoMessage?.caption || '';

                this.addLog(`[${pushName}] (${this.normalizeJid(from)}): ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`, 'message');

                const profile = configManager.getAiConfig().profiles.find(p => p.id === configManager.getAiConfig().activeProfileId);
                const trigger = (profile.triggerPrefix || '/ai ').trim().toLowerCase();
                const cleanContent = content.trim();

                // Detailed debug log (only in console)
                console.log(`[DEBUG] Check Trigger - msg: "${cleanContent}", trigger: "${trigger}", profile: "${profile.name}", enabled: ${profile.enabled}`);

                // 1. Check for AI Trigger
                if (profile.enabled && cleanContent.toLowerCase().startsWith(trigger)) {
                    const prompt = cleanContent.slice(trigger.length).trim();
                    if (!prompt) return;

                    try {
                        this.addLog(`[AI] Memproses pesan via ${profile.name} (${profile.provider})...`, 'info');
                        const response = await aiManager.generateResponse(prompt, from);
                        await this.sock.sendMessage(from, { text: response }, { quoted: msg });
                        this.addLog(`[AI] Membalas ke ${pushName}`, 'success');
                    } catch (e) {
                        this.addLog(`[AI Error] ${e.message}`, 'error');
                        await this.sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg });
                    }
                    return;
                }

                // 2. Simple Commands (Legacy)
                if (cleanContent.toLowerCase() === '!hi') {
                    try {
                        await this.sock.sendMessage(from, { text: '!halo' }, { quoted: msg });
                        this.addLog(`Membalas !hi ke ${this.normalizeJid(from)}`, 'info');
                    } catch (e) {
                        this.addLog(`Gagal mengirim balasan: ${e.message}`, 'error');
                    }
                }
            });
        } catch (error) {
            this.updateStatus('DISCONNECTED');
            this.addLog(`Gagal Inisialisasi: ${error.message}`, 'error');
            console.error('Inisialisasi error:', error);
        }
    }

    async stop() {
        if (this.sock) {
            try {
                // Defensive removal of listeners
                if (this.sock.ev) {
                    this.sock.ev.removeAllListeners('connection.update');
                    this.sock.ev.removeAllListeners('messages.upsert');
                    this.sock.ev.removeAllListeners('creds.update');
                }
                
                this.addLog('Menutup koneksi WhatsApp...');
                await this.sock.end();
            } catch (e) {
                console.error('Error saat menutup koneksi:', e);
            } finally {
                this.sock = null;
            }
        }
        this.updateStatus('DISCONNECTED');
        this.addLog('Layanan WhatsApp dihentikan.');
    }

    async resetSession() {
        this.addLog('Melakukan reset sesi...', 'warning');
        await this.stop();
        
        const authPath = path.join(__dirname, '../auth_info_baileys');
        if (fs.existsSync(authPath)) {
            try {
                fs.rmSync(authPath, { recursive: true, force: true });
                this.addLog('Folder sesi berhasil dihapus.', 'success');
            } catch (error) {
                this.addLog(`Gagal menghapus folder sesi: ${error.message}`, 'error');
            }
        }
        
        this.qr = null;
        if (this.io) this.io.emit('qr-update', null);
    }

    getState() {
        return {
            status: this.state,
            qr: this.qr,
            stats: this.stats,
            logs: this.logs
        };
    }
}

module.exports = new WhatsAppManager();
