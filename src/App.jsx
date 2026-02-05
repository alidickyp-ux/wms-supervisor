import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  RefreshCw, FileSpreadsheet, Trash2, Database, LogOut, Upload, Search,
  ChevronLeft, ClipboardCheck, PackageCheck, BarChart3, Download, XCircle, 
  CheckCircle2, AlertCircle, Loader2, Check
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
  const [data, setData] = useState([]);
  const [snapData, setSnapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMobileHome, setShowMobileHome] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  /* Mobile States */
  const [mobLoc, setMobLoc] = useState('');
  const [mobArt, setMobArt] = useState('');
  const [mobQty, setMobQty] = useState('');
  const [locInfo, setLocInfo] = useState(null);
  const [selectedLoc2nd, setSelectedLoc2nd] = useState(null);
  const [showCompletePopup, setShowCompletePopup] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  /* REFS */
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

  /* ================= FETCH ================= */
  const fetchData = async () => {
    setLoading(true);
    try {
      const targetMap = {
        'Master Lokasi': 'master', 'Snapshoot': 'snapshot_list',
        '1st Count': 'first', '2nt Count': isMobile ? 'recon' : 'second', 'Reconciliation': 'recon'
      };
      const res = await axios.get(`${API_BASE}?action=get_data&target=${targetMap[activeMenu]}`);
      const rawData = Array.isArray(res.data.data) ? res.data.data : [];
      setData(rawData);
      
      const resSnap = await axios.get(`${API_BASE}?action=get_data&target=snapshot_list`);
      setSnapData(Array.isArray(resSnap.data.data) ? resSnap.data.data : []);
      
      const resRecon = await axios.get(`${API_BASE}?action=get_data&target=recon`);
      window.reconCacheData = Array.isArray(resRecon.data.data) ? resRecon.data.data : [];
    } catch (e) { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isLoggedIn) fetchData(); }, [activeMenu, isLoggedIn]);

  /* ================= HANDLERS ================= */
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
        showToast("Snapshot Uploaded!"); fetchData();
      } catch (err) { showToast("Upload Failed", "error"); }
      finally { setLoading(false); e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveInput = async () => {
    if (!mobLoc || !mobQty || !mobArt) return showToast("Data Incomplete", "error");
    const locU = mobLoc.trim().toUpperCase();
    const artU = mobArt.trim().toUpperCase();

    // 1. PROTEKSI SCAN GANDA (Hanya untuk 1st Count)
    if (activeMenu === '1st Count') {
      const isExist = (data || []).some(d => 
        String(d.location_id).toUpperCase() === locU && 
        String(d.artikel).toUpperCase() === artU
      );
      if (isExist) return showToast("Item Already Scanned!", "error");
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}?action=save_input`, {
        location_id: locU, artikel: artU, qty: parseInt(mobQty), operator: user?.username, target_table: activeMenu
      });
      showToast("Data Saved Successfully!"); 
      setMobLoc(''); setMobArt(''); setMobQty(''); setLocInfo(null);
      await fetchData();
      setTimeout(() => inputLocRef.current?.focus(), 200);
    } catch (e) { showToast("Save Failed", "error"); }
    finally { setLoading(false); }
  };

  const handleToggle = async (uid, current) => {
    const nextStatus = current === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      fetchData();
    } catch (e) { showToast("Update Failed", "error"); }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data.status === 'success') { 
        setUser(res.data.user); setIsLoggedIn(true); setShowMobileHome(true);
      } else { showToast("Invalid Credentials", "error"); }
    } catch (e) { showToast("Server Error", "error"); }
    finally { setLoginLoading(false); }
  };

  /* ================= SEARCH FILTER LOGIC ================= */
  const filteredData = (data || []).filter(item => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      String(item.location_id || '').toLowerCase().includes(s) ||
      String(item.artikel || '').toLowerCase().includes(s) ||
      getDesc(item).toLowerCase().includes(s)
    );
  });

  /* ================= UI RENDER ================= */
  const badge1st = (window.reconCacheData || []).filter(d => d.final_status === 'NEED 1ST COUNT').length;
  const badge2nd = (window.reconCacheData || []).filter(d => d.final_status === 'NEED 2ND COUNT').length;

  if (!isLoggedIn) {
    return (
      <div style={loginPage}>
        {toast.show && <div style={toastStyle(toast.type)}>{toast.msg}</div>}
        <div style={loginCard}>
          <div style={loginHeader}>
            <h2 style={{fontWeight:900, fontSize:'1.2rem'}}>COOL SYSTEM</h2>
            <p style={{fontSize:'0.6rem', opacity:0.7}}>LOGISTICS MANAGEMENT</p>
          </div>
          <div style={{padding:'30px'}}>
            <input placeholder="Username" style={mInput} value={username} onChange={e=>setUsername(e.target.value)} />
            <input type="password" placeholder="Password" style={mInput} value={password} onChange={e=>setPassword(e.target.value)} />
            <button onClick={handleLogin} style={btnBlack}>
              {loginLoading ? <Loader2 className="animate-spin" size={18} /> : "LOGIN"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isMobile && showMobileHome) {
    return (
      <div style={mobileHomeLayout}>
        {toast.show && <div style={toastStyle(toast.type)}>{toast.msg}</div>}
        <div style={mobileHeader}>
          <h2 style={{fontWeight:900}}>COOL MOBILE</h2>
          <p style={{fontSize:'0.6rem', opacity:0.5}}>{user?.full_name}</p>
        </div>
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
        <button onClick={()=>setIsLoggedIn(false)} style={btnLogoutMobile}><LogOut size={16} /> Logout System</button>
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
            <h2 style={{fontWeight:900, marginTop:20, fontSize:'1.2rem'}}>LOKASI SELESAI</h2>
            <p style={{fontSize:'0.8rem', color:'#666', marginTop:10}}>Penghitungan di lokasi ini sudah sinkron / MATCH.</p>
            <button style={{...btnBlack, marginTop:25, width:'120px'}} onClick={()=>setShowCompletePopup(false)}>OK</button>
          </div>
        </div>
      )}

      {!isMobile && (
        <nav style={sidebarStyle()}>
          <div style={{ padding: '20px', fontWeight: '900', fontSize: '0.8rem' }}>COOL<div style={{fontSize:'0.6rem', fontWeight:400, opacity:0.6}}>{user?.full_name}</div></div>
          {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
            <div key={m} onClick={() => { setActiveMenu(m); setSearchTerm(''); }} style={navItem(activeMenu === m)}>{m}</div>
          ))}
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
                  <><label style={{...btnWhite, background:'#000', color:'#fff', cursor:'pointer'}}><Upload size={12}/> UPLOAD SNAP <input type="file" hidden accept=".xlsx" onChange={handleFileUpload}/></label>
                  <button onClick={() => { if(window.confirm("Clear all Snapshots?")) axios.post(`${API_BASE}?action=clear_snap`).then(()=>fetchData()); }} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> CLEAR</button></>
                )}
                {['1st Count', '2nt Count'].includes(activeMenu) && (
                  <><button onClick={() => {
                    const ws = XLSX.utils.json_to_sheet(data.map(r => ({ ...r, timestamp: formatWIB(r.timestamp) })));
                    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Data");
                    XLSX.writeFile(wb, `COOL_${activeMenu}.xlsx`);
                  }} style={{...btnWhite, color:'#16a34a'}}><FileSpreadsheet size={12}/> EXPORT</button>
                  <button onClick={() => { if(window.confirm("Clear this data?")) axios.post(`${API_BASE}?action=clear_${activeMenu === '1st Count' ? 'first' : 'second'}`).then(()=>fetchData()); }} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> CLEAR</button></>
                )}
                {activeMenu === 'Reconciliation' && (
                  <button onClick={() => {
                    const ws = XLSX.utils.json_to_sheet(data.map(r => {
                       const actual = (r.qty_2nd !== null && r.qty_2nd !== undefined && r.qty_2nd !== '') ? Number(r.qty_2nd) : Number(r.qty_1st || 0);
                       const dff = (r.final_status === 'MATCH') ? 0 : (actual - Number(r.qty_snap || 0));
                       return { ...r, DIFF: dff };
                    }));
                    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Recon");
                    XLSX.writeFile(wb, "COOL_RECON.xlsx");
                  }} style={{...btnWhite, background:'#16a34a', color:'#fff'}}><Download size={12}/> EXPORT RECON</button>
                )}
              </>
            )}
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading?'animate-spin':''}/></button>
          </div>
        </header>

        {/* SEARCH BAR (Hanya PC Semua Menu & Mobile Recon Only) */}
        {((!isMobile && activeMenu !== 'Master Lokasi') || (isMobile && activeMenu === 'Reconciliation')) && (
          <div style={searchContainer}>
            <Search size={14} style={{position:'absolute', left: 10, top: 12, color:'#999'}} />
            <input placeholder="Search article or location..." style={searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        )}

        {!isMobile && activeMenu === 'Master Lokasi' && (
          <div style={gridContainer()}>
            {(filteredData || []).map((row, idx) => (
              <div key={idx} style={cardGrid}>
                <span style={{ fontWeight: '800', marginBottom: '5px' }}>{row.unique_id}</span>
                <div onClick={() => handleToggle(row.unique_id, row.assign)} style={toggleContainer(row.assign === 'open')}>
                  <div style={toggleCircle(row.assign === 'open')} />
                </div>
              </div>
            ))}
          </div>
        )}

        {((!isMobile && activeMenu !== 'Master Lokasi') || (activeMenu === 'Reconciliation')) && (
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th>
                  {activeMenu === 'Snapshoot' ? <><th style={thStyle}>SNAP</th><th style={thStyle}>DESC</th></>
                  : activeMenu === 'Reconciliation' ? <><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>STATUS</th><th style={thStyle}>DIFF</th><th style={thStyle}>DESCRIPTION</th></>
                  : <><th style={thStyle}>DESC</th><th style={thStyle}>QTY</th><th style={thStyle}>OP</th></>}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, i) => {
                  const actual = (row.qty_2nd !== null && row.qty_2nd !== undefined && row.qty_2nd !== '') ? Number(row.qty_2nd) : Number(row.qty_1st || 0);
                  const diff = (row.final_status === 'MATCH') ? 0 : (actual - Number(row.qty_snap || 0));
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={tdStyle}>{row.location_id}</td><td style={tdStyle}>{row.artikel}</td>
                      {activeMenu === 'Snapshoot' ? <><td style={tdStyle}>{row.qty_snap}</td><td style={tdDescSmall}>{getDesc(row)}</td></>
                      : activeMenu === 'Reconciliation' ? (
                        <>
                          <td style={tdStyle}>{row.qty_snap}</td><td style={tdStyle}>{row.qty_1st || 0}</td><td style={tdStyle}>{row.qty_2nd || 0}</td>
                          <td style={{...tdStyle, fontWeight:800, fontSize:'0.6rem'}}>{row.final_status}</td>
                          <td style={{ ...tdStyle, color: diff !== 0 ? 'red' : 'green', fontWeight:900 }}>{diff > 0 ? `+${diff}` : diff}</td>
                          <td style={tdDescSmall}>{getDesc(row)}</td>
                        </>
                      ) : <><td style={tdDescSmall}>{getDesc(row)}</td><td style={tdStyle}>{row.qty_1st || row.qty_2nd}</td><td style={tdStyle}>{row.operator}</td></>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* --- MOBILE 1ST COUNT (FINAL LOGIC) --- */}
        {activeMenu === '1st Count' && isMobile && (
          <div style={formWrapper}>
            {locInfo && (
              <div style={boxInfo}>
                <div style={boxTitle}>REFERENCE ({mobLoc})</div>
                {locInfo.length === 0 ? (
                  <div style={infoLine}><b>NO SNAPSHOT DATA</b><br/><span style={{fontSize:'0.6rem', color:'#666'}}>Art: 0 | Desc: 0 | Snap Qty: 0</span></div>
                ) : (
                  locInfo.map((item, idx) => {
                    // LOGIKA CENTANG: Cek kombinasi Lokasi + Artikel
                    const isAlreadyScanned = data.some(d => 
                      String(d.location_id).toUpperCase() === mobLoc.toUpperCase() && 
                      String(d.artikel).toUpperCase() === String(item.artikel).toUpperCase()
                    );
                    return (
                      <div key={idx} style={{...infoLine, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div>
                          <b>{item.artikel}</b><br/>
                          <span style={{fontSize:'0.6rem', color:'#666'}}>{getDesc(item)}</span><br/>
                          Snap Qty: <b>{item.qty_snap}</b>
                        </div>
                        {isAlreadyScanned && <div style={circleCheck}><Check size={12} color="#fff" strokeWidth={4} /></div>}
                      </div>
                    );
                  })
                )}
              </div>
            )}
            <label style={labelStyle}>SCAN LOKASI</label>
            <input ref={inputLocRef} value={mobLoc} style={mInput} autoFocus onChange={e => {
                const v = e.target.value.toUpperCase(); setMobLoc(v);
                const items = snapData.filter(d => String(d.location_id).toUpperCase() === v);
                const needs = (window.reconCacheData || []).filter(d => String(d.location_id).toUpperCase() === v && d.final_status?.includes('NEED'));
                
                if (v.length > 0) {
                  // Munculkan info 0 jika lokasi baru
                  setLocInfo(items.length > 0 ? items : []);
                  
                  // LOGIKA KUNCI: Kunci jika MATCH atau jika lokasi baru sudah diisi
                  const isExisted = (window.reconCacheData || []).some(x => String(x.location_id).toUpperCase() === v);
                  if (isExisted && needs.length === 0) {
                    setShowCompletePopup(true); setMobLoc(''); setLocInfo(null);
                  } else if (items.length > 0) {
                    setTimeout(() => inputArtRef.current?.focus(), 100);
                  }
                } else { setLocInfo(null); }
            }} />
            <label style={labelStyle}>SCAN ARTIKEL</label>
            <input ref={inputArtRef} value={mobArt} style={mInput} onChange={e => {
                const v = e.target.value.toUpperCase(); setMobArt(v);
                if(v.length >= 12) setTimeout(() => inputQtyRef.current?.focus(), 100);
            }} onKeyDown={e => { if(e.key === 'Enter') inputQtyRef.current?.focus(); }} />
            <label style={labelStyle}>QTY</label>
            <input ref={inputQtyRef} type="number" style={qtyInput} value={mobQty} onChange={e => setMobQty(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleSaveInput(); }} />
            <button onClick={handleSaveInput} style={btnBlack}>SAVE 1ST COUNT</button>
          </div>
        )}
        
        {activeMenu === '2nt Count' && isMobile && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <select style={mInput} value={selectedLoc2nd ? `${selectedLoc2nd.location_id}|${selectedLoc2nd.artikel}` : ""} onChange={e => {
                const [l, a] = e.target.value.split('|');
                const f = (window.reconCacheData || []).find(d => d.location_id === l && d.artikel === a);
                setSelectedLoc2nd(f); setMobArt(''); setMobLoc('');
                setTimeout(() => inputLocRef.current?.focus(), 100);
              }}>
                <option value="">-- CHOOSE NEED 2ND ({badge2nd}) --</option>
                {(window.reconCacheData || []).filter(d => d.final_status === 'NEED 2ND COUNT').map((t, i) => (
                  <option key={i} value={`${t.location_id}|${t.artikel}`}>{t.location_id} | {t.artikel}</option>
                ))}
              </select>
              {selectedLoc2nd && (
                <div style={formWrapper}>
                  <div style={boxInfoYellow}>
                    <b>{selectedLoc2nd.artikel}</b><br/><span style={{fontSize:'0.6rem'}}>{getDesc(selectedLoc2nd)}</span><br/>Snap: {selectedLoc2nd.qty_snap} | 1st: {selectedLoc2nd.qty_1st}
                  </div>
                  <input ref={inputLocRef} placeholder="Validasi Lokasi" value={mobLoc} style={mInput} onChange={e => {
                    const v = e.target.value.toUpperCase(); setMobLoc(v);
                    if(v === selectedLoc2nd.location_id.toUpperCase()) inputArtRef.current?.focus();
                  }} />
                  <input ref={inputArtRef} placeholder="Validasi Artikel" value={mobArt} style={mInput} onChange={e => {
                    const v = e.target.value.toUpperCase(); setMobArt(v);
                    if(v.length >= 12 || v === selectedLoc2nd.artikel.toUpperCase()) inputQtyRef.current?.focus();
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
const searchContainer = { position: 'relative', marginBottom: '15px' };
const searchInput = { width: '100%', padding: '10px 10px 10px 35px', border: '1px solid #eee', borderRadius: '8px', fontFamily: 'Lexend', fontSize: '0.7rem', boxSizing: 'border-box' };
const circleCheck = { width: 18, height: 18, borderRadius: 9, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const mainLayout = { display: 'flex', fontFamily: 'Lexend, sans-serif', backgroundColor: '#fff', minHeight: '100vh', fontSize: '0.7rem' };
const sidebarStyle = () => ({ width: 180, borderRight: '1px solid #eee', height: '100vh', position: 'fixed', backgroundColor: '#fff', zIndex: 10 });
const contentArea = (m) => ({ flex: 1, marginLeft: m ? 0 : 180, padding: m ? '15px' : '30px' });
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
const navItem = (active) => ({ padding: '15px 20px', cursor: 'pointer', color: active ? '#000' : '#ccc', fontWeight: active ? '800' : '400' });
const tableWrapper = { border: '1px solid #eee', borderRadius: '4px', overflowX: 'auto' };
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
const btnLogoutMobile = { margin: '30px', border: 'none', background: 'none', color: 'red', fontWeight: 800 };
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
const toastStyle = (type) => ({ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: type === 'success' ? '#16a34a' : '#ef4444', color: '#fff', padding: '12px 25px', borderRadius: '50px', fontWeight: '800', zIndex: 9999, fontSize: '0.7rem' });

export default App;