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
      
      // Fetch snap data untuk guide scan di mobile
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
        const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        await axios.post(`${API_BASE}?action=upload_snap`, { data: excelData }); 
        alert("SUCCESS: SNAPSHOT UPLOADED"); 
        fetchData(); 
      } catch (err) { alert("ERROR: Upload failed."); } 
      finally { setLoading(false); e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveInput = async () => {
    if (!mobLoc || !mobQty || !mobArt) return alert("REQUIRED: Complete all fields.");
    
    // VALIDASI SCAN: Lock lokasi di 2nd Count
    if (activeMenu === '2nt Count' && selectedLoc2nd) {
      if (mobLoc.trim().toUpperCase() !== selectedLoc2nd.location_id.toUpperCase()) {
        return alert(`VALIDATION ERROR: Lokasi ${mobLoc} tidak sesuai!`);
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
        alert("SUCCESS: DATA SAVED");
        setMobLoc(''); setMobQty(''); setMobArt(''); setLocInfo(null); setSelectedLoc2nd(null);
        fetchData();
      }
    } catch (e) { alert("SYSTEM ERROR: Sync failed."); } 
    finally { setLoading(false); }
  };

  const taskList2nd = data.filter(d => String(d.final_status).toUpperCase().includes('NEED 2ND COUNT'));

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
                    <button onClick={() => { if(window.confirm("HAPUS SEMUA SNAP?")) axios.post(`${API_BASE}?action=clear_snap`).then(()=>fetchData()) }} style={{ ...btnWhite, color: '#ef4444' }}><Trash2 size={12}/> CLEAR SNAP</button>
                    <label style={{ ...btnWhite, background: '#000', color: '#fff' }}><Upload size={12}/> UPLOAD <input type="file" hidden accept=".xlsx" onChange={handleFileUpload} /></label>
                  </>
                )}
                {activeMenu === '1st Count' && (
                  <button onClick={() => { if(window.confirm("KOSONGKAN 1ST?")) axios.post(`${API_BASE}?action=clear_first`).then(()=>fetchData()) }} style={{ ...btnWhite, color: '#ef4444' }}><Trash2 size={12}/> KOSONGKAN 1ST</button>
                )}
                {activeMenu === '2nt Count' && (
                  <button onClick={() => { if(window.confirm("KOSONGKAN 2ND?")) axios.post(`${API_BASE}?action=clear_second`).then(()=>fetchData()) }} style={{ ...btnWhite, color: '#ef4444' }}><Trash2 size={12}/> KOSONGKAN 2ND</button>
                )}
                {['Reconciliation'].includes(activeMenu) && (
                  <button onClick={() => { axios.post(`${API_BASE}?action=refresh_view`).then(()=>fetchData()) }} style={btnWhite}><Database size={12}/> REFRESH VIEW</button>
                )}
              </>
            )}
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        {/* MOBILE: 1ST COUNT */}
        {activeMenu === '1st Count' && isMobile && (
          <div style={formWrapper}>
            {locInfo && <div style={boxContent}>{locInfo.map((item, idx) => (<div key={idx} style={{ borderBottom: '1px solid #eee', padding: '4px 0' }}>{item.artikel} (Snap: {item.qty_snap})</div>))}</div>}
            <label style={labelStyle}>SCAN LOCATION</label>
            <input value={mobLoc} onChange={e => {
              const val = e.target.value.toUpperCase(); setMobLoc(val);
              const items = snapData.filter(d => String(d.location_id).toUpperCase() === val);
              setLocInfo(items.length > 0 ? items : null);
            }} style={mInput} />
            <label style={labelStyle}>ARTICLE ID</label>
            <input value={mobArt} onChange={e => setMobArt(e.target.value.toUpperCase())} style={mInput} />
            <label style={labelStyle}>QUANTITY</label>
            <input type="number" value={mobQty} onChange={e => setMobQty(e.target.value)} style={qtyInput} />
            <button onClick={handleSaveInput} style={btnBlack}>SAVE 1ST COUNT</button>
          </div>
        )}

        {/* MOBILE: 2ND COUNT */}
        {activeMenu === '2nt Count' && isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={labelStyle}>TASK NEED 2ND COUNT ({taskList2nd.length})</label>
            <select style={mInput} onChange={(e) => {
              const val = e.target.value; if (!val) return setSelectedLoc2nd(null);
              const [locId, art] = val.split('|');
              const found = taskList2nd.find(d => d.location_id === locId && d.artikel === art);
              setSelectedLoc2nd(found); setMobArt(found.artikel); setMobLoc('');
            }}>
              <option value="">-- Choose Task --</option>
              {taskList2nd.map((t, i) => <option key={i} value={`${t.location_id}|${t.artikel}`}>{t.location_id} | {t.artikel}</option>)}
            </select>
            {selectedLoc2nd && (
              <div style={formWrapper}>
                <div style={boxContent}><b>TARGET: {selectedLoc2nd.artikel}</b><br/>Snap: {selectedLoc2nd.qty_snap} | 1st: {selectedLoc2nd.qty_1st}</div>
                <label style={labelStyle}>SCAN LOCATION (VALIDATION)</label>
                <input value={mobLoc} onChange={e => setMobLoc(e.target.value.toUpperCase())} style={{ ...mInput, borderColor: mobLoc && mobLoc !== selectedLoc2nd.location_id ? 'red' : '#eee' }} />
                <label style={labelStyle}>FINAL QUANTITY</label>
                <input type="number" value={mobQty} onChange={e => setMobQty(e.target.value)} style={qtyInput} />
                <button onClick={handleSaveInput} style={btnBlack}>SAVE 2ND COUNT</button>
              </div>
            )}
          </div>
        )}

        {/* TABLE DATA (DASHBOARD PC / RECON HP) */}
        {((!isMobile && activeMenu !== 'Master Lokasi') || (isMobile && activeMenu === 'Reconciliation')) && (
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa' }}>
                  <th style={thStyle}>LOKASI</th>
                  <th style={thStyle}>ARTIKEL</th>
                  <th style={thStyle}>DESCRIPTION</th>
                  {activeMenu === 'Reconciliation' ? (
                    <><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>DIFF</th><th style={thStyle}>STATUS</th></>
                  ) : <th style={thStyle}>QTY</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
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
                        <td style={tdStyle}><span style={{ fontSize: '0.6rem', fontWeight: '800' }}>{row.final_status}</span></td></>
                      ) : <td style={tdStyle}>{row.qty_snap || row.qty_1st}</td>}
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

// STYLES (Sesuai Dashboard COOL)
const mainLayout = { display: 'flex', fontFamily: 'Lexend, sans-serif', backgroundColor: '#fff', minHeight: '100vh', fontSize: '0.75rem' };
const sidebarStyle = (isMobile) => ({ width: isMobile ? '50px' : '180px', borderRight: '1px solid #eee', height: '100vh', position: 'fixed', backgroundColor: '#fff', zIndex: 10 });
const contentArea = (isMobile) => ({ flex: 1, marginLeft: isMobile ? '50px' : '180px', padding: isMobile ? '15px' : '30px' });
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '10px', borderBottom: '1px solid #eee' };
const navItem = (active) => ({ padding: '12px 20px', cursor: 'pointer', color: active ? '#000' : '#ccc', fontWeight: active ? '800' : '400', borderRight: active ? '3px solid #000' : 'none', fontSize: '0.65rem' });
const tableWrapper = { border: '1px solid #eee', borderRadius: '4px', overflowX: 'auto', backgroundColor: '#fff' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const thStyle = { padding: '12px 10px', textAlign: 'left', color: '#999', fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid #eee' };
const tdStyle = { padding: '12px 10px', color: '#333' };
const formWrapper = { border: '1px solid #eee', padding: '20px', borderRadius: '8px', backgroundColor: '#fafafa' };
const labelStyle = { display: 'block', fontSize: '0.6rem', fontWeight: '800', color: '#999', marginBottom: '8px', textTransform: 'uppercase' };
const mInput = { width: '100%', padding: '12px', border: '1px solid #eee', marginBottom: '15px', borderRadius: '6px', fontFamily: 'Lexend', outline: 'none', fontSize: '0.75rem', boxSizing: 'border-box' };
const qtyInput = { ...mInput, fontSize: '1.8rem', fontWeight: '900', textAlign: 'center', color: '#000' };
const boxContent = { background: '#f0f7ff', border: '1px solid #cce5ff', padding: '15px', marginBottom: '20px', borderRadius: '8px', fontSize: '0.7rem', color: '#004085' };
const btnBlack = { width: '100%', background: '#000', color: '#fff', padding: '14px', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', fontFamily: 'Lexend', fontSize: '0.7rem' };
const btnWhite = { background: '#fff', border: '1px solid #eee', padding: '8px 16px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Lexend' };
const btnIcon = { background: '#fff', border: '1px solid #eee', padding: '8px', borderRadius: '6px', cursor: 'pointer' };
const btnLogout = { border: 'none', background: 'none', color: '#ef4444', padding: '20px', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer', position: 'absolute', bottom: 0, width: '100%', display: 'flex', alignItems: 'center', gap: '8px' };

export default App;