import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { RefreshCw, FileSpreadsheet, Trash2, Database, LogOut, Upload } from 'lucide-react';

const API_BASE = 'https://wms-neon-bridge.vercel.app/api/inventory';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState('Master Lokasi');
  const [data, setData] = useState([]);
  const [snapData, setSnapData] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [mobLoc, setMobLoc] = useState('');
  const [mobArt, setMobArt] = useState('');
  const [mobQty, setMobQty] = useState('');
  const [locInfo, setLocInfo] = useState(null); 
  const [selectedLoc2nd, setSelectedLoc2nd] = useState(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    } catch (e) { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isLoggedIn) fetchData(); }, [activeMenu, isLoggedIn]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoading(true);
        const dataArr = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(dataArr, { type: 'array' });
        const wsName = workbook.SheetNames[0];
        const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[wsName]);
        await axios.post(`${API_BASE}?action=upload_snap`, { data: excelData }); 
        alert("SUCCESS: SNAPSHOT UPLOADED"); 
        fetchData(); 
      } catch (err) { alert("ERROR: Upload failed."); } 
      finally { setLoading(false); e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportExcel = () => {
    const exportData = data.map(row => {
      const finalCount = Number(row.qty_2nd) > 0 ? Number(row.qty_2nd) : Number(row.qty_1st || 0);
      return { 
        'LOCATION': row.location_id, 'ARTICLE': row.artikel, 'SNAP': row.qty_snap, 
        '1ST': row.qty_1st, '2ND': row.qty_2nd, 'DIFF': finalCount - Number(row.qty_snap || 0), 
        'STATUS': row.final_status, 'DESCRIPTION': row.description 
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `COOL_REPORT_${activeMenu.toUpperCase()}.xlsx`);
  };

  const handleSaveInput = async () => {
    if (!mobLoc || !mobQty || !mobArt) return alert("REQUIRED: Complete all fields.");
    
    // VALIDASI SCAN 2ND COUNT
    if (activeMenu === '2nt Count' && selectedLoc2nd) {
      if (mobLoc.trim().toUpperCase() !== selectedLoc2nd.location_id.toUpperCase()) {
        return alert(`VALIDATION ERROR: Lokasi scan (${mobLoc}) tidak cocok dengan target (${selectedLoc2nd.location_id})!`);
      }
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=save_input`, {
        location_id: mobLoc.trim().toUpperCase(),
        artikel: mobArt.trim().toUpperCase(),
        qty: parseInt(mobQty),
        operator: user?.username || 'Admin', 
        target_table: activeMenu 
      });
      if (res.data.status === 'success') {
        alert("SUCCESS: DATA SYNCHRONIZED");
        setMobLoc(''); setMobQty(''); setMobArt(''); setLocInfo(null); setSelectedLoc2nd(null);
        fetchData();
      }
    } catch (e) { alert("SYSTEM ERROR: Sync failed."); } 
    finally { setLoading(false); }
  };

  const handleToggle = async (uid, current) => {
    const nextStatus = current === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      setData(prev => prev.map(item => item.unique_id === uid ? {...item, assign: nextStatus} : item));
    } catch (e) { alert("ERROR: Toggle failed."); }
  };

  const filtered = data.filter(item => Object.values(item).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase())));
  const taskList2nd = data.filter(d => {
    const s = String(d.final_status || '').toUpperCase();
    return s.includes('NEED 2ND COUNT') || s.includes('SHORT') || s.includes('EXCESS');
  });

  if (!isLoggedIn) {
    return (
      <div style={loginPage}>
        <div style={loginCard}>
          <h2 style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '20px', letterSpacing: '2px' }}>COOL SYSTEM</h2>
          <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={mInput} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={mInput} />
          <button onClick={() => { setIsLoggedIn(true); setUser({username}); }} style={btnBlack}>AUTHENTICATE</button>
        </div>
      </div>
    );
  }

  return (
    <div style={mainLayout}>
      <nav style={sidebarStyle(isMobile)}>
        <div style={{ padding: '20px', fontWeight: '900', fontSize: '0.8rem' }}>{isMobile ? 'C' : 'COOL'}</div>
        {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
          <div key={m} onClick={() => { setActiveMenu(m); setLocInfo(null); setSelectedLoc2nd(null); }} style={navItem(activeMenu === m)}>{isMobile ? m.charAt(0) : m}</div>
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
                    <label style={{ ...btnWhite, background: '#000', color: '#fff' }}><Upload size={12}/> UPLOAD SNAP <input type="file" hidden accept=".xlsx" onChange={handleFileUpload} /></label>
                  </>
                )}
                {activeMenu === '1st Count' && (
                  <button onClick={() => { if(window.confirm("KOSONGKAN DATA 1ST COUNT?")) axios.post(`${API_BASE}?action=clear_first`).then(()=>fetchData()) }} style={{ ...btnWhite, color: '#ef4444' }}><Trash2 size={12}/> KOSONGKAN 1ST</button>
                )}
                {activeMenu === '2nt Count' && (
                  <button onClick={() => { if(window.confirm("KOSONGKAN DATA 2ND COUNT?")) axios.post(`${API_BASE}?action=clear_second`).then(()=>fetchData()) }} style={{ ...btnWhite, color: '#ef4444' }}><Trash2 size={12}/> KOSONGKAN 2ND</button>
                )}
                {['1st Count', '2nt Count', 'Reconciliation'].includes(activeMenu) && (
                  <button onClick={handleExportExcel} style={{ ...btnWhite, color: '#16a34a' }}><FileSpreadsheet size={12}/> EXPORT REPORT</button>
                )}
              </>
            )}
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        {activeMenu === 'Master Lokasi' && (
          <div style={gridContainer(isMobile)}>
            {filtered.map(row => (
              <div key={row.unique_id} style={cardGrid}>
                <span style={{ fontWeight: '800', fontSize: '0.7rem' }}>{row.location_id || row.unique_id}</span>
                <div onClick={() => handleToggle(row.unique_id, row.assign)} style={toggleContainer(row.assign === 'open')}>
                  <div style={toggleCircle(row.assign === 'open')} />
                </div>
              </div>
            ))}
          </div>
        )}

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
            <label style={labelStyle}>SCAN LOCATION</label><input value={mobLoc} onChange={e => {
              const val = e.target.value.toUpperCase(); setMobLoc(val);
              const items = snapData.filter(d => String(d.location_id).toUpperCase() === val);
              setLocInfo(items.length > 0 ? items : null);
            }} style={mInput} />
            <label style={labelStyle}>ARTICLE ID</label><input value={mobArt} onChange={e => setMobArt(e.target.value.toUpperCase())} style={mInput} />
            <label style={labelStyle}>QUANTITY</label><input type="number" value={mobQty} onChange={e => setMobQty(e.target.value)} style={qtyInput} />
            <button onClick={handleSaveInput} style={btnBlack}>SAVE DATA 1ST</button>
          </div>
        )}

        {activeMenu === '2nt Count' && isMobile && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <label style={labelStyle}>TASK NEED 2ND COUNT ({taskList2nd.length})</label>
              <select style={mInput} onChange={(e) => {
                const [loc, art] = e.target.value.split('|');
                const found = taskList2nd.find(d => d.location_id === loc && d.artikel === art);
                setSelectedLoc2nd(found); setMobArt(found?.artikel || ''); setMobLoc('');
              }}>
                <option value="">-- Choose Discrepancy --</option>
                {taskList2nd.map((t, i) => <option key={i} value={`${t.location_id}|${t.artikel}`}>{t.location_id} | {t.artikel}</option>)}
              </select>
              {selectedLoc2nd && (
                <div style={formWrapper}>
                  <div style={boxContent}><b>TARGET: {selectedLoc2nd.artikel}</b><br/>Snap: {selectedLoc2nd.qty_snap} | 1st: {selectedLoc2nd.qty_1st}</div>
                  <label style={labelStyle}>VALIDATE LOCATION</label><input value={mobLoc} onChange={e => setMobLoc(e.target.value.toUpperCase())} style={mInput} placeholder="Scan lokasi untuk unlock..." />
                  <label style={labelStyle}>FINAL QTY</label><input type="number" value={mobQty} onChange={e => setMobQty(e.target.value)} style={qtyInput} />
                  <button onClick={handleSaveInput} style={btnBlack}>SAVE 2ND COUNT</button>
                </div>
              )}
           </div>
        )}

        {((!isMobile && activeMenu !== 'Master Lokasi') || (isMobile && activeMenu === 'Reconciliation')) && (
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead><tr style={{ backgroundColor: '#fafafa' }}><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>DESCRIPTION</th>{activeMenu === 'Reconciliation' ? (<><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>DIFF</th><th style={thStyle}>STATUS</th></>) : <th style={thStyle}>QTY</th>}</tr></thead>
              <tbody>{filtered.map((row, i) => {
                  const finalVal = Number(row.qty_2nd) > 0 || row.qty_2nd === 0 ? Number(row.qty_2nd) : Number(row.qty_1st || 0);
                  const diff = finalVal - Number(row.qty_snap || 0);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                      <td style={tdStyle}>{row.location_id}</td>
                      <td style={tdStyle}>{row.artikel}</td>
                      <td style={{ ...tdStyle, fontSize: '0.65rem', color: '#666' }}>{row.description || '-'}</td>
                      {activeMenu === 'Reconciliation' ? (
                        <><td style={tdStyle}>{row.qty_snap}</td><td style={tdStyle}>{row.qty_1st}</td><td style={tdStyle}>{row.qty_2nd}</td>
                        <td style={{ ...tdStyle, color: diff !== 0 ? '#ef4444' : '#16a34a', fontWeight: '800' }}>{diff}</td>
                        <td style={tdStyle}>{row.final_status}</td></>
                      ) : <td style={tdStyle}>{row.qty_snap || row.qty_1st}</td>}
                    </tr>
                  );
                })}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const mainLayout = { display: 'flex', fontFamily: 'Lexend, sans-serif', backgroundColor: '#fff', minHeight: '100vh', fontSize: '0.75rem' };
const sidebarStyle = (isMobile) => ({ width: isMobile ? '50px' : '180px', borderRight: '1px solid #eee', height: '100vh', position: 'fixed', backgroundColor: '#fff', zIndex: 10 });
const contentArea = (isMobile) => ({ flex: 1, marginLeft: isMobile ? '50px' : '180px', padding: isMobile ? '15px' : '30px' });
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '10px', borderBottom: '1px solid #eee' };
const navItem = (active) => ({ padding: '12px 20px', cursor: 'pointer', color: active ? '#000' : '#ccc', fontWeight: active ? '800' : '400', borderRight: active ? '2px solid #000' : 'none', fontSize: '0.65rem' });
const cardGrid = { border: '1px solid #eee', padding: '15px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', borderRadius: '4px' };
const gridContainer = (isMobile) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '80px' : '110px'}, 1fr))`, gap: '12px' });
const tableWrapper = { border: '1px solid #eee', borderRadius: '4px', overflowX: 'auto', backgroundColor: '#fff' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const thStyle = { padding: '12px 10px', textAlign: 'left', color: '#999', fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid #eee' };
const tdStyle = { padding: '12px 10px', color: '#333' };
const formWrapper = { border: '1px solid #eee', padding: '20px', borderRadius: '8px', backgroundColor: '#fafafa' };
const labelStyle = { display: 'block', fontSize: '0.6rem', fontWeight: '800', color: '#999', marginBottom: '8px', textTransform: 'uppercase' };
const mInput = { width: '100%', padding: '12px', border: '1px solid #eee', marginBottom: '15px', borderRadius: '6px', fontFamily: 'Lexend', outline: 'none', fontSize: '0.75rem', boxSizing: 'border-box' };
const qtyInput = { ...mInput, fontSize: '1.8rem', fontWeight: '900', textAlign: 'center', color: '#000' };
const boxContent = { background: '#f0f7ff', border: '1px solid #cce5ff', padding: '15px', marginBottom: '20px', borderRadius: '8px', fontSize: '0.7rem', color: '#004085' };
const boxTitle = { fontWeight: '900', fontSize: '0.6rem', marginBottom: '8px', color: '#000', textTransform: 'uppercase' };
const btnBlack = { width: '100%', background: '#000', color: '#fff', padding: '14px', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', fontFamily: 'Lexend', fontSize: '0.7rem' };
const btnWhite = { background: '#fff', border: '1px solid #eee', padding: '8px 16px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Lexend' };
const btnIcon = { background: '#fff', border: '1px solid #eee', padding: '8px', borderRadius: '6px', cursor: 'pointer' };
const btnLogout = { border: 'none', background: 'none', color: '#ef4444', padding: '20px', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer', position: 'absolute', bottom: 0, width: '100%', display: 'flex', alignItems: 'center', gap: '8px' };
const toggleContainer = (on) => ({ width: '34px', height: '18px', background: on ? '#000' : '#eee', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.3s' });
const toggleCircle = (on) => ({ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '19px' : '3px', transition: '0.3s' });
const loginPage = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' };
const loginCard = { width: '300px', padding: '40px', background: '#fff', border: '1px solid #eee', textAlign: 'center', borderRadius: '12px' };

export default App;