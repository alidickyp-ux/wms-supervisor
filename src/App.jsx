import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  RefreshCw, FileSpreadsheet, Trash2, Database, LogOut, Upload,
  ChevronLeft, ClipboardCheck, PackageCheck, BarChart3, Download, XCircle
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

  /* Mobile States */
  const [mobLoc, setMobLoc] = useState('');
  const [mobArt, setMobArt] = useState('');
  const [mobQty, setMobQty] = useState('');
  const [locInfo, setLocInfo] = useState(null);
  const [selectedLoc2nd, setSelectedLoc2nd] = useState(null);
  const [showCompletePopup, setShowCompletePopup] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ================= UTILS ================= */
  const formatWIB = (ts) => {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch (e) { return '-'; }
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
      const resultData = res.data.data || [];
      setData(resultData);

      const resSnap = await axios.get(`${API_BASE}?action=get_data&target=snapshot_list`);
      setSnapData(resSnap.data.data || []);

      const resRecon = await axios.get(`${API_BASE}?action=get_data&target=recon`);
      window.reconCacheData = resRecon.data.data || [];
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
        alert("UPLOAD SUCCESS"); fetchData();
      } catch (err) { alert("FAILED"); }
      finally { setLoading(false); e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveInput = async () => {
    if (!mobLoc || !mobQty || !mobArt) return alert("LENGKAPI DATA!");
    const locU = mobLoc.trim().toUpperCase();
    const artU = mobArt.trim().toUpperCase();

    if (activeMenu === '1st Count') {
      const isExist = (data || []).some(d => d.location_id?.toUpperCase() === locU && d.artikel?.toUpperCase() === artU);
      if (isExist) return alert("SUDAH DI INPUT!");
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}?action=save_input`, {
        location_id: locU, artikel: artU, qty: parseInt(mobQty), operator: user?.username, target_table: activeMenu
      });
      alert("TERSIMPAN"); setMobLoc(''); setMobArt(''); setMobQty(''); setLocInfo(null);
      fetchData();
    } catch (e) { alert("GAGAL"); }
    finally { setLoading(false); }
  };

  const handleToggle = async (uid, current) => {
    const nextStatus = current === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      fetchData();
    } catch (e) { alert("TOGGLE GAGAL"); }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data.status === 'success') { setUser(res.data.user); setIsLoggedIn(true); }
      else { alert("LOGIN GAGAL"); }
    } catch (e) { alert("ERROR"); }
    finally { setLoginLoading(false); }
  };

  /* ================= UI LOGIC ================= */
  const badge1st = (window.reconCacheData || []).filter(d => d.final_status === 'NEED 1ST COUNT').length;
  const badge2nd = (window.reconCacheData || []).filter(d => d.final_status === 'NEED 2ND COUNT').length;

  if (!isLoggedIn) {
    return (
      <div style={loginPage}>
        <div style={loginCard}>
          <h2 style={{fontWeight:900, marginBottom:20, letterSpacing:'2px'}}>COOL SYSTEM</h2>
          <input placeholder="Username" style={mInput} value={username} onChange={e=>setUsername(e.target.value)} />
          <input type="password" placeholder="Password" style={mInput} value={password} onChange={e=>setPassword(e.target.value)} />
          <button onClick={handleLogin} style={btnBlack}>{loginLoading ? "..." : "LOGIN"}</button>
        </div>
      </div>
    );
  }

  if (isMobile && showMobileHome) {
    return (
      <div style={mobileHomeLayout}>
        <div style={mobileHeader}><h2 style={{fontWeight:900}}>COOL MOBILE</h2><p style={{fontSize:'0.6rem', opacity:0.5}}>{user?.full_name}</p></div>
        <div style={mobileMenuGrid}>
          <div style={menuCard} onClick={() => { setActiveMenu('1st Count'); setShowMobileHome(false); }}>
            <div style={{position:'relative'}}><ClipboardCheck size={28}/>{badge1st > 0 && <div style={badgeStyle}>{badge1st}</div>}</div>
            <span style={menuText}>1st Count</span>
          </div>
          <div style={menuCard} onClick={() => { setActiveMenu('2nt Count'); setShowMobileHome(false); }}>
            <div style={{position:'relative'}}><PackageCheck size={28}/>{badge2nd > 0 && <div style={badgeStyle}>{badge2nd}</div>}</div>
            <span style={menuText}>2nd Count</span>
          </div>
          <div style={menuCard} onClick={() => { setActiveMenu('Reconciliation'); setShowMobileHome(false); }}>
            <BarChart3 size={28} /> <span style={menuText}>Reconcile</span>
          </div>
        </div>
        <button onClick={()=>setIsLoggedIn(false)} style={btnLogoutMobile}><LogOut size={16} /> Logout System</button>
      </div>
    );
  }

  return (
    <div style={mainLayout}>
      {showCompletePopup && (
        <div style={popupOverlay} onClick={()=>setShowCompletePopup(false)}>
          <div style={popupContent}><XCircle size={100} color="#ef4444" /><h2 style={{fontWeight:900, marginTop:15}}>LOKASI COMPLETE</h2><p style={{fontSize:'0.7rem'}}>Semua tugas di lokasi ini sudah selesai dihitung.</p></div>
        </div>
      )}

      {!isMobile && (
        <nav style={sidebarStyle()}>
          <div style={{ padding: '20px', fontWeight: '900', fontSize: '0.8rem' }}>COOL<div style={{ fontSize: '0.6rem', fontWeight: '400', opacity: 0.6 }}>{user?.full_name}</div></div>
          {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
            <div key={m} onClick={() => setActiveMenu(m)} style={navItem(activeMenu === m)}>{m}</div>
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
                  <button onClick={()=>axios.post(`${API_BASE}?action=clear_snap`).then(()=>fetchData())} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> CLEAR</button></>
                )}
                {['1st Count', '2nt Count'].includes(activeMenu) && (
                  <><button onClick={() => {
                    const ws = XLSX.utils.json_to_sheet(data.map(r => ({ ...r, created_at: formatWIB(r.created_at || r.timestamp) })));
                    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Data");
                    XLSX.writeFile(wb, `COOL_${activeMenu}.xlsx`);
                  }} style={{...btnWhite, color:'#16a34a'}}><FileSpreadsheet size={12}/> EXPORT</button>
                  <button onClick={() => axios.post(`${API_BASE}?action=clear_${activeMenu === '1st Count' ? 'first' : 'second'}`).then(()=>fetchData())} style={{...btnWhite, color:'red'}}><Trash2 size={12}/> CLEAR</button></>
                )}
                {activeMenu === 'Reconciliation' && <button onClick={() => {
                   const ws = XLSX.utils.json_to_sheet(data.map(r => {
                      const finalVal = (r.qty_2nd !== null && r.qty_2nd !== undefined && r.qty_2nd !== '') ? Number(r.qty_2nd) : Number(r.qty_1st || 0);
                      const diff = (r.final_status === 'MATCH') ? 0 : (finalVal - Number(r.qty_snap || 0));
                      return { ...r, DIFF: diff };
                   }));
                   const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Recon");
                   XLSX.writeFile(wb, "COOL_RECON.xlsx");
                }} style={{...btnWhite, background:'#16a34a', color:'#fff'}}><Download size={12}/> EXPORT RECON</button>}
              </>
            )}
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading?'animate-spin':''}/></button>
          </div>
        </header>

        {/* MASTER LOKASI GRID (PC) */}
        {!isMobile && activeMenu === 'Master Lokasi' && (
          <div style={gridContainer()}>
            {data.map(row => (
              <div key={row.unique_id} style={cardGrid}>
                <span style={{ fontWeight: '800', marginBottom: '5px' }}>{row.unique_id}</span>
                <div onClick={() => handleToggle(row.unique_id, row.assign)} style={toggleContainer(row.assign === 'open')}>
                  <div style={toggleCircle(row.assign === 'open')} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TABLES (RECON PC & SNAP & ALL) */}
        {((!isMobile && activeMenu !== 'Master Lokasi') || (isMobile && activeMenu === 'Reconciliation')) && (
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th>
                  {activeMenu === 'Snapshoot' ? <><th style={thStyle}>QTY_SNAP</th><th style={thStyle}>DESCRIPTION</th></>
                  : activeMenu === 'Reconciliation' ? <><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>STATUS</th><th style={thStyle}>DIFF</th><th style={thStyle}>DESCRIPTION</th></>
                  : <><th style={thStyle}>DESCRIPTION</th><th style={thStyle}>QTY</th><th style={thStyle}>TIMESTAMP</th><th style={thStyle}>OPERATOR</th></>}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const finalVal = (row.qty_2nd !== null && row.qty_2nd !== undefined && row.qty_2nd !== '') ? Number(row.qty_2nd) : Number(row.qty_1st || 0);
                  const diff = (row.final_status === 'MATCH') ? 0 : (finalVal - Number(row.qty_snap || 0));
                  const isDiff = activeMenu === 'Reconciliation' && diff !== 0;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #eee', background: isDiff ? '#fff1f1' : 'transparent' }}>
                      <td style={tdStyle}>{row.location_id}</td><td style={tdStyle}>{row.artikel}</td>
                      {activeMenu === 'Snapshoot' ? <><td style={tdStyle}>{row.qty_snap}</td><td style={{...tdStyle, fontSize:'0.65rem', textAlign:'right', color:'#999'}}>{row.description || '-'}</td></>
                      : activeMenu === 'Reconciliation' ? <><td style={tdStyle}>{row.qty_snap}</td><td style={tdStyle}>{row.qty_1st}</td><td style={tdStyle}>{row.qty_2nd}</td><td style={{...tdStyle, fontWeight:800, fontSize:'0.6rem'}}>{row.final_status}</td><td style={{ ...tdStyle, color: diff !== 0 ? 'red' : 'green', fontWeight: '900' }}>{diff > 0 ? `+${diff}` : diff}</td><td style={{...tdStyle, fontSize:'0.65rem', textAlign:'right', color:'#999'}}>{row.description || '-'}</td></>
                      : <><td style={{...tdStyle, fontSize:'0.65rem', color:'#666'}}>{row.description || '-'}</td><td style={tdStyle}>{row.qty_1st || row.qty_2nd}</td><td style={tdStyle}>{formatWIB(row.created_at || row.timestamp)}</td><td style={tdStyle}>{row.operator || '-'}</td></>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 1ST COUNT MOBILE FORM */}
        {activeMenu === '1st Count' && isMobile && (
          <div style={formWrapper}>
            {locInfo && locInfo.length > 0 && (
              <div style={boxInfo}>
                <div style={boxTitle}>REFERENCE ({mobLoc})</div>
                {locInfo.map((item, idx) => (
                  <div key={idx} style={infoLine}><b>{item.artikel}</b><br/><span style={{fontSize:'0.6rem', color:'#666'}}>{item.description || '-'}</span><br/>Snap Qty: <b>{item.qty_snap}</b></div>
                ))}
              </div>
            )}
            <label style={labelStyle}>SCAN LOKASI</label>
            <input value={mobLoc} style={mInput} onChange={e => {
              const v = e.target.value.toUpperCase(); setMobLoc(v);
              const items = snapData.filter(d => String(d.location_id).toUpperCase() === v);
              const needs = (window.reconCacheData || []).filter(d => d.location_id?.toUpperCase() === v && (d.final_status === 'NEED 1ST COUNT' || d.final_status === 'NEED 2ND COUNT'));
              if (v.length > 0 && needs.length === 0 && (items.length > 0 || (window.reconCacheData || []).some(x => x.location_id?.toUpperCase() === v))) { 
                setShowCompletePopup(true); setMobLoc(''); setLocInfo(null); 
              } else { setLocInfo(items.length > 0 ? items : null); }
            }} />
            <label style={labelStyle}>SCAN ARTIKEL</label>
            <input value={mobArt} style={mInput} onChange={e => setMobArt(e.target.value.toUpperCase())} />
            <label style={labelStyle}>INPUT QTY</label>
            <input type="number" style={qtyInput} value={mobQty} onChange={e => setMobQty(e.target.value)} />
            <button onClick={handleSaveInput} style={btnBlack}>SAVE 1ST COUNT</button>
          </div>
        )}

        {/* 2ND COUNT MOBILE TASK */}
        {activeMenu === '2nt Count' && isMobile && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <select style={mInput} value={selectedLoc2nd ? `${selectedLoc2nd.location_id}|${selectedLoc2nd.artikel}` : ""} onChange={e => {
                const [l, a] = e.target.value.split('|');
                const f = (window.reconCacheData || []).find(d => d.location_id === l && d.artikel === a);
                setSelectedLoc2nd(f); setMobArt(''); setMobLoc('');
              }}>
                <option value="">-- CHOOSE NEED 2ND ({badge2nd}) --</option>
                {(window.reconCacheData || []).filter(d => d.final_status === 'NEED 2ND COUNT').map((t, i) => (
                  <option key={i} value={`${t.location_id}|${t.artikel}`}>{t.location_id} | {t.artikel}</option>
                ))}
              </select>
              {selectedLoc2nd && (
                <div style={formWrapper}>
                  <div style={boxInfoYellow}><b>{selectedLoc2nd.artikel}</b><br/>{selectedLoc2nd.description || 'No Desc'}<br/>Snap: {selectedLoc2nd.qty_snap} | 1st: {selectedLoc2nd.qty_1st}</div>
                  <input placeholder="Validasi Lokasi" value={mobLoc} style={mInput} onChange={e => setMobLoc(e.target.value.toUpperCase())} />
                  <input placeholder="Validasi Artikel" value={mobArt} style={mInput} onChange={e => setMobArt(e.target.value.toUpperCase())} />
                  <input type="number" style={qtyInput} value={mobQty} onChange={e => setMobQty(e.target.value)} />
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
const badgeStyle = { position:'absolute', top:-5, right:-10, background:'red', color:'white', fontSize:'0.6rem', minWidth:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, border:'2px solid #fff' };
const mainLayout = { display: 'flex', fontFamily: 'Lexend, sans-serif', backgroundColor: '#fff', minHeight: '100vh', fontSize: '0.7rem' };
const sidebarStyle = () => ({ width: 180, borderRight: '1px solid #eee', height: '100vh', position: 'fixed', backgroundColor: '#fff', zIndex: 10 });
const contentArea = (m) => ({ flex: 1, marginLeft: m ? 0 : 180, padding: m ? '15px' : '30px' });
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
const navItem = (active) => ({ padding: '15px 20px', cursor: 'pointer', color: active ? '#000' : '#ccc', fontWeight: active ? '800' : '400' });
const tableWrapper = { border: '1px solid #eee', borderRadius: '4px', overflowX: 'auto' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { padding: '12px 10px', fontSize: '0.6rem', color: '#999', borderBottom: '1px solid #eee', textTransform: 'uppercase' };
const tdStyle = { padding: '12px 10px' };
const mInput = { width: '100%', padding: '10px', border: '1px solid #eee', marginBottom: '10px', borderRadius: '6px', fontFamily: 'Lexend', fontSize: '0.75rem', boxSizing: 'border-box' };
const qtyInput = { ...mInput, fontSize: '1.8rem', fontWeight: 900, textAlign: 'center' };
const btnBlack = { width: '100%', background: '#000', color: '#fff', padding: '14px', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer' };
const btnWhite = { background: '#fff', border: '1px solid #eee', padding: '6px 12px', borderRadius: '4px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' };
const btnIcon = { background: '#fff', border: '1px solid #eee', padding: '6px', borderRadius: '4px', cursor: 'pointer' };
const btnLogout = { position: 'absolute', bottom: 20, width: '100%', border: 'none', background: 'none', color: 'red', fontWeight: 800 };
const loginPage = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f9f9f9' };
const loginCard = { width: '280px', padding: '30px', background: '#fff', border: '1px solid #eee', borderRadius: '8px', textAlign: 'center' };
const mobileHomeLayout = { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100vh', backgroundColor: '#fff', fontFamily: 'Lexend' };
const mobileHeader = { padding: '30px', textAlign: 'center', borderBottom: '1px solid #eee', width: '100%' };
const mobileMenuGrid = { display: 'grid', gridTemplateColumns: '1fr', gap: '15px', padding: '20px', width: '100%', boxSizing: 'border-box' };
const menuCard = { display: 'flex', alignItems: 'center', padding: '25px', border: '1px solid #eee', borderRadius: '12px', gap: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', cursor: 'pointer' };
const menuText = { fontWeight: '900', fontSize: '1.1rem' };
const btnLogoutMobile = { margin: '30px', border: 'none', background: 'none', color: 'red', fontWeight: 800 };
const formWrapper = { border: '1px solid #eee', padding: '15px', borderRadius: '8px', background: '#fafafa' };
const boxInfo = { background: '#f0f7ff', padding: '10px', marginBottom: '10px', borderRadius: '6px', fontSize: '0.65rem', border: '1px solid #cce5ff' };
const boxInfoYellow = { ...boxInfo, background: '#fffbeb', border: '1px solid #fde68a' };
const boxTitle = { fontWeight: '900', fontSize: '0.55rem', marginBottom: '5px', color: '#1e40af' };
const infoLine = { borderBottom: '1px solid #e2e8f0', padding: '5px 0' };
const labelStyle = { fontSize: '0.6rem', fontWeight: '800', color: '#999', marginBottom: '5px', display: 'block' };
const cardGrid = { border: '1px solid #eee', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '4px' };
const toggleContainer = (on) => ({ width: '34px', height: '18px', background: on ? '#000' : '#eee', borderRadius: '12px', position: 'relative', cursor: 'pointer' });
const toggleCircle = (on) => ({ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '19px' : '3px', transition: '0.2s' });
const popupOverlay = { position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const popupContent = { background:'#fff', padding:40, borderRadius:20, textAlign:'center', width:'85%', border:'3px solid #ef4444' };

export default App;