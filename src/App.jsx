import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  RefreshCw,
  FileSpreadsheet,
  Trash2,
  Database,
  LogOut,
  Upload
} from 'lucide-react';

const API_BASE = 'https://wms-neon-bridge.vercel.app/api/inventory';

function App() {
  /* ================= AUTH STATE ================= */
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

  /* ================= LOGIN HANDLER ================= */
  const handleLogin = async () => {
    if (!username || !password) return alert("ISI USERNAME & PASSWORD");
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data.status === 'success') {
        setUser(res.data.user);
        setIsLoggedIn(true);
      } else {
        alert(res.data.message || "LOGIN GAGAL");
      }
    } catch (e) {
      alert("LOGIN ERROR: Periksa koneksi atau kredensial.");
    } finally {
      setLoginLoading(false);
    }
  };

  /* ================= FETCH DATA ================= */
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

      if (isMobile) {
        const resSnap = await axios.get(`${API_BASE}?action=get_data&target=snapshot_list`);
        setSnapData(resSnap.data.data || []);
      }
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
    
    // Validasi tambahan untuk 2nd Count di Mobile
    if (activeMenu === '2nt Count' && selectedLoc2nd) {
      if (mobLoc.toUpperCase() !== selectedLoc2nd.location_id.toUpperCase()) {
        return alert("LOKASI TIDAK SESUAI TARGET!");
      }
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}?action=save_input`, {
        location_id: mobLoc.trim().toUpperCase(),
        artikel: mobArt.trim().toUpperCase(),
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

  /* ================= TASK LIST 2ND (MOBILE) ================= */
  const taskList2nd = data.filter(d => 
    String(d.final_status || '').toUpperCase().match(/NEED|SHORT|EXCESS|DISCREPANCY/)
  );

  /* ================= LOGIN UI ================= */
  if (!isLoggedIn) {
    return (
      <div style={loginPage}>
        <div style={loginCard}>
          <h2 style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '20px', letterSpacing: '2px' }}>COOL SYSTEM</h2>
          <input 
            placeholder="Username" 
            style={mInput} 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="Password" 
            style={mInput} 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
          />
          <button onClick={handleLogin} style={btnBlack} disabled={loginLoading}>
            {loginLoading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
          </button>
        </div>
      </div>
    );
  }

  /* ================= MAIN DASHBOARD UI ================= */
  return (
    <div style={mainLayout}>
      <nav style={sidebarStyle(isMobile)}>
        <div style={{ padding: '20px', fontWeight: '900', fontSize: '0.8rem' }}>
          COOL
          <div style={{ fontSize: '0.6rem', fontWeight: '400', opacity: 0.6 }}>{user?.full_name || user?.username}</div>
        </div>
        {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
          <div key={m} onClick={() => { setActiveMenu(m); setLocInfo(null); setSelectedLoc2nd(null); }} style={navItem(activeMenu === m)}>
            {isMobile ? m.charAt(0) : m}
          </div>
        ))}
        <button onClick={() => setIsLoggedIn(false)} style={btnLogout}><LogOut size={14} /> {!isMobile && 'Logout'}</button>
      </nav>

      <div style={contentArea(isMobile)}>
        <header style={headerStyle}>
          <div style={{ fontWeight: '800' }}>{activeMenu.toUpperCase()}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isMobile && (
              <>
                {activeMenu === 'Snapshoot' && (
                  <>
                    <button onClick={() => { if(window.confirm("CLEAR ALL SNAP DATA?")) axios.post(`${API_BASE}?action=clear_snap`).then(()=>fetchData()) }} style={{ ...btnWhite, color: '#ef4444' }}><Trash2 size={12}/> CLEAR SNAP</button>
                    <label style={{ ...btnWhite, background: '#000', color: '#fff', cursor: 'pointer' }}><Upload size={12}/> UPLOAD SNAP <input type="file" hidden accept=".xlsx" onChange={handleFileUpload} /></label>
                  </>
                )}
                {activeMenu === '1st Count' && (
                  <button onClick={() => { if(window.confirm("KOSONGKAN DATA 1ST COUNT?")) axios.post(`${API_BASE}?action=clear_first`).then(()=>fetchData()) }} style={{ ...btnWhite, color: '#ef4444' }}><Trash2 size={12}/> KOSONGKAN 1ST</button>
                )}
                {activeMenu === '2nt Count' && (
                  <button onClick={() => { if(window.confirm("KOSONGKAN DATA 2ND COUNT?")) axios.post(`${API_BASE}?action=clear_second`).then(()=>fetchData()) }} style={{ ...btnWhite, color: '#ef4444' }}><Trash2 size={12}/> KOSONGKAN 2ND</button>
                )}
              </>
            )}
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        {/* --- GRID MASTER LOKASI --- */}
        {activeMenu === 'Master Lokasi' && (
          <div style={gridContainer(isMobile)}>
            {data.map(row => (
              <div key={row.unique_id || row.unique_id_id} style={cardGrid}>
                <span style={{ fontWeight: '800', fontSize: '0.7rem', marginBottom: '5px' }}>{row.unique_id_id}</span>
                <div onClick={() => handleToggle(row.unique_id, row.assign)} style={toggleContainer(row.assign === 'open')}>
                  <div style={toggleCircle(row.assign === 'open')} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- MOBILE: 1ST COUNT FORM --- */}
        {activeMenu === '1st Count' && isMobile && (
          <div style={formWrapper}>
            {locInfo && (
              <div style={boxContent}>
                <div style={boxTitle}>CONTENT ({mobLoc}):</div>
                {locInfo.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '5px 0' }}>
                    <span>{item.artikel}</span><span>Snap: <b>{item.qty_snap}</b></span>
                  </div>
                ))}
              </div>
            )}
            <label style={labelStyle}>SCAN LOCATION</label>
            <input 
              value={mobLoc} 
              style={mInput}
              onChange={e => {
                const val = e.target.value.toUpperCase();
                setMobLoc(val);
                const items = snapData.filter(d => String(d.location_id).toUpperCase() === val);
                setLocInfo(items.length > 0 ? items : null);
              }} 
            />
            <label style={labelStyle}>ARTICLE ID</label>
            <input value={mobArt} style={mInput} onChange={e => setMobArt(e.target.value.toUpperCase())} />
            <label style={labelStyle}>QUANTITY</label>
            <input type="number" style={qtyInput} value={mobQty} onChange={e => setMobQty(e.target.value)} />
            <button onClick={handleSaveInput} style={btnBlack}>SAVE DATA 1ST</button>
          </div>
        )}

        {/* --- MOBILE: 2ND COUNT TASK --- */}
        {activeMenu === '2nt Count' && isMobile && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <select style={mInput} onChange={(e) => {
                const [loc, art] = e.target.value.split('|');
                const found = taskList2nd.find(d => d.location_id === loc && d.artikel === art);
                setSelectedLoc2nd(found); setMobArt(found?.artikel || ''); setMobLoc('');
              }}>
                <option value="">-- CHOOSE DISCREPANCY --</option>
                {taskList2nd.map((t, i) => <option key={i} value={`${t.location_id}|${t.artikel}`}>{t.location_id} | {t.artikel}</option>)}
              </select>
              {selectedLoc2nd && (
                <div style={formWrapper}>
                  <div style={boxContent}><b>{selectedLoc2nd.artikel}</b><br/>Snap: {selectedLoc2nd.qty_snap} | 1st: {selectedLoc2nd.qty_1st}</div>
                  <label style={labelStyle}>VALIDATE LOCATION</label>
                  <input value={mobLoc} style={mInput} onChange={e => setMobLoc(e.target.value.toUpperCase())} placeholder="Scan location..." />
                  <label style={labelStyle}>FINAL QTY</label>
                  <input type="number" style={qtyInput} value={mobQty} onChange={e => setMobQty(e.target.value)} />
                  <button onClick={handleSaveInput} style={btnBlack}>SAVE 2ND COUNT</button>
                </div>
              )}
           </div>
        )}

        {/* --- TABLE: DATA VIEWS (PC & RECONCILIATION) --- */}
        {((!isMobile && activeMenu !== 'Master Lokasi') || (isMobile && activeMenu === 'Reconciliation')) && (
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa' }}>
                  <th style={thStyle}>LOKASI</th>
                  <th style={thStyle}>ARTIKEL</th>
                  {activeMenu === 'Reconciliation' ? (
                    <><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>STATUS</th><th style={thStyle}>DIFF</th></>
                  ) : <th style={thStyle}>QTY</th>}
                  <th style={thStyle}>DESCRIPTION</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const finalVal = Number(row.qty_2nd) > 0 || row.qty_2nd === 0 ? Number(row.qty_2nd) : Number(row.qty_1st || 0);
                  const diff = finalVal - Number(row.qty_snap || 0);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={tdStyle}>{row.location_id}</td>
                      <td style={tdStyle}>{row.artikel}</td>
                      {activeMenu === 'Reconciliation' ? (
                        <>
                          <td style={tdStyle}>{row.qty_snap}</td>
                          <td style={tdStyle}>{row.qty_1st}</td>
                          <td style={tdStyle}>{row.qty_2nd}</td>
                          <td style={tdStyle}>{row.final_status}</td>
                          <td style={{ ...tdStyle, color: diff !== 0 ? 'red' : 'green', fontWeight: '800' }}>{diff}</td>
                        </>
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
const sidebarStyle = (isMobile) => ({ width: isMobile ? '50px' : '180px', borderRight: '1px solid #eee', height: '100vh', position: 'fixed', backgroundColor: '#fff', zIndex: 10 });
const contentArea = (isMobile) => ({ flex: 1, marginLeft: isMobile ? '50px' : '180px', padding: isMobile ? '15px' : '30px' });
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '10px', borderBottom: '1px solid #eee' };
const navItem = (active) => ({ padding: '15px 20px', cursor: 'pointer', color: active ? '#000' : '#ccc', fontWeight: active ? '800' : '400', fontSize: '0.65rem' });
const gridContainer = (isMobile) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '80px' : '110px'}, 1fr))`, gap: '15px' });
const cardGrid = { border: '1px solid #eee', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '4px' };
const tableWrapper = { border: '1px solid #eee', borderRadius: '4px', overflowX: 'auto' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { padding: '12px 10px', fontSize: '0.6rem', color: '#999', borderBottom: '1px solid #eee', textTransform: 'uppercase' };
const tdStyle = { padding: '12px 10px' };
const mInput = { width: '100%', padding: '10px', border: '1px solid #eee', marginBottom: '10px', borderRadius: '4px', fontFamily: 'Lexend', fontSize: '0.75rem' };
const qtyInput = { ...mInput, fontSize: '1.8rem', fontWeight: 900, textAlign: 'center' };
const boxContent = { background: '#f0f7ff', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #cce5ff' };
const boxTitle = { fontWeight: '900', fontSize: '0.6rem', marginBottom: '5px' };
const btnBlack = { width: '100%', background: '#000', color: '#fff', padding: '12px', border: 'none', borderRadius: '4px', fontWeight: '800', cursor: 'pointer' };
const btnWhite = { background: '#fff', border: '1px solid #eee', padding: '6px 12px', borderRadius: '4px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' };
const btnIcon = { background: '#fff', border: '1px solid #eee', padding: '6px', borderRadius: '4px', cursor: 'pointer' };
const btnLogout = { position: 'absolute', bottom: '20px', width: '100%', border: 'none', background: 'none', color: '#ef4444', fontWeight: '800', cursor: 'pointer' };
const toggleContainer = (on) => ({ width: '34px', height: '18px', background: on ? '#000' : '#eee', borderRadius: '12px', position: 'relative', cursor: 'pointer' });
const toggleCircle = (on) => ({ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '19px' : '3px', transition: '0.2s' });
const loginPage = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9' };
const loginCard = { width: '300px', padding: '40px', background: '#fff', border: '1px solid #eee', borderRadius: '8px', textAlign: 'center' };
const labelStyle = { fontSize: '0.6rem', fontWeight: '800', color: '#999', marginBottom: '5px', display: 'block' };

export default App;