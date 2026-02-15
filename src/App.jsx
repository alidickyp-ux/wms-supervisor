import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  RefreshCw, FileSpreadsheet, Trash2, LogOut, Upload, Search,
  ChevronLeft, ClipboardCheck, PackageCheck, BarChart3, Download,
  CheckCircle2, Loader2, Check, Plus, Database as DbIcon, LayoutGrid, X,
  Truck, Package, Globe
} from 'lucide-react';

const API_BASE = 'https://wms-neon-bridge.vercel.app/api/inventory';
const API_OUTBOUND = 'https://wms-neon-bridge.vercel.app/api/to_web'; 

function App() {
  /* ================= 1. STATE (UTUH V5) ================= */
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
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

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
    if (newLoc.zone && newLoc.aisle) {
      setNewLoc(prev => ({ ...prev, unique: `${prev.zone.toUpperCase()}-${prev.aisle}` }));
    }
  }, [newLoc.zone, newLoc.aisle]);

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

  /* ================= 3. FETCHING ================= */
  const fetchData = async () => {
    setLoading(true);
    try {
      const outboundMenus = ['Picking', 'Packing', 'Explorer'];
      const currentAPI = outboundMenus.includes(activeMenu) ? API_OUTBOUND : API_BASE;

      const targetMap = {
        'Master Lokasi': masterTab === 'database' ? 'master_all' : 'master',
        'Snapshoot': 'snapshot_list',
        '1st Count': 'first', 
        '2nt Count': isMobile ? 'recon' : 'second', 
        'Reconciliation': 'recon',
        'Picking': 'picking_transactions',
        'Packing': 'packing_transactions',
        'Explorer': 'outbound_explorer'
      };

      const res = await axios.get(`${currentAPI}?action=get_data&target=${targetMap[activeMenu]}`);
      setData(Array.isArray(res.data.data) ? res.data.data : []);
      
      // Sync cache data inventory
      axios.get(`${API_BASE}?action=get_data&target=snapshot_list`).then(rs => setSnapData(Array.isArray(rs.data.data) ? rs.data.data : []));
      axios.get(`${API_BASE}?action=get_data&target=recon`).then(rr => window.reconCacheData = Array.isArray(rr.data.data) ? rr.data.data : []);
    } catch (e) { setData([]); }
    finally { setLoading(false); setSelectedRows([]); }
  };

  useEffect(() => { if (isLoggedIn) fetchData(); }, [activeMenu, masterTab, isLoggedIn]);

  /* ================= 4. HANDLERS ================= */
  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data.status === 'success') { setUser(res.data.user); setIsLoggedIn(true); }
      else showToast("Password/User Salah", "error");
    } catch (e) { showToast("Server Error", "error"); }
    finally { setLoginLoading(false); }
  };

  const handleSaveInput = async () => {
    if (!mobLoc || !mobQty || !mobArt) return showToast("Data Kurang", "error");
    const locU = mobLoc.trim().toUpperCase();
    const artU = mobArt.trim().toUpperCase();
    
    // --- LOGIKA ANTI DOUBLE SCAN (1st Count) ---
    if (activeMenu === '1st Count') {
        const isAlreadyScanned = data.some(d => 
            String(d.location_id).toUpperCase() === locU && 
            String(d.artikel).toUpperCase() === artU
        );
        if (isAlreadyScanned) {
            return showToast("BARANG INI SUDAH DISCAN!", "error");
        }
    }

    // Validasi 2nd Count
    if (activeMenu === '2nt Count' && selectedLoc2nd) {
      if (locU !== selectedLoc2nd.location_id.toUpperCase() || artU !== selectedLoc2nd.artikel.toUpperCase()) {
        return showToast("Validasi Lokasi/Barang Gagal!", "error");
      }
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}?action=save_input`, { location_id: locU, artikel: artU, qty: parseInt(mobQty), operator: user?.username, target_table: activeMenu });
      showToast("Tersimpan!"); 
      setMobArt(''); setMobQty(''); 
      
      // Auto focus logic
      if (activeMenu === '1st Count') {
         setTimeout(() => inputArtRef.current?.focus(), 50);
      } else {
         setMobLoc(''); setSelectedLoc2nd(null);
         setTimeout(() => inputLocRef.current?.focus(), 50);
      }
      fetchData(); 
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

  /* ================= 5. RENDER UI ================= */
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
    const b1 = (window.reconCacheData || []).filter(d => d.final_status === 'NEED 1ST COUNT').length;
    const b2 = (window.reconCacheData || []).filter(d => d.final_status === 'NEED 2ND COUNT').length;
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
      {toast.show && <div style={toastStyle(toast.type)}>{toast.msg}</div>}
      
      {/* SIDEBAR */}
      {!isMobile && (
        <nav style={sidebarStyle()}>
          <div style={{ padding: 20, fontWeight: 900 }}>COOL SYSTEM</div>
          <div style={menuSectionLabel}>INVENTORY</div>
          {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
            <div key={m} onClick={() => { setActiveMenu(m); setSearchTerm(''); setMasterTab('grid'); }} style={navItem(activeMenu === m)}>{m}</div>
          ))}
          <div style={menuSectionLabel}>OUTBOUND</div>
          <div onClick={() => setActiveMenu('Picking')} style={navItem(activeMenu === 'Picking')}><Truck size={14} style={{marginRight:8}}/> Picking</div>
          <div onClick={() => setActiveMenu('Packing')} style={navItem(activeMenu === 'Packing')}><Package size={14} style={{marginRight:8}}/> Packing</div>
          <div onClick={() => setActiveMenu('Explorer')} style={navItem(activeMenu === 'Explorer')}><Globe size={14} style={{marginRight:8}}/> Explorer</div>
          <button onClick={() => setIsLoggedIn(false)} style={btnLogout}><LogOut size={14} /></button>
        </nav>
      )}

      <div style={contentArea(isMobile)}>
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isMobile && <button onClick={() => setShowMobileHome(true)} style={btnIcon}><ChevronLeft size={18}/></button>}
            <div style={{ fontWeight: '800' }}>{activeMenu.toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isMobile && (
              <>
                {activeMenu === 'Snapshoot' && (
                  <>
                    <label style={{...btnWhite, background:'#000', color:'#fff', cursor:'pointer'}}><Upload size={12}/> UPLOAD SNAP <input type="file" hidden onChange={handleFileUpload}/></label>
                    <button onClick={() => { if(window.confirm("Hapus semua Snap?")) axios.post(`${API_BASE}?action=clear_snap`).then(()=>fetchData()); }} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> CLEAR</button>
                  </>
                )}
                {['1st Count', '2nt Count'].includes(activeMenu) && (
                   <button onClick={() => { if(window.confirm("Hapus progres hitung?")) axios.post(`${API_BASE}?action=clear_${activeMenu.includes('1st')?'first':'second'}`).then(()=>fetchData()); }} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> CLEAR</button>
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

        {/* SEARCH BAR (Hanya muncul jika bukan menu execution mobile) */}
        {!(isMobile && (activeMenu === '1st Count' || activeMenu === '2nt Count')) && (
            <div style={searchContainer}><Search size={14} style={{position:'absolute', left: 10, top: 12, color:'#999'}} /><input placeholder="Cari data..." style={searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        )}

        {/* --- DYNAMIC RENDERER --- */}
        {/* VIEW: GRID ASSIGN MASTER LOKASI */}
        {!isMobile && activeMenu === 'Master Lokasi' && masterTab === 'grid' ? (
          <div style={gridContainer()}>
            {filteredData.map((row, idx) => (
              <div key={idx} style={cardGrid}>
                <span style={{ fontWeight: '800', marginBottom: '5px' }}>{row.unique_id}</span>
                <div onClick={() => handleToggle(row.unique_id, row.assign)} style={toggleContainer(row.assign === 'open')}><div style={toggleCircle(row.assign === 'open')} /></div>
              </div>
            ))}
          </div>
        ) : (
          /* VIEW: TABLE (Tampilan Mobile hanya memproses form, Desktop memproses tabel) */
          (!isMobile || activeMenu === 'Reconciliation' || activeMenu === 'Picking' || activeMenu === 'Packing' || activeMenu === 'Explorer') ? (
            <div style={tableWrapper}>
                <table style={tableStyle}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#fff' }}>
                    <tr style={{ background: '#fafafa' }}>
                    {activeMenu === 'Packing' ? (
                        <><th style={thStyle}>ID</th><th style={thStyle}>BOX NO</th><th style={thStyle}>PICKLIST</th><th style={thStyle}>PRODUCT</th><th style={thStyle}>QTY</th><th style={thStyle}>USER</th><th style={thStyle}>TIME</th><th style={thStyle}>HUID</th><th style={thStyle}>CONT NO</th><th style={thStyle}>TYPE</th><th style={thStyle}>KG</th><th style={thStyle}>STATUS</th></>
                    ) : activeMenu === 'Picking' ? (
                        <><th style={thStyle}>ID</th><th style={thStyle}>PICKLIST</th><th style={thStyle}>PRODUCT</th><th style={thStyle}>LOC</th><th style={thStyle}>QTY</th><th style={thStyle}>USER</th><th style={thStyle}>TIME</th><th style={thStyle}>DESC</th><th style={thStyle}>STATUS</th><th style={thStyle}>REASON</th></>
                    ) : activeMenu === 'Explorer' ? (
                        <><th style={thStyle}>PICKLIST</th><th style={thStyle}>SKU</th><th style={thStyle}>DESC</th><th style={thStyle}>REQ</th><th style={thStyle}>PICK</th><th style={thStyle}>PACK</th><th style={thStyle}>STATUS</th></>
                    ) : activeMenu === 'Master Lokasi' ? (
                        <><th style={thStyle}><input type="checkbox" onChange={(e) => e.target.checked ? setSelectedRows(filteredData.map(d=>d.unique_id)) : setSelectedRows([]) } /></th><th style={thStyle}>LOKASI</th><th style={thStyle}>ZONE</th><th style={thStyle}>AISLE</th><th style={thStyle}>UNIQUE</th><th style={thStyle}>STATUS</th></>
                    ) : activeMenu === 'Reconciliation' ? (
                        <><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>DIFF</th><th style={thStyle}>STATUS</th></>
                    ) : (
                        <><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>QTY</th><th style={thStyle}>DESC</th></>
                    )}
                    </tr>
                </thead>
                <tbody>
                    {filteredData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        {activeMenu === 'Packing' ? (
                        <><td style={tdStyle}>{row.id}</td><td style={tdStyle}>{row.box_number}</td><td style={tdStyle}>{row.picklist_number}</td><td style={tdStyle}>{row.product_id}</td><td style={tdStyle}>{row.qty_packed}</td><td style={tdStyle}>{row.scanned_by}</td><td style={tdStyle}>{formatWIB(row.scanned_at)}</td><td style={tdStyle}>{row.huid}</td><td style={tdStyle}>{row.container_number}</td><td style={tdStyle}>{row.container_type}</td><td style={tdStyle}>{row.weight_kg}</td><td style={tdStyle}>{row.status}</td></>
                        ) : activeMenu === 'Picking' ? (
                        <><td style={tdStyle}>{row.id}</td><td style={tdStyle}>{row.picklist_number}</td><td style={tdStyle}>{row.product_id}</td><td style={tdStyle}>{row.location_id}</td><td style={tdStyle}>{row.qty_actual}</td><td style={tdStyle}>{row.picker_name}</td><td style={tdStyle}>{formatWIB(row.scanned_at)}</td><td style={tdDescSmall}>{getDesc(row)}</td><td style={tdStyle}>{row.status}</td><td style={tdStyle}>{row.inventory_reason}</td></>
                        ) : activeMenu === 'Explorer' ? (
                        <><td style={tdStyle}>{row.picklist_number}</td><td style={tdStyle}>{row.sku}</td><td style={tdDescSmall}>{row.description}</td><td style={tdStyle}>{row.qty_req}</td><td style={{...tdStyle, color: row.qty_picked >= row.qty_req ? 'green' : 'red', fontWeight: 800}}>{row.qty_picked}</td><td style={{...tdStyle, color: row.qty_packed >= row.qty_req ? 'green' : 'red', fontWeight: 800}}>{row.qty_packed}</td><td style={tdStyle}><span style={statusBadge(row.status)}>{row.status}</span></td></>
                        ) : activeMenu === 'Master Lokasi' ? (
                        <><td style={tdStyle}><input type="checkbox" checked={selectedRows.includes(row.unique_id)} onChange={() => setSelectedRows(p => p.includes(row.unique_id) ? p.filter(x => x !== row.unique_id) : [...p, row.unique_id])} /></td><td style={tdStyle}>{row.location_id}</td><td style={tdStyle}>{row.zone}</td><td style={tdStyle}>{row.aisle}</td><td style={tdStyle}>{row.unique_id}</td><td style={{...tdStyle, color: row.assign === 'open'?'green':'red', fontWeight:800}}>{row.assign?.toUpperCase()}</td></>
                        ) : activeMenu === 'Reconciliation' ? (
                        <><td style={tdStyle}>{row.location_id}</td><td style={tdStyle}>{row.artikel}</td><td style={tdStyle}>{row.qty_snap}</td><td style={tdStyle}>{row.qty_1st}</td><td style={tdStyle}>{row.qty_2nd}</td><td style={{...tdStyle, fontWeight:900, color: (Number(row.qty_2nd || row.qty_1st || 0) - Number(row.qty_snap || 0)) !== 0 ? 'red' : 'green'}}>{(Number(row.qty_2nd || row.qty_1st || 0) - Number(row.qty_snap || 0)) > 0 ? `+${(Number(row.qty_2nd || row.qty_1st || 0) - Number(row.qty_snap || 0))}` : (Number(row.qty_2nd || row.qty_1st || 0) - Number(row.qty_snap || 0))}</td><td style={tdStyle}>{row.final_status}</td></>
                        ) : (
                        <><td style={tdStyle}>{row.location_id || row.unique_id}</td><td style={tdStyle}>{row.artikel}</td><td style={tdStyle}>{row.qty_snap || row.qty_1st || row.qty_2nd}</td><td style={tdDescSmall}>{getDesc(row)}</td></>
                        )}
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
          ) : null
        )}

        {/* --- MOBILE VIEW: EKSEKUSI FORM SAJA --- */}
        {isMobile && activeMenu === '1st Count' && (
          <div style={formWrapper}>
             {locInfo && (
                <div style={boxInfo}>
                  <div style={boxTitle}>REFERENSI LOKASI: {mobLoc}</div>
                  {locInfo.map((item, idx) => (
                    <div key={idx} style={{...infoLine, display:'flex', justifyContent:'space-between'}}>
                      <div><b>{item.artikel}</b><br/><span style={{fontSize:'0.6rem'}}>{getDesc(item)}</span></div>
                      {data.some(d => String(d.location_id).toUpperCase() === mobLoc.toUpperCase() && String(d.artikel).toUpperCase() === String(item.artikel).toUpperCase()) && <Check size={16} color="green"/>}
                    </div>
                  ))}
                </div>
              )}
              <label style={labelStyle}>SCAN LOKASI</label>
              <input ref={inputLocRef} value={mobLoc} style={mInput} autoFocus onChange={e => {
                const v = e.target.value.toUpperCase(); setMobLoc(v);
                if(v.length >= 8) { setLocInfo(snapData.filter(d => String(d.location_id).toUpperCase() === v)); setTimeout(()=>inputArtRef.current?.focus(), 50); }
              }} />
              <label style={labelStyle}>SCAN ARTIKEL</label>
              <input ref={inputArtRef} value={mobArt} style={mInput} onChange={e => {
                setMobArt(e.target.value.toUpperCase()); if(e.target.value.length >= 12) setTimeout(()=>inputQtyRef.current?.focus(), 50);
              }} />
              <label style={labelStyle}>QTY</label>
              <input ref={inputQtyRef} type="number" style={qtyInput} value={mobQty} onChange={e => setMobQty(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSaveInput()} />
              <button onClick={handleSaveInput} style={btnBlack}>SIMPAN DATA</button>
          </div>
        )}

        {/* 2nd Count Mobile Execution */}
        {isMobile && activeMenu === '2nt Count' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <select style={mInput} value={selectedLoc2nd ? `${selectedLoc2nd.location_id}|${selectedLoc2nd.artikel}` : ""} onChange={e => { 
                const [l, a] = e.target.value.split('|'); 
                const f = (window.reconCacheData || []).find(d => d.location_id === l && d.artikel === a); 
                setSelectedLoc2nd(f); setMobLoc(''); setMobArt(''); 
                setTimeout(() => inputLocRef.current?.focus(), 50); 
              }}>
                <option value="">-- PILIH NEED 2ND --</option>
                {(window.reconCacheData || []).filter(d => d.final_status === 'NEED 2ND COUNT').map((t, i) => (<option key={i} value={`${t.location_id}|${t.artikel}`}>{t.location_id} | {t.artikel}</option>))}
              </select>
              {selectedLoc2nd && (
                <div style={formWrapper}>
                  <div style={boxInfoYellow}><b>{selectedLoc2nd.artikel}</b><br/>Snap: {selectedLoc2nd.qty_snap} | 1st: {selectedLoc2nd.qty_1st}</div>
                  <label style={labelStyle}>VALIDASI LOKASI</label>
                  <input ref={inputLocRef} value={mobLoc} style={mInput} onChange={e => { setMobLoc(e.target.value.toUpperCase()); if(e.target.value.toUpperCase() === selectedLoc2nd.location_id.toUpperCase()) inputArtRef.current?.focus(); }} />
                  <label style={labelStyle}>VALIDASI ARTIKEL</label>
                  <input ref={inputArtRef} value={mobArt} style={mInput} onChange={e => { setMobArt(e.target.value.toUpperCase()); if(e.target.value.toUpperCase() === selectedLoc2nd.artikel.toUpperCase()) inputQtyRef.current?.focus(); }} />
                  <label style={labelStyle}>QTY ACTUAL</label>
                  <input ref={inputQtyRef} type="number" style={qtyInput} value={mobQty} onChange={e => setMobQty(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveInput()} />
                  <button onClick={handleSaveInput} disabled={mobLoc !== selectedLoc2nd.location_id || mobArt !== selectedLoc2nd.artikel} style={{...btnBlack, background: (mobLoc === selectedLoc2nd.location_id && mobArt === selectedLoc2nd.artikel) ? '#000' : '#ccc'}}>SAVE 2ND COUNT</button>
                </div>
              )}
           </div>
        )}
      </div>

      {/* --- POPUP ADD NEW --- */}
      {showAddForm && (
        <div style={popupOverlay}>
          <div style={{...popupContent, textAlign:'left', padding:30}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:15}}><h3 style={{fontWeight:900}}>ADD NEW LOCATION</h3><button onClick={()=>setShowAddForm(false)} style={{border:'none', background:'none'}}><X size={20}/></button></div>
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
                await axios.post(`${API_INVENTORY}?action=add_location`, { ...newLoc, location_id: newLoc.id.toUpperCase() });
                showToast("Berhasil!"); setShowAddForm(false); fetchData();
              } catch (e) { showToast("Gagal Simpan", "error"); }
            }} style={{...btnBlack, marginTop:10}}>SAVE</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= STYLES ================= */
const menuSectionLabel = { padding: '15px 20px 5px', fontSize: '0.55rem', fontWeight: 900, color: '#999', letterSpacing: '1px' };
const statusBadge = (s) => ({ padding: '2px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 800, background: s?.includes('Packed') ? '#dcfce7' : '#fef9c3', color: s?.includes('Packed') ? '#166534' : '#854d0e' });
const searchContainer = { position: 'relative', marginBottom: '15px' };
const searchInput = { width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #eee', borderRadius: '8px', fontFamily: 'Lexend', fontSize: '0.7rem', boxSizing: 'border-box' };
const mainLayout = { display: 'flex', fontFamily: 'Lexend, sans-serif', backgroundColor: '#fff', minHeight: '100vh', fontSize: '0.7rem' };
const sidebarStyle = () => ({ width: 180, borderRight: '1px solid #eee', height: '100vh', position: 'fixed', backgroundColor: '#fff', zIndex: 10 });
const contentArea = (m) => ({ flex: 1, marginLeft: m ? 0 : 180, padding: m ? '15px' : '30px' });
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
const navItem = (a) => ({ padding: '12px 20px', cursor: 'pointer', color: a ? '#000' : '#ccc', fontWeight: a ? '800' : '400', display: 'flex', alignItems: 'center', fontSize: '0.7rem' });
const tableWrapper = { border: '1px solid #eee', borderRadius: '4px', overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { padding: '10px', fontSize: '0.6rem', color: '#999', borderBottom: '1px solid #eee', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const tdStyle = { padding: '10px', fontSize: '0.65rem', whiteSpace: 'nowrap' };
const tdDescSmall = { padding: '10px', fontSize: '0.65rem', color: '#999' };
const mInput = { width: '100%', padding: '12px', border: '1px solid #eee', marginBottom: '10px', borderRadius: '8px', fontFamily: 'Lexend', fontSize: '0.75rem', boxSizing: 'border-box' };
const qtyInput = { ...mInput, fontSize: '1.8rem', fontWeight: 900, textAlign: 'center' };
const btnBlack = { width: '100%', background: '#000', color: '#fff', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' };
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
const infoLine = { borderBottom: '1px solid #e2e8f0', padding: '5px 0' };
const labelStyle = { fontSize: '0.6rem', fontWeight: '800', color: '#999', marginBottom: '5px', display: 'block' };
const badgeStyle = { position:'absolute', top:-5, right:-10, background:'red', color:'white', fontSize:'0.6rem', minWidth:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, border:'2px solid #fff' };
const gridContainer = () => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(80px, 1fr))`, gap: '15px' });
const cardGrid = { border: '1px solid #eee', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '4px' };
const toggleContainer = (on) => ({ width: '34px', height: '18px', background: on ? '#000' : '#eee', borderRadius: '12px', position: 'relative', cursor: 'pointer' });
const toggleCircle = (on) => ({ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '19px' : '3px', transition: '0.2s' });
const popupOverlay = { position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000 };
const popupContent = { background:'#fff', padding:40, borderRadius:24, textAlign:'center', width:'85%', maxWidth:'400px', boxShadow:'0 20px 40px rgba(0,0,0,0.2)' };
const toastStyle = (t) => ({ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: t === 'success' ? '#16a34a' : '#ef4444', color: '#fff', padding: '12px 25px', borderRadius: '50px', fontWeight: '800', zIndex: 9999, fontSize: '0.7rem' });

export default App;