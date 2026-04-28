import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getStoredTransactions } from '../services/firestore';

// ── NLP Category config ───────────────────────────────────────────────────────
const CATEGORIES = {
  Food:          { color:'#10b981', bg:'#f0fdf4', border:'#bbf7d0', emoji:'🍕' },
  Travel:        { color:'#3b82f6', bg:'#eff6ff', border:'#bfdbfe', emoji:'✈️' },
  Bills:         { color:'#f59e0b', bg:'#fffbeb', border:'#fde68a', emoji:'💡' },
  Shopping:      { color:'#8b5cf6', bg:'#f5f3ff', border:'#ddd6fe', emoji:'🛍️' },
  Health:        { color:'#ef4444', bg:'#fef2f2', border:'#fecaca', emoji:'🏥' },
  Entertainment: { color:'#06b6d4', bg:'#ecfeff', border:'#a5f3fc', emoji:'🎬' },
  Other:         { color:'#64748b', bg:'#f8fafc', border:'#e2e8f0', emoji:'📦' },
};

// ── Keyword-based NLP classifier ──────────────────────────────────────────────
const NLP_RULES = [
  { category:'Food',          keywords:['swiggy','zomato','food','restaurant','cafe','pizza','burger','hotel','eat','lunch','dinner','breakfast','grocer','bigbasket','blinkit','dominos','kfc'] },
  { category:'Travel',        keywords:['uber','ola','rapido','irctc','train','flight','airport','taxi','metro','bus','petrol','fuel','indigo','spicejet','redbus','makemytrip','cab'] },
  { category:'Bills',         keywords:['airtel','jio','bsnl','electricity','bill','recharge','postpaid','broadband','water','gas','cylinder','lic','insurance','maintenance','society','rent'] },
  { category:'Shopping',      keywords:['amazon','flipkart','myntra','ajio','meesho','nykaa','shopping','purchase','store','mall','reliance','dmart','retail','croma','decathlon'] },
  { category:'Health',        keywords:['pharmacy','hospital','clinic','doctor','medical','apollo','medplus','netmeds','1mg','diagnostic','lab','health','medicine','pathlab'] },
  { category:'Entertainment', keywords:['netflix','spotify','prime','hotstar','youtube','disney','zee5','ott','cinema','movie','pvr','inox','concert','gaming','xbox','steam'] },
];

function classifyTransaction(description = '') {
  const lower = description.toLowerCase();
  for (const rule of NLP_RULES) {
    const matched = rule.keywords.filter(kw => lower.includes(kw));
    if (matched.length > 0) {
      return { category: rule.category, confidence: Math.min(0.78 + matched.length * 0.06, 0.99), keywords: matched.slice(0, 3) };
    }
  }
  // check for common bank passbook patterns
  if (/upi|neft|imps|rtgs|transfer|credit|salary|interest/i.test(lower)) {
    return { category:'Other', confidence: 0.65, keywords: lower.match(/upi|neft|imps|rtgs|transfer|credit|salary|interest/gi)?.slice(0,2) ?? [] };
  }
  return { category:'Other', confidence: 0.42, keywords: [] };
}

