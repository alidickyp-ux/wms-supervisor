import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { PrintLabelPanel } from './PrintLabel';
import {
  RefreshCw, FileSpreadsheet, Trash2, LogOut, Upload, Search,
  ClipboardCheck, Loader2, Plus, Database as DbIcon, LayoutGrid, X,
  Truck, Package, Printer, ArrowLeft, ChevronDown, ChevronRight,
  FileText, Menu, BoxSelect, ChevronLeft, AlertCircle
} from 'lucide-react';

const API_BASE     = 'https://wms-neon-bridge.vercel.app/api/inventory';
const API_OUTBOUND = 'https://wms-neon-bridge.vercel.app/api/to_web';
const API_DISPATCH = 'https://wms-neon-bridge.vercel.app/api/dispatch';

const NAV = [
  { key:'inventory', label:'Inventory',  icon:<BoxSelect size={13}/>,   children:['Master Lokasi','Snapshoot','1st Count','2nt Count','Reconciliation'] },
  { key:'outbound',  label:'Outbound',   icon:<Truck size={13}/>,        children:['Picking','Packing','Explorer','Print Label'] },
  { key:'dispatch',  label:'Dispatch',   icon:<Package size={13}/>,      children:['Dispatch Log','Handover','History'] },
];

/* ── DEBOUNCE HOOK ── */
function useDebounce(value) {
  const [dv, setDv] = useState('');
  useEffect(() => {
    // Kurang dari 8 karakter: langsung reset hasil (tampilkan semua)
    if (value.length > 0 && value.length < 8) {
      setDv('');
      return;
    }
    // 0 karakter (kosong): reset
    if (value.length === 0) {
      setDv('');
      return;
    }
    // 8+ karakter: tunggu 700ms baru filter
    const t = setTimeout(() => setDv(value), 700);
    return () => clearTimeout(t);
  }, [value]);
  return dv;
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

  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDebounce(searchInput);
  const [selectedHeader, setSelectedHeader] = useState(null);
  const [masterTab, setMasterTab]     = useState('grid');
  const [explorerTab, setExplorerTab] = useState('active');
  const [toast, setToast]   = useState({ show:false, msg:'', type:'success' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLoc, setNewLoc] = useState({ id:'', zone:'', aisle:'', unique:'', assign:'closed' });

  const [dispatchData, setDispatchData]       = useState([]);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [historyData, setHistoryData]         = useState([]);
  const [selectedHistSession, setSelectedHistSession] = useState(null);
  const [histDetail, setHistDetail]           = useState(null);

  const [selectedPcb, setSelectedPcb]         = useState('');
  const [selectedBoxHuid, setSelectedBoxHuid] = useState('');
  const [boxOptions, setBoxOptions]           = useState([]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    if (newLoc.id && newLoc.zone && newLoc.aisle)
      setNewLoc(p => ({ ...p, unique: `${p.zone.toUpperCase()}-${p.aisle}` }));
  }, [newLoc.id, newLoc.zone, newLoc.aisle]);

  const formatWIB = (s) => {
    if (!s || s === '-') return '-';
    try {
      const d = new Date(s); if (isNaN(d)) return s;
      const w = new Date(d.getTime() + 7*3600000);
      const p = n => String(n).padStart(2,'0');
      return `${p(w.getUTCDate())}/${p(w.getUTCMonth()+1)}/${w.getUTCFullYear()} ${p(w.getUTCHours())}:${p(w.getUTCMinutes())}`;
    } catch { return s; }
  };

  const showToast = (msg, type='success') => {
    setToast({ show:true, msg, type });
    setTimeout(() => setToast({ show:false, msg:'', type:'success' }), 3000);
  };

  const getDesc = (r) => r?.description || r?.sku_desc || r?.nama_barang || '-';

  const handleExportExcel = (rows, filename) => {
    if (!rows?.length) return showToast("Tidak ada data","error");
    const out = rows.map(r => {
      const n = {...r};
      ['scanned_at','timestamp','tanggal_packing','created_at','closed_at','handover_at'].forEach(k => { if(n[k]) n[k] = formatWIB(n[k]); });
      if (activeMenu === 'Reconciliation') n['diff'] = Number(n.qty_2nd||n.qty_1st||0) - Number(n.qty_snap||0);
      return n;
    });
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, filename || 'export.xlsx');
  };

  const isDispatch = ['Dispatch Log','Handover','History'].includes(activeMenu);

  const fetchData = async () => {
    if (!isLoggedIn || isDispatch) return;
    setLoading(true); setSelectedHeader(null);
    try {
      if (activeMenu === 'Print Label') {
        const res = await axios.get(`${API_OUTBOUND}?target=packing_transactions`);
        setData(res.data?.data || []);
      } else {
        const tm = {
          'Master Lokasi': masterTab==='database'?'master_all':'master',
          'Snapshoot':'snapshot_list','1st Count':'first','2nt Count':'second','Reconciliation':'recon',
          'Picking':'picking_transactions','Packing':'packing_transactions','Explorer':'outbound_explorer'
        };
        const api = ['Picking','Packing','Explorer'].includes(activeMenu) ? API_OUTBOUND : API_BASE;
        const res = await axios.get(`${api}?action=get_data&target=${tm[activeMenu]}`);
        setData(res.data?.data || []);
      }
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeMenu, masterTab, isLoggedIn]);

  const fetchDispatch = async (menu) => {
    setDispatchLoading(true);
    try {
      if (menu==='Dispatch Log') {
        const res = await axios.get(`${API_DISPATCH}?action=get_data&target=dispatch_list`);
        setDispatchData(res.data?.data || []);
      } else if (menu==='Handover') {
        const res = await axios.get(`${API_DISPATCH}?action=get_data&target=handover_list`);
        setDispatchData(res.data?.data || []);
      } else if (menu==='History') {
        const res = await axios.get(`${API_DISPATCH}?action=get_data&target=session_list`);
        setHistoryData((res.data?.data||[]).filter(s=>s.status==='HANDOVER_DONE'));
        setSelectedHistSession(null); setHistDetail(null);
      }
    } catch { setDispatchData([]); }
    finally { setDispatchLoading(false); }
  };

  useEffect(() => { if (isDispatch) fetchDispatch(activeMenu); }, [activeMenu]);

  const fetchBoxByPcb = async (pcb) => {
    if (!pcb) return;
    try {
      const res = await axios.get(`${API_OUTBOUND}?action=get_print_data&pcb=${pcb}`);
      setBoxOptions(res.data?.data || []);
    } catch { showToast("Gagal tarik box","error"); }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data?.status==='success') { setUser(res.data.user); setIsLoggedIn(true); setSidebarOpen(!isMobile); }
      else showToast("User / Password salah","error");
    } catch { showToast("Server error","error"); }
    finally { setLoginLoading(false); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setLoading(true);
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result),{type:'array'});
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        await axios.post(`${API_BASE}?action=upload_snap`,{data:rows});
        showToast("Snapshot terupload!"); fetchData();
      } catch { showToast("Gagal upload","error"); }
      finally { setLoading(false); e.target.value=''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleToggle = async (uid, cur) => {
    const next = cur==='open'?'closed':'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`,{unique_id:uid,status:next});
      setData(p => p.map(r => r.unique_id===uid ? {...r,assign:next} : r));
    } catch { showToast("Gagal toggle","error"); }
  };

  const picklistGroups = useMemo(() => {
    if (!['Picking','Packing','Explorer'].includes(activeMenu)||!data) return [];
    const map = {};
    data.forEach(r => {
      const k = r.picklist_number; if(!k) return;
      if(!map[k]) map[k]={ id:k, name:r.nama_customer||r.nama_toko||'-', qtyReq:0, qtyPick:0, qtyPack:0, allPacked:true };
      map[k].qtyReq  += Number(r.qty_req||r.qty_order||0);
      map[k].qtyPick += Number(r.qty_picked||r.qty_actual||0);
      map[k].qtyPack += Number(r.qty_packed||0);
      if(r.status!=='packed') map[k].allPacked = false;
    });
    return Object.values(map);
  }, [data, activeMenu]);

  const applyFilter = (arr) => {
    if (!searchTerm) return arr;
    const s = searchTerm.toUpperCase();
    return arr.filter(r => Object.values(r).some(v => String(v).toUpperCase().includes(s)));
  };

  const filteredGroups = applyFilter(picklistGroups.filter(h => activeMenu!=='Explorer' || (explorerTab==='active' ? !h.allPacked : h.allPacked)));
  const filteredData = selectedHeader
    ? data.filter(r => r.picklist_number===selectedHeader)
    : applyFilter(data);
  const filteredDispatch = applyFilter(dispatchData);

  const statusColor = (s) => {
    if(s==='CONFIRMED') return 'var(--green)';
    if(s==='NOT_FOUND') return 'var(--orange)';
    if(s==='CANCELLED') return 'var(--muted)';
    if(s==='DISCREPANCY') return 'var(--red)';
    return 'var(--text)';
  };

  const loadHistDetail = async (session) => {
    setSelectedHistSession(session);
    try {
      const res = await axios.get(`${API_DISPATCH}?action=get_data&target=session_log&session_code=${session.session_code}`);
      setHistDetail(res.data?.data || []);
    } catch { showToast("Gagal load detail","error"); }
  };

  const printHandoverPdf = () => {
    if (!selectedHistSession || !histDetail) return;
    const s = selectedHistSession;
    const rows = histDetail.map((r,i) =>
      `<tr style="background:${i%2===0?'#fff':'#f9f9f9'}">
        <td>${i+1}</td><td>${r.tracking_reference||r.do_reference||'-'}</td>
        <td style="color:${statusColor(r.handover_status)};font-weight:700">${r.handover_status||'-'}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Handover ${s.session_code}</title>
    <style>*{font-family:Arial;font-size:11px}body{margin:30px}h2{text-align:center;margin-bottom:16px}
    .g{display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;margin:12px 0;padding:12px;background:#f9f9f9;border-radius:4px}
    .r{display:flex;gap:6px}.lb{font-weight:700;min-width:100px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#222;color:#fff;padding:7px 10px;text-align:left}
    td{padding:6px 10px;border-bottom:1px solid #eee}
    .signs{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:32px}
    .sb{border:1px solid #ccc;height:80px;border-radius:4px;margin-top:6px}
    .sn{text-align:center;margin-top:6px;color:#666}
    @media print{body{margin:15px}}</style></head><body>
    <h2>HANDOVER LIST</h2>
    <div class="g">
      <div class="r"><span class="lb">Session</span><span>: ${s.session_code}</span></div>
      <div class="r"><span class="lb">Tgl Handover</span><span>: ${formatWIB(s.closed_at)?.split(' ')[0]||'-'}</span></div>
      <div class="r"><span class="lb">Security</span><span>: ${s.security_name||'-'}</span></div>
      <div class="r"><span class="lb">Jam</span><span>: ${formatWIB(s.closed_at)?.split(' ')[1]||'-'}</span></div>
      <div class="r"><span class="lb">Kurir</span><span>: ${s.courier_name||'-'}</span></div>
      <div class="r"><span class="lb">No. Kendaraan</span><span>: ${s.vehicle_number||'-'}</span></div>
      <div class="r"><span class="lb">Total Paket</span><span>: ${histDetail.length} paket</span></div>
    </div>
    <table><thead><tr><th style="width:40px">No.</th><th>No. AWB</th><th style="width:110px">Status</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="signs">
      <div><div style="font-weight:700">Security</div><div class="sb"></div><div class="sn">( ${s.security_name||'_____________'} )</div></div>
      <div><div style="font-weight:700">Kurir</div><div class="sb"></div><div class="sn">( ${s.courier_name||'_____________'} )</div></div>
    </div>
    <script>window.onload=()=>window.print()<\/script></body></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
  };

  /* ══════════════════════════════════════════
     LOGIN PAGE
  ══════════════════════════════════════════ */
  if (!isLoggedIn) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a',fontFamily:"'DM Sans', 'Lexend', sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700;900&family=DM+Mono:wght@400;500&display=swap');
        .login-card{width:360px;background:#111;border:1px solid #222;border-radius:16px;overflow:hidden;box-shadow:0 40px 80px rgba(0,0,0,0.6)}
        .login-inp{width:100%;background:#1a1a1a;border:1px solid #2a2a2a;color:#fff;padding:12px 14px;border-radius:8px;font-family:inherit;font-size:0.78rem;margin-bottom:10px;box-sizing:border-box;outline:none;transition:border 0.2s}
        .login-inp:focus{border-color:#444}
        .login-inp::placeholder{color:#555}
        .login-btn{width:100%;background:#fff;color:#000;padding:13px;border:none;border-radius:8px;font-weight:700;font-size:0.78rem;cursor:pointer;letter-spacing:0.05em;transition:opacity 0.2s;display:flex;align-items:center;justify-content:center;gap:8px}
        .login-btn:hover{opacity:0.9}
      `}</style>
      <div className="login-card">
        <div style={{padding:'32px 32px 24px',borderBottom:'1px solid #1e1e1e'}}>
          <div style={{fontSize:'0.6rem',letterSpacing:'0.15em',color:'#555',fontWeight:600,textTransform:'uppercase',marginBottom:6}}>WMS Management</div>
          <div style={{fontSize:'1.4rem',fontWeight:900,color:'#fff',letterSpacing:'-0.02em'}}>COOL Dashboard</div>
        </div>
        <div style={{padding:'28px 32px 32px'}}>
          <input className="login-inp" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)}/>
          <input className="login-inp" type="password" placeholder="Password" value={password}
            onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
          <div style={{height:4}}/>
          <button className="login-btn" onClick={handleLogin}>
            {loginLoading ? <Loader2 size={15} className="spin"/> : 'MASUK'}
          </button>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════
     MAIN APP
  ══════════════════════════════════════════ */
  const navigate = (menu) => {
    setActiveMenu(menu);
    setSearchInput('');
    setSelectedHeader(null);
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div style={{fontFamily:"'DM Sans','Lexend',sans-serif",background:'var(--bg)',minHeight:'100vh',fontSize:'0.72rem',color:'var(--text)'}}>
      <style>{`
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
        /* Scrollbar */
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px}
        /* Sidebar */
        .sidebar{position:fixed;top:0;left:0;width:var(--sidebar);height:100vh;background:var(--surface);
          border-right:1px solid var(--border);z-index:30;display:flex;flex-direction:column;
          transition:transform 0.22s cubic-bezier(0.4,0,0.2,1);overflow:hidden}
        .sidebar.closed{transform:translateX(calc(-1 * var(--sidebar)))}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.25);z-index:29;
          backdrop-filter:blur(2px);animation:fadeIn 0.2s}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        /* Nav */
        .nav-group-header{display:flex;align-items:center;justify-content:space-between;
          padding:8px 16px;cursor:pointer;user-select:none;transition:background 0.15s;border-radius:0}
        .nav-group-header:hover{background:var(--border2)}
        .nav-item{padding:6px 14px 6px 32px;cursor:pointer;font-size:0.65rem;
          display:flex;align-items:center;gap:6px;transition:all 0.12s;color:var(--muted);border-radius:0;
          border-left:2px solid transparent;white-space:nowrap}
        .nav-item:hover{color:var(--text);background:var(--border2)}
        .nav-item.active{color:var(--text);font-weight:700;background:#f0ede8;border-left-color:var(--text)}
        /* Table */
        .data-table{width:100%;border-collapse:collapse}
        .data-table th{padding:9px 12px;font-size:0.58rem;color:var(--muted);font-weight:600;
          text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--border);
          position:sticky;top:0;background:var(--surface);z-index:2;white-space:nowrap;text-align:left}
        .data-table td{padding:9px 12px;font-size:0.65rem;border-bottom:1px solid var(--border2);white-space:nowrap;color:var(--text)}
        .data-table tr:hover td{background:#fafaf8}
        /* Btn */
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
        /* Search */
        .search-wrap{position:relative;margin-bottom:14px}
        .search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--muted2);pointer-events:none}
        .search-inp{width:100%;padding:8px 10px 8px 34px;border:1px solid var(--border);border-radius:8px;
          font-size:0.65rem;background:var(--surface);color:var(--text);font-family:inherit;outline:none;transition:border 0.15s}
        .search-inp:focus{border-color:#bbb}
        .search-inp::placeholder{color:var(--muted2)}
        /* Tag */
        .tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.55rem;font-weight:700;letter-spacing:0.04em}
        .tag-green{background:#ecfdf5;color:var(--green)}
        .tag-amber{background:#fffbeb;color:#92400e}
        .tag-red{background:#fff1f2;color:var(--red)}
        .tag-blue{background:#eff6ff;color:#1e40af}
        /* Picklist row */
        .plist-row{display:flex;align-items:center;padding:10px 14px;gap:12px;cursor:pointer;
          border-bottom:1px solid var(--border2);transition:background 0.12s}
        .plist-row:hover{background:#faf9f7}
        /* Card */
        .hist-card{border:1px solid var(--border);border-radius:10px;padding:14px;cursor:pointer;
          background:var(--surface);transition:all 0.2s}
        .hist-card:hover{border-color:#888;box-shadow:0 4px 16px rgba(0,0,0,0.06);transform:translateY(-1px)}
        /* Tab */
        .tab{padding:7px 14px;font-size:0.62rem;font-weight:600;border:none;border-radius:6px;
          cursor:pointer;transition:all 0.15s;font-family:inherit}
        .tab.on{background:var(--text);color:#fff}
        .tab.off{background:var(--border2);color:var(--muted)}
        /* Toggle */
        .toggle{width:34px;height:18px;border-radius:9px;position:relative;cursor:pointer;transition:background 0.2s}
        .toggle-dot{width:12px;height:12px;background:#fff;border-radius:50%;
          position:absolute;top:3px;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
        /* Mono */
        .mono{font-family:'DM Mono',monospace;font-size:0.6rem}
        /* Input */
        .field{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;
          font-family:inherit;font-size:0.7rem;background:var(--surface);color:var(--text);
          outline:none;margin-bottom:10px;transition:border 0.15s}
        .field:focus{border-color:#bbb}
        /* Progress */
        .prog-track{flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden}
        .prog-fill{height:100%;border-radius:2px;transition:width 0.3s}
        /* Pill */
        .pill{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;
          font-size:0.58rem;font-weight:700}
      `}</style>

      {/* TOAST */}
      {toast.show && (
        <div style={{position:'fixed',top:14,left:'50%',transform:'translateX(-50%)',
          background:toast.type==='success'?'#111':'#9b1c1c',color:'#fff',
          padding:'8px 18px',borderRadius:99,fontWeight:700,zIndex:9999,
          fontSize:'0.62rem',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',
          display:'flex',alignItems:'center',gap:7,letterSpacing:'0.02em'}}>
          {toast.type==='error'&&<AlertCircle size={13}/>}
          {toast.msg}
        </div>
      )}

      {/* SIDEBAR OVERLAY (mobile) */}
      {sidebarOpen && isMobile && <div className="overlay" onClick={()=>setSidebarOpen(false)}/>}

      {/* SIDEBAR */}
      <nav className={`sidebar${sidebarOpen?'':' closed'}`}>
        {/* Header */}
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div>
              <div style={{fontSize:'0.58rem',letterSpacing:'0.12em',color:'var(--muted)',textTransform:'uppercase',fontWeight:600}}>WMS</div>
              <div style={{fontSize:'0.9rem',fontWeight:900,letterSpacing:'-0.02em',color:'var(--text)'}}>COOL</div>
            </div>
            <button className="btn-icon" onClick={()=>setSidebarOpen(false)}><ChevronLeft size={14}/></button>
          </div>
          {/* User pill */}
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
              <ChevronDown size={11} style={{color:'var(--muted2)',flexShrink:0,transform:userMenuOpen?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
            </div>
            {userMenuOpen && (
              <div style={{position:'absolute',top:46,left:0,right:0,background:'var(--surface)',
                border:'1px solid var(--border)',borderRadius:9,boxShadow:'0 8px 24px rgba(0,0,0,0.08)',zIndex:10,overflow:'hidden'}}>
                <div onClick={()=>{setIsLoggedIn(false);setUserMenuOpen(false);}}
                  style={{padding:'10px 14px',fontSize:'0.63rem',color:'var(--red)',fontWeight:700,
                    cursor:'pointer',display:'flex',alignItems:'center',gap:8,transition:'background 0.1s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#fff1f2'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <LogOut size={13}/> Keluar
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
          {NAV.map(g => (
            <div key={g.key}>
              <div className="nav-group-header" onClick={()=>setExpandedGroup(v=>v===g.key?null:g.key)}>
                <div style={{display:'flex',alignItems:'center',gap:7,fontSize:'0.62rem',fontWeight:700,
                  color: expandedGroup===g.key?'var(--text)':'var(--muted)',letterSpacing:'0.04em',textTransform:'uppercase'}}>
                  {g.icon} {g.label}
                </div>
                <ChevronDown size={11} style={{color:'var(--muted2)',transform:expandedGroup===g.key?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
              </div>
              {expandedGroup===g.key && g.children.map(m => (
                <div key={m} className={`nav-item${activeMenu===m?' active':''}`} onClick={()=>navigate(m)}>
                  {m}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{padding:'10px 16px',borderTop:'1px solid var(--border)',flexShrink:0}}>
          <div style={{fontSize:'0.55rem',color:'var(--muted2)',letterSpacing:'0.04em'}}>COOL WMS v2.0</div>
        </div>
      </nav>

      {/* MAIN */}
      <div style={{marginLeft:!isMobile&&sidebarOpen?'var(--sidebar)':0,transition:'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',minHeight:'100vh'}}>

        {/* TOPBAR */}
        <div style={{position:'sticky',top:0,zIndex:10,background:'rgba(247,247,245,0.92)',
          backdropFilter:'blur(12px)',borderBottom:'1px solid var(--border)',
          padding:'0 24px',height:'var(--topbar)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {!sidebarOpen && (
              <button className="btn-icon" onClick={()=>setSidebarOpen(true)}><Menu size={15}/></button>
            )}
            {(selectedHeader || (activeMenu==='History' && selectedHistSession)) && (
              <button className="btn-icon" onClick={()=>{
                if(activeMenu==='History'&&selectedHistSession){ setSelectedHistSession(null); setHistDetail(null); }
                else setSelectedHeader(null);
              }}><ArrowLeft size={14}/></button>
            )}
            <div>
              <div style={{fontSize:'0.58rem',color:'var(--muted)',letterSpacing:'0.08em',textTransform:'uppercase',fontWeight:600}}>
                {NAV.find(g=>g.children.includes(activeMenu))?.label||''}
              </div>
              <div style={{fontSize:'0.82rem',fontWeight:800,letterSpacing:'-0.01em',lineHeight:1.1}}>
                {selectedHistSession ? selectedHistSession.session_code
                  : selectedHeader || activeMenu}
              </div>
            </div>
          </div>
          {/* Topbar actions */}
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            {renderTopbarActions()}
          </div>
        </div>

        {/* PAGE CONTENT */}
        <div style={{padding:'20px 24px'}}>
          {isDispatch ? renderDispatch() : renderInventoryOutbound()}
        </div>
      </div>

      {/* ADD LOCATION MODAL */}
      {showAddForm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(6px)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000}}>
          <div style={{background:'var(--surface)',padding:28,borderRadius:16,width:'90%',maxWidth:400,
            boxShadow:'0 24px 48px rgba(0,0,0,0.15)',border:'1px solid var(--border)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <div style={{fontWeight:800,fontSize:'0.82rem'}}>Tambah Lokasi</div>
              <button className="btn-icon" onClick={()=>setShowAddForm(false)}><X size={14}/></button>
            </div>
            <label style={{fontSize:'0.58rem',fontWeight:700,color:'var(--muted)',letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:5}}>Lokasi ID</label>
            <input className="field" value={newLoc.id} onChange={e=>setNewLoc({...newLoc,id:e.target.value})}/>
            <div style={{display:'flex',gap:10}}>
              <div style={{flex:1}}>
                <label style={{fontSize:'0.58rem',fontWeight:700,color:'var(--muted)',letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:5}}>Zone</label>
                <input className="field" value={newLoc.zone} onChange={e=>setNewLoc({...newLoc,zone:e.target.value.toUpperCase()})}/>
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:'0.58rem',fontWeight:700,color:'var(--muted)',letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:5}}>Aisle</label>
                <input className="field" type="number" value={newLoc.aisle} onChange={e=>setNewLoc({...newLoc,aisle:e.target.value})}/>
              </div>
            </div>
            <button className="btn primary" style={{width:'100%',justifyContent:'center',padding:'11px',marginTop:4,fontSize:'0.7rem'}}
              onClick={async()=>{
                try{
                  await axios.post(`${API_BASE}?action=add_location`,{...newLoc,location_id:newLoc.id.toUpperCase()});
                  showToast("Lokasi ditambahkan"); setShowAddForm(false); fetchData();
                }catch{ showToast("Error","error"); }
              }}>Simpan</button>
          </div>
        </div>
      )}
    </div>
  );

  /* ══ TOPBAR ACTIONS ══ */
  function renderTopbarActions() {
    const isPicklistMenu = ['Picking','Packing','Explorer'].includes(activeMenu);
    if (isDispatch) {
      if (activeMenu==='History' && selectedHistSession && histDetail) return <>
        <button className="btn success" onClick={()=>handleExportExcel(histDetail,`Handover_${selectedHistSession.session_code}.xlsx`)}><FileSpreadsheet size={12}/>Excel</button>
        <button className="btn" style={{color:'var(--orange)'}} onClick={printHandoverPdf}><FileText size={12}/>PDF</button>
        <button className="btn-icon" onClick={()=>fetchDispatch(activeMenu)}><RefreshCw size={13} className={dispatchLoading?'spin':''}/></button>
      </>;
      if (activeMenu==='History') return <button className="btn-icon" onClick={()=>fetchDispatch(activeMenu)}><RefreshCw size={13}/></button>;
      return <>
        <button className="btn success" onClick={()=>handleExportExcel(filteredDispatch,`${activeMenu}.xlsx`)}><FileSpreadsheet size={12}/>Export</button>
        <button className="btn-icon" onClick={()=>fetchDispatch(activeMenu)}><RefreshCw size={13} className={dispatchLoading?'spin':''}/></button>
      </>;
    }
    return <>
      {activeMenu==='Master Lokasi'&&masterTab==='database'&&<button className="btn primary" onClick={()=>setShowAddForm(true)}><Plus size={12}/>Add</button>}
      {activeMenu==='Snapshoot'&&<label className="btn primary" style={{cursor:'pointer'}}><Upload size={12}/>Upload<input type="file" hidden onChange={handleFileUpload}/></label>}
      {['1st Count','2nt Count','Snapshoot','Reconciliation'].includes(activeMenu)&&(
        <button className="btn danger" onClick={()=>{if(window.confirm("Hapus data?"))
          axios.post(`${API_BASE}?action=clear_${activeMenu.includes('1st')?'first':activeMenu.includes('2nt')?'second':activeMenu.includes('Snap')?'snap':'recon'}`)
          .then(fetchData);}}>
          <Trash2 size={12}/>Clear
        </button>
      )}
      <button className="btn success" onClick={()=>handleExportExcel(isPicklistMenu?(selectedHeader?filteredData:picklistGroups):data,`${activeMenu}.xlsx`)}><FileSpreadsheet size={12}/>Export</button>
      <button className="btn-icon" onClick={fetchData}><RefreshCw size={13} className={loading?'spin':''}/></button>
    </>;
  }

  /* ══ SEARCH BAR ══ */
  function SearchBar({ placeholder='Cari data...' }) {
    return (
      <div className="search-wrap">
        <Search size={13} className="search-icon"/>
        <input className="search-inp" placeholder={placeholder}
          value={searchInput} onChange={e=>setSearchInput(e.target.value)}/>
        {searchInput.length >= 8 && searchInput !== searchTerm && (
          <div style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)'}}>
            <Loader2 size={12} className="spin" style={{color:'var(--muted2)'}}/>
          </div>
        )}
      </div>
    );
  }

  /* ══ PROGRESS BAR ══ */
  function ProgBar({ value, max }) {
    const pct = max>0 ? Math.min(100,Math.round(value/max*100)) : 0;
    return (
      <div style={{display:'flex',alignItems:'center',gap:7,flex:1,minWidth:80,maxWidth:180}}>
        <div className="prog-track"><div className="prog-fill" style={{width:`${pct}%`,background:pct===100?'var(--green)':'#f59e0b'}}/></div>
        <span style={{fontSize:'0.58rem',color:'var(--muted)',minWidth:28,textAlign:'right'}}>{pct}%</span>
      </div>
    );
  }

  /* ══ TABLE BOX ══ */
  function TableBox({ children }) {
    return (
      <div style={{border:'1px solid var(--border)',borderRadius:10,overflow:'auto',
        maxHeight:'calc(100vh - 180px)',background:'var(--surface)',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
        {children}
      </div>
    );
  }

  /* ══ DISPATCH ══ */
  function renderDispatch() {
    if (activeMenu==='History') {
      if (selectedHistSession) {
        return (
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8,
              background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,
              padding:'14px 16px',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
              {[['Session',selectedHistSession.session_code],['Transporter',selectedHistSession.transporter_id],
                ['Security',selectedHistSession.security_name||'-'],['Kurir',selectedHistSession.courier_name||'-'],
                ['No. Kendaraan',selectedHistSession.vehicle_number||'-'],['Total',`${histDetail?.length||0} paket`]
              ].map(([k,v])=>(
                <div key={k}>
                  <div style={{fontSize:'0.55rem',color:'var(--muted)',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:2}}>{k}</div>
                  <div style={{fontSize:'0.7rem',fontWeight:700}}>{v}</div>
                </div>
              ))}
            </div>
            <TableBox>
              <table className="data-table">
                <thead><tr><th>No.</th><th>No. AWB</th><th>Status</th></tr></thead>
                <tbody>
                  {(histDetail||[]).map((r,i)=>(
                    <tr key={i}><td className="mono">{i+1}</td>
                      <td style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem'}}>{r.tracking_reference||r.do_reference||'-'}</td>
                      <td><span className={`tag ${r.handover_status==='CONFIRMED'?'tag-green':r.handover_status==='NOT_FOUND'?'tag-amber':'tag-red'}`}>{r.handover_status||'-'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableBox>
          </>
        );
      }

      return (
        <>
          <SearchBar placeholder="Cari session, kurir, security..."/>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
            {historyData.filter(s=>JSON.stringify(s).toUpperCase().includes(searchTerm.toUpperCase())).map((s,i)=>(
              <div key={i} className="hist-card" onClick={()=>loadHistDetail(s)}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:'0.75rem',letterSpacing:'-0.01em',marginBottom:2}}>{s.session_code}</div>
                    <div style={{fontSize:'0.6rem',color:'var(--muted)',marginBottom:6}}>{s.transporter_id}</div>
                    <div style={{fontSize:'0.6rem',color:'var(--muted)'}}>
                      <span style={{marginRight:10}}>👤 {s.security_name||'-'}</span>
                      <span>🚚 {s.courier_name||'-'}</span>
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:'1.3rem',fontWeight:900,letterSpacing:'-0.03em',lineHeight:1}}>{s.total_sorted}</div>
                    <div style={{fontSize:'0.55rem',color:'var(--muted)',marginBottom:4}}>paket</div>
                    <span className="tag tag-green">DONE</span>
                  </div>
                </div>
                <div style={{marginTop:10,paddingTop:8,borderTop:'1px solid var(--border2)',
                  fontSize:'0.58rem',color:'var(--muted2)',fontFamily:"'DM Mono',monospace"}}>
                  {formatWIB(s.closed_at)}
                </div>
              </div>
            ))}
            {historyData.length===0 && (
              <div style={{gridColumn:'1/-1',textAlign:'center',padding:48,color:'var(--muted2)',fontSize:'0.68rem'}}>
                Belum ada history handover
              </div>
            )}
          </div>
        </>
      );
    }

    const isHO = activeMenu==='Handover';
    return (
      <>
        <SearchBar/>
        {dispatchLoading ? (
          <div style={{textAlign:'center',padding:48,color:'var(--muted2)'}}>
            <Loader2 size={20} className="spin" style={{marginBottom:8}}/>
            <div style={{fontSize:'0.65rem'}}>Memuat data...</div>
          </div>
        ) : (
          <TableBox>
            <table className="data-table">
              <thead><tr>
                {isHO
                  ? ['ID','Session','AWB / DO Ref','Status','Security','Kurir','No. Kendaraan','Handover At'].map(h=><th key={h}>{h}</th>)
                  : ['ID','Session','Transporter','AWB / DO Ref','Operator','Status','Scanned At'].map(h=><th key={h}>{h}</th>)
                }
              </tr></thead>
              <tbody>
                {filteredDispatch.map((r,i)=>(
                  <tr key={i}>
                    {isHO ? <>
                      <td className="mono">{r.id}</td>
                      <td style={{fontWeight:700,color:'var(--text)'}}>{r.session_code}</td>
                      <td style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem'}}>{r.tracking_reference||r.do_reference||'-'}</td>
                      <td><span className={`tag ${r.status==='CONFIRMED'?'tag-green':r.status==='NOT_FOUND'?'tag-amber':'tag-red'}`}>{r.status}</span></td>
                      <td>{r.security_name||'-'}</td><td>{r.courier_name||'-'}</td>
                      <td>{r.vehicle_number||'-'}</td>
                      <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>{formatWIB(r.handover_at)}</td>
                    </> : <>
                      <td className="mono">{r.id}</td>
                      <td style={{fontWeight:700}}>{r.session_code}</td>
                      <td>{r.transporter_id}</td>
                      <td style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem'}}>{r.tracking_reference||r.do_reference||'-'}</td>
                      <td>{r.operator}</td>
                      <td><span className={`tag ${r.handover_status==='CONFIRMED'?'tag-green':r.handover_status==='NOT_FOUND'?'tag-amber':'tag-red'}`}>{r.handover_status||'-'}</span></td>
                      <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>{formatWIB(r.scanned_at)}</td>
                    </>}
                  </tr>
                ))}
                {filteredDispatch.length===0&&<tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'var(--muted2)'}}>Tidak ada data</td></tr>}
              </tbody>
            </table>
          </TableBox>
        )}
      </>
    );
  }

  /* ══ INVENTORY / OUTBOUND ══ */
  function renderInventoryOutbound() {
    const isPicklist = ['Picking','Packing','Explorer'].includes(activeMenu);

    if (activeMenu==='Master Lokasi') {
      return (
        <>
          <div style={{display:'flex',gap:8,marginBottom:14,background:'var(--surface)',borderRadius:8,padding:4,border:'1px solid var(--border)',width:'fit-content'}}>
            {[['grid',<LayoutGrid size={11}/>,'Assign CC'],['database',<DbIcon size={11}/>,'Database']].map(([t,ic,lb])=>(
              <button key={t} onClick={()=>setMasterTab(t)}
                style={{padding:'5px 12px',borderRadius:6,border:'none',cursor:'pointer',fontSize:'0.62rem',fontWeight:600,
                  display:'flex',alignItems:'center',gap:5,fontFamily:'inherit',
                  background:masterTab===t?'var(--text)':'transparent',color:masterTab===t?'#fff':'var(--muted)',
                  transition:'all 0.15s'}}>
                {ic}{lb}
              </button>
            ))}
          </div>
          {masterTab==='database' && <SearchBar/>}
          {masterTab==='grid' ? (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(86px,1fr))',gap:8}}>
              {filteredData.map((r,i)=>(
                <div key={i} style={{background:'var(--surface)',border:'1px solid var(--border)',padding:'10px 10px',
                  display:'flex',flexDirection:'column',alignItems:'center',gap:8,borderRadius:9}}>
                  <span style={{fontWeight:700,fontSize:'0.62rem',textAlign:'center'}}>{r?.unique_id}</span>
                  <div className="toggle" onClick={()=>handleToggle(r.unique_id,r.assign)}
                    style={{background:r.assign==='open'?'var(--green)':'var(--border)'}}>
                    <div className="toggle-dot" style={{left:r.assign==='open'?'19px':'3px'}}/>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TableBox>
              <table className="data-table">
                <thead><tr><th>Lokasi</th><th>Zone</th><th>Aisle</th><th>Unique ID</th><th>Status</th></tr></thead>
                <tbody>{filteredData.map((r,i)=>(
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{r?.location_id}</td><td>{r?.zone}</td><td>{r?.aisle}</td>
                    <td className="mono">{r?.unique_id}</td>
                    <td><span className={`tag ${r?.assign==='open'?'tag-green':'tag-red'}`}>{r?.assign?.toUpperCase()}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </TableBox>
          )}
        </>
      );
    }

    if (activeMenu==='Print Label') {
      return <PrintLabelPanel data={data} selectedPcb={selectedPcb} setSelectedPcb={setSelectedPcb}
        selectedBoxHuid={selectedBoxHuid} setSelectedBoxHuid={setSelectedBoxHuid}
        boxOptions={boxOptions} fetchBoxByPcb={fetchBoxByPcb} loading={loading}/>;
    }

    if (isPicklist && !selectedHeader) {
      const showPack = activeMenu==='Packing'||activeMenu==='Explorer';
      return (
        <>
          {activeMenu==='Explorer' && (
            <div style={{display:'flex',gap:6,marginBottom:12}}>
              {['active','completed'].map(t=>(
                <button key={t} className={`tab ${explorerTab===t?'on':'off'}`} onClick={()=>setExplorerTab(t)}>
                  {t==='active'?'Active':'Completed'}
                </button>
              ))}
            </div>
          )}
          <SearchBar placeholder="Cari picklist atau nama toko..."/>
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            {/* Header row */}
            <div style={{display:'flex',padding:'7px 14px',background:'var(--bg)',borderBottom:'1px solid var(--border)',
              gap:12,fontSize:'0.57rem',color:'var(--muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>
              <span style={{minWidth:22}}>#</span>
              <span style={{minWidth:145}}>Picklist / Toko</span>
              <div style={{display:'flex',gap:20,flex:1,alignItems:'center'}}>
                <span style={{minWidth:52}}>Qty Req</span>
                <span style={{minWidth:52}}>Pick</span>
                {showPack&&<span style={{minWidth:52}}>Pack</span>}
                {showPack&&<span style={{flex:1}}>Progress</span>}
              </div>
              {activeMenu==='Explorer'&&<span style={{minWidth:50}}>Status</span>}
            </div>
            {filteredGroups.map((h,i)=>(
              <div key={h.id} className="plist-row" onClick={()=>setSelectedHeader(h.id)}>
                <span style={{fontSize:'0.58rem',color:'var(--muted2)',minWidth:22,textAlign:'right'}}>{i+1}</span>
                <div style={{minWidth:145,maxWidth:160}}>
                  <div style={{fontSize:'0.68rem',fontWeight:800,letterSpacing:'-0.01em',fontFamily:"'DM Mono',monospace",color:'var(--text)'}}>{h.id}</div>
                  <div style={{fontSize:'0.58rem',color:'var(--muted)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.name}</div>
                </div>
                <div style={{display:'flex',gap:20,flex:1,alignItems:'center'}}>
                  {[h.qtyReq,h.qtyPick,...(showPack?[h.qtyPack]:[])].map((v,j)=>(
                    <span key={j} style={{minWidth:52,fontSize:'0.7rem',fontWeight:700}}>{v||0}</span>
                  ))}
                  {showPack&&<ProgBar value={h.qtyPack} max={h.qtyPick||h.qtyReq||1}/>}
                </div>
                {activeMenu==='Explorer'&&(
                  <span className={`tag ${h.allPacked?'tag-green':'tag-amber'}`} style={{minWidth:50,textAlign:'center'}}>
                    {h.allPacked?'DONE':'OPEN'}
                  </span>
                )}
                <ChevronRight size={13} style={{color:'var(--muted2)',flexShrink:0}}/>
              </div>
            ))}
            {filteredGroups.length===0&&<div style={{textAlign:'center',padding:36,color:'var(--muted2)',fontSize:'0.65rem'}}>Tidak ada data</div>}
          </div>
        </>
      );
    }

    /* Generic table */
    return (
      <>
        <SearchBar/>
        <TableBox>
          <table className="data-table">
            <thead><tr>
              {activeMenu==='Reconciliation' ? ['Lokasi','Artikel','Snap','1st','2nd','Diff','Status'].map(h=><th key={h}>{h}</th>)
              : activeMenu==='Picking' ? ['ID','Product','Lokasi','Qty','Picker','Waktu','Status'].map(h=><th key={h}>{h}</th>)
              : activeMenu==='Packing' ? ['ID','Box#','Product','Qty','Packer','Waktu','HUID','Status'].map(h=><th key={h}>{h}</th>)
              : activeMenu==='Explorer' ? ['SKU','Deskripsi','Req','Pick','Pack','Status'].map(h=><th key={h}>{h}</th>)
              : activeMenu==='Snapshoot' ? ['Lokasi','Artikel','Qty Snap','Deskripsi'].map(h=><th key={h}>{h}</th>)
              : ['Location','Artikel','Deskripsi','Qty','Timestamp','Operator'].map(h=><th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filteredData.map((r,i)=>(
                <tr key={i}>
                  {activeMenu==='Reconciliation' ? <>
                    <td style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem'}}>{r?.location_id}</td>
                    <td>{r?.artikel}</td><td>{r?.qty_snap}</td><td>{r?.qty_1st}</td><td>{r?.qty_2nd}</td>
                    <td>
                      {(() => {const d=Number(r?.qty_2nd||r?.qty_1st||0)-Number(r?.qty_snap||0);
                        return <span style={{fontWeight:800,color:d===0?'var(--green)':'var(--red)'}}>{d>0?`+${d}`:d}</span>})()}
                    </td>
                    <td>{r?.final_status}</td>
                  </> : activeMenu==='Picking' ? <>
                    <td className="mono">{r?.id}</td><td>{r?.product_id}</td>
                    <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>{r?.location_id}</td>
                    <td style={{fontWeight:700}}>{r?.qty_actual}</td><td>{r?.picker_name}</td>
                    <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>{formatWIB(r?.scanned_at)}</td>
                    <td>{r?.status}</td>
                  </> : activeMenu==='Packing' ? <>
                    <td className="mono">{r?.id}</td><td>{r?.box_number}</td><td>{r?.product_id}</td>
                    <td style={{fontWeight:700}}>{r?.qty_packed}</td><td>{r?.scanned_by}</td>
                    <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>{formatWIB(r?.scanned_at)}</td>
                    <td className="mono" style={{fontSize:'0.6rem'}}>{r?.huid}</td><td>{r?.status}</td>
                  </> : activeMenu==='Explorer' ? <>
                    <td className="mono" style={{fontSize:'0.6rem'}}>{r?.sku}</td>
                    <td style={{fontSize:'0.6rem',color:'var(--muted)',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis'}}>{getDesc(r)}</td>
                    <td>{r?.qty_req}</td><td>{r?.qty_picked}</td><td>{r?.qty_packed}</td><td>{r?.status}</td>
                  </> : activeMenu==='Snapshoot' ? <>
                    <td className="mono" style={{fontSize:'0.6rem'}}>{r?.location_id}</td>
                    <td>{r?.artikel}</td><td style={{fontWeight:700}}>{r?.qty_snap}</td>
                    <td style={{fontSize:'0.6rem',color:'var(--muted)'}}>{getDesc(r)}</td>
                  </> : <>
                    <td className="mono" style={{fontSize:'0.6rem'}}>{r?.location_id}</td>
                    <td>{r?.artikel}</td>
                    <td style={{fontSize:'0.6rem',color:'var(--muted)'}}>{getDesc(r)}</td>
                    <td style={{fontWeight:700}}>{r?.qty_1st||r?.qty_2nd||r?.qty}</td>
                    <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>{formatWIB(r?.scanned_at||r?.timestamp)}</td>
                    <td>{r?.operator}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      </>
    );
  }
}