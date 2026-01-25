import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { RefreshCw, Search, FileSpreadsheet, Trash2, Database, LogOut, Upload } from 'lucide-react';

const API_BASE = 'https://wms-neon-bridge.vercel.app/api/inventory';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState('Master Lokasi');
  const [data, setData] = useState([]);
  const [snapData, setSnapData] = useState([]); // Referensi kamus artikel di lokasi
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // --- State Form Operasional ---
  const [mobLoc, setMobLoc] = useState('');
  const [mobArt, setMobArt] = useState('');
  const [mobQty, setMobQty] = useState('');
  const [locInfo, setLocInfo] = useState(null); // Menampung array artikel (Multi-Article)
  const [selectedLoc2nd, setSelectedLoc2nd] = useState(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchSnapReference = async () => {
    try {
      const res = await axios.get(`${API_BASE}?action=get_data&target=snapshot_list`);
      setSnapData(res.data.data || []);
    } catch (e) { console.error("Gagal load referensi snap"); }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const targetMap = { 
        'Master Lokasi': 'master', 'Snapshoot': 'snapshot_list', 
        '1st Count': 'first', '2nt Count': 'second', 'Reconciliation': 'recon' 
      };
      const res = await axios.get(`${API_BASE}?action=get_data&target=${targetMap[activeMenu]}`);
      setData(res.data.data || []);
      if (isMobile) fetchSnapReference();
    } catch (e) { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isLoggedIn) fetchData(); }, [activeMenu, isLoggedIn]);

  // --- LOGIC SCAN 1ST COUNT: Multi-Article ---
  const handleScan1st = (val) => {
    const cleanVal = val.trim().toUpperCase();
    setMobLoc(cleanVal);
    
    // Cari SEMUA artikel di lokasi ini dari kamus snapData
    const articlesInLoc = snapData.filter(d => String(d.location_id).trim().toUpperCase() === cleanVal);
    
    if (articlesInLoc.length > 0) {
      setLocInfo(articlesInLoc); // Simpan array untuk di-map di Box Content
    } else {
      setLocInfo(null);
    }
  };

  const handleToggle = async (uid, current) => {
    const nextStatus = current === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      setData(prev => prev.map(item => item.unique_id === uid ? {...item, assign: nextStatus} : item));
    } catch (e) { alert("Gagal update status!"); }
  };

  // --- LOGIC SIMPAN: Anti-Double & Dynamic Table ---
  const handleSaveInput = async () => {
    if (!mobLoc || !mobQty || !mobArt) return alert("Isi semua form, Bos!");

    // Validasi Anti-Double Input di 1st Count
    if (activeMenu === '1st Count') {
      const isAlreadySaved = data.some(d => 
        String(d.location_id).toUpperCase() === mobLoc.toUpperCase() && 
        String(d.artikel).toUpperCase() === mobArt.trim().toUpperCase()
      );
      if (isAlreadySaved) {
        return alert(`Gagal! Artikel ${mobArt} sudah pernah di-input di lokasi ${mobLoc}.`);
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
        alert("PLENG! Data Berhasil Disimpan.");
        setMobLoc(''); setMobQty(''); setMobArt(''); setLocInfo(null); setSelectedLoc2nd(null);
        fetchData();
      }
    } catch (e) { 
      alert("Gagal Simpan: " + (e.response?.data?.message || e.message)); 
    } finally { setLoading(false); }
  };

  // --- Actions ---
  const handleRefreshView = async () => {
    setLoading(true);
    try { await axios.post(`${API_BASE}?action=refresh_view`); alert("View Diperbarui!"); fetchData(); } 
    catch (e) { alert("Gagal refresh!"); } finally { setLoading(false); }
  };

  const handleClearSnap = async () => {
    if (!window.confirm("Hapus SEMUA snapshot?")) return;
    setLoading(true);
    try { await axios.post(`${API_BASE}?action=clear_snap`); fetchData(); } 
    catch (e) { alert("Gagal hapus!"); } finally { setLoading(false); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const excelData = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]);
      setLoading(true);
      try { await axios.post(`${API_BASE}?action=upload_snap`, { data: excelData }); alert("Upload Berhasil!"); fetchData(); } 
      catch (e) { alert("Gagal upload!"); } finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `COOL_${activeMenu}.xlsx`);
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
      <nav style={sidebarStyle(isMobile)}>
        <div style={{ padding: '20px', fontWeight: '900', fontSize: '0.8rem' }}>{isMobile ? 'C' : 'COOL'}</div>
        {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
          <div key={m} onClick={() => { setActiveMenu(m); setLocInfo(null); setSelectedLoc2nd(null); }} 
               style={navItem(activeMenu === m)}>
            {isMobile ? m.charAt(0) : m}
          </div>
        ))}
        <button onClick={() => setIsLoggedIn(false)} style={btnLogout}>
          <LogOut size={14} /> {!isMobile && 'Logout'}
        </button>
      </nav>

      <div style={contentArea(isMobile)}>
        <header style={headerStyle}>
          <div style={{ fontWeight: '800' }}>{activeMenu.toUpperCase()}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeMenu === 'Snapshoot' && !isMobile && (
              <>
                <button onClick={handleClearSnap} style={btnWhite}><Trash2 size={12}/> HAPUS</button>
                <button onClick={handleRefreshView} style={btnWhite}><Database size={12}/> REFRESH VIEW</button>
                <label style={{ ...btnWhite, background: '#000', color: '#fff' }}>
                  <Upload size={12}/> UPLOAD <input type="file" hidden accept=".xlsx" onChange={handleFileUpload} />
                </label>
              </>
            )}
            {!isMobile && ['1st Count', '2nt Count', 'Reconciliation'].includes(activeMenu) && (
              <button onClick={handleExportExcel} style={{ ...btnWhite, color: '#16a34a' }}><FileSpreadsheet size={12}/> EXPORT</button>
            )}
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        {activeMenu === 'Master Lokasi' && (
          <div style={gridContainer(isMobile)}>
            {filtered.map(row => (
              <div key={row.unique_id} style={cardGrid}>
                <span style={{ fontWeight: '800', fontSize: '0.7rem' }}>{row.unique_id}</span>
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
                <div style={boxTitle}>TARGET DI LOKASI INI ({mobLoc}):</div>
                {locInfo.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', padding: '5px 0' }}>
                    <span>{item.artikel}</span>
                    <span>Snap: <b>{item.qty_snap}</b></span>
                  </div>
                ))}
              </div>
            )}
            <label style={labelStyle}>LOCATION ID</label>
            <input value={mobLoc} onChange={e => handleScan1st(e.target.value)} style={mInput} placeholder="Scan Lokasi..." />
            <label style={labelStyle}>ARTIKEL</label>
            <input value={mobArt} onChange={e => setMobArt(e.target.value)} style={mInput} placeholder="Ketik Artikel..." />
            <label style={labelStyle}>QTY 1ST COUNT</label>
            <input type="number" value={mobQty} onChange={e => setMobQty(e.target.value)} style={qtyInput} placeholder="0" />
            <button onClick={handleSaveInput} style={btnBlack}>SIMPAN DATA 1ST</button>
          </div>
        )}

        {activeMenu === '2nt Count' && isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {!selectedLoc2nd ? (
              <>
                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#ff4444' }}>LIST ARTIKEL NOT MATCH:</div>
                {data.filter(d => Number(d.qty_1st || 0) !== Number(d.qty_snap || 0)).map((loc, i) => (
                  <div key={i} onClick={() => { setSelectedLoc2nd(loc); setMobLoc(loc.location_id); setMobArt(loc.artikel); setLocInfo(snapData.filter(s => s.location_id === loc.location_id)); }} style={listItem}>
                    <div>
                      <div style={{ fontWeight: '800' }}>{loc.location_id} - {loc.artikel}</div>
                      <div style={{ fontSize: '0.6rem', color: '#999' }}>Snap: {loc.qty_snap} | 1st: {loc.qty_1st}</div>
                    </div>
                    <div style={{ color: 'red', fontWeight: '800' }}>{Number(loc.qty_1st || 0) - Number(loc.qty_snap || 0)}</div>
                  </div>
                ))}
              </>
            ) : (
              <div style={formWrapper}>
                <button onClick={() => setSelectedLoc2nd(null)} style={btnBack}>← Kembali ke List</button>
                <div style={boxContent}>
                  <div style={boxTitle}>BOX CONTENT (REFERENSI 2ND)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>Art Snap: <b>{selectedLoc2nd.artikel}</b></span>
                    <span>1st Qty: <b>{selectedLoc2nd.qty_1st}</b></span>
                  </div>
                </div>
                <label style={labelStyle}>VALIDASI LOCATION ID</label>
                <input value={mobLoc} onChange={e => setMobLoc(e.target.value.toUpperCase())} style={mInput} />
                <label style={labelStyle}>ARTIKEL</label>
                <input value={mobArt} onChange={e => setMobArt(e.target.value)} style={mInput} />
                <label style={labelStyle}>QTY 2ND COUNT</label>
                <input type="number" value={mobQty} onChange={e => setMobQty(e.target.value)} style={qtyInput} placeholder="0" />
                <button onClick={handleSaveInput} style={btnBlack}>SIMPAN DATA 2ND</button>
              </div>
            )}
          </div>
        )}

        {(activeMenu === 'Snapshoot' || activeMenu === 'Reconciliation' || !isMobile) && activeMenu !== 'Master Lokasi' && (
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa' }}><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th>{activeMenu === 'Reconciliation' ? <><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>DIFF</th></> : <th style={thStyle}>QTY</th>}<th style={thStyle}>DESCRIPTION</th></tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                    <td style={tdStyle}>{row.location_id || row.unique_id}</td>
                    <td style={tdStyle}>{row.artikel}</td>
                    {activeMenu === 'Reconciliation' ? <><td style={tdStyle}>{row.qty_snap}</td><td style={tdStyle}>{row.qty_1st}</td><td style={tdStyle}>{row.qty_2nd}</td><td style={{ ...tdStyle, color: (Number(row.qty_1st||0)+Number(row.qty_2nd||0)-Number(row.qty_snap||0)) !== 0 ? 'red' : 'green', fontWeight: '800' }}>{(Number(row.qty_1st || 0) + Number(row.qty_2nd || 0)) - Number(row.qty_snap || 0)}</td></> : <td style={tdStyle}>{row.qty_snap || row.qty_1st || row.qty_2nd || 0}</td>}
                    <td style={{ ...tdStyle, color: '#ccc', fontStyle: 'italic' }}>{row.description || '-'}</td>
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

// --- STYLES ---
const mainLayout = { display: 'flex', fontFamily: 'Lexend, sans-serif', backgroundColor: '#fff', minHeight: '100vh', fontSize: '0.75rem' };
const sidebarStyle = (isMobile) => ({ width: isMobile ? '50px' : '180px', borderRight: '1px solid #eee', height: '100vh', position: 'fixed', backgroundColor: '#fff' });
const contentArea = (isMobile) => ({ flex: 1, marginLeft: isMobile ? '50px' : '180px', padding: isMobile ? '15px' : '30px' });
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingBottom: '10px', borderBottom: '1px solid #eee' };
const navItem = (active) => ({ padding: '12px 20px', cursor: 'pointer', color: active ? '#000' : '#999', fontWeight: active ? '800' : '400', borderRight: active ? '2px solid #000' : 'none', fontSize: '0.7rem' });
const cardGrid = { border: '1px solid #eee', padding: '15px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', borderRadius: '2px' };
const gridContainer = (isMobile) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '80px' : '100px'}, 1fr))`, gap: '10px' });
const tableWrapper = { border: '1px solid #eee', borderRadius: '2px', overflowX: 'auto' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const thStyle = { padding: '10px', textAlign: 'left', color: '#bbb', fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase' };
const tdStyle = { padding: '10px', color: '#444' };
const formWrapper = { border: '1px solid #eee', padding: '20px', borderRadius: '4px' };
const labelStyle = { display: 'block', fontSize: '0.6rem', fontWeight: '800', color: '#bbb', marginBottom: '5px' };
const mInput = { width: '100%', padding: '10px', border: '1px solid #eee', marginBottom: '15px', borderRadius: '4px', fontFamily: 'Lexend', outline: 'none', boxSizing: 'border-box' };
const qtyInput = { ...mInput, fontSize: '1.5rem', fontWeight: '800', textAlign: 'center' };
const boxContent = { background: '#f0f7ff', border: '1px solid #cce5ff', padding: '12px', marginBottom: '15px', borderRadius: '4px', fontSize: '0.65rem', color: '#004085' };
const boxTitle = { fontWeight: '800', fontSize: '0.6rem', marginBottom: '5px', color: '#000' };
const btnBlack = { width: '100%', background: '#000', color: '#fff', padding: '12px', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Lexend' };
const btnWhite = { background: '#fff', border: '1px solid #eee', padding: '6px 12px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'Lexend' };
const btnIcon = { background: '#fff', border: '1px solid #eee', padding: '6px', borderRadius: '4px', cursor: 'pointer' };
const btnBack = { background: 'none', border: 'none', color: '#999', fontSize: '0.65rem', marginBottom: '10px', cursor: 'pointer', padding: 0 };
const btnLogout = { border: 'none', background: 'none', color: '#ff4d4f', padding: '15px', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer', position: 'absolute', bottom: 0, width: '100%', display: 'flex', alignItems: 'center', gap: '5px' };
const listItem = { padding: '15px', border: '1px solid #eee', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', cursor: 'pointer', marginBottom: '10px' };
const toggleContainer = (on) => ({ width: '30px', height: '16px', background: on ? '#000' : '#eee', borderRadius: '10px', position: 'relative', cursor: 'pointer' });
const toggleCircle = (on) => ({ width: '10px', height: '10px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: on ? '17px' : '3px', transition: '0.2s' });
const loginPage = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' };
const loginCard = { width: '280px', padding: '30px', border: '1px solid #eee', textAlign: 'center' };

export default App;