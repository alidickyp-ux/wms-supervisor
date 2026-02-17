import React, { useState, useEffect, useRef, useMemo } from 'react';
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

/* --- API ENDPOINTS --- */
const API_BASE = 'https://wms-neon-bridge.vercel.app/api/inventory';
const API_OUTBOUND = 'https://wms-neon-bridge.vercel.app/api/to_web'; 

/* ================= 1. PRINT COMPONENT (OUTSIDE) ================= */
const RenderLabelComponent = ({ box }) => {
  if (!box) return null;
  const pages = [];
  const items = box.item_details || [];
  for (let i = 0; i < items.length; i += 12) pages.push(items.slice(i, i + 12));

  return (
    <>
      {pages.map((pItems, idx) => (
        <div key={idx} className="l-page">
          <div className="u-banner">WAJIB VIDEO UNBOXING - KOMPLAIN TANPA VIDEO TIDAK DILAYANI</div>
          <div className="l-header">
             <div><div className="l-pt-name">PT DUA PULUH TIGA</div><div className="l-pt-addr">Jl. kopo Bihbul Raya no 68, Bandung</div></div>
             <div style={{textAlign:'right'}}>
                <div className="l-huid">HUID: <b>{box.huid}</b></div>
                <QRCode value={box.huid || ''} size={42}/><div style={{fontSize:'6pt'}}>{box.huid}</div>
             </div>
          </div>
          <div className="l-line" />
          <div className="l-grid">
            <div>{box.picklist_number}</div>
            <div>{box.nama_toko}</div>
            <div style={{fontSize:'7pt'}}>{box.alamat_toko || box.address_toko || '-'}</div>
          </div>
          <div className="l-line" />
          <div style={{fontWeight:900, fontSize:'8pt', padding:'2px'}}>BOX CONTENT ({idx+1}/{pages.length}) <span style={{float:'right'}}>BOX: {box.container_number}</span></div>
          <table className="l-table">
             <thead><tr><th>Artikel</th><th>Description</th><th>Qty</th></tr></thead>
             <tbody>{pItems.map((it, k) => (<tr key={k}><td>{it.sku}</td><td className="trunc-cell">{it.nama_item}</td><td style={{textAlign:'center'}}>{it.qty}</td></tr>))}</tbody>
          </table>
          <div className="l-line" style={{marginTop:'auto'}} />
          <div className="l-footer" style={{fontSize:'8.5pt', padding:'4px'}}>
             <div style={{display:'flex', justifyContent:'space-between'}}><span><span className="l-red">Packer:</span> <b>{box.packer_name}</b></span><span><span className="l-red">Total:</span> <b>{box.total_pcs_box} PCS</b></span></div>
             <div style={{display:'flex', justifyContent:'space-between'}}><span><span className="l-red">Tgl:</span> <b>{box.tanggal_packing?.substring(0,10)}</b></span><span><span className="l-red">Berat:</span> <b>{box.weight_kg} KG</b></span></div>
          </div>
          <div className="l-barcode">
              <div style={{fontWeight:900, fontSize:'9pt'}}>NO SJ : {box.no_sj}</div>
              <Barcode value={box.no_sj || box.picklist_number || ''} width={1.8} height={40} fontSize={0} margin={0} />
          </div>
        </div>
      ))}
    </>
  );
};

