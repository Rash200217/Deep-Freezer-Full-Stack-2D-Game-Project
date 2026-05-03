import axios from 'axios';

// Production AWS Backend
const BASE_URL = 'https://deepfreeze-api.duckdns.org';

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
