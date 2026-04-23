const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, 'config', 'ai_config.json');
        this.soulPath = path.join(__dirname, 'persona', 'SOUL.md');
        
        this.defaultProfile = {
            id: 'default',
            name: 'Default Profile',
            enabled: false,
            provider: 'openrouter',
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: '',
            triggerPrefix: '/ai ',
            respondAll: false,
            allowGroups: false,
            useHistory: false,
            soul: `# Bot Persona\n\nAnda adalah asisten AI yang ramah dan membantu di WhatsApp. Jawablah pesan dengan singkat dan jelas.`
        };

        this.init();
    }

    init() {
        // Ensure directories exist
        const configDir = path.dirname(this.configPath);
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

        // Migration or initialization
        if (!fs.existsSync(this.configPath)) {
            // First time ever: Check if old SOUL.md exists to migrate
            let initialSoul = this.defaultProfile.soul;
            if (fs.existsSync(this.soulPath)) {
                try {
                    initialSoul = fs.readFileSync(this.soulPath, 'utf8');
                } catch (e) {}
            }

            const initialConfig = {
                activeProfileId: 'default',
                profiles: [{ ...this.defaultProfile, soul: initialSoul }]
            };
            this._writeConfig(initialConfig);
        } else {
            // Check if existing config is in old format
            let config = this._readConfig();
            if (!config.profiles) {
                // Migrate single config object to multi-profile
                let oldSoul = this.defaultProfile.soul;
                if (fs.existsSync(this.soulPath)) {
                    try {
                        oldSoul = fs.readFileSync(this.soulPath, 'utf8');
                    } catch (e) {}
                }

                const migratedConfig = {
                    activeProfileId: 'default',
                    profiles: [{ 
                        ...this.defaultProfile, 
                        ...config, 
                        id: 'default', 
                        name: 'Migrated Profile',
                        soul: oldSoul 
                    }]
                };
                this._writeConfig(migratedConfig);
            }
        }
    }

    _readConfig() {
        try {
            const data = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            console.error('Error reading AI config:', e);
            return { activeProfileId: 'default', profiles: [this.defaultProfile] };
        }
    }

    _writeConfig(config) {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 4), 'utf8');
            return true;
        } catch (e) {
            console.error('Error writing AI config:', e);
            return false;
        }
    }

    getAiConfig() {
        return this._readConfig();
    }

    getActiveProfile() {
        const config = this._readConfig();
        const active = config.profiles.find(p => p.id === config.activeProfileId);
        return active || config.profiles[0] || this.defaultProfile;
    }

    switchProfile(id) {
        const config = this._readConfig();
        if (config.profiles.find(p => p.id === id)) {
            config.activeProfileId = id;
            return this._writeConfig(config);
        }
        return false;
    }

    addProfile(name, copyFromId = null) {
        const config = this._readConfig();
        let baseProfile = this.defaultProfile;

        if (copyFromId) {
            const found = config.profiles.find(p => p.id === copyFromId);
            if (found) baseProfile = found;
        }

        const newProfile = {
            ...baseProfile,
            id: uuidv4(), 
            name: name || `Profile ${config.profiles.length + 1}`
        };

        config.profiles.push(newProfile);
        config.activeProfileId = newProfile.id;
        this._writeConfig(config);
        return newProfile;
    }

    updateActiveProfile(updates) {
        const config = this._readConfig();
        const index = config.profiles.findIndex(p => p.id === config.activeProfileId);
        if (index !== -1) {
            config.profiles[index] = { ...config.profiles[index], ...updates };
            return this._writeConfig(config);
        }
        return false;
    }

    deleteProfile(id) {
        const config = this._readConfig();
        if (config.profiles.length <= 1) return false; // Don't delete the last one

        config.profiles = config.profiles.filter(p => p.id !== id);
        
        if (config.activeProfileId === id) {
            config.activeProfileId = config.profiles[0].id;
        }
        
        return this._writeConfig(config);
    }
}

module.exports = new ConfigManager();
