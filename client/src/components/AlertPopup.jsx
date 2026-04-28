import React from 'react';
import { AlertTriangle, X, ShieldX, ShieldCheck } from 'lucide-react';

const AlertPopup = ({ transaction, onApprove, onReject, onClose }) => {
  if (!transaction) return null;

  return (
    <div className="alert-overlay" onClick={onClose}>
      <div className="alert-dialog" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button onClick={onClose} style={{
          position:'absolute', top:16, right:16,
          background:'rgba(255,255,255,0.05)', border:'1px solid var(--border-light)',
          borderRadius:'50%', width:32, height:32,
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'var(--text-muted)',
        }}>
          <X size={16} />
        </button>

        {/* Icon */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
          <div style={{
            background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
            padding:20, borderRadius:'50%',
          }}>
            <AlertTriangle size={36} color="var(--danger)" />
          </div>
        </div>

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <h2 style={{ fontSize:'1.3rem', marginBottom:8 }}>🚨 Suspicious Transaction Detected</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.875rem', lineHeight:1.6 }}>
            Our 3-layer fraud engine flagged this transaction as high-risk. Please review and take action.
          </p>
        </div>

        {/* Transaction Details */}
        <div style={{ background:'rgba(0,0,0,0.25)', borderRadius:'var(--r-lg)', padding:20, marginBottom:20, border:'1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {[
              ['Merchant', transaction.merchant],
              ['Amount', `$${Math.abs(transaction.amount).toFixed(2)}`],
              ['Date', transaction.date],
              ['Risk Score', '82 / 100 — HIGH'],
            ].map(([label, value]) => (
              <div key={label}>
                <p style={{ fontSize:'0.7rem', color:'var(--text-dim)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</p>
                <p style={{ fontWeight:700, color: label === 'Amount' || label === 'Risk Score' ? 'var(--danger)' : 'var(--text)', fontSize:'0.95rem' }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Fraud Reasons */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:24 }}>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Detection Signals</p>
          {[
            '📍 Location anomaly — impossible travel speed detected',
            '🧠 Behavioral outlier — Isolation Forest flagged',
            '⏱️ Transaction frequency spike in last 30 minutes',
          ].map(signal => (
            <div key={signal} style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.82rem', color:'var(--text-muted)', background:'var(--surface-2)', padding:'8px 12px', borderRadius:'var(--r-sm)' }}>
              {signal}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="alert-actions">
          <button
            className="btn btn-outline"
            onClick={() => { onReject(); onClose(); }}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
          >
            <ShieldX size={16} color="var(--danger)" /> Decline & Block
          </button>
          <button
            className="btn btn-primary"
            onClick={() => { onApprove(); onClose(); }}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
          >
            <ShieldCheck size={16} /> Approve
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertPopup;
