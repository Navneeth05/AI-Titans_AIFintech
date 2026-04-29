import axios from 'axios';
import { auth } from './firebase';
import { getUploads, getStoredTransactions } from './firestore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds
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

// ─── Dashboard (aggregated) – uses backend data when available ─────────────────
export const getDashboardData = async (uid) => {
  try {
    if (!uid) return { creditScore: 680, riskScore: 24, spendingCategories: mockCategories, recentTransactions: mockTransactions, trend: mockTrend };

    // Use the new backend pre-aggregated endpoint
    const response = await api.get('/api/v1/dashboard/summary');
    const data = response.data;

    return {
      creditScore: data.creditScore || 680,
      riskScore: data.riskScore || 24,
      spendingCategories: data.spendingCategories?.length ? data.spendingCategories : mockCategories,
      recentTransactions: data.recentTransactions?.length ? data.recentTransactions : mockTransactions,
      trend: data.trend?.length ? data.trend : mockTrend,
    };
  } catch (err) {
    console.warn("Dashboard summary fetch failed, using local/mock fallback:", err.message);
    return { creditScore: 680, riskScore: 24, spendingCategories: mockCategories, recentTransactions: mockTransactions, trend: mockTrend };
  }
};

const mockTrend = [
  { month:'May', spend:1800, income:4200 },
  { month:'Jun', spend:2200, income:4500 },
  { month:'Jul', spend:1900, income:4500 },
  { month:'Aug', spend:2600, income:4800 },
  { month:'Sep', spend:2100, income:4500 },
  { month:'Oct', spend:1950, income:4500 },
];

// ─── Fallback data (used when backend is not running) ──────────────────────────
const mockCategories = [
  { name: 'Housing', value: 1200 },
  { name: 'Food', value: 400 },
  { name: 'Transport', value: 200 },
  { name: 'Entertainment', value: 150 },
];

const mockTransactions = [
  { id: 1, merchant: 'Amazon', amount: -120.50, date: '2024-10-25', status: 'completed' },
  { id: 2, merchant: 'Salary Credit', amount: 4500.00, date: '2024-10-24', status: 'completed' },
  { id: 3, merchant: 'Uber', amount: -24.50, date: '2024-10-23', status: 'completed' },
  { id: 4, merchant: 'Netflix', amount: -15.99, date: '2024-10-22', status: 'completed' },
];

// ─── Demo Seeder ───────────────────────────────────────────────────────────────
export const seedDemoData = async (uid) => {
  if (!uid) return;
  const { saveUpload, saveCreditScore, saveTransactions } = await import('./firestore');
  
  const txns = [
    { merchant: 'TechCorp Salary', amount: 150000, date: '2024-10-01', transaction_type: 'credit', category: 'Income', is_suspicious: false, fraud_score: 0 },
    { merchant: 'Greenwood Apartments', amount: -35000, date: '2024-10-02', transaction_type: 'debit', category: 'Housing', is_suspicious: false, fraud_score: 0 },
    { merchant: 'Netflix Subscription', amount: -649, date: '2024-10-05', transaction_type: 'debit', category: 'Entertainment', is_suspicious: false, fraud_score: 0, is_subscription: true },
    { merchant: 'Swiggy', amount: -850, date: '2024-10-08', transaction_type: 'debit', category: 'Food', is_suspicious: false, fraud_score: 0.1 },
    { merchant: 'Amazon Prime', amount: -1499, date: '2024-10-10', transaction_type: 'debit', category: 'Entertainment', is_suspicious: false, fraud_score: 0, is_subscription: true },
    { merchant: 'Gold Gym', amount: -2500, date: '2024-10-12', transaction_type: 'debit', category: 'Health', is_suspicious: false, fraud_score: 0, is_subscription: true },
    { merchant: 'Uber Mumbai', amount: -450, date: '2024-10-15', transaction_type: 'debit', category: 'Transport', is_suspicious: false, fraud_score: 0.1 },
    { merchant: 'Unknown Vendor Delhi', amount: -8999, date: '2024-10-15', transaction_type: 'debit', category: 'Shopping', is_suspicious: true, fraud_score: 0.95, geo_flagged: true, geo_alert: 'Impossible travel from Mumbai to Delhi (1150 km) detected.' },
    { merchant: 'Zomato', amount: -1200, date: '2024-10-18', transaction_type: 'debit', category: 'Food', is_suspicious: false, fraud_score: 0.05 },
    { merchant: 'Apple Music', amount: -99, date: '2024-10-20', transaction_type: 'debit', category: 'Entertainment', is_suspicious: false, fraud_score: 0, is_subscription: true },
  ];

  await saveTransactions(uid, txns);
  await saveUpload(uid, {
    fileName: 'hackathon_demo_bank_statement.pdf',
    fileSize: 450200,
    creditScore: 680,
    riskScore: 42,
    status: 'analyzed',
    categories: {
      'Housing': 35000,
      'Food': 2050,
      'Entertainment': 2247,
      'Health': 2500,
      'Transport': 450,
      'Shopping': 8999
    }
  });
  await saveCreditScore(uid, 680, 'demo_seed');
  return true;
};

export default api;
