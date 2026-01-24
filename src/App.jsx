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

  const [mobLoc, setMobLoc] = useState('');
  const [mobQty, setMobQty] = useState('');

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data.status === 'success') { setUser(res.data.user); setIsLoggedIn(true); }
    } catch (e) { alert("Login Gagal!"); }
    finally { setLoading(false); }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const targetMap = { 
        'Master Lokasi': 'master', 
        'Snapshoot': 'snapshot_list', 
        '1st Count': 'first', 
        '2nt Count': 'second', 
        'Reconciliation': 'recon' 
      };
      const res = await axios.get(`${API_BASE}?action=get_data&target=${targetMap[activeMenu]}`);
      setData(res.data.data || []);
    } catch (e) { setData([]); }
    finally { setLoading(false); }
  };

  const handleToggle = async (uid, current) => {
    const nextStatus = current === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      setData(prev => prev.map(item => item.unique_id === uid ? {...item, assign: nextStatus} : item));
    } catch (e) { alert("Gagal update status!"); }
  };

  const handleSaveMobile = async () => {
    if (!mobLoc || !mobQty) return alert("Isi Lokasi & QTY!");
    setLoading(true);
    try {
      await axios.post(`${API_BASE}?action=save_input`, {
        location_id: mobLoc,
        artikel: mobLoc, 
        qty: mobQty,
        operator: user.username,
        target_table: activeMenu
      });
      alert("Data Tersimpan!");
      setMobLoc(''); setMobQty('');
      fetchData();
    } catch (e) { alert("Gagal Simpan!"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isLoggedIn) fetchData(); }, [activeMenu, isLoggedIn]);

  const filtered = data.filter(item => 
    Object.values(item).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const globalStyle = { fontFamily: "'Lexend', sans-serif" };

  if (!isLoggedIn) {
    return (
      <div style={{ ...globalStyle, height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ textAlign: 'center', fontSize: '1rem', fontWeight: '800' }}>COOL SYSTEM</h2>
          <input placeholder="User ID" value={username} onChange={e => setUsername(e.target.value)} style={loginInput} />
          <input type="password" placeholder="Pass" value={password} onChange={e => setPassword(e.target.value)} style={loginInput} />
          <button type="submit" style={btnBlack}>LOGIN</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ ...globalStyle, display: 'flex', minHeight: '100vh', backgroundColor: '#fff' }}>
      {/* SIDEBAR */}
      <div style={{ width: isMobile ? '60px' : '200px', borderRight: '1px solid #eee', padding: '20px 0', position: 'fixed', height: '100vh' }}>
        <div style={{ padding: '0 15px 20px' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: '800' }}>{isMobile ? 'C' : 'COOL'}</h2>
        </div>
        {['Master Lokasi', 'Snapshoot', '1st Count', '2nt Count', 'Reconciliation'].map(m => (
          <div key={m} onClick={() => setActiveMenu(m)} style={{ padding: '12px 15px', cursor: 'pointer', fontSize: '0.7rem', color: activeMenu === m ? '#000' : '#888', fontWeight: activeMenu === m ? '700' : '400', borderLeft: activeMenu === m ? '3px solid #000' : '3px solid transparent' }}>
            {isMobile ? m.charAt(0) : m}
          </div>
        ))}
        <button onClick={() => setIsLoggedIn(false)} style={{ border: 'none', background: 'none', color: '#ff4d4f', padding: '15px', fontSize: '0.7rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #eee', position: 'absolute', bottom: 0, width: '100%' }}>
          <LogOut size={14} /> {!isMobile && 'Logout'}
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, padding: isMobile ? '15px' : '25px 40px', marginLeft: isMobile ? '60px' : '200px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '0.8rem', fontWeight: '800' }}>{activeMenu.toUpperCase()}</h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
               <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#ccc' }} />
               <input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '7px 10px 7px 30px', border: '1px solid #eee', borderRadius: '4px', fontSize: '0.7rem', width: isMobile ? '80px' : '150px', outline: 'none' }} />
            </div>
            <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </header>

        {activeMenu === 'Master Lokasi' ? (
          /* GRID MASTER LOKASI DENGAN TOGGLE */
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '80px' : '110px'}, 1fr))`, gap: '12px' }}>
            {filtered.map((row) => (
              <div key={row.unique_id} style={{ border: '1px solid #eee', padding: '15px 10px', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', backgroundColor: '#fff' }}>
                <span style={{ fontWeight: '800', fontSize: '0.75rem', color: '#333' }}>{row.unique_id}</span>
                {/* TOMBOL TOGGLE GRID */}
                <div 
                  onClick={() => handleToggle(row.unique_id, row.assign)} 
                  style={{ 
                    width: '34px', height: '18px', borderRadius: '20px', 
                    backgroundColor: row.assign === 'open' ? '#000' : '#e5e5e5', 
                    position: 'relative', cursor: 'pointer', transition: '0.3s' 
                  }}
                >
                  <div style={{ 
                    width: '12px', height: '12px', background: '#fff', borderRadius: '50%', 
                    position: 'absolute', top: '3px', 
                    left: row.assign === 'open' ? '18px' : '4px', 
                    transition: '0.3s' 
                  }} />
                </div>
              </div>
            ))}
          </div>
        ) : isMobile && (activeMenu === '1st Count' || activeMenu === '2nt Count') ? (
          /* FORM INPUT HP */
          <div style={{ background: '#fff', border: '1px solid #eee', padding: '20px', borderRadius: '4px' }}>
            <label style={mLabel}>LOKASI / ARTIKEL</label>
            <input value={mobLoc} onChange={e => setMobLoc(e.target.value)} style={mInput} placeholder="Scan..." />
            <label style={mLabel}>QTY</label>
            <input type="number" value={mobQty} onChange={e => setMobQty(e.target.value)} style={{ ...mInput, fontSize: '1.8rem', fontWeight: '800', textAlign: 'center' }} />
            <button onClick={handleSaveMobile} style={{ ...btnBlack, width: '100%', padding: '16px', marginTop: '10px', fontSize: '0.8rem' }}>SIMPAN DATA</button>
          </div>
        ) : (
          /* TABEL PC & RECON */
          <div style={{ border: '1px solid #eee', borderRadius: '2px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #eee' }}>
                  <th style={th}>LOCATION</th>
                  <th style={th}>ARTIKEL</th>
                  {activeMenu === 'Reconciliation' ? (
                    <><th style={th}>SNAP</th><th style={th}>1ST</th><th style={th}>2ND</th><th style={th}>DIFF</th></>
                  ) : <th style={th}>QTY</th>}
                  <th style={th}>DESCRIPTION</th>
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
                        <td style={{ ...td, color: (Number(row.qty_1st||0)+Number(row.qty_2nd||0)-Number(row.qty_snap||0)) !== 0 ? 'red' : 'inherit', fontWeight: '800' }}>
                          {(Number(row.qty_1st || 0) + Number(row.qty_2nd || 0)) - Number(row.qty_snap || 0)}
                        </td>
                      </>
                    ) : <td style={td}>{row.qty_snap || row.qty_1st || row.qty_2nd || 0}</td>}
                    <td style={{ ...td, color: '#999', fontStyle: 'italic', minWidth: '150px' }}>{row.description || '-'}</td>
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

const loginInput = { padding: '10px', border: '1px solid #eee', outline: 'none', fontSize: '0.8rem', fontFamily: 'Lexend', borderRadius: '4px' };
const btnBlack = { background: '#000', color: '#fff', border: 'none', padding: '10px 20px', cursor: 'pointer', fontWeight: '700', fontFamily: 'Lexend', borderRadius: '4px' };
const btnIcon = { background: '#fff', border: '1px solid #eee', padding: '7px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center' };
const th = { padding: '12px 10px', textAlign: 'left', color: '#999', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' };
const td = { padding: '12px 10px', color: '#333' };
const mLabel = { fontSize: '0.6rem', color: '#999', display: 'block', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase' };
const mInput = { width: '100%', padding: '14px', border: '1px solid #eee', marginBottom: '15px', outline: 'none', fontFamily: 'Lexend', boxSizing: 'border-box', borderRadius: '4px', backgroundColor: '#fcfcfc' };

export default App;