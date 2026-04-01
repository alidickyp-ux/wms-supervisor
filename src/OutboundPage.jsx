import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  RefreshCw, FileSpreadsheet, ChevronRight, ArrowLeft, 
  Package, CheckCircle2, Activity, CheckSquare
} from 'lucide-react';
import { 
  API_OUTBOUND, formatWIB, getDesc, SearchBar, TableBox, 
  TableSkeleton, PageWrapper, ProgBar, useSearch 
} from './shared';
import { PrintLabelPanel } from './PrintLabel';
import DispatchPanel from './DispatchPage';

// ── Online Dispatch wrapper ───────────────────────────────────────────
function OnlineDispatch({ showToast }) {
  return <DispatchPanel showToast={showToast}/>;
}

// ── Dashboard metric card ─────────────────────────────────────────────
function MiniMetric({ icon, label, value, sub, accent }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6,
      borderTop: `3px solid ${accent}`, flex: 1, minWidth: '160px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--muted)' }}>
        {icon}
        <span style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.58rem', color: 'var(--muted2)', fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

export default function OutboundPage({ activeMenu, showToast }) {
  const [activeB2bTab, setActiveB2bTab] = useState('Explorer');
  const [explorerTab, setExplorerTab]   = useState('active');
  const [data, setData]                 = useState([]);
  const [loading, setLoading]           = useState(false);
  const { value: searchInput, setValue: setSearchInput, term: searchTerm,
          triggerNow: triggerSearch, reset: resetSearch } = useSearch();
  
  const [selectedHeader, setSelectedHeader] = useState(null);
  const [selectedPcb, setSelectedPcb]       = useState('');
  const [selectedBoxHuid, setSelectedBoxHuid] = useState('');
  const [boxOptions, setBoxOptions]         = useState([]);

  // ── Online Dispatch ──────────────────────────────────────────────
  if (activeMenu === 'Online Dispatch') {
    return <OnlineDispatch showToast={showToast}/>;
  }

  const currentSubMenu = activeB2bTab;

  useEffect(() => {
    resetSearch();
    setSelectedHeader(null);
    fetchData();
  }, [activeMenu, activeB2bTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const targets = {
        'Picking':     'picking_transactions',
        'Packing':     'packing_transactions',
        'Explorer':    'outbound_explorer',
        'Print Label': 'packing_transactions',
      };
      const target = targets[currentSubMenu];
      if (target) {
        const res = await axios.get(`${API_OUTBOUND}?action=get_data&target=${target}`);
        setData(res.data?.data || []);
      }
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  const fetchBoxByPcb = async (pcb) => {
    if (!pcb) return;
    try {
      const res = await axios.get(`${API_OUTBOUND}?action=get_print_data&pcb=${pcb}`);
      setBoxOptions(res.data?.data || []);
    } catch { showToast("Gagal menarik data box", "error"); }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `COOL_Outbound_${currentSubMenu}.xlsx`);
  };

  // ── Data processing ──────────────────────────────────────────────
  const explorerData = useMemo(() => {
    if (currentSubMenu !== 'Explorer' || !data) return [];
    const map = {};
    data.forEach(r => {
      const k = r.picklist_number; if (!k) return;
      if (!map[k]) {
        map[k] = {
          id: k,
          name: r.nama_customer || r.nama_toko || r.customer || '-',
          lines: 0, pickLinesDone: 0, packLinesDone: 0,
          totalQty: 0, qtyPicked: 0, qtyPacked: 0, isDone: false
        };
      }
      map[k].lines    += 1;
      map[k].totalQty += Number(r.qty_req    || 0);
      map[k].qtyPicked += Number(r.qty_picked || 0);
      map[k].qtyPacked += Number(r.qty_packed || 0);
      if (Number(r.qty_picked || 0) >= Number(r.qty_req)) map[k].pickLinesDone += 1;
      if (Number(r.qty_packed || 0) >= Number(r.qty_req)) map[k].packLinesDone += 1;
      if (r.status === 'packed' || r.status === 'completed') map[k].isDone = true;
    });
    return Object.values(map);
  }, [data, currentSubMenu]);

  const metrics = useMemo(() => {
    const activeList = explorerData.filter(h => !h.isDone);
    return {
      totalActive:    activeList.length,
      totalQtyActive: activeList.reduce((a,b) => a + b.totalQty, 0),
      totalQtyDone:   explorerData.reduce((a,b) => a + b.qtyPacked, 0),
      totalDone:      explorerData.filter(h => h.isDone).length,
    };
  }, [explorerData]);

  const filteredExplorer = useMemo(() => {
    const base = explorerData.filter(h => explorerTab === 'active' ? !h.isDone : h.isDone);
    if (!searchTerm) return base;
    const s = searchTerm.toUpperCase();
    return base.filter(h => h.id.includes(s) || h.name.toUpperCase().includes(s));
  }, [explorerData, explorerTab, searchTerm]);

  // filteredData: untuk Picking, Packing; dan untuk Explorer detail
  const filteredData = useMemo(() => {
    const base = selectedHeader
      ? data.filter(r => r.picklist_number === selectedHeader)
      : data;
    if (!searchTerm) return base;
    const s = searchTerm.toUpperCase();
    return base.filter(r => Object.values(r).some(v => String(v).toUpperCase().includes(s)));
  }, [data, selectedHeader, searchTerm]);

  // Info picklist yang dipilih (untuk header detail Explorer)
  const selectedPicklistInfo = useMemo(() =>
    explorerData.find(x => x.id === selectedHeader),
  [explorerData, selectedHeader]);

  return (
    <PageWrapper>
      {/* ── TOP ACTION BAR ── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
        marginBottom:16,gap:12,flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {/* Tab Picking/Packing/Explorer/Print Label */}
          {!selectedHeader && (
            <div style={{display:'flex',gap:4,background:'var(--surface)',borderRadius:8,
              padding:4,border:'1px solid var(--border)'}}>
              {['Picking','Packing','Explorer','Print Label'].map(t=>(
                <button key={t} onClick={()=>setActiveB2bTab(t)}
                  style={{padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',
                    fontSize:'0.65rem',fontWeight:700,fontFamily:'inherit',
                    background:activeB2bTab===t?'var(--text)':'transparent',
                    color:activeB2bTab===t?'#fff':'var(--muted)'}}>
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Tombol back saat di detail Explorer */}
          {selectedHeader && (
            <button className="btn-icon" onClick={()=>setSelectedHeader(null)}>
              <ArrowLeft size={14}/>
            </button>
          )}

          {/* Tab Active/Complete (hanya di Explorer list) */}
          {currentSubMenu==='Explorer' && !selectedHeader && (
            <div style={{display:'flex',background:'var(--surface)',padding:3,
              borderRadius:6,border:'1px solid var(--border)'}}>
              {['active','complete'].map(t=>(
                <button key={t} onClick={()=>setExplorerTab(t)}
                  style={{border:'none',padding:'4px 10px',borderRadius:4,fontSize:'0.6rem',
                    fontWeight:700,cursor:'pointer',fontFamily:'inherit',
                    background:explorerTab===t?'var(--text)':'transparent',
                    color:explorerTab===t?'#fff':'var(--muted)'}}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{display:'flex',gap:6}}>
          <button className="btn success" onClick={fetchData}>
            <RefreshCw size={12} className={loading?'spin':''}/>Refresh
          </button>
          <button className="btn" onClick={exportToExcel}
            style={{background:'#fff',border:'1px solid var(--border)'}}>
            <FileSpreadsheet size={12}/>Export
          </button>
        </div>
      </div>

      {/* ── DASHBOARD METRICS (Explorer list only) ── */}
      {currentSubMenu==='Explorer' && !selectedHeader && (
        <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
          <MiniMetric icon={<Activity size={14}/>}      label="Active PL"  value={metrics.totalActive}                    sub="Outstanding" accent="#3b82f6"/>
          <MiniMetric icon={<Package size={14}/>}       label="Qty Req"    value={metrics.totalQtyActive.toLocaleString()} sub="Pcs"         accent="#f59e0b"/>
          <MiniMetric icon={<CheckSquare size={14}/>}   label="Qty Pack"   value={metrics.totalQtyDone.toLocaleString()}   sub="Pcs"         accent="#8b5cf6"/>
          <MiniMetric icon={<CheckCircle2 size={14}/>}  label="Done PL"    value={metrics.totalDone}                      sub="Selesai"     accent="#10b981"/>
        </div>
      )}

      {/* ── HEADER DETAIL EXPLORER ── */}
      {currentSubMenu==='Explorer' && selectedHeader && selectedPicklistInfo && (
        <div style={{display:'flex',alignItems:'center',gap:20,background:'var(--surface)',
          border:'1px solid var(--border)',borderRadius:12,padding:'14px 20px',marginBottom:16,
          flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:160}}>
            <div style={{fontSize:'0.55rem',color:'var(--muted)',fontWeight:800,
              textTransform:'uppercase',marginBottom:3}}>Picklist / Customer</div>
            <div style={{fontSize:'0.85rem',fontWeight:900,fontFamily:"'DM Mono',monospace"}}>
              {selectedHeader}
              <span style={{fontWeight:500,fontFamily:'inherit',color:'var(--muted)',
                marginLeft:10,fontSize:'0.7rem'}}>
                — {selectedPicklistInfo.name}
              </span>
            </div>
          </div>
          {[
            { l:'SKU',  v: selectedPicklistInfo.lines },
            { l:'REQ',  v: selectedPicklistInfo.totalQty },
            { l:'PICK', v: selectedPicklistInfo.qtyPicked, c:'var(--green)' },
            { l:'PACK', v: selectedPicklistInfo.qtyPacked, c:'var(--text)'  },
          ].map(m=>(
            <div key={m.l} style={{textAlign:'center',borderLeft:'1px solid var(--border)',paddingLeft:20}}>
              <div style={{fontSize:'0.55rem',color:'var(--muted)',fontWeight:800,marginBottom:3}}>{m.l}</div>
              <div style={{fontSize:'0.8rem',fontWeight:800,color:m.c||'var(--text)'}}>{m.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── SEARCH BAR ── */}
      {currentSubMenu !== 'Print Label' && (
        <SearchBar value={searchInput} onChange={setSearchInput}
          onEnter={triggerSearch} debounced={searchTerm} placeholder="Cari data..."/>
      )}

      {/* ── PRINT LABEL (di luar TableBox) ── */}
      {currentSubMenu === 'Print Label' && (
        <PrintLabelPanel
          data={data} loading={loading}
          selectedPcb={selectedPcb} setSelectedPcb={setSelectedPcb}
          selectedBoxHuid={selectedBoxHuid} setSelectedBoxHuid={setSelectedBoxHuid}
          boxOptions={boxOptions} fetchBoxByPcb={fetchBoxByPcb}/>
      )}

      {/* ── MAIN TABLE AREA ── */}
      {currentSubMenu !== 'Print Label' && (
        loading ? <TableSkeleton rows={10} cols={5}/> : (
          <TableBox>
            {/* PICKING */}
            {currentSubMenu==='Picking' && (
              <table className="data-table">
                <thead><tr>
                  {['ID','Picklist','Product','Loc','Qty','Picker','Time'].map(h=><th key={h}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredData.map((r,i)=>(
                    <tr key={i}>
                      <td className="mono">{r.id}</td>
                      <td className="mono" style={{fontWeight:700}}>{r.picklist_number}</td>
                      <td>{r.product_id}</td>
                      <td>{r.location_id}</td>
                      <td style={{fontWeight:800}}>{r.qty_actual}</td>
                      <td>{r.picker_name}</td>
                      <td className="mono muted-text">{formatWIB(r.scanned_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* PACKING */}
            {currentSubMenu==='Packing' && (
              <table className="data-table">
                <thead><tr>
                  {['ID','Box#','Picklist','Product','Qty','Packer','Time'].map(h=><th key={h}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredData.map((r,i)=>(
                    <tr key={i}>
                      <td className="mono">{r.id}</td>
                      <td style={{fontWeight:700}}>#{r.box_number}</td>
                      <td className="mono">{r.picklist_number}</td>
                      <td>{r.product_id}</td>
                      <td style={{fontWeight:800}}>{r.qty_packed}</td>
                      <td>{r.scanned_by}</td>
                      <td className="mono muted-text">{formatWIB(r.scanned_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* EXPLORER LIST */}
            {currentSubMenu==='Explorer' && !selectedHeader && (
              <div>
                <div style={{display:'flex',padding:'12px 18px',background:'var(--bg)',
                  borderBottom:'2px solid var(--border)',fontSize:'0.58rem',fontWeight:800,
                  color:'var(--muted)',textTransform:'uppercase'}}>
                  <div style={{width:220}}>Picklist</div>
                  <div style={{width:80,textAlign:'center'}}>Lines</div>
                  <div style={{flex:1,paddingLeft:40}}>Picking Progress</div>
                  <div style={{flex:1,paddingLeft:40}}>Packing Progress</div>
                  <div style={{width:24}}/>
                </div>
                {filteredExplorer.length === 0 && (
                  <div style={{textAlign:'center',padding:40,color:'var(--muted2)',fontSize:'0.65rem'}}>
                    Tidak ada data
                  </div>
                )}
                {filteredExplorer.map(h=>(
                  <div key={h.id} className="plist-row"
                    onClick={()=>setSelectedHeader(h.id)}
                    style={{display:'flex',alignItems:'center',padding:'14px 18px',
                      borderBottom:'1px solid var(--border2)',cursor:'pointer'}}>
                    <div style={{width:220}}>
                      <div style={{fontWeight:800,fontSize:'0.72rem'}}>{h.id}</div>
                      <div style={{fontSize:'0.6rem',color:'var(--muted)'}}>{h.name}</div>
                    </div>
                    <div style={{width:80,textAlign:'center',fontWeight:700}}>{h.lines}</div>
                    <div style={{flex:1,paddingLeft:40}}>
                      <div style={{fontSize:'0.5rem',fontWeight:800,color:'var(--muted2)',marginBottom:3}}>
                        PICK: {h.pickLinesDone}/{h.lines}
                      </div>
                      <ProgBar value={h.pickLinesDone} max={h.lines}/>
                    </div>
                    <div style={{flex:1,paddingLeft:40}}>
                      <div style={{fontSize:'0.5rem',fontWeight:800,color:'var(--muted2)',marginBottom:3}}>
                        PACK: {h.packLinesDone}/{h.lines}
                      </div>
                      <ProgBar value={h.packLinesDone} max={h.lines}/>
                    </div>
                    <ChevronRight size={14} color="var(--muted2)"/>
                  </div>
                ))}
              </div>
            )}

            {/* EXPLORER DETAIL — tampil saat selectedHeader ada */}
            {currentSubMenu==='Explorer' && selectedHeader && (
              <table className="data-table">
                <thead><tr>
                  {['SKU','Deskripsi','Req','Pick','Pack','Status'].map(h=><th key={h}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredData.length === 0 && (
                    <tr><td colSpan={6} style={{textAlign:'center',padding:32,color:'var(--muted2)'}}>
                      Tidak ada data
                    </td></tr>
                  )}
                  {filteredData.map((r,i)=>(
                    <tr key={i}>
                      <td className="mono" style={{fontWeight:600}}>{r.sku||r.product_id}</td>
                      <td className="muted-text" style={{maxWidth:200,overflow:'hidden',
                        textOverflow:'ellipsis'}}>{getDesc(r)}</td>
                      <td>{r.qty_req}</td>
                      <td style={{color:Number(r.qty_picked)<Number(r.qty_req)?'var(--orange)':'var(--green)',
                        fontWeight:700}}>{r.qty_picked}</td>
                      <td style={{color:Number(r.qty_packed)<Number(r.qty_req)?'var(--orange)':'var(--green)',
                        fontWeight:700}}>{r.qty_packed}</td>
                      <td>
                        <span className={`tag ${r.status==='packed'?'tag-green':'tag-amber'}`}>
                          {r.status?.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableBox>
        )
      )}
    </PageWrapper>
  );
}