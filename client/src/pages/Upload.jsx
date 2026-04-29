import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, FileText, CheckCircle2, AlertCircle, Clock, Trash2, ShieldCheck, AlertTriangle, History } from 'lucide-react';
import { uploadBankStatement } from '../services/api';
import { saveUpload, saveCreditScore, saveTransactions, getUploads } from '../services/firestore';
import { useAuth } from '../context/AuthContext';

const MOCK_HISTORY = [
  { id: 'm1', fileName: 'october_statement_sbi.pdf', fileSize: 1250400, creditScore: 720, riskScore: 12, createdAt: new Date(Date.now() - 86400000 * 2) },
  { id: 'm2', fileName: 'amazon_pay_transactions.csv', fileSize: 45200, creditScore: 680, riskScore: 45, createdAt: new Date(Date.now() - 86400000 * 5) },
];

const Upload = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid;

  const [dragActive, setDragActive]   = useState(false);
  const [file, setFile]               = useState(null);
  const [uploading, setUploading]     = useState(false);
  const [status, setStatus]           = useState(null); // 'success' | 'error'
  const [result, setResult]           = useState(null);
  const [history, setHistory]         = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  
  // Geo-fraud alert state
  const [geoAlertTxn, setGeoAlertTxn] = useState(null);
  const [cardBlocked, setCardBlocked] = useState(false);

  // Load upload history
  useEffect(() => {
    if (!uid) {
      setHistory(MOCK_HISTORY);
      setHistLoading(false);
      return;
    }
    
    getUploads(uid)
      .then(data => {
        // If it's a real user, show their data (even if empty)
        // If it's dev-user and no data, show mock
        if (data && data.length > 0) {
          setHistory(data);
        } else if (uid === 'dev-user') {
          setHistory(MOCK_HISTORY);
        } else {
          setHistory([]);
        }
      })
      .catch(() => {
        if (uid === 'dev-user') setHistory(MOCK_HISTORY);
        else setHistory([]);
      })
      .finally(() => setHistLoading(false));
  }, [uid]);

  const handleDrag = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const handleChange = (e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setStatus(null); setResult(null); setGeoAlertTxn(null); setCardBlocked(false);
    
    // Safety timeout: stop processing after 45 seconds no matter what
    const safetyTimer = setTimeout(() => {
      if (uploading) {
        setUploading(false);
        setStatus('error');
        setResult({ errorMessage: 'The analysis is taking longer than expected. Please check your connection or try a smaller file.' });
      }
    }, 45000);

    try {
      // Call FastAPI backend — ML model evaluates risk & credit score
      const backendResult = await uploadBankStatement(file);

      setResult(backendResult);
      setStatus('success');
      
      const flagged = backendResult.transactions?.find(t => t.geo_flagged);
      if (flagged) {
        setGeoAlertTxn(flagged);
      }

      // ── Save to Firestore ──────────────────────────────────────────────
      if (uid) {
        try {
          await saveUpload(uid, {
            fileName:    file.name,
            fileSize:    file.size,
            creditScore: backendResult.creditScore,
            riskScore:   backendResult.riskScore,
            categories:  backendResult.categories ?? {},
            status:      'analyzed',
          });

          if (backendResult.creditScore) {
            await saveCreditScore(uid, backendResult.creditScore, 'upload');
          }

          if (backendResult.transactions?.length) {
            // Save to localStorage as a fallback for the NLP page
            localStorage.setItem('last_uploaded_transactions', JSON.stringify(backendResult.transactions));
            await saveTransactions(uid, backendResult.transactions);
          }
          
          // Refresh history list
          const updatedHistory = await getUploads(uid);
          setHistory(updatedHistory);
          
          console.log("Analysis complete. UI updated. Firestore sync finished.");
        } catch (dbErr) {
          console.warn("Firestore sync failed:", dbErr.message);
        }
      }
    } catch (err) {
      console.error("Upload error details:", err);
      setStatus('error');
      setResult({ 
        errorMessage: err?.response?.data?.detail || err.message || 'Analysis failed. Make sure the FastAPI server is running on port 8000 and you have a stable internet connection.' 
      });
    } finally {
      clearTimeout(safetyTimer);
      setUploading(false);
    }
  };

  const formatBytes = (b) => b > 1024*1024 ? `${(b/1024/1024).toFixed(2)} MB` : `${(b/1024).toFixed(1)} KB`;
  const formatDate  = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {geoAlertTxn && (
        <div className="alert-overlay" style={{ zIndex:999 }}>
          <div className="alert-dialog" style={{ textAlign:'center' }}>
            <div style={{ margin:'0 auto 16px', width:60, height:60, background: cardBlocked ? 'var(--danger)' : 'var(--warning)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {cardBlocked ? <ShieldCheck size={32} color="white" /> : <AlertTriangle size={32} color="white" />}
            </div>
            
            <h2 style={{ fontSize:'1.4rem', color:cardBlocked?'var(--danger)':'var(--text)', marginBottom:8 }}>
              {cardBlocked ? 'Card Blocked' : 'Suspicious Transaction Detected!'}
            </h2>
            
            {cardBlocked ? (
              <p style={{ color:'var(--text-muted)' }}>For your security, we have blocked your card due to a confirmed fraudulent transaction or lack of response.</p>
            ) : (
              <>
                <p style={{ fontSize:'1.1rem', marginBottom:8 }}>
                  ₹{geoAlertTxn.amount} at {geoAlertTxn.description}.
                </p>
                <p style={{ fontSize:'0.9rem', color:'var(--text-muted)', marginBottom:16 }}>
                  {geoAlertTxn.geo_alert || 'Our system detected impossible travel.'}
                </p>
                <div style={{ padding:'12px', background:'var(--danger-bg)', borderRadius:'var(--r-md)', border:'1px solid var(--danger-border)', marginBottom:20 }}>
                  <p style={{ fontWeight:700, color:'var(--danger)', fontSize:'1.2rem' }}>
                    Geo-Velocity Alert
                  </p>
                  <p style={{ fontSize:'0.8rem', color:'var(--danger)' }}>Was this you?</p>
                </div>
                <div className="alert-actions">
                  <button className="btn btn-outline" onClick={() => setGeoAlertTxn(null)}>Yes, it was me</button>
                  <button className="btn btn-danger" onClick={() => setCardBlocked(true)}>No, block card</button>
                </div>
              </>
            )}

            {cardBlocked && (
              <button className="btn btn-primary" style={{ marginTop:24 }} onClick={() => { setGeoAlertTxn(null); setCardBlocked(false); }}>
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 10 }}>
        <div>
          <h1 className="page-title">🏦 Statement & History</h1>
          <p className="page-subtitle">Securely upload and track your financial statements</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <span className="chip">📄 PDF · CSV</span>
          <span className="chip">🧠 NLP Auto-Extract</span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>
        {/* Upload Panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card">
            <h3 style={{ marginBottom:6, fontSize:'1rem' }}>📂 Bank Statement Upload</h3>
            <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:20 }}>
              Supports PDF (pdfplumber / PyMuPDF) and CSV formats. All data is encrypted and stored securely per user.
            </p>

            {!file ? (
              <div
                className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag} onDragLeave={handleDrag}
                onDragOver={handleDrag} onDrop={handleDrop}
                onClick={() => document.getElementById('file-input').click()}
              >
                <input id="file-input" type="file" accept=".pdf,.csv" style={{ display:'none' }} onChange={handleChange} />
                <div style={{ fontSize:'3rem', marginBottom:16 }}>📄</div>
                <h3 style={{ fontSize:'1rem', marginBottom:8 }}>Drag & Drop your statement here</h3>
                <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>or click to browse · PDF, CSV accepted</p>
                <div style={{ marginTop:20, display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                  <span className="chip">🔒 Encrypted</span>
                  <span className="chip">🧠 NLP Parsed</span>
                  <span className="chip">📊 Auto-Categorised</span>
                </div>
              </div>
            ) : (
              <div style={{ background:'var(--surface-2)', borderRadius:'var(--r-lg)', padding:20, border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
                  <div style={{ background:'rgba(13,148,136,0.12)', padding:14, borderRadius:'var(--r-md)' }}>
                    <FileText size={28} color="var(--teal-light)" />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:600, fontSize:'0.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</p>
                    <p style={{ color:'var(--text-muted)', fontSize:'0.8rem', marginTop:3 }}>{formatBytes(file.size)}</p>
                  </div>
                  <button onClick={() => { setFile(null); setStatus(null); setResult(null); }}
                    style={{ background:'transparent', color:'var(--text-muted)', padding:6 }}>
                    <Trash2 size={16} />
                  </button>
                </div>

                {status === 'success' && result && (
                  <div style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:'var(--r-md)', padding:16, marginBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                      <CheckCircle2 size={18} color="var(--success)" />
                      <span style={{ fontWeight:600, color:'var(--success)' }}>Analysis Complete · Data Synced</span>
                    </div>
                    
                    <div className="grid grid-2" style={{ gap:10, marginBottom:16 }}>
                      <div style={{ background:'var(--surface)', borderRadius:'var(--r-sm)', padding:12 }}>
                        <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:4 }}>CREDIT SCORE</p>
                        <p style={{ fontSize:'1.5rem', fontWeight:800, color:'var(--teal-light)' }}>{result.creditScore ?? '—'}</p>
                      </div>
                      <div style={{ background:'var(--surface)', borderRadius:'var(--r-sm)', padding:12 }}>
                        <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:4 }}>RISK SCORE</p>
                        <p style={{ fontSize:'1.5rem', fontWeight:800, color: result.riskScore >= 71 ? 'var(--danger)' : result.riskScore >= 31 ? 'var(--warning)' : 'var(--success)' }}>
                          {result.riskScore ?? '—'}<span style={{ fontSize:'0.8rem', fontWeight:400 }}>/100</span>
                        </p>
                      </div>
                    </div>

                    {/* NLP Visual Category Breakdown */}
                    {result.categories && Object.keys(result.categories).length > 0 && (
                      <div style={{ marginBottom:16 }}>
                        <p style={{ fontSize:'0.75rem', fontWeight:600, marginBottom:8, color:'var(--text-muted)' }}>🧠 NLP SPENDING CLASSIFICATION</p>
                        <div style={{ display:'flex', height:8, borderRadius:4, overflow:'hidden', background:'var(--border-light)', marginBottom:10 }}>
                          {Object.entries(result.categories).map(([name, amount], idx) => {
                            const total = Object.values(result.categories).reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? (amount / total * 100) : 0;
                            const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b'];
                            return <div key={name} style={{ width: `${pct}%`, background: colors[idx % colors.length] }} title={`${name}: ${pct.toFixed(0)}%`} />;
                          })}
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                          {Object.keys(result.categories).slice(0, 4).map((name, idx) => (
                            <span key={name} style={{ fontSize:'0.65rem', display:'flex', alignItems:'center', gap:4 }}>
                              <div style={{ width:6, height:6, borderRadius:'50%', background:['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'][idx % 4] }} /> {name}
                            </span>
                          ))}
                          {Object.keys(result.categories).length > 4 && <span style={{ fontSize:'0.65rem', color:'var(--text-dim)' }}>+{Object.keys(result.categories).length - 4} more</span>}
                        </div>
                      </div>
                    )}

                    <button className="btn btn-teal btn-sm" style={{ width:'100%', display:'flex', gap:6, justifyContent:'center' }} onClick={() => navigate('/nlp')}>
                       View NLP Details & Classification →
                    </button>
                  </div>
                )}

                {status === 'error' && (
                  <div style={{ display:'flex', gap:10, alignItems:'flex-start', background:'var(--danger-bg)', borderRadius:'var(--r-md)', padding:12, marginBottom:16, flexDirection:'column' }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <AlertCircle size={16} color="var(--danger)" />
                      <span style={{ fontSize:'0.85rem', fontWeight:600, color:'var(--danger)' }}>Upload Analysis Failed</span>
                    </div>
                    <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.5 }}>
                      {result?.errorMessage || 'Ensure the FastAPI backend server is running so the ML model can evaluate the risk and credit score.'}
                    </p>
                  </div>
                )}

                <div style={{ display:'flex', gap:12 }}>
                  <button className="btn btn-outline" style={{ flex:1 }}
                    onClick={() => { setFile(null); setStatus(null); setResult(null); }}
                    disabled={uploading}>
                    {status === 'success' ? 'Upload New' : 'Cancel'}
                  </button>
                  {status !== 'success' && (
                    <button className="btn btn-primary" style={{ flex:2 }}
                      onClick={handleUpload}
                      disabled={uploading}>
                      {uploading ? (
                        <><span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block', animation:'spin .8s linear infinite' }} /> Processing…</>
                      ) : '🧠 Upload & Analyse'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* AI Pipeline card */}
          <div className="card card-teal" style={{ padding:20 }}>
            <h3 style={{ fontSize:'0.9rem', marginBottom:12 }}>🔄 How it works</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                ['📄','Parse','pdfplumber / PyMuPDF extracts raw text'],
                ['🧠','NLP Classify','TF-IDF + BERT classifies 5 categories'],
                ['🔍','Fraud Check','Isolation Forest + K-Means + Geo'],
                ['📊','Risk Score','0-100 engine scores each transaction'],
                ['💾','Store','Saved to your Firestore account'],
              ].map(([icon, step, desc]) => (
                <div key={step} style={{ display:'flex', alignItems:'flex-start', gap:12, fontSize:'0.82rem' }}>
                  <span style={{ fontSize:'1rem', flexShrink:0 }}>{icon}</span>
                  <div>
                    <span style={{ fontWeight:600, color:'var(--teal-light)' }}>{step} — </span>
                    <span style={{ color:'var(--text-muted)' }}>{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upload History Panel */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <h3 style={{ fontSize:'1rem' }}>📜 Upload History</h3>
            <span className="badge badge-teal">{history.length} uploads</span>
          </div>

          {histLoading ? (
            <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>Loading history…</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:'2.5rem', marginBottom:12 }}>📭</div>
              <p style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>No uploads yet</p>
              <p style={{ color:'var(--text-dim)', fontSize:'0.8rem', marginTop:4 }}>Upload your first bank statement to get started</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {history.map(h => (
                <div key={h.id} style={{
                  padding:14, borderRadius:'var(--r-md)',
                  border:'1px solid var(--border-light)',
                  background:'var(--surface-2)',
                  display:'flex', justifyContent:'space-between', alignItems:'flex-start',
                  gap:12,
                }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                      <FileText size={14} color="var(--teal-light)" />
                      <span style={{ fontWeight:600, fontSize:'0.85rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.fileName}</span>
                    </div>
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                      {h.creditScore && <span className="chip" style={{ fontSize:'0.7rem' }}>Credit: {h.creditScore}</span>}
                      {h.riskScore !== undefined && (
                        <span className={`badge ${h.riskScore >= 71 ? 'badge-danger' : h.riskScore >= 31 ? 'badge-warning' : 'badge-success'}`} style={{ fontSize:'0.65rem' }}>
                          Risk: {h.riskScore}/100
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ flexShrink:0, textAlign:'right' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text-muted)', fontSize:'0.75rem', fontWeight:500 }}>
                      <Clock size={13} /> {formatDate(h.createdAt)}
                    </div>
                    <button className="btn btn-sm btn-outline" style={{ marginTop:8, fontSize:'0.7rem', padding:'4px 8px' }} onClick={() => navigate('/nlp')}>
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Upload;
