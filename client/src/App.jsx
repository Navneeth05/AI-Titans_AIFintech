import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import NLPClassifier from './pages/NLPClassifier';
import RiskEngine from './pages/RiskEngine';
import { onMessageListener, setupMessaging } from './services/firebase';
import './index.css';

const App = () => {
  useEffect(() => {
    setupMessaging().catch(() => {});
    onMessageListener()
      .then(payload => {
        const title = payload?.notification?.title ?? 'FinSmart Alert';
        const body  = payload?.notification?.body  ?? '';
        // Show browser notification if permitted
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/vite.svg' });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/"      element={<Dashboard />} />
              <Route path="/upload"element={<Upload />} />
              <Route path="/nlp"   element={<NLPClassifier />} />
              <Route path="/risk"  element={<RiskEngine />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
