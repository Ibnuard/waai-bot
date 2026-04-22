const axios = require('axios');
const { generateText } = require('ai');
const { createOpenAICompatible } = require('@ai-sdk/openai-compatible');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const configManager = require('./config_manager');

class AiManager {
    constructor() {
        this.history = new Map(); // Store history by senderId
        this.maxHistory = 10; // Keep last 10 messages
    }

    _getHeaders(apiKey) {
        return {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    async generateResponse(userMessage, senderId) {
        const profile = configManager.getActiveProfile();

        if (!profile.apiKey && profile.provider !== 'local') {
            throw new Error('API Key belum diatur untuk profil ini. Silakan atur di dashboard.');
        }

        // Prepare messages
        let messages = [];
        messages.push({ role: 'system', content: profile.soul });
        if (profile.useHistory) {
            const userHistory = this.history.get(senderId) || [];
            messages = [...messages, ...userHistory];
        }
        messages.push({ role: 'user', content: userMessage });

        try {
            let aiResponse = '';

            if (profile.provider === 'openrouter') {
                // Strategy: Axios (Stable for OpenRouter)
                const headers = this._getHeaders(profile.apiKey);
                const response = await axios.post(`${profile.baseUrl}/chat/completions`, {
                    model: profile.model,
                    messages: messages,
                }, { 
                    headers: {
                        ...headers,
                        'HTTP-Referer': 'https://github.com/Ibnuard/waai-bot',
                        'X-Title': 'WAAI Bot Dashboard'
                    }
                });
                aiResponse = response.data.choices?.[0]?.message?.content || '';
            } else if (profile.provider === 'gemini') {
                // Strategy: Google AI SDK (Native)
                const google = createGoogleGenerativeAI({
                    apiKey: profile.apiKey
                });
                const { text } = await generateText({
                    model: google(profile.model),
                    messages: messages,
                });
                aiResponse = text;
            } else if (profile.provider === 'custom' || profile.provider === 'local') {
                // Strategy: Vercel AI SDK (For Custom / Local)
                const headers = this._getHeaders(profile.apiKey || 'not-needed');
                const provider = createOpenAICompatible({
                    name: profile.provider || 'custom',
                    baseURL: profile.baseUrl,
                    headers: headers
                });
                const { text } = await generateText({
                    model: provider(profile.model),
                    messages: messages,
                });
                aiResponse = text;
            }

            // Update history if enabled
            if (profile.useHistory) {
                let userHistory = this.history.get(senderId) || [];
                userHistory.push({ role: 'user', content: userMessage });
                userHistory.push({ role: 'assistant', content: aiResponse });
                if (userHistory.length > this.maxHistory * 2) {
                    userHistory = userHistory.slice(-this.maxHistory * 2);
                }
                this.history.set(senderId, userHistory);
            }

            return aiResponse;
        } catch (error) {
            console.error('AI Processing Error:', error.response?.data || error);
            const errorMsg = error.response?.data?.error?.message || error.message || 'Unknown error';
            throw new Error(`AI Gagal menjawab: ${errorMsg}`);
        }
    }

    async testConnection(config) {
        const { baseUrl, apiKey, model, provider: providerName, soul } = config;

        if (!apiKey && providerName !== 'local') throw new Error('API Key kosong.');
        if (!baseUrl && providerName !== 'gemini') throw new Error('Base URL kosong.');
        if (!model) throw new Error('Model ID kosong.');

        const headers = this._getHeaders(apiKey);

        console.log(`--- AI TEST CONNECTION START (${providerName}) ---`);
        console.log('Base URL:', baseUrl);
        console.log('Model:', model);
        console.log('Headers:', JSON.stringify(headers, null, 2));

        const testMessages = [
            { role: 'system', content: soul || 'Test connection' },
            { role: 'user', content: 'halo' }
        ];

        try {
            if (providerName === 'openrouter') {
                const response = await axios.post(`${baseUrl}/chat/completions`, {
                    model: model,
                    messages: testMessages,
                    max_tokens: 50
                }, { 
                    headers: {
                        ...headers,
                        'HTTP-Referer': 'https://github.com/Ibnuard/waai-bot',
                        'X-Title': 'WAAI Bot Dashboard'
                    }, 
                    timeout: 20000 
                });

                // Log the FULL response from OpenRouter
                console.log('Full Response Data:', JSON.stringify(response.data, null, 2));
                console.log('--- AI TEST CONNECTION END ---');

                // If we got a valid response structure, the connection works
                if (response.data && response.data.choices) {
                    const content = response.data.choices[0]?.message?.content;
                    return { success: true, message: `Koneksi Berhasil! AI merespons: "${content || '(empty but connected)'}"` };
                } else {
                    return { success: false, message: 'API merespons tapi format tidak dikenali.' };
                }
            } else if (providerName === 'gemini') {
                const google = createGoogleGenerativeAI({
                    apiKey: apiKey
                });
                const { text } = await generateText({
                    model: google(model),
                    messages: testMessages,
                    maxTokens: 50,
                });

                console.log('Response:', text);
                console.log('--- AI TEST CONNECTION END ---');

                return { success: true, message: `Koneksi Berhasil! AI merespons: "${text || '(empty but connected)'}"` };
            } else if (providerName === 'custom' || providerName === 'local') {
                const provider = createOpenAICompatible({
                    name: 'test',
                    baseURL: baseUrl,
                    headers: headers
                });
                const { text } = await generateText({
                    model: provider(model),
                    messages: testMessages,
                    maxTokens: 50
                });

                console.log('Response:', text);
                console.log('--- AI TEST CONNECTION END ---');

                return { success: true, message: `Koneksi Berhasil! AI merespons: "${text || '(empty but connected)'}"` };
            }
        } catch (error) {
            console.error('Test Connection Error:', error.response?.data || error);
            const errorMsg = error.response?.data?.error?.message || error.message || 'Unknown error';
            return { success: false, message: `Koneksi Gagal: ${errorMsg}` };
        }
    }

    async fetchGeminiModels(apiKey) {
        if (!apiKey) throw new Error('API Key Gemini diperlukan.');
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const response = await axios.get(url);
            // Filter only models that support content generation
            return response.data.models
                .filter(m => m.supportedGenerationMethods.includes('generateContent'))
                .map(m => ({
                    id: m.name.replace('models/', ''),
                    displayName: m.displayName
                }));
        } catch (error) {
            console.error('Fetch Gemini Models Error:', error.response?.data || error.message);
            throw new Error('Gagal mengambil daftar model Gemini. Pastikan API Key benar.');
        }
    }

    async fetchLocalModels(baseUrl) {
        if (!baseUrl) throw new Error('Base URL diperlukan untuk fetch model lokal.');
        try {
            // Using OpenAI-compatible endpoint
            const url = `${baseUrl}/models`;
            const response = await axios.get(url);
            if (response.data && response.data.data) {
                return response.data.data.map(m => ({
                    id: m.id,
                    displayName: m.id
                }));
            }
            return [];
        } catch (error) {
            console.error('Fetch Local Models Error:', error.response?.data || error.message);
            throw new Error('Gagal mengambil daftar model lokal. Pastikan server (Ollama/LM Studio) sudah aktif dan Base URL benar.');
        }
    }

    clearHistory(senderId) {
        this.history.delete(senderId);
    }
}

module.exports = new AiManager();
