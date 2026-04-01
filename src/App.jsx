import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  LogOut, ChevronDown, ChevronLeft, Menu, AlertCircle,
  BoxSelect, Truck, Package, Loader2, Eye, EyeOff
} from 'lucide-react';
import axios from 'axios';
import { API_BASE, GLOBAL_CSS } from './shared';

const InventoryPage = lazy(() => import('./InventoryPage'));
const OutboundPage  = lazy(() => import('./OutboundPage'));
const DispatchPage  = lazy(() => import('./DispatchPage')); // TAMBAHKAN INI

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

  if (!isLoggedIn) return (
    <div style={{minHeight:'100vh',display:'flex',fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .login-left{flex:1.1;background:#0f0f0f;position:relative;display:flex;flex-direction:column;justify-content:space-between;padding:48px;overflow:hidden}
        .login-right{width:420px;flex-shrink:0;background:#fafaf8;display:flex;align-items:center;justify-content:center;padding:48px 40px;position:relative}
        @media(max-width:768px){.login-left{display:none}.login-right{width:100%}}
        .l-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);background-size:40px 40px}
        .l-inp{width:100%;padding:11px 14px;border:1.5px solid #e8e8e4;border-radius:10px;font-family:inherit;font-size:0.75rem;background:#fff;color:#111;outline:none;transition:all 0.2s}
        .l-inp:focus{border-color:#111;box-shadow:0 0 0 3px rgba(0,0,0,0.06)}
        .l-btn{width:100%;background:#111;color:#fff;padding:12px;border:none;border-radius:10px;font-family:inherit;font-weight:700;font-size:0.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
        .l-btn:hover:not(:disabled){background:#333;transform:translateY(-1px)}
      `}</style>
      
      <div className="login-left">
        <div className="l-grid"/><div className="l-glow"/>
        <div style={{position:'relative',zIndex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <Package size={15} style={{color:'#fff'}}/>
            <span style={{color:'rgba(255,255,255,0.4)',fontSize:'0.65rem',fontWeight:600,letterSpacing:'0.16em',textTransform:'uppercase'}}>WMS System</span>
          </div>
        </div>
        <div style={{position:'relative',zIndex:1}}>
          <h1 style={{color:'#fff',fontSize:'4rem',fontWeight:900,lineHeight:1.05,letterSpacing:'-0.03em',marginBottom:24}}>COOL<br/><span style={{color:'rgba(255,255,255,0.25)'}}>Dashboard</span></h1>
        </div>
        <div style={{position:'relative',zIndex:1}}>
            <div style={{fontSize:'0.55rem',color:'rgba(255,255,255,0.2)'}}>COOL WMS v2.1 · {new Date().getFullYear()}</div>
        </div>
      </div>

      <div className="login-right">
        <div style={{width:'100%',maxWidth:340,position:'relative',zIndex:1}}>
          <h2 style={{fontSize:'1.6rem',fontWeight:900,color:'#111',marginBottom:36}}>Masuk ke akun</h2>
          <input className="l-inp" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} style={{marginBottom:14}}/>
          <input className="l-inp" type={showPw?'text':'password'} placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={{marginBottom:14}}/>
          <button className="l-btn" onClick={handleLogin} disabled={loginLoading}>{loginLoading ? <Loader2 size={15} className="spin"/> : 'Masuk'}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"'DM Sans','Lexend',sans-serif",background:'var(--bg)',minHeight:'100vh',fontSize:'0.72rem',color:'var(--text)'}}>
      <style>{GLOBAL_CSS}</style>

      {toast.show && (
        <div style={{position:'fixed',top:14,left:'50%',transform:'translateX(-50%)',background:toast.type==='success'?'#111':'#9b1c1c',color:'#fff',padding:'8px 18px',borderRadius:99,fontWeight:700,zIndex:9999,fontSize:'0.62rem',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',display:'flex',alignItems:'center',gap:7}}>
          {toast.type==='error' && <AlertCircle size={13}/>}
          {toast.msg}
        </div>
      )}

      {sidebarOpen && isMobile && <div className="overlay" onClick={()=>setSidebarOpen(false)}/>}

      <nav className={`sidebar${sidebarOpen ? '' : ' closed'}`}>
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div>
              <div style={{fontSize:'0.58rem',color:'var(--muted)',textTransform:'uppercase'}}>WMS</div>
              <div style={{fontSize:'0.9rem',fontWeight:900}}>COOL</div>
            </div>
            <button className="btn-icon" onClick={()=>setSidebarOpen(false)}><ChevronLeft size={14}/></button>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:9,padding:'8px 10px',background:'var(--bg)',borderRadius:9,border:'1px solid var(--border)'}}>
            <div style={{width:26,height:26,borderRadius:'50%',background:'var(--text)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:800}}>
              {user?.full_name?.[0]?.toUpperCase()||'?'}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:'0.63rem',fontWeight:700}}>{user?.full_name}</div>
              <div style={{fontSize:'0.55rem',color:'var(--green)'}}>● Active</div>
            </div>
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
          {NAV.map(g => (
            <div key={g.key}>
              <div className="nav-group-header" onClick={()=>setExpandedGroup(v=>v===g.key?null:g.key)}>
                <div style={{display:'flex',alignItems:'center',gap:7,fontSize:'0.62rem',fontWeight:700,color:expandedGroup===g.key?'var(--text)':'var(--muted)',textTransform:'uppercase'}}>
                  {g.icon} {g.label}
                </div>
                <ChevronDown size={11} style={{transform:expandedGroup===g.key?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
              </div>
              {expandedGroup===g.key && g.children.map(m => (
                <div key={m} className={`nav-item${activeMenu===m?' active':''}`} onClick={()=>navigate(m)}>
                  {m}
                </div>
              ))}
            </div>
          ))}
        </div>
      </nav>

      <div style={{marginLeft:!isMobile&&sidebarOpen?'var(--sidebar)':0,transition:'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',minHeight:'100vh'}}>
        <div style={{position:'sticky',top:0,zIndex:10,background:'rgba(247,247,245,0.92)',backdropFilter:'blur(12px)',borderBottom:'1px solid var(--border)',padding:'0 24px',height:'var(--topbar)',display:'flex',alignItems:'center',gap:10}}>
          {!sidebarOpen && <button className="btn-icon" onClick={()=>setSidebarOpen(true)}><Menu size={15}/></button>}
          <div>
            <div style={{fontSize:'0.58rem',color:'var(--muted)',textTransform:'uppercase'}}>{NAV.find(g=>g.children.includes(activeMenu))?.label||''}</div>
            <div style={{fontSize:'0.82rem',fontWeight:800}}>{activeMenu}</div>
          </div>
        </div>

        <div style={{padding:'20px 24px'}}>
          <Suspense fallback={<PageLoader/>}>
            {activeGroup === 'inventory' && (
              <InventoryPage activeMenu={activeMenu} showToast={showToast}/>
            )}
            
            {activeGroup === 'outbound' && (
              <OutboundPage activeMenu={activeMenu} showToast={showToast}/>
            )}

            {activeGroup === 'dispatch' && (
              <DispatchPage activeMenu={activeMenu} showToast={showToast}/>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}