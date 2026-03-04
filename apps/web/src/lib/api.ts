// apps/web/src/lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000', // 對接我們的 NestJS 後端
  headers: {
    'Content-Type': 'application/json',
  },
});

// 請求攔截器：自動從 localStorage 抓取 Token 並塞入 Header
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;