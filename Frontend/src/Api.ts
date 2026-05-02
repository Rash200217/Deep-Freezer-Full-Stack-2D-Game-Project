import axios from 'axios';

// In production (Vercel), points to Render backend.
// In local dev, empty string so Vite proxy handles routing.
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

let authToken = '';
let currentUser = '';
let isAdminUser = false;

export const Api = {
    setToken(token: string, username: string, isAdmin: boolean = false) {
        authToken = token;
        currentUser = username;
        isAdminUser = isAdmin;
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            localStorage.setItem('token', token);
            localStorage.setItem('username', username);
            localStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');
        } else {
            this.logout();
        }
    },

    logout() {
        authToken = '';
        currentUser = '';
        isAdminUser = false;
        delete axios.defaults.headers.common['Authorization'];
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('isAdmin');
    },
    
    getToken() { return authToken; },
    getUsername() { return currentUser; },
    isAdmin() { return isAdminUser; },

    async login(username: string, password: string = 'password') {
        const res = await axios.post(`${BASE_URL}/api/auth/login`, { username, password });
        this.setToken(res.data.token, res.data.username, res.data.isAdmin);
        return res.data;
    },

    async register(username: string, password: string = 'password') {
        const res = await axios.post(`${BASE_URL}/api/auth/register`, { username, password });
        return res.data;
    },

    async submitScore(value: number) {
        if (!authToken || !currentUser || currentUser.startsWith('Guest_') || isAdminUser) return;
        return axios.post(`${BASE_URL}/api/scores`, { value });
    },

    async getLeaderboard() {
        const res = await axios.get(`${BASE_URL}/api/scores/leaderboard`);
        return res.data;
    }
};
