import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  LogOut, ChevronDown, ChevronLeft, Menu, AlertCircle,
  BoxSelect, Truck, Package, Loader2
} from 'lucide-react';
import axios from 'axios';
import { API_BASE, GLOBAL_CSS } from './shared';

// Lazy load — modul hanya dimuat saat pertama kali dibuka
const InventoryPage = lazy(() => import('./InventoryPage'));
const OutboundPage  = lazy(() => import('./OutboundPage'));
const DispatchPage  = lazy(() => import('./DispatchPage'));

const NAV = [
  { key:'inventory', label:'Inventory', icon:<BoxSelect size={13}/>, children:['Master Lokasi','Snapshoot','1st Count','2nt Count','Reconciliation','Pick Compliance'] },
  { key:'outbound',  label:'Outbound',  icon:<Truck size={13}/>,     children:['Picking','Packing','Explorer','Print Label'] },
  { key:'dispatch',  label:'Dispatch',  icon:<Package size={13}/>,   children:['Dispatch Log','Handover','History'] },
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
  const [loginLoading, setLoginLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [expandedGroup, setExpandedGroup] = useState('inventory');
  const [activeMenu, setActiveMenu]       = useState('Master Lokasi');
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
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      fontFamily:"'DM Sans','Lexend',sans-serif",position:'relative',overflow:'hidden',
      background:'linear-gradient(135deg, #f5f3ef 0%, #ede8e0 50%, #e8e2d8 100%)'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700;900&family=DM+Mono:wght@400;500&display=swap');
        .lbg-blob1{position:absolute;width:600px;height:600px;border-radius:50%;
          background:radial-gradient(circle,rgba(210,196,175,0.5) 0%,transparent 70%);
          top:-200px;right:-100px;pointer-events:none}
        .lbg-blob2{position:absolute;width:400px;height:400px;border-radius:50%;
          background:radial-gradient(circle,rgba(185,168,145,0.3) 0%,transparent 70%);
          bottom:-150px;left:-80px;pointer-events:none}
        .lcard{width:380px;background:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.9);
          border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.08);
          backdrop-filter:blur(20px);position:relative;z-index:1}
        .linp{width:100%;background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.1);color:#111;
          padding:12px 14px;border-radius:10px;font-family:inherit;font-size:0.76rem;margin-bottom:10px;
          box-sizing:border-box;outline:none;transition:all 0.2s}
        .linp:focus{border-color:rgba(0,0,0,0.3);background:rgba(255,255,255,0.9)}
        .linp::placeholder{color:#aaa}
        .lbtn{width:100%;background:#1a1a1a;color:#fff;padding:13px;border:none;border-radius:10px;
          font-weight:700;font-size:0.76rem;cursor:pointer;letter-spacing:0.04em;
          transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;font-family:inherit}
        .lbtn:hover{background:#333;transform:translateY(-1px)}
        .spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <div className="lbg-blob1"/><div className="lbg-blob2"/>
      <div className="lcard">
        <div style={{padding:'32px 32px 24px',borderBottom:'1px solid rgba(0,0,0,0.06)',
          background:'linear-gradient(135deg,rgba(255,255,255,0.4),rgba(255,255,255,0.1))'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:'#1a1a1a',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Package size={18} style={{color:'#fff'}}/>
            </div>
            <div>
              <div style={{fontSize:'0.55rem',letterSpacing:'0.14em',color:'#999',fontWeight:600,textTransform:'uppercase'}}>WMS System</div>
              <div style={{fontSize:'1.1rem',fontWeight:900,color:'#111',letterSpacing:'-0.02em',lineHeight:1.1}}>COOL Dashboard</div>
            </div>
          </div>
          <div style={{fontSize:'0.65rem',color:'#888',lineHeight:1.5}}>Silakan masuk untuk mengakses sistem manajemen gudang.</div>
        </div>
        <div style={{padding:'24px 32px 32px'}}>
          <div style={{fontSize:'0.58rem',fontWeight:700,color:'#aaa',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:5}}>Username</div>
          <input className="linp" placeholder="Masukkan username" value={username} onChange={e=>setUsername(e.target.value)}/>
          <div style={{fontSize:'0.58rem',fontWeight:700,color:'#aaa',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:5}}>Password</div>
          <input className="linp" type="password" placeholder="Masukkan password" value={password}
            onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
          <div style={{height:8}}/>
          <button className="lbtn" onClick={handleLogin}>
            {loginLoading ? <Loader2 size={15} className="spin"/> : 'Masuk →'}
          </button>
        </div>
      </div>
    </div>
  );

  /* ══ MAIN APP ══ */
  return (
    <div style={{fontFamily:"'DM Sans','Lexend',sans-serif",background:'var(--bg)',minHeight:'100vh',fontSize:'0.72rem',color:'var(--text)'}}>
      <style>{GLOBAL_CSS}</style>

      {/* TOAST */}
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
        {/* TOPBAR */}
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

        {/* CONTENT — lazy loaded per modul */}
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