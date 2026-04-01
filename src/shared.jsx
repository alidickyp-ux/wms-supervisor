import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';

export const API_BASE     = 'https://wms-neon-bridge.vercel.app/api/inventory';
export const API_OUTBOUND = 'https://wms-neon-bridge.vercel.app/api/to_web';
export const API_DISPATCH = 'https://wms-neon-bridge.vercel.app/api/dispatch';

export const NAV = [
  { 
    key:'inventory', 
    label:'Inventory', 
    children:['Cycle Count','Pick Compliance','Master Lokasi'] 
  },
  { 
    key:'outbound',  
    label:'Outbound',  
    children:['Outbound B2B'] // Mengikuti struktur baru Anda
  },
  { 
    key:'dispatch',  
    label:'Dispatch',  
    children:['Online Dispatch'] 
  },
];

/* ── FORMAT WIB ── */
export const formatWIB = (s) => {
  if (!s || s === '-') return '-';
  try {
    const clean = String(s).trim()
      .replace('T', ' ').replace(/\.\d+/, '').replace(/Z$/, '')
      .replace(/[+-]\d{2}:?\d{0,2}$/, '').trim();
    const [datePart, timePart = '00:00'] = clean.split(' ');
    const [yyyy, mm, dd] = datePart.split('-');
    const [hh, mi]       = timePart.split(':');
    const p = n => String(n).padStart(2, '0');
    return `${p(dd)}/${p(mm)}/${yyyy} ${p(hh)}:${p(mi)}`;
  } catch { return String(s); }
};

export const getDesc = (r) => r?.description || r?.sku_desc || r?.nama_barang || '-';

export const statusColor = (s) => {
  if (s==='CONFIRMED')   return 'var(--green)';
  if (s==='NOT_FOUND')   return 'var(--orange)';
  if (s==='CANCELLED')   return 'var(--muted)';
  if (s==='DISCREPANCY') return 'var(--red)';
  return 'var(--text)';
};

/* ── DEBOUNCE HOOK ──
   Trigger: berhenti ketik 1 detik ATAU tekan Enter (via setImmediate flag)
   Tidak ada batas minimum karakter — 1 karakter pun langsung diproses
── */
export function useDebounce(value, immediate = false) {
  const [dv, setDv] = useState('');
  useEffect(() => {
    if (value.length === 0) { setDv(''); return; }
    if (immediate) { setDv(value); return; }   // Enter flag dari SearchBar
    const t = setTimeout(() => setDv(value), 1000);
    return () => clearTimeout(t);
  }, [value, immediate]);
  return dv;
}

/* ── SEARCH HOOK — gunakan ini di page sebagai pengganti useState + useDebounce ──
   const { value, setValue, term, triggerNow } = useSearch()
   - value     : teks di input
   - setValue  : update teks (dari onChange)
   - term      : nilai yang dipakai untuk filter (debounced atau forced)
   - triggerNow: panggil saat Enter untuk filter langsung
── */
export function useSearch(initial = '') {
  const [value, setValue] = useState(initial);
  const [term,  setTerm ] = useState(initial);
  const timerRef = useRef(null);

  const update = useCallback((v) => {
    setValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (v === '') { setTerm(''); return; }
    timerRef.current = setTimeout(() => setTerm(v), 1000);
  }, []);

  const triggerNow = useCallback((v) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setValue(v);
    setTerm(v);
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setValue('');
    setTerm('');
  }, []);

  return { value, setValue: update, term, triggerNow, clear: reset, reset };
}

/* ── SEARCH BAR ──
   - Ketik apa saja → debounce 1 detik
   - Tekan Enter    → langsung filter
── */
export function SearchBar({ value, onChange, onEnter, debounced, placeholder='Cari data...' }) {
  const inputRef = useRef(null);
  const isSearching = value.length > 0 && value !== debounced;
  return (
    <div className="search-wrap">
      <Search size={13} className="search-icon"/>
      <input
        ref={inputRef}
        className="search-inp"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter ? onEnter(value) : onChange(value); // signal immediate
          }
          if (e.key === 'Escape') { onChange(''); }
        }}
        autoComplete="off"
      />
      {isSearching && (
        <div style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)'}}>
          <Loader2 size={12} className="spin" style={{color:'var(--muted2)'}}/>
        </div>
      )}
      {value.length > 0 && !isSearching && (
        <button
          onClick={() => onChange('')}
          style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
            background:'none',border:'none',cursor:'pointer',color:'var(--muted2)',
            display:'flex',padding:2,borderRadius:4}}
          title="Hapus pencarian">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── TABLE BOX ── */
export function TableBox({ children }) {
  return (
    <div style={{border:'1px solid var(--border)',borderRadius:10,overflow:'auto',
      maxHeight:'calc(100vh - 180px)',background:'var(--surface)',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
      {children}
    </div>
  );
}

/* ── TABLE SKELETON ── */
export function TableSkeleton({ rows = 8, cols = 5 }) {
  return (
    <div className="page-enter" style={{border:'1px solid var(--border)',borderRadius:10,overflow:'hidden',background:'var(--surface)'}}>
      {/* fake header */}
      <div style={{display:'flex',gap:12,padding:'10px 12px',borderBottom:'1px solid var(--border)',background:'var(--surface)'}}>
        {[...Array(cols)].map((_,i) => (
          <div key={i} className="skel" style={{height:10,borderRadius:4,flex:i===1?2:1}}/>
        ))}
      </div>
      {[...Array(rows)].map((_,i) => (
        <div key={i} style={{display:'flex',gap:12,padding:'11px 12px',
          borderBottom:'1px solid var(--border2)',background:i%2===0?'var(--surface)':'#fafaf8'}}>
          {[...Array(cols)].map((_,j) => (
            <div key={j} className="skel" style={{
              height:9,borderRadius:4,flex:j===1?2:1,
              animationDelay:`${(i*cols+j)*30}ms`
            }}/>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── CARD SKELETON (untuk History grid) ── */
export function CardSkeleton({ count = 6 }) {
  return (
    <div className="page-enter" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
      {[...Array(count)].map((_,i) => (
        <div key={i} style={{border:'1px solid var(--border)',borderRadius:10,padding:14,background:'var(--surface)'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
              <div className="skel" style={{height:12,borderRadius:4,width:'60%',animationDelay:`${i*60}ms`}}/>
              <div className="skel" style={{height:9,borderRadius:4,width:'40%',animationDelay:`${i*60+20}ms`}}/>
            </div>
            <div className="skel" style={{width:40,height:40,borderRadius:8,animationDelay:`${i*60+40}ms`}}/>
          </div>
          <div className="skel" style={{height:9,borderRadius:4,width:'80%',animationDelay:`${i*60+60}ms`}}/>
        </div>
      ))}
    </div>
  );
}

/* ── PAGE WRAPPER (fade-in saat konten muncul) ── */
export function PageWrapper({ children }) {
  return <div className="page-enter">{children}</div>;
}

/* ── PROGRESS BAR ── */
export function ProgBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0;
  return (
    <div style={{display:'flex',alignItems:'center',gap:7,flex:1,minWidth:80,maxWidth:180}}>
      <div className="prog-track">
        <div className="prog-fill" style={{width:`${pct}%`,background:pct===100?'var(--green)':'#f59e0b'}}/>
      </div>
      <span style={{fontSize:'0.58rem',color:'var(--muted)',minWidth:28,textAlign:'right'}}>{pct}%</span>
    </div>
  );
}

/* ── GLOBAL CSS ── */
export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700;900&family=DM+Mono:wght@400;500&display=swap');
  :root{
    --bg:#f7f7f5; --surface:#ffffff; --border:#e8e8e4; --border2:#f0f0ec;
    --text:#111; --muted:#888; --muted2:#bbb;
    --accent:#1a1a1a; --accent2:#2d2d2d;
    --green:#2d6a4f; --orange:#c05621; --red:#9b1c1c;
    --sidebar:220px; --topbar:52px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg)}
  .spin{animation:spin 1s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px}
  .sidebar{position:fixed;top:0;left:0;width:var(--sidebar);height:100vh;background:var(--surface);
    border-right:1px solid var(--border);z-index:30;display:flex;flex-direction:column;
    transition:transform 0.22s cubic-bezier(0.4,0,0.2,1);overflow:hidden}
  .sidebar.closed{transform:translateX(calc(-1 * var(--sidebar)))}
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.25);z-index:29;
    backdrop-filter:blur(2px);animation:fadeIn 0.2s}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .nav-group-header{display:flex;align-items:center;justify-content:space-between;
    padding:8px 16px;cursor:pointer;user-select:none;transition:background 0.15s}
  .nav-group-header:hover{background:var(--border2)}
  .nav-item{padding:6px 14px 6px 32px;cursor:pointer;font-size:0.65rem;
    display:flex;align-items:center;gap:6px;transition:all 0.12s;color:var(--muted);
    border-left:2px solid transparent;white-space:nowrap}
  .nav-item:hover{color:var(--text);background:var(--border2)}
  .nav-item.active{color:var(--text);font-weight:700;background:#f0ede8;border-left-color:var(--text)}
  .data-table{width:100%;border-collapse:collapse}
  .data-table th{padding:9px 12px;font-size:0.58rem;color:var(--muted);font-weight:600;
    text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--border);
    position:sticky;top:0;background:var(--surface);z-index:2;white-space:nowrap;text-align:left}
  .data-table td{padding:9px 12px;font-size:0.65rem;border-bottom:1px solid var(--border2);white-space:nowrap;color:var(--text)}
  .data-table tr:hover td{background:#fafaf8}
  .btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:7px;
    font-size:0.62rem;font-weight:600;cursor:pointer;border:1px solid var(--border);
    background:var(--surface);color:var(--text);transition:all 0.15s;font-family:inherit;white-space:nowrap}
  .btn:hover{background:var(--border2);border-color:#d0d0c8}
  .btn.primary{background:var(--text);color:#fff;border-color:var(--text)}
  .btn.primary:hover{background:var(--accent2)}
  .btn.danger{color:var(--red)}
  .btn.success{color:var(--green)}
  .btn-icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;
    border-radius:7px;border:1px solid var(--border);background:var(--surface);cursor:pointer;
    color:var(--muted);transition:all 0.15s;font-family:inherit}
  .btn-icon:hover{background:var(--border2);color:var(--text)}
  .search-wrap{position:relative;margin-bottom:14px}
  .search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted2);pointer-events:none}
  .search-inp{width:100%;padding:8px 10px 8px 34px;border:1px solid var(--border);border-radius:8px;
    font-size:0.65rem;background:var(--surface);color:var(--text);font-family:inherit;outline:none;transition:border 0.15s}
  .search-inp:focus{border-color:#bbb}
  .search-inp::placeholder{color:var(--muted2)}
  .tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.55rem;font-weight:700;letter-spacing:0.04em}
  .tag-green{background:#ecfdf5;color:var(--green)}
  .tag-amber{background:#fffbeb;color:#92400e}
  .tag-red{background:#fff1f2;color:var(--red)}
  .tag-blue{background:#eff6ff;color:#1e40af}
  .plist-row{display:flex;align-items:center;padding:10px 14px;gap:12px;cursor:pointer;
    border-bottom:1px solid var(--border2);transition:background 0.12s}
  .plist-row:hover{background:#faf9f7}
  .hist-card{border:1px solid var(--border);border-radius:10px;padding:14px;cursor:pointer;
    background:var(--surface);transition:all 0.2s}
  .hist-card:hover{border-color:#888;box-shadow:0 4px 16px rgba(0,0,0,0.06);transform:translateY(-1px)}
  .tab{padding:7px 14px;font-size:0.62rem;font-weight:600;border:none;border-radius:6px;
    cursor:pointer;transition:all 0.15s;font-family:inherit}
  .tab.on{background:var(--text);color:#fff}
  .tab.off{background:var(--border2);color:var(--muted)}
  .toggle{width:34px;height:18px;border-radius:9px;position:relative;cursor:pointer;transition:background 0.2s}
  .toggle-dot{width:12px;height:12px;background:#fff;border-radius:50%;
    position:absolute;top:3px;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
  .mono{font-family:'DM Mono',monospace;font-size:0.6rem}
  .field{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;
    font-family:inherit;font-size:0.7rem;background:var(--surface);color:var(--text);
    outline:none;margin-bottom:10px;transition:border 0.15s}
  .field:focus{border-color:#bbb}
  .label-sm{font-size:0.58rem;font-weight:700;color:#aaa;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:5px;display:block}
  .muted-text{color:var(--muted);font-size:0.62rem}
  .prog-track{flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden}
  .prog-fill{height:100%;border-radius:2px;transition:width 0.3s}
  .pill{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;
    font-size:0.58rem;font-weight:700}
  /* ── PAGE TRANSITION ── */
  .page-enter{animation:pageIn 0.18s ease-out both}
  @keyframes pageIn{
    from{opacity:0;transform:translateY(5px)}
    to{opacity:1;transform:translateY(0)}
  }
  /* ── SKELETON ── */
  .skel{background:linear-gradient(90deg,#ebebeb 25%,#f5f5f5 50%,#ebebeb 75%);
    background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite}
  @keyframes shimmer{
    0%{background-position:200% 0}
    100%{background-position:-200% 0}
  }
`;