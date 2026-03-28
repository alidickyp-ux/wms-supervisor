import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  RefreshCw, FileSpreadsheet, Trash2, Upload, Plus,
  Database as DbIcon, LayoutGrid, X
} from 'lucide-react';
import { API_BASE, formatWIB, getDesc, SearchBar, TableBox, TableSkeleton, PageWrapper, useDebounce } from './shared';

export default function InventoryPage({ activeMenu, showToast }) {
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDebounce(searchInput);
  const [masterTab, setMasterTab] = useState('grid');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLoc, setNewLoc] = useState({ id:'', zone:'', aisle:'', unique:'', assign:'closed' });

  useEffect(() => {
    setSearchInput('');
    fetchData();
  }, [activeMenu, masterTab]);

  useEffect(() => {
    if (newLoc.id && newLoc.zone && newLoc.aisle)
      setNewLoc(p => ({ ...p, unique: `${p.zone.toUpperCase()}-${p.aisle}` }));
  }, [newLoc.id, newLoc.zone, newLoc.aisle]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const tm = {
        'Master Lokasi': masterTab==='database' ? 'master_all' : 'master',
        'Snapshoot': 'snapshot_list',
        '1st Count': 'first',
        '2nt Count': 'second',
        'Reconciliation': 'recon',
        'Pick Compliance': 'picking_compliance',
      };
      const target = tm[activeMenu];
      if (!target) { setData([]); return; }
      const api = activeMenu === 'Pick Compliance' ? 'https://wms-neon-bridge.vercel.app/api/to_web' : API_BASE;
      const res = await axios.get(`${api}?action=get_data&target=${target}`);
      setData(res.data?.data || []);
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  const handleToggle = async (uid, cur) => {
    const next = cur === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: next });
      setData(p => p.map(r => r.unique_id === uid ? { ...r, assign: next } : r));
    } catch { showToast("Gagal toggle", "error"); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setLoading(true);
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        await axios.post(`${API_BASE}?action=upload_snap`, { data: rows });
        showToast("Snapshot terupload!"); fetchData();
      } catch { showToast("Gagal upload", "error"); }
      finally { setLoading(false); e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = () => {
    if (!data?.length) return showToast("Tidak ada data", "error");
    const out = data.map(r => {
      const n = { ...r };
      ['scanned_at','timestamp'].forEach(k => { if (n[k]) n[k] = formatWIB(n[k]); });
      if (activeMenu === 'Reconciliation') n['diff'] = Number(n.qty_2nd||n.qty_1st||0) - Number(n.qty_snap||0);
      return n;
    });
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${activeMenu}.xlsx`);
  };

  const applyFilter = (arr) => {
    if (!searchTerm) return arr;
    const s = searchTerm.toUpperCase();
    return arr.filter(r => Object.values(r).some(v => String(v).toUpperCase().includes(s)));
  };
  const filteredData = applyFilter(data);


  // Fungsi Hapus Lokasi
const handleDeleteLocation = async (uid) => {
  if (!window.confirm(`Hapus lokasi ${uid}?`)) return;
  try {
    await axios.post(`${API_BASE}?action=delete_location`, { unique_id: uid });
    showToast("Lokasi berhasil dihapus");
    fetchData();
  } catch {
    showToast("Gagal menghapus lokasi", "error");
  }
};

// Fungsi Upload Excel khusus Master Lokasi
const handleUploadMaster = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    setLoading(true);
    try {
      const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      // Pastikan backend kamu punya action 'upload_master'
      await axios.post(`${API_BASE}?action=upload_master`, { data: rows });
      showToast("Master data berhasil diupdate!");
      fetchData();
    } catch {
      showToast("Gagal upload master", "error");
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
};

  /* ── TOPBAR ACTIONS ── */
  function TopbarActions() {
    return (
      <>
        {activeMenu==='Master Lokasi' && masterTab==='database' && (
          <button className="btn primary" onClick={()=>setShowAddForm(true)}><Plus size={12}/>Add</button>
        )}
        {activeMenu==='Snapshoot' && (
          <label className="btn primary" style={{cursor:'pointer'}}>
            <Upload size={12}/>Upload
            <input type="file" hidden onChange={handleFileUpload}/>
          </label>
        )}
        {['1st Count','2nt Count','Snapshoot','Reconciliation'].includes(activeMenu) && (
          <button className="btn danger" onClick={()=>{
            if(window.confirm("Hapus data?")) {
              const t = activeMenu.includes('1st')?'first':activeMenu.includes('2nt')?'second':activeMenu.includes('Snap')?'snap':'recon';
              axios.post(`${API_BASE}?action=clear_${t}`).then(fetchData);
            }
          }}><Trash2 size={12}/>Clear</button>
        )}
        <button className="btn success" onClick={handleExport}><FileSpreadsheet size={12}/>Export</button>
        <button className="btn-icon" onClick={fetchData}><RefreshCw size={13} className={loading?'spin':''}/></button>
      </>
    );
  }

  /* ── MASTER LOKASI ── */
  if (activeMenu === 'Master Lokasi') {
    return (
      <PageWrapper>
        <TopbarActions/>
        <div style={{display:'flex',gap:8,marginBottom:14,background:'var(--surface)',borderRadius:8,
          padding:4,border:'1px solid var(--border)',width:'fit-content',marginTop:12}}>
          {[['grid',<LayoutGrid size={11}/>,'Assign CC'],['database',<DbIcon size={11}/>,'Database']].map(([t,ic,lb])=>(
            <button key={t} onClick={()=>setMasterTab(t)}
              style={{padding:'5px 12px',borderRadius:6,border:'none',cursor:'pointer',fontSize:'0.62rem',fontWeight:600,
                display:'flex',alignItems:'center',gap:5,fontFamily:'inherit',
                background:masterTab===t?'var(--text)':'transparent',color:masterTab===t?'#fff':'var(--muted)',transition:'all 0.15s'}}>
              {ic}{lb}
            </button>
          ))}
        </div>
        {masterTab==='database' && <SearchBar value={searchInput} onChange={setSearchInput} debounced={searchTerm}/>}
        {masterTab==='grid' ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(86px,1fr))',gap:8}}>
            {filteredData.map((r,i)=>(
              <div key={i} style={{background:'var(--surface)',border:'1px solid var(--border)',padding:'10px',
                display:'flex',flexDirection:'column',alignItems:'center',gap:8,borderRadius:9}}>
                <span style={{fontWeight:700,fontSize:'0.62rem',textAlign:'center'}}>{r?.unique_id}</span>
                <div className="toggle" onClick={()=>handleToggle(r.unique_id,r.assign)}
                  style={{background:r.assign==='open'?'var(--green)':'var(--border)'}}>
                  <div className="toggle-dot" style={{left:r.assign==='open'?'19px':'3px'}}/>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TableBox>
            <table className="data-table">
              <thead><tr><th>Lokasi</th><th>Zone</th><th>Aisle</th><th>Unique ID</th><th>Status</th></tr></thead>
              <tbody>{filteredData.map((r,i)=>(
                <tr key={i}>
                  <td style={{fontWeight:600}}>{r?.location_id}</td>
                  <td>{r?.zone}</td><td>{r?.aisle}</td>
                  <td className="mono">{r?.unique_id}</td>
                  <td><span className={`tag ${r?.assign==='open'?'tag-green':'tag-red'}`}>{r?.assign?.toUpperCase()}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </TableBox>
        )}

        {/* ADD LOCATION MODAL */}
        {showAddForm && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(6px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000}}>
            <div style={{background:'var(--surface)',padding:28,borderRadius:16,width:'90%',maxWidth:400,
              boxShadow:'0 24px 48px rgba(0,0,0,0.15)',border:'1px solid var(--border)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <div style={{fontWeight:800,fontSize:'0.82rem'}}>Tambah Lokasi</div>
                <button className="btn-icon" onClick={()=>setShowAddForm(false)}><X size={14}/></button>
              </div>
              <label style={{fontSize:'0.58rem',fontWeight:700,color:'var(--muted)',letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:5}}>Lokasi ID</label>
              <input className="field" value={newLoc.id} onChange={e=>setNewLoc({...newLoc,id:e.target.value})}/>
              <div style={{display:'flex',gap:10}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:'0.58rem',fontWeight:700,color:'var(--muted)',letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:5}}>Zone</label>
                  <input className="field" value={newLoc.zone} onChange={e=>setNewLoc({...newLoc,zone:e.target.value.toUpperCase()})}/>
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:'0.58rem',fontWeight:700,color:'var(--muted)',letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:5}}>Aisle</label>
                  <input className="field" type="number" value={newLoc.aisle} onChange={e=>setNewLoc({...newLoc,aisle:e.target.value})}/>
                </div>
              </div>
              <button className="btn primary" style={{width:'100%',justifyContent:'center',padding:'11px',marginTop:4,fontSize:'0.7rem'}}
                onClick={async()=>{
                  try {
                    await axios.post(`${API_BASE}?action=add_location`,{...newLoc,location_id:newLoc.id.toUpperCase()});
                    showToast("Lokasi ditambahkan"); setShowAddForm(false); fetchData();
                  } catch { showToast("Error","error"); }
                }}>Simpan</button>
            </div>
          </div>
        )}
      </PageWrapper>
    );
  }

  /* ── GENERIC TABLE ── */
  return (
    <PageWrapper>
      <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginBottom:12}}>
        <TopbarActions/>
      </div>
      <SearchBar value={searchInput} onChange={setSearchInput} debounced={searchTerm}/>
      {loading ? <TableSkeleton rows={10} cols={4}/> : (
        <TableBox>
          <table className="data-table">
            <thead><tr>
              {activeMenu==='Reconciliation'
                ? ['Lokasi','Artikel','Snap','1st','2nd','Diff','Status'].map(h=><th key={h}>{h}</th>)
                : activeMenu==='Pick Compliance'
                ? ['ID','Picklist','Product','Lokasi','Deskripsi','Qty','Keterangan','Status Awal','Status Akhir','Reason','Final Reason','Dibuat'].map(h=><th key={h}>{h}</th>)
                : activeMenu==='Snapshoot'
                ? ['Lokasi','Artikel','Qty Snap','Deskripsi'].map(h=><th key={h}>{h}</th>)
                : ['Location','Artikel','Deskripsi','Qty','Timestamp','Operator'].map(h=><th key={h}>{h}</th>)
              }
            </tr></thead>
            <tbody>
              {filteredData.map((r,i)=>(
                <tr key={i}>
                  {activeMenu==='Reconciliation' ? <>
                    <td style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem'}}>{r?.location_id}</td>
                    <td>{r?.artikel}</td><td>{r?.qty_snap}</td><td>{r?.qty_1st}</td><td>{r?.qty_2nd}</td>
                    <td>{(()=>{const d=Number(r?.qty_2nd||r?.qty_1st||0)-Number(r?.qty_snap||0);
                      return <span style={{fontWeight:800,color:d===0?'var(--green)':'var(--red)'}}>{d>0?`+${d}`:d}</span>})()}</td>
                    <td>{r?.final_status}</td>
                  </> : activeMenu==='Snapshoot' ? <>
                    <td className="mono" style={{fontSize:'0.6rem'}}>{r?.location_id}</td>
                    <td>{r?.artikel}</td>
                    <td style={{fontWeight:700}}>{r?.qty_snap}</td>
                    <td style={{fontSize:'0.6rem',color:'var(--muted)'}}>{getDesc(r)}</td>
                  </> : <>
                    <td className="mono" style={{fontSize:'0.6rem'}}>{r?.location_id}</td>
                    <td>{r?.artikel}</td>
                    <td style={{fontSize:'0.6rem',color:'var(--muted)'}}>{getDesc(r)}</td>
                    <td style={{fontWeight:700}}>{r?.qty_1st||r?.qty_2nd||r?.qty}</td>
                    <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>{formatWIB(r?.scanned_at||r?.timestamp)}</td>
                    <td>{r?.operator}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      )}
    </PageWrapper>
  );
}
