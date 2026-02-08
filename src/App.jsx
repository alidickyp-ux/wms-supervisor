import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  RefreshCw, FileSpreadsheet, Trash2, LogOut, Upload, Search,
  ChevronLeft, ClipboardCheck, PackageCheck, BarChart3, Download,
  CheckCircle2, Loader2, Check, Plus, Database as DbIcon, LayoutGrid, X
} from 'lucide-react';

const API_BASE = 'https://wms-neon-bridge.vercel.app/api/inventory';

function App() {
  /* ================= STATE ================= */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeMenu, setActiveMenu] = useState('Master Lokasi');
  const [masterTab, setMasterTab] = useState('grid'); 
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [newLoc, setNewLoc] = useState({ id: '', zone: '', aisle: '', unique: '', assign: 'closed' });
  const [selectedRows, setSelectedRows] = useState([]); 

  const [data, setData] = useState([]);
  const [snapData, setSnapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMobileHome, setShowMobileHome] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [mobLoc, setMobLoc] = useState('');
  const [mobArt, setMobArt] = useState('');
  const [mobQty, setMobQty] = useState('');
  const [locInfo, setLocInfo] = useState(null);
  const [selectedLoc2nd, setSelectedLoc2nd] = useState(null);
  const [showCompletePopup, setShowCompletePopup] = useState(false);
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

  /* ================= UTILS ================= */
  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };

  const formatWIB = (ts) => {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch (e) { return '-'; }
  };

  const getDesc = (item) => {
    if (!item) return '-';
    return item.description || item.DESCRIPTION || item.desc || item.nama_barang || '-';
  };

  /* ================= FETCH (FAST LOGIN) ================= */
  const fetchData = async () => {
    setLoading(true);
    try {
      const targetMap = {
        'Master Lokasi': masterTab === 'database' ? 'master_all' : 'master',
        'Snapshoot': 'snapshot_list',
        '1st Count': 'first', '2nt Count': isMobile ? 'recon' : 'second', 'Reconciliation': 'recon'
      };
      const res = await axios.get(`${API_BASE}?action=get_data&target=${targetMap[activeMenu]}`);
      setData(Array.isArray(res.data.data) ? res.data.data : []);
      
      // Background fetching data pendukung
      axios.get(`${API_BASE}?action=get_data&target=snapshot_list`).then(rs => setSnapData(Array.isArray(rs.data.data) ? rs.data.data : []));
      axios.get(`${API_BASE}?action=get_data&target=recon`).then(rr => window.reconCacheData = Array.isArray(rr.data.data) ? rr.data.data : []);
    } catch (e) { setData([]); }
    finally { setLoading(false); setSelectedRows([]); }
  };

  useEffect(() => { if (isLoggedIn) fetchData(); }, [activeMenu, masterTab, isLoggedIn]);

  /* ================= HANDLERS ================= */
  const handleToggle = async (uid, currentStatus) => {
    const nextStatus = currentStatus === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      setData(prev => prev.map(item => item.unique_id === uid ? {...item, assign: nextStatus} : item));
    } catch (e) { showToast("Toggle Failed", "error"); }
  };

  const handleAddLoc = async () => {
    if (!newLoc.id || !newLoc.unique) return showToast("Barcode & Group wajib isi", "error");
    try {
      await axios.post(`${API_BASE}?action=add_location`, { 
        location_id: newLoc.id.toUpperCase(), zone: newLoc.zone.toUpperCase(),
        aisle: newLoc.aisle, unique_id: newLoc.unique.toUpperCase(), assign: newLoc.assign
      });
      showToast("Added!"); setNewLoc({ id: '', zone: '', aisle: '', unique: '', assign: 'closed' });
      setShowAddForm(false); fetchData();
    } catch (e) { showToast("Add Failed", "error"); }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    if (!window.confirm(`Delete ${selectedRows.length} items?`)) return;
    try {
      setLoading(true);
      for (const id of selectedRows) { await axios.post(`${API_BASE}?action=delete_location`, { unique_id: id }); }
      showToast("Deleted!"); fetchData();
    } catch (e) { showToast("Error", "error"); }
    finally { setLoading(false); }
  };

  const handleSelectRow = (id) => setSelectedRows(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const handleSelectAll = () => {
    if (selectedRows.length === filteredData.length) setSelectedRows([]);
    else setSelectedRows(filteredData.map(d => d.location_id || d.unique_id));
  };

  const handleSaveInput = async () => {
    if (!mobLoc || !mobQty || !mobArt) return showToast("Incomplete", "error");
    const locU = mobLoc.trim().toUpperCase();
    const artU = mobArt.trim().toUpperCase();
    
    if (activeMenu === '1st Count' && (data || []).some(d => String(d.location_id).toUpperCase() === locU && String(d.artikel).toUpperCase() === artU)) {
      return showToast("Duplicate!", "error");
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}?action=save_input`, { location_id: locU, artikel: artU, qty: parseInt(mobQty), operator: user?.username, target_table: activeMenu });
      showToast("Saved!"); setMobArt(''); setMobQty(''); 
      
      let isFinished = true;
      if (activeMenu === '1st Count' && locInfo) {
        const remain = locInfo.filter(item => {
          const isDone = (data || []).some(d => String(d.location_id).toUpperCase() === locU && String(d.artikel).toUpperCase() === String(item.artikel).toUpperCase());
          return String(item.artikel).toUpperCase() !== artU && !isDone;
        });
        if (remain.length > 0) isFinished = false;
      } else if (activeMenu === '2nt Count') {
        const remain2nd = (window.reconCacheData || []).filter(d => String(d.location_id).toUpperCase() === locU && d.final_status === 'NEED 2ND COUNT' && String(d.artikel).toUpperCase() !== artU);
        if (remain2nd.length > 0) isFinished = false;
      }

      if (isFinished) {
        setMobLoc(''); setLocInfo(null); setSelectedLoc2nd(null);
        if (inputLocRef.current) setTimeout(() => inputLocRef.current.focus(), 50);
      } else {
        if (inputArtRef.current) setTimeout(() => inputArtRef.current.focus(), 50);
      }
      fetchData(); 
    } catch (e) { showToast("Failed", "error"); }
    finally { setLoading(false); }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data.status === 'success') { setUser(res.data.user); setIsLoggedIn(true); setShowMobileHome(true); }
      else showToast("Gagal Login", "error");
    } catch (e) { showToast("Error", "error"); }
    finally { setLoginLoading(false); }
  };

  const filteredData = (data || []).filter(item => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const loc = String(item.location_id || item.unique_id || '').toLowerCase();
    return loc.includes(s) || String(item.artikel || '').toLowerCase().includes(s) || getDesc(item).toLowerCase().includes(s);
  });

  /* ================= UI RENDER ================= */
  const badge1st = (window.reconCacheData || []).filter(d => d.final_status === 'NEED 1ST COUNT').length;
  const badge2nd = (window.reconCacheData || []).filter(d => d.final_status === 'NEED 2ND COUNT').length;

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
    return (
      <div style={mobileHomeLayout}>
        {toast.show && <div style={toastStyle(toast.type)}>{toast.msg}</div>}
        <div style={mobileHeader}><h2>COOL MOBILE</h2><p>{user?.full_name}</p></div>
        <div style={mobileMenuGrid}>
          <div style={menuCard} onClick={() => { setActiveMenu('1st Count'); setShowMobileHome(false); setSearchTerm(''); }}>
            <div style={{position:'relative'}}><ClipboardCheck size={28}/>{badge1st > 0 && <div style={badgeStyle}>{badge1st}</div>}</div>
            <span style={menuText}>1st Count</span>
          </div>
          <div style={menuCard} onClick={() => { setActiveMenu('2nt Count'); setShowMobileHome(false); setSearchTerm(''); }}>
            <div style={{position:'relative'}}><PackageCheck size={28}/>{badge2nd > 0 && <div style={badgeStyle}>{badge2nd}</div>}</div>
            <span style={menuText}>2nd Count</span>
          </div>
          <div style={menuCard} onClick={() => { setActiveMenu('Reconciliation'); setShowMobileHome(false); setSearchTerm(''); }}>
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
      
      {showCompletePopup && (
        <div style={popupOverlay} onClick={()=>setShowCompletePopup(false)}>
          <div style={popupContent}>
            <CheckCircle2 size={80} color="#16a34a" strokeWidth={3} />
            <h2 style={{fontWeight:900, marginTop:20}}>LOKASI SELESAI</h2>
            <button style={{...btnBlack, marginTop:25, width:120}} onClick={()=>setShowCompletePopup(false)}>OK</button>
          </div>
        </div>
      )}

      {/* SIDEBAR PC */}
      {!isMobile && (
        <nav style={sidebarStyle()}>
          <div style={{ padding: 20, fontWeight: 900 }}>COOL SYSTEM</div>
          {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
            <div key={m} onClick={() => { setActiveMenu(m); setSearchTab(m === 'Master Lokasi' ? 'grid' : ''); setSearchTerm(''); }} style={navItem(activeMenu === m)}>{m}</div>
          ))}
          <button onClick={() => setIsLoggedIn(false)} style={btnLogout}><LogOut size={14} /></button>
        </nav>
      )}

      <div style={contentArea(isMobile)}>
        <header style={headerStyle}>
          {isMobile && <button onClick={() => setShowMobileHome(true)} style={btnIcon}><ChevronLeft size={18}/></button>}
          <div style={{ fontWeight: '800' }}>{activeMenu.toUpperCase()}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isMobile && activeMenu === 'Master Lokasi' && masterTab === 'database' && (
              <>
                <button onClick={handleBulkDelete} disabled={selectedRows.length === 0} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> DELETE SELECTED ({selectedRows.length})</button>
                <button onClick={()=>setShowAddForm(true)} style={{...btnWhite, background:'#000', color:'#fff'}}><Plus size={12}/> ADD NEW</button>
              </>
            )}
            {!isMobile && activeMenu === 'Snapshoot' && (
              <>
                <label style={{...btnWhite, background:'#000', color:'#fff', cursor:'pointer'}}><Upload size={12}/> UPLOAD <input type="file" hidden onChange={handleFileUpload}/></label>
                <button onClick={() => { if(window.confirm("Clear all Snapshots?")) axios.post(`${API_BASE}?action=clear_snap`).then(()=>fetchData()); }} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> CLEAR</button>
              </>
            )}
            {activeMenu === 'Reconciliation' && !isMobile && (
              <button onClick={() => {
                const ws = XLSX.utils.json_to_sheet(data.map(r => ({ ...r, DIFF: (r.final_status === 'MATCH') ? 0 : (Number(r.qty_2nd || r.qty_1st || 0) - Number(r.qty_snap || 0)) })));
                const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Recon");
                XLSX.writeFile(wb, "COOL_RECON.xlsx");
              }} style={{...btnWhite, background:'#16a34a', color:'#fff'}}><Download size={12}/> EXPORT RECON</button>
            )}
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading?'animate-spin':''}/></button>
          </div>
        </header>

        {/* POPUP FORM ADD */}
        {showAddForm && (
          <div style={popupOverlay}>
            <div style={{...popupContent, textAlign:'left', padding:30}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:20}}><h3 style={{fontWeight:900}}>ADD NEW LOCATION</h3><button onClick={()=>setShowAddForm(false)} style={{border:'none', background:'none'}}><X size={20}/></button></div>
              <label style={labelStyle}>LOCATION ID (BARCODE)</label>
              <input style={mInput} value={newLoc.id} onChange={e=>setNewLoc({...newLoc, id: e.target.value})} placeholder="00104014" />
              <div style={{display:'flex', gap:10}}>
                <div style={{flex:1}}><label style={labelStyle}>ZONE</label><input style={mInput} value={newLoc.zone} onChange={e=>setNewLoc({...newLoc, zone: e.target.value})} placeholder="1A" /></div>
                <div style={{flex:1}}><label style={labelStyle}>AISLE</label><input style={mInput} type="number" value={newLoc.aisle} onChange={e=>setNewLoc({...newLoc, aisle: e.target.value})} placeholder="1" /></div>
              </div>
              <label style={labelStyle}>UNIQUE ID (GROUP)</label>
              <input style={mInput} value={newLoc.unique} onChange={e=>setNewLoc({...newLoc, unique: e.target.value})} placeholder="1A-1" />
              <label style={labelStyle}>STATUS</label>
              <select style={mInput} value={newLoc.assign} onChange={e=>setNewLoc({...newLoc, assign: e.target.value})}><option value="closed">CLOSED</option><option value="open">OPEN</option></select>
              <button onClick={handleAddLoc} style={{...btnBlack, marginTop:10}}>SAVE LOCATION</button>
            </div>
          </div>
        )}

        {!isMobile && activeMenu === 'Master Lokasi' && (
          <div style={{display:'flex', gap:15, marginBottom:20, borderBottom:'1px solid #eee'}}>
             <div onClick={()=>setMasterTab('grid')} style={tabItem(masterTab === 'grid')}><LayoutGrid size={14}/> GRID VIEW</div>
             <div onClick={()=>setMasterTab('database')} style={tabItem(masterTab === 'database')}><DbIcon size={14}/> DATABASE</div>
          </div>
        )}

        <div style={searchContainer}>
          <Search size={14} style={{position:'absolute', left: 10, top: 12, color:'#999'}} />
          <input placeholder="Search..." style={searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        {/* 1. GRID VIEW PC */}
        {!isMobile && activeMenu === 'Master Lokasi' && masterTab === 'grid' && (
          <div style={gridContainer()}>
            {filteredData.map((row, idx) => (
              <div key={idx} style={cardGrid}>
                <span style={{ fontWeight: '800', marginBottom: '5px' }}>{row.unique_id}</span>
                <div onClick={() => handleToggle(row.unique_id, row.assign)} style={toggleContainer(row.assign === 'open')}><div style={toggleCircle(row.assign === 'open')} /></div>
              </div>
            ))}
          </div>
        )}

        {/* 2. TABLE DATABASE & ALL PC TABLES */}
        {(!isMobile && (masterTab === 'database' || activeMenu !== 'Master Lokasi')) && (
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#fff' }}>
                <tr style={{ background: '#fafafa' }}>
                  {activeMenu === 'Master Lokasi' && <th style={thStyle}><input type="checkbox" onChange={handleSelectAll} checked={selectedRows.length === filteredData.length && filteredData.length > 0} /></th>}
                  <th style={thStyle}>LOKASI</th>
                  {activeMenu === 'Master Lokasi' ? (
                    <><th style={thStyle}>ZONE</th><th style={thStyle}>AISLE</th><th style={thStyle}>UNIQUE</th><th style={thStyle}>STATUS</th></>
                  ) : activeMenu === 'Reconciliation' ? (
                    <><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>DIFF</th><th style={thStyle}>STATUS</th></>
                  ) : (
                    <><th style={thStyle}>ARTIKEL</th><th style={thStyle}>QTY</th><th style={thStyle}>DESC</th></>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, i) => {
                  const actual = Number(row.qty_2nd || row.qty_1st || 0);
                  const diff = (row.final_status === 'MATCH') ? 0 : (actual - Number(row.qty_snap || 0));
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      {activeMenu === 'Master Lokasi' && <td style={tdStyle}><input type="checkbox" checked={selectedRows.includes(row.location_id || row.unique_id)} onChange={()=>handleSelectRow(row.location_id || row.unique_id)} /></td>}
                      <td style={tdStyle}>{row.location_id || row.unique_id}</td>
                      {activeMenu === 'Master Lokasi' ? (
                        <><td style={tdStyle}>{row.zone || '-'}</td><td style={tdStyle}>{row.aisle || '-'}</td><td style={tdStyle}>{row.unique_id}</td><td style={{...tdStyle, fontWeight:800, color: row.assign === 'open' ? 'green' : 'red'}}>{row.assign?.toUpperCase()}</td></>
                      ) : activeMenu === 'Reconciliation' ? (
                        <><td style={tdStyle}>{row.qty_snap}</td><td style={tdStyle}>{row.qty_1st}</td><td style={tdStyle}>{row.qty_2nd}</td><td style={{...tdStyle, fontWeight:900, color: diff !== 0 ? 'red' : 'green'}}>{diff > 0 ? `+${diff}` : diff}</td><td style={tdStyle}>{row.final_status}</td></>
                      ) : (
                        <><td style={tdStyle}>{row.artikel}</td><td style={tdStyle}>{row.qty_snap || row.qty_1st}</td><td style={tdDescSmall}>{getDesc(row)}</td></>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* MOBILE 1ST COUNT */}
        {activeMenu === '1st Count' && isMobile && (
          <div style={formWrapper}>
            {locInfo && (
              <div style={boxInfo}>
                <div style={boxTitle}>REF ({mobLoc})</div>
                {locInfo.map((item, idx) => {
                  const isDone = data.some(d => String(d.location_id).toUpperCase() === mobLoc.toUpperCase() && String(d.artikel).toUpperCase() === String(item.artikel).toUpperCase());
                  return (
                    <div key={idx} style={{...infoLine, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div><b>{item.artikel}</b><br/>Snap: {item.qty_snap}</div>
                      {isDone && <div style={circleCheck}><Check size={12} color="#fff" strokeWidth={4} /></div>}
                    </div>
                  );
                })}
              </div>
            )}
            <label style={labelStyle}>SCAN LOKASI</label>
            <input ref={inputLocRef} value={mobLoc} style={mInput} autoFocus onChange={e => {
                const v = e.target.value.toUpperCase(); setMobLoc(v);
                const items = snapData.filter(d => String(d.location_id).toUpperCase() === v);
                if (v.length > 0) {
                  setLocInfo(items.length > 0 ? items : []);
                  const needs = (window.reconCacheData || []).filter(d => String(d.location_id).toUpperCase() === v && d.final_status?.includes('NEED'));
                  if ((window.reconCacheData || []).some(x => String(x.location_id).toUpperCase() === v) && needs.length === 0) {
                    setShowCompletePopup(true); setMobLoc(''); setLocInfo(null);
                  } else if (items.length > 0) { setTimeout(() => { if (inputArtRef.current) inputArtRef.current.focus(); }, 50); }
                } else setLocInfo(null);
            }} />
            <label style={labelStyle}>SCAN ARTIKEL</label>
            <input ref={inputArtRef} value={mobArt} style={mInput} onChange={e => {
                const v = e.target.value.toUpperCase(); setMobArt(v);
                if(v.length >= 12) setTimeout(() => { if (inputQtyRef.current) inputQtyRef.current.focus(); }, 50);
            }} onKeyDown={e => { if(e.key === 'Enter') inputQtyRef.current?.focus(); }} />
            <label style={labelStyle}>QTY</label>
            <input ref={inputQtyRef} type="number" style={qtyInput} value={mobQty} onChange={e => setMobQty(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleSaveInput(); }} />
            <button onClick={handleSaveInput} style={btnBlack}>SAVE 1ST COUNT</button>
          </div>
        )}
        
        {/* MOBILE 2ND COUNT */}
        {activeMenu === '2nt Count' && isMobile && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <select style={mInput} value={selectedLoc2nd ? `${selectedLoc2nd.location_id}|${selectedLoc2nd.artikel}` : ""} onChange={e => {
                const [l, a] = e.target.value.split('|');
                const f = (window.reconCacheData || []).find(d => d.location_id === l && d.artikel === a);
                setSelectedLoc2nd(f); setMobArt(''); setMobLoc(l);
                setTimeout(() => { if (inputLocRef.current) inputLocRef.current.focus(); }, 100);
              }}>
                <option value="">-- CHOOSE NEED 2ND ({badge2nd}) --</option>
                {(window.reconCacheData || []).filter(d => d.final_status === 'NEED 2ND COUNT').map((t, i) => (
                  <option key={i} value={`${t.location_id}|${t.artikel}`}>{t.location_id} | {t.artikel}</option>
                ))}
              </select>
              {selectedLoc2nd && (
                <div style={formWrapper}>
                  <div style={boxInfoYellow}><b>{selectedLoc2nd.artikel}</b><br/>Snap: {selectedLoc2nd.qty_snap} | 1st: {selectedLoc2nd.qty_1st}</div>
                  <input ref={inputLocRef} placeholder="Validasi Lokasi" value={mobLoc} style={mInput} onChange={e => {
                    const v = e.target.value.toUpperCase(); setMobLoc(v);
                    if(v === selectedLoc2nd.location_id.toUpperCase()) inputArtRef.current?.focus();
                  }} />
                  <input ref={inputArtRef} placeholder="Validasi Artikel" value={mobArt} style={mInput} onChange={e => {
                    const v = e.target.value.toUpperCase(); setMobArt(v);
                    if(v === selectedLoc2nd.artikel.toUpperCase()) inputQtyRef.current?.focus();
                  }} />
                  <input ref={inputQtyRef} type="number" style={qtyInput} value={mobQty} onChange={e => setMobQty(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleSaveInput(); }} />
                  <button onClick={handleSaveInput} style={{...btnBlack, background:'#eab308'}}>SAVE 2ND COUNT</button>
                </div>
              )}
           </div>
        )}
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const tabItem = (a) => ({ padding: '10px 15px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 800, color: a ? '#000' : '#ccc', borderBottom: a ? '2px solid #000' : 'none', display: 'flex', alignItems: 'center', gap: 5 });
const searchContainer = { position: 'relative', marginBottom: '15px' };
const searchInput = { width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #eee', borderRadius: '8px', fontFamily: 'Lexend', fontSize: '0.7rem', boxSizing: 'border-box' };
const circleCheck = { width: 18, height: 18, borderRadius: 9, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const mainLayout = { display: 'flex', fontFamily: 'Lexend, sans-serif', backgroundColor: '#fff', minHeight: '100vh', fontSize: '0.7rem' };
const sidebarStyle = () => ({ width: 180, borderRight: '1px solid #eee', height: '100vh', position: 'fixed', backgroundColor: '#fff', zIndex: 10 });
const contentArea = (m) => ({ flex: 1, marginLeft: m ? 0 : 180, padding: m ? '15px' : '30px' });
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
const navItem = (a) => ({ padding: '15px 20px', cursor: 'pointer', color: a ? '#000' : '#ccc', fontWeight: a ? '800' : '400' });
const tableWrapper = { border: '1px solid #eee', borderRadius: '4px', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { padding: '10px', fontSize: '0.6rem', color: '#999', borderBottom: '1px solid #eee', textTransform: 'uppercase' };
const tdStyle = { padding: '10px' };
const tdDescSmall = { padding: '10px', fontSize: '0.65rem', color: '#999', textAlign: 'right' };
const mInput = { width: '100%', padding: '12px', border: '1px solid #eee', marginBottom: '10px', borderRadius: '8px', fontFamily: 'Lexend', fontSize: '0.75rem', boxSizing: 'border-box' };
const qtyInput = { ...mInput, fontSize: '1.8rem', fontWeight: 900, textAlign: 'center' };
const btnBlack = { display:'flex', alignItems:'center', justifyContent:'center', width: '100%', background: '#000', color: '#fff', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' };
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