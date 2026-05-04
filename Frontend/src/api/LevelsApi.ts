import axios from 'axios';

const BASE_URL = 'https://deepfreeze-api.duckdns.org/api/levels';

export const LevelsApi = {
    getLevels: async (limit = 20, sort: 'new' | 'top' = 'new') => {
        try {
            const res = await axios.get(`${BASE_URL}?limit=${limit}&sort=${sort}`);
            return res.data;
        } catch {
            return [];
        }
    },

    publishLevel: async (name: string, gridData: string, thumbnail?: string): Promise<boolean> => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return false;

            await axios.post(`${BASE_URL}/publish`, { name, gridData, thumbnail }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return true;
        } catch (e) {
            console.error('Failed to publish level', e);
            return false;
        }
    },

    voteLevel: async (id: number, vote: 1 | -1): Promise<{ rating: number; upvotes: number; downvotes: number } | null> => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return null;
            const res = await axios.post(`${BASE_URL}/${id}/vote`, { vote }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        } catch {
            return null;
        }
    },

    getMyVote: async (id: number): Promise<number> => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return 0;
            const res = await axios.get(`${BASE_URL}/${id}/myvote`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data.vote;
        } catch {
            return 0;
        }
    }
};
