import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  RefreshCw,
  FileSpreadsheet,
  Trash2,
  Database,
  LogOut,
  Upload,
  ChevronLeft,
  ClipboardCheck,
  PackageCheck,
  BarChart3
} from 'lucide-react';

const API_BASE = 'https://wms-neon-bridge.vercel.app/api/inventory';

function App() {
  /* ================= AUTH STATE (FROM CODE BAGUS) ================= */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  /* ================= UI & DATA STATE ================= */
  const [activeMenu, setActiveMenu] = useState('Master Lokasi');
  const [data, setData] = useState([]);
  const [snapData, setSnapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMobileHome, setShowMobileHome] = useState(true);

  /* ================= INPUT STATE (MOBILE) ================= */
  const [mobLoc, setMobLoc] = useState('');
  const [mobArt, setMobArt] = useState('');
  const [mobQty, setMobQty] = useState('');
  const [locInfo, setLocInfo] = useState(null);
  const [selectedLoc2nd, setSelectedLoc2nd] = useState(null);

  /* ================= RESPONSIVE LOGIC ================= */
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ================= LOGIN HANDLER (FIXED) ================= */
  const handleLogin = async () => {
    if (!username || !password) return alert("ISI USERNAME & PASSWORD");
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data.status === 'success') {
        setUser(res.data.user);
        setIsLoggedIn(true);
        if (isMobile) setShowMobileHome(true);
      } else {
        alert(res.data.message || "LOGIN GAGAL");
      }
    } catch (e) {
      alert("LOGIN ERROR: Periksa kredensial Bos.");
    } finally {
      setLoginLoading(false);
    }
  };

  /* ================= FETCH DATA (FULL SYNC) ================= */
  const fetchData = async () => {
    setLoading(true);
    try {
      const targetMap = {
        'Master Lokasi': 'master',
        'Snapshoot': 'snapshot_list',
        '1st Count': 'first',
        '2nt Count': isMobile ? 'recon' : 'second',
        'Reconciliation': 'recon'
      };
      const res = await axios.get(`${API_BASE}?action=get_data&target=${targetMap[activeMenu]}`);
      setData(res.data.data || []);

      // Selalu fetch snapData untuk keperluan Box Info Mobile
      const resSnap = await axios.get(`${API_BASE}?action=get_data&target=snapshot_list`);
      setSnapData(resSnap.data.data || []);
    } catch (e) {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) fetchData();
  }, [activeMenu, isLoggedIn]);

  /* ================= OPERATIONAL HANDLERS ================= */
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoading(true);
        const dataArr = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(dataArr, { type: 'array' });
        const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        await axios.post(`${API_BASE}?action=upload_snap`, { data: excelData });
        alert("UPLOAD SUCCESS");
        fetchData();
      } catch (err) {
        alert("UPLOAD FAILED");
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveInput = async () => {
    if (!mobLoc || !mobQty || !mobArt) return alert("DATA HARUS LENGKAP!");
    const locU = mobLoc.trim().toUpperCase();
    const artU = mobArt.trim().toUpperCase();

    // 1. VALIDASI 1ST COUNT: Anti Input Ganda (Cek di data 'first')
    if (activeMenu === '1st Count') {
        const resCheck = await axios.get(`${API_BASE}?action=get_data&target=first`);
        const isExist = (resCheck.data.data || []).some(d => 
            String(d.location_id).toUpperCase() === locU && 
            String(d.artikel).toUpperCase() === artU
        );
        if (isExist) return alert("SUDAH DI INPUT!");
    }

    // 2. VALIDASI 2ND COUNT: Wajib cocok dengan target task
    if (activeMenu === '2nt Count' && selectedLoc2nd) {
      if (locU !== selectedLoc2nd.location_id.toUpperCase() || artU !== selectedLoc2nd.artikel.toUpperCase()) {
        return alert("VALIDASI GAGAL: Lokasi/Artikel tidak sesuai target!");
      }
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}?action=save_input`, {
        location_id: locU,
        artikel: artU,
        qty: parseInt(mobQty),
        operator: user?.username || 'Admin',
        target_table: activeMenu
      });
      alert("DATA DISIMPAN");
      setMobLoc(''); setMobQty(''); setMobArt(''); setLocInfo(null); setSelectedLoc2nd(null);
      fetchData();
    } catch (e) {
      alert("GAGAL SIMPAN");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (uid, current) => {
    const nextStatus = current === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      fetchData();
    } catch (e) {
      alert("TOGGLE GAGAL");
    }
  };

  /* ================= FILTER TASK LIST 2ND ================= */
  const taskList2nd = data.filter(d => String(d.final_status).toUpperCase().includes('NEED 2ND COUNT'));

  /* ================= UI RENDERING ================= */
  if (!isLoggedIn) {
    return (
      <div style={loginPage}>
        <div style={loginCard}>
          <h2 style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '20px', letterSpacing: '2px' }}>COOL SYSTEM</h2>
          <input placeholder="Username" style={mInput} value={username} onChange={e => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" style={mInput} value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={handleLogin} style={btnBlack}>{loginLoading ? "AUTH..." : "LOGIN"}</button>
        </div>
      </div>
    );
  }

  // MOBILE HOME VIEW
  if (isMobile && showMobileHome) {
    return (
      <div style={mobileHomeLayout}>
        <div style={mobileHeader}>
          <h2 style={{ fontWeight: 900, fontSize: '1.1rem' }}>COOL MOBILE</h2>
          <p style={{ fontSize: '0.6rem', opacity: 0.5 }}>{user?.full_name}</p>
        </div>
        <div style={mobileMenuGrid}>
          <div style={menuCard} onClick={() => { setActiveMenu('1st Count'); setShowMobileHome(false); }}>
            <ClipboardCheck size={28} /> <span style={menuText}>1st Count</span>
          </div>
          <div style={menuCard} onClick={() => { setActiveMenu('2nt Count'); setShowMobileHome(false); }}>
            <PackageCheck size={28} /> <span style={menuText}>2nd Count</span>
          </div>
          <div style={menuCard} onClick={() => { setActiveMenu('Reconciliation'); setShowMobileHome(false); }}>
            <BarChart3 size={28} /> <span style={menuText}>Reconcile</span>
          </div>
        </div>
        <button onClick={() => setIsLoggedIn(false)} style={btnLogoutMobile}><LogOut size={16} /> Logout</button>
      </div>
    );
  }

  return (
    <div style={mainLayout}>
      {!isMobile && (
        <nav style={sidebarStyle(isMobile)}>
          <div style={{ padding: '20px', fontWeight: '900', fontSize: '0.8rem' }}>
            COOL
            <div style={{ fontSize: '0.6rem', fontWeight: '400', opacity: 0.6 }}>{user?.full_name}</div>
          </div>
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
                  <label style={{ ...btnWhite, background: '#000', color: '#fff' }}><Upload size={12}/> UPLOAD <input type="file" hidden accept=".xlsx" onChange={handleFileUpload} /></label>
                )}
                {activeMenu === '1st Count' && (
                  <button onClick={() => { if(window.confirm("KOSONGKAN 1ST?")) axios.post(`${API_BASE}?action=clear_first`).then(()=>fetchData()) }} style={{ ...btnWhite, color: 'red' }}><Trash2 size={12}/> KOSONGKAN 1ST</button>
                )}
                {activeMenu === '2nt Count' && (
                  <button onClick={() => { if(window.confirm("KOSONGKAN 2ND?")) axios.post(`${API_BASE}?action=clear_second`).then(()=>fetchData()) }} style={{ ...btnWhite, color: 'red' }}><Trash2 size={12}/> KOSONGKAN 2ND</button>
                )}
              </>
            )}
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        {/* 1ST COUNT MOBILE FORM */}
        {activeMenu === '1st Count' && isMobile && (
          <div style={formWrapper}>
            {locInfo && locInfo.length > 0 && (
              <div style={boxInfo}>
                <div style={boxTitle}>SNAPSHOT REFERENCE ({mobLoc})</div>
                {locInfo.map((item, idx) => (
                  <div key={idx} style={infoLine}>
                    <b>{item.artikel}</b> - {item.description || '-'}<br/>
                    Snap Qty: <b>{item.qty_snap}</b>
                  </div>
                ))}
              </div>
            )}
            <label style={labelStyle}>SCAN LOKASI</label>
            <input value={mobLoc} style={mInput} onChange={e => {
              const val = e.target.value.toUpperCase();
              setMobLoc(val);
              setLocInfo(snapData.filter(d => String(d.location_id).toUpperCase() === val));
            }} />
            <label style={labelStyle}>SCAN ARTIKEL/SKU</label>
            <input value={mobArt} style={mInput} onChange={e => setMobArt(e.target.value.toUpperCase())} />
            <label style={labelStyle}>QTY</label>
            <input type="number" style={qtyInput} value={mobQty} onChange={e => setMobQty(e.target.value)} />
            <button onClick={handleSaveInput} style={btnBlack}>SAVE 1ST COUNT</button>
          </div>
        )}

        {/* 2ND COUNT MOBILE TASK */}
        {activeMenu === '2nt Count' && isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <select style={mInput} onChange={(e) => {
              const [loc, art] = e.target.value.split('|');
              const found = taskList2nd.find(d => d.location_id === loc && d.artikel === art);
              setSelectedLoc2nd(found); setMobLoc(''); setMobArt('');
            }}>
              <option value="">-- CHOOSE NEED 2ND COUNT ({taskList2nd.length}) --</option>
              {taskList2nd.map((t, i) => <option key={i} value={`${t.location_id}|${t.artikel}`}>{t.location_id} | {t.artikel}</option>)}
            </select>
            {selectedLoc2nd && (
              <div style={formWrapper}>
                <div style={boxInfoYellow}>
                    <b>{selectedLoc2nd.artikel}</b><br/>{selectedLoc2nd.description}<br/>
                    Snap: {selectedLoc2nd.qty_snap} | 1st: {selectedLoc2nd.qty_1st}
                </div>
                <label style={labelStyle}>VALIDATE LOKASI ({selectedLoc2nd.location_id})</label>
                <input value={mobLoc} style={mInput} onChange={e => setMobLoc(e.target.value.toUpperCase())} />
                <label style={labelStyle}>VALIDATE ARTIKEL ({selectedLoc2nd.artikel})</label>
                <input value={mobArt} style={mInput} onChange={e => setMobArt(e.target.value.toUpperCase())} />
                <label style={labelStyle}>FINAL QTY</label>
                <input type="number" style={qtyInput} value={mobQty} onChange={e => setMobQty(e.target.value)} />
                <button onClick={handleSaveInput} style={btnBlack}>SAVE 2ND COUNT</button>
              </div>
            )}
          </div>
        )}

        {/* MASTER LOKASI (PC ONLY) */}
        {!isMobile && activeMenu === 'Master Lokasi' && (
          <div style={gridContainer(isMobile)}>
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

        {/* TABLES (RECON HP & ALL PC) */}
        {((!isMobile && activeMenu !== 'Master Lokasi') || (isMobile && activeMenu === 'Reconciliation')) && (
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th>
                  {activeMenu === 'Reconciliation' ? <><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>STATUS</th><th style={thStyle}>DIFF</th></> : <th style={thStyle}>QTY</th>}
                  <th style={thStyle}>DESCRIPTION</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const finalVal = Number(row.qty_2nd) > 0 || row.qty_2nd === 0 ? Number(row.qty_2nd) : Number(row.qty_1st || 0);
                  const diff = finalVal - Number(row.qty_snap || 0);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={tdStyle}>{row.location_id}</td><td style={tdStyle}>{row.artikel}</td>
                      {activeMenu === 'Reconciliation' ? (
                        <><td style={tdStyle}>{row.qty_snap}</td><td style={tdStyle}>{row.qty_1st}</td><td style={tdStyle}>{row.qty_2nd}</td><td style={tdStyle}>{row.final_status}</td><td style={{ ...tdStyle, color: diff !== 0 ? 'red' : 'green', fontWeight: '800' }}>{diff}</td></>
                      ) : <td style={tdStyle}>{row.qty_snap || row.qty_1st}</td>}
                      <td style={{ ...tdStyle, fontSize: '0.65rem', color: '#999', textAlign: 'right' }}>{row.description || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const mainLayout = { display: 'flex', fontFamily: 'Lexend, sans-serif', backgroundColor: '#fff', minHeight: '100vh', fontSize: '0.75rem' };
const sidebarStyle = (m) => ({ width: 180, borderRight: '1px solid #eee', height: '100vh', position: 'fixed', backgroundColor: '#fff', zIndex: 10 });
const contentArea = (m) => ({ flex: 1, marginLeft: m ? 0 : 180, padding: m ? '15px' : '20px' });
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
const navItem = (active) => ({ padding: '15px 20px', cursor: 'pointer', color: active ? '#000' : '#ccc', fontWeight: active ? '800' : '400', fontSize: '0.65rem' });
const gridContainer = (m) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(80px, 1fr))`, gap: '15px' });
const cardGrid = { border: '1px solid #eee', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '4px' };
const tableWrapper = { border: '1px solid #eee', borderRadius: '4px', overflowX: 'auto' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { padding: '12px 10px', fontSize: '0.6rem', color: '#999', borderBottom: '1px solid #eee', textTransform: 'uppercase' };
const tdStyle = { padding: '12px 10px' };
const mInput = { width: '100%', padding: '10px', border: '1px solid #eee', marginBottom: '10px', borderRadius: '4px', fontFamily: 'Lexend', fontSize: '0.75rem', boxSizing: 'border-box' };
const qtyInput = { ...mInput, fontSize: '1.8rem', fontWeight: 900, textAlign: 'center' };
const btnBlack = { width: '100%', background: '#000', color: '#fff', padding: '12px', border: 'none', borderRadius: '4px', fontWeight: '800', cursor: 'pointer' };
const btnWhite = { background: '#fff', border: '1px solid #eee', padding: '6px 12px', borderRadius: '4px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '5px' };
const btnIcon = { background: '#fff', border: '1px solid #eee', padding: '6px', borderRadius: '4px', cursor: 'pointer' };
const btnLogout = { position: 'absolute', bottom: '20px', width: '100%', border: 'none', background: 'none', color: 'red', cursor: 'pointer' };
const toggleContainer = (on) => ({ width: '34px', height: '18px', background: on ? '#000' : '#eee', borderRadius: '12px', position: 'relative', cursor: 'pointer' });
const toggleCircle = (on) => ({ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '19px' : '3px', transition: '0.2s' });
const loginPage = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f9f9f9' };
const loginCard = { width: '280px', padding: '30px', background: '#fff', border: '1px solid #eee', borderRadius: '8px', textAlign: 'center' };
const labelStyle = { fontSize: '0.6rem', fontWeight: '800', color: '#999', marginBottom: '5px', display: 'block' };

// MOBILE HOME STYLES
const mobileHomeLayout = { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100vh', backgroundColor: '#fff', fontFamily: 'Lexend' };
const mobileHeader = { padding: '30px 20px', textAlign: 'center', borderBottom: '1px solid #eee', width: '100%' };
const mobileMenuGrid = { display: 'grid', gridTemplateColumns: '1fr', gap: '15px', padding: '20px', width: '100%', boxSizing: 'border-box' };
const menuCard = { display: 'flex', alignItems: 'center', padding: '20px', border: '1px solid #eee', borderRadius: '12px', gap: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' };
const menuText = { fontWeight: '900', fontSize: '1rem' };
const btnLogoutMobile = { margin: '30px', border: 'none', background: 'none', color: 'red', fontWeight: 800 };
const formWrapper = { border: '1px solid #eee', padding: '15px', borderRadius: '8px', background: '#fafafa' };
const boxInfo = { background: '#f0f7ff', padding: '10px', marginBottom: '10px', borderRadius: '6px', fontSize: '0.65rem', border: '1px solid #cce5ff' };
const boxInfoYellow = { ...boxInfo, background: '#fffbeb', border: '1px solid #fde68a' };
const boxTitle = { fontWeight: '900', fontSize: '0.55rem', marginBottom: '5px', color: '#1e40af' };
const infoLine = { borderBottom: '1px solid #e2e8f0', padding: '5px 0' };

export default App;