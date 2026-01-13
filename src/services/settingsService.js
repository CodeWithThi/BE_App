
import fs from 'fs/promises';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

const defaultSettings = {
    centerName: "Trung Tâm Dạy Học ABC",
    centerCode: "TTDH-ABC",
    address: "123 Đường ABC, Quận 1, TP.HCM",
    phone: "028 1234 5678",
    email: "contact@trungtam.edu.vn",
    warningDays: 3,
    criticalDays: 1,
    emailNotify: true,
    dailyReminder: true,
    latenotify: true,
    maxUsers: 50,
    maxProjects: 20,
    maxFileSize: 25,
    maxStorage: 10,
    strongPassword: true,
    rotatePassword: false,
    lockAccount: true
};

const settingsService = {
    getSettings: async () => {
        try {
            const data = await fs.readFile(SETTINGS_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // If file doesn't exist, return default and create it
            if (error.code === 'ENOENT') {
                await fs.writeFile(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
                return defaultSettings;
            }
            throw error;
        }
    },

    updateSettings: async (newSettings) => {
        const current = await settingsService.getSettings();
        const updated = { ...current, ...newSettings };
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2));
        return updated;
    }
};

export default settingsService;