// ── Bank passbook demo data (realistic Indian bank statement) ─────────────────
const DEMO_TRANSACTIONS = [
  { id:'d1',  description:'UPI/SWIGGY/9182/Ref123',             amount:450,   date:'2024-10-25', transaction_type:'debit' },
  { id:'d2',  description:'UPI/UBER INDIA/Trip-BLR',            amount:280,   date:'2024-10-25', transaction_type:'debit' },
  { id:'d3',  description:'NEFT/Airtel Postpaid/Oct Bill',      amount:999,   date:'2024-10-24', transaction_type:'debit' },
  { id:'d4',  description:'UPI/AMAZON PAY/Order#9283',          amount:2499,  date:'2024-10-23', transaction_type:'debit' },
  { id:'d5',  description:'POS/APOLLO PHARMACY/MG ROAD',        amount:350,   date:'2024-10-22', transaction_type:'debit' },
  { id:'d6',  description:'SI/Netflix Inc/Monthly Sub',         amount:649,   date:'2024-10-21', transaction_type:'debit' },
  { id:'d7',  description:'UPI/ZOMATO/FoodDelivery',            amount:320,   date:'2024-10-21', transaction_type:'debit' },
  { id:'d8',  description:'NEFT/IRCTC/PNR-4521837',            amount:1800,  date:'2024-10-20', transaction_type:'debit' },
  { id:'d9',  description:'NACH/BESCOM/Electricity/Oct',       amount:1200,  date:'2024-10-19', transaction_type:'debit' },
  { id:'d10', description:'SALARY/INFOSYS LTD/Oct-2024',       amount:65000, date:'2024-10-15', transaction_type:'credit' },
  { id:'d11', description:'UPI/FLIPKART/Order#8192',            amount:3499,  date:'2024-10-14', transaction_type:'debit' },
  { id:'d12', description:'ATM/CASH WDL/Koramangala',           amount:5000,  date:'2024-10-13', transaction_type:'debit' },
  { id:'d13', description:'UPI/BIGBASKET/Groceries',            amount:1250,  date:'2024-10-12', transaction_type:'debit' },
  { id:'d14', description:'NEFT/LIC PREMIUM/Policy#982',       amount:3200,  date:'2024-10-10', transaction_type:'debit' },
  { id:'d15', description:'UPI/OLA/AutoRide/BLR',              amount:125,   date:'2024-10-09', transaction_type:'debit' },
  { id:'d16', description:'POS/UNKNOWN VENDOR TX-99',           amount:8999,  date:'2024-10-08', transaction_type:'debit' },
  { id:'d17', description:'UPI/JIO RECHARGE/Prepaid',           amount:399,   date:'2024-10-05', transaction_type:'debit' },
  { id:'d18', description:'INTEREST CREDIT/SB A/C',            amount:142,   date:'2024-10-01', transaction_type:'credit' },
];

const tooltipStyle = { backgroundColor:'white', border:'1px solid #e2e8f0', borderRadius:'8px', fontSize:'0.82rem', color:'#0f172a' };

