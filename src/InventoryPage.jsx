import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  RefreshCw, FileSpreadsheet, Trash2, Upload, Plus,
  Database as DbIcon, LayoutGrid, X, MapPin, ScanLine,
  ClipboardCheck, GitCompare, TrendingUp, Package, CheckCircle2, Target
} from 'lucide-react';
import { API_BASE, formatWIB, getDesc, SearchBar, TableBox, TableSkeleton, PageWrapper, useDebounce } from './shared';

// ── Cycle Count tabs ──────────────────────────────────────────────────
const CC_TABS = [
  { key: 'snapshot_list', label: 'Snapshot',      short: 'Snap'   },
  { key: 'first',         label: '1st Count',     short: '1st'    },
  { key: 'second',        label: '2nd Count',     short: '2nd'    },
  { key: 'recon',         label: 'Reconciliation',short: 'Recon'  },
];

// ── Dashboard metric card ─────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, color = '#111', accent }) {
  return (
    <div style={{
      background: 'var(--surface)', 
      border: '1px solid var(--border)',
      borderRadius: 12, 
      padding: '16px 14px',
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', // Semua konten card rata tengah
      textAlign: 'center',
      gap: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      borderTop: `3px solid ${accent || color}`,
    }}>
      {/* Label & Icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
        {icon}
        <span style={{ 
          fontSize: '0.55rem', 
          fontWeight: 700, 
          letterSpacing: '0.08em',
          textTransform: 'uppercase' 
        }}>{label}</span>
      </div>
      
      {/* Container Value: Dibuat tinggi tetap biar sejajar */}
      <div style={{ 
        height: '2.2rem', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontSize: '1.35rem', 
        fontWeight: 900, 
        color, 
        letterSpacing: '-0.02em' 
      }}>
        {value}
      </div>
      
      {/* Subtext */}
      {sub && (
        <div style={{ 
          fontSize: '0.58rem', 
          color: 'var(--muted2)', 
          fontWeight: 500,
          marginTop: 2 
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Compute dashboard metrics based on Excel logic ───────────────────────
// ── Compute dashboard metrics with 2 decimal precision ───────────────────
function useCycleMetrics(allData) {
  return useMemo(() => {
    const recon = allData.recon || [];
    const locs = [...new Set(recon.map(r => r.location_id))];
    const totalLoc = locs.length;

    const need1stLocs = new Set(recon.filter(r => r.final_status === 'NEED 1ST COUNT').map(r => r.location_id)).size;
    const need2ndLocs = new Set(recon.filter(r => r.final_status === 'NEED 2ND COUNT').map(r => r.location_id)).size;
    const completeLocs = totalLoc - need1stLocs - need2ndLocs;

    const totalLines = recon.length;
    
    // Helper function untuk pembulatan 2 desimal
    const calcPct = (num, den) => (den > 0 ? parseFloat(((num / den) * 100).toFixed(2)) : 0);

    // 1. Line Accuracy (2 angka belakang koma)
    const matchLines = recon.filter(r => {
      const finalQty = Number(r.qty_2nd) > 0 ? Number(r.qty_2nd) : Number(r.qty_1st || 0);
      return finalQty === Number(r.qty_snap ?? 0);
    }).length;
    const lineAcc = calcPct(matchLines, totalLines);

    // 2. Location Accuracy (2 angka belakang koma)
    const locAccuracyData = {};
    recon.forEach(r => {
      if (!locAccuracyData[r.location_id]) locAccuracyData[r.location_id] = true;
      const finalQty = Number(r.qty_2nd) > 0 ? Number(r.qty_2nd) : Number(r.qty_1st || 0);
      if (finalQty !== Number(r.qty_snap ?? 0)) locAccuracyData[r.location_id] = false;
    });
    const matchLocCount = Object.values(locAccuracyData).filter(v => v === true).length;
    const locAcc = calcPct(matchLocCount, totalLoc);

    // 3. SKU Accuracy (2 angka belakang koma)
    const allSkus = [...new Set(recon.map(r => r.artikel).filter(Boolean))];
    const matchSkus = recon.filter(r => {
      const fq = Number(r.qty_2nd) > 0 ? Number(r.qty_2nd) : Number(r.qty_1st || 0);
      return fq === Number(r.qty_snap ?? 0);
    });
    const matchSkuSet = new Set(matchSkus.map(r => r.artikel));
    const skuAcc = calcPct(matchSkuSet.size, allSkus.length);

    // 4. Qty Accuracy (Sesuai diskusi sebelumnya)
    const totalQtySnap = recon.reduce((a, r) => a + Number(r.qty_snap ?? 0), 0);
    const totalQtyFinal = recon.reduce((a, r) => {
      const finalQty = Number(r.qty_2nd) > 0 ? Number(r.qty_2nd) : Number(r.qty_1st || 0);
      return a + finalQty;
    }, 0);
    const qtyAcc = calcPct(totalQtyFinal, totalQtySnap);

    return { 
      totalLoc, need1stLocs, need2ndLocs, completeLocs, 
      lineAcc, locAcc, qtyAcc, skuAcc,
      totalLines, matchLines, allSkus: allSkus.length, matchSkusCount: matchSkuSet.size
    };
  }, [allData]);
}

function AccPill({ pct }) {
  let color = '#10b981'; // Hijau
  let label = '';

  if (pct === 100) {
    color = '#10b981'; 
  } else if (pct < 100) {
    color = '#ef4444'; // Merah
  } else {
    color = '#8b5cf6'; // Ungu (Excess)
    label = 'EXCESS';
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      width: '100%',
      lineHeight: 1
    }}>
      <span style={{ 
        color, 
        fontSize: '1.25rem', // Sedikit dikecilkan agar angka desimal tidak sesak
        fontWeight: 900, 
        letterSpacing: '-0.03em' 
      }}>
        {pct}%
      </span>
      {label && (
        <span style={{ 
          fontSize: '0.55rem', 
          fontWeight: 800, 
          color, 
          marginTop: 2,
          letterSpacing: '0.05em'
        }}>
          {label}
        </span>
      )}
    </div>
  );
}

export default function InventoryPage({ activeMenu, showToast }) {
  const [data, setData]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDebounce(searchInput);
  const [masterTab, setMasterTab] = useState('grid');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLoc, setNewLoc] = useState({ id:'', zone:'', aisle:'', unique:'', assign:'closed' });
  const [uploadStatus, setUploadStatus] = useState({ active:false, progress:0, text:'' });

  const [ccTab, setCcTab]     = useState('snapshot_list');
  const [allCcData, setAllCcData] = useState({ snapshot_list:[], first:[], second:[], recon:[] });
  const [ccLoading, setCcLoading] = useState(false);

  const metrics = useCycleMetrics(allCcData);

  useEffect(() => { setSearchInput(''); }, [activeMenu, ccTab, masterTab]);
  useEffect(() => {
    if (newLoc.id && newLoc.zone && newLoc.aisle)
      setNewLoc(p => ({ ...p, unique: `${p.zone.toUpperCase()}-${p.aisle}` }));
  }, [newLoc.id, newLoc.zone, newLoc.aisle]);

  useEffect(() => {
    if (activeMenu === 'Cycle Count') fetchCcAll();
    else if (activeMenu === 'Master Lokasi') fetchMaster();
    else if (activeMenu === 'Pick Compliance') fetchPickCompliance();
  }, [activeMenu, ccTab, masterTab]);

  const fetchCcAll = async () => {
    setCcLoading(true);
    try {
      const [snapR, firstR, secondR, reconR] = await Promise.all([
        axios.get(`${API_BASE}?action=get_data&target=snapshot_list`),
        axios.get(`${API_BASE}?action=get_data&target=first`),
        axios.get(`${API_BASE}?action=get_data&target=second`),
        axios.get(`${API_BASE}?action=get_data&target=recon`),
      ]);
      const newAll = {
        snapshot_list: snapR.data?.data || [],
        first:         firstR.data?.data || [],
        second:        secondR.data?.data || [],
        recon:         reconR.data?.data || [],
      };
      setAllCcData(newAll);
      setData(newAll[ccTab] || []);
    } catch { showToast('Gagal load data', 'error'); }
    finally { setCcLoading(false); }
  };

  const fetchMaster = async () => {
    setLoading(true);
    try {
      const target = masterTab === 'database' ? 'master_all' : 'master';
      const res = await axios.get(`${API_BASE}?action=get_data&target=${target}`);
      setData(res.data?.data || []);
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  const fetchPickCompliance = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`https://wms-neon-bridge.vercel.app/api/to_web?action=get_data&target=picking_compliance`);
      setData(res.data?.data || []);
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  const switchCcTab = (key) => {
    setCcTab(key);
    setData(allCcData[key] || []);
    setSearchInput('');
  };

  const handleToggle = async (uid, cur) => {
    const next = cur === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: next });
      setData(p => p.map(r => r.unique_id === uid ? { ...r, assign: next } : r));
    } catch { showToast("Gagal toggle", "error"); }
  };

  const handleDeleteLocation = async (uid) => {
    if (!window.confirm(`Hapus lokasi ${uid}?`)) return;
    try {
      await axios.post(`${API_BASE}?action=delete_location`, { unique_id: uid });
      showToast("Lokasi berhasil dihapus"); fetchMaster();
    } catch { showToast("Gagal menghapus", "error"); }
  };

  const handleFileUpload = (e, isMaster = false) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setUploadStatus({ active: true, progress: 10, text: 'Membaca file...' });
      try {
        const wb    = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
        const rows  = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const action = isMaster ? 'upload_master' : 'upload_snap';
        const batchSize = 1000;
        const totalBatches = Math.ceil(rows.length / batchSize);
        for (let i = 0; i < totalBatches; i++) {
          const chunk = rows.slice(i * batchSize, (i + 1) * batchSize);
          setUploadStatus({ active:true, progress: Math.round(20+(i/totalBatches)*70),
            text: `Mengirim batch ${i+1} dari ${totalBatches}...` });
          await axios.post(`${API_BASE}?action=${action}`, { data:chunk, isBatch:true, batchIndex:i });
        }
        setUploadStatus({ active:true, progress:100, text:'Selesai!' });
        showToast(isMaster ? "Master terupdate!" : "Snapshot terupload!");
        if (activeMenu === 'Cycle Count') fetchCcAll();
        else fetchMaster();
      } catch { showToast("Gagal upload", "error"); }
      finally { setTimeout(() => setUploadStatus({ active:false, progress:0, text:'' }), 1000); e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = () => {
  if (!data?.length) return showToast("Tidak ada data", "error");

  const out = data.map(r => {
    if (ccTab === 'recon') {
      // Logika Final Qty: Jika ada Qty 2nd, pakai itu. Jika tidak, pakai Qty 1st.
      const finalQty = Number(r.qty_2nd) > 0 ? Number(r.qty_2nd) : Number(r.qty_1st || 0);
      const diff = finalQty - Number(r.qty_snap || 0);

      return {
        'location_id': r.location_id,
        'artikel': r.artikel,
        'description': getDesc(r), // Fungsi pembantu deskripsi
        'qty_snap': Number(r.qty_snap || 0),
        'qty_1st': Number(r.qty_1st || 0),
        'qty_2nd': Number(r.qty_2nd || 0),
        'final_qty': finalQty,
        'diff': diff,
        'final_status': r.final_status,
        '1stcount_by': r.operator_1st || '-', // Data dari MV baru
        '2ndcount_by': r.operator_2nd || '-'  // Data dari MV baru
      };
    }

    // Default untuk tab lain
    const n = { ...r };
    ['scanned_at', 'timestamp'].forEach(k => { 
      if (n[k]) n[k] = formatWIB(n[k]); 
    });
    return n;
  });

  const ws = XLSX.utils.json_to_sheet(out);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  const label = activeMenu === 'Cycle Count' ? CC_TABS.find(t => t.key === ccTab)?.label : activeMenu;
  XLSX.writeFile(wb, `${label}.xlsx`);
};

  const handleClear = async (target) => {
    if (!window.confirm("Hapus data?")) return;
    try {
      await axios.post(`${API_BASE}?action=clear_${target}`);
      if (activeMenu === 'Cycle Count') fetchCcAll();
      showToast("Data dihapus");
    } catch { showToast("Gagal hapus", "error"); }
  };

  const applyFilter = (arr) => {
    if (!searchTerm) return arr;
    const s = searchTerm.toUpperCase();
    return arr.filter(r => Object.values(r).some(v => String(v).toUpperCase().includes(s)));
  };
  const filteredData = applyFilter(data);

  /* ════════════════════════════════════════════════════════════════════
      RENDER: CYCLE COUNT
  ════════════════════════════════════════════════════════════════════ */
  if (activeMenu === 'Cycle Count') {
    const { totalLoc, need1stLocs, need2ndLocs, completeLocs, 
            lineAcc, locAcc, qtyAcc, skuAcc, matchLines, totalLines } = metrics;

    const CARDS = [
      { icon:<MapPin size={13}/>, label:'Total Location', accent:'#111',
        value: totalLoc, sub: 'Unique locations' },
      { icon:<ScanLine size={13}/>, label:'Need 1st Count', accent:'#3b82f6',
        value: `${need1stLocs} OF ${totalLoc}`, sub: 'Pending locations' },
      { icon:<ClipboardCheck size={13}/>, label:'Need 2nd Count', accent:'#f59e0b',
        value: `${need2ndLocs} OF ${totalLoc}`, sub: 'With discrepancies' },
      { icon:<CheckCircle2 size={13}/>, label:'Complete', accent:'#10b981',
        value: `${completeLocs} OF ${totalLoc}`, sub: 'Finalized locations' },
      { icon:<Target size={13}/>, label:'Location Accuracy', accent:'#06b6d4',
        value: <AccPill pct={locAcc}/>, sub: 'Perfect locations' },
      { icon:<GitCompare size={13}/>, label:'Line Accuracy', accent:'#84cc16',
        value: <AccPill pct={lineAcc}/>, sub: `${matchLines} / ${totalLines} lines` },
      { icon:<Package size={13}/>, label:'SKU Accuracy', accent:'#8b5cf6',
        value: <AccPill pct={skuAcc}/>, sub: 'Based on unique SKUs' },
      { icon:<TrendingUp size={13}/>, label:'Qty Accuracy', accent:'#ec4899',
        value: <AccPill pct={qtyAcc}/>, sub: 'Total final vs snap' },
    ];

    const clearTarget = ccTab === 'snapshot_list' ? 'snap' : ccTab === 'first' ? 'first' : ccTab === 'second' ? 'second' : 'recon';

    return (
      <PageWrapper>
        {uploadStatus.active && <UploadOverlay status={uploadStatus}/>}
        <div style={{ display:'grid', gap:10, marginBottom:20, gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))' }}>
          {CARDS.map((c,i) => <MetricCard key={i} {...c}/>)}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', gap:4, background:'var(--surface)', borderRadius:9, padding:4, border:'1px solid var(--border)' }}>
            {CC_TABS.map(t => (
              <button key={t.key} onClick={() => switchCcTab(t.key)}
                style={{ padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer',
                  fontSize:'0.62rem', fontWeight:700, fontFamily:'inherit', transition:'all 0.15s',
                  background: ccTab === t.key ? 'var(--text)' : 'transparent',
                  color: ccTab === t.key ? '#fff' : 'var(--muted)' }}>
                {t.short}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            {ccTab === 'snapshot_list' && (
              <label className="btn primary" style={{ cursor:'pointer' }}>
                <Upload size={12}/>Upload Snapshot
                <input type="file" hidden onChange={e => handleFileUpload(e, false)}/>
              </label>
            )}
            <button className="btn danger" onClick={() => handleClear(clearTarget)}><Trash2 size={12}/>Clear</button>
            <button className="btn success" onClick={handleExport}><FileSpreadsheet size={12}/>Export</button>
            <button className="btn-icon" onClick={fetchCcAll}><RefreshCw size={13} className={ccLoading?'spin':''}/></button>
          </div>
        </div>

        <SearchBar value={searchInput} onChange={setSearchInput} debounced={searchTerm}/>

        {ccLoading ? <TableSkeleton rows={10} cols={5}/> : (
          <TableBox>
            <table className="data-table">
              <thead>
                <tr>
                  {ccTab === 'snapshot_list'
                    ? ['Lokasi','Artikel','Qty Snap','Deskripsi'].map(h => <th key={h}>{h}</th>)
                    : ccTab === 'recon'
                      ? ['Lokasi','Artikel','Snap','1st','2nd','Final Qty','Diff','Status'].map(h => <th key={h}>{h}</th>)
                      : ['Lokasi','Artikel','Deskripsi','Qty','Timestamp','Operator'].map(h => <th key={h}>{h}</th>)
                  }
                </tr>
              </thead>
              <tbody>
                {filteredData.map((r,i) => (
                  <tr key={i}>
                    {ccTab === 'snapshot_list' ? (
                      <>
                        <td className="mono">{r?.location_id}</td>
                        <td>{r?.artikel}</td>
                        <td style={{fontWeight:700}}>{r?.qty_snap}</td>
                        <td className="muted-text">{getDesc(r)}</td>
                      </>
                    ) : ccTab === 'recon' ? (
                      <>
                        <td className="mono" style={{fontSize:'0.62rem'}}>{r?.location_id}</td>
                        <td>{r?.artikel}</td>
                        <td>{r?.qty_snap}</td>
                        <td>{r?.qty_1st}</td>
                        <td>{r?.qty_2nd}</td>
                        <td style={{fontWeight:700, color:'var(--text)'}}>
                          {Number(r?.qty_2nd) > 0 ? Number(r?.qty_2nd) : Number(r?.qty_1st || 0)}
                        </td>
                        <td>{(() => {
                          const fq = Number(r?.qty_2nd) > 0 ? Number(r?.qty_2nd) : Number(r?.qty_1st || 0);
                          const d = fq - Number(r?.qty_snap ?? 0);
                          return <span style={{fontWeight:800,color:d===0?'var(--green)':'var(--red)'}}>{d>0?`+${d}`:d}</span>;
                        })()}</td>
                        <td style={{fontSize:'0.6rem',color:'var(--muted)'}}>{r?.final_status}</td>
                      </>
                    ) : (
                      <>
                        <td className="mono">{r?.location_id}</td>
                        <td>{r?.artikel}</td>
                        <td className="muted-text">{getDesc(r)}</td>
                        <td style={{fontWeight:700}}>{r?.qty_1st||r?.qty_2nd||r?.qty}</td>
                        <td className="mono muted-text">{formatWIB(r?.scanned_at||r?.timestamp)}</td>
                        <td>{r?.operator}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBox>
        )}
      </PageWrapper>
    );
  }

  /* ════════════════════════════════════════════════════════════════════
      RENDER: MASTER LOKASI (Tetap)
  ════════════════════════════════════════════════════════════════════ */
  if (activeMenu === 'Master Lokasi') {
    return (
      <PageWrapper>
        {uploadStatus.active && <UploadOverlay status={uploadStatus}/>}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{display:'flex',gap:4,background:'var(--surface)',borderRadius:9, padding:4,border:'1px solid var(--border)'}}>
            {[['grid',<LayoutGrid size={11}/>,'Assign CC'],['database',<DbIcon size={11}/>,'Database']].map(([t,ic,lb])=>(
              <button key={t} onClick={()=>setMasterTab(t)}
                style={{padding:'5px 12px',borderRadius:6,border:'none',cursor:'pointer',
                  fontSize:'0.62rem',fontWeight:700,fontFamily:'inherit',
                  display:'flex',alignItems:'center',gap:5,transition:'all 0.15s',
                  background:masterTab===t?'var(--text)':'transparent',
                  color:masterTab===t?'#fff':'var(--muted)'}}>{ic}{lb}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:6}}>
            {masterTab === 'database' && (
              <>
                <button className="btn primary" onClick={() => setShowAddForm(true)}><Plus size={12}/>Add</button>
                <label className="btn success" style={{cursor:'pointer'}}>
                  <Upload size={12}/>Import Master
                  <input type="file" hidden onChange={e => handleFileUpload(e, true)}/>
                </label>
              </>
            )}
            <button className="btn success" onClick={handleExport}><FileSpreadsheet size={12}/>Export</button>
            <button className="btn-icon" onClick={fetchMaster}><RefreshCw size={13} className={loading?'spin':''}/></button>
          </div>
        </div>
        {masterTab === 'database' && <SearchBar value={searchInput} onChange={setSearchInput} debounced={searchTerm}/>}
        {loading ? <TableSkeleton rows={8} cols={5}/> : masterTab === 'grid' ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))',gap:8}}>
            {data.map((r,i) => (
              <div key={i} style={{background:'var(--surface)',border:'1px solid var(--border)', padding:'15px',display:'flex',flexDirection:'column',alignItems:'center',gap:8,borderRadius:8,background:'#fff'}}>
                <span style={{fontWeight:700,fontSize:'0.62rem',textAlign:'center'}}>{r?.unique_id}</span>
                <div className="toggle" onClick={()=>handleToggle(r.unique_id,r.assign)}
                  style={{background:r.assign==='open'?'var(--green)':'#eee', width:'38px', height:'20px', borderRadius:'12px', position:'relative', cursor:'pointer'}}>
                  <div className="toggle-dot" style={{left:r.assign==='open'?'21px':'3px', width:'14px', height:'14px', background:'#fff', borderRadius:'50%', position:'absolute', top:'3px', transition:'0.2s'}}/>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TableBox>
            <table className="data-table">
              <thead><tr><th>Lokasi</th><th>Zone</th><th>Aisle</th><th>Unique ID</th><th>Status</th><th style={{textAlign:'center'}}>Action</th></tr></thead>
              <tbody>
                {applyFilter(data).map((r,i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{r?.location_id}</td>
                    <td>{r?.zone}</td><td>{r?.aisle}</td>
                    <td className="mono">{r?.unique_id}</td>
                    <td><span className={`tag ${r?.assign==='open'?'tag-green':'tag-red'}`}>{r?.assign?.toUpperCase()}</span></td>
                    <td style={{textAlign:'center'}}>
                      <button className="btn-icon danger" onClick={()=>handleDeleteLocation(r.unique_id)} style={{padding:'4px'}}>
                        <Trash2 size={13} color="var(--red)"/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBox>
        )}
        {showAddForm && <AddLocModal onClose={()=>setShowAddForm(false)} onSave={async ()=>{
          try {
            await axios.post(`${API_BASE}?action=add_location`, { ...newLoc, location_id: newLoc.id.toUpperCase() });
            showToast("Lokasi ditambahkan"); setShowAddForm(false); fetchMaster();
          } catch { showToast("Error","error"); }
        }} newLoc={newLoc} setNewLoc={setNewLoc}/>}
      </PageWrapper>
    );
  }

  /* ════════════════════════════════════════════════════════════════════
      RENDER: PICK COMPLIANCE (Tetap)
  ════════════════════════════════════════════════════════════════════ */
  return (
    <PageWrapper>
      <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginBottom:12}}>
        <button className="btn success" onClick={handleExport}><FileSpreadsheet size={12}/>Export</button>
        <button className="btn-icon" onClick={fetchPickCompliance}><RefreshCw size={13} className={loading?'spin':''}/></button>
      </div>
      <SearchBar value={searchInput} onChange={setSearchInput} debounced={searchTerm}/>
      {loading ? <TableSkeleton rows={10} cols={6}/> : (
        <TableBox>
          <table className="data-table">
            <thead><tr>
              {['ID','Picklist','Product','Lokasi','Deskripsi','Qty','Keterangan','Status Awal','Status Akhir','Reason','Final Reason','Dibuat']
                .map(h=><th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {applyFilter(data).map((r,i) => (
                <tr key={i}>
                  <td className="mono">{r?.id}</td><td>{r?.picklist_id}</td>
                  <td>{r?.product_id}</td><td className="mono">{r?.location_id}</td>
                  <td className="muted-text">{getDesc(r)}</td>
                  <td style={{fontWeight:700}}>{r?.qty}</td><td>{r?.keterangan}</td>
                  <td>{r?.status_awal}</td><td>{r?.status_akhir}</td>
                  <td>{r?.reason}</td><td>{r?.final_reason}</td>
                  <td className="mono muted-text">{formatWIB(r?.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      )}
    </PageWrapper>
  );
}

function UploadOverlay({ status }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(255,255,255,0.88)', backdropFilter:'blur(5px)',zIndex:20000,display:'flex',flexDirection:'column', alignItems:'center',justifyContent:'center'}}>
      <div style={{width:240,background:'#f0f0f0',height:4,borderRadius:10,overflow:'hidden',marginBottom:15}}>
        <div style={{width:`${status.progress}%`,background:'#111',height:'100%',transition:'width 0.4s ease-out'}}/>
      </div>
      <span style={{fontSize:'0.6rem',fontWeight:800,letterSpacing:'0.1em',color:'#000',textTransform:'uppercase'}}>{status.text}</span>
    </div>
  );
}

function AddLocModal({ onClose, onSave, newLoc, setNewLoc }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(6px)', display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000}}>
      <div style={{background:'var(--surface)',padding:28,borderRadius:16,width:'90%',maxWidth:400, boxShadow:'0 24px 48px rgba(0,0,0,0.15)',border:'1px solid var(--border)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div style={{fontWeight:800,fontSize:'0.82rem'}}>Tambah Lokasi</div>
          <button className="btn-icon" onClick={onClose}><X size={14}/></button>
        </div>
        <label className="label-sm">Lokasi ID</label>
        <input className="field" value={newLoc.id} onChange={e=>setNewLoc({...newLoc,id:e.target.value})} placeholder="Contoh: 00101014"/>
        <div style={{display:'flex',gap:10,marginTop:10}}>
          <div style={{flex:1}}>
            <label className="label-sm">Zone</label>
            <input className="field" value={newLoc.zone} onChange={e=>setNewLoc({...newLoc,zone:e.target.value.toUpperCase()})} placeholder="1A"/>
          </div>
          <div style={{flex:1}}>
            <label className="label-sm">Aisle</label>
            <input className="field" type="number" value={newLoc.aisle} onChange={e=>setNewLoc({...newLoc,aisle:e.target.value})} placeholder="1"/>
          </div>
        </div>
        <button className="btn primary" style={{width:'100%',justifyContent:'center',padding:'11px',marginTop:18,fontSize:'0.7rem'}} onClick={onSave}>Simpan</button>
      </div>
    </div>
  );
}