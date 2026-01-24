import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { RefreshCw, Search, FileSpreadsheet, Trash2, Database, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

const API_BASE = 'https://wms-neon-bridge.vercel.app/api/inventory';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState('Master Lokasi');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // --- State Form Operasional ---
  const [mobLoc, setMobLoc] = useState('');
  const [mobArt, setMobArt] = useState('');
  const [mobQty, setMobQty] = useState('');
  const [locInfo, setLocInfo] = useState(null);
  const [selectedLoc2nd, setSelectedLoc2nd] = useState(null); // Khusus 2nd Count

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
        'Master Lokasi': 'master', 'Snapshoot': 'snapshot_list', 
        '1st Count': 'first', '2nt Count': 'second', 'Reconciliation': 'recon' 
      };
      const res = await axios.get(`${API_BASE}?action=get_data&target=${targetMap[activeMenu]}`);
      setData(res.data.data || []);
    } catch (e) { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isLoggedIn) fetchData(); }, [activeMenu, isLoggedIn]);

  // --- Logic 1st Count Scan ---
  const handleScan1st = (val) => {
    const cleanVal = val.toUpperCase();
    setMobLoc(cleanVal);
    const info = data.find(d => String(d.location_id).toUpperCase() === cleanVal);
    
    if (info) {
      if (Number(info.qty_1st) > 0) {
        alert("Lokasi ini sudah di-count 1st!");
        setLocInfo(null); setMobArt('');
      } else {
        setLocInfo(info); setMobArt(info.artikel);
      }
    } else {
      setLocInfo(null); setMobArt('');
    }
  };

  // --- Logic Action Buttons ---
  const handleToggle = async (uid, current) => {
    const nextStatus = current === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      setData(prev => prev.map(item => item.unique_id === uid ? {...item, assign: nextStatus} : item));
    } catch (e) { alert("Gagal update!"); }
  };

  const handleSaveInput = async () => {
    if (!mobLoc || !mobQty || !mobArt) return alert("Data Belum Lengkap!");
    setLoading(true);
    try {
      await axios.post(`${API_BASE}?action=save_input`, {
        location_id: mobLoc, artikel: mobArt, qty: mobQty,
        operator: user?.username || 'Admin', target_table: activeMenu === '1st Count' ? 'first' : 'second'
      });
      alert("Berhasil Simpan!");
      setMobLoc(''); setMobQty(''); setMobArt(''); setLocInfo(null); setSelectedLoc2nd(null);
      fetchData();
    } catch (e) { alert("Gagal Simpan!"); }
    finally { setLoading(false); }
  };

  const handleRefreshView = async () => {
    setLoading(true);
    try { await axios.post(`${API_BASE}?action=refresh_view`); alert("View Diperbarui!"); fetchData(); } 
    catch (e) { alert("Gagal!"); } finally { setLoading(false); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const excelData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      setLoading(true);
      try { await axios.post(`${API_BASE}?action=upload_snap`, { data: excelData }); alert("Upload Berhasil!"); fetchData(); } 
      catch (e) { alert("Gagal!"); } finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  const filtered = data.filter(item => 
    Object.values(item).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isLoggedIn) {
    return (
      <div style={loginPage}>
        <div style={loginCard}>
          <h2 style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '20px' }}>COOL SYSTEM</h2>
          <input placeholder="User ID" value={username} onChange={e => setUsername(e.target.value)} style={mInput} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={mInput} />
          <button onClick={() => { setIsLoggedIn(true); setUser({username}); }} style={btnBlack}>LOG IN</button>
        </div>
      </div>
    );
  }

  return (
    <div style={mainLayout}>
      {/* SIDEBAR */}
      <nav style={sidebarStyle(isMobile)}>
        <div style={{ padding: '20px', fontWeight: '900', fontSize: '0.9rem' }}>{isMobile ? 'C' : 'COOL'}</div>
        {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
          <div key={m} onClick={() => { setActiveMenu(m); setLocInfo(null); setSelectedLoc2nd(null); }} 
               style={navItem(activeMenu === m)}>
            {isMobile ? m.charAt(0) : m}
          </div>
        ))}
      </nav>

      {/* CONTENT Area */}
      <div style={contentArea(isMobile)}>
        <header style={headerStyle}>
          <div style={{ fontWeight: '800' }}>{activeMenu.toUpperCase()}</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {activeMenu === 'Snapshoot' && !isMobile && (
              <>
                <button onClick={() => { if(window.confirm('Hapus Snapshot?')) fetchData(); }} style={btnWhite}><Trash2 size={12}/> HAPUS</button>
                <button onClick={handleRefreshView} style={btnWhite}><Database size={12}/> REFRESH</button>
                <label style={{ ...btnWhite, background: '#000', color: '#fff' }}>
                  <Upload size={12}/> UPLOAD <input type="file" hidden accept=".xlsx" onChange={handleFileUpload} />
                </label>
              </>
            )}
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        {/* --- MENU MASTER LOKASI (GRID) --- */}
        {activeMenu === 'Master Lokasi' && (
          <div style={gridContainer(isMobile)}>
            {filtered.map(row => (
              <div key={row.unique_id} style={cardGrid}>
                <div style={{ fontWeight: '800' }}>{row.unique_id}</div>
                <div onClick={() => handleToggle(row.unique_id, row.assign)} style={toggleContainer(row.assign === 'open')}>
                  <div style={toggleCircle(row.assign === 'open')} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- MENU 1ST COUNT --- */}
        {activeMenu === '1st Count' && isMobile && (
          <div style={formWrapper}>
            {locInfo && (
              <div style={boxContent}>
                <div style={boxTitle}>BOX CONTENT (SNAP)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Artikel: <b>{locInfo.artikel}</b></span>
                  <span>Qty Snap: <b>{locInfo.qty_snap}</b></span>
                </div>
              </div>
            )}
            <label style={labelStyle}>LOCATION ID</label>
            <input value={mobLoc} onChange={e => handleScan1st(e.target.value)} style={mInput} placeholder="Scan Location..." />
            <label style={labelStyle}>ARTIKEL</label>
            <input value={mobArt} readOnly style={mInputReadOnly} />
            <label style={labelStyle}>QTY 1ST COUNT</label>
            <input type="number" value={mobQty} onChange={e => setMobQty(e.target.value)} style={qtyInput} placeholder="0" />
            <button onClick={handleSaveInput} disabled={!locInfo} style={btnSave(locInfo)}>SIMPAN DATA</button>
          </div>
        )}

        {/* --- MENU 2ND COUNT (LIST & VALIDASI) --- */}
        {activeMenu === '2nt Count' && isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {!selectedLoc2nd ? (
              <>
                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#ff4444', marginBottom: '5px' }}>LIST LOKASI NOT MATCH (1ST):</div>
                {data.filter(d => (Number(d.qty_1st || 0) - Number(d.qty_snap || 0)) !== 0).map(loc => (
                  <div key={loc.location_id} onClick={() => { setSelectedLoc2nd(loc); setLocInfo(loc); setMobArt(loc.artikel); setMobLoc(''); }} style={listItem}>
                    <div style={{ fontWeight: '800' }}>{loc.location_id}</div>
                    <div style={{ color: '#999' }}>Diff: {Number(loc.qty_1st || 0) - Number(loc.qty_snap || 0)}</div>
                  </div>
                ))}
              </>
            ) : (
              <div style={formWrapper}>
                <button onClick={() => setSelectedLoc2nd(null)} style={btnBack}>← Kembali ke List</button>
                <div style={boxContent}>
                  <div style={boxTitle}>REFERENSI DATA</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>Artikel: <b>{selectedLoc2nd.artikel}</b></span>
                    <span>Snap: <b>{selectedLoc2nd.qty_snap}</b></span>
                  </div>
                  <div style={{ color: 'red' }}>1st Count: <b>{selectedLoc2nd.qty_1st}</b></div>
                </div>
                <label style={labelStyle}>VALIDASI LOCATION ID</label>
                <input value={mobLoc} onChange={e => setMobLoc(e.target.value.toUpperCase())} 
                       style={{ ...mInput, borderColor: mobLoc === selectedLoc2nd.location_id ? '#000' : '#ff4444' }} 
                       placeholder="Scan ulang lokasi..." />
                <label style={labelStyle}>ARTIKEL</label>
                <input value={mobArt} readOnly style={mInputReadOnly} />
                <label style={labelStyle}>QTY 2ND COUNT</label>
                <input type="number" value={mobQty} onChange={e => setMobQty(e.target.value)} style={qtyInput} placeholder="0" />
                <button onClick={handleSaveInput} disabled={mobLoc !== selectedLoc2nd.location_id} 
                        style={btnSave(mobLoc === selectedLoc2nd.location_id)}>SIMPAN 2ND COUNT</button>
              </div>
            )}
          </div>
        )}

        {/* --- TABLE VIEW FOR PC / RECON --- */}
        {(activeMenu === 'Snapshoot' || activeMenu === 'Reconciliation' || !isMobile) && activeMenu !== 'Master Lokasi' && (
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th>
                  {activeMenu === 'Reconciliation' ? (
                    <><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>DIFF</th></>
                  ) : <th style={thStyle}>QTY</th>}
                  <th style={thStyle}>KET</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                    <td style={tdStyle}>{row.location_id || row.unique_id}</td>
                    <td style={tdStyle}>{row.artikel}</td>
                    {activeMenu === 'Reconciliation' ? (
                      <>
                        <td style={tdStyle}>{row.qty_snap}</td>
                        <td style={tdStyle}>{row.qty_1st}</td>
                        <td style={tdStyle}>{row.qty_2nd}</td>
                        <td style={{ ...tdStyle, color: (Number(row.qty_1st||0)+Number(row.qty_2nd||0)-Number(row.qty_snap||0)) !== 0 ? 'red' : 'green', fontWeight: '800' }}>
                          {(Number(row.qty_1st || 0) + Number(row.qty_2nd || 0)) - Number(row.qty_snap || 0)}
                        </td>
                      </>
                    ) : <td style={tdStyle}>{row.qty_snap || row.qty_1st || row.qty_2nd || 0}</td>}
                    <td style={{ ...tdStyle, color: '#ccc' }}>{row.description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- CLEAN WHITE LEXEND STYLES ---
const mainLayout = { display: 'flex', fontFamily: 'Lexend, sans-serif', backgroundColor: '#fff', minHeight: '100vh', fontSize: '0.75rem' };
const sidebarStyle = (isMobile) => ({ width: isMobile ? '50px' : '180px', borderRight: '1px solid #eee', height: '100vh', position: 'fixed', backgroundColor: '#fff', zIndex: 10 });
const contentArea = (isMobile) => ({ flex: 1, marginLeft: isMobile ? '50px' : '180px', padding: isMobile ? '15px' : '30px' });
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
const navItem = (active) => ({ padding: '12px 20px', cursor: 'pointer', color: active ? '#000' : '#999', fontWeight: active ? '800' : '400', borderRight: active ? '2px solid #000' : 'none', fontSize: '0.7rem' });
const cardGrid = { border: '1px solid #eee', padding: '15px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', borderRadius: '2px' };
const gridContainer = (isMobile) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '80px' : '100px'}, 1fr))`, gap: '10px' });
const tableWrapper = { border: '1px solid #eee', borderRadius: '2px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const thStyle = { padding: '10px', textAlign: 'left', color: '#bbb', fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase' };
const tdStyle = { padding: '10px', borderBottom: '1px solid #fcfcfc', color: '#444' };
const formWrapper = { border: '1px solid #eee', padding: '20px', borderRadius: '4px' };
const labelStyle = { display: 'block', fontSize: '0.6rem', fontWeight: '800', color: '#bbb', marginBottom: '5px' };
const mInput = { width: '100%', padding: '10px', border: '1px solid #eee', marginBottom: '15px', borderRadius: '4px', fontFamily: 'Lexend', outline: 'none', boxSizing: 'border-box' };
const mInputReadOnly = { ...mInput, backgroundColor: '#f9f9f9', color: '#999' };
const qtyInput = { ...mInput, fontSize: '1.5rem', fontWeight: '800', textAlign: 'center' };
const boxContent = { background: '#fcfcfc', border: '1px dashed #eee', padding: '10px', marginBottom: '15px', fontSize: '0.65rem' };
const boxTitle = { fontWeight: '800', fontSize: '0.6rem', marginBottom: '5px', color: '#000' };
const btnBlack = { width: '100%', background: '#000', color: '#fff', padding: '12px', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Lexend' };
const btnSave = (valid) => ({ ...btnBlack, opacity: valid ? 1 : 0.3, pointerEvents: valid ? 'auto' : 'none' });
const btnWhite = { background: '#fff', border: '1px solid #eee', padding: '6px 12px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'Lexend' };
const btnIcon = { background: '#fff', border: '1px solid #eee', padding: '6px', borderRadius: '4px', cursor: 'pointer' };
const btnBack = { background: 'none', border: 'none', color: '#999', fontSize: '0.65rem', marginBottom: '10px', cursor: 'pointer', padding: 0 };
const listItem = { padding: '15px', border: '1px solid #eee', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', cursor: 'pointer' };
const toggleContainer = (on) => ({ width: '30px', height: '16px', background: on ? '#000' : '#eee', borderRadius: '10px', position: 'relative', cursor: 'pointer', transition: '0.3s' });
const toggleCircle = (on) => ({ width: '10px', height: '10px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '17px' : '3px', transition: '0.3s' });
const loginPage = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' };
const loginCard = { width: '280px', padding: '30px', border: '1px solid #eee', textAlign: 'center' };

export default App;