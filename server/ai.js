const axios = require('axios');
const configManager = require('./config_manager');

class AiManager {
    constructor() {
        this.history = new Map(); // Store history by senderId
        this.maxHistory = 10; // Keep last 10 messages
    }

    async generateResponse(userMessage, senderId) {
        const config = configManager.getAiConfig();
        const soul = configManager.getSoul();

        if (!config.apiKey) {
            throw new Error('API Key belum diatur. Silakan atur di dashboard.');
        }

        // Prepare messages
        let messages = [];
        
        // System prompt (SOUL.md)
        messages.push({ role: 'system', content: soul });

        // Add history if enabled
        if (config.useHistory) {
            const userHistory = this.history.get(senderId) || [];
            messages = [...messages, ...userHistory];
        }

        // Add current message
        messages.push({ role: 'user', content: userMessage });

        try {
            const response = await axios.post(`${config.baseUrl}/chat/completions`, {
                model: config.model,
                messages: messages,
            }, {
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const aiResponse = response.data.choices[0].message.content;

            // Update history if enabled
            if (config.useHistory) {
                let userHistory = this.history.get(senderId) || [];
                userHistory.push({ role: 'user', content: userMessage });
                userHistory.push({ role: 'assistant', content: aiResponse });

                // Keep only maxHistory
                if (userHistory.length > this.maxHistory * 2) {
                    userHistory = userHistory.slice(-this.maxHistory * 2);
                }
                this.history.set(senderId, userHistory);
            }

            return aiResponse;
        } catch (error) {
            console.error('AI Processing Error:', error.response?.data || error.message);
            throw new Error(`AI Gagal menjawab: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    clearHistory(senderId) {
        this.history.delete(senderId);
    }
}

module.exports = new AiManager();
