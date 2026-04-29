import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Upload, Brain, Zap, LogOut } from 'lucide-react';
import { logout } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const navigate = useNavigate();
  const { user }  = useAuth();

  const handleLogout = async () => {
    try { await logout(); navigate('/login'); } catch (e) { console.error(e); }
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
    : (user?.email?.[0] ?? 'U').toUpperCase();

  return (
    <div className="app-container">
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">🛡️</div>
          <div className="logo-text">
            <span>AIFintech</span>
            <span>Smart FinTech System</span>
          </div>
        </div>

        {/* Main nav */}
        <p className="nav-section-label">Main</p>
        <nav className="nav-links">
          <NavLink to="/" end className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
            <LayoutDashboard size={17} /> Dashboard
          </NavLink>
          <NavLink to="/upload" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
            <Upload size={17} /> Upload Statement
          </NavLink>
        </nav>

        {/* AI Engine nav */}
        <p className="nav-section-label">AI Engine</p>
        <nav className="nav-links">
          <NavLink to="/nlp" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
            <Brain size={17} /> NLP Classifier
            <span className="badge badge-teal" style={{ marginLeft:'auto', fontSize:'0.6rem', padding:'2px 6px' }}>NEW</span>
          </NavLink>
          <NavLink to="/risk" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}>
            <Zap size={17} /> Risk Engine
            <span className="badge badge-purple" style={{ marginLeft:'auto', fontSize:'0.6rem', padding:'2px 6px' }}>GPS</span>
          </NavLink>
        </nav>

        {/* User footer */}
        <div className="sidebar-user" style={{ display: 'flex', alignItems: 'center' }}>
          <NavLink to="/profile" style={{ display: 'flex', alignItems: 'center', flex: 1, textDecoration: 'none', color: 'inherit', minWidth: 0, gap: 12 }}>
            <div className="user-avatar">{initials}</div>
            <div className="user-info" style={{ flex:1, minWidth:0 }}>
              <span style={{ display: 'block', fontWeight: 600 }}>{user?.displayName ?? 'Demo User'}</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email ?? 'dev@aifintech.local'}</span>
              <span style={{ fontSize:'0.65rem', color:'var(--teal)', fontWeight:600, marginTop:2, display:'block' }}>
                🏦 {user?.bank ?? 'Bank Not Linked'}
              </span>
            </div>
          </NavLink>
          <button onClick={handleLogout} title="Logout"
            style={{ background:'transparent', color:'var(--text-muted)', padding:4, flexShrink:0, alignSelf:'center', cursor: 'pointer', border: 'none' }}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
