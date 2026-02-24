import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Barcode from 'react-barcode'; 
import QRCode from 'react-qr-code';   
import {
  RefreshCw, FileSpreadsheet, Trash2, LogOut, Upload, Search,
  ChevronLeft, ClipboardCheck, PackageCheck, BarChart3, Download,
  CheckCircle2, Loader2, Check, Plus, Database as DbIcon, LayoutGrid, X,
  Truck, Package, Globe, Printer, ArrowLeft
} from 'lucide-react';

/* --- API ENDPOINTS --- */
const API_BASE = 'https://wms-neon-bridge.vercel.app/api/inventory';
const API_OUTBOUND = 'https://wms-neon-bridge.vercel.app/api/to_web'; 

/* ================= 1. PRINT COMPONENT (FORMAT PDF MATCH) ================= */
const RenderLabelComponent = ({ box }) => {
  if (!box || !box.item_details) return null;
  const pages = [];
  const items = box.item_details || [];
  // Maksimal 12 baris per halaman agar muat di 10x10cm
  for (let i = 0; i < items.length; i += 12) pages.push(items.slice(i, i + 12));

  return (
    <div id="print-label-container" className="print-area-thermal">
      {pages.map((pItems, idx) => (
        <div key={idx} className={`l-page ${idx === pages.length - 1 ? 'last-page' : ''}`}>
          {/* Header Unboxing */}
          <div className="u-banner">WAJIB VIDEO UNBOXING - KOMPLAIN TANPA VIDEO TIDAK DILAYANI</div>
          
          <div className="l-header">
             <div className="pt-info">
                <div className="l-pt-name">PT DUA PULUH TIGA</div>
                <div className="l-pt-addr">Jl. kopo Bihbul Raya no 68, Bandung</div>
             </div>
             <div className="huid-info">
                <div className="l-huid-label">HUID: <b>{box.huid}</b></div>
                <QRCode value={box.huid || ''} size={45} level="H" />
             </div>
          </div>

          <div className="l-line" />
          
          {/* Picklist & Store Info Grid */}
          <div className="l-grid">
            <div className="l-grid-node"><b>{box.picklist_number}</b></div>
            <div className="l-grid-node"><b>{box.nama_toko || box.nama_customer || '-'}</b></div>
            <div className="l-grid-node" style={{fontSize:'6pt'}}>{box.alamat_toko || box.address_toko || '-'}</div>
          </div>
          
          <div className="l-line" />
          
          <div className="box-content-title">
            BOX CONTENT <span style={{float:'right'}}>BOX: {box.container_number || 'BOX-001'} ({idx+1}/{pages.length})</span>
          </div>

          <table className="l-table">
             <thead><tr><th>Artikel</th><th>Description</th><th>Qty</th></tr></thead>
             <tbody>
                {pItems.map((it, k) => (
                  <tr key={k}>
                    <td style={{width:'30%'}}>{it?.sku}</td>
                    <td style={{width:'60%'}} className="trunc-cell">{it?.nama_item || it?.name || '-'}</td>
                    <td style={{width:'10%', textAlign:'center'}}>{it?.qty}</td>
                  </tr>
                ))}
             </tbody>
          </table>

          <div className="l-line" style={{marginTop:'auto'}} />
          
          {/* Footer Info */}
          <div className="l-footer">
             <div className="l-row">
                <span>Packer: <b>{box.packer_name || box.scanned_by || '-'}</b></span>
                <span>Total Qty: <b>{box.total_pcs_box || box.qty_packed || 0} PCS</b></span>
             </div>
             <div className="l-row">
                <span>Tanggal: <b>{(box.tanggal_packing || box.scanned_at || '').substring(0,10)}</b></span>
                <span>Berat: <b>{box.weight_kg || '0'} KG</b></span>
             </div>
          </div>

          {/* Barcode SJ */}
          <div className="l-barcode">
              <div className="sj-label">NO SJ: {box.no_sj || box.picklist_number}</div>
              <Barcode 
                value={box.no_sj || box.picklist_number || ''} 
                width={1.6} 
                height={35} 
                fontSize={0} 
                margin={0} 
              />
          </div>
        </div>
      ))}
    </div>
  );
};

