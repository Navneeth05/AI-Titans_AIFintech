import React, { useState, useEffect, useRef } from 'react';
import { MapPin, AlertTriangle, ShieldCheck, ShieldAlert, Zap, Activity, Clock, Mail, CheckCircle2 } from 'lucide-react';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { sendFraudAlertEmail } from '../services/emailService';
import { useAuth } from '../context/AuthContext';
import { getDashboardData } from '../services/api';
import { saveFraudAlert, updateCardStatus } from '../services/firestore';

// ── Haversine distance (km) ──────────────────────────────────────────────
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const CITY_COORDS = {
  "MUMBAI": {lat: 19.0760, lon: 72.8777}, "BOM": {lat: 19.0760, lon: 72.8777},
  "DELHI": {lat: 28.7041, lon: 77.1025}, "DEL": {lat: 28.7041, lon: 77.1025},
  "BENGALURU": {lat: 12.9716, lon: 77.5946}, "BANGALORE": {lat: 12.9716, lon: 77.5946}, "BLR": {lat: 12.9716, lon: 77.5946},
  "HYDERABAD": {lat: 17.3850, lon: 78.4867}, "HYD": {lat: 17.3850, lon: 78.4867},
  "CHENNAI": {lat: 13.0827, lon: 80.2707}, "MAA": {lat: 13.0827, lon: 80.2707},
  "KOLKATA": {lat: 22.5726, lon: 88.3639}, "CCU": {lat: 22.5726, lon: 88.3639},
  "PUNE": {lat: 18.5204, lon: 73.8567}, "PNQ": {lat: 18.5204, lon: 73.8567},
  "AHMEDABAD": {lat: 23.0225, lon: 72.5714}, "AMD": {lat: 23.0225, lon: 72.5714},
};

const getLocationFromDesc = (desc) => {
  if (!desc) return null;
  const descUpper = String(desc).toUpperCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (new RegExp(`\\b${city}\\b`).test(descUpper)) {
      return { city, ...coords };
    }
  }
  return null;
};

