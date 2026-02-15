import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Barcode from 'react-barcode'; 
import QRCode from 'react-qr-code';   
import {
  RefreshCw, FileSpreadsheet, Trash2, LogOut, Upload, Search,
  ChevronLeft, ClipboardCheck, PackageCheck, BarChart3, Download,
  CheckCircle2, Loader2, Check, Plus, Database as DbIcon, LayoutGrid, X,
  Truck, Package, Globe, Printer
} from 'lucide-react';

const API_BASE = 'https://wms-neon-bridge.vercel.app/api/inventory';
const API_OUTBOUND = 'https://wms-neon-bridge.vercel.app/api/to_web'; 

function App() {
  /* ================= 1. STATE (KOMPLIT) ================= */
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

  /* Print Label State */
  const [selectedBoxPrint, setSelectedBoxPrint] = useState(null);

  const inputLocRef = useRef(null);
  const inputArtRef = useRef(null);
  const inputQtyRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* --- Logika Unique ID Otomatis --- */
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

  /* ================= 3. FETCHING (SAFETY FIRST) ================= */
  const fetchData = async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const outboundMenus = ['Picking', 'Packing', 'Explorer', 'Print Label'];
      const currentAPI = outboundMenus.includes(activeMenu) ? API_OUTBOUND : API_BASE;

      const targetMap = {
        'Master Lokasi': masterTab === 'database' ? 'master_all' : 'master',
        'Snapshoot': 'snapshot_list',
        '1st Count': 'first', 
        '2nt Count': isMobile ? 'recon' : 'second', 
        'Reconciliation': 'recon',
        'Picking': 'picking_transactions',
        'Packing': 'packing_transactions',
        'Explorer': 'outbound_explorer',
        'Print Label': 'packing_transactions'
      };

      const res = await axios.get(`${currentAPI}?action=get_data&target=${targetMap[activeMenu]}`);
      const rawRes = Array.isArray(res.data?.data) ? res.data.data : [];

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
      
      // Load cache inventory data
      axios.get(`${API_BASE}?action=get_data&target=snapshot_list`).then(rs => setSnapData(rs.data?.data || []));
      axios.get(`${API_BASE}?action=get_data&target=recon`).then(rr => { window.reconCacheData = rr.data?.data || []; });

    } catch (e) { 
      console.error(e);
      setData([]); 
    } finally { 
      setLoading(false); 
      setSelectedRows([]); 
    }
  };

  useEffect(() => { 
    if (isLoggedIn) fetchData(); 
  }, [activeMenu, masterTab, isLoggedIn]);

  /* ================= 4. HANDLERS ================= */
  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data?.status === 'success') { 
        setUser(res.data.user); 
        setIsLoggedIn(true); 
      } else {
        showToast("Password/User Salah", "error");
      }
    } catch (e) { showToast("Server Error", "error"); }
    finally { setLoginLoading(false); }
  };

  const handleToggle = async (uid, currentStatus) => {
    const nextStatus = currentStatus === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      setData(prev => prev.map(item => item.unique_id === uid ? {...item, assign: nextStatus} : item));
    } catch (e) { showToast("Gagal Toggle", "error"); }
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

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    if (!window.confirm(`Hapus ${selectedRows.length} item?`)) return;
    try {
      setLoading(true);
      for (const id of selectedRows) { await axios.post(`${API_BASE}?action=delete_location`, { unique_id: id }); }
      showToast("Berhasil Dihapus"); fetchData();
    } catch (e) { showToast("Gagal Hapus", "error"); }
    finally { setLoading(false); }
  };

  const filteredData = (data || []).filter(item => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const id = String(item.id || item.location_id || item.unique_id || item.picklist_number || '').toLowerCase();
    const art = String(item.artikel || item.product_id || '').toLowerCase();
    return id.includes(s) || art.includes(s) || getDesc(item).toLowerCase().includes(s);
  });

  /* ================= 5. PRINT COMPONENTS ================= */
  const PrintLayout = ({ box }) => {
    if (!box || !box.item_details) return null;
    const pages = [];
    const items = box.item_details;
    for (let i = 0; i < items.length; i += 12) pages.push(items.slice(i, i + 12));
    return (
      <div className="print-only">
        {pages.map((pItems, idx) => (
          <div key={idx} className="label-container">
            <div className="unboxing-tag">WAJIB VIDEO UNBOXING - KOMPLAIN TANPA VIDEO TIDAK DILAYANI</div>
            <div className="label-header">
               <div><div style={{fontWeight:900,fontSize:'11pt'}}>PT DUA PULUH TIGA</div><div style={{fontSize:'7pt'}}>Jl. kopo Bihbul Raya no 68, Bandung</div></div>
               <div style={{textAlign:'right'}}><QRCode value={box.huid || ''} size={40}/><div style={{fontSize:'6pt'}}>{box.huid}</div></div>
            </div>
            <div className="divider-line" />
            <div className="toko-grid"><div>{box.picklist_number}</div><div>{box.container_number}</div></div>
            <div className="divider-line" />
            <div style={{fontWeight:900, fontSize:'8pt', margin:'2px 0'}}>BOX CONTENT ({idx+1}/{pages.length})</div>
            <table className="table-print">
               <thead><tr><th>Artikel</th><th>Desc</th><th>Qty</th></tr></thead>
               <tbody>{pItems.map((it, k) => (<tr key={k}><td>{it.sku}</td><td className="trunc-cell">{it.name}</td><td style={{textAlign:'center'}}>{it.qty}</td></tr>))}</tbody>
            </table>
            <div className="divider-line" />
            <div className="label-footer">
               <div>Packer: {box.scanned_by}</div><div style={{textAlign:'right'}}>Total: {box.qty_packed}</div>
               <div>Tgl: {box.scanned_at?.substring(0,10)}</div><div style={{textAlign:'right'}}>Berat: {box.weight_kg} KG</div>
            </div>
            <div className="barcode-render">
                <Barcode value={box.picklist_number || ''} width={1.2} height={35} fontSize={8} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* ================= 6. RENDER LOGIC (ANTI-BLANK) ================= */
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

  // --- MOBILE HOME ---
  if (isMobile && showMobileHome) {
    const cache = window.reconCacheData || [];
    const b1 = cache.filter(d => d.final_status === 'NEED 1ST COUNT').length;
    const b2 = cache.filter(d => d.final_status === 'NEED 2ND COUNT').length;
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

  return (
    <div style={mainLayout}>
      <style>{`
        @media print { .no-print { display: none !important; } .print-only { display: block !important; } .label-container { width: 10cm; height: 10cm; padding: 2mm; box-sizing: border-box; page-break-after: always; background: white; } .unboxing-tag { background: #000; color: #fff; text-align: center; font-size: 7pt; font-weight: bold; padding: 1mm; } .label-header { display: flex; justify-content: space-between; margin-top: 1mm; } .divider-line { height: 1.5pt; background: #000; margin: 1mm 0; } .toko-grid { display: grid; grid-template-columns: 1fr 1fr; font-size: 9pt; font-weight: bold; text-align: center; } .table-print { width: 100%; border-collapse: collapse; font-size: 7pt; height: 4.8cm; } .table-print th { border-bottom: 1px solid #000; text-align: left; } .trunc-cell { max-width: 4cm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; } .label-footer { display: grid; grid-template-columns: 1fr 1fr; font-size: 7pt; color: red; font-weight: bold; } .barcode-render { text-align: center; margin-top: 1mm; } }
        .print-only { display: none; }
      `}</style>
      
      {toast.show && <div style={toastStyle(toast.type)}>{toast.msg}</div>}
      
      {!isMobile && (
        <nav style={sidebarStyle()}>
          <div style={{ padding: 20, fontWeight: 900 }}>COOL SYSTEM</div>
          <div style={menuSectionLabel}>INVENTORY</div>
          {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
            <div key={m} onClick={() => { setActiveMenu(m); setMasterTab('grid'); setSearchTerm(''); }} style={navItem(activeMenu === m)}>{m}</div>
          ))}
          <div style={menuSectionLabel}>OUTBOUND</div>
          {['Picking', 'Packing', 'Explorer', 'Print Label'].map(m => (
            <div key={m} onClick={() => { setActiveMenu(m); setSearchTerm(''); }} style={navItem(activeMenu === m)}>
                {m === 'Picking' && <Truck size={14} style={{marginRight:8}}/>}
                {m === 'Packing' && <Package size={14} style={{marginRight:8}}/>}
                {m === 'Explorer' && <Globe size={14} style={{marginRight:8}}/>}
                {m === 'Print Label' && <Printer size={14} style={{marginRight:8}}/>}
                {m}
            </div>
          ))}
          <button onClick={() => setIsLoggedIn(false)} style={btnLogout}><LogOut size={14} /></button>
        </nav>
      )}

      <div style={contentArea(isMobile)} className="no-print">
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isMobile && <button onClick={() => setShowMobileHome(true)} style={btnIcon}><ChevronLeft size={18}/></button>}
            <div style={{ fontWeight: '800' }}>{activeMenu.toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isMobile && activeMenu === 'Master Lokasi' && masterTab === 'database' && (
              <>
                <button onClick={handleBulkDelete} disabled={selectedRows.length === 0} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> DELETE</button>
                <button onClick={()=>setShowAddForm(true)} style={{...btnWhite, background:'#000', color:'#fff'}}><Plus size={12}/> ADD NEW</button>
              </>
            )}
            {!isMobile && activeMenu === 'Snapshoot' && (
              <label style={{...btnWhite, background:'#000', color:'#fff', cursor:'pointer'}}><Upload size={12}/> UPLOAD SNAP <input type="file" hidden onChange={handleFileUpload}/></label>
            )}
            {!isMobile && activeMenu === 'Print Label' && selectedBoxPrint && (
               <button onClick={()=>window.print()} style={{...btnWhite, background:'#800000', color:'#fff'}}><Printer size={12}/> PRINT NOW</button>
            )}
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading?'animate-spin':''}/></button>
          </div>
        </header>

        {!isMobile && activeMenu === 'Master Lokasi' && (
          <div style={{display:'flex', gap:15, marginBottom:20, borderBottom:'1px solid #eee'}}>
             <div onClick={()=>setMasterTab('grid')} style={tabItem(masterTab === 'grid')}><LayoutGrid size={14}/> ASSIGN CC</div>
             <div onClick={()=>setMasterTab('database')} style={tabItem(masterTab === 'database')}><DbIcon size={14}/> DATABASE LOKASI</div>
          </div>
        )}

        {!(isMobile && (activeMenu === '1st Count' || activeMenu === '2nt Count')) && (
            <div style={searchContainer}><Search size={14} style={{position:'absolute', left: 10, top: 12, color:'#999'}} /><input placeholder="Cari data..." style={searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        )}

        {/* --- CONTENT RENDERER --- */}
        {!isMobile && activeMenu === 'Master Lokasi' && masterTab === 'grid' ? (
           <div style={gridContainer()}>
              {filteredData.map((row, idx) => (
                <div key={idx} style={cardGrid}>
                  <span style={{ fontWeight: 800 }}>{row.unique_id}</span>
                  <div onClick={() => handleToggle(row.unique_id, row.assign)} style={toggleContainer(row.assign === 'open')}><div style={toggleCircle(row.assign === 'open')} /></div>
                </div>
              ))}
           </div>
        ) : activeMenu === 'Print Label' ? (
           <div style={{display:'flex', gap:20, flexDirection: isMobile ? 'column':'row'}}>
              <div style={{flex:1}}>
                 <select style={mInput} onChange={e=>setSelectedBoxPrint(data.find(b=>b.huid===e.target.value))}>
                    <option value="">-- PILIH BOX/KARUNG --</option>
                    {data.map((b, i)=>(<option key={i} value={b.huid}>{b.container_number} ({b.huid})</option>))}
                 </select>
                 {selectedBoxPrint && <div style={boxInfo}><b>HUID:</b> {selectedBoxPrint.huid}<br/><b>Items:</b> {selectedBoxPrint.item_details?.length} SKU</div>}
              </div>
              <div style={{flex:1, background:'#f5f5f5', padding:20, borderRadius:8, display:'flex', justifyContent:'center'}}>
                 <div style={{transform:'scale(0.8)', border:'1px solid #ddd', background:'#fff', width:'10cm', height:'10cm'}}><PrintLayout box={selectedBoxPrint} /></div>
              </div>
           </div>
        ) : (
           (!isMobile || activeMenu === 'Reconciliation' || ['Picking','Packing','Explorer'].includes(activeMenu)) && (
             <div style={tableWrapper}>
                <table style={tableStyle}>
                    <thead>
                      <tr style={{background:'#fafafa'}}>
                        {activeMenu === 'Packing' ? (
                            <><th style={thStyle}>ID</th><th style={thStyle}>BOX</th><th style={thStyle}>PICKLIST</th><th style={thStyle}>PRODUCT</th><th style={thStyle}>QTY</th><th style={thStyle}>TIME</th></>
                        ) : activeMenu === 'Master Lokasi' ? (
                            <><th style={thStyle}><input type="checkbox" onChange={(e) => e.target.checked ? setSelectedRows(filteredData.map(d=>d.unique_id)) : setSelectedRows([]) } /></th><th style={thStyle}>LOKASI</th><th style={thStyle}>ZONE</th><th style={thStyle}>AISLE</th><th style={thStyle}>UNIQUE</th><th style={thStyle}>STATUS</th></>
                        ) : (
                            <><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>QTY</th><th style={thStyle}>DESC</th></>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                    {filteredData.map((row, i)=>(
                        <tr key={i} style={{borderBottom:'1px solid #eee'}}>
                            {activeMenu === 'Packing' ? (
                                <><td style={tdStyle}>{row.id}</td><td style={tdStyle}>{row.container_number}</td><td style={tdStyle}>{row.picklist_number}</td><td style={tdStyle}>{row.product_id}</td><td style={tdStyle}>{row.qty_packed}</td><td style={tdStyle}>{formatWIB(row.scanned_at)}</td></>
                            ) : activeMenu === 'Master Lokasi' ? (
                                <><td style={tdStyle}><input type="checkbox" checked={selectedRows.includes(row.unique_id)} onChange={() => setSelectedRows(p => p.includes(row.unique_id) ? p.filter(x => x !== row.unique_id) : [...p, row.unique_id])} /></td><td style={tdStyle}>{row.location_id}</td><td style={tdStyle}>{row.zone}</td><td style={tdStyle}>{row.aisle}</td><td style={tdStyle}>{row.unique_id}</td><td style={{...tdStyle, color:row.assign==='open'?'green':'red', fontWeight:800}}>{row.assign?.toUpperCase()}</td></>
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

        {/* MOBILE FORMS */}
        {isMobile && activeMenu === '1st Count' && (
          <div style={formWrapper}>
             {locInfo && (
                <div style={boxInfo}>
                  {locInfo.map((it, idx)=>(
                    <div key={idx} style={{display:'flex', justifyContent:'space-between', padding:'5px 0'}}>
                       <div><b>{it.artikel}</b><br/><span style={{fontSize:'0.6rem'}}>{getDesc(it)}</span></div>
                       {data.some(d=>d.location_id===mobLoc && d.artikel===it.artikel) && <Check size={16} color="green"/>}
                    </div>
                  ))}
                </div>
             )}
             <input ref={inputLocRef} value={mobLoc} style={mInput} placeholder="SCAN LOKASI" onChange={e=>{const v=e.target.value.toUpperCase(); setMobLoc(v); if(v.length>=8){setLocInfo(snapData.filter(d=>String(d.location_id).toUpperCase()===v)); inputArtRef.current?.focus();}}} />
             <input ref={inputArtRef} value={mobArt} style={mInput} placeholder="SCAN ARTIKEL" onChange={e=>{const v=e.target.value.toUpperCase(); setMobArt(v); if(v.length>=12) inputQtyRef.current?.focus();}} />
             <input ref={inputQtyRef} type="number" style={qtyInput} value={mobQty} onChange={e=>setMobQty(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleSaveInput()} />
             <button onClick={handleSaveInput} style={btnBlack}>SAVE</button>
          </div>
        )}

        {isMobile && activeMenu === '2nt Count' && (
           <div style={{display:'flex', flexDirection:'column', gap:10}}>
              <select style={mInput} onChange={e=>{const [l,a]=e.target.value.split('|'); setSelectedLoc2nd((window.reconCacheData || []).find(d=>d.location_id===l && d.artikel===a)); setMobLoc(''); setMobArt('');}}>
                 <option value="">-- PILIH NEED 2ND --</option>
                 {(window.reconCacheData || []).filter(d=>d.final_status==='NEED 2ND COUNT').map((t,i)=>(<option key={i} value={`${t.location_id}|${t.artikel}`}>{t.location_id} | {t.artikel}</option>))}
              </select>
              {selectedLoc2nd && (
                <div style={formWrapper}>
                   <div style={boxInfoYellow}><b>{selectedLoc2nd.artikel}</b><br/>{getDesc(selectedLoc2nd)}<br/>Snap: {selectedLoc2nd.qty_snap}</div>
                   <input value={mobLoc} style={mInput} placeholder="LOKASI" onChange={e=>{setMobLoc(e.target.value.toUpperCase()); if(e.target.value.toUpperCase()===selectedLoc2nd.location_id) inputArtRef.current?.focus();}} />
                   <input ref={inputArtRef} value={mobArt} style={mInput} placeholder="ARTIKEL" onChange={e=>{setMobArt(e.target.value.toUpperCase()); if(e.target.value.toUpperCase()===selectedLoc2nd.artikel) inputQtyRef.current?.focus();}} />
                   <input ref={inputQtyRef} type="number" style={qtyInput} value={mobQty} onChange={e=>setMobQty(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleSaveInput()} />
                   <button onClick={handleSaveInput} style={btnBlack}>SAVE 2ND</button>
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
            <h2 style={{fontWeight:900, marginTop:20}}>SELESAI!</h2>
            <button style={{...btnBlack, marginTop:20}} onClick={()=>setShowCompletePopup(false)}>LANJUT</button>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT */}
      <PrintLayout box={selectedBoxPrint} />

      {/* ADD NEW POPUP */}
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
            <label style={labelStyle}>ASSIGN STATUS</label>
            <select style={mInput} value={newLoc.assign} onChange={e=>setNewLoc({...newLoc, assign: e.target.value})}>
              <option value="closed">CLOSED</option>
              <option value="open">OPEN</option>
            </select>
            <button onClick={async () => {
              try {
                await axios.post(`${API_INVENTORY}?action=add_location`, { location_id: newLoc.id.toUpperCase(), zone: newLoc.zone, aisle: newLoc.aisle, unique_id: newLoc.unique, assign: newLoc.assign });
                showToast("Berhasil!"); setShowAddForm(false); fetchData();
              } catch (e) { showToast("Error", "error"); }
            }} style={{...btnBlack, marginTop:10}}>SAVE</button>
          </div>
        </div>
      )}
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
const navItem = (a) => ({ padding: '12px 20px', cursor: 'pointer', color: a ? '#000' : '#ccc', fontWeight: a ? '800' : '400', display:'flex', alignItems:'center' });
const tableWrapper = { border: '1px solid #eee', borderRadius: '4px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { padding: '10px', fontSize: '0.6rem', color: '#999', borderBottom: '1px solid #eee', textTransform: 'uppercase' };
const tdStyle = { padding: '10px', fontSize: '0.65rem' };
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
const labelStyle = { fontSize: '0.6rem', fontWeight: '800', color: '#999', marginBottom: '5px', display: 'block' };
const badgeStyle = { position:'absolute', top:-5, right:-10, background:'red', color:'white', fontSize:'0.6rem', minWidth:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, border:'2px solid #fff' };

export default App;