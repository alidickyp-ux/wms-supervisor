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
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Tambahan State Deteksi HP/PC ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- LOGIC FUNCTIONS ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data.status === 'success') {
        setUser(res.data.user);
        setIsLoggedIn(true);
      }
    } catch (e) { alert("User ID atau Password Salah!"); }
    finally { setLoading(false); }
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
    } catch (e) { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isLoggedIn) fetchData(); }, [activeMenu, isLoggedIn]);

  const handleToggle = async (uid, current) => {
    const nextStatus = current === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      setData(prev => prev.map(item => item.unique_id === uid ? {...item, assign: nextStatus} : item));
    } catch (e) { alert("Gagal update status!"); }
  };

  const handleRefreshView = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}?action=refresh_view`);
      alert("Refresh View Berhasil!");
      fetchData();
    } catch (e) { alert("Gagal refresh view!"); }
    finally { setLoading(false); }
  };

  const handleClearSnap = async () => {
    if (!window.confirm("Hapus SEMUA data snapshot?")) return;
    setLoading(true);
    try {
      await axios.post(`${API_BASE}?action=clear_snap`);
      fetchData();
    } catch (e) { alert("Gagal hapus!"); }
    finally { setLoading(false); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const excelData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      setLoading(true);
      try {
        await axios.post(`${API_BASE}?action=upload_snap`, { data: excelData });
        alert("Upload Berhasil!");
        fetchData();
      } catch (e) { alert("Gagal upload!"); }
      finally { setLoading(false); }
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

  const globalStyle = { fontFamily: "'Lexend', sans-serif" };

  if (!isLoggedIn) {
    return (
      <div style={{ ...globalStyle, height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.75rem', width: '70px', color: '#666' }}>User ID</span>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '2px', width: '180px', backgroundColor: '#f9fbff', fontSize: '0.8rem', outline: 'none', fontFamily: 'Lexend' }} 
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.75rem', width: '70px', color: '#666' }}>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '2px', width: '180px', backgroundColor: '#f9fbff', fontSize: '0.8rem', outline: 'none', fontFamily: 'Lexend' }} 
            />
          </div>
          <button type="submit" style={{ alignSelf: 'center', padding: '5px 25px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '2px', cursor: 'pointer', marginTop: '10px', fontSize: '0.75rem', fontWeight: '600', fontFamily: 'Lexend' }}>
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ ...globalStyle, display: 'flex', minHeight: '100vh', backgroundColor: '#fff' }}>
      {/* SIDEBAR - Sembunyi di HP kalau mau lebih clean, tapi di sini saya biarkan dulu */}
      <div style={{ width: isMobile ? '60px' : '200px', borderRight: '1px solid #eee', padding: '20px 0', position: 'fixed', height: '100vh', display: 'flex', flexDirection: 'column', transition: '0.3s' }}>
        <div style={{ padding: '0 15px 20px 15px', borderBottom: '1px solid #f5f5f5', marginBottom: '15px' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#000', margin: 0 }}>{isMobile ? 'C' : 'COOL'}</h2>
          {!isMobile && <p style={{ fontSize: '0.6rem', color: '#999', marginTop: '2px' }}>{user?.full_name}</p>}
        </div>
        
        <div style={{ flex: 1 }}>
          {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
            <div key={m} onClick={() => setActiveMenu(m)} style={{ 
              padding: '10px 15px', cursor: 'pointer', 
              color: activeMenu === m ? '#000' : '#888', 
              fontSize: '0.7rem', fontWeight: activeMenu === m ? '700' : '500',
              borderLeft: activeMenu === m ? '3px solid #000' : '3px solid transparent',
              backgroundColor: activeMenu === m ? '#fafafa' : 'transparent',
              marginBottom: '2px', overflow: 'hidden', whiteSpace: 'nowrap'
            }}>{isMobile ? m.charAt(0) : m}</div>
          ))}
        </div>

        <button onClick={() => setIsLoggedIn(false)} style={{ border: 'none', background: 'none', color: '#ff4d4f', padding: '15px', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #eee', fontFamily: 'Lexend' }}>
          <LogOut size={14} /> {!isMobile && 'Logout'}
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, padding: isMobile ? '20px' : '25px 40px', marginLeft: isMobile ? '60px' : '200px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#000' }}>{activeMenu.toUpperCase()}</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            
            {/* Action Buttons PC Only */}
            {!isMobile && activeMenu === 'Snapshoot' && (
              <>
                <button onClick={handleClearSnap} style={btnAction}><Trash2 size={12}/> HAPUS</button>
                <button onClick={handleRefreshView} style={btnAction}><Database size={12}/> REFRESH VIEW</button>
                <label style={{ ...btnAction, backgroundColor: '#000', color: '#fff', border: 'none' }}>
                  <Upload size={12}/> UPLOAD <input type="file" hidden accept=".xlsx" onChange={handleFileUpload} />
                </label>
              </>
            )}

            {!isMobile && ['1st Count', '2nt Count', 'Reconciliation'].includes(activeMenu) && (
              <button onClick={handleExportExcel} style={{ ...btnAction, color: '#16a34a' }}>
                <FileSpreadsheet size={12}/> EXPORT
              </button>
            )}

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#ccc' }} />
              <input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '7px 10px 7px 30px', border: '1px solid #eee', borderRadius: '4px', fontSize: '0.75rem', width: isMobile ? '100px' : '150px', outline: 'none', fontFamily: 'Lexend' }} />
            </div>
            <button onClick={fetchData} style={{ padding: '7px', background: '#fff', border: '1px solid #eee', borderRadius: '4px', cursor: 'pointer' }}>
              <RefreshCw size={14} color="#666" className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* --- DUAL VIEW LOGIC --- */}
        {(activeMenu === '1st Count' || activeMenu === '2nt Count') && isMobile ? (
          /* TAMPILAN HP: FORM INPUT */
          <div style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div style={{ background: '#fff', border: '1px solid #eee', padding: '25px', borderRadius: '2px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={mobileLabel}>LOKASI (SCAN)</label>
                <input placeholder="ID Lokasi..." style={mobileInput} />
              </div>
              <div style={{ marginBottom: '25px' }}>
                <label style={mobileLabel}>JUMLAH (QTY)</label>
                <input type="number" placeholder="0" style={{ ...mobileInput, fontSize: '1.8rem', fontWeight: '800', textAlign: 'center' }} />
              </div>
              <button style={{ width: '100%', padding: '16px', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Lexend' }}>
                SIMPAN DATA {activeMenu.split(' ')[0]}
              </button>
            </div>
          </div>
        ) : (
          /* TAMPILAN PC / MENU LAIN: TABEL/GRID */
          <div style={{ border: (activeMenu === 'Master Lokasi' && isMobile) ? 'none' : '1px solid #eee', borderRadius: '2px' }}>
            {activeMenu === 'Master Lokasi' ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '80px' : '100px'}, 1fr))`, gap: '10px' }}>
                {filtered.map((row) => (
                  <div key={row.unique_id} style={{ border: '1px solid #eee', padding: '15px 10px', borderRadius: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.75rem', color: '#333' }}>{row.unique_id}</span>
                    <div onClick={() => handleToggle(row.unique_id, row.assign)} style={{ 
                      width: '30px', height: '14px', borderRadius: '10px', 
                      backgroundColor: row.assign === 'open' ? '#000' : '#eee', 
                      position: 'relative', cursor: 'pointer' 
                    }}>
                      <div style={{ 
                        width: '10px', height: '10px', background: '#fff', borderRadius: '50%', 
                        position: 'absolute', top: '2px', left: row.assign === 'open' ? '18px' : '2px', transition: '0.2s' 
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee', backgroundColor: '#fafafa' }}>
                      <th style={th}>LOCATION</th>
                      <th style={th}>ARTIKEL</th>
                      <th style={th}>DESCRIPTION</th>
                      {activeMenu === 'Reconciliation' ? (
                        <>
                          <th style={th}>SNAP</th>
                          <th style={th}>1ST</th>
                          <th style={th}>2ND</th>
                          <th style={th}>SELISIH</th>
                        </>
                      ) : <th style={th}>QTY</th>}
                      <th style={th}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                        <td style={td}>{row.location_id || row.unique_id}</td>
                        <td style={td}>{row.artikel}</td>
                        {activeMenu === 'Reconciliation' ? (
                          <>
                            <td style={td}>{row.qty_snap}</td>
                            <td style={td}>{row.qty_1st}</td>
                            <td style={td}>{row.qty_2nd}</td>
                            <td style={{ ...td, color: (row.qty_1st + row.qty_2nd - row.qty_snap) !== 0 ? 'red' : 'inherit', fontWeight: 'bold' }}>
                              {(row.qty_1st + row.qty_2nd) - row.qty_snap}
                            </td>
                          </>
                        ) : <td style={td}>{row.qty_snap || row.qty_1st || row.qty_2nd || 0}</td>}
                        <td style={{ ...td, fontWeight: '700' }}>{row.final_status || (row.assign === 'open' ? 'OPEN' : 'CLOSED')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const btnAction = { display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', border: '1px solid #eee', background: '#fff', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'Lexend' };
const th = { padding: '12px', textAlign: 'left', color: '#999', fontWeight: '600', textTransform: 'uppercase' };
const td = { padding: '12px', color: '#444' };
const mobileLabel = { fontSize: '0.6rem', color: '#999', fontWeight: '700', display: 'block', marginBottom: '8px' };
const mobileInput = { width: '100%', padding: '12px', border: '1px solid #eee', borderRadius: '4px', fontSize: '1rem', fontFamily: 'Lexend', outline: 'none', backgroundColor: '#fafafa' };

export default App;