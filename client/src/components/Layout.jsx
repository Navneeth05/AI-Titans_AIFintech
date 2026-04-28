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
            <span>FinSmart AI</span>
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
        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info" style={{ flex:1, minWidth:0 }}>
            <span>{user?.displayName ?? 'Demo User'}</span>
            <span>{user?.email ?? 'dev@finsmart.local'}</span>
          </div>
          <button onClick={handleLogout} title="Logout"
            style={{ background:'transparent', color:'var(--text-muted)', padding:4, flexShrink:0 }}>
            <LogOut size={15} />
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
