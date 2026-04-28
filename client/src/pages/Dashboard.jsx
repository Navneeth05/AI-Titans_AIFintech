import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { ShieldAlert, CreditCard, TrendingUp, TrendingDown, AlertTriangle, ChevronRight, CheckCircle2 } from 'lucide-react';
import AlertPopup from '../components/AlertPopup';
import { getDashboardData } from '../services/api';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#0d9488','#7c3aed','#059669','#f59e0b','#ef4444','#06b6d4'];

const TREND = [
  { month:'May', spend:1800, income:4200 },
  { month:'Jun', spend:2200, income:4500 },
  { month:'Jul', spend:1900, income:4500 },
  { month:'Aug', spend:2600, income:4800 },
  { month:'Sep', spend:2100, income:4500 },
  { month:'Oct', spend:1950, income:4500 },
];

const tooltipStyle = { backgroundColor:'white', border:'1px solid #e2e8f0', borderRadius:'8px', fontSize:'0.82rem', color:'#0f172a' };

const Dashboard = () => {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [alertTx, setAlertTx] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardData()
      .then(d => {
        setData(d);
        const sus = d.recentTransactions.find(t => t.status === 'suspicious');
        if (sus) setTimeout(() => setAlertTx(sus), 600);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh', flexDirection:'column', gap:16 }}>
      <div className="spinner" />
      <p style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>Loading your financial data…</p>
    </div>
  );

  const creditScore  = data?.creditScore ?? 785;
  const scoreColor   = creditScore >= 750 ? 'var(--success)' : creditScore >= 650 ? 'var(--warning)' : 'var(--danger)';
  const scoreLabel   = creditScore >= 750 ? 'Excellent' : creditScore >= 650 ? 'Good' : 'Fair';
  const suspicious   = data?.recentTransactions.filter(t => t.status === 'suspicious') ?? [];
  const riskScore    = 72;
  const riskColor    = riskScore >= 71 ? 'var(--danger)' : riskScore >= 31 ? 'var(--warning)' : 'var(--success)';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">AI-powered financial overview · Real-time fraud detection</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <span className="badge badge-live">● Live</span>
          <span className="chip">🧠 NLP Active</span>
        </div>
      </div>

      {/* ── Fraud Alert Banner ──────────────────────────────── */}
      {suspicious.length > 0 && (
        <div onClick={() => setAlertTx(suspicious[0])} style={{
          background:'var(--danger-bg)', border:'1px solid var(--danger-border)',
          borderRadius:'var(--r-lg)', padding:'14px 20px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          cursor:'pointer', boxShadow:'0 2px 12px rgba(220,38,38,0.08)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ background:'var(--danger-border)', padding:8, borderRadius:'50%' }}>
              <AlertTriangle size={18} color="var(--danger)" />
            </div>
            <div>
              <p style={{ fontWeight:700, color:'var(--danger)', fontSize:'0.9rem' }}>
                🚨 Suspicious Transaction Detected
              </p>
              <p style={{ color:'var(--text-muted)', fontSize:'0.8rem', marginTop:2 }}>
                Unknown Vendor TX-99 · ₹8,999 · Risk Score: 82/100
              </p>
            </div>
          </div>
          <button className="btn btn-danger btn-sm" style={{ display:'flex', alignItems:'center', gap:5 }}>
            Review <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="grid grid-4">
        {/* Credit score */}
        <div className="card card-teal">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <p className="stat-label">Credit Score</p>
            <div className="stat-icon" style={{ background:'var(--teal-bg)' }}>
              <CreditCard size={18} color="var(--teal)" />
            </div>
          </div>
          <p className="stat-value" style={{ color:scoreColor }}>{creditScore}</p>
          <span className="badge badge-teal" style={{ marginTop:8 }}>{scoreLabel}</span>
          <div className="risk-bar-track" style={{ marginTop:12 }}>
            <div className="risk-bar-fill" style={{ width:`${((creditScore-300)/550)*100}%`, background:`linear-gradient(90deg,var(--teal),var(--success))` }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.68rem', color:'var(--text-dim)', marginTop:3 }}>
            <span>300</span><span>850</span>
          </div>
        </div>

        {/* Risk Score */}
        <div className="card card-danger" style={{ cursor:'pointer' }} onClick={() => navigate('/risk')}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <p className="stat-label">Risk Score</p>
            <div className="stat-icon" style={{ background:'var(--danger-bg)' }}>
              <ShieldAlert size={18} color="var(--danger)" />
            </div>
          </div>
          <p className="stat-value" style={{ color:riskColor }}>{riskScore}<span style={{ fontSize:'1rem', color:'var(--text-muted)', fontWeight:400 }}>/100</span></p>
          <span className="badge badge-danger" style={{ marginTop:8 }}>HIGH RISK</span>
          <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:8 }}>Click to view Risk Engine →</p>
        </div>

        {/* Monthly spend */}
        <div className="card card-purple">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <p className="stat-label">Monthly Spend</p>
            <div className="stat-icon" style={{ background:'var(--purple-bg)' }}>
              <TrendingUp size={18} color="var(--purple)" />
            </div>
          </div>
          <p className="stat-value">₹1,950</p>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:8, fontSize:'0.8rem', color:'var(--danger)' }}>
            <TrendingUp size={13} /> +12.5% vs last month
          </div>
          <p style={{ fontSize:'0.72rem', color:'var(--success)', marginTop:4 }}>Savings ratio: 56.7%</p>
        </div>

        {/* Fraud Alerts */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <p className="stat-label">Fraud Alerts</p>
            <div className="stat-icon" style={{ background:'var(--danger-bg)' }}>
              <AlertTriangle size={18} color="var(--danger)" />
            </div>
          </div>
          <p className="stat-value" style={{ color:'var(--danger)' }}>{suspicious.length}</p>
          <span className="badge badge-danger" style={{ marginTop:8 }}>Needs Review</span>
          <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:8 }}>GPS + Behavior detected</p>
        </div>
      </div>

      {/* ── Charts ──────────────────────────────────────────── */}
      <div className="grid grid-8-4">
        <div className="card">
          <h3 style={{ fontSize:'0.95rem', marginBottom:18 }}>💰 Income vs Spending Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={TREND}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0d9488" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fill:'#94a3b8', fontSize:12 }} />
              <YAxis tick={{ fill:'#94a3b8', fontSize:12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`₹${v.toLocaleString()}`, '']} />
              <Area type="monotone" dataKey="income" stroke="#0d9488" strokeWidth={2} fill="url(#gIn)" name="Income" />
              <Area type="monotone" dataKey="spend"  stroke="#7c3aed" strokeWidth={2} fill="url(#gSp)" name="Spending" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize:'0.95rem', marginBottom:10 }}>🗂️ NLP Categories</h3>
          <p style={{ fontSize:'0.73rem', color:'var(--text-muted)', marginBottom:14 }}>Click <a onClick={()=>navigate('/nlp')} style={{ cursor:'pointer' }}>NLP Classifier</a> for full breakdown</p>
          <ResponsiveContainer width="100%" height={145}>
            <PieChart>
              <Pie data={data?.spendingCategories} cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={3} dataKey="value">
                {data?.spendingCategories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`₹${v}`, '']} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:10 }}>
            {data?.spendingCategories.map((cat, i) => (
              <div key={cat.name} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:COLORS[i%COLORS.length], flexShrink:0 }} />
                  <span style={{ color:'var(--text-muted)' }}>{cat.name}</span>
                </div>
                <span style={{ fontWeight:600 }}>₹{cat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Transactions ─────────────────────────────────────── */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ fontSize:'0.95rem' }}>📋 Recent Transactions</h3>
          <div style={{ display:'flex', gap:8 }}>
            <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{data?.recentTransactions.length} transactions</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/nlp')}>View NLP Labels →</button>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {data?.recentTransactions.map(tx => {
            const isSus = tx.status === 'suspicious';
            return (
              <div key={tx.id} className={`tx-item ${isSus ? 'suspicious' : ''}`}>
                <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0 }}>
                  <div style={{
                    width:38, height:38, borderRadius:'var(--r-md)', flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem',
                    background: isSus ? 'var(--danger-bg)' : 'var(--bg-2)',
                    border:`1px solid ${isSus ? 'var(--danger-border)' : 'var(--border)'}`,
                  }}>
                    {isSus ? '⚠️' : tx.amount > 0 ? '💰' : '💳'}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontWeight:600, fontSize:'0.87rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tx.merchant}</p>
                    <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:1 }}>{tx.date}</p>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
                  <span style={{ fontWeight:700, fontSize:'0.92rem', color: tx.amount > 0 ? 'var(--success)' : isSus ? 'var(--danger)' : 'var(--text)' }}>
                    {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount).toFixed(2)}
                  </span>
                  <span className={`badge ${isSus ? 'badge-danger' : 'badge-success'}`}>
                    {isSus ? '🚨 Suspicious' : '✓ Verified'}
                  </span>
                  {isSus && (
                    <button className="btn btn-danger btn-sm" onClick={() => setAlertTx(tx)}>Review</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Financial Health Summary ──────────────────────────── */}
      <div className="card card-success">
        <h3 style={{ fontSize:'0.95rem', marginBottom:14 }}>💚 Financial Health Summary</h3>
        <div className="grid grid-2" style={{ gap:10 }}>
          {[
            'High-accuracy NLP transaction classification across 5 expense categories',
            'Clear monthly financial insights — savings ratio at 56.7%',
            'Early fraud detection before financial loss — proactive, not reactive',
            'Behavioral learning reduces false positives over time',
          ].map(item => (
            <div key={item} style={{ display:'flex', gap:10, alignItems:'flex-start', fontSize:'0.83rem', color:'var(--text-2)' }}>
              <CheckCircle2 size={15} color="var(--success)" style={{ flexShrink:0, marginTop:2 }} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <AlertPopup
        transaction={alertTx}
        onApprove={() => console.log('Approved', alertTx)}
        onReject={() => console.log('Blocked', alertTx)}
        onClose={() => setAlertTx(null)}
      />
    </div>
  );
};

export default Dashboard;
