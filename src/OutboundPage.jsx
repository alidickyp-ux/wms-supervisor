import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { RefreshCw, FileSpreadsheet, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import { API_OUTBOUND, formatWIB, getDesc, SearchBar, TableBox, ProgBar, useDebounce } from './shared';
import { PrintLabelPanel } from './PrintLabel';

export default function OutboundPage({ activeMenu, showToast }) {
  const [data, setData]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDebounce(searchInput);
  const [selectedHeader, setSelectedHeader] = useState(null);
  const [explorerTab, setExplorerTab]       = useState('active');
  const [selectedPcb, setSelectedPcb]       = useState('');
  const [selectedBoxHuid, setSelectedBoxHuid] = useState('');
  const [boxOptions, setBoxOptions]         = useState([]);

  useEffect(() => {
    setSearchInput('');
    setSelectedHeader(null);
    fetchData();
  }, [activeMenu]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeMenu === 'Print Label') {
        const res = await axios.get(`${API_OUTBOUND}?target=packing_transactions`);
        setData(res.data?.data || []);
      } else {
        const tm = {
          'Picking':  'picking_transactions',
          'Packing':  'packing_transactions',
          'Explorer': 'outbound_explorer',
          'Pick Compliance': 'picking_compliance',
        };
        const res = await axios.get(`${API_OUTBOUND}?action=get_data&target=${tm[activeMenu]}`);
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
    } catch { showToast("Gagal tarik box", "error"); }
  };

  const handleExport = (rows, filename) => {
    if (!rows?.length) return showToast("Tidak ada data", "error");
    const out = rows.map(r => {
      const n = { ...r };
      ['scanned_at','tanggal_packing'].forEach(k => { if (n[k]) n[k] = formatWIB(n[k]); });
      return n;
    });
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, filename || `${activeMenu}.xlsx`);
  };

  const showPack = activeMenu === 'Packing' || activeMenu === 'Explorer';

  const picklistGroups = useMemo(() => {
    if (!['Picking','Packing','Explorer'].includes(activeMenu) || !data) return [];
    const map = {};
    data.forEach(r => {
      const k = r.picklist_number; if (!k) return;
      if (!map[k]) map[k] = { id:k, name:r.nama_customer||r.nama_toko||r.customer||'-', qtyReq:0, qtyPick:0, qtyPack:0, allPacked:true };
      map[k].qtyReq  += Number(r.qty_req||r.qty_order||0);
      map[k].qtyPick += Number(r.qty_picked||r.qty_actual||0);
      map[k].qtyPack += Number(r.qty_packed||0);
      if (r.status !== 'packed') map[k].allPacked = false;
    });
    return Object.values(map);
  }, [data, activeMenu]);

  const applyFilter = (arr) => {
    if (!searchTerm) return arr;
    const s = searchTerm.toUpperCase();
    return arr.filter(r => Object.values(r).some(v => String(v).toUpperCase().includes(s)));
  };

  const filteredGroups = applyFilter(
    picklistGroups.filter(h => activeMenu !== 'Explorer' || (explorerTab === 'active' ? !h.allPacked : h.allPacked))
  );
  const filteredData = selectedHeader
    ? data.filter(r => r.picklist_number === selectedHeader)
    : applyFilter(data);

  /* ── TOPBAR ACTIONS (dikembalikan ke parent via prop jika perlu, tapi di sini self-contained) ── */
  function TopbarActions() {
    return (
      <>
        <button className="btn success" onClick={()=>handleExport(selectedHeader?filteredData:picklistGroups,`${activeMenu}.xlsx`)}>
          <FileSpreadsheet size={12}/>Export
        </button>
        <button className="btn-icon" onClick={fetchData}><RefreshCw size={13} className={loading?'spin':''}/></button>
      </>
    );
  }

  /* ── PRINT LABEL ── */
  if (activeMenu === 'Print Label') {
    return <PrintLabelPanel data={data} selectedPcb={selectedPcb} setSelectedPcb={setSelectedPcb}
      selectedBoxHuid={selectedBoxHuid} setSelectedBoxHuid={setSelectedBoxHuid}
      boxOptions={boxOptions} fetchBoxByPcb={fetchBoxByPcb} loading={loading}/>;
  }

  /* ── PICKLIST GROUPS VIEW ── */
  if (!selectedHeader) {
    return (
      <>
        <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginBottom:12}}>
          <TopbarActions/>
        </div>
        {activeMenu === 'Explorer' && (
          <div style={{display:'flex',gap:6,marginBottom:12}}>
            {['active','completed'].map(t=>(
              <button key={t} className={`tab ${explorerTab===t?'on':'off'}`} onClick={()=>setExplorerTab(t)}>
                {t==='active'?'Active':'Completed'}
              </button>
            ))}
          </div>
        )}
        <SearchBar value={searchInput} onChange={setSearchInput} debounced={searchTerm} placeholder="Cari picklist atau nama toko..."/>
        {loading ? (
          <div style={{textAlign:'center',padding:48}}><Loader2 size={20} className="spin"/></div>
        ) : (
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            {/* Header sticky */}
            <div style={{display:'flex',padding:'7px 14px',background:'var(--bg)',borderBottom:'1px solid var(--border)',
              gap:12,fontSize:'0.57rem',color:'var(--muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',
              position:'sticky',top:0,zIndex:3}}>
              <span style={{minWidth:22,flexShrink:0}}>#</span>
              <span style={{minWidth:145,flexShrink:0}}>Picklist / Toko</span>
              <div style={{display:'flex',gap:20,flex:1,alignItems:'center'}}>
                <span style={{minWidth:52,flexShrink:0}}>Qty Req</span>
                <span style={{minWidth:52,flexShrink:0}}>Pick</span>
                {showPack && <span style={{minWidth:52,flexShrink:0}}>Pack</span>}
                {showPack && <span style={{flex:1}}>Progress</span>}
              </div>
              {activeMenu==='Explorer' && <span style={{minWidth:62,textAlign:'right',flexShrink:0}}>Status</span>}
            </div>
            {filteredGroups.map((h,i)=>(
              <div key={h.id} className="plist-row" onClick={()=>setSelectedHeader(h.id)}>
                <span style={{fontSize:'0.58rem',color:'var(--muted2)',minWidth:22,flexShrink:0,textAlign:'right'}}>{i+1}</span>
                <div style={{minWidth:145,maxWidth:145,flexShrink:0}}>
                  <div style={{fontSize:'0.68rem',fontWeight:800,letterSpacing:'-0.01em',fontFamily:"'DM Mono',monospace",color:'var(--text)'}}>{h.id}</div>
                  <div style={{fontSize:'0.58rem',color:'var(--muted)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.name}</div>
                </div>
                <div style={{display:'flex',gap:20,flex:1,alignItems:'center'}}>
                  {[h.qtyReq,h.qtyPick,...(showPack?[h.qtyPack]:[])].map((v,j)=>(
                    <span key={j} style={{minWidth:52,flexShrink:0,fontSize:'0.7rem',fontWeight:700}}>{v||0}</span>
                  ))}
                  {showPack && <ProgBar value={h.qtyPack} max={h.qtyPick||h.qtyReq||1}/>}
                </div>
                {activeMenu==='Explorer' && (
                  <span className={`tag ${h.allPacked?'tag-green':'tag-amber'}`}
                    style={{minWidth:62,textAlign:'center',flexShrink:0}}>
                    {h.allPacked?'DONE':'OPEN'}
                  </span>
                )}
                <ChevronRight size={13} style={{color:'var(--muted2)',flexShrink:0}}/>
              </div>
            ))}
            {filteredGroups.length===0 && (
              <div style={{textAlign:'center',padding:36,color:'var(--muted2)',fontSize:'0.65rem'}}>Tidak ada data</div>
            )}
          </div>
        )}
      </>
    );
  }

  /* ── DETAIL ROW VIEW ── */
  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <button className="btn-icon" onClick={()=>setSelectedHeader(null)}><ArrowLeft size={14}/></button>
        <div style={{display:'flex',gap:6}}>
          <button className="btn success" onClick={()=>handleExport(filteredData,`${activeMenu}_${selectedHeader}.xlsx`)}>
            <FileSpreadsheet size={12}/>Export
          </button>
        </div>
      </div>
      <TableBox>
        <table className="data-table">
          <thead><tr>
            {activeMenu==='Picking'
              ? ['ID','Product','Lokasi','Qty','Picker','Waktu','Status'].map(h=><th key={h}>{h}</th>)
              : activeMenu==='Explorer'
              ? ['SKU','Deskripsi','Req','Pick','Pack','Status'].map(h=><th key={h}>{h}</th>)
              : ['ID','Box#','Product','Qty','Packer','Waktu','HUID','Status'].map(h=><th key={h}>{h}</th>)
            }
          </tr></thead>
          <tbody>
            {filteredData.map((r,i)=>(
              <tr key={i}>
                {activeMenu==='Picking' ? <>
                  <td className="mono">{r?.id}</td><td>{r?.product_id}</td>
                  <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>{r?.location_id}</td>
                  <td style={{fontWeight:700}}>{r?.qty_actual}</td><td>{r?.picker_name}</td>
                  <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>{formatWIB(r?.scanned_at)}</td>
                  <td>{r?.status}</td>
                </> : activeMenu==='Explorer' ? <>
                  <td className="mono" style={{fontSize:'0.6rem'}}>{r?.sku}</td>
                  <td style={{fontSize:'0.6rem',color:'var(--muted)',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis'}}>{getDesc(r)}</td>
                  <td>{r?.qty_req}</td><td>{r?.qty_picked}</td><td>{r?.qty_packed}</td><td>{r?.status}</td>
                </> : <>
                  <td className="mono">{r?.id}</td><td>{r?.box_number}</td><td>{r?.product_id}</td>
                  <td style={{fontWeight:700}}>{r?.qty_packed}</td><td>{r?.scanned_by}</td>
                  <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>{formatWIB(r?.scanned_at)}</td>
                  <td className="mono" style={{fontSize:'0.6rem'}}>{r?.huid}</td><td>{r?.status}</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </TableBox>
    </>
  );
}