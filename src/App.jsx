import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Barcode from 'react-barcode'; 
import QRCode from 'react-qr-code';   
import {
  RefreshCw, FileSpreadsheet, Trash2, LogOut, Upload, Search,
  ChevronLeft, ClipboardCheck, PackageCheck, BarChart3, Check, Plus, 
  Database as DbIcon, LayoutGrid, X, Truck, Package, Globe, Printer
} from 'lucide-react';

/* --- API ENDPOINTS --- */
const API_BASE = 'https://wms-neon-bridge.vercel.app/api/inventory';
const API_OUTBOUND = 'https://wms-neon-bridge.vercel.app/api/to_web'; 

function App() {
  /* ================= 1. STATE (V14 STANDARDIZED - UTUH) ================= */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [activeMenu, setActiveMenu] = useState('Master Lokasi');
  const [masterTab, setMasterTab] = useState('grid'); 
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [data, setData] = useState([]);
  const [snapData, setSnapData] = useState([]);
  const [reconCache, setReconCache] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [showMobileHome, setShowMobileHome] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedRows, setSelectedRows] = useState([]); 
  const [newLoc, setNewLoc] = useState({ id: '', zone: '', aisle: '', unique: '', assign: 'closed' });

  /* Mobile States */
  const [mobLoc, setMobLoc] = useState('');
  const [mobArt, setMobArt] = useState('');
  const [mobQty, setMobQty] = useState('');
  const [locInfo, setLocInfo] = useState(null);
  const [selectedLoc2nd, setSelectedLoc2nd] = useState(null);
  const [showCompletePopup, setShowCompletePopup] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  /* Print Label States (Double Filter) */
  const [selectedPcb, setSelectedPcb] = useState('');
  const [selectedBoxHuid, setSelectedBoxHuid] = useState('');
  const [boxOptions, setBoxOptions] = useState([]);

  const inputLocRef = useRef(null);
  const inputArtRef = useRef(null);
  const inputQtyRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* --- Logika Unique ID Otomatis (V14) --- */
  useEffect(() => {
    if (newLoc.id && newLoc.zone && newLoc.aisle) {
      setNewLoc(prev => ({ ...prev, unique: `${prev.zone.toUpperCase()}-${prev.aisle}` }));
    }
  }, [newLoc.id, newLoc.zone, newLoc.aisle]);

  /* ================= 2. UTILS ================= */
  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };

  const getDesc = (item) => {
    if (!item) return '-';
    return item.description || item.DESCRIPTION || item.desc || item.nama_barang || '-';
  };

  const formatWIB = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  };

  /* ================= 3. FETCHING (INTEGRATED) ================= */
  const fetchData = async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const outboundMenus = ['Picking', 'Packing', 'Explorer', 'Print Label'];
      const targetMap = {
        'Master Lokasi': masterTab === 'database' ? 'master_all' : 'master',
        'Snapshoot': 'snapshot_list',
        '1st Count': 'first', 
        '2nt Count': 'second', 
        'Reconciliation': 'recon',
        'Picking': 'picking_transactions',
        'Packing': 'packing_transactions',
        'Explorer': 'outbound_explorer',
        'Print Label': 'packing_transactions'
      };

      const currentAPI = outboundMenus.includes(activeMenu) ? API_OUTBOUND : API_BASE;
      const res = await axios.get(`${currentAPI}?action=get_data&target=${targetMap[activeMenu]}`);
      const rawRes = res.data?.data || [];

      if (activeMenu === 'Print Label') {
        const grouped = rawRes.reduce((acc, curr) => {
          if (!acc[curr.huid]) acc[curr.huid] = { ...curr, item_details: [] };
          acc[curr.huid].item_details.push({ sku: curr.product_id, name: curr.description, qty: curr.qty_packed });
          return acc;
        }, {});
        setData(Object.values(grouped));
      } else {
        setData(rawRes);
      }
      
      axios.get(`${API_BASE}?action=get_data&target=snapshot_list`).then(rs => setSnapData(rs.data?.data || []));
      axios.get(`${API_BASE}?action=get_data&target=recon`).then(rr => setReconCache(rr.data?.data || []));

    } catch (e) { setData([]); }
    finally { setLoading(false); setSelectedRows([]); }
  };

  useEffect(() => { fetchData(); }, [activeMenu, masterTab, isLoggedIn]);

  /* ================= 4. PRINT COMPONENT (PRECISION) ================= */
  const currentPrintData = useMemo(() => {
    return data.find(b => b.huid === selectedBoxHuid);
  }, [selectedBoxHuid, data]);

  const PrintLayout = ({ box, isPreview = false }) => {
    if (!box) return isPreview ? <div style={{padding:20, color:'#ccc'}}>Pilih data untuk melihat preview</div> : null;
    const pages = [];
    const items = box.item_details || [];
    for (let i = 0; i < items.length; i += 12) pages.push(items.slice(i, i + 12));

    return (
      <div className={isPreview ? "preview-wrap" : "print-only-wrap"}>
        {pages.map((pItems, idx) => (
          <div key={idx} className="label-v16">
            <div className="unboxing-banner">WAJIB VIDEO UNBOXING - KOMPLAIN TANPA VIDEO TIDAK DILAYANI</div>
            <div className="label-header">
               <div className="pt-info">
                  <div className="pt-name">PT DUA PULUH TIGA</div>
                  <div className="pt-address">Jl. kopo Bihbul Raya no 68<br/>Kab. Bandung</div>
               </div>
               <div className="huid-info">
                  <div className="huid-text">HUID: <b>{box.huid}</b></div>
                  <QRCode value={box.huid || ''} size={48} />
               </div>
            </div>
            <div className="border-black-thick" />
            <div className="store-grid">
               <div className="grid-item"><b>{box.picklist_number}</b></div>
               <div className="grid-item"><b>{box.nama_toko || '-'}</b></div>
               <div className="grid-item"><b>{box.alamat_toko || '-'}</b></div>
            </div>
            <div className="border-black-thick" />
            <div className="content-header">
               <span>BOX CONTENT</span>
               <span style={{float:'right'}}>BOX {box.container_number} ({idx+1}/{pages.length})</span>
            </div>
            <table className="content-table-print">
               <thead><tr><th>Artikel</th><th>Description</th><th>Qty</th></tr></thead>
               <tbody>
                  {pItems.map((it, k) => (
                    <tr key={k}>
                      <td>{it.sku}</td>
                      <td className="truncate-cell">{it.name || '-'}</td>
                      <td style={{textAlign:'center'}}>{it.qty}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
            <div className="border-black-thick" style={{marginTop:'auto'}} />
            <div className="footer-summary-print">
               <div className="footer-row-print">
                  <span><span className="red-label-print">Packer :</span> <b>{box.scanned_by}</b></span>
                  <span><span className="red-label-print">Total Qty:</span> <b>{box.qty_packed} PCS</b></span>
               </div>
               <div className="footer-row-print">
                  <span><span className="red-label-print">Tanggal :</span> <b>{box.scanned_at?.substring(0,10)}</b></span>
                  <span><span className="red-label-print">Berat :</span> <b>{box.weight_kg || '0.0'} KG</b></span>
               </div>
            </div>
            <div className="barcode-area-print">
               <div className="sj-title-print">NO SJ : {box.no_sj || box.picklist_number}</div>
               <Barcode value={box.no_sj || box.picklist_number || ''} width={1.8} height={45} fontSize={0} margin={0} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* ================= 5. HANDLERS ================= */
  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data?.status === 'success') { setUser(res.data.user); setIsLoggedIn(true); }
      else showToast("Password/User Salah", "error");
    } catch (e) { showToast("Server Error", "error"); }
    finally { setLoginLoading(false); }
  };

  const handlePcbChange = (e) => {
    const pcb = e.target.value;
    setSelectedPcb(pcb);
    setBoxOptions(data.filter(b => b.picklist_number === pcb));
    setSelectedBoxHuid('');
  };

  const handleSaveInput = async () => {
    if (!mobLoc || !mobQty || !mobArt) return showToast("Data Kurang", "error");
    const locU = mobLoc.trim().toUpperCase();
    const artU = mobArt.trim().toUpperCase();
    if (activeMenu === '1st Count' && data.some(d => String(d.location_id).toUpperCase() === locU && String(d.artikel).toUpperCase() === artU)) {
        return showToast("BARANG SUDAH DISCAN!", "error");
    }
    if (activeMenu === '2nt Count' && selectedLoc2nd) {
      if (locU !== selectedLoc2nd.location_id.toUpperCase() || artU !== selectedLoc2nd.artikel.toUpperCase()) {
        return showToast("Validasi Gagal!", "error");
      }
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE}?action=save_input`, { location_id: locU, artikel: artU, qty: parseInt(mobQty), operator: user?.username, target_table: activeMenu });
      showToast("Tersimpan!"); setMobArt(''); setMobQty(''); 
      if (activeMenu === '1st Count' && locInfo) {
          const remain = locInfo.filter(item => !data.some(d => d.location_id === locU && d.artikel === item.artikel) && item.artikel !== artU);
          if (remain.length === 0) { setShowCompletePopup(true); setMobLoc(''); setLocInfo(null); }
      }
      fetchData(); 
      if (inputArtRef.current) setTimeout(() => inputArtRef.current.focus(), 50);
    } catch (e) { showToast("Gagal Simpan", "error"); }
    finally { setLoading(false); }
  };

  /* ================= 6. RENDER UI ================= */
  if (!isLoggedIn) {
    return (
      <div style={loginPage}>
        {toast.show && <div style={toastStyle(toast.type)}>{toast.msg}</div>}
        <div style={loginCard}>
          <div style={loginHeader}><h2>COOL SYSTEM</h2><p>LOGISTICS MANAGEMENT</p></div>
          <div style={{padding:'30px'}}>
            <input placeholder="Username" style={mInput} value={username} onChange={e=>setUsername(e.target.value)} />
            <input type="password" placeholder="Password" style={mInput} value={password} onChange={e=>setPassword(e.target.value)} />
            <button onClick={handleLogin} style={btnBlack}>{loginLoading ? <Loader2 className="animate-spin" size={18}/> : "LOGIN"}</button>
          </div>
        </div>
      </div>
    );
  }

  if (isMobile && showMobileHome) {
    const b1 = (reconCache || []).filter(d => d.final_status === 'NEED 1ST COUNT').length;
    const b2 = (reconCache || []).filter(d => d.final_status === 'NEED 2ND COUNT').length;
    return (
      <div style={mobileHomeLayout}>
        {toast.show && <div style={toastStyle(toast.type)}>{toast.msg}</div>}
        <div style={mobileHeader}><h2>COOL MOBILE</h2><p>{user?.full_name}</p></div>
        <div style={mobileMenuGrid}>
          <div style={menuCard} onClick={() => { setActiveMenu('1st Count'); setShowMobileHome(false); }}>
            <div style={{position:'relative'}}><ClipboardCheck size={28}/>{b1 > 0 && <div style={badgeStyle}>{b1}</div>}</div>
            <span style={menuText}>1st Count</span>
          </div>
          <div style={menuCard} onClick={() => { setActiveMenu('2nt Count'); setShowMobileHome(false); }}>
            <div style={{position:'relative'}}><PackageCheck size={28}/>{b2 > 0 && <div style={badgeStyle}>{b2}</div>}</div>
            <span style={menuText}>2nd Count</span>
          </div>
          <div style={menuCard} onClick={() => { setActiveMenu('Reconciliation'); setShowMobileHome(false); }}>
            <BarChart3 size={28} /> <span style={menuText}>Reconcile</span>
          </div>
        </div>
        <button onClick={()=>setIsLoggedIn(false)} style={btnLogoutMobile}>Logout System</button>
      </div>
    );
  }

  const filteredData = (data || []).filter(item => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const id = String(item.id || item.location_id || item.unique_id || item.picklist_number || '').toLowerCase();
    const art = String(item.artikel || item.product_id || '').toLowerCase();
    return id.includes(s) || art.includes(s) || getDesc(item).toLowerCase().includes(s);
  });

  return (
    <div style={mainLayout}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only-wrap { display: block !important; position: absolute; left: 0; top: 0; width: 10cm; }
          .label-v16 { 
            width: 10cm; height: 10cm; padding: 1mm; box-sizing: border-box; 
            page-break-after: always; background: white; font-family: sans-serif;
            display: flex; flex-direction: column; border: 0.1mm solid #eee;
          }
          .unboxing-banner { background: #FF0000; color: #fff; text-align: center; font-size: 8pt; font-weight: bold; padding: 4px; }
          .label-header { display: flex; justify-content: space-between; padding: 4px 2px; }
          .pt-name { font-weight: 900; font-size: 13pt; }
          .pt-address { font-size: 8pt; line-height: 1.1; }
          .huid-text { font-size: 9pt; margin-bottom: 2px; text-align: right; }
          .border-black-thick { height: 2px; background: #000; margin: 2px 0; }
          .store-grid { display: grid; grid-template-columns: 1fr 1.5fr 1fr; border: 1.5px solid #000; }
          .grid-item { border-right: 1.5px solid #000; padding: 4px; font-size: 8pt; font-weight: bold; text-align: center; display: flex; align-items: center; justify-content: center; }
          .grid-item:last-child { border-right: none; }
          .content-table-print { width: 100%; border-collapse: collapse; font-size: 8pt; }
          .content-table-print th { background: #eee; text-align: left; padding: 2px; border: 0.5px solid #000; }
          .content-table-print td { padding: 2px; border: 0.5px solid #ccc; }
          .truncate-cell { max-width: 4cm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
          .footer-summary-print { padding: 4px; font-size: 8pt; }
          .footer-row-print { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .red-label-print { color: #FF0000; font-weight: bold; }
          .barcode-area-print { text-align: center; margin-top: auto; padding-bottom: 2mm; }
          .sj-title-print { font-weight: bold; font-size: 10pt; margin-bottom: 2px; }
        }
        .print-only-wrap { display: none; }
        .preview-wrap .label-v16 { 
            width: 10cm; height: 10cm; background: white; border: 1px solid #ddd; 
            box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin: 10px auto; 
            display: flex; flex-direction: column; padding: 1mm; zoom: 0.8;
        }
        .preview-wrap .unboxing-banner { background: #FF0000; color: #fff; text-align: center; font-size: 8pt; font-weight: bold; padding: 4px; }
        .preview-wrap .pt-name { font-weight: 900; font-size: 13pt; }
        .preview-wrap .pt-address { font-size: 8pt; line-height: 1.1; }
        .preview-wrap .border-black-thick { height: 2px; background: #000; margin: 2px 0; }
        .preview-wrap .store-grid { display: grid; grid-template-columns: 1fr 1.5fr 1fr; border: 1.5px solid #000; }
        .preview-wrap .grid-item { border-right: 1.5px solid #000; padding: 4px; font-size: 8pt; font-weight: bold; text-align: center; }
        .preview-wrap .content-table-print { width: 100%; border-collapse: collapse; font-size: 8pt; }
        .preview-wrap .content-table-print th { background: #eee; text-align: left; padding: 2px; border: 0.5px solid #000; }
        .preview-wrap .content-table-print td { padding: 2px; border: 0.5px solid #ccc; }
        .preview-wrap .red-label-print { color: #FF0000; font-weight: bold; }
        .preview-wrap .barcode-area-print { text-align: center; margin-top: auto; }
      `}</style>

      {toast.show && <div style={toastStyle(toast.type)}>{toast.msg}</div>}
      
      {!isMobile && (
        <nav style={sidebarStyle()} className="no-print">
          <div style={{ padding: 20, fontWeight: 900 }}>COOL SYSTEM</div>
          <div style={menuSectionLabel}>INVENTORY</div>
          {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
            <div key={m} onClick={() => { setActiveMenu(m); setMasterTab('grid'); }} style={navItem(activeMenu === m)}>{m}</div>
          ))}
          <div style={menuSectionLabel}>OUTBOUND</div>
          {['Picking', 'Packing', 'Explorer', 'Print Label'].map(m => (
            <div key={m} onClick={() => setActiveMenu(m)} style={navItem(activeMenu === m)}>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  {m === 'Picking' && <Truck size={14}/>}
                  {m === 'Packing' && <Package size={14}/>}
                  {m === 'Explorer' && <Globe size={14}/>}
                  {m === 'Print Label' && <Printer size={14}/>}
                  {m}
                </div>
            </div>
          ))}
          <button onClick={() => setIsLoggedIn(false)} style={btnLogout}><LogOut size={14} /></button>
        </nav>
      )}

      <div style={contentArea(isMobile)} className="no-print">
        <header style={headerStyle}>
          <div style={{ fontWeight: '800' }}>{activeMenu.toUpperCase()}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isMobile && (
              <>
                {activeMenu === 'Master Lokasi' && masterTab === 'database' && (
                  <button onClick={()=>setShowAddForm(true)} style={{...btnWhite, background:'#000', color:'#fff'}}><Plus size={12}/> ADD NEW</button>
                )}
                {activeMenu === 'Snapshoot' && (
                   <label style={{...btnWhite, background:'#000', color:'#fff', cursor:'pointer'}}><Upload size={12}/> UPLOAD SNAP <input type="file" hidden onChange={handleFileUpload}/></label>
                )}
                {/* --- TOMBOL CLEAR V14 BASED --- */}
                {['1st Count', '2nt Count', 'Snapshoot'].includes(activeMenu) && (
                   <button onClick={() => { if(window.confirm("Hapus data?")) axios.post(`${API_BASE}?action=clear_${activeMenu.includes('1st')?'first':activeMenu.includes('2nt')?'second':'snap'}`).then(()=>fetchData()); }} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> CLEAR</button>
                )}
                {activeMenu === 'Print Label' && selectedBoxHuid && (
                  <button onClick={() => window.print()} style={{...btnWhite, background:'#800000', color:'#fff'}}><Printer size={12}/> PRINT NOW</button>
                )}
                <button onClick={() => {
                  const ws = XLSX.utils.json_to_sheet(data);
                  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Data");
                  XLSX.writeFile(wb, `COOL_${activeMenu}.xlsx`);
                }} style={{...btnWhite, color:'#16a34a'}}><FileSpreadsheet size={12}/> EXPORT</button>
              </>
            )}
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading?'animate-spin':''}/></button>
          </div>
        </header>

        {/* TAB SWITCHER PC */}
        {!isMobile && activeMenu === 'Master Lokasi' && (
          <div style={{display:'flex', gap:15, marginBottom:20, borderBottom:'1px solid #eee'}}>
             <div onClick={()=>setMasterTab('grid')} style={tabItem(masterTab === 'grid')}><LayoutGrid size={14}/> ASSIGN CC</div>
             <div onClick={()=>setMasterTab('database')} style={tabItem(masterTab === 'database')}><DbIcon size={14}/> DATABASE LOKASI</div>
          </div>
        )}

        {!(isMobile && (activeMenu === '1st Count' || activeMenu === '2nt Count')) && (
            <div style={searchContainer}><Search size={14} style={{position:'absolute', left: 10, top: 12, color:'#999'}} /><input placeholder="Cari data..." style={searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        )}

        {/* --- DYNAMIC RENDERER --- */}
        {!isMobile && activeMenu === 'Master Lokasi' && masterTab === 'grid' ? (
           <div style={gridContainer()}>
              {filteredData.map((row, idx) => (
                <div key={idx} style={cardGrid}>
                  <span style={{ fontWeight: 800, marginBottom: 5 }}>{row.unique_id}</span>
                  <div onClick={() => axios.post(`${API_BASE}?action=assign_location`, { unique_id: row.unique_id, status: row.assign==='open'?'closed':'open' }).then(()=>fetchData())} style={toggleContainer(row.assign === 'open')}><div style={toggleCircle(row.assign === 'open')} /></div>
                </div>
              ))}
           </div>
        ) : activeMenu === 'Print Label' ? (
           <div style={{display:'flex', gap:20, flexDirection: isMobile ? 'column':'row'}}>
              <div style={{flex:1}}>
                 <label style={labelStyle}>1. NOMOR PCB / PICKLIST:</label>
                 <select style={mInput} value={selectedPcb} onChange={handlePcbChange}>
                    <option value="">-- PILIH PCB --</option>
                    {[...new Set(data.map(b => b.picklist_number))].map((p, i) => <option key={i} value={p}>{p}</option>)}
                 </select>
                 <label style={labelStyle}>2. BOX / KARUNG:</label>
                 <select style={mInput} value={selectedBoxHuid} disabled={!selectedPcb} onChange={e=>setSelectedBoxHuid(e.target.value)}>
                    <option value="">-- PILIH BOX --</option>
                    {boxOptions.map((b, i)=>(<option key={i} value={b.huid}>BOX {b.container_number} ({b.huid})</option>))}
                 </select>
              </div>
              <div style={{flex:1.5, background:'#f5f5f5', padding:20, borderRadius:8, display:'flex', justifyContent:'center', minHeight: '500px'}}>
                 <PrintLayout box={currentPrintData} isPreview={true} />
              </div>
           </div>
        ) : (
           (!isMobile || activeMenu === 'Reconciliation' || ['Picking','Packing','Explorer','2nt Count'].includes(activeMenu)) && (
             <div style={tableWrapper}>
                <table style={tableStyle}>
                    <thead>
                      <tr style={{background:'#fafafa'}}>
                        {activeMenu === 'Master Lokasi' && masterTab === 'database' && (
                            <th style={thStyle}><input type="checkbox" onChange={(e) => e.target.checked ? setSelectedRows(filteredData.map(d=>d.unique_id)) : setSelectedRows([]) } /></th>
                        )}
                        {activeMenu === 'Reconciliation' ? (
                            <><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>DIFF</th><th style={thStyle}>STATUS</th></>
                        ) : activeMenu === 'Packing' ? (
                            <><th style={thStyle}>ID</th><th style={thStyle}>BOX</th><th style={thStyle}>PICKLIST</th><th style={thStyle}>PRODUCT</th><th style={thStyle}>QTY</th><th style={thStyle}>TIME</th></>
                        ) : activeMenu === '2nt Count' ? (
                            <><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>QTY INPUT</th><th style={thStyle}>OPERATOR</th></>
                        ) : activeMenu === 'Master Lokasi' ? (
                            <><th style={thStyle}>LOKASI</th><th style={thStyle}>ZONE</th><th style={thStyle}>AISLE</th><th style={thStyle}>UNIQUE</th><th style={thStyle}>STATUS</th></>
                        ) : (
                            <><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>QTY</th><th style={thStyle}>DESC</th></>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                    {filteredData.map((row, i)=>(
                        <tr key={i} style={{borderBottom:'1px solid #eee'}}>
                            {activeMenu === 'Master Lokasi' && masterTab === 'database' && (
                                <td style={tdStyle}><input type="checkbox" checked={selectedRows.includes(row.unique_id)} onChange={() => setSelectedRows(p => p.includes(row.unique_id) ? p.filter(x => x !== row.unique_id) : [...p, row.unique_id])} /></td>
                            )}
                            {activeMenu === 'Reconciliation' ? (
                                <><td style={tdStyle}>{row.location_id}</td><td style={tdStyle}>{row.artikel}</td><td style={tdStyle}>{row.qty_snap}</td><td style={tdStyle}>{row.qty_1st}</td><td style={tdStyle}>{row.qty_2nd}</td><td style={{...tdStyle, color:'red', fontWeight:900}}>{(Number(row.qty_2nd||row.qty_1st||0) - Number(row.qty_snap||0))}</td><td style={tdStyle}>{row.final_status}</td></>
                            ) : activeMenu === 'Packing' ? (
                                <><td style={tdStyle}>{row.id}</td><td style={tdStyle}>{row.container_number}</td><td style={tdStyle}>{row.picklist_number}</td><td style={tdStyle}>{row.product_id}</td><td style={tdStyle}>{row.qty_packed}</td><td style={tdStyle}>{formatWIB(row.scanned_at)}</td></>
                            ) : activeMenu === '2nt Count' ? (
                                <><td style={tdStyle}>{row.location_id}</td><td style={tdStyle}>{row.artikel}</td><td style={tdStyle}>{row.qty}</td><td style={tdStyle}>{row.operator}</td></>
                            ) : activeMenu === 'Master Lokasi' ? (
                                <><td style={tdStyle}>{row.location_id}</td><td style={tdStyle}>{row.zone}</td><td style={tdStyle}>{row.aisle}</td><td style={tdStyle}>{row.unique_id}</td><td style={{...tdStyle, color:row.assign==='open'?'green':'red', fontWeight:800}}>{row.assign?.toUpperCase()}</td></>
                            ) : (
                                <><td style={tdStyle}>{row.location_id || row.unique_id}</td><td style={tdStyle}>{row.artikel}</td><td style={tdStyle}>{row.qty_snap || row.qty_1st}</td><td style={tdDescSmall}>{getDesc(row)}</td></>
                            )}
                        </tr>
                    ))}
                    </tbody>
                </table>
             </div>
           )
        )}

        {/* MOBILE FORMS (V14 UTUH) */}
        {isMobile && activeMenu === '1st Count' && (
          <div style={formWrapper}>
             {locInfo && (
                <div style={boxInfo}>
                  {locInfo.map((it, idx)=>(
                    <div key={idx} style={{display:'flex', justifyContent:'space-between', padding:'5px 0'}}>
                       <div><b>{it.artikel}</b><br/><span style={{fontSize:'0.6rem'}}>{getDesc(it)}</span></div>
                       {data.some(d=>String(d.location_id).toUpperCase()===mobLoc.toUpperCase() && d.artikel===it.artikel) && <Check size={16} color="green"/>}
                    </div>
                  ))}
                </div>
             )}
             <label style={labelStyle}>SCAN LOKASI</label>
             <input ref={inputLocRef} value={mobLoc} style={mInput} autoFocus onChange={e=>{const v=e.target.value.toUpperCase(); setMobLoc(v); if(v.length>=8){setLocInfo(snapData.filter(d=>String(d.location_id).toUpperCase()===v)); inputArtRef.current?.focus();}}} />
             <label style={labelStyle}>SCAN ARTIKEL</label>
             <input ref={inputArtRef} value={mobArt} style={mInput} onChange={e=>{const v=e.target.value.toUpperCase(); setMobArt(v); if(v.length>=12) inputQtyRef.current?.focus();}} />
             <label style={labelStyle}>QTY</label>
             <input ref={inputQtyRef} type="number" style={qtyInput} value={mobQty} onChange={e=>setMobQty(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleSaveInput()} />
             <button onClick={handleSaveInput} style={btnBlack}>SIMPAN DATA</button>
          </div>
        )}

        {isMobile && activeMenu === '2nt Count' && (
           <div style={{display:'flex', flexDirection:'column', gap:10}}>
              <select style={mInput} onChange={e=>{const [l,a]=e.target.value.split('|'); setSelectedLoc2nd((reconCache || []).find(d=>d.location_id===l && d.artikel===a)); setMobLoc(''); setMobArt('');}}>
                 <option value="">-- PILIH NEED 2ND --</option>
                 {(reconCache || []).filter(d=>d.final_status==='NEED 2ND COUNT').map((t,i)=>(<option key={i} value={`${t.location_id}|${t.artikel}`}>{t.location_id} | {t.artikel}</option>))}
              </select>
              {selectedLoc2nd && (
                <div style={formWrapper}>
                   <div style={boxInfoYellow}>
                      <b>{selectedLoc2nd.artikel}</b><br/>
                      <span style={{fontSize:'0.65rem'}}>{getDesc(selectedLoc2nd)}</span><br/>
                      Snap: {selectedLoc2nd.qty_snap} | 1st: {selectedLoc2nd.qty_1st}
                   </div>
                   <input value={mobLoc} style={mInput} placeholder="LOKASI" onChange={e=>{setMobLoc(e.target.value.toUpperCase()); if(e.target.value.toUpperCase()===selectedLoc2nd.location_id) inputArtRef.current?.focus();}} />
                   <input ref={inputArtRef} value={mobArt} style={mInput} placeholder="ARTIKEL" onChange={e=>{setMobArt(e.target.value.toUpperCase()); if(e.target.value.toUpperCase()===selectedLoc2nd.artikel) inputQtyRef.current?.focus();}} />
                   <input ref={inputQtyRef} type="number" style={qtyInput} value={mobQty} onChange={e=>setMobQty(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleSaveInput()} />
                   <button onClick={handleSaveInput} disabled={mobLoc!==selectedLoc2nd.location_id} style={btnBlack}>SAVE 2ND COUNT</button>
                </div>
              )}
           </div>
        )}
      </div>

      {/* POPUP SUKSES */}
      {showCompletePopup && (
        <div style={popupOverlay} onClick={()=>setShowCompletePopup(false)}>
          <div style={popupContent}>
            <div style={circleCheck}><Check size={40} color="#fff" /></div>
            <h2 style={{fontWeight:900, marginTop:10}}>LOKASI SELESAI!</h2>
            <button style={{...btnBlack, marginTop:20}} onClick={()=>setShowCompletePopup(false)}>LANJUT</button>
          </div>
        </div>
      )}

      {/* POPUP ADD NEW */}
      {showAddForm && (
        <div style={popupOverlay}>
          <div style={{...popupContent, textAlign:'left', padding:30}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:15}}><h3 style={{fontWeight:900}}>ADD NEW</h3><button onClick={()=>setShowAddForm(false)} style={{border:'none', background:'none'}}><X size={20}/></button></div>
            <label style={labelStyle}>LOKASI ID</label><input style={mInput} value={newLoc.id} onChange={e=>setNewLoc({...newLoc, id: e.target.value})} />
            <div style={{display:'flex', gap:10}}>
              <div style={{flex:1}}><label style={labelStyle}>ZONE</label><input style={mInput} value={newLoc.zone} onChange={e=>setNewLoc({...newLoc, zone: e.target.value.toUpperCase()})} /></div>
              <div style={{flex:1}}><label style={labelStyle}>AISLE</label><input style={mInput} type="number" value={newLoc.aisle} onChange={e=>setNewLoc({...newLoc, aisle: e.target.value})} /></div>
            </div>
            <label style={labelStyle}>UNIQUE ID</label><input style={{...mInput, background:'#f5f5f5'}} value={newLoc.unique} readOnly />
            <button onClick={async () => {
              try {
                await axios.post(`${API_BASE}?action=add_location`, { ...newLoc, location_id: newLoc.id.toUpperCase() });
                showToast("Added!"); setShowAddForm(false); fetchData();
              } catch (e) { showToast("Error!", "error"); }
            }} style={{...btnBlack, marginTop:10}}>SAVE LOCATION</button>
          </div>
        </div>
      )}

      {/* PRINT LAYER (STRICT) */}
      <PrintLayout box={currentPrintData} isPreview={false} />
    </div>
  );
}

/* ================= STYLES ================= */
const menuSectionLabel = { padding: '15px 20px 5px', fontSize: '0.55rem', fontWeight: 900, color: '#999', letterSpacing: '1px' };
const tabItem = (a) => ({ padding: '10px 15px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 800, color: a ? '#000' : '#ccc', borderBottom: a ? '2px solid #000' : 'none', display: 'flex', alignItems: 'center', gap: 5 });
const searchContainer = { position: 'relative', marginBottom: '15px' };
const searchInput = { width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #eee', borderRadius: '8px', fontFamily: 'Lexend', fontSize: '0.7rem', boxSizing: 'border-box' };
const mainLayout = { display: 'flex', fontFamily: 'Lexend, sans-serif', backgroundColor: '#fff', minHeight: '100vh', fontSize: '0.7rem' };
const sidebarStyle = () => ({ width: 180, borderRight: '1px solid #eee', height: '100vh', position: 'fixed', backgroundColor: '#fff', zIndex: 10 });
const contentArea = (m) => ({ flex: 1, marginLeft: m ? 0 : 180, padding: m ? '15px' : '30px' });
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
const navItem = (a) => ({ padding: '12px 20px', cursor: 'pointer', color: a ? '#000' : '#ccc', fontWeight: a ? '800' : '400', display:'flex', alignItems:'center', fontSize: '0.7rem' });
const tableWrapper = { border: '1px solid #eee', borderRadius: '4px', overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { padding: '10px', fontSize: '0.6rem', color: '#999', borderBottom: '1px solid #eee', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const tdStyle = { padding: '10px', fontSize: '0.65rem', whiteSpace: 'nowrap' };
const tdDescSmall = { padding: '10px', fontSize: '0.65rem', color: '#999' };
const mInput = { width: '100%', padding: '12px', border: '1px solid #eee', marginBottom: '10px', borderRadius: '8px', fontFamily: 'Lexend', fontSize: '0.75rem', boxSizing: 'border-box' };
const qtyInput = { ...mInput, fontSize: '1.8rem', fontWeight: 900, textAlign: 'center' };
const btnBlack = { width: '100%', background: '#000', color: '#fff', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center' };
const btnWhite = { background: '#fff', border: '1px solid #eee', padding: '6px 12px', borderRadius: '4px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' };
const btnIcon = { background: '#fff', border: '1px solid #eee', padding: '6px', borderRadius: '4px', cursor: 'pointer' };
const btnLogout = { position: 'absolute', bottom: 20, width: '100%', border: 'none', background: 'none', color: 'red', fontWeight: 800 };
const loginPage = { height: '100vh', display: 'flex', flexDirection:'column', justifyContent: 'center', alignItems: 'center', background: '#f5f5f5' };
const loginCard = { width: '320px', background: '#fff', border: '1px solid #eee', borderRadius: '12px', textAlign: 'center', overflow:'hidden', boxShadow:'0 10px 30px rgba(0,0,0,0.05)' };
const loginHeader = { background: '#000', color: '#fff', padding: '20px' };
const mobileHomeLayout = { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100vh', backgroundColor: '#fff', fontFamily: 'Lexend' };
const mobileHeader = { padding: '30px', textAlign: 'center', borderBottom: '1px solid #eee', width: '100%' };
const mobileMenuGrid = { display: 'grid', gridTemplateColumns: '1fr', gap: '15px', padding: '20px', width: '100%', boxSizing: 'border-box' };
const menuCard = { display: 'flex', alignItems: 'center', padding: '25px', border: '1px solid #eee', borderRadius: '12px', gap: '20px', cursor: 'pointer' };
const menuText = { fontWeight: '900', fontSize: '1.1rem' };
const btnLogoutMobile = { margin: '30px', border: 'none', background: 'none', color: 'red', fontWeight: 800, cursor: 'pointer' };
const formWrapper = { border: '1px solid #eee', padding: '15px', borderRadius: '8px', background: '#fafafa' };
const boxInfo = { background: '#f0f7ff', padding: '10px', marginBottom: '10px', borderRadius: '6px', fontSize: '0.65rem', border: '1px solid #cce5ff' };
const boxInfoYellow = { ...boxInfo, background: '#fffbeb', border: '1px solid #fde68a' };
const boxTitle = { fontWeight: '900', fontSize: '0.55rem', marginBottom: '5px', color: '#1e40af' };
const popupOverlay = { position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000 };
const popupContent = { background:'#fff', padding:40, borderRadius:24, textAlign:'center', width:'85%', maxWidth:'400px', boxShadow:'0 20px 40px rgba(0,0,0,0.2)' };
const toastStyle = (t) => ({ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: t === 'success' ? '#16a34a' : '#ef4444', color: '#fff', padding: '12px 25px', borderRadius: '50px', fontWeight: '800', zIndex: 9999, fontSize: '0.7rem' });
const circleCheck = { width: 60, height: 60, borderRadius: 30, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' };
const badgeStyle = { position:'absolute', top:-5, right:-10, background:'red', color:'white', fontSize:'0.6rem', minWidth:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, border:'2px solid #fff' };
const labelStyle = { fontSize: '0.6rem', fontWeight: '800', color: '#999', marginBottom: '5px', display: 'block' };
const gridContainer = () => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(80px, 1fr))`, gap: '15px' });
const cardGrid = { border: '1px solid #eee', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '4px' };
const toggleContainer = (on) => ({ width: '34px', height: '18px', background: on ? '#000' : '#eee', borderRadius: '12px', position: 'relative', cursor: 'pointer' });
const toggleCircle = (on) => ({ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '19px' : '3px', transition: '0.2s' });

export default App;