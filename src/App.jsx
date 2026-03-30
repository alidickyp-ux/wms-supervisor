import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  LogOut, ChevronDown, ChevronLeft, Menu, AlertCircle,
  BoxSelect, Truck, Package, Loader2, Eye, EyeOff
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
    children:['Picking','Packing','Explorer','Print Label'] },
  { key:'dispatch',  label:'Dispatch',  icon:<Package size={13}/>,
    children:['Dispatch Log','Handover','History'] },
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
        setUser(res.data.user); setIsLoggedIn(true); setSidebarOpen(!isMobile);
      } else showToast("User / Password salah", "error");
    } catch { showToast("Server error", "error"); }
    finally { setLoginLoading(false); }
  };

  const navigate = (menu) => {
    setActiveMenu(menu);
    if (isMobile) setSidebarOpen(false);
  };

  const activeGroup = NAV.find(g => g.children.includes(activeMenu))?.key;

  /* ══ LOGIN ══ */
  if (!isLoggedIn) return (
    <div style={{minHeight:'100vh',display:'flex',fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .login-left{flex:1.1;background:#0f0f0f;position:relative;display:flex;flex-direction:column;
          justify-content:space-between;padding:48px;overflow:hidden}
        .login-right{width:420px;flex-shrink:0;background:#fafaf8;display:flex;align-items:center;
          justify-content:center;padding:48px 40px;position:relative}
        @media(max-width:768px){.login-left{display:none}.login-right{width:100%}}
        .l-grid{position:absolute;inset:0;background-image:
          linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);
          background-size:40px 40px}
        .l-glow{position:absolute;width:500px;height:500px;border-radius:50%;
          background:radial-gradient(circle,rgba(255,255,255,0.04) 0%,transparent 70%);
          top:-100px;right:-100px;pointer-events:none}
        .l-inp{width:100%;padding:11px 14px;border:1.5px solid #e8e8e4;border-radius:10px;
          font-family:inherit;font-size:0.75rem;background:#fff;color:#111;outline:none;
          transition:all 0.2s;letter-spacing:0.01em}
        .l-inp:focus{border-color:#111;box-shadow:0 0 0 3px rgba(0,0,0,0.06)}
        .l-inp::placeholder{color:#bbb}
        .l-btn{width:100%;background:#111;color:#fff;padding:12px;border:none;border-radius:10px;
          font-family:inherit;font-weight:700;font-size:0.75rem;cursor:pointer;letter-spacing:0.04em;
          transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px}
        .l-btn:hover:not(:disabled){background:#333;transform:translateY(-1px)}
        .l-btn:disabled{opacity:0.6;cursor:not-allowed}
        .l-label{font-size:0.58rem;font-weight:700;color:#aaa;letter-spacing:0.1em;
          text-transform:uppercase;margin-bottom:6px}
        .inp-wrap{position:relative;margin-bottom:14px}
        .pw-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);
          background:none;border:none;cursor:pointer;color:#aaa;padding:0;display:flex}
        .pw-eye:hover{color:#555}
        .stat-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;
          border:1px solid rgba(255,255,255,0.12);border-radius:99px;font-size:0.58rem;color:rgba(255,255,255,0.5)}
        .dot-live{width:6px;height:6px;border-radius:50%;background:#4ade80;
          animation:pulse 2s infinite;flex-shrink:0}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>

      {/* LEFT — brand panel */}
      <div className="login-left">
        <div className="l-grid"/>
        <div className="l-glow"/>

        {/* Top: logo */}
        <div style={{position:'relative',zIndex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <div style={{width:32,height:32,borderRadius:8,background:'rgba(255,255,255,0.08)',
              border:'1px solid rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Package size={15} style={{color:'#fff'}}/>
            </div>
            <span style={{color:'rgba(255,255,255,0.4)',fontSize:'0.65rem',fontWeight:600,
              letterSpacing:'0.16em',textTransform:'uppercase'}}>WMS System</span>
          </div>
        </div>

        {/* Middle: headline */}
        <div style={{position:'relative',zIndex:1}}>
          <div style={{fontSize:'0.62rem',color:'rgba(255,255,255,0.3)',letterSpacing:'0.12em',
            textTransform:'uppercase',marginBottom:16,fontWeight:500}}>Warehouse Management</div>
          <h1 style={{color:'#fff',fontSize:'clamp(2.5rem,5vw,4rem)',fontWeight:900,
            lineHeight:1.05,letterSpacing:'-0.03em',marginBottom:24}}>
            COOL<br/>
            <span style={{color:'rgba(255,255,255,0.25)'}}>Dashboard</span>
          </h1>
          <p style={{color:'rgba(255,255,255,0.35)',fontSize:'0.75rem',lineHeight:1.7,maxWidth:360}}>
            Sistem manajemen gudang terintegrasi. Monitor inventory, dispatch, dan outbound dalam satu platform.
          </p>

          {/* Stats row */}
          <div style={{display:'flex',gap:10,marginTop:32,flexWrap:'wrap'}}>
            {['Inventory Tracking','Dispatch Monitor','Pick Compliance'].map(s => (
              <div key={s} className="stat-chip">
                <div className="dot-live"/> {s}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: footer */}
        <div style={{position:'relative',zIndex:1}}>
          <div style={{fontSize:'0.55rem',color:'rgba(255,255,255,0.2)',letterSpacing:'0.06em'}}>
            COOL WMS v2.1 · {new Date().getFullYear()}
          </div>
        </div>
      </div>

      {/* RIGHT — login form */}
      <div className="login-right">
        {/* Subtle pattern */}
        <div style={{position:'absolute',inset:0,backgroundImage:
          'radial-gradient(circle at 1px 1px,rgba(0,0,0,0.04) 1px,transparent 0)',
          backgroundSize:'24px 24px',pointerEvents:'none'}}/>

        <div style={{width:'100%',maxWidth:340,position:'relative',zIndex:1}}>
          <div style={{marginBottom:36}}>
            <div style={{fontSize:'0.58rem',color:'#aaa',letterSpacing:'0.1em',
              textTransform:'uppercase',fontWeight:600,marginBottom:6}}>Selamat datang kembali</div>
            <h2 style={{fontSize:'1.6rem',fontWeight:900,color:'#111',letterSpacing:'-0.02em',lineHeight:1.1}}>
              Masuk ke akun
            </h2>
          </div>

          <div>
            <div className="l-label">Username</div>
            <div className="inp-wrap">
              <input className="l-inp" placeholder="Masukkan username" value={username}
                onChange={e=>setUsername(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
            </div>

            <div className="l-label">Password</div>
            <div className="inp-wrap">
              <input className="l-inp" type={showPw?'text':'password'}
                placeholder="Masukkan password" value={password}
                style={{paddingRight:40}}
                onChange={e=>setPassword(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
              <button className="pw-eye" onClick={()=>setShowPw(v=>!v)} type="button">
                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>

            <div style={{height:8}}/>
            <button className="l-btn" onClick={handleLogin} disabled={loginLoading||!username||!password}>
              {loginLoading ? <Loader2 size={15} className="spin"/> : 'Masuk →'}
            </button>
          </div>

          <div style={{marginTop:32,paddingTop:24,borderTop:'1px solid #eee'}}>
            <div style={{fontSize:'0.58rem',color:'#ccc',textAlign:'center'}}>
              COOL WMS · Sistem Manajemen Gudang
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ══ MAIN APP ══ */
  return (
    <div style={{fontFamily:"'DM Sans','Lexend',sans-serif",background:'var(--bg)',minHeight:'100vh',fontSize:'0.72rem',color:'var(--text)'}}>
      <style>{GLOBAL_CSS}</style>

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

      {sidebarOpen && isMobile && <div className="overlay" onClick={()=>setSidebarOpen(false)}/>}

      {/* SIDEBAR */}
      <nav className={`sidebar${sidebarOpen ? '' : ' closed'}`}>
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div>
              <div style={{fontSize:'0.58rem',letterSpacing:'0.12em',color:'var(--muted)',textTransform:'uppercase',fontWeight:600}}>WMS</div>
              <div style={{fontSize:'0.9rem',fontWeight:900,letterSpacing:'-0.02em'}}>COOL</div>
            </div>
            <button className="btn-icon" onClick={()=>setSidebarOpen(false)}><ChevronLeft size={14}/></button>
          </div>
          <div style={{position:'relative'}}>
            <div onClick={()=>setUserMenuOpen(o=>!o)}
              style={{display:'flex',alignItems:'center',gap:9,padding:'8px 10px',
                background:'var(--bg)',borderRadius:9,cursor:'pointer',border:'1px solid var(--border)'}}>
              <div style={{width:26,height:26,borderRadius:'50%',background:'var(--text)',color:'#fff',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:800,flexShrink:0}}>
                {user?.full_name?.[0]?.toUpperCase()||'?'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'0.63rem',fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.full_name}</div>
                <div style={{fontSize:'0.55rem',color:'var(--green)',fontWeight:600,marginTop:1}}>● Active</div>
              </div>
              <ChevronDown size={11} style={{color:'var(--muted2)',flexShrink:0,
                transform:userMenuOpen?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
            </div>
            {userMenuOpen && (
              <div style={{position:'absolute',top:46,left:0,right:0,background:'var(--surface)',
                border:'1px solid var(--border)',borderRadius:9,boxShadow:'0 8px 24px rgba(0,0,0,0.08)',zIndex:10,overflow:'hidden'}}>
                <div onClick={()=>{setIsLoggedIn(false);setUserMenuOpen(false);}}
                  style={{padding:'10px 14px',fontSize:'0.63rem',color:'var(--red)',fontWeight:700,cursor:'pointer',
                    display:'flex',alignItems:'center',gap:8}}
                  onMouseEnter={e=>e.currentTarget.style.background='#fff1f2'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <LogOut size={13}/> Keluar
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
          {NAV.map(g => (
            <div key={g.key}>
              <div className="nav-group-header" onClick={()=>setExpandedGroup(v=>v===g.key?null:g.key)}>
                <div style={{display:'flex',alignItems:'center',gap:7,fontSize:'0.62rem',fontWeight:700,
                  color:expandedGroup===g.key?'var(--text)':'var(--muted)',letterSpacing:'0.04em',textTransform:'uppercase'}}>
                  {g.icon} {g.label}
                </div>
                <ChevronDown size={11} style={{color:'var(--muted2)',
                  transform:expandedGroup===g.key?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
              </div>
              {expandedGroup===g.key && g.children.map(m => (
                <div key={m} className={`nav-item${activeMenu===m?' active':''}`} onClick={()=>navigate(m)}>
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

      {/* MAIN */}
      <div style={{marginLeft:!isMobile&&sidebarOpen?'var(--sidebar)':0,transition:'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',minHeight:'100vh'}}>
        <div style={{position:'sticky',top:0,zIndex:10,background:'rgba(247,247,245,0.92)',
          backdropFilter:'blur(12px)',borderBottom:'1px solid var(--border)',
          padding:'0 24px',height:'var(--topbar)',display:'flex',alignItems:'center',gap:10}}>
          {!sidebarOpen && <button className="btn-icon" onClick={()=>setSidebarOpen(true)}><Menu size={15}/></button>}
          <div>
            <div style={{fontSize:'0.58rem',color:'var(--muted)',letterSpacing:'0.08em',textTransform:'uppercase',fontWeight:600}}>
              {NAV.find(g=>g.children.includes(activeMenu))?.label||''}
            </div>
            <div style={{fontSize:'0.82rem',fontWeight:800,letterSpacing:'-0.01em',lineHeight:1.1}}>{activeMenu}</div>
          </div>
        </div>

        <div style={{padding:'20px 24px'}}>
          <Suspense fallback={<PageLoader/>}>
            {activeGroup==='inventory' && <InventoryPage activeMenu={activeMenu} showToast={showToast}/>}
            {activeGroup==='outbound'  && <OutboundPage  activeMenu={activeMenu} showToast={showToast}/>}
            {activeGroup==='dispatch'  && <DispatchPage  activeMenu={activeMenu} showToast={showToast}/>}
          </Suspense>
        </div>
      </div>
    </div>
  );
}