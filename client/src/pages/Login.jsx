import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginWithGoogle, loginWithEmail, isFirebaseConfigured, resetPassword } from '../services/firebase';
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError(''); setResetMessage(''); setLoading(true);
    try {
      await loginWithEmail(email, password);
      navigate('/');
    } catch (err) {
      setError(
        err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' ? 'Incorrect email or password.' :
        err.code === 'auth/user-not-found'     ? 'No account found with this email.' :
        err.code === 'auth/too-many-requests'  ? 'Too many attempts. Try again later.' :
        err.message || 'Login failed.'
      );
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      setResetMessage('');
      return;
    }
    setError(''); setResetMessage('');
    try {
      await resetPassword(email);
      setResetMessage('Password reset link sent! Check your email.');
    } catch (err) {
      setError(err.code === 'auth/user-not-found' ? 'No account found with this email.' : err.message || 'Failed to send reset email.');
    }
  };

  const handleGoogleLogin = async () => {
    setError(''); setResetMessage('');
    try { await loginWithGoogle(); navigate('/'); }
    catch (err) { setError(err.message || 'Google sign-in failed.'); }
  };

  return (
    <div className="auth-page">
      {/* ── Left — Branding ─────────────────────────── */}
      <div className="auth-left">
        <div style={{ maxWidth: 440 }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:36 }}>
            <div style={{
              width:46, height:46, borderRadius:12,
              background:'linear-gradient(135deg,var(--teal),var(--purple))',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'1.3rem', boxShadow:'var(--shadow-teal)',
            }}>🛡️</div>
            <div>
              <p style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:'1.25rem', color:'var(--text)' }}>FinSmart AI</p>
              <p style={{ fontSize:'0.68rem', color:'var(--teal)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Smart FinTech System</p>
            </div>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily:'Space Grotesk', fontSize:'2.6rem', fontWeight:800, lineHeight:1.1, marginBottom:16, letterSpacing:'-0.03em' }}>
            AI-Powered<br />
            <span style={{ background:'linear-gradient(135deg,var(--teal),var(--purple))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              Financial Intelligence
            </span>
          </h1>
          <p style={{ color:'var(--text-muted)', fontSize:'0.92rem', lineHeight:1.7, marginBottom:28 }}>
            NLP transaction classification · GPS fraud detection ·
            Real-time risk scoring · Isolation Forest anomaly detection.
          </p>

          {/* Chips */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:28 }}>
            {['🧠 BERT NLP','⚡ Isolation Forest','📍 GPS Detection','💳 Credit Scoring','🔔 FCM Alerts'].map(f => (
              <span key={f} className="chip" style={{ fontSize:'0.78rem' }}>{f}</span>
            ))}
          </div>

          {/* Pipeline */}
          <div style={{ padding:'14px 16px', background:'white', borderRadius:'var(--r-lg)', border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)' }}>
            <p style={{ fontSize:'0.65rem', fontWeight:700, color:'var(--teal)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:10 }}>
              Processing Pipeline
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
              {['PDF Upload','FastAPI','NLP Engine','ML Models','Risk Score','🔔 Alert'].map((step, i, arr) => (
                <React.Fragment key={step}>
                  <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', background:'var(--bg-2)', padding:'3px 9px', borderRadius:'var(--r-pill)', border:'1px solid var(--border)' }}>{step}</span>
                  {i < arr.length - 1 && <span style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right — Login Form ───────────────────────── */}
      <div className="auth-right">
        <div className="auth-card">
          <h2 style={{ fontFamily:'Space Grotesk', fontSize:'1.5rem', fontWeight:700, marginBottom:4 }}>Welcome back</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.83rem', marginBottom:20 }}>
            New to FinSmart? <Link to="/signup" style={{ color:'var(--teal)', fontWeight:600 }}>Create an account</Link>
          </p>

          {/* Error */}
          {error && (
            <div style={{ display:'flex', gap:8, alignItems:'flex-start', background:'var(--danger-bg)', border:'1px solid var(--danger-border)', borderRadius:'var(--r-md)', padding:'10px 12px', marginBottom:16 }}>
              <AlertCircle size={15} color="var(--danger)" style={{ flexShrink:0, marginTop:1 }} />
              <p style={{ fontSize:'0.8rem', color:'var(--danger)' }}>{error}</p>
            </div>
          )}

          {/* Success */}
          {resetMessage && (
            <div style={{ display:'flex', gap:8, alignItems:'flex-start', background:'rgba(16,185,129,0.1)', border:'1px solid var(--success)', borderRadius:'var(--r-md)', padding:'10px 12px', marginBottom:16 }}>
              <CheckCircle2 size={15} color="var(--success)" style={{ flexShrink:0, marginTop:1 }} />
              <p style={{ fontSize:'0.8rem', color:'var(--success)' }}>{resetMessage}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailLogin}>
            <div className="input-group">
              <label className="input-label">Email</label>
              <div style={{ position:'relative' }}>
                <Mail size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-dim)' }} />
                <input type="email" className="input-field" value={email}
                  onChange={e => setEmail(e.target.value)}
                  required placeholder="you@example.com"
                  style={{ paddingLeft:38 }} />
              </div>
            </div>

            <div className="input-group">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <label className="input-label" style={{ marginBottom:0 }}>Password</label>
                <button type="button" onClick={handleResetPassword} style={{ background:'transparent', border:'none', color:'var(--teal)', fontSize:'0.75rem', fontWeight:600, cursor:'pointer' }}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position:'relative', marginTop:6 }}>
                <Lock size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-dim)' }} />
                <input type="password" className="input-field" value={password}
                  onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••"
                  style={{ paddingLeft:38 }} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width:'100%', marginTop:4 }} disabled={loading}>
              {loading
                ? <><span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'white', borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' }} /> Signing in…</>
                : <>Sign In <ArrowRight size={15} /></>
              }
            </button>
          </form>

          <div className="divider">or</div>

          {/* Google */}
          <button onClick={handleGoogleLogin} className="btn btn-outline" style={{ width:'100%', gap:9 }}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <g transform="matrix(1,0,0,1,27.009001,-39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </g>
            </svg>
            Continue with Google
          </button>

          <p style={{ fontSize:'0.72rem', color:'var(--text-dim)', textAlign:'center', marginTop:20, lineHeight:1.5 }}>
            🔒 Secured by Firebase Auth · Firestore encrypted storage
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
