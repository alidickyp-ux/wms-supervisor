import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { PrintLabelPanel } from './PrintLabel';
import {
  RefreshCw, FileSpreadsheet, Trash2, LogOut, Upload, Search,
  ClipboardCheck, Loader2, Plus, Database as DbIcon, LayoutGrid, X,
  Truck, Package, Printer, ArrowLeft, ChevronDown, ChevronRight,
  FileText, Menu, Home, BoxSelect, BarChart3, ChevronLeft
} from 'lucide-react';

const API_BASE     = 'https://wms-neon-bridge.vercel.app/api/inventory';
const API_OUTBOUND = 'https://wms-neon-bridge.vercel.app/api/to_web';
const API_DISPATCH = 'https://wms-neon-bridge.vercel.app/api/dispatch';

/* ── NAV STRUCTURE ── */
const NAV = [
  {
    key: 'inventory', label: 'Inventory', icon: <BoxSelect size={14}/>,
    children: ['Master Lokasi','Snapshoot','1st Count','2nt Count','Reconciliation']
  },
  {
    key: 'outbound', label: 'Outbound', icon: <Truck size={14}/>,
    children: ['Picking','Packing','Explorer','Print Label']
  },
  {
    key: 'dispatch', label: 'Dispatch', icon: <Package size={14}/>,
    children: ['Dispatch Log','Handover','History']
  },
];

