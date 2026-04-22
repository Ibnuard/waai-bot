const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, 'config', 'ai_config.json');
        this.soulPath = path.join(__dirname, 'persona', 'SOUL.md');
        
        this.defaultConfig = {
            enabled: false,
            provider: 'openrouter',
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: '',
            model: 'meta-llama/llama-3-8b-instruct',
            triggerPrefix: '/ai ',
            useHistory: false
        };

        this.defaultSoul = `# Bot Persona\n\nAnda adalah asisten AI yang ramah dan membantu di WhatsApp. Jawablah pesan dengan singkat dan jelas.`;
        
        this.init();
    }

    init() {
        // Ensure directories exist
        const configDir = path.dirname(this.configPath);
        const soulDir = path.dirname(this.soulPath);
        
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        if (!fs.existsSync(soulDir)) fs.mkdirSync(soulDir, { recursive: true });

        // Ensure default config exists
        if (!fs.existsSync(this.configPath)) {
            this.saveAiConfig(this.defaultConfig);
        }

        // Ensure default SOUL.md exists
        if (!fs.existsSync(this.soulPath)) {
            this.saveSoul(this.defaultSoul);
        }
    }

    getAiConfig() {
        try {
            const data = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            console.error('Error reading AI config:', e);
            return this.defaultConfig;
        }
    }

    saveAiConfig(config) {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 4), 'utf8');
            return true;
        } catch (e) {
            console.error('Error saving AI config:', e);
            return false;
        }
    }

    getSoul() {
        try {
            return fs.readFileSync(this.soulPath, 'utf8');
        } catch (e) {
            console.error('Error reading SOUL.md:', e);
            return this.defaultSoul;
        }
    }

    saveSoul(content) {
        try {
            fs.writeFileSync(this.soulPath, content, 'utf8');
            return true;
        } catch (e) {
            console.error('Error saving SOUL.md:', e);
            return false;
        }
    }
}

module.exports = new ConfigManager();