function App() {
  /* ================= 2. STATE (vcekpoint1 ORIGINAL) ================= */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [activeMenu, setActiveMenu] = useState('Master Lokasi');
  const [masterTab, setMasterTab] = useState('grid'); 
  const [data, setData] = useState([]);
  const [snapData, setSnapData] = useState([]);
  const [reconCache, setReconCache] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [showMobileHome, setShowMobileHome] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState([]); 
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLoc, setNewLoc] = useState({ id: '', zone: '', aisle: '', unique: '', assign: 'closed' });

  const [mobLoc, setMobLoc] = useState('');
  const [mobArt, setMobArt] = useState('');
  const [mobQty, setMobQty] = useState('');
  const [locInfo, setLocInfo] = useState(null);
  const [selectedLoc2nd, setSelectedLoc2nd] = useState(null);
  const [showCompletePopup, setShowCompletePopup] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

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

  useEffect(() => {
    if (newLoc.id && newLoc.zone && newLoc.aisle) {
      setNewLoc(prev => ({ ...prev, unique: `${prev.zone.toUpperCase()}-${prev.aisle}` }));
    }
  }, [newLoc.id, newLoc.zone, newLoc.aisle]);

  /* ================= 3. UTILS ================= */
  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };

  const getDesc = (item) => {
    if (!item) return '-';
    return item.description || item.sku_desc || item.desc || item.product_description || '-';
  };

  const formatWIB = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    return new Date(dateStr).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
  };

  /* ================= 4. FETCHING ================= */
  const fetchData = async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      if (activeMenu === 'Print Label') {
        const res = await axios.get(`${API_OUTBOUND}?target=packing_transactions`);
        setData(res.data?.data || []);
      } else {
        const outboundMenus = ['Picking', 'Packing', 'Explorer'];
        const targetMap = {
          'Master Lokasi': masterTab === 'database' ? 'master_all' : 'master',
          'Snapshoot': 'snapshot_list',
          '1st Count': 'first', 
          '2nt Count': 'second', 
          'Reconciliation': 'recon',
          'Picking': 'picking_transactions',
          'Packing': 'packing_transactions',
          'Explorer': 'outbound_explorer'
        };
        const currentAPI = outboundMenus.includes(activeMenu) ? API_OUTBOUND : API_BASE;
        const res = await axios.get(`${currentAPI}?action=get_data&target=${targetMap[activeMenu]}`);
        setData(res.data?.data || []);
      }
      axios.get(`${API_BASE}?action=get_data&target=snapshot_list`).then(rs => setSnapData(rs.data?.data || []));
      axios.get(`${API_BASE}?action=get_data&target=recon`).then(rr => setReconCache(rr.data?.data || []));
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
    } catch (e) { showToast("Gagal tarik box detail", "error"); }
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

  const handleToggle = async (uid, currentStatus) => {
    const nextStatus = currentStatus === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      fetchData();
    } catch (e) { showToast("Gagal Toggle", "error"); }
  };

  const handleSaveInput = async () => {
    if (!mobLoc || !mobQty || !mobArt) return showToast("Data Kurang", "error");
    const locU = mobLoc.trim().toUpperCase();
    const artU = mobArt.trim().toUpperCase();
    if (activeMenu === '1st Count' && data.some(d => String(d.location_id).toUpperCase() === locU && String(d.artikel).toUpperCase() === artU)) {
        return showToast("SUDAH DISCAN!", "error");
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

  const handlePcbChange = (e) => {
    const val = e.target.value;
    setSelectedPcb(val);
    fetchBoxByPcb(val);
    setSelectedBoxHuid('');
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

  /* ================= 6. RENDER LOGIC ================= */
  const currentBoxData = useMemo(() => {
    return boxOptions.find(b => b.huid === selectedBoxHuid) || null;
  }, [selectedBoxHuid, boxOptions]);

  const filteredData = (data || []).filter(item => {
    if (!searchTerm) return true;
    const s = searchTerm.toUpperCase();
    return String(item.location_id || item.picklist_number || item.id).includes(s) || 
           String(item.artikel || item.product_id || item.sku).includes(s);
  });

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

  return (
    <div style={mainLayout}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; position: absolute; left: 0; top: 0; width: 10cm; }
          .l-page { width: 10cm; height: 10cm; padding: 1mm; box-sizing: border-box; page-break-after: always; background: white; font-family: sans-serif; display: flex; flex-direction: column; }
          .u-banner { background: #FF0000; color: #fff; text-align: center; font-size: 8.5pt; font-weight: bold; padding: 4px; border-radius: 2px; }
          .l-header { display: flex; justify-content: space-between; padding: 4px 2px; }
          .l-pt-name { font-weight: 900; font-size: 13pt; }
          .l-pt-addr { font-size: 8pt; line-height: 1.1; }
          .l-line { height: 2px; background: #000; margin: 1mm 0; }
          .l-grid { display: grid; grid-template-columns: 1fr 1.5fr 1fr; border: 1.5px solid #000; }
          .l-grid div { border-right: 1.5px solid #000; padding: 4px; font-size: 8.5pt; font-weight: bold; text-align: center; display: flex; align-items: center; justify-content: center; }
          .l-grid div:last-child { border-right: none; }
          .l-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
          .l-table th { background: #eee; text-align: left; padding: 2px; border: 0.5px solid #000; }
          .l-table td { padding: 2px; border: 0.5px solid #ccc; }
          .trunc-cell { max-width: 4cm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
          .l-red { color: #FF0000; font-weight: bold; }
          .l-barcode { text-align: center; margin-top: auto; padding-bottom: 1mm; }
        }
        .print-area { display: none; }
      `}</style>
      
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
              <div style={{display:'flex', alignItems:'center', gap:8}}><Printer size={14}/> {m}</div>
            </div>
          ))}
          <button onClick={() => setIsLoggedIn(false)} style={btnLogout} className="no-print"><LogOut size={14} /></button>
        </nav>
      )}

      <div style={contentArea(isMobile)} className="no-print">
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isMobile && <button onClick={() => setShowMobileHome(true)} style={btnIcon}><ChevronLeft size={18}/></button>}
            <div style={{ fontWeight: '800' }}>{activeMenu.toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isMobile && (
              <>
                {activeMenu === 'Master Lokasi' && masterTab === 'database' && (
                  <>
                    <button onClick={handleBulkDelete} disabled={selectedRows.length === 0} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> DELETE</button>
                    <button onClick={()=>setShowAddForm(true)} style={{...btnWhite, background:'#000', color:'#fff'}}><Plus size={12}/> ADD NEW</button>
                  </>
                )}
                {activeMenu === 'Snapshoot' && (
                   <label style={{...btnWhite, background:'#000', color:'#fff', cursor:'pointer'}}><Upload size={12}/> UPLOAD SNAP <input type="file" hidden onChange={handleFileUpload}/></label>
                )}
                {['1st Count', '2nt Count', 'Snapshoot', 'Reconciliation'].includes(activeMenu) && (
                   <button onClick={() => { if(window.confirm("Hapus data?")) axios.post(`${API_BASE}?action=clear_${activeMenu.includes('1st')?'first':activeMenu.includes('2nt')?'second':activeMenu.includes('Snap')?'snap':'recon'}`).then(()=>fetchData()); }} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> CLEAR</button>
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

        {!isMobile && activeMenu === 'Master Lokasi' && (
          <div style={{display:'flex', gap:15, marginBottom:20, borderBottom:'1px solid #eee'}}>
             <div onClick={()=>setMasterTab('grid')} style={tabItem(masterTab === 'grid')}><LayoutGrid size={14}/> ASSIGN CC</div>
             <div onClick={()=>setMasterTab('database')} style={tabItem(masterTab === 'database')}><DbIcon size={14}/> DATABASE LOKASI</div>
          </div>
        )}

        {!(isMobile && (activeMenu === '1st Count' || activeMenu === '2nt Count')) && (
            <div style={searchContainer}><Search size={14} style={{position:'absolute', left: 10, top: 12, color:'#999'}} /><input placeholder="Cari data..." style={searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        )}

        {activeMenu === 'Print Label' ? (
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
                 {currentBoxData && <div style={boxInfo}><b>HUID:</b> {currentBoxData.huid}<br/><b>Items:</b> {currentBoxData.item_details?.length} SKU</div>}
              </div>
              <div style={{flex:1.5, background:'#f5f5f5', padding:20, borderRadius:8, display:'flex', justifyContent:'center', minHeight: '520px'}}>
                 <div style={{transform:'scale(0.7)', background:'#fff', width:'10cm', height:'10cm', border:'1px solid #ddd'}}>
                    <RenderLabelComponent box={currentBoxData} />
                 </div>
              </div>
           </div>
        ) : (
           <div style={tableWrapper}>
             <table style={tableStyle}>
                <thead>
                   <tr style={{background:'#fafafa'}}>
                      {activeMenu === 'Master Lokasi' && masterTab === 'database' && (
                        <th style={thStyle}><input type="checkbox" onChange={(e) => e.target.checked ? setSelectedRows(data.map(d=>d.unique_id)) : setSelectedRows([]) } /></th>
                      )}
                      
                      {activeMenu === 'Master Lokasi' && masterTab === 'database' && (
                        <><th style={thStyle}>LOKASI</th><th style={thStyle}>ZONE</th><th style={thStyle}>AISLE</th><th style={thStyle}>UNIQUE</th><th style={thStyle}>STATUS</th></>
                      )}

                      {activeMenu === 'Reconciliation' && (
                        <><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>DIFF</th><th style={thStyle}>STATUS</th></>
                      )}

                      {activeMenu === 'Picking' && (
                        <><th style={thStyle}>ID</th><th style={thStyle}>PICKLIST</th><th style={thStyle}>PRODUCT</th><th style={thStyle}>LOC</th><th style={thStyle}>QTY</th><th style={thStyle}>PICKER</th><th style={thStyle}>TIME</th><th style={thStyle}>DESC</th><th style={thStyle}>STATUS</th><th style={thStyle}>REASON</th></>
                      )}

                      {activeMenu === 'Packing' && (
                        <><th style={thStyle}>ID</th><th style={thStyle}>BOX #</th><th style={thStyle}>PICKLIST</th><th style={thStyle}>PRODUCT</th><th style={thStyle}>QTY</th><th style={thStyle}>PACKER</th><th style={thStyle}>TIME</th><th style={thStyle}>DESC</th><th style={thStyle}>HUID</th><th style={thStyle}>CONT #</th><th style={thStyle}>TYPE</th><th style={thStyle}>WEIGHT</th><th style={thStyle}>STATUS</th></>
                      )}

                      {activeMenu === 'Explorer' && (
                        <><th style={thStyle}>PICKLIST</th><th style={thStyle}>SKU</th><th style={thStyle}>DESC</th><th style={thStyle}>REQ</th><th style={thStyle}>PICK</th><th style={thStyle}>PACK</th><th style={thStyle}>STATUS</th></>
                      )}

                      {['Snapshoot', '1st Count', '2nt Count'].includes(activeMenu) && (
                        <><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>QTY</th><th style={thStyle}>DESC</th></>
                      )}
                   </tr>
                </thead>
                <tbody>
                   {filteredData.map((row, i)=>(
                     <tr key={i} style={{borderBottom:'1px solid #eee'}}>
                        {activeMenu === 'Master Lokasi' && masterTab === 'database' && (
                          <>
                            <td style={tdStyle}><input type="checkbox" checked={selectedRows.includes(row.unique_id)} onChange={() => setSelectedRows(p => p.includes(row.unique_id) ? p.filter(x => x !== row.unique_id) : [...p, row.unique_id])} /></td>
                            <td style={tdStyle}>{row.location_id}</td>
                            <td style={tdStyle}>{row.zone}</td>
                            <td style={tdStyle}>{row.aisle}</td>
                            <td style={tdStyle}>{row.unique_id}</td>
                            <td style={{...tdStyle, color:row.assign==='open'?'green':'red', fontWeight:800}}>{row.assign?.toUpperCase()}</td>
                          </>
                        )}

                        {activeMenu === 'Reconciliation' && (
                          <><td style={tdStyle}>{row.location_id}</td><td style={tdStyle}>{row.artikel}</td><td style={tdStyle}>{row.qty_snap}</td><td style={tdStyle}>{row.qty_1st}</td><td style={tdStyle}>{row.qty_2nd}</td><td style={{...tdStyle, color:'red', fontWeight:900}}>{(Number(row.qty_2nd||row.qty_1st||0) - Number(row.qty_snap||0))}</td><td style={tdStyle}>{row.final_status}</td></>
                        )}

                        {activeMenu === 'Picking' && (
                          <><td style={tdStyle}>{row.id}</td><td style={tdStyle}>{row.picklist_number}</td><td style={tdStyle}>{row.product_id}</td><td style={tdStyle}>{row.location_id}</td><td style={tdStyle}>{row.qty_actual}</td><td style={tdStyle}>{row.picker_name}</td><td style={tdStyle}>{formatWIB(row.scanned_at)}</td><td style={tdDescSmall}>{getDesc(row)}</td><td style={tdStyle}>{row.status}</td><td style={tdStyle}>{row.inventory_reason}</td></>
                        )}

                        {activeMenu === 'Packing' && (
                          <><td style={tdStyle}>{row.id}</td><td style={tdStyle}>{row.box_number}</td><td style={tdStyle}>{row.picklist_number}</td><td style={tdStyle}>{row.product_id}</td><td style={tdStyle}>{row.qty_packed}</td><td style={tdStyle}>{row.scanned_by}</td><td style={tdStyle}>{formatWIB(row.scanned_at)}</td><td style={tdDescSmall}>{getDesc(row)}</td><td style={tdStyle}>{row.huid}</td><td style={tdStyle}>{row.container_number}</td><td style={tdStyle}>{row.container_type}</td><td style={tdStyle}>{row.weight_kg}</td><td style={tdStyle}>{row.status}</td></>
                        )}

                        {activeMenu === 'Explorer' && (
                          <><td style={tdStyle}>{row.picklist_number}</td><td style={tdStyle}>{row.sku}</td><td style={tdDescSmall}>{getDesc(row)}</td><td style={tdStyle}>{row.qty_req}</td><td style={tdStyle}>{row.qty_picked}</td><td style={tdStyle}>{row.qty_packed}</td><td style={tdStyle}>{row.status}</td></>
                        )}

                        {['Snapshoot', '1st Count', '2nt Count'].includes(activeMenu) && (
                          <><td style={tdStyle}>{row.location_id || row.unique_id}</td><td style={tdStyle}>{row.artikel}</td><td style={tdStyle}>{row.qty_snap || row.qty_1st || row.qty || 0}</td><td style={tdDescSmall}>{getDesc(row)}</td></>
                        )}
                     </tr>
                   ))}
                </tbody>
             </table>
           </div>
        )}
      </div>

      <div className="print-area">
         <RenderLabelComponent box={currentBoxData} />
      </div>

      {showCompletePopup && (
        <div style={popupOverlay} onClick={()=>setShowCompletePopup(false)}>
          <div style={popupContent}>
            <div className="circle-check-v20" style={{background:'#16a34a', borderRadius:'50%', width:60, height:60, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto'}}><Check size={40} color="#fff" /></div>
            <h2 style={{fontWeight:900, marginTop:20}}>LOKASI SELESAI!</h2>
            <button style={{...btnBlack, marginTop:20}} onClick={()=>setShowCompletePopup(false)}>LANJUT</button>
          </div>
        </div>
      )}

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
            <label style={labelStyle}>STATUS</label>
            <select style={mInput} value={newLoc.assign} onChange={e=>setNewLoc({...newLoc, assign: e.target.value})}>
              <option value="closed">CLOSED</option>
              <option value="open">OPEN</option>
            </select>
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
const loginPage = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f5f5f5' };
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
const badgeStyle = { position:'absolute', top:-5, right:-10, background:'red', color:'white', fontSize:'0.6rem', minWidth:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, border:'2px solid #fff' };
const labelStyle = { fontSize: '0.6rem', fontWeight: '800', color: '#999', marginBottom: '5px', display: 'block' };
const gridContainer = () => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(80px, 1fr))`, gap: '15px' });
const cardGrid = { border: '1px solid #eee', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '4px' };
const toggleContainer = (on) => ({ width: '34px', height: '18px', background: on ? '#000' : '#eee', borderRadius: '12px', position: 'relative', cursor: 'pointer' });
const toggleCircle = (on) => ({ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '19px' : '3px', transition: '0.2s' });
const searchContainer = { position: 'relative', marginBottom: '15px' };
const searchInput = { width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #eee', borderRadius: '8px', fontFamily: 'Lexend', fontSize: '0.7rem', boxSizing: 'border-box' };