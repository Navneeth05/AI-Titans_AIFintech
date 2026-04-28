import axios from 'axios';
import { auth } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach Firebase ID Token to every request automatically
api.interceptors.request.use(async (config) => {
  try {
    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {
    // Firebase not configured or token fetch failed — proceed without auth header
  }
  return config;
});

// ─── Transactions ──────────────────────────────────────────────────────────────
export const getTransactions = async () => {
  const response = await api.get('/api/v1/transactions');
  return response.data;
};

// ─── Upload Bank Statement ─────────────────────────────────────────────────────
export const uploadBankStatement = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/api/v1/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// ─── Fraud Alerts ──────────────────────────────────────────────────────────────
export const getFraudAlerts = async () => {
  const response = await api.get('/api/v1/fraud/alerts');
  return response.data;
};

export const reviewFraudAlert = async (alertId, action) => {
  // action: 'approve' | 'reject'
  const response = await api.post(`/api/v1/fraud/alerts/${alertId}/review`, { action });
  return response.data;
};

// ─── Credit Score ──────────────────────────────────────────────────────────────
export const getCreditScore = async () => {
  const response = await api.get('/api/v1/credit/score');
  return response.data;
};

// ─── Dashboard (aggregated) – uses mock if backend unavailable ─────────────────
export const getDashboardData = async () => {
  try {
    const [txRes, creditRes, fraudRes] = await Promise.allSettled([
      getTransactions(),
      getCreditScore(),
      getFraudAlerts(),
    ]);

    return {
      creditScore: creditRes.status === 'fulfilled' ? creditRes.value?.score : 785,
      spendingCategories: txRes.status === 'fulfilled'
        ? txRes.value?.categories ?? mockCategories
        : mockCategories,
      recentTransactions: txRes.status === 'fulfilled'
        ? txRes.value?.transactions ?? mockTransactions
        : mockTransactions,
    };
  } catch {
    return { creditScore: 785, spendingCategories: mockCategories, recentTransactions: mockTransactions };
  }
};

// ─── Mock data (used when backend is not running) ──────────────────────────────
const mockCategories = [
  { name: 'Housing', value: 1200 },
  { name: 'Food', value: 400 },
  { name: 'Transport', value: 200 },
  { name: 'Entertainment', value: 150 },
];

const mockTransactions = [
  { id: 1, merchant: 'Amazon', amount: -120.50, date: '2024-10-25', status: 'completed' },
  { id: 2, merchant: 'Salary Credit', amount: 4500.00, date: '2024-10-24', status: 'completed' },
  { id: 3, merchant: 'Unknown Vendor TX-99', amount: -899.99, date: '2024-10-24', status: 'suspicious' },
  { id: 4, merchant: 'Uber', amount: -24.50, date: '2024-10-23', status: 'completed' },
  { id: 5, merchant: 'Netflix', amount: -15.99, date: '2024-10-22', status: 'completed' },
];

export default api;
