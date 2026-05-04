import axios from 'axios';

export const AchievementsApi = {
    unlock: async (key: string): Promise<{ isNew: boolean; icon: string; title: string; description: string } | null> => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return null;
            const res = await axios.post('https://deepfreeze-api.duckdns.org/api/achievements/unlock', { key }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        } catch {
            return null;
        }
    },

    getMine: async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return null;
            const res = await axios.get('https://deepfreeze-api.duckdns.org/api/achievements/mine', {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        } catch {
            return null;
        }
    }
};