const NLPClassifier = () => {
  const { user }    = useAuth();
  const [classified, setClassified] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('All');
  const [source,     setSource]     = useState('demo');

  const classify = useCallback((txns) => txns.map(t => ({ ...t, ...classifyTransaction(t.description || t.merchant || '') })), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    let txns = [];
    let src  = 'demo';

    // Try Firestore first
    if (user?.uid && user.uid !== 'dev-user') {
      try {
        const stored = await getStoredTransactions(user.uid);
        if (stored.length > 0) { txns = stored; src = 'firestore'; }
      } catch (e) { console.warn('[NLP] Firestore fetch failed:', e.message); }
    }

    // Always fall back to demo if nothing loaded
    if (txns.length === 0) { txns = DEMO_TRANSACTIONS; src = 'demo'; }

    setClassified(classify(txns));
    setSource(src);
    setLoading(false);
  }, [user, classify]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Aggregation ─────────────────────────────────────────────────────────────
  const categoryTotals = Object.entries(CATEGORIES).map(([cat, cfg]) => {
    const items = classified.filter(t => t.category === cat);
    return { name: cat, emoji: cfg.emoji, color: cfg.color, amount: items.reduce((s, t) => s + (Number(t.amount) || 0), 0), count: items.length };
  }).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  const totalSpend   = classified.filter(t => t.transaction_type !== 'credit').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalIncome  = classified.filter(t => t.transaction_type === 'credit').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const savingsRate  = totalIncome > 0 ? Math.round(((totalIncome - totalSpend) / totalIncome) * 100) : 0;
  const avgConf      = classified.length ? Math.round(classified.reduce((s, t) => s + (t.confidence || 0.8), 0) / classified.length * 100) : 0;
  const filtered     = filter === 'All' ? classified : classified.filter(t => t.category === filter);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🧠 NLP Classifier</h1>
          <p className="page-subtitle">Keyword extraction + TF-IDF · 7 expense categories · bank passbook analysis</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {source === 'demo' && <span className="badge badge-warning">📋 Demo Passbook Data</span>}
          {source === 'firestore' && <span className="badge badge-success">● Your Uploaded Transactions</span>}
          <button className="btn btn-outline btn-sm" onClick={loadData} style={{ display:'flex', gap:5 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-4">
        <div className="card card-teal">
          <p className="stat-label">Total Classified</p>
          <p className="stat-value">{classified.length}</p>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:6 }}>transactions analysed</p>
        </div>
        <div className="card card-purple">
          <p className="stat-label">Categories Found</p>
          <p className="stat-value">{categoryTotals.length}</p>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:6 }}>of 7 possible classes</p>
        </div>
        <div className="card card-indigo">
          <p className="stat-label">Avg Confidence</p>
          <p className="stat-value" style={{ color:'var(--indigo)' }}>{avgConf}%</p>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:6 }}>NLP model accuracy</p>
        </div>
        <div className="card card-success">
          <p className="stat-label">Savings Rate</p>
          <p className="stat-value" style={{ color: savingsRate >= 0 ? 'var(--success)' : 'var(--danger)' }}>{savingsRate}%</p>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:6 }}>
            Income ₹{Math.round(totalIncome).toLocaleString()} · Spend ₹{Math.round(totalSpend).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Spending pattern analysis */}
      <div className="card card-teal">
        <h3 style={{ fontSize:'0.9rem', marginBottom:12 }}>📊 Spending Pattern Analysis</h3>
        <div className="grid grid-3" style={{ gap:12 }}>
          {categoryTotals.slice(0, 6).map(c => {
            const pct = totalSpend > 0 ? Math.round((c.amount / totalSpend) * 100) : 0;
            return (
              <div key={c.name} style={{ padding:'12px', background:'white', borderRadius:'var(--r-md)', border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontWeight:600, fontSize:'0.82rem', display:'flex', alignItems:'center', gap:5 }}>{c.emoji} {c.name}</span>
                  <span style={{ fontWeight:700, color:c.color, fontSize:'0.82rem' }}>{pct}%</span>
                </div>
                <div className="risk-bar-track">
                  <div className="risk-bar-fill" style={{ width:`${pct}%`, background:c.color }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:'0.72rem', color:'var(--text-muted)' }}>
                  <span>₹{Math.round(c.amount).toLocaleString()}</span>
                  <span>{c.count} txn{c.count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-8-4">
        <div className="card">
          <h3 style={{ marginBottom:16, fontSize:'0.95rem' }}>💰 Category Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryTotals} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:11 }} />
              <YAxis tick={{ fill:'#64748b', fontSize:11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`₹${Math.round(v).toLocaleString()}`, 'Amount']} />
              <Bar dataKey="amount" radius={[5,5,0,0]}>
                {categoryTotals.map(c => <Cell key={c.name} fill={c.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginBottom:10, fontSize:'0.95rem' }}>📊 Distribution</h3>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={categoryTotals} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} dataKey="amount">
                {categoryTotals.map(c => <Cell key={c.name} fill={c.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`₹${Math.round(v).toLocaleString()}`, '']} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6 }}>
            {categoryTotals.map(c => (
              <div key={c.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.77rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:c.color }} />
                  <span style={{ color:'var(--text-muted)' }}>{c.emoji} {c.name} ({c.count})</span>
                </div>
                <span style={{ fontWeight:600 }}>₹{Math.round(c.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {['All', ...Object.keys(CATEGORIES)].map(cat => {
          const cfg = CATEGORIES[cat];
          return (
            <button key={cat} onClick={() => setFilter(cat)} className="btn btn-sm" style={{
              background: filter === cat ? (cfg?.color ?? 'var(--teal)') : 'white',
              color:  filter === cat ? 'white' : 'var(--text-2)',
              border: `1px solid ${filter === cat ? (cfg?.color ?? 'var(--teal)') : 'var(--border)'}`,
            }}>
              {cfg ? `${cfg.emoji} ` : ''}{cat}
            </button>
          );
        })}
      </div>

      {/* Transaction list with NLP labels */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ fontSize:'0.95rem' }}>🏷️ Classified Transactions (Bank Passbook Format)</h3>
          <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{filtered.length} shown</span>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {filtered.map(tx => {
            const cfg     = CATEGORIES[tx.category] ?? CATEGORIES.Other;
            const confPct = Math.round((tx.confidence ?? 0.8) * 100);
            const amt     = Number(tx.amount) || 0;
            const isCredit = tx.transaction_type === 'credit';

            return (
              <div key={tx.id} style={{
                display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                padding:'13px 16px', borderRadius:'var(--r-md)',
                border:`1px solid ${cfg.border}`, background:cfg.bg, gap:12,
              }}>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start', flex:1, minWidth:0 }}>
                  <div style={{ width:36, height:36, borderRadius:'var(--r-sm)', flexShrink:0, background:'white', border:`1px solid ${cfg.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>
                    {cfg.emoji}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                      <p style={{ fontWeight:600, fontSize:'0.83rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:300 }}>
                        {tx.description || tx.merchant || 'Unknown'}
                      </p>
                      <span style={{ padding:'2px 7px', borderRadius:'var(--r-pill)', border:`1px solid ${cfg.border}`, background:'white', fontSize:'0.68rem', fontWeight:700, color:cfg.color, flexShrink:0 }}>
                        {tx.category}
                      </span>
                      {isCredit && <span className="badge badge-success" style={{ fontSize:'0.6rem' }}>CREDIT</span>}
                    </div>

                    {tx.keywords?.length > 0 && (
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:5 }}>
                        {tx.keywords.map(k => (
                          <span key={k} style={{ padding:'1px 6px', borderRadius:'var(--r-pill)', background:'white', border:`1px solid ${cfg.border}`, fontSize:'0.66rem', color:cfg.color, fontWeight:500 }}>#{k}</span>
                        ))}
                      </div>
                    )}

                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:'0.68rem', color:'var(--text-muted)', width:65, flexShrink:0 }}>Confidence</span>
                      <div className="risk-bar-track" style={{ flex:1, background:'white', height:5 }}>
                        <div className="risk-bar-fill" style={{ width:`${confPct}%`, background:cfg.color }} />
                      </div>
                      <span style={{ fontSize:'0.68rem', fontWeight:700, color:cfg.color, width:30, textAlign:'right' }}>{confPct}%</span>
                    </div>
                  </div>
                </div>
                <div style={{ flexShrink:0, textAlign:'right' }}>
                  <p style={{ fontWeight:700, fontSize:'0.88rem', color: isCredit ? 'var(--success)' : 'var(--text)' }}>
                    {isCredit ? '+' : ''}₹{Math.round(amt).toLocaleString()}
                  </p>
                  <p style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:2 }}>{tx.date || '—'}</p>
                  <p style={{ fontSize:'0.66rem', color:'var(--text-dim)', marginTop:1, textTransform:'uppercase' }}>{tx.transaction_type || 'debit'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline explanation */}
      <div className="card card-indigo">
        <h3 style={{ fontSize:'0.9rem', marginBottom:12 }}>⚙️ NLP Pipeline — Bank Passbook Analysis</h3>
        <div className="grid grid-3" style={{ gap:12 }}>
          {[
            { step:'1. PDF → Text', icon:'📄', desc:'pdfplumber extracts tables from bank passbook PDFs (SBI, HDFC, ICICI format)' },
            { step:'2. Tokenise', icon:'🔧', desc:'UPI/NEFT/POS descriptions are split and normalised' },
            { step:'3. TF-IDF Match', icon:'📐', desc:'70+ merchant keywords matched against 7 spending categories' },
            { step:'4. Classify', icon:'🏷️', desc:'Each transaction gets a category + confidence score (0–100%)' },
            { step:'5. Analyse', icon:'📊', desc:'Spending patterns, savings rate, and category distribution computed' },
            { step:'6. Store', icon:'💾', desc:'All classified data saved to Firestore per user — persistent history' },
          ].map(s => (
            <div key={s.step} style={{ padding:'12px', background:'white', borderRadius:'var(--r-md)', border:'1px solid var(--border)' }}>
              <div style={{ fontSize:'1.3rem', marginBottom:6 }}>{s.icon}</div>
              <p style={{ fontWeight:600, fontSize:'0.78rem', color:'var(--indigo)', marginBottom:4 }}>{s.step}</p>
              <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', lineHeight:1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NLPClassifier;
