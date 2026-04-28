import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = () => {
  const { user } = useAuth();

  // Auth state is still resolving
  if (user === undefined) {
    return (
      <div style={{
        display:'flex', flexDirection:'column', justifyContent:'center',
        alignItems:'center', height:'100vh', background:'var(--bg)', gap:14
      }}>
        <div className="spinner" />
        <p style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>Verifying session…</p>
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;
