const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const waManager = require('./whatsapp');
const configManager = require('./config_manager');
const aiManager = require('./ai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the React app if in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
}

// Attach IO to WhatsApp Manager
waManager.setIO(io);

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Send current state on connection
    socket.emit('init-state', waManager.getState());

    socket.on('start-wa', () => {
        console.log(`[EVENT] Menerima permintaan 'start-wa' dari client: ${socket.id}`);
        waManager.init();
    });

    socket.on('stop-wa', async () => {
        await waManager.stop();
    });

    socket.on('reset-session', async () => {
        await waManager.resetSession();
    });

    // AI Configuration & Profiles Events
    socket.on('ai-config-get', () => {
        socket.emit('ai-config-data', configManager.getAiConfig());
    });

    socket.on('ai-config-update', (updates) => {
        const success = configManager.updateActiveProfile(updates);
        socket.emit('ai-config-res', { success });
        if (success) {
            socket.emit('ai-config-data', configManager.getAiConfig());
            waManager.addLog(`Konfigurasi profil AI aktif diperbarui.`, 'info');
        }
    });

    socket.on('ai-profile-switch', (id) => {
        const success = configManager.switchProfile(id);
        socket.emit('ai-profile-res', { success, action: 'switch' });
        if (success) {
            socket.emit('ai-config-data', configManager.getAiConfig());
            waManager.addLog(`Berpindah ke profil AI: ${id}`, 'info');
        }
    });

    socket.on('ai-profile-add', ({ name, copyFromId }) => {
        const newProfile = configManager.addProfile(name, copyFromId);
        socket.emit('ai-profile-res', { success: !!newProfile, action: 'add' });
        if (newProfile) {
            socket.emit('ai-config-data', configManager.getAiConfig());
            waManager.addLog(`Profil AI baru dibuat: ${name}`, 'success');
        }
    });

    socket.on('ai-profile-delete', (id) => {
        const success = configManager.deleteProfile(id);
        socket.emit('ai-profile-res', { success, action: 'delete' });
        if (success) {
            socket.emit('ai-config-data', configManager.getAiConfig());
            waManager.addLog(`Profil AI dihapus: ${id}`, 'warning');
        }
    });

    socket.on('soul-update', (content) => {
        const success = configManager.updateActiveProfile({ soul: content });
        socket.emit('soul-res', { success });
        if (success) {
            socket.emit('ai-config-data', configManager.getAiConfig());
            waManager.addLog(`Persona profil aktif diperbarui.`, 'info');
        }
    });

    socket.on('ai-test', async (config) => {
        waManager.addLog(`Mengetes koneksi AI ke ${config.baseUrl || config.provider}...`, 'info');
        const result = await aiManager.testConnection(config);
        socket.emit('ai-test-res', result);
        if (result.success) {
            waManager.addLog(result.message, 'success');
        } else {
            waManager.addLog(result.message, 'error');
        }
    });

    socket.on('ai-gemini-models-fetch', async (apiKey) => {
        try {
            const models = await aiManager.fetchGeminiModels(apiKey);
            socket.emit('ai-gemini-models-data', { success: true, models });
        } catch (error) {
            socket.emit('ai-gemini-models-data', { success: false, message: error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    waManager.addLog(`Server dashboard aktif di port ${PORT}`);
});