function App() {
  /* ================= 2. STATE ================= */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [activeMenu, setActiveMenu] = useState('Master Lokasi');
  const [masterTab, setMasterTab] = useState('grid'); 
  const [explorerTab, setExplorerTab] = useState('active');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState([]); 
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLoc, setNewLoc] = useState({ id: '', zone: '', aisle: '', unique: '', assign: 'closed' });
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [selectedHeader, setSelectedHeader] = useState(null);

  const [selectedPcb, setSelectedPcb] = useState('');
  const [selectedBoxHuid, setSelectedBoxHuid] = useState('');
  const [boxOptions, setBoxOptions] = useState([]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ================= 3. UTILS ================= */
  const formatWIB = (dateStr) => {
    if (!dateStr || dateStr === '-' || dateStr === 'null') return dateStr;
    if (typeof dateStr === 'string' && (dateStr.length < 10 || isNaN(Date.parse(dateStr)))) return dateStr;
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch (e) { return dateStr; }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };

  const getDesc = (item) => {
    if (!item) return '-';
    return item.description || item.sku_desc || item.desc || item.product_description || '-';
  };

  const handleExportExcel = () => {
    if (!data || data.length === 0) return showToast("Tidak ada data", "error");
    const exportData = data.map(item => {
      const newItem = { ...item };
      const timeKeys = ['scanned_at', 'timestamp', 'tanggal_packing', 'created_at'];
      timeKeys.forEach(key => { if (newItem[key]) newItem[key] = formatWIB(newItem[key]); });
      return newItem;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `COOL_${activeMenu}_WIB.xlsx`);
  };

  /* ================= 4. FETCHING ================= */
  const fetchData = async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    setSelectedHeader(null); 
    try {
      if (activeMenu === 'Print Label') {
        const res = await axios.get(`${API_OUTBOUND}?target=packing_transactions`);
        setData(res.data?.data || []);
      } else {
        const targetMap = {
          'Master Lokasi': masterTab === 'database' ? 'master_all' : 'master',
          'Snapshoot': 'snapshot_list',
          '1st Count': 'first', '2nt Count': 'second', 'Reconciliation': 'recon',
          'Picking': 'picking_transactions', 'Packing': 'packing_transactions', 'Explorer': 'outbound_explorer'
        };
        const currentAPI = ['Picking', 'Packing', 'Explorer'].includes(activeMenu) ? API_OUTBOUND : API_BASE;
        const res = await axios.get(`${currentAPI}?action=get_data&target=${targetMap[activeMenu]}`);
        setData(res.data?.data || []);
      }
    } catch (e) { setData([]); }
    finally { setLoading(false); setSelectedRows([]); }
  };

  useEffect(() => { fetchData(); }, [activeMenu, masterTab, isLoggedIn]);

  const fetchBoxByPcb = async (pcb) => {
    if (!pcb) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_OUTBOUND}?action=get_print_data&pcb=${pcb}`);
      setBoxOptions(res.data?.data || []);
    } catch (e) { showToast("Gagal tarik detail box", "error"); }
    finally { setLoading(false); }
  };

  /* ================= 5. HANDLERS ================= */
  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data?.status === 'success') { setUser(res.data.user); setIsLoggedIn(true); }
      else showToast("User/Pass Salah", "error");
    } catch (e) { showToast("Server Error", "error"); }
    finally { setLoginLoading(false); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setLoading(true);
      try {
        const workbook = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
        const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        await axios.post(`${API_BASE}?action=upload_snap`, { data: excelData });
        showToast("Snapshot Terupload!"); fetchData();
      } catch (err) { showToast("Gagal Upload", "error"); }
      finally { setLoading(false); e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleToggle = async (uid, currentStatus) => {
    const nextStatus = currentStatus === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      fetchData();
    } catch (e) { showToast("Gagal Toggle", "error"); }
  };

  /* ================= 6. HEADER DRILLDOWN LOGIC ================= */
  const groupedExplorerHeaders = useMemo(() => {
    if (activeMenu !== 'Explorer' || !data) return { active: [], completed: [] };
    const groups = data.reduce((acc, curr) => {
      const key = curr.picklist_number;
      if (!key) return acc;
      if (!acc[key]) acc[key] = { id: key, name: curr.nama_customer || curr.nama_toko || '-', lines: [], allPacked: true };
      acc[key].lines.push(curr);
      if (curr.status !== 'packed') acc[key].allPacked = false;
      return acc;
    }, {});
    const result = Object.values(groups);
    return { active: result.filter(h => !h.allPacked), completed: result.filter(h => h.allPacked) };
  }, [data, activeMenu]);

  const headerData = useMemo(() => {
    if (!['Picking', 'Packing'].includes(activeMenu) || !data) return null;
    const groups = data.reduce((acc, curr) => {
      const key = curr.picklist_number;
      if (!key) return acc;
      if (!acc[key]) acc[key] = { id: key, name: curr.nama_customer || curr.nama_toko || '-', count: 0 };
      acc[key].count++;
      return acc;
    }, {});
    return Object.values(groups);
  }, [data, activeMenu]);

  const currentPrintData = useMemo(() => {
    return boxOptions.find(b => b.huid === selectedBoxHuid) || null;
  }, [selectedBoxHuid, boxOptions]);

  const filteredData = (data || []).filter(item => {
    if (selectedHeader) return (item.picklist_number === selectedHeader);
    if (!searchTerm) return true;
    const s = searchTerm.toUpperCase();
    return String(item.location_id || item.picklist_number || item.id || '').includes(s) || 
           String(item.artikel || item.product_id || item.sku || '').includes(s);
  });

  /* ================= 7. RENDER DASHBOARD ================= */
  if (!isLoggedIn) {
    return (
      <div style={loginPage}>
        <div style={loginCard}>
          <div style={loginHeader}><h2>COOL</h2><p>WAREHOUSE MANGEMENT SYSTEM</p></div>
          <div style={{padding:'30px'}}>
            <input placeholder="Username" style={mInput} value={username} onChange={e=>setUsername(e.target.value)} />
            <input type="password" placeholder="Password" style={mInput} value={password} onChange={e=>setPassword(e.target.value)} />
            <button onClick={handleLogin} style={btnBlack}>{loginLoading ? <Loader2 className="animate-spin" size={18}/> : "LOGIN"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={mainLayout}>
      {/* CSS ISOLATION UNTUK PRINT 10x10 CM DENGAN MARGIN 0.2 CM */}
      <style>{`
        @media screen {
          .print-area-thermal { display: none; }
        }
        @media print {
          @page { size: 10cm 10cm; margin: 0; }
          body { margin: 0; padding: 0; background: #fff; }
          .no-print { display: none !important; }
          .print-area-thermal { display: block !important; width: 10cm; height: 10cm; }
          .l-page { 
            width: 10cm; height: 10cm; padding: 0.2cm; 
            box-sizing: border-box; page-break-after: always; 
            display: flex; flex-direction: column; font-family: 'Helvetica', 'Arial', sans-serif;
            background: #fff; border: none;
          }
          .l-page.last-page { page-break-after: avoid !important; }
          .u-banner { background: #FF0000 !important; -webkit-print-color-adjust: exact; color: #fff !important; text-align: center; font-size: 7.5pt; font-weight: bold; padding: 4px; border-radius: 2px; }
          .l-header { display: flex; justify-content: space-between; padding: 4px 2px; }
          .l-pt-name { font-weight: 900; font-size: 11pt; }
          .l-pt-addr { font-size: 6.5pt; line-height: 1.1; color: #333; }
          .l-huid-label { font-size: 8pt; margin-bottom: 2px; font-weight: bold; }
          .l-line { height: 1.5px; background: #000; margin: 1mm 0; }
          .l-grid { display: grid; grid-template-columns: 1.2fr 1.5fr 1fr; border: 1.2px solid #000; }
          .l-grid-node { border-right: 1.2px solid #000; padding: 3px; font-size: 7.5pt; font-weight: bold; text-align: center; display: flex; align-items: center; justify-content: center; }
          .l-grid-node:last-child { border-right: none; }
          .box-content-title { font-weight: 900; font-size: 8pt; padding: 2px 0; }
          .l-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
          .l-table th { background: #eee !important; -webkit-print-color-adjust: exact; text-align: left; padding: 3px; border: 0.8px solid #000; }
          .l-table td { padding: 3px; border: 0.8px solid #333; line-height: 1; }
          .trunc-cell { max-width: 4.5cm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
          .l-footer { font-size: 7.5pt; padding: 3px 0; }
          .l-row { display: flex; justify-content: space-between; margin-bottom: 1px; }
          .l-red { color: #FF0000 !important; font-weight: bold; }
          .l-barcode { text-align: center; margin-top: auto; padding-bottom: 1mm; }
          .sj-label { font-weight: bold; font-size: 9pt; margin-bottom: 1px; }
        }
        .preview-box-render { transform: scale(0.85); transform-origin: top center; }
        .preview-box-render .l-page { width: 10cm; height: 10cm; padding: 0.2cm; box-sizing: border-box; background: #fff; border: 1px solid #ccc; display: flex; flex-direction: column; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .preview-box-render .u-banner { background: #FF0000; color: #fff; text-align: center; font-size: 7.5pt; font-weight: bold; padding: 4px; }
        .tab-btn { padding: 8px 20px; font-size: 0.7rem; font-weight: 800; border: none; background: #f5f5f5; cursor: pointer; border-radius: 6px; }
        .tab-btn.active { background: #000; color: #fff; }
      `}</style>

      {toast.show && <div style={toastStyle(toast.type)}>{toast.msg}</div>}
      
      <nav style={sidebarStyle(isMobile)} className="no-print">
        <div style={{ padding: '20px 20px 10px' }}>
            <div style={{ fontWeight: 900, fontSize: '1rem' }}>COOL DASHBOARD</div>
            <div style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 800, marginTop: 4 }}>👤 {user?.full_name || user?.username}</div>
        </div>
        <div style={menuSectionLabel}>INVENTORY</div>
        {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
          <div key={m} onClick={() => { setActiveMenu(m); setMasterTab('grid'); }} style={navItem(activeMenu === m)}>{m}</div>
        ))}
        <div style={menuSectionLabel}>OUTBOUND</div>
        {['Picking', 'Packing', 'Explorer', 'Print Label'].map(m => (
          <div key={m} onClick={() => setActiveMenu(m)} style={navItem(activeMenu === m)}>
            <div style={{display:'flex', alignItems:'center', gap:8}}><Printer size={14}/> {m}</div>
          </div>
        ))}
        <button onClick={() => setIsLoggedIn(false)} style={btnLogout}><LogOut size={14} /></button>
      </nav>

      <div style={contentArea(isMobile)} className="no-print">
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {selectedHeader && <button onClick={()=>setSelectedHeader(null)} style={btnIcon}><ArrowLeft size={16}/></button>}
            <div style={{ fontWeight: '800' }}>{selectedHeader ? `${activeMenu}: ${selectedHeader}` : activeMenu.toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeMenu === 'Master Lokasi' && masterTab === 'database' && (
              <button onClick={()=>setShowAddForm(true)} style={{...btnWhite, background:'#000', color:'#fff'}}><Plus size={12}/> ADD NEW</button>
            )}
            {activeMenu === 'Snapshoot' && (
              <label style={{...btnWhite, background:'#000', color:'#fff', cursor:'pointer'}}><Upload size={12}/> UPLOAD SNAP <input type="file" hidden onChange={handleFileUpload}/></label>
            )}
            {['1st Count', '2nt Count', 'Snapshoot', 'Reconciliation'].includes(activeMenu) && (
              <button onClick={() => { if(window.confirm("Hapus data menu ini?")) axios.post(`${API_BASE}?action=clear_${activeMenu.includes('1st')?'first':activeMenu.includes('2nt')?'second':activeMenu.includes('Snap')?'snap':'recon'}`).then(()=>fetchData()); }} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> CLEAR</button>
            )}
            {activeMenu === 'Print Label' && selectedBoxHuid && (
              <button onClick={() => window.print()} style={{...btnWhite, background:'#800000', color:'#fff'}}><Printer size={12}/> PRINT NOW</button>
            )}
            <button onClick={handleExportExcel} style={{...btnWhite, color:'#16a34a'}}><FileSpreadsheet size={12}/> EXPORT WIB</button>
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading?'animate-spin':''}/></button>
          </div>
        </header>

        {activeMenu === 'Explorer' && !selectedHeader && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button className={`tab-btn ${explorerTab === 'active' ? 'active' : ''}`} onClick={()=>setExplorerTab('active')}>ACTIVE</button>
            <button className={`tab-btn ${explorerTab === 'completed' ? 'active' : ''}`} onClick={()=>setExplorerTab('completed')}>COMPLETED (CLOSE)</button>
          </div>
        )}

        {activeMenu === 'Master Lokasi' && (
          <div style={{display:'flex', gap:15, marginBottom:20, borderBottom:'1px solid #eee'}}>
            <div onClick={()=>setMasterTab('grid')} style={tabItem(masterTab === 'grid')}><LayoutGrid size={14}/> ASSIGN CC</div>
            <div onClick={()=>setMasterTab('database')} style={tabItem(masterTab === 'database')}><DbIcon size={14}/> DATABASE LOKASI</div>
          </div>
        )}

        {!selectedHeader && <div style={searchContainer}><Search size={14} style={{position:'absolute', left: 10, top: 12, color:'#999'}} /><input placeholder="Cari..." style={searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>}

        {/* --- DYNAMIC RENDERER --- */}
        {activeMenu === 'Explorer' && !selectedHeader ? (
           <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:15}}>
              {groupedExplorerHeaders[explorerTab].filter(h => h.id.toUpperCase().includes(searchTerm.toUpperCase())).map((h, i) => (
                <div key={i} className="header-card" onClick={()=>setSelectedHeader(h.id)}>
                   <div><div style={{fontWeight:900, fontSize:'0.85rem'}}>{h.id}</div><div style={{fontSize:'0.65rem', color:'#999'}}>{h.name}</div></div>
                   <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4}}>
                      <div style={{fontSize: '0.55rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 900, background: h.allPacked ? '#dcfce7' : '#fee2e2', color: h.allPacked ? '#166534' : '#991b1b'}}>{h.allPacked ? 'CLOSE' : 'OPEN'}</div>
                      <div style={{background:'#f5f5f5', padding:'4px 10px', borderRadius:20, fontSize:'0.6rem', fontWeight:800}}>{h.lines.length} LINES</div>
                   </div>
                </div>
              ))}
           </div>
        ) : headerData && !selectedHeader ? (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:15}}>
             {headerData.filter(h => h.id.toUpperCase().includes(searchTerm.toUpperCase())).map((h, i) => (
               <div key={i} className="header-card" onClick={()=>setSelectedHeader(h.id)}>
                  <div><div style={{fontWeight:900, fontSize:'0.85rem'}}>{h.id}</div><div style={{fontSize:'0.65rem', color:'#999'}}>{h.name}</div></div>
                  <div style={{background:'#f5f5f5', padding:'4px 10px', borderRadius:20, fontSize:'0.6rem', fontWeight:800}}>{h.count} ITEMS</div>
               </div>
             ))}
          </div>
        ) : activeMenu === 'Print Label' ? (
            <div style={{display:'flex', gap:20, flexDirection: isMobile ? 'column' : 'row'}}>
              <div style={{flex:1}}>
                  <label style={labelStyle}>1. PCB:</label>
                  <select style={mInput} value={selectedPcb} onChange={(e) => { setSelectedPcb(e.target.value); fetchBoxByPcb(e.target.value); setSelectedBoxHuid(''); }}>
                    <option value="">-- PILIH PCB --</option>
                    {[...new Set(data.map(b => b.picklist_number))].map((p, i) => <option key={i} value={p}>{p}</option>)}
                  </select>
                  <label style={labelStyle}>2. BOX:</label>
                  <select style={mInput} value={selectedBoxHuid} disabled={!selectedPcb} onChange={e=>setSelectedBoxHuid(e.target.value)}>
                    <option value="">-- PILIH BOX --</option>
                    {boxOptions.map((b, i)=>(<option key={i} value={b.huid}>BOX {b.container_number} ({b.huid})</option>))}
                  </select>
              </div>
              <div style={{flex:1.5, background:'#f5f5f5', padding:20, borderRadius:8, display:'flex', justifyContent:'center'}} className="preview-box-render">
                  <RenderLabelComponent box={currentPrintData} />
              </div>
            </div>
        ) : (
            <div style={tableWrapper}>
            <table style={tableStyle}>
                <thead>
                  <tr style={{background:'#fafafa'}}>
                    {activeMenu === 'Master Lokasi' ? (
                        <><th style={thStyle}>LOKASI</th><th style={thStyle}>ZONE</th><th style={thStyle}>AISLE</th><th style={thStyle}>UNIQUE</th><th style={thStyle}>STATUS</th></>
                    ) : activeMenu === 'Reconciliation' ? (
                        <><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>DIFF</th><th style={thStyle}>STATUS</th></>
                    ) : activeMenu === 'Picking' ? (
                        <><th style={thStyle}>ID</th><th style={thStyle}>PRODUCT</th><th style={thStyle}>LOC</th><th style={thStyle}>QTY</th><th style={thStyle}>PICKER</th><th style={thStyle}>TIME</th><th style={thStyle}>STATUS</th></>
                    ) : activeMenu === 'Packing' ? (
                        <><th style={thStyle}>ID</th><th style={thStyle}>BOX #</th><th style={thStyle}>PRODUCT</th><th style={thStyle}>QTY</th><th style={thStyle}>PACKER</th><th style={thStyle}>TIME</th><th style={thStyle}>HUID</th><th style={thStyle}>STATUS</th></>
                    ) : activeMenu === 'Explorer' ? (
                        <><th style={thStyle}>SKU</th><th style={thStyle}>DESC</th><th style={thStyle}>REQ</th><th style={thStyle}>PICK</th><th style={thStyle}>PACK</th><th style={thStyle}>STATUS</th></>
                    ) : (
                        <><th style={thStyle}>LOCATION_ID</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>DESCRIPTION</th><th style={thStyle}>QTY</th><th style={thStyle}>TIMESTAMP (WIB)</th><th style={thStyle}>OPERATOR</th></>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, i)=>(
                    <tr key={i} style={{borderBottom:'1px solid #eee'}}>
                        {activeMenu === 'Master Lokasi' ? (
                            <><td style={tdStyle}>{row?.location_id}</td><td style={tdStyle}>{row?.zone}</td><td style={tdStyle}>{row?.aisle}</td><td style={tdStyle}>{row?.unique_id}</td><td style={{...tdStyle, color:row?.assign==='open'?'green':'red', fontWeight:800}}>{row?.assign?.toUpperCase()}</td></>
                        ) : activeMenu === 'Reconciliation' ? (
                            <><td style={tdStyle}>{row?.location_id}</td><td style={tdStyle}>{row?.artikel}</td><td style={tdStyle}>{row?.qty_snap}</td><td style={tdStyle}>{row?.qty_1st}</td><td style={tdStyle}>{row?.qty_2nd}</td><td style={{...tdStyle, color:'red', fontWeight:900}}>{(Number(row?.qty_2nd||row?.qty_1st||0) - Number(row?.qty_snap||0))}</td><td style={tdStyle}>{row?.final_status}</td></>
                        ) : activeMenu === 'Picking' ? (
                            <><td style={tdStyle}>{row?.id}</td><td style={tdStyle}>{row?.product_id}</td><td style={tdStyle}>{row?.location_id}</td><td style={tdStyle}>{row?.qty_actual}</td><td style={tdStyle}>{row?.picker_name}</td><td style={tdStyle}>{formatWIB(row?.scanned_at)}</td><td style={tdStyle}>{row?.status}</td></>
                        ) : activeMenu === 'Packing' ? (
                            <><td style={tdStyle}>{row?.id}</td><td style={tdStyle}>{row?.box_number}</td><td style={tdStyle}>{row?.product_id}</td><td style={tdStyle}>{row?.qty_packed}</td><td style={tdStyle}>{row?.scanned_by}</td><td style={tdStyle}>{formatWIB(row?.scanned_at)}</td><td style={tdStyle}>{row?.huid}</td><td style={tdStyle}>{row?.status}</td></>
                        ) : activeMenu === 'Explorer' ? (
                            <><td style={tdStyle}>{row?.sku}</td><td style={tdDescSmall}>{getDesc(row)}</td><td style={tdStyle}>{row?.qty_req}</td><td style={tdStyle}>{row?.qty_picked}</td><td style={tdStyle}>{row?.qty_packed}</td><td style={tdStyle}>{row?.status}</td></>
                        ) : (
                            <><td style={tdStyle}>{row?.location_id}</td><td style={tdStyle}>{row?.artikel}</td><td style={tdDescSmall}>{getDesc(row)}</td><td style={tdStyle}>{row?.qty_1st || row?.qty_2nd || row?.qty}</td><td style={tdStyle}>{formatWIB(row?.scanned_at || row?.timestamp)}</td><td style={tdStyle}>{row?.operator}</td></>
                        )}
                    </tr>
                  ))}
                </tbody>
            </table>
            </div>
        )}
      </div>

      {/* RENDER FOR REAL PRINT (HIDDEN ON SCREEN) */}
      <RenderLabelComponent box={currentPrintData} />

      {showAddForm && (
        <div style={popupOverlay}>
          <div style={{...popupContent, textAlign:'left', padding:30}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:15}}><h3 style={{fontWeight:900}}>ADD NEW</h3><button onClick={()=>setShowAddForm(false)} style={{border:'none', background:'none'}}><X size={20}/></button></div>
            <label style={labelStyle}>LOKASI ID</label><input style={mInput} value={newLoc.id} onChange={e=>setNewLoc({...newLoc, id: e.target.value})} />
            <div style={{display:'flex', gap:10}}>
               <div style={{flex:1}}><label style={labelStyle}>ZONE</label><input style={mInput} value={newLoc.zone} onChange={e=>setNewLoc({...newLoc, zone: e.target.value.toUpperCase()})} /></div>
               <div style={{flex:1}}><label style={labelStyle}>AISLE</label><input style={mInput} type="number" value={newLoc.aisle} onChange={e=>setNewLoc({...newLoc, aisle: e.target.value})} /></div>
            </div>
            <button onClick={async () => {
              try {
                await axios.post(`${API_BASE}?action=add_location`, { ...newLoc, location_id: newLoc.id.toUpperCase() });
                showToast("Added!"); setShowAddForm(false); fetchData();
              } catch (e) { showToast("Error!", "error"); }
            }} style={{...btnBlack, marginTop:10}}>SAVE LOCATION</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

/* ================= STYLES ================= */
const menuSectionLabel = { padding: '15px 20px 5px', fontSize: '0.55rem', fontWeight: 900, color: '#999', letterSpacing: '1px' };
const tabItem = (a) => ({ padding: '10px 15px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 800, color: a ? '#000' : '#ccc', borderBottom: a ? '2px solid #000' : 'none', display: 'flex', alignItems: 'center', gap: 5 });
const sidebarStyle = (m) => ({ width: m ? '0px' : '200px', display: m ? 'none' : 'block', borderRight: '1px solid #eee', height: '100vh', position: 'fixed', backgroundColor: '#fff', zIndex: 10 });
const contentArea = (m) => ({ flex: 1, marginLeft: m ? 0 : 200, padding: m ? '15px' : '30px' });
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
const navItem = (a) => ({ padding: '12px 20px', cursor: 'pointer', color: a ? '#000' : '#ccc', fontWeight: a ? '800' : '400', display:'flex', alignItems:'center', fontSize: '0.75rem' });
const tableWrapper = { border: '1px solid #eee', borderRadius: '4px', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { padding: '10px', fontSize: '0.65rem', color: '#999', borderBottom: '1px solid #eee', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const tdStyle = { padding: '10px', fontSize: '0.7rem', whiteSpace: 'nowrap' };
const tdDescSmall = { padding: '10px', fontSize: '0.65rem', color: '#999' };
const mInput = { width: '100%', padding: '12px', border: '1px solid #eee', marginBottom: '10px', borderRadius: '8px', fontFamily: 'Lexend', fontSize: '0.75rem', boxSizing: 'border-box' };
const btnBlack = { width: '100%', background: '#000', color: '#fff', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center' };
const btnWhite = { background: '#fff', border: '1px solid #eee', padding: '6px 12px', borderRadius: '4px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' };
const btnIcon = { background: '#fff', border: '1px solid #eee', padding: '6px', borderRadius: '4px', cursor: 'pointer' };
const btnLogout = { position: 'absolute', bottom: 20, width: '100%', border: 'none', background: 'none', color: 'red', fontWeight: 800 };
const loginPage = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f5f5f5' };
const loginCard = { width: '320px', background: '#fff', border: '1px solid #eee', borderRadius: '12px', textAlign: 'center', overflow:'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' };
const loginHeader = { background: '#000', color: '#fff', padding: '20px' };
const popupOverlay = { position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000 };
const popupContent = { background:'#fff', padding:40, borderRadius:24, textAlign:'center', width:'85%', maxWidth:'400px', boxShadow:'0 20px 40px rgba(0,0,0,0.2)' };
const toastStyle = (t) => ({ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: t === 'success' ? '#16a34a' : '#ef4444', color: '#fff', padding: '12px 25px', borderRadius: '50px', fontWeight: '800', zIndex: 9999, fontSize: '0.7rem' });
const labelStyle = { fontSize: '0.6rem', fontWeight: '800', color: '#999', marginBottom: '5px', display: 'block' };
const gridContainer = () => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(80px, 1fr))`, gap: '15px' });
const cardGrid = { border: '1px solid #eee', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '4px' };
const toggleContainer = (on) => ({ width: '34px', height: '18px', background: on ? '#000' : '#eee', borderRadius: '12px', position: 'relative', cursor: 'pointer' });
const toggleCircle = (on) => ({ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '19px' : '3px', transition: '0.2s' });
const searchContainer = { position: 'relative', marginBottom: '15px' };
const searchInput = { width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #eee', borderRadius: '8px', fontFamily: 'Lexend', fontSize: '0.7rem', boxSizing: 'border-box' };
const mainLayout = { display: 'flex', fontFamily: 'Lexend, sans-serif', backgroundColor: '#fff', minHeight: '100vh', fontSize: '0.7rem' };