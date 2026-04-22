const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const waManager = require('./whatsapp');
const configManager = require('./config_manager');

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

    // AI Configuration Events
    socket.on('ai-config-get', () => {
        socket.emit('ai-config-data', configManager.getAiConfig());
    });

    socket.on('ai-config-update', (config) => {
        const success = configManager.saveAiConfig(config);
        socket.emit('ai-config-res', { success });
        waManager.addLog(`Konfigurasi AI diperbarui.`, success ? 'info' : 'error');
    });

    socket.on('soul-get', () => {
        socket.emit('soul-data', configManager.getSoul());
    });

    socket.on('soul-update', (content) => {
        const success = configManager.saveSoul(content);
        socket.emit('soul-res', { success });
        waManager.addLog(`Persona (SOUL.md) diperbarui.`, success ? 'info' : 'error');
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    waManager.addLog(`Server dashboard aktif di port ${PORT}`);
});