const MOCK_TX_LOCATIONS = [
  { id:1, city:'Bengaluru',  lat:12.9716, lon:77.5946, amount:450,   merchant:'Swiggy',             time:'2024-10-25 10:00', risk:'low'  },
  { id:2, city:'Delhi',      lat:28.7041, lon:77.1025, amount:8999,  merchant:'Unknown Vendor TX-99',time:'2024-10-25 10:15', risk:'high' },
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
  const [emailSending, setEmailSending]   = useState(false);
  const [emailSent, setEmailSent]         = useState(false);
  const [data, setData]                   = useState(null);

  // Manual Check State
  const [manualLoc1, setManualLoc1] = useState('BENGALURU');
  const [manualTime1, setManualTime1] = useState('10:00');
  const [manualLoc2, setManualLoc2] = useState('DELHI');
  const [manualTime2, setManualTime2] = useState('10:15');
  const [manualResult, setManualResult] = useState(null);

  const handleManualCheck = () => {
    const coords1 = CITY_COORDS[manualLoc1] || CITY_COORDS['BENGALURU'];
    const coords2 = CITY_COORDS[manualLoc2] || CITY_COORDS['DELHI'];
    const dist = Math.round(haversine(coords1.lat, coords1.lon, coords2.lat, coords2.lon));
    
    const [h1, m1] = manualTime1.split(':').map(Number);
    const [h2, m2] = manualTime2.split(':').map(Number);
    let timeGapMins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (timeGapMins <= 0) timeGapMins += 24 * 60;
    
    const timeGapHours = timeGapMins / 60;
    const speed = Math.round(dist / timeGapHours);
    
    const result = {
        dist,
        timeGap: `${Math.floor(timeGapHours)}h ${timeGapMins % 60}m`,
        speed,
        isFraud: speed > 900
    };

    setManualResult(result);

    if (result.isFraud) {
        setSimulatingFraud(true);
        setCountdown(120);
        setCardBlocked(false);
        
        // Save to Firebase
        if (user?.uid) {
            saveFraudAlert(user.uid, {
                location1: manualLoc1,
                time1: manualTime1,
                location2: manualLoc2,
                time2: manualTime2,
                distance: dist,
                speed: speed,
                reason: 'Manual Location Check - Impossible Travel'
            });
        }

        // Send Email Alert
        if (user?.email) {
            sendFraudAlertEmail({
                toEmail: user.email,
                toName: user.displayName || 'User',
                merchant: 'Impossible Travel Alert',
                amount: "0",
                riskScore: speed > 1200 ? 99 : 85,
                location: `${manualLoc1} → ${manualLoc2}`,
                reason: `CRITICAL: Detected travel at ${speed} km/h between ${manualLoc1} and ${manualLoc2}. This exceeds the physical travel limit.`
            });
        }
    }
  };

  // Simulation state
  const [simulatingFraud, setSimulatingFraud] = useState(false);
  const [countdown, setCountdown]             = useState(120);
  const [cardBlocked, setCardBlocked]         = useState(false);

  useEffect(() => {
    let timer;
    if (simulatingFraud && countdown > 0 && !cardBlocked) {
      timer = setInterval(() => {
        setCountdown(c => {
          const next = c - 1;
          // Send email every 10 seconds (at 110, 100, 90...) to match "Active Message X/12"
          if (next > 0 && next % 10 === 0) {
            const msgNum = Math.ceil((120 - next) / 10);
            if (user?.email) {
                sendFraudAlertEmail({
                    toEmail: user.email,
                    toName: user.displayName || 'User',
                    merchant: 'Impossible Travel Alert (Reminder)',
                    amount: "0",
                    riskScore: 99,
                    location: `${manualLoc1 || 'BENGALURU'} → ${manualLoc2 || 'DELHI'}`,
                    reason: `SECURITY ALERT [${msgNum}/12]: Your card will be blocked in ${next}s. Please confirm if this is you.`
                });
            }
          }
          return next;
        });
      }, 1000);
    } else if (countdown === 0 && simulatingFraud && !cardBlocked) {
      setCardBlocked(true);
      if (user?.uid) updateCardStatus(user.uid, true);
    }
    return () => clearInterval(timer);
  }, [simulatingFraud, cardBlocked, user, manualLoc1, manualLoc2]);

  const triggerSimulation = () => {
    setSimulatingFraud(true);
    setCountdown(120);
    setCardBlocked(false);
    
    const dist = Math.round(haversine(12.9716, 77.5946, 28.7041, 77.1025));
    const speed = Math.round(dist / (15 / 60)); // 15 mins
    setImpossible([{ from:'Bengaluru', to:'Delhi', dist, speed, merchant:'Unknown Vendor TX-99' }]);
  };

  useEffect(() => {
    getDashboardData(user?.uid).then(d => {
      setData(d);
      
      if (d?.recentTransactions?.length > 0) {
        const realImpossible = [];
        for (let i = 0; i < d.recentTransactions.length; i++) {
            const tx = d.recentTransactions[i];
            if (tx.geo_flagged) {
               // Find adjacent transaction location
               const prevTx = i > 0 ? d.recentTransactions[i-1] : null; 
               const loc1 = prevTx ? getLocationFromDesc(prevTx.description || prevTx.merchant) : null;
               const loc2 = getLocationFromDesc(tx.description || tx.merchant);
               
               const distMatch = tx.geo_alert?.match(/\((\d+)\s*km\)/);
               const dist = distMatch ? parseInt(distMatch[1]) : 1500;
               // Estimate time gap to be 2 hours if not same day
               const timeGapHours = 2; 
               
               realImpossible.push({
                   from: loc1 ? loc1.city : 'Previous Location',
                   fromTime: prevTx?.date || 'Previous Time',
                   to: loc2 ? loc2.city : 'Current Location',
                   toTime: tx.date || 'Current Time',
                   dist: dist,
                   timeGap: `${timeGapHours} hours`,
                   speed: Math.round(dist / timeGapHours),
                   merchant: tx.description || tx.merchant,
                   isReal: true
               });
            }
        }
        if (realImpossible.length > 0) {
            setImpossible(realImpossible);
        } else {
            setImpossible([]);
        }
      }
    });
  }, [user]);

  const riskScore = data?.riskScore ?? 0;
  const suspiciousTxns = data?.recentTransactions?.filter(t => t.is_suspicious || t.status === 'suspicious') ?? [];
  const allTxns = data?.recentTransactions ?? [];
  
  const alerts = suspiciousTxns.map((tx, idx) => ({
    id: tx.id || idx,
    type: 'behavior',
    msg: `₹${Math.abs(tx.amount)} transaction to ${tx.merchant || tx.description} — flagged by ML model`,
    severity: 'high',
    time: tx.date
  }));

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

  const scoreInputs = [
    { label:'Model Confidence',     score: Math.min(100, riskScore + 10), desc:'ML fraud evaluation', icon:'🧠' },
    { label:'Behavioral Deviation', score: Math.min(100, riskScore), desc:'Anomaly detection',icon:'📉' },
    { label:'Amount Deviation',     score: suspiciousTxns.length > 0 ? 80 : 20, desc:'Unusual amounts',  icon:'💰' },
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
      },
      (err) => { setGeoError(err.message || 'Location access denied.'); setGeoLoading(false); }
    );
  };

  const riskColor = getRiskColor(riskScore);
  const riskLabel = getRiskLabel(riskScore);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* ── Active Fraud Overlay ── */}
      {simulatingFraud && (
        <div className="alert-overlay" style={{ zIndex:999 }}>
          <div className={`alert-dialog ${!cardBlocked ? 'pulse-red' : ''}`} style={{ textAlign:'center', border: cardBlocked ? '1px solid var(--danger)' : '2px solid var(--danger)' }}>
            <div style={{ margin:'0 auto 16px', width:60, height:60, background: cardBlocked ? 'var(--danger)' : 'var(--danger)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', animation: !cardBlocked ? 'pulse 1s infinite' : 'none' }}>
              {cardBlocked ? <ShieldCheck size={32} color="white" /> : <ShieldAlert size={32} color="white" />}
            </div>
            
            <h2 style={{ fontSize:'1.4rem', color: 'var(--danger)', marginBottom:8 }}>
              {cardBlocked ? 'Card Automatically Blocked' : 'CRITICAL: SUSPICIOUS ACTIVITY DETECTED'}
            </h2>
            
            {cardBlocked ? (
              <p style={{ color:'var(--text-muted)' }}>For your security, we have blocked your card due to no response within the safety window.</p>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize:'1.1rem', fontWeight: 700, color: 'var(--text)' }}>
                    Impossible Travel: {manualLoc1} → {manualLoc2}
                  </p>
                  <p style={{ fontSize:'0.9rem', color:'var(--text-muted)', marginTop: 4 }}>
                    Alert Status: <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Active Message {Math.ceil((120 - countdown) / 10)} / 12</span>
                  </p>
                </div>
                
                <div style={{ padding:'12px', background:'var(--danger-bg)', borderRadius:'var(--r-md)', border:'1px solid var(--danger-border)', marginBottom:20 }}>
                  <p style={{ fontWeight:700, color:'var(--danger)', fontSize:'1.3rem' }}>
                    🚨 Blocking card in {countdown}s
                  </p>
                  <p style={{ fontSize:'0.85rem', color:'var(--danger)', marginTop: 4 }}>Was this you? Respond now to prevent card suspension.</p>
                </div>
                
                <div className="alert-actions">
                  <button className="btn btn-outline" onClick={() => { setSimulatingFraud(false); setManualResult(null); }}>Yes, it was me</button>
                  <button className="btn btn-danger" onClick={() => { setCardBlocked(true); if (user?.uid) updateCardStatus(user.uid, true); }}>No, block card</button>
                </div>
              </>
            )}

            {cardBlocked && (
              <button className="btn btn-primary" style={{ marginTop:24 }} onClick={() => { setSimulatingFraud(false); setCardBlocked(false); setManualResult(null); }}>
                Dismiss & Contact Support
              </button>
            )}
          </div>
        </div>
      )}
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
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-danger btn-sm" onClick={triggerSimulation} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Zap size={14} /> Simulate Fraud
            </button>
            <button className="btn btn-primary btn-sm" onClick={requestLocation} disabled={geoLoading}
              style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6 }}>
              <MapPin size={14} />
              {geoLoading ? 'Locating…' : userLocation ? 'Re-check GPS' : 'Enable GPS'}
            </button>
          </div>
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
          {(impossibleTrips.length > 0 ? MOCK_TX_LOCATIONS : allTxns.slice(0, 5)).map((tx, i) => {
            const isHigh = tx.is_suspicious || tx.status === 'suspicious' || tx.risk === 'high';
            return (
            <div key={tx.id || i} style={{
              display:'flex', alignItems:'center', gap:14,
              padding:'12px 16px', borderRadius:'var(--r-md)',
              background: isHigh ? 'var(--danger-bg)' : 'white',
              border:`1px solid ${isHigh ? 'var(--danger-border)' : 'var(--border)'}`,
            }}>
              <div style={{ textAlign:'center', flexShrink:0, width:24 }}>
                <div style={{
                  width:10, height:10, borderRadius:'50%', margin:'0 auto',
                  background: isHigh ? 'var(--danger)' : 'var(--success)',
                }} />
                {i < 4 && (
                  <div style={{ width:2, height:20, background:'var(--border)', margin:'2px auto' }} />
                )}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontWeight:600, fontSize:'0.85rem' }}>{tx.city ? `${tx.city} · ` : ''}{tx.merchant || tx.description}</span>
                  {isHigh && <span className="badge badge-danger">FLAGGED</span>}
                </div>
                <p style={{ fontSize:'0.73rem', color:'var(--text-muted)', marginTop:2 }}>
                  {tx.time || tx.date} · ₹{Math.abs(tx.amount).toLocaleString()}
                </p>
              </div>
              {tx.lat && (
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', flexShrink:0 }}>
                  {tx.lat.toFixed(2)}°N, {tx.lon.toFixed(2)}°E
                </span>
              )}
            </div>
            );
          })}
          {impossibleTrips.length === 0 && allTxns.length === 0 && <p style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>No recent transactions.</p>}
        </div>

        {/* Manual Fraud Checker */}
        <div style={{
          background:'var(--surface-2)', border:'1px solid var(--border)',
          borderRadius:'var(--r-lg)', padding:'16px 20px', marginBottom:16
        }}>
          <p style={{ fontWeight:700, color:'var(--text)', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            <MapPin size={16} /> Manual Location Fraud Checker
          </p>
          
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            {/* SECTION 1: Location 1 */}
            <div style={{ background:'white', padding:'16px', borderRadius:'var(--r-md)', border:'1px solid var(--border)' }}>
              <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', marginBottom:8 }}>Location 1 (Current Location/Cash Withdrawal)</p>
              
              <label style={{ display:'block', fontSize:'0.8rem', marginBottom:4, fontWeight:500 }}>City</label>
              <select className="input" value={manualLoc1} onChange={e => setManualLoc1(e.target.value)} style={{ width:'100%', marginBottom:12 }}>
                {Object.keys(CITY_COORDS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              
              <label style={{ display:'block', fontSize:'0.8rem', marginBottom:4, fontWeight:500 }}>Time</label>
              <input type="time" className="input" value={manualTime1} onChange={e => setManualTime1(e.target.value)} style={{ width:'100%' }} />
            </div>
            
            {/* SECTION 2: Location 2 */}
            <div style={{ background:'white', padding:'16px', borderRadius:'var(--r-md)', border:'1px solid var(--border)' }}>
              <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', marginBottom:8 }}>Location 2 (Another Location)</p>
              
              <label style={{ display:'block', fontSize:'0.8rem', marginBottom:4, fontWeight:500 }}>City</label>
              <select className="input" value={manualLoc2} onChange={e => setManualLoc2(e.target.value)} style={{ width:'100%', marginBottom:12 }}>
                {Object.keys(CITY_COORDS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              
              <label style={{ display:'block', fontSize:'0.8rem', marginBottom:4, fontWeight:500 }}>Time</label>
              <input type="time" className="input" value={manualTime2} onChange={e => setManualTime2(e.target.value)} style={{ width:'100%' }} />
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleManualCheck} style={{ width:'100%', marginBottom:16 }}>
            🔍 Check For Fraud
          </button>

          {manualResult && (
            <div style={{
              padding:'16px', borderRadius:'var(--r-md)',
              background: manualResult.isFraud ? 'var(--danger-bg)' : 'var(--success-bg)',
              border: `1px solid ${manualResult.isFraud ? 'var(--danger-border)' : 'var(--success-border)'}`
            }}>
              <p style={{ fontWeight:700, color: manualResult.isFraud ? 'var(--danger)' : 'var(--success)', marginBottom:12, fontSize:'1.1rem' }}>
                {manualResult.isFraud ? '🚨 IMPOSSIBLE TRAVEL DETECTED' : '✅ TRAVEL IS POSSIBLE'}
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                {[['Distance',`${manualResult.dist.toLocaleString()} km`],
                  ['Time Gap', manualResult.timeGap],
                  ['Required Speed',`${manualResult.speed.toLocaleString()} km/h`]
                 ].map(([k,v]) => (
                  <div key={k} style={{ background:'white', borderRadius:'var(--r-sm)', padding:'10px 12px', border:`1px solid ${manualResult.isFraud ? 'var(--danger-border)' : 'var(--success-border)'}` }}>
                    <p style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{k}</p>
                    <p style={{ fontWeight:700, color: manualResult.isFraud ? 'var(--danger)' : 'var(--success)', fontSize:'1rem' }}>{v}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:'0.85rem', color: manualResult.isFraud ? 'var(--danger)' : 'var(--success)', marginTop:12, fontWeight:600 }}>
                Based on the distance ({manualResult.dist} km) and time gap ({manualResult.timeGap}), the required speed is {manualResult.speed} km/h. 
                {manualResult.isFraud 
                  ? ' This is physically impossible for normal travel.' 
                  : ' This speed is within normal limits.'}
                <br/><strong>VERDICT: {manualResult.isFraud ? 'CONFIRMED FRAUD' : 'NOT FRAUD'}</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Behavioral Anomaly */}
      <div className="card card-purple">
        <h3 style={{ fontSize:'1rem', marginBottom:6 }}>🧠 Behavioral Anomaly — Isolation Forest + K-Means</h3>
        <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:16 }}>Peer cluster comparison · Statistical outlier detection · Spending pattern deviation</p>
        <div className="grid grid-3" style={{ gap:12 }}>
          {[
            { label:'Suspicious Txns', you:suspiciousTxns.length, avg:'0.1', diff:`+${suspiciousTxns.length * 1000}%`, flag:suspiciousTxns.length > 0 },
            { label:'Transactions / Month', you:allTxns.length, avg:'30', diff:allTxns.length > 30 ? `+${Math.round((allTxns.length - 30)/30 * 100)}%` : 'Normal', flag:allTxns.length > 50 },
            { label:'Risk Evaluated', you:`${riskScore}/100`, avg:'15/100', diff:`+${Math.round(riskScore - 15)} pts`, flag:riskScore > 30 },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--purple-bg)', border:'1px solid rgba(124,58,237,0.25)', borderRadius:'var(--r-md)', padding:'14px 16px' }}>
              <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</p>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                <div>
                  <p style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>You</p>
                  <p style={{ fontWeight:700, color: s.flag ? 'var(--danger)' : 'var(--success)', fontSize:'1.1rem' }}>{s.you}</p>
                </div>
                <div>
                  <p style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>Peer avg</p>
                  <p style={{ fontWeight:700, color:'var(--text-2)', fontSize:'1.1rem' }}>{s.avg}</p>
                </div>
                <div>
                  <p style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>Deviation</p>
                  <span className={`badge ${s.flag ? 'badge-danger' : 'badge-success'}`}>{s.diff}</span>
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
          {alerts.length === 0 && <p style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>No recent alerts.</p>}
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RiskEngine;
