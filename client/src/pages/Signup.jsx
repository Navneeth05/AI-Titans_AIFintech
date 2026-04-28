import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerWithEmail, loginWithGoogle, isFirebaseConfigured } from '../services/firebase';
import { saveUserProfile } from '../services/firestore';
import { Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

const Signup = () => {
  const navigate = useNavigate();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const user = await registerWithEmail(email, password);
      // Save profile to Firestore
      await saveUserProfile(user.uid, {
        displayName: name,
        email: user.email,
        createdAt: new Date().toISOString(),
      });
      navigate('/');
    } catch (err) {
      setError(
        err.code === 'auth/email-already-in-use'  ? 'An account with this email already exists.' :
        err.code === 'auth/invalid-email'          ? 'Invalid email address.' :
        err.code === 'auth/weak-password'          ? 'Password is too weak.' :
        err.message || 'Sign up failed.'
      );
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError('');
    try { await loginWithGoogle(); navigate('/'); }
    catch (err) { setError(err.message || 'Google sign-in failed.'); }
  };

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthLabel = ['', 'Weak', 'Good', 'Strong'];
  const strengthColor = ['', 'var(--danger)', 'var(--warning)', 'var(--success)'];

  return (
    <div className="auth-page">
      {/* ── Left — Branding ─── */}
      <div className="auth-left">
        <div style={{ maxWidth: 440 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:36 }}>
            <div style={{ width:46, height:46, borderRadius:12, background:'linear-gradient(135deg,var(--teal),var(--purple))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', boxShadow:'var(--shadow-teal)' }}>🛡️</div>
            <div>
              <p style={{ fontFamily:'Space Grotesk', fontWeight:700, fontSize:'1.25rem', color:'var(--text)' }}>FinSmart AI</p>
              <p style={{ fontSize:'0.68rem', color:'var(--teal)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Smart FinTech System</p>
            </div>
          </div>
          <h1 style={{ fontFamily:'Space Grotesk', fontSize:'2.4rem', fontWeight:800, lineHeight:1.15, marginBottom:16, letterSpacing:'-0.03em' }}>
            Start your<br />
            <span style={{ background:'linear-gradient(135deg,var(--teal),var(--purple))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              Financial Journey
            </span>
          </h1>
          <p style={{ color:'var(--text-muted)', fontSize:'0.9rem', lineHeight:1.7, marginBottom:24 }}>
            Create an account to get AI-powered insights, real-time fraud detection, and personalized credit scoring.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {['✅ Upload & analyse bank statements (PDF/CSV)', '🧠 NLP classification across 7 expense categories', '📍 GPS-based impossible travel fraud detection', '📊 Personalized credit & risk scoring', '🔔 Real-time fraud email alerts'].map(f => (
              <div key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:'0.83rem', color:'var(--text-muted)' }}>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right — Signup Form ─── */}
      <div className="auth-right">
        <div className="auth-card">
          <h2 style={{ fontFamily:'Space Grotesk', fontSize:'1.5rem', fontWeight:700, marginBottom:4 }}>Create account</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.83rem', marginBottom:20 }}>
            Already have an account? <Link to="/login" style={{ color:'var(--teal)', fontWeight:600 }}>Sign in</Link>
          </p>

          {error && (
            <div style={{ display:'flex', gap:8, alignItems:'flex-start', background:'var(--danger-bg)', border:'1px solid var(--danger-border)', borderRadius:'var(--r-md)', padding:'10px 12px', marginBottom:16 }}>
              <AlertCircle size={15} color="var(--danger)" style={{ flexShrink:0, marginTop:1 }} />
              <p style={{ fontSize:'0.8rem', color:'var(--danger)' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSignup}>
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <div style={{ position:'relative' }}>
                <User size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-dim)' }} />
                <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required placeholder="Your full name" style={{ paddingLeft:38 }} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Email</label>
              <div style={{ position:'relative' }}>
                <Mail size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-dim)' }} />
                <input type="email" className="input-field" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={{ paddingLeft:38 }} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div style={{ position:'relative' }}>
                <Lock size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-dim)' }} />
                <input type="password" className="input-field" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min 6 characters" style={{ paddingLeft:38 }} />
              </div>
              {password.length > 0 && (
                <div style={{ marginTop:6 }}>
                  <div style={{ display:'flex', gap:4 }}>
                    {[1,2,3].map(i => <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i <= strength ? strengthColor[strength] : 'var(--border)', transition:'all 0.3s' }} />)}
                  </div>
                  <p style={{ fontSize:'0.72rem', color:strengthColor[strength], marginTop:3 }}>{strengthLabel[strength]}</p>
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Confirm Password</label>
              <div style={{ position:'relative' }}>
                <Lock size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-dim)' }} />
                <input type="password" className="input-field" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Repeat password" style={{ paddingLeft:38, borderColor: confirm && confirm !== password ? 'var(--danger)' : '' }} />
                {confirm && confirm === password && <CheckCircle2 size={15} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)' }} color="var(--success)" />}
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width:'100%', marginTop:4 }} disabled={loading || !isFirebaseConfigured}>
              {loading
                ? <><span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'white', borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' }} /> Creating account…</>
                : <>Create Account <ArrowRight size={15} /></>
              }
            </button>
          </form>

          <div className="divider">or</div>

          <button onClick={handleGoogle} className="btn btn-outline" style={{ width:'100%', gap:9 }} disabled={!isFirebaseConfigured}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <g transform="matrix(1,0,0,1,27.009001,-39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </g>
            </svg>
            Sign up with Google
          </button>

          <p style={{ fontSize:'0.72rem', color:'var(--text-dim)', textAlign:'center', marginTop:16 }}>
            By signing up you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