export default function App() {
  /* ── AUTH ── */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser]             = useState(null);
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  /* ── NAV ── */
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [expandedGroup, setExpandedGroup] = useState('inventory');
  const [activeMenu, setActiveMenu]     = useState('Master Lokasi');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  /* ── DATA ── */
  const [data, setData]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHeader, setSelectedHeader] = useState(null);
  const [masterTab, setMasterTab]   = useState('grid');
  const [explorerTab, setExplorerTab] = useState('active');
  const [toast, setToast]           = useState({ show: false, msg: '', type: 'success' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLoc, setNewLoc]         = useState({ id:'', zone:'', aisle:'', unique:'', assign:'closed' });

  /* ── DISPATCH ── */
  const [dispatchData, setDispatchData]     = useState([]);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [historyData, setHistoryData]       = useState([]);
  const [selectedHistSession, setSelectedHistSession] = useState(null);
  const [histDetail, setHistDetail]         = useState(null);

  /* ── PRINT ── */
  const [selectedPcb, setSelectedPcb]         = useState('');
  const [selectedBoxHuid, setSelectedBoxHuid] = useState('');
  const [boxOptions, setBoxOptions]           = useState([]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    if (newLoc.id && newLoc.zone && newLoc.aisle)
      setNewLoc(p => ({ ...p, unique: `${p.zone.toUpperCase()}-${p.aisle}` }));
  }, [newLoc.id, newLoc.zone, newLoc.aisle]);

  /* ── UTILS ── */
  const formatWIB = (s) => {
    if (!s || s === '-') return '-';
    try {
      const d   = new Date(s);
      if (isNaN(d)) return s;
      const w   = new Date(d.getTime() + 7*3600000);
      const p   = n => String(n).padStart(2,'0');
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
    const timeKeys = ['scanned_at','timestamp','tanggal_packing','created_at','closed_at','handover_at'];
    const out = rows.map(r => {
      const n = {...r};
      timeKeys.forEach(k => { if (n[k]) n[k] = formatWIB(n[k]); });
      // tambah kolom diff untuk recon
      if (activeMenu === 'Reconciliation') n['diff'] = Number(n.qty_2nd||n.qty_1st||0) - Number(n.qty_snap||0);
      return n;
    });
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, filename || 'export.xlsx');
  };

  /* ── FETCH ── */
  const isDispatch = ['Dispatch Log','Handover','History'].includes(activeMenu);

  const fetchData = async () => {
    if (!isLoggedIn || isDispatch) return;
    setLoading(true); setSelectedHeader(null);
    try {
      if (activeMenu === 'Print Label') {
        const res = await axios.get(`${API_OUTBOUND}?target=packing_transactions`);
        setData(res.data?.data || []);
      } else {
        const targetMap = {
          'Master Lokasi': masterTab==='database' ? 'master_all' : 'master',
          'Snapshoot':'snapshot_list','1st Count':'first','2nt Count':'second','Reconciliation':'recon',
          'Picking':'picking_transactions','Packing':'packing_transactions','Explorer':'outbound_explorer'
        };
        const api = ['Picking','Packing','Explorer'].includes(activeMenu) ? API_OUTBOUND : API_BASE;
        const res = await axios.get(`${api}?action=get_data&target=${targetMap[activeMenu]}`);
        setData(res.data?.data || []);
      }
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeMenu, masterTab, isLoggedIn]);

  const fetchDispatch = async (menu) => {
    setDispatchLoading(true);
    try {
      if (menu === 'Dispatch Log') {
        const res = await axios.get(`${API_DISPATCH}?action=get_data&target=dispatch_list`);
        setDispatchData(res.data?.data || []);
      } else if (menu === 'Handover') {
        const res = await axios.get(`${API_DISPATCH}?action=get_data&target=handover_list`);
        setDispatchData(res.data?.data || []);
      } else if (menu === 'History') {
        const res = await axios.get(`${API_DISPATCH}?action=get_data&target=session_list`);
        const all = res.data?.data || [];
        setHistoryData(all.filter(s => s.status === 'HANDOVER_DONE'));
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
      if (res.data?.status === 'success') { setUser(res.data.user); setIsLoggedIn(true); }
      else showToast("User/Pass Salah","error");
    } catch { showToast("Server Error","error"); }
    finally { setLoginLoading(false); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setLoading(true);
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), { type:'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        await axios.post(`${API_BASE}?action=upload_snap`, { data: rows });
        showToast("Snapshot Terupload!"); fetchData();
      } catch { showToast("Gagal Upload","error"); }
      finally { setLoading(false); e.target.value=''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleToggle = async (uid, cur) => {
    const next = cur === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: next });
      setData(prev => prev.map(r => r.unique_id === uid ? { ...r, assign: next } : r));
    } catch { showToast("Gagal Toggle","error"); }
  };

  /* ── PICKLIST GROUPING ── */
  const picklistGroups = useMemo(() => {
    if (!['Picking','Packing','Explorer'].includes(activeMenu) || !data) return [];
    const map = {};
    data.forEach(r => {
      const k = r.picklist_number; if (!k) return;
      if (!map[k]) map[k] = {
        id: k,
        name: r.nama_customer || r.nama_toko || '-',
        qtyReq: 0, qtyPick: 0, qtyPack: 0, allPacked: true
      };
      map[k].qtyReq  += Number(r.qty_req  || r.qty_order || 0);
      map[k].qtyPick += Number(r.qty_picked || r.qty_actual || 0);
      map[k].qtyPack += Number(r.qty_packed || 0);
      if (r.status !== 'packed') map[k].allPacked = false;
    });
    return Object.values(map);
  }, [data, activeMenu]);

  const filteredGroups = picklistGroups.filter(h => {
    if (!searchTerm) return true;
    return h.id.toUpperCase().includes(searchTerm.toUpperCase()) ||
           h.name.toUpperCase().includes(searchTerm.toUpperCase());
  });

  const filteredData = (data || []).filter(r => {
    if (selectedHeader) return r.picklist_number === selectedHeader;
    if (!searchTerm) return true;
    const s = searchTerm.toUpperCase();
    return String(r.location_id||r.picklist_number||r.id||'').includes(s) ||
           String(r.artikel||r.product_id||r.sku||'').includes(s);
  });

  const filteredDispatch = (dispatchData || []).filter(r => {
    if (!searchTerm) return true;
    return Object.values(r).some(v => String(v).toUpperCase().includes(searchTerm.toUpperCase()));
  });

  /* ── STATUS COLOR ── */
  const statusColor = (s) => {
    if (s === 'CONFIRMED')   return '#2E7D32';
    if (s === 'NOT_FOUND')   return '#E65100';
    if (s === 'CANCELLED')   return '#757575';
    if (s === 'DISCREPANCY') return '#B71C1C';
    return '#000';
  };

  /* ── HISTORY PDF ── */
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
      `<tr style="background:${i%2===0?'#fff':'#fafafa'}">
        <td style="padding:5px 8px;border:1px solid #eee">${i+1}</td>
        <td style="padding:5px 8px;border:1px solid #eee">${r.tracking_reference||r.do_reference||'-'}</td>
        <td style="padding:5px 8px;border:1px solid #eee;color:${statusColor(r.handover_status)};font-weight:700">${r.handover_status||'-'}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Handover - ${s.session_code}</title>
    <style>body{font-family:Arial;font-size:11px;margin:30px}h2{text-align:center}.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin:12px 0}.row{display:flex;gap:6px}.lbl{font-weight:700;min-width:100px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#eee;padding:7px 10px;text-align:left;font-size:10px;border:1px solid #ddd}.signs{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:30px}.sign-box{border:1px solid #ccc;height:80px}.sn{text-align:center;font-size:10px;color:#666;margin-top:6px}@media print{body{margin:15px}}</style>
    </head><body>
    <h2>Handover List</h2>
    <div class="grid">
      <div class="row"><span class="lbl">Session</span><span>: ${s.session_code}</span></div>
      <div class="row"><span class="lbl">Tgl Handover</span><span>: ${formatWIB(s.closed_at)?.split(' ')[0]||'-'}</span></div>
      <div class="row"><span class="lbl">Security</span><span>: ${s.security_name||'-'}</span></div>
      <div class="row"><span class="lbl">Jam</span><span>: ${formatWIB(s.closed_at)?.split(' ')[1]||'-'}</span></div>
      <div class="row"><span class="lbl">Kurir</span><span>: ${s.courier_name||'-'}</span></div>
      <div class="row"><span class="lbl">No. Kendaraan</span><span>: ${s.vehicle_number||'-'}</span></div>
      <div class="row"><span class="lbl">Total Paket</span><span>: ${histDetail.length} paket</span></div>
    </div>
    <table><thead><tr><th style="width:40px">No.</th><th>No. AWB</th><th style="width:100px">Status</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="signs">
      <div><div style="font-weight:700;font-size:10px;margin-bottom:6px">Security</div><div class="sign-box"></div><div class="sn">( ${s.security_name||'___'} )</div></div>
      <div><div style="font-weight:700;font-size:10px;margin-bottom:6px">Kurir</div><div class="sign-box"></div><div class="sn">( ${s.courier_name||'___'} )</div></div>
    </div>
    <script>window.onload=()=>window.print()<\/script></body></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
  };

  /* ── LOGIN ── */
  if (!isLoggedIn) return (
    <div style={{height:'100vh',display:'flex',justifyContent:'center',alignItems:'center',background:'#f5f5f5'}}>
      <div style={{width:340,background:'#fff',border:'1px solid #eee',borderRadius:12,overflow:'hidden',boxShadow:'0 10px 30px rgba(0,0,0,0.05)'}}>
        <div style={{background:'#000',color:'#fff',padding:'25px',textAlign:'center'}}>
          <h2 style={{margin:0,fontSize:'1rem',fontWeight:900}}>COOL DASHBOARD</h2>
          <p style={{margin:'4px 0 0',fontSize:'0.65rem',color:'#aaa'}}>WMS MANAGEMENT</p>
        </div>
        <div style={{padding:30}}>
          <input placeholder="Username" style={SI} value={username} onChange={e=>setUsername(e.target.value)}/>
          <input type="password" placeholder="Password" style={SI} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
          <button onClick={handleLogin} style={{width:'100%',background:'#000',color:'#fff',padding:14,border:'none',borderRadius:8,fontWeight:800,cursor:'pointer',fontSize:'0.75rem',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            {loginLoading ? <Loader2 size={16} className="animate-spin"/> : 'LOGIN'}
          </button>
        </div>
      </div>
    </div>
  );

  /* ── SIDEBAR ── */
  const Sidebar = () => (
    <>
      {/* Overlay mobile */}
      {sidebarOpen && isMobile && <div onClick={()=>setSidebarOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:19}}/>}
      <nav style={{
        position:'fixed', top:0, left: sidebarOpen ? 0 : -240, width:240,
        height:'100vh', background:'#fff', borderRight:'1px solid #eee',
        transition:'left 0.25s ease', zIndex:20, display:'flex', flexDirection:'column',
        overflowY:'auto'
      }}>
        {/* Logo + user */}
        <div style={{padding:'18px 16px 12px', borderBottom:'1px solid #f0f0f0'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:900,fontSize:'0.85rem'}}>COOL DASHBOARD</span>
            <button onClick={()=>setSidebarOpen(false)} style={{border:'none',background:'none',cursor:'pointer',color:'#999',padding:2}}>
              <ChevronLeft size={16}/>
            </button>
          </div>
          <div style={{position:'relative',marginTop:8}}>
            <div onClick={()=>setUserMenuOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',padding:'6px 8px',borderRadius:6,background:'#f9f9f9'}}>
              <div style={{width:24,height:24,borderRadius:'50%',background:'#000',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.6rem',fontWeight:900}}>
                {user?.full_name?.[0]?.toUpperCase()||'U'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'0.65rem',fontWeight:800,color:'#212121',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.full_name}</div>
                <div style={{fontSize:'0.55rem',color:'#16a34a',fontWeight:700}}>● Online</div>
              </div>
              <ChevronDown size={10} style={{color:'#999'}}/>
            </div>
            {userMenuOpen && (
              <div style={{position:'absolute',top:44,left:0,right:0,background:'#fff',border:'1px solid #eee',borderRadius:8,boxShadow:'0 4px 16px rgba(0,0,0,0.1)',zIndex:100}}>
                <div onClick={()=>{setIsLoggedIn(false);setUserMenuOpen(false);}}
                  style={{padding:'10px 14px',fontSize:'0.65rem',color:'#ef4444',fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:8,borderRadius:8}}
                  onMouseEnter={e=>e.currentTarget.style.background='#fff5f5'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <LogOut size={12}/> Logout
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav groups */}
        <div style={{flex:1,padding:'8px 0'}}>
          {NAV.map(group => (
            <div key={group.key}>
              <div
                onClick={()=>setExpandedGroup(g => g===group.key ? null : group.key)}
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 16px',cursor:'pointer',userSelect:'none',
                  background: expandedGroup===group.key ? '#f8f8f8' : 'transparent'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,fontSize:'0.68rem',fontWeight:800,color:'#444',letterSpacing:'0.03em'}}>
                  {group.icon} {group.label.toUpperCase()}
                </div>
                {expandedGroup===group.key ? <ChevronDown size={12} style={{color:'#bbb'}}/> : <ChevronRight size={12} style={{color:'#bbb'}}/>}
              </div>
              {expandedGroup===group.key && (
                <div style={{paddingBottom:4}}>
                  {group.children.map(m => (
                    <div key={m}
                      onClick={()=>{ setActiveMenu(m); setSearchTerm(''); setSelectedHeader(null); if(isMobile) setSidebarOpen(false); }}
                      style={{padding:'7px 16px 7px 36px',cursor:'pointer',fontSize:'0.65rem',
                        fontWeight: activeMenu===m ? 800 : 400,
                        color: activeMenu===m ? '#800000' : '#666',
                        background: activeMenu===m ? '#FFF5F5' : 'transparent',
                        borderRight: activeMenu===m ? '2px solid #800000' : 'none',
                        display:'flex',alignItems:'center',gap:6,transition:'0.1s'}}
                      onMouseEnter={e=>{ if(activeMenu!==m) e.currentTarget.style.background='#fafafa'; }}
                      onMouseLeave={e=>{ if(activeMenu!==m) e.currentTarget.style.background='transparent'; }}>
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>
    </>
  );

  /* ── TOPBAR ── */
  const Topbar = ({ title, actions }) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,paddingBottom:14,borderBottom:'1px solid #eee'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <button onClick={()=>setSidebarOpen(o=>!o)} style={{border:'1px solid #eee',background:'#fff',borderRadius:6,padding:'6px 8px',cursor:'pointer',display:'flex',alignItems:'center'}}>
          <Menu size={15}/>
        </button>
        {selectedHeader && (
          <button onClick={()=>setSelectedHeader(null)} style={{border:'1px solid #eee',background:'#fff',borderRadius:6,padding:'6px 8px',cursor:'pointer'}}>
            <ArrowLeft size={14}/>
          </button>
        )}
        <span style={{fontWeight:900,fontSize:'0.85rem',color:'#111'}}>{title}</span>
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>{actions}</div>
    </div>
  );

  /* ── TABLE WRAPPER (sticky header) ── */
  const TableBox = ({ children }) => (
    <div style={{border:'1px solid #eee',borderRadius:8,overflow:'auto',maxHeight:'calc(100vh - 230px)'}}>
      {children}
    </div>
  );

  /* ── SEARCH BAR ── */
  const SearchBar = ({ placeholder='Cari data...' }) => (
    <div style={{position:'relative',marginBottom:14}}>
      <Search size={13} style={{position:'absolute',left:11,top:10,color:'#bbb'}}/>
      <input placeholder={placeholder} style={{width:'100%',padding:'8px 10px 8px 32px',border:'1px solid #eee',borderRadius:8,fontSize:'0.65rem',boxSizing:'border-box',fontFamily:'inherit'}}
        value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
    </div>
  );

  /* ── PROGRESS BAR ── */
  const ProgressBar = ({ value, max, color='#16a34a' }) => {
    const pct = max > 0 ? Math.min(100, Math.round(value/max*100)) : 0;
    return (
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <div style={{flex:1,height:5,background:'#eee',borderRadius:3,overflow:'hidden'}}>
          <div style={{width:`${pct}%`,height:'100%',background: pct===100 ? color : '#f59e0b',borderRadius:3,transition:'width 0.3s'}}/>
        </div>
        <span style={{fontSize:'0.6rem',color:'#888',minWidth:28}}>{pct}%</span>
      </div>
    );
  };

  /* ── TH style (sticky) ── */
  const TH = ({ children, w }) => (
    <th style={{padding:'9px 12px',fontSize:'0.58rem',color:'#999',borderBottom:'1px solid #eee',textTransform:'uppercase',whiteSpace:'nowrap',
      position:'sticky',top:0,background:'#fafafa',zIndex:2, ...(w?{width:w}:{})}}>
      {children}
    </th>
  );
  const TD = ({ children, bold, color }) => (
    <td style={{padding:'9px 12px',fontSize:'0.65rem',whiteSpace:'nowrap', ...(bold?{fontWeight:800}:{}), ...(color?{color}:{})}}>
      {children}
    </td>
  );

  /* ── PICKLIST LIST ROW ── */
  const PicklistRow = ({ h, idx, mode }) => {
    const showPack = mode==='Packing' || mode==='Explorer';
    const qtyReqVal  = h.qtyReq  || '-';
    const qtyPickVal = h.qtyPick || 0;
    const qtyPackVal = h.qtyPack || 0;
    const isExplorer = mode === 'Explorer';
    return (
      <div onClick={()=>setSelectedHeader(h.id)}
        style={{display:'flex',alignItems:'center',padding:'10px 14px',borderBottom:'1px solid #f5f5f5',cursor:'pointer',gap:12,background: idx%2===0?'#fff':'#fefefe',transition:'0.15s'}}
        onMouseEnter={e=>e.currentTarget.style.background='#FFF5F5'}
        onMouseLeave={e=>e.currentTarget.style.background= idx%2===0?'#fff':'#fefefe'}>
        <span style={{fontSize:'0.6rem',color:'#bbb',minWidth:20,textAlign:'right'}}>{idx+1}</span>
        <div style={{minWidth:140,maxWidth:160}}>
          <div style={{fontSize:'0.68rem',fontWeight:800,color:'#800000'}}>{h.id}</div>
          <div style={{fontSize:'0.6rem',color:'#999',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.name}</div>
        </div>
        <div style={{display:'flex',gap:20,flex:1,alignItems:'center'}}>
          <div style={{textAlign:'center',minWidth:50}}>
            <div style={{fontSize:'0.6rem',color:'#bbb'}}>QTY REQ</div>
            <div style={{fontSize:'0.7rem',fontWeight:700}}>{qtyReqVal}</div>
          </div>
          <div style={{textAlign:'center',minWidth:50}}>
            <div style={{fontSize:'0.6rem',color:'#bbb'}}>PICK</div>
            <div style={{fontSize:'0.7rem',fontWeight:700}}>{qtyPickVal}</div>
          </div>
          {showPack && (
            <div style={{textAlign:'center',minWidth:50}}>
              <div style={{fontSize:'0.6rem',color:'#bbb'}}>PACK</div>
              <div style={{fontSize:'0.7rem',fontWeight:700}}>{qtyPackVal}</div>
            </div>
          )}
          {showPack && (
            <div style={{flex:1,minWidth:100,maxWidth:200}}>
              <ProgressBar value={qtyPackVal} max={qtyPickVal||qtyReqVal||1}/>
            </div>
          )}
        </div>
        {isExplorer && (
          <div style={{fontSize:'0.55rem',padding:'2px 8px',borderRadius:4,fontWeight:800,
            background: h.allPacked ? '#dcfce7' : '#fff3cd',
            color: h.allPacked ? '#166534' : '#92400e'}}>
            {h.allPacked ? 'DONE' : 'OPEN'}
          </div>
        )}
        <ChevronRight size={13} style={{color:'#ddd'}}/>
      </div>
    );
  };

  /* ── RENDER DISPATCH ── */
  const renderDispatch = () => {
    if (activeMenu === 'History') {
      return (
        <div>
          <Topbar
            title={selectedHistSession ? `HISTORY: ${selectedHistSession.session_code}` : 'HISTORY HANDOVER'}
            actions={<>
              {selectedHistSession && histDetail && <>
                <button onClick={()=>handleExportExcel(histDetail,`Handover_${selectedHistSession.session_code}.xlsx`)} style={BW}>
                  <FileSpreadsheet size={12}/> Excel
                </button>
                <button onClick={printHandoverPdf} style={{...BW,color:'#800000'}}>
                  <FileText size={12}/> Cetak PDF
                </button>
              </>}
              <button onClick={()=>fetchDispatch('History')} style={BI}><RefreshCw size={13}/></button>
            </>}
          />
          {selectedHistSession ? (
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,background:'#FFF8F8',border:'1px solid #eee',borderRadius:8,padding:'12px 14px',marginBottom:14}}>
                {[['Session',selectedHistSession.session_code],['Transporter',selectedHistSession.transporter_id],
                  ['Security',selectedHistSession.security_name||'-'],['Kurir',selectedHistSession.courier_name||'-'],
                  ['No. Kendaraan',selectedHistSession.vehicle_number||'-'],['Total',`${histDetail?.length||0} paket`]
                ].map(([k,v])=>(
                  <div key={k} style={{display:'flex',gap:6,fontSize:'0.65rem'}}>
                    <span style={{fontWeight:800,minWidth:90,color:'#555'}}>{k}</span>
                    <span style={{color:'#888'}}>: {v}</span>
                  </div>
                ))}
              </div>
              <TableBox>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr><TH>No.</TH><TH>No. AWB</TH><TH>Status</TH></tr></thead>
                  <tbody>
                    {(histDetail||[]).map((r,i)=>(
                      <tr key={i} style={{borderBottom:'1px solid #f5f5f5',background:i%2===0?'#fff':'#fafafa'}}>
                        <TD>{i+1}</TD>
                        <TD>{r.tracking_reference||r.do_reference||'-'}</TD>
                        <TD bold color={statusColor(r.handover_status)}>{r.handover_status||'-'}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableBox>
            </>
          ) : (
            <>
              <SearchBar placeholder="Cari session..."/>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}}>
                {historyData.filter(s=>JSON.stringify(s).toUpperCase().includes(searchTerm.toUpperCase())).map((s,i)=>(
                  <div key={i} onClick={()=>loadHistDetail(s)}
                    style={{border:'1px solid #eee',borderRadius:10,padding:14,cursor:'pointer',background:'#fff',transition:'0.2s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='#800000'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='#eee'}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <div>
                        <div style={{fontWeight:900,fontSize:'0.8rem',color:'#800000'}}>{s.session_code}</div>
                        <div style={{fontSize:'0.6rem',color:'#999',marginTop:2}}>{s.transporter_id}</div>
                        <div style={{fontSize:'0.6rem',color:'#666',marginTop:4}}>Security: {s.security_name||'-'} | Kurir: {s.courier_name||'-'}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontWeight:900,fontSize:'1.1rem'}}>{s.total_sorted}</div>
                        <div style={{fontSize:'0.55rem',color:'#999'}}>PAKET</div>
                        <div style={{marginTop:4,background:'#dcfce7',color:'#166534',fontSize:'0.55rem',fontWeight:800,padding:'2px 7px',borderRadius:4}}>DONE</div>
                      </div>
                    </div>
                    <div style={{fontSize:'0.58rem',color:'#ccc',marginTop:8,borderTop:'1px solid #f5f5f5',paddingTop:7}}>{formatWIB(s.closed_at)}</div>
                  </div>
                ))}
                {historyData.length===0 && <div style={{gridColumn:'1/-1',textAlign:'center',color:'#ccc',padding:40,fontSize:'0.7rem'}}>Belum ada history handover</div>}
              </div>
            </>
          )}
        </div>
      );
    }

    const isHO    = activeMenu === 'Handover';
    const title   = isHO ? 'HANDOVER' : 'DISPATCH LOG';
    return (
      <div>
        <Topbar title={title} actions={<>
          <button onClick={()=>handleExportExcel(filteredDispatch,`${title}.xlsx`)} style={BW}><FileSpreadsheet size={12}/> Export</button>
          <button onClick={()=>fetchDispatch(activeMenu)} style={BI}><RefreshCw size={13} className={dispatchLoading?'animate-spin':''}/></button>
        </>}/>
        <SearchBar/>
        {dispatchLoading ? <div style={{textAlign:'center',padding:40,color:'#ccc',fontSize:'0.7rem'}}>Loading...</div> : (
          <TableBox>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  {isHO ? <>
                    <TH>ID</TH><TH>Session</TH><TH>AWB / DO Ref</TH><TH>Status</TH>
                    <TH>Security</TH><TH>Kurir</TH><TH>No. Kendaraan</TH><TH>Handover At</TH>
                  </> : <>
                    <TH>ID</TH><TH>Session</TH><TH>Transporter</TH><TH>AWB / DO Ref</TH>
                    <TH>Operator</TH><TH>Handover Status</TH><TH>Scanned At</TH>
                  </>}
                </tr>
              </thead>
              <tbody>
                {filteredDispatch.map((r,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid #f5f5f5',background:i%2===0?'#fff':'#fafafa'}}>
                    {isHO ? <>
                      <TD>{r.id}</TD>
                      <TD bold color="#800000">{r.session_code}</TD>
                      <TD>{r.tracking_reference||r.do_reference||'-'}</TD>
                      <TD bold color={statusColor(r.status)}>{r.status}</TD>
                      <TD>{r.security_name||'-'}</TD>
                      <TD>{r.courier_name||'-'}</TD>
                      <TD>{r.vehicle_number||'-'}</TD>
                      <TD>{formatWIB(r.handover_at)}</TD>
                    </> : <>
                      <TD>{r.id}</TD>
                      <TD bold color="#800000">{r.session_code}</TD>
                      <TD>{r.transporter_id}</TD>
                      <TD>{r.tracking_reference||r.do_reference||'-'}</TD>
                      <TD>{r.operator}</TD>
                      <TD bold color={statusColor(r.handover_status)}>{r.handover_status||'-'}</TD>
                      <TD>{formatWIB(r.scanned_at)}</TD>
                    </>}
                  </tr>
                ))}
                {filteredDispatch.length===0 && <tr><td colSpan={8} style={{textAlign:'center',padding:30,color:'#ccc',fontSize:'0.65rem'}}>Tidak ada data</td></tr>}
              </tbody>
            </table>
          </TableBox>
        )}
      </div>
    );
  };

  /* ── RENDER MAIN CONTENT ── */
  const renderContent = () => {
    if (isDispatch) return renderDispatch();

    const isPicklistMenu = ['Picking','Packing','Explorer'].includes(activeMenu);

    /* Actions toolbar */
    const actions = <>
      {activeMenu==='Master Lokasi' && masterTab==='database' && (
        <button onClick={()=>setShowAddForm(true)} style={{...BW,background:'#000',color:'#fff'}}><Plus size={11}/> Add</button>
      )}
      {activeMenu==='Snapshoot' && (
        <label style={{...BW,background:'#000',color:'#fff',cursor:'pointer'}}><Upload size={11}/> Upload
          <input type="file" hidden onChange={handleFileUpload}/>
        </label>
      )}
      {['1st Count','2nt Count','Snapshoot','Reconciliation'].includes(activeMenu) && (
        <button onClick={()=>{ if(window.confirm("Hapus data?"))
          axios.post(`${API_BASE}?action=clear_${activeMenu.includes('1st')?'first':activeMenu.includes('2nt')?'second':activeMenu.includes('Snap')?'snap':'recon'}`)
            .then(fetchData);
        }} style={{...BW,color:'#ef4444'}}><Trash2 size={11}/> Clear</button>
      )}
      <button onClick={()=>handleExportExcel(isPicklistMenu ? (selectedHeader ? filteredData : picklistGroups) : data, `${activeMenu}.xlsx`)} style={{...BW,color:'#16a34a'}}>
        <FileSpreadsheet size={11}/> Export
      </button>
      <button onClick={fetchData} style={BI}><RefreshCw size={13} className={loading?'animate-spin':''}/></button>
    </>;

    const title = selectedHeader ? `${activeMenu} › ${selectedHeader}` : activeMenu.toUpperCase();

    return (
      <div>
        <Topbar title={title} actions={actions}/>

        {activeMenu==='Master Lokasi' && (
          <div style={{display:'flex',gap:12,marginBottom:16,borderBottom:'1px solid #eee'}}>
            {[['grid',<LayoutGrid size={11}/>,'Assign CC'],['database',<DbIcon size={11}/>,'Database Lokasi']].map(([t,ic,lb])=>(
              <div key={t} onClick={()=>setMasterTab(t)} style={{padding:'8px 12px',cursor:'pointer',fontSize:'0.62rem',fontWeight:masterTab===t?800:400,color:masterTab===t?'#000':'#ccc',borderBottom:masterTab===t?'2px solid #000':'none',display:'flex',alignItems:'center',gap:5}}>
                {ic} {lb}
              </div>
            ))}
          </div>
        )}

        {activeMenu==='Explorer' && !selectedHeader && (
          <div style={{display:'flex',gap:8,marginBottom:14}}>
            {['active','completed'].map(t=>(
              <button key={t} onClick={()=>setExplorerTab(t)}
                style={{padding:'6px 16px',fontSize:'0.62rem',fontWeight:800,border:'none',borderRadius:6,cursor:'pointer',
                  background:explorerTab===t?'#000':'#f5f5f5',color:explorerTab===t?'#fff':'#666'}}>
                {t==='active'?'ACTIVE':'COMPLETED'}
              </button>
            ))}
          </div>
        )}

        {activeMenu!=='Print Label' && <SearchBar/>}

        {/* PICKLIST LIST VIEW */}
        {isPicklistMenu && !selectedHeader ? (
          <div style={{border:'1px solid #eee',borderRadius:8,overflow:'hidden'}}>
            {/* list header */}
            <div style={{display:'flex',padding:'7px 14px',background:'#fafafa',borderBottom:'1px solid #eee',gap:12,fontSize:'0.57rem',color:'#999',fontWeight:800,textTransform:'uppercase'}}>
              <span style={{minWidth:20}}>#</span>
              <span style={{minWidth:140}}>Picklist / Toko</span>
              <div style={{display:'flex',gap:20,flex:1}}>
                <span style={{minWidth:50}}>Qty Req</span>
                <span style={{minWidth:50}}>Pick</span>
                {(activeMenu==='Packing'||activeMenu==='Explorer') && <span style={{minWidth:50}}>Pack</span>}
                {(activeMenu==='Packing'||activeMenu==='Explorer') && <span style={{flex:1}}>Progress</span>}
              </div>
            </div>
            {(activeMenu==='Explorer'
              ? filteredGroups.filter(h => explorerTab==='active' ? !h.allPacked : h.allPacked)
              : filteredGroups
            ).map((h,i)=><PicklistRow key={h.id} h={h} idx={i} mode={activeMenu}/>)}
            {filteredGroups.length===0 && <div style={{textAlign:'center',padding:30,color:'#ccc',fontSize:'0.65rem'}}>Tidak ada data</div>}
          </div>
        ) : activeMenu==='Print Label' ? (
          <PrintLabelPanel data={data} selectedPcb={selectedPcb} setSelectedPcb={setSelectedPcb}
            selectedBoxHuid={selectedBoxHuid} setSelectedBoxHuid={setSelectedBoxHuid}
            boxOptions={boxOptions} fetchBoxByPcb={fetchBoxByPcb} loading={loading}/>
        ) : activeMenu==='Master Lokasi' && masterTab==='grid' ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))',gap:10}}>
            {filteredData.map((r,i)=>(
              <div key={i} style={{border:'1px solid #eee',padding:12,display:'flex',flexDirection:'column',alignItems:'center',borderRadius:8,background:'#fff',gap:8}}>
                <span style={{fontWeight:800,fontSize:'0.65rem'}}>{r?.unique_id}</span>
                <div onClick={()=>handleToggle(r.unique_id,r.assign)} style={{width:34,height:18,background:r.assign==='open'?'#16a34a':'#eee',borderRadius:10,position:'relative',cursor:'pointer'}}>
                  <div style={{width:12,height:12,background:'#fff',borderRadius:'50%',position:'absolute',top:3,left:r.assign==='open'?19:3,transition:'0.2s'}}/>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TableBox>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  {activeMenu==='Master Lokasi' ? <><TH>Lokasi</TH><TH>Zone</TH><TH>Aisle</TH><TH>Unique</TH><TH>Status</TH></>
                  : activeMenu==='Reconciliation' ? <><TH>Lokasi</TH><TH>Artikel</TH><TH>Snap</TH><TH>1st</TH><TH>2nd</TH><TH>Diff</TH><TH>Status</TH></>
                  : activeMenu==='Picking' ? <><TH>ID</TH><TH>Product</TH><TH>Loc</TH><TH>Qty</TH><TH>Picker</TH><TH>Time</TH><TH>Status</TH></>
                  : activeMenu==='Packing' ? <><TH>ID</TH><TH>Box#</TH><TH>Product</TH><TH>Qty</TH><TH>Packer</TH><TH>Time</TH><TH>HUID</TH><TH>Status</TH></>
                  : activeMenu==='Explorer' ? <><TH>SKU</TH><TH>Desc</TH><TH>Req</TH><TH>Pick</TH><TH>Pack</TH><TH>Status</TH></>
                  : activeMenu==='Snapshoot' ? <><TH>Lokasi</TH><TH>Artikel</TH><TH>Qty Snap</TH><TH>Description</TH></>
                  : <><TH>Location</TH><TH>Artikel</TH><TH>Description</TH><TH>Qty</TH><TH>Timestamp</TH><TH>Operator</TH></>}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((r,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid #f5f5f5',background:i%2===0?'#fff':'#fafafa'}}>
                    {activeMenu==='Master Lokasi' ? <>
                      <TD>{r?.location_id}</TD><TD>{r?.zone}</TD><TD>{r?.aisle}</TD><TD>{r?.unique_id}</TD>
                      <TD bold color={r?.assign==='open'?'#16a34a':'#ef4444'}>{r?.assign?.toUpperCase()}</TD>
                    </> : activeMenu==='Reconciliation' ? <>
                      <TD>{r?.location_id}</TD><TD>{r?.artikel}</TD>
                      <TD>{r?.qty_snap}</TD><TD>{r?.qty_1st}</TD><TD>{r?.qty_2nd}</TD>
                      <TD bold color={(Number(r?.qty_2nd||r?.qty_1st||0)-Number(r?.qty_snap||0))===0?'#16a34a':'#ef4444'}>
                        {Number(r?.qty_2nd||r?.qty_1st||0)-Number(r?.qty_snap||0)}
                      </TD>
                      <TD>{r?.final_status}</TD>
                    </> : activeMenu==='Picking' ? <>
                      <TD>{r?.id}</TD><TD>{r?.product_id}</TD><TD>{r?.location_id}</TD>
                      <TD>{r?.qty_actual}</TD><TD>{r?.picker_name}</TD>
                      <TD>{formatWIB(r?.scanned_at)}</TD><TD>{r?.status}</TD>
                    </> : activeMenu==='Packing' ? <>
                      <TD>{r?.id}</TD><TD>{r?.box_number}</TD><TD>{r?.product_id}</TD>
                      <TD>{r?.qty_packed}</TD><TD>{r?.scanned_by}</TD>
                      <TD>{formatWIB(r?.scanned_at)}</TD><TD>{r?.huid}</TD><TD>{r?.status}</TD>
                    </> : activeMenu==='Explorer' ? <>
                      <TD>{r?.sku}</TD>
                      <td style={{padding:'9px 12px',fontSize:'0.6rem',color:'#999',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{getDesc(r)}</td>
                      <TD>{r?.qty_req}</TD><TD>{r?.qty_picked}</TD><TD>{r?.qty_packed}</TD><TD>{r?.status}</TD>
                    </> : activeMenu==='Snapshoot' ? <>
                      <TD>{r?.location_id}</TD><TD>{r?.artikel}</TD><TD>{r?.qty_snap}</TD>
                      <td style={{padding:'9px 12px',fontSize:'0.6rem',color:'#999'}}>{getDesc(r)}</td>
                    </> : <>
                      <TD>{r?.location_id}</TD><TD>{r?.artikel}</TD>
                      <td style={{padding:'9px 12px',fontSize:'0.6rem',color:'#999'}}>{getDesc(r)}</td>
                      <TD>{r?.qty_1st||r?.qty_2nd||r?.qty}</TD>
                      <TD>{formatWIB(r?.scanned_at||r?.timestamp)}</TD><TD>{r?.operator}</TD>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBox>
        )}
      </div>
    );
  };

  /* ── ROOT ── */
  return (
    <div style={{fontFamily:'Lexend,sans-serif',background:'#fff',minHeight:'100vh',fontSize:'0.72rem'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}.animate-spin{animation:spin 1s linear infinite}`}</style>
      {toast.show && (
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',
          background:toast.type==='success'?'#16a34a':'#ef4444',color:'#fff',
          padding:'9px 20px',borderRadius:50,fontWeight:800,zIndex:9999,fontSize:'0.65rem',boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>
          {toast.msg}
        </div>
      )}

      <Sidebar/>

      {/* Main content — shifts right when sidebar open on desktop */}
      <div style={{marginLeft: !isMobile && sidebarOpen ? 240 : 0, transition:'margin-left 0.25s ease', padding:'24px 28px', minHeight:'100vh'}}>
        {renderContent()}
      </div>

      {/* Add Location Modal */}
      {showAddForm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000}}>
          <div style={{background:'#fff',padding:28,borderRadius:16,width:'85%',maxWidth:400,boxShadow:'0 20px 40px rgba(0,0,0,0.2)'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
              <span style={{fontWeight:900,fontSize:'0.85rem'}}>ADD LOCATION</span>
              <button onClick={()=>setShowAddForm(false)} style={{border:'none',background:'none',cursor:'pointer'}}><X size={18}/></button>
            </div>
            <label style={LB}>LOKASI ID</label>
            <input style={SI} value={newLoc.id} onChange={e=>setNewLoc({...newLoc,id:e.target.value})}/>
            <div style={{display:'flex',gap:10}}>
              <div style={{flex:1}}><label style={LB}>ZONE</label><input style={SI} value={newLoc.zone} onChange={e=>setNewLoc({...newLoc,zone:e.target.value.toUpperCase()})}/></div>
              <div style={{flex:1}}><label style={LB}>AISLE</label><input style={SI} type="number" value={newLoc.aisle} onChange={e=>setNewLoc({...newLoc,aisle:e.target.value})}/></div>
            </div>
            <button onClick={async()=>{
              try {
                await axios.post(`${API_BASE}?action=add_location`,{...newLoc,location_id:newLoc.id.toUpperCase()});
                showToast("Added!"); setShowAddForm(false); fetchData();
              } catch { showToast("Error!","error"); }
            }} style={{width:'100%',background:'#000',color:'#fff',padding:12,border:'none',borderRadius:8,fontWeight:800,cursor:'pointer',fontSize:'0.72rem',marginTop:8}}>
              SAVE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SHARED STYLES ── */
const SI = { width:'100%',padding:'10px 12px',border:'1px solid #eee',marginBottom:10,borderRadius:8,fontFamily:'inherit',fontSize:'0.72rem',boxSizing:'border-box' };
const BW = { background:'#fff',border:'1px solid #eee',padding:'6px 12px',borderRadius:6,fontSize:'0.62rem',display:'flex',alignItems:'center',gap:5,cursor:'pointer' };
const BI = { background:'#fff',border:'1px solid #eee',padding:'6px 8px',borderRadius:6,cursor:'pointer',display:'flex',alignItems:'center' };
const LB = { fontSize:'0.58rem',fontWeight:800,color:'#999',marginBottom:5,display:'block',letterSpacing:'0.05em' };