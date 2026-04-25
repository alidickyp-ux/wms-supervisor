import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  LogOut, ChevronDown, ChevronLeft, Menu, AlertCircle,
  BoxSelect, Truck, Package, Loader2, Eye, EyeOff, User, Lock
} from 'lucide-react';
import axios from 'axios';
import { API_BASE, GLOBAL_CSS } from './shared';

const InventoryPage = lazy(() => import('./InventoryPage'));
const OutboundPage  = lazy(() => import('./OutboundPage'));
const DispatchPage  = lazy(() => import('./DispatchPage'));

const NAV = [
  { key:'inventory', label:'Inventory', icon:<BoxSelect size={13}/>,
    children:['Cycle Count','Pick Compliance','Master Lokasi'] },
  { key:'outbound',  label:'Outbound',  icon:<Truck size={13}/>,
    children:['Outbound B2B'] },
  { key:'dispatch',  label:'Dispatch',  icon:<Package size={13}/>,
    children:['Online Dispatch'] },
];

function PageLoader() {
  return (
    <div style={{textAlign:'center',padding:48,color:'var(--muted2)'}}>
      <Loader2 size={22} className="spin" style={{marginBottom:8}}/>
      <div style={{fontSize:'0.65rem'}}>Memuat modul...</div>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser]             = useState(null);
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [expandedGroup, setExpandedGroup] = useState('inventory');
  const [activeMenu, setActiveMenu]       = useState('Cycle Count');
  const [userMenuOpen, setUserMenuOpen]   = useState(false);
  const [toast, setToast] = useState({ show:false, msg:'', type:'success' });

  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Tutup userMenu saat klik di luar
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = () => setUserMenuOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [userMenuOpen]);

  const showToast = (msg, type='success') => {
    setToast({ show:true, msg, type });
    setTimeout(() => setToast({ show:false, msg:'', type:'success' }), 3000);
  };

  const handleLogin = async () => {
    if (!username || !password) return;
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data?.status === 'success') {
        setUser(res.data.user);
        setIsLoggedIn(true);
        setSidebarOpen(!isMobile);
      } else showToast("User / Password salah", "error");
    } catch { showToast("Server error", "error"); }
    finally { setLoginLoading(false); }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setUsername('');
    setPassword('');
    setUserMenuOpen(false);
  };

  const navigate = (menu) => {
    setActiveMenu(menu);
    if (isMobile) setSidebarOpen(false);
  };

  const activeGroup = NAV.find(g => g.children.includes(activeMenu))?.key;

  /* ══════════════════════════════════════════════════════════════════
     LOGIN PAGE
  ══════════════════════════════════════════════════════════════════ */
  if (!isLoggedIn) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      fontFamily:"'DM Sans',sans-serif",background:'#f0eeea',overflow:'hidden',position:'relative'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,900&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}

        /* Card utama */
        .login-card{
          display:flex;width:820px;max-width:95vw;
          background:#fff;border-radius:20px;overflow:hidden;
          box-shadow:0 24px 80px rgba(0,0,0,0.12);
        }

        /* Sisi kiri — form */
        .login-form-side{
          flex:1;padding:48px 44px;display:flex;flex-direction:column;justify-content:center;
        }

        /* Sisi kanan — brand panel */
        .login-brand-side{
          width:320px;flex-shrink:0;background:#0f0f0f;
          position:relative;overflow:hidden;
          display:flex;flex-direction:column;justify-content:space-between;
          padding:44px 36px;
        }
        @media(max-width:640px){.login-brand-side{display:none}.login-card{width:95vw}}

        /* Grid pattern di brand panel */
        .brand-grid{
          position:absolute;inset:0;
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),
            linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px);
          background-size:32px 32px;
        }
        /* Blob glow */
        .brand-blob{
          position:absolute;width:300px;height:300px;border-radius:50%;
          background:radial-gradient(circle,rgba(255,255,255,0.05) 0%,transparent 70%);
          bottom:-80px;right:-80px;pointer-events:none;
        }

        /* Input wrapper dengan icon */
        .inp-group{
          display:flex;align-items:center;gap:0;
          border:1.5px solid #e2e2de;border-radius:11px;
          overflow:hidden;background:#fff;
          transition:border-color 0.2s,box-shadow 0.2s;
          margin-bottom:14px;
        }
        .inp-group:focus-within{
          border-color:#111;
          box-shadow:0 0 0 3px rgba(0,0,0,0.07);
        }
        .inp-icon{
          width:46px;display:flex;align-items:center;justify-content:center;
          color:#ccc;flex-shrink:0;border-right:1.5px solid #e8e8e4;
          background:#fafaf8;height:46px;
        }
        .inp-field{
          flex:1;padding:12px 14px;border:none;outline:none;
          font-family:inherit;font-size:0.78rem;color:#111;background:transparent;
        }
        .inp-field::placeholder{color:#bbb}
        .pw-toggle{
          width:44px;display:flex;align-items:center;justify-content:center;
          background:none;border:none;cursor:pointer;color:#bbb;
          transition:color 0.15s;flex-shrink:0;
        }
        .pw-toggle:hover{color:#555}

        /* Tombol login */
        .login-btn{
          width:100%;background:#111;color:#fff;
          padding:13px;border:none;border-radius:11px;
          font-family:inherit;font-weight:700;font-size:0.8rem;
          cursor:pointer;letter-spacing:0.02em;
          transition:all 0.2s;
          display:flex;align-items:center;justify-content:center;gap:8px;
          margin-top:6px;
        }
        .login-btn:hover:not(:disabled){background:#2d2d2d;transform:translateY(-1px);
          box-shadow:0 6px 20px rgba(0,0,0,0.18)}
        .login-btn:disabled{opacity:0.55;cursor:not-allowed;transform:none}

        /* Error shake */
        .shake{animation:shake 0.4s ease}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
      `}</style>

      {/* Background dots subtle */}
      <div style={{position:'absolute',inset:0,
        backgroundImage:'radial-gradient(circle at 1px 1px,rgba(0,0,0,0.06) 1px,transparent 0)',
        backgroundSize:'28px 28px',pointerEvents:'none'}}/>

      <div className="login-card">
        {/* ── KIRI: FORM ── */}
        <div className="login-form-side">
          {/* Logo kecil */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:36}}>
            <div style={{width:34,height:34,borderRadius:9,background:'#111',
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Package size={16} style={{color:'#fff'}}/>
            </div>
            <div>
              <div style={{fontSize:'0.58rem',color:'#aaa',letterSpacing:'0.12em',
                textTransform:'uppercase',fontWeight:700}}>WMS System</div>
              <div style={{fontSize:'0.85rem',fontWeight:900,letterSpacing:'-0.02em',lineHeight:1}}>COOL</div>
            </div>
          </div>

          {/* Heading */}
          <div style={{marginBottom:28}}>
            <h2 style={{fontSize:'1.5rem',fontWeight:900,color:'#111',
              letterSpacing:'-0.025em',marginBottom:6}}>Login please</h2>
            <p style={{fontSize:'0.68rem',color:'#aaa',lineHeight:1.5}}>
              Masukkan username dan password untuk mengakses sistem.
            </p>
          </div>

          {/* Username */}
          <div style={{fontSize:'0.6rem',fontWeight:700,color:'#888',
            letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6}}>Username</div>
          <div className="inp-group">
            <div className="inp-icon"><User size={14}/></div>
            <input className="inp-field" placeholder="Masukkan username"
              value={username} onChange={e=>setUsername(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleLogin()}
              autoComplete="username"/>
          </div>

          {/* Password */}
          <div style={{fontSize:'0.6rem',fontWeight:700,color:'#888',
            letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6}}>Password</div>
          <div className="inp-group">
            <div className="inp-icon"><Lock size={14}/></div>
            <input className="inp-field" type={showPw?'text':'password'}
              placeholder="Masukkan password"
              value={password} onChange={e=>setPassword(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleLogin()}
              autoComplete="current-password"/>
            <button className="pw-toggle" onClick={()=>setShowPw(v=>!v)} type="button">
              {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
            </button>
          </div>

          <button className="login-btn" onClick={handleLogin}
            disabled={loginLoading||!username||!password}>
            {loginLoading
              ? <><Loader2 size={15} className="spin"/> Memverifikasi...</>
              : '→ LOG IN'}
          </button>

          <div style={{marginTop:28,paddingTop:20,borderTop:'1px solid #f0f0ec',
            fontSize:'0.58rem',color:'#ccc',textAlign:'center'}}>
            COOL WMS v2.1 · {new Date().getFullYear()}
          </div>
        </div>

        {/* ── KANAN: BRAND PANEL ── */}
        <div className="login-brand-side">
          <div className="brand-grid"/>
          <div className="brand-blob"/>

          {/* Top */}
          <div style={{position:'relative',zIndex:1}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#4ade80',
              marginBottom:16,animation:'pulse 2s infinite'}}/>
            <div style={{fontSize:'0.58rem',color:'rgba(255,255,255,0.3)',
              letterSpacing:'0.12em',textTransform:'uppercase',fontWeight:600}}>
              System Online
            </div>
          </div>

          {/* Middle: headline */}
          <div style={{position:'relative',zIndex:1}}>
            <h1 style={{color:'#fff',fontSize:'2.8rem',fontWeight:900,
              letterSpacing:'-0.03em',lineHeight:1.05,marginBottom:16}}>
              WELCOME!
            </h1>
            <p style={{color:'rgba(255,255,255,0.35)',fontSize:'0.72rem',
              lineHeight:1.7,marginBottom:24}}>
              Masukkan detail akun Anda dan mulai kelola gudang lebih efisien.
            </p>
            {/* Feature chips */}
            {['Inventory Tracking','Dispatch Monitor','Pick Compliance'].map(s=>(
              <div key={s} style={{display:'flex',alignItems:'center',gap:8,
                marginBottom:8,fontSize:'0.62rem',color:'rgba(255,255,255,0.4)'}}>
                <div style={{width:5,height:5,borderRadius:'50%',
                  background:'rgba(255,255,255,0.2)',flexShrink:0}}/>
                {s}
              </div>
            ))}
          </div>

          {/* Bottom */}
          <div style={{position:'relative',zIndex:1,
            fontSize:'0.55rem',color:'rgba(255,255,255,0.15)'}}>
            © {new Date().getFullYear()} COOL WMS
          </div>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════
     MAIN APP
  ══════════════════════════════════════════════════════════════════ */
  return (
    <div style={{fontFamily:"'DM Sans','Lexend',sans-serif",background:'var(--bg)',
      minHeight:'100vh',fontSize:'0.72rem',color:'var(--text)'}}>
      <style>{GLOBAL_CSS}</style>

      {/* Toast */}
      {toast.show && (
        <div style={{position:'fixed',top:14,left:'50%',transform:'translateX(-50%)',
          background:toast.type==='success'?'#111':'#9b1c1c',color:'#fff',
          padding:'8px 18px',borderRadius:99,fontWeight:700,zIndex:9999,
          fontSize:'0.62rem',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',
          display:'flex',alignItems:'center',gap:7}}>
          {toast.type==='error' && <AlertCircle size={13}/>}
          {toast.msg}
        </div>
      )}

      {sidebarOpen && isMobile && (
        <div className="overlay" onClick={()=>setSidebarOpen(false)}/>
      )}

      {/* ── SIDEBAR ── */}
      <nav className={`sidebar${sidebarOpen?'':' closed'}`}>
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          {/* Logo + close */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div>
              <div style={{fontSize:'0.55rem',letterSpacing:'0.12em',color:'var(--muted)',
                textTransform:'uppercase',fontWeight:600}}>WMS</div>
              <div style={{fontSize:'0.9rem',fontWeight:900,letterSpacing:'-0.02em'}}>COOL</div>
            </div>
            <button className="btn-icon" onClick={()=>setSidebarOpen(false)}>
              <ChevronLeft size={14}/>
            </button>
          </div>

          {/* User card + dropdown logout */}
          <div style={{position:'relative'}}>
            <div onClick={e=>{e.stopPropagation();setUserMenuOpen(o=>!o)}}
              style={{display:'flex',alignItems:'center',gap:9,padding:'8px 10px',
                background:'var(--bg)',borderRadius:9,cursor:'pointer',
                border:'1px solid var(--border)',userSelect:'none'}}>
              {/* Avatar */}
              <div style={{width:28,height:28,borderRadius:'50%',background:'var(--text)',
                color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'0.68rem',fontWeight:800,flexShrink:0}}>
                {user?.full_name?.[0]?.toUpperCase()||'?'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'0.63rem',fontWeight:700,overflow:'hidden',
                  textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {user?.full_name||'Operator'}
                </div>
                <div style={{fontSize:'0.55rem',color:'var(--green)',fontWeight:600,marginTop:1}}>
                  ● Active
                </div>
              </div>
              <ChevronDown size={11} style={{color:'var(--muted2)',flexShrink:0,
                transform:userMenuOpen?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
            </div>

            {/* Dropdown menu */}
            {userMenuOpen && (
              <div style={{position:'absolute',top:46,left:0,right:0,
                background:'var(--surface)',border:'1px solid var(--border)',
                borderRadius:9,boxShadow:'0 8px 24px rgba(0,0,0,0.1)',
                zIndex:100,overflow:'hidden'}}
                onClick={e=>e.stopPropagation()}>
                {/* Info user */}
                <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',
                  fontSize:'0.6rem',color:'var(--muted)'}}>
                  Masuk sebagai <strong style={{color:'var(--text)'}}>{user?.full_name}</strong>
                </div>
                {/* Logout */}
                <div onClick={handleLogout}
                  style={{padding:'10px 14px',fontSize:'0.63rem',color:'var(--red)',
                    fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:8,
                    transition:'background 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#fff1f2'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <LogOut size={13}/> Keluar
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav items */}
        <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
          {NAV.map(g=>(
            <div key={g.key}>
              <div className="nav-group-header"
                onClick={()=>setExpandedGroup(v=>v===g.key?null:g.key)}>
                <div style={{display:'flex',alignItems:'center',gap:7,fontSize:'0.62rem',
                  fontWeight:700,letterSpacing:'0.04em',textTransform:'uppercase',
                  color:expandedGroup===g.key?'var(--text)':'var(--muted)'}}>
                  {g.icon} {g.label}
                </div>
                <ChevronDown size={11} style={{color:'var(--muted2)',
                  transform:expandedGroup===g.key?'rotate(180deg)':'none',
                  transition:'transform 0.2s'}}/>
              </div>
              {expandedGroup===g.key && g.children.map(m=>(
                <div key={m} className={`nav-item${activeMenu===m?' active':''}`}
                  onClick={()=>navigate(m)}>
                  {m}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{padding:'10px 16px',borderTop:'1px solid var(--border)',flexShrink:0}}>
          <div style={{fontSize:'0.55rem',color:'var(--muted2)'}}>COOL WMS v2.1</div>
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <div style={{marginLeft:!isMobile&&sidebarOpen?'var(--sidebar)':0,
        transition:'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',minHeight:'100vh'}}>

        {/* Topbar */}
        <div style={{position:'sticky',top:0,zIndex:10,
          background:'rgba(247,247,245,0.92)',backdropFilter:'blur(12px)',
          borderBottom:'1px solid var(--border)',
          padding:'0 24px',height:'var(--topbar)',
          display:'flex',alignItems:'center',gap:10}}>
          {!sidebarOpen && (
            <button className="btn-icon" onClick={()=>setSidebarOpen(true)}>
              <Menu size={15}/>
            </button>
          )}
          <div style={{flex:1}}>
            <div style={{fontSize:'0.58rem',color:'var(--muted)',letterSpacing:'0.08em',
              textTransform:'uppercase',fontWeight:600}}>
              {NAV.find(g=>g.children.includes(activeMenu))?.label||''}
            </div>
            <div style={{fontSize:'0.82rem',fontWeight:800,letterSpacing:'-0.01em',lineHeight:1.1}}>
              {activeMenu}
            </div>
          </div>
          {/* Tombol logout di topbar (visible selalu) */}
          <button className="btn-icon" title="Keluar" onClick={handleLogout}
            style={{color:'var(--muted)'}}>
            <LogOut size={14}/>
          </button>
        </div>

        {/* Page content */}
        <div style={{padding:'20px 24px'}}>
          <Suspense fallback={<PageLoader/>}>
            {activeGroup==='inventory' && (
              <InventoryPage activeMenu={activeMenu} showToast={showToast}/>
            )}
            {activeGroup==='outbound' && (
              <OutboundPage activeMenu={activeMenu} showToast={showToast}/>
            )}
            {activeGroup==='dispatch' && (
              <DispatchPage activeMenu={activeMenu} showToast={showToast}/>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}