import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { ShieldAlert, CreditCard, TrendingUp, TrendingDown, CheckCircle2, MessageSquare, Link, CalendarDays } from 'lucide-react';
import { getDashboardData, seedDemoData } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const loadData = () => {
    setLoading(true);
    getDashboardData(user?.uid)
      .then(d => setData(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [user]);

  const handleSeedData = async () => {
    setSeeding(true);
    await seedDemoData(user?.uid);
    loadData();
    setSeeding(false);
  };

  const creditScore  = data?.creditScore ?? 0;
  const scoreColor   = creditScore >= 750 ? 'var(--success)' : creditScore >= 650 ? 'var(--warning)' : creditScore > 0 ? 'var(--danger)' : 'var(--text-muted)';
  const scoreLabel   = creditScore >= 750 ? 'Excellent' : creditScore >= 650 ? 'Good' : creditScore > 0 ? 'Fair' : 'N/A';
  const riskScore    = data?.riskScore ?? 0;
  const riskColor    = riskScore >= 71 ? 'var(--danger)' : riskScore >= 31 ? 'var(--warning)' : 'var(--success)';

  const allTxns = data?.recentTransactions || [];
  const subscriptions = allTxns.filter(t => t.is_subscription || ['Netflix', 'Spotify', 'Amazon Prime', 'Gold Gym'].some(s => (t.merchant || '').includes(s)));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">AI-powered financial overview · Real-time fraud detection</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {allTxns.length === 0 && (
            <button className="btn btn-outline" onClick={handleSeedData} disabled={seeding} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Link size={16} /> {seeding ? 'Connecting...' : 'Connect Bank (Demo)'}
            </button>
          )}
          <span className="badge badge-live" style={{ alignSelf: 'center' }}>● Live</span>
        </div>
      </div>

      {/* ── AI Insights ─────────────────────────────────────── */}
      {allTxns.length > 0 && (
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.1), rgba(124,58,237,0.05))', border: '1px solid rgba(13,148,136,0.3)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div style={{ background:'var(--teal)', padding:8, borderRadius:'50%' }}>
              <MessageSquare size={18} color="white" />
            </div>
            <h3 style={{ fontSize:'1.05rem', color:'var(--teal-dark)' }}>AI FinBot Insights</h3>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, paddingLeft:46 }}>
            {riskScore >= 40 && (
              <p style={{ fontSize:'0.85rem', color:'var(--danger)' }}><strong>⚠️ Alert:</strong> Your risk score is currently {riskScore}/100. We detected a potentially suspicious transaction (Impossible travel to Delhi). Please review it in the Risk Engine.</p>
            )}
            {creditScore > 0 && creditScore < 700 && (
              <p style={{ fontSize:'0.85rem', color:'var(--text-2)' }}><strong>📈 Credit Advice:</strong> Your credit score is {creditScore}. To boost it above 700, try maintaining a lower credit utilization and reducing your monthly entertainment expenses.</p>
            )}
            {subscriptions.length > 0 && (
              <p style={{ fontSize:'0.85rem', color:'var(--text-2)' }}><strong>💡 Savings Tip:</strong> We noticed you have {subscriptions.length} active subscriptions. Reviewing and canceling unused services could save you ₹{subscriptions.reduce((a, b) => a + Math.abs(b.amount), 0)} monthly.</p>
            )}
            {creditScore >= 700 && riskScore < 40 && (
              <p style={{ fontSize:'0.85rem', color:'var(--text-2)' }}><strong>🏆 Excellent!</strong> Your financial health is in top shape. Your spending is well within normal parameters.</p>
            )}
          </div>
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
          <span className={`badge ${riskScore >= 71 ? 'badge-danger' : riskScore >= 31 ? 'badge-warning' : 'badge-success'}`} style={{ marginTop:8 }}>
            {riskScore >= 71 ? 'HIGH RISK' : riskScore >= 31 ? 'MEDIUM' : riskScore > 0 ? 'LOW RISK' : 'N/A'}
          </span>
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

        {/* Total Transactions */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <p className="stat-label">Transactions</p>
            <div className="stat-icon" style={{ background:'var(--teal-bg)' }}>
              <TrendingDown size={18} color="var(--teal)" />
            </div>
          </div>
          <p className="stat-value">{data?.recentTransactions?.length ?? 0}</p>
          <span className="badge badge-teal" style={{ marginTop:8 }}>Analysed</span>
          <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:8 }}>Upload statement for more</p>
        </div>
      </div>

      {/* ── Layout Grid ─────────────────────────────────────── */}
      <div className="grid grid-8-4">
        {/* Left Column: Charts & Subscriptions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ fontSize:'0.95rem' }}>🔄 Active Subscriptions</h3>
              <span className="badge badge-purple">{subscriptions.length} detected</span>
            </div>
            {subscriptions.length === 0 ? (
              <p style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>No recurring payments detected.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {subscriptions.map(tx => (
                  <div key={tx.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface-2)' }}>
                    <div style={{ background:'var(--purple-bg)', padding:8, borderRadius:'50%' }}><CalendarDays size={16} color="var(--purple)" /></div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontWeight:600, fontSize:'0.85rem' }}>{tx.merchant}</p>
                      <p style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Auto-renews monthly</p>
                    </div>
                    <span style={{ fontWeight:600, color:'var(--text)' }}>₹{Math.abs(tx.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: NLP Categories & Transactions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <h3 style={{ fontSize:'0.95rem', marginBottom:10 }}>🗂️ NLP Categories</h3>
            <p style={{ fontSize:'0.73rem', color:'var(--text-muted)', marginBottom:14 }}>Click <a onClick={()=>navigate('/nlp')} style={{ cursor:'pointer' }}>NLP Classifier</a> for full breakdown</p>
            <ResponsiveContainer width="100%" height={145}>
              <PieChart>
                <Pie data={data?.spendingCategories || []} cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={3} dataKey="value">
                  {(data?.spendingCategories || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`₹${v}`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:10 }}>
              {(data?.spendingCategories || []).map((cat, i) => (
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

          <div className="card" style={{ flex: 1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ fontSize:'0.95rem' }}>📋 Recent Transactions</h3>
              <div style={{ display:'flex', gap:8 }}>
                <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{data?.recentTransactions?.length ?? 0}</span>
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/nlp')}>View All →</button>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:9, maxHeight: 350, overflowY: 'auto' }}>
              {data?.recentTransactions?.slice(0, 8).map((tx, idx) => (
                <div key={tx.id || idx} className="tx-item">
                  <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0 }}>
                    <div style={{
                      width:38, height:38, borderRadius:'var(--r-md)', flexShrink:0,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem',
                      background: tx.is_suspicious ? 'var(--danger-bg)' : 'var(--bg-2)',
                      border:`1px solid ${tx.is_suspicious ? 'var(--danger)' : 'var(--border)'}`,
                    }}>
                      {tx.is_suspicious ? '🚨' : (tx.amount > 0 ? '💰' : '💳')}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontWeight:600, fontSize:'0.87rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tx.merchant || tx.description}</p>
                      <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:1 }}>{tx.date}</p>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
                    <span style={{ fontWeight:700, fontSize:'0.92rem', color: tx.is_suspicious ? 'var(--danger)' : (tx.amount > 0 ? 'var(--success)' : 'var(--text)') }}>
                      {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
