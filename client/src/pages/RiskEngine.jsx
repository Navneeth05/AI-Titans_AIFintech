import React, { useState, useEffect, useRef } from 'react';
import { MapPin, AlertTriangle, ShieldCheck, Zap, Activity, Clock, Mail, CheckCircle2 } from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { sendFraudAlertEmail } from '../services/emailService';
import { useAuth } from '../context/AuthContext';

// ── Haversine distance (km) ──────────────────────────────────────────────
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

// ── Mock transaction locations ────────────────────────────────────────────
const MOCK_TX_LOCATIONS = [
  { id:1, city:'Bengaluru',  lat:12.9716, lon:77.5946, amount:450,   merchant:'Swiggy',             time:'2024-10-25 10:00', risk:'low'  },
  { id:2, city:'Hyderabad',  lat:17.3850, lon:78.4867, amount:8999,  merchant:'Unknown Vendor TX-99',time:'2024-10-25 10:18', risk:'high' },
  { id:3, city:'Bengaluru',  lat:12.9716, lon:77.5946, amount:999,   merchant:'Airtel',             time:'2024-10-24 14:00', risk:'low'  },
  { id:4, city:'Mumbai',     lat:19.0760, lon:72.8777, amount:2499,  merchant:'Amazon',             time:'2024-10-23 11:00', risk:'low'  },
  { id:5, city:'Bengaluru',  lat:12.9716, lon:77.5946, amount:350,   merchant:'Apollo Pharmacy',    time:'2024-10-22 09:00', risk:'low'  },
];

// ── Risk score trend ───────────────────────────────────────────────────────
const RISK_TREND = [
  { time:'Mon', score:12 },{ time:'Tue', score:24 },{ time:'Wed', score:18 },
  { time:'Thu', score:72 },{ time:'Fri', score:45 },{ time:'Sat', score:31 },{ time:'Sun', score:20 },
];

const tooltipStyle = { backgroundColor:'white', border:'1px solid #e2e8f0', borderRadius:'8px', fontSize:'0.82rem', color:'#0f172a' };

const getRiskColor = (score) => score >= 71 ? 'var(--danger)' : score >= 31 ? 'var(--warning)' : 'var(--success)';
const getRiskLabel = (score) => score >= 71 ? 'HIGH RISK' : score >= 31 ? 'MEDIUM' : 'LOW RISK';
const getRiskBadge = (level) => level === 'high' ? 'badge-danger' : level === 'medium' ? 'badge-warning' : 'badge-success';

