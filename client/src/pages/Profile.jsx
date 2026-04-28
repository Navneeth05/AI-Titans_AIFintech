import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { logout, updateProfileName } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, getCreditScoreHistory, saveUserProfile } from '../services/firestore';
import { User, Mail, Shield, ShieldAlert, Key, LogOut, Edit2, Check, X } from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await updateProfileName(newName);
      if (user?.uid) {
        await saveUserProfile(user.uid, { displayName: newName });
      }
      setEditingName(false);
    } catch (err) {
      console.error("Failed to update name:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      getUserProfile(user.uid).then(data => {
        setProfileData(data);
        setNewName(user.displayName || '');
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [user]);

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
    : (user?.email?.[0] ?? 'U').toUpperCase();

  if (loading) return <div style={{ padding:40, textAlign:'center' }}>Loading profile...</div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">👤 User Profile</h1>
          <p className="page-subtitle">Manage your account and security settings</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
        {/* Profile Card */}
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: 'var(--teal)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', fontWeight: 700, margin: '0 auto 16px'
          }}>
            {initials}
          </div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 4 }}>{user?.displayName || 'Demo User'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20 }}>{user?.email || 'No email provided'}</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
            <div style={{ background: 'var(--surface)', padding: 12, borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Latest Credit Score</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--teal)' }}>{profileData?.latestCreditScore || 'N/A'}</p>
            </div>
            <div style={{ background: 'var(--surface)', padding: 12, borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Account Status</p>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: profileData?.cardBlocked ? 'var(--danger)' : 'var(--success)' }}>
                {profileData?.cardBlocked ? '💳 Card Blocked' : '✅ Active & Verified'}
              </p>
            </div>
          </div>
          
          <button className="btn btn-outline" onClick={handleLogout} style={{ width: '100%', marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <LogOut size={16} /> Logout
          </button>
        </div>

        {/* Details and Security */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={18} /> Personal Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Full Name</p>
                {editingName ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <input 
                      className="input-field" 
                      value={newName} 
                      onChange={e => setNewName(e.target.value)} 
                      style={{ padding: '6px 10px', fontSize: '0.875rem' }}
                    />
                    <button className="btn btn-sm btn-primary" onClick={handleUpdateName} disabled={saving}>
                      <Check size={14} />
                    </button>
                    <button className="btn btn-sm btn-outline" onClick={() => { setEditingName(false); setNewName(user.displayName); }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {user?.displayName || 'Demo User'}
                    <button 
                      onClick={() => setEditingName(true)} 
                      style={{ background: 'transparent', color: 'var(--teal)', padding: 4, display: 'flex' }}
                    >
                      <Edit2 size={14} />
                    </button>
                  </p>
                )}
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email Address</p>
                <p style={{ fontWeight: 500 }}>{user?.email}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Linked Bank</p>
                <p style={{ fontWeight: 500 }}>🏦 {user?.bank || 'State Bank of India'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Member Since</p>
                <p style={{ fontWeight: 500 }}>{new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div className="card card-purple">
            <h3 style={{ fontSize: '1.05rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} /> Security & Fraud Settings
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p style={{ fontWeight: 600 }}>Two-Factor Authentication (2FA)</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Secure your account with an extra step.</p>
                </div>
                <button className="btn btn-sm btn-outline">Enable</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p style={{ fontWeight: 600 }}>Real-time Fraud Alerts</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Receive continuous FCM alerts if suspicious activity is found.</p>
                </div>
                <span className="badge badge-success">Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                <div>
                  <p style={{ fontWeight: 600 }}>Card Auto-Block</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Block card automatically if no response to alerts within 60s.</p>
                </div>
                <span className="badge badge-success">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