const RiskEngine = () => {
  const { user } = useAuth();
  const [userLocation, setUserLocation]   = useState(null);
  const [geoLoading, setGeoLoading]       = useState(false);
  const [geoError, setGeoError]           = useState('');
  const [impossibleTrips, setImpossible]  = useState([]);
  const [riskScore]                       = useState(72);
  const [emailSending, setEmailSending]   = useState(false);
  const [emailSent, setEmailSent]         = useState(false);
  const [alerts, setAlerts]               = useState([
    { id:1, type:'impossible_travel', msg:'Bengaluru → Hyderabad in 18 min (501 km). Speed: 1670 km/h', severity:'critical', time:'10:18 AM' },
    { id:2, type:'behavior',          msg:'₹8,999 transaction to Unknown Vendor — 4.2σ outlier detected', severity:'high',     time:'10:18 AM' },
    { id:3, type:'frequency',         msg:'5 transactions in 30 min — unusual spike detected',            severity:'medium',   time:'10:15 AM' },
  ]);

  const handleSendEmailAlert = async () => {
    setEmailSending(true);
    const result = await sendFraudAlertEmail({
      toEmail:   user?.email ?? 'user@finsmart.local',
      toName:    user?.displayName ?? 'User',
      merchant:  'Unknown Vendor TX-99',
      amount:    '8,999',
      riskScore: 82,
      location:  'Hyderabad (impossible travel from Bengaluru in 18 min)',
      reason:    'Impossible travel detected — 501 km in 18 minutes. Isolation Forest behavioral outlier 4.2σ',
    });
    setEmailSending(false);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 4000);
  };

  // Score inputs
  const scoreInputs = [
    { label:'Location Anomaly',     score:85, desc:'Impossible travel detected',     icon:'📍' },
    { label:'Behavioral Deviation', score:78, desc:'4.2σ outlier — Isolation Forest',icon:'🧠' },
    { label:'Transaction Frequency',score:62, desc:'Spike in 30-minute window',       icon:'⏱️' },
    { label:'Amount Deviation',     score:70, desc:'8× higher than avg transaction',  icon:'💰' },
  ];

  // Request browser GPS
  const requestLocation = () => {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported in this browser.'); return; }
    setGeoLoading(true); setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setUserLocation({ lat, lon });
        setGeoLoading(false);
        // Compare against mock transactions
        const trips = [];
        for (let i = 1; i < MOCK_TX_LOCATIONS.length; i++) {
          const a = MOCK_TX_LOCATIONS[i-1], b = MOCK_TX_LOCATIONS[i];
          const dist = haversine(a.lat, a.lon, b.lat, b.lon);
          const tA = new Date(`2024-10-25 ${a.time.split(' ')[1]}`);
          const tB = new Date(`2024-10-25 ${b.time.split(' ')[1]}`);
          const hrs = Math.abs(tB - tA) / 3600000 || 0.3;
          const speed = dist / hrs;
          if (speed > 900) trips.push({ from:a.city, to:b.city, dist:Math.round(dist), speed:Math.round(speed), merchant:b.merchant });
        }
        setImpossible(trips);
      },
      (err) => { setGeoError(err.message || 'Location access denied.'); setGeoLoading(false); }
    );
  };

  const riskColor = getRiskColor(riskScore);
  const riskLabel = getRiskLabel(riskScore);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">⚡ Risk Engine</h1>
          <p className="page-subtitle">0–100 composite risk scoring · Behavioral + Location anomaly detection · Real-time alerts</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <span className="badge badge-live">● LIVE</span>
          <span className="badge badge-teal">Isolation Forest</span>
        </div>
      </div>

      {/* Composite Risk Score + Gauge */}
      <div className="grid grid-8-4">
        <div className="card" style={{ borderLeft:'3px solid var(--danger)' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <p className="stat-label">Composite Risk Score</p>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginTop:4 }}>
                <span style={{ fontSize:'3.5rem', fontWeight:900, color:riskColor, lineHeight:1 }}>{riskScore}</span>
                <span style={{ fontSize:'1.2rem', color:'var(--text-muted)' }}>/100</span>
              </div>
              <span className="badge badge-danger" style={{ marginTop:10, fontSize:'0.75rem' }}>🚨 {riskLabel} — Immediate Action Required</span>
            </div>
            <div style={{ width:110, height:110 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%"
                  data={[{ value:riskScore, fill:riskColor }]} startAngle={90} endAngle={90 - riskScore * 3.6}>
                  <RadialBar dataKey="value" cornerRadius={6} background={{ fill:'#f1f5f9' }} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Score inputs */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {scoreInputs.map(s => (
              <div key={s.label} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:'1rem', flexShrink:0 }}>{s.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-2)' }}>{s.label}</span>
                    <span style={{ fontSize:'0.75rem', fontWeight:700, color:getRiskColor(s.score) }}>{s.score}/100</span>
                  </div>
                  <div className="risk-bar-track">
                    <div className="risk-bar-fill" style={{ width:`${s.score}%`, background:getRiskColor(s.score) }} />
                  </div>
                  <p style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:3 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk trend */}
        <div className="card">
          <h3 style={{ fontSize:'0.9rem', marginBottom:16 }}>📈 Risk Score — 7 Day Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={RISK_TREND}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fill:'#94a3b8', fontSize:11 }} />
              <YAxis domain={[0,100]} tick={{ fill:'#94a3b8', fontSize:11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [v, 'Risk Score']} />
              <Area type="monotone" dataKey="score" stroke="#ef4444" strokeWidth={2} fill="url(#riskGrad)" />
            </AreaChart>
          </ResponsiveContainer>

          {/* Risk levels legend */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:16, borderTop:'1px solid var(--border)', paddingTop:14 }}>
            {[['🟢 Low (0–30)','Normal behavior','var(--success)'],['🟡 Medium (31–70)','Review required','var(--warning)'],['🔴 High (71–100)','Immediate alert','var(--danger)']].map(([label,desc,color]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem' }}>
                <span style={{ color, fontWeight:600 }}>{label}</span>
                <span style={{ color:'var(--text-muted)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GPS Location Anomaly */}
      <div className="card card-danger">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
          <div>
            <h3 style={{ fontSize:'1rem' }}>📍 Location-Based Anomaly Detection</h3>
            <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:4 }}>
              Haversine formula · Speed &gt; 900 km/h = impossible travel · d = 2R·arcsin(√(sin²(Δφ/2) + cos²·sin²(Δλ/2)))
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={requestLocation} disabled={geoLoading}
            style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6 }}>
            <MapPin size={14} />
            {geoLoading ? 'Locating…' : userLocation ? 'Re-check GPS' : 'Enable GPS'}
          </button>
        </div>

        {geoError && (
          <div style={{ background:'var(--warning-bg)', border:'1px solid var(--warning-border)', borderRadius:'var(--r-md)', padding:'10px 14px', marginBottom:16, fontSize:'0.82rem', color:'var(--warning)' }}>
            ⚠️ {geoError} — Using simulated location data for demo.
          </div>
        )}

        {userLocation && (
          <div style={{ background:'var(--success-bg)', border:'1px solid var(--success-border)', borderRadius:'var(--r-md)', padding:'10px 14px', marginBottom:16, fontSize:'0.82rem', color:'var(--success)', display:'flex', alignItems:'center', gap:8 }}>
            <MapPin size={14} />
            GPS acquired: {userLocation.lat.toFixed(4)}°N, {userLocation.lon.toFixed(4)}°E
          </div>
        )}

        {/* Transaction location timeline */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
          {MOCK_TX_LOCATIONS.map((tx, i) => (
            <div key={tx.id} style={{
              display:'flex', alignItems:'center', gap:14,
              padding:'12px 16px', borderRadius:'var(--r-md)',
              background: tx.risk === 'high' ? 'var(--danger-bg)' : 'white',
              border:`1px solid ${tx.risk === 'high' ? 'var(--danger-border)' : 'var(--border)'}`,
            }}>
              <div style={{ textAlign:'center', flexShrink:0, width:24 }}>
                <div style={{
                  width:10, height:10, borderRadius:'50%', margin:'0 auto',
                  background: tx.risk === 'high' ? 'var(--danger)' : 'var(--success)',
                }} />
                {i < MOCK_TX_LOCATIONS.length - 1 && (
                  <div style={{ width:2, height:20, background:'var(--border)', margin:'2px auto' }} />
                )}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontWeight:600, fontSize:'0.85rem' }}>{tx.city}</span>
                  <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>· {tx.merchant}</span>
                  {tx.risk === 'high' && <span className="badge badge-danger">FLAGGED</span>}
                </div>
                <p style={{ fontSize:'0.73rem', color:'var(--text-muted)', marginTop:2 }}>
                  {tx.time} · ₹{tx.amount.toLocaleString()}
                </p>
              </div>
              <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', flexShrink:0 }}>
                {tx.lat.toFixed(2)}°N, {tx.lon.toFixed(2)}°E
              </span>
            </div>
          ))}
        </div>

        {/* Impossible travel alert */}
        <div style={{
          background:'var(--danger-bg)', border:'1px solid var(--danger-border)',
          borderRadius:'var(--r-lg)', padding:'16px 20px',
        }}>
          <p style={{ fontWeight:700, color:'var(--danger)', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
            <AlertTriangle size={16} /> Impossible Travel Detected
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            {[['Distance','501 km'],['Time Gap','18 minutes'],['Speed','1,670 km/h']].map(([k,v]) => (
              <div key={k} style={{ background:'white', borderRadius:'var(--r-sm)', padding:'10px 12px', border:'1px solid var(--danger-border)' }}>
                <p style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{k}</p>
                <p style={{ fontWeight:700, color:'var(--danger)', fontSize:'1rem' }}>{v}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize:'0.78rem', color:'var(--danger)', marginTop:10 }}>
            Bengaluru (10:00 AM) → Hyderabad (10:18 AM) — Physically impossible. <strong>Auto-flagged as fraud.</strong>
          </p>
        </div>
      </div>

      {/* Behavioral Anomaly */}
      <div className="card card-purple">
        <h3 style={{ fontSize:'1rem', marginBottom:6 }}>🧠 Behavioral Anomaly — Isolation Forest + K-Means</h3>
        <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:16 }}>Peer cluster comparison · Statistical outlier detection · Spending pattern deviation</p>
        <div className="grid grid-3" style={{ gap:12 }}>
          {[
            { label:'Peer Avg Transaction', you:'₹8,999', avg:'₹420', diff:'+2,042%', flag:true },
            { label:'Transactions / Day', you:'8', avg:'3.2', diff:'+150%', flag:true },
            { label:'Night Transactions', you:'4', avg:'0.8', diff:'+400%', flag:true },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--purple-bg)', border:'1px solid rgba(124,58,237,0.25)', borderRadius:'var(--r-md)', padding:'14px 16px' }}>
              <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</p>
              <div style={{ display:'flex', justify:'space-between', gap:8 }}>
                <div>
                  <p style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>You</p>
                  <p style={{ fontWeight:700, color:'var(--danger)', fontSize:'1.1rem' }}>{s.you}</p>
                </div>
                <div>
                  <p style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>Peer avg</p>
                  <p style={{ fontWeight:700, color:'var(--text-2)', fontSize:'1.1rem' }}>{s.avg}</p>
                </div>
                <div>
                  <p style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>Deviation</p>
                  <span className="badge badge-danger">{s.diff}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Alerts log */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ fontSize:'1rem' }}>🔔 Real-Time Alert Log</h3>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span className="badge badge-live">● Live</span>
            {emailSent ? (
              <span className="badge badge-success" style={{ display:'flex', gap:5 }}>
                <CheckCircle2 size={12} /> Alert sent to {user?.email}
              </span>
            ) : (
              <button
                className="btn btn-sm btn-outline"
                onClick={handleSendEmailAlert}
                disabled={emailSending}
                style={{ display:'flex', alignItems:'center', gap:5 }}
              >
                <Mail size={13} />
                {emailSending ? 'Sending…' : 'Email Alert →'}
              </button>
            )}
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {alerts.map(a => (
            <div key={a.id} style={{
              display:'flex', alignItems:'flex-start', gap:14,
              padding:'14px 16px', borderRadius:'var(--r-md)',
              border:`1px solid ${a.severity==='critical'?'var(--danger-border)':a.severity==='high'?'var(--danger-border)':'var(--warning-border)'}`,
              background: a.severity==='medium' ? 'var(--warning-bg)' : 'var(--danger-bg)',
            }}>
              <div style={{
                padding:8, borderRadius:'var(--r-sm)', flexShrink:0,
                background: a.severity==='medium' ? 'var(--warning-border)' : 'var(--danger-border)',
              }}>
                <AlertTriangle size={16} color={a.severity==='medium' ? 'var(--warning)' : 'var(--danger)'} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span className={`badge ${a.severity==='medium'?'badge-warning':'badge-danger'}`}>
                    {a.severity.toUpperCase()}
                  </span>
                  <span style={{ fontSize:'0.73rem', color:'var(--text-muted)' }}>{a.time}</span>
                </div>
                <p style={{ fontSize:'0.85rem', color:'var(--text-2)', lineHeight:1.5 }}>{a.msg}</p>
              </div>
              <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                <button className="btn btn-outline btn-sm">Dismiss</button>
                <button className="btn btn-danger btn-sm">Block</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RiskEngine;
