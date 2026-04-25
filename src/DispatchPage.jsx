import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { RefreshCw, FileSpreadsheet, FileText, ArrowLeft } from 'lucide-react';
import {
  API_DISPATCH, formatWIB, statusColor, SearchBar, TableBox,
  TableSkeleton, CardSkeleton, PageWrapper, useSearch
} from './shared';

export default function DispatchPage({ activeMenu, showToast }) {

  const [localTab, setLocalTab]         = useState(activeMenu || 'Dispatch Log');
  const [dispatchData, setDispatchData] = useState([]);
  const [historyData, setHistoryData]   = useState([]);
  const [selectedHistSession, setSelectedHistSession] = useState(null);
  const [histDetail, setHistDetail]     = useState(null);
  const [histSignature, setHistSignature] = useState({ sig_security: null, sig_kurir: null });
  const [loading, setLoading]           = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  const { value: searchInput, setValue: setSearchInput,
          term: searchTerm, triggerNow: triggerSearch, reset: resetSearch } = useSearch();

  const detailCache = useRef({});

  // Sinkronkan localTab jika activeMenu berubah dari luar (mode lama)
  useEffect(() => {
    if (activeMenu && activeMenu !== localTab) setLocalTab(activeMenu);
  }, [activeMenu]);

  useEffect(() => {
    resetSearch();
    setSelectedHistSession(null);
    setHistDetail(null);
    setHistSignature({ sig_security: null, sig_kurir: null });
    fetchData(localTab);
  }, [localTab]);

  // ── FETCH ──────────────────────────────────────────────────────────
  const fetchData = async (tab) => {
    setLoading(true);
    try {
      const target = tab === 'Dispatch Log' ? 'dispatch_list'
                   : tab === 'Handover'     ? 'handover_list'
                   : 'session_list';
      const res = await axios.get(`${API_DISPATCH}?action=get_data&target=${target}`);
      const raw = res.data?.data || [];
      if (tab === 'History') setHistoryData(raw.filter(s => s.status === 'HANDOVER_DONE'));
      else setDispatchData(raw);
    } catch { showToast("Gagal memuat data", "error"); }
    finally { setLoading(false); }
  };

  const loadHistDetail = async (session) => {
    const key = session.session_code;
    setSelectedHistSession(session);
    if (detailCache.current[key]) {
      const { detail, signature } = detailCache.current[key];
      setHistDetail(detail);
      setHistSignature(signature);
      return;
    }
    setHistDetail(null);
    setHistSignature({ sig_security: null, sig_kurir: null });
    setDetailLoading(true);
    try {
      const [logRes, sigRes] = await Promise.all([
        axios.get(`${API_DISPATCH}?action=get_data&target=session_log&session_code=${key}`),
        axios.get(`${API_DISPATCH}?action=get_data&target=session_signature&session_code=${key}`)
      ]);
      const detail    = logRes.data?.data || [];
      const signature = sigRes.data?.status === 'success'
        ? sigRes.data.data : { sig_security: null, sig_kurir: null };
      detailCache.current[key] = { detail, signature };
      setHistDetail(detail);
      setHistSignature(signature);
    } catch { showToast("Gagal memuat detail", "error"); }
    finally { setDetailLoading(false); }
  };

  // ── EXPORT ─────────────────────────────────────────────────────────
  const handleExport = (rows, filename) => {
    if (!rows?.length) return showToast("Tidak ada data", "error");
    const out = rows.map(r => {
      const n = { ...r };
      ['scanned_at','handover_at','closed_at'].forEach(k => { if (n[k]) n[k] = formatWIB(n[k]); });
      return n;
    });
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, filename || `${localTab}.xlsx`);
  };

  // ── PRINT PDF ──────────────────────────────────────────────────────
  const printHandoverPdf = () => {
    if (!selectedHistSession || !histDetail) return;
    const s = selectedHistSession;

    const confirmed  = histDetail.filter(r => r.handover_status === 'CONFIRMED').length;
    const notFound   = histDetail.filter(r => ['NOT_FOUND','DISCREPANCY'].includes(r.handover_status)).length;
    const cancelled  = histDetail.filter(r => r.handover_status === 'CANCELLED').length;

    const rows = histDetail.map((r,i) => {
      const status = r.handover_status || '-';
      const color  = status === 'CONFIRMED'    ? '#166534'
                   : status === 'NOT_FOUND'   ? '#92400e'
                   : status === 'DISCREPANCY' ? '#991b1b' : '#991b1b';
      const bg     = status === 'CONFIRMED'    ? '#dcfce7'
                   : status === 'NOT_FOUND'   ? '#fef3c7'
                   : status === 'DISCREPANCY' ? '#fee2e2' : '#fee2e2';
      return `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
        <td style="text-align:center">${i+1}</td>
        <td style="font-family:monospace;font-size:11px">${r.tracking_reference||r.do_reference||'-'}</td>
        <td style="text-align:center">
          <span style="background:${bg};color:${color};padding:2px 10px;border-radius:4px;font-size:10px;font-weight:700">${status}</span>
        </td>
      </tr>`;
    }).join('');

    const sigHtml = (label, name, src) => `
      <div style="text-align:center;border:1px solid #e5e7eb;border-radius:8px;padding:16px">
        <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">
          TTD ${label}
        </div>
        ${src
          ? `<img src="${src}" style="height:70px;object-fit:contain;display:block;margin:0 auto"/>`
          : `<div style="height:70px;display:flex;align-items:center;justify-content:center;color:#d1d5db;font-size:11px">Tidak ada tanda tangan</div>`}
        <div style="margin-top:8px;font-size:11px;font-weight:600;border-top:1px solid #e5e7eb;padding-top:8px">
          ( ${name || '—'} )
        </div>
      </div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Handover ${s.session_code}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Arial',sans-serif;font-size:12px;color:#111;padding:32px;background:#fff}
        h1{font-size:18px;font-weight:900;letter-spacing:-0.02em;margin-bottom:4px}
        .sub{font-size:10px;color:#6b7280;margin-bottom:20px}
        .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;
          background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:20px}
        .info-item .lbl{font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px}
        .info-item .val{font-size:13px;font-weight:800;color:#111}
        .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
        .sum-box{border-radius:8px;padding:12px;text-align:center}
        .sum-box .num{font-size:22px;font-weight:900}
        .sum-box .lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px}
        table{width:100%;border-collapse:collapse;margin-bottom:24px}
        th{background:#111;color:#fff;padding:8px 12px;font-size:10px;font-weight:700;
          text-transform:uppercase;letter-spacing:0.06em;text-align:left}
        td{padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:11px}
        .signs{display:grid;grid-template-columns:1fr 1fr;gap:20px}
        @media print{body{padding:16px}@page{margin:1cm}}
      </style></head><body>
      <h1>HANDOVER LIST</h1>
      <div class="sub">Dicetak: ${new Date().toLocaleString('id-ID')}</div>

      <div class="info-grid">
        <div class="info-item"><div class="lbl">Session Code</div><div class="val">${s.session_code}</div></div>
        <div class="info-item"><div class="lbl">Transporter</div><div class="val">${s.transporter_id||'-'}</div></div>
        <div class="info-item"><div class="lbl">Tanggal</div><div class="val">${formatWIB(s.closed_at)}</div></div>
        <div class="info-item"><div class="lbl">Security</div><div class="val">${s.security_name||'-'}</div></div>
        <div class="info-item"><div class="lbl">Kurir</div><div class="val">${s.courier_name||'-'}</div></div>
        <div class="info-item"><div class="lbl">No. Kendaraan</div><div class="val">${s.vehicle_number||'-'}</div></div>
      </div>

      <div class="summary">
        <div class="sum-box" style="background:#dcfce7">
          <div class="num" style="color:#166534">${confirmed}</div>
          <div class="lbl" style="color:#166534">Confirmed</div>
        </div>
        <div class="sum-box" style="background:#fef3c7">
          <div class="num" style="color:#92400e">${notFound}</div>
          <div class="lbl" style="color:#92400e">Not Found</div>
        </div>
        <div class="sum-box" style="background:#fee2e2">
          <div class="num" style="color:#991b1b">${cancelled}</div>
          <div class="lbl" style="color:#991b1b">Cancelled</div>
        </div>
      </div>

      <table>
        <thead><tr><th style="width:40px;text-align:center">No</th><th>AWB / DO Reference</th><th style="width:120px;text-align:center">Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="signs">
        ${sigHtml('Security', s.security_name, histSignature.sig_security)}
        ${sigHtml('Kurir', s.courier_name, histSignature.sig_kurir)}
      </div>
      <script>window.onload=()=>{window.print()}</script>
    </body></html>`;

    const w = window.open('','_blank');
    w.document.write(html);
    w.document.close();
  };

  // ── FILTER ─────────────────────────────────────────────────────────
  const filteredDispatch = dispatchData.filter(r =>
    !searchTerm || Object.values(r).some(v => String(v).toUpperCase().includes(searchTerm.toUpperCase()))
  );

  const filteredHistory = historyData.filter(s => {
    if (searchTerm && !JSON.stringify(s).toUpperCase().includes(searchTerm.toUpperCase())) return false;
    if (dateFrom || dateTo) {
      // Robust date parse — handle "2026-03-05T10:41:46.698Z" dan "2026-03-05 10:41:46"
      const raw = String(s.closed_at||'').trim()
        .replace('T',' ').replace(/\.\d+/,'').replace(/Z$/,'')
        .replace(/[+-]\d{2}:?\d{0,2}$/,'');
      const sessionDate = raw.split(' ')[0];
      if (dateFrom && sessionDate < dateFrom) return false;
      if (dateTo   && sessionDate > dateTo)   return false;
    }
    return true;
  });

  // ── TAB SWITCHER ───────────────────────────────────────────────────
  const TabBar = () => (
    <div style={{display:'flex',gap:4,background:'var(--surface)',borderRadius:9,
      padding:4,border:'1px solid var(--border)',width:'fit-content',marginBottom:16}}>
      {['Dispatch Log','Handover','History'].map(tab => (
        <button key={tab} onClick={()=>setLocalTab(tab)}
          style={{padding:'6px 16px',borderRadius:6,border:'none',cursor:'pointer',
            fontSize:'0.62rem',fontWeight:700,fontFamily:'inherit',transition:'all 0.15s',
            background:localTab===tab?'var(--text)':'transparent',
            color:localTab===tab?'#fff':'var(--muted)',whiteSpace:'nowrap'}}>
          {tab}
        </button>
      ))}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // RENDER: HISTORY
  // ═══════════════════════════════════════════════════════════════════
  if (localTab === 'History') {

    // ── Detail view ──
    if (selectedHistSession) {
      const s = selectedHistSession;
      return (
        <PageWrapper>
          {/* Back + Actions */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <button className="btn-icon" onClick={()=>{setSelectedHistSession(null);setHistDetail(null);}}>
              <ArrowLeft size={14}/>
            </button>
            <div style={{display:'flex',gap:6}}>
              <button className="btn success" onClick={()=>handleExport(histDetail,`${s.session_code}.xlsx`)}>
                <FileSpreadsheet size={12}/>Excel
              </button>
              <button className="btn" style={{color:'var(--orange)'}} onClick={printHandoverPdf}>
                <FileText size={12}/>PDF
              </button>
            </div>
          </div>

          {/* Info grid lengkap */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,
            background:'var(--surface)',border:'1px solid var(--border)',
            borderRadius:10,padding:'14px 16px',marginBottom:14}}>
            {[
              ['Session',     s.session_code],
              ['Transporter', s.transporter_id||'-'],
              ['Security',    s.security_name||'-'],
              ['Kurir',       s.courier_name||'-'],
              ['No. Kendaraan', s.vehicle_number||'-'],
              ['Tanggal',     formatWIB(s.closed_at)],
              ['Total Paket', `${histDetail?.length??s.total_sorted??0} pkt`],
              ['Status',      <span className="tag tag-green">HANDOVER DONE</span>],
            ].map(([k,v])=>(
              <div key={k}>
                <div style={{fontSize:'0.55rem',color:'var(--muted)',fontWeight:700,
                  letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:3}}>{k}</div>
                <div style={{fontSize:'0.7rem',fontWeight:700}}>{v}</div>
              </div>
            ))}
          </div>

          {/* Summary badge confirmed/notfound/cancelled */}
          {histDetail && (
            <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
              {[
                ['CONFIRMED', 'tag-green', histDetail.filter(r=>r.handover_status==='CONFIRMED').length],
                ['NOT FOUND',  'tag-amber', histDetail.filter(r=>['NOT_FOUND','DISCREPANCY'].includes(r.handover_status)).length],
                ['CANCELLED',  'tag-red',   histDetail.filter(r=>r.handover_status==='CANCELLED').length],
              ].map(([label,cls,count])=>(
                <span key={label} className={`tag ${cls}`} style={{fontSize:'0.6rem',padding:'3px 10px'}}>
                  {label}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          )}

          {/* Tabel detail */}
          {detailLoading ? <TableSkeleton rows={8} cols={3}/> : (
            <TableBox>
              <table className="data-table">
                <thead><tr><th>No.</th><th>AWB / DO Reference</th><th>Status</th></tr></thead>
                <tbody>
                  {(histDetail||[]).map((r,i)=>(
                    <tr key={i}>
                      <td className="mono">{i+1}</td>
                      <td style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem'}}>
                        {r.tracking_reference||r.do_reference||'-'}
                      </td>
                      <td>
                        <span className={`tag ${
                          r.handover_status==='CONFIRMED'   ? 'tag-green'
                          : r.handover_status==='NOT_FOUND' ? 'tag-amber'
                          : r.handover_status==='DISCREPANCY' ? 'tag-red'
                          : r.handover_status==='CANCELLED' ? 'tag-red' : 'tag-red'
                        }`}>{r.handover_status||'-'}</span>
                      </td>
                    </tr>
                  ))}
                  {(!histDetail||histDetail.length===0) && (
                    <tr><td colSpan={3} style={{textAlign:'center',padding:32,color:'var(--muted2)'}}>
                      Tidak ada data
                    </td></tr>
                  )}
                </tbody>
              </table>
            </TableBox>
          )}

          {/* Tanda tangan */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:16}}>
            {[['Security', s.security_name, histSignature.sig_security],
              ['Kurir',    s.courier_name,  histSignature.sig_kurir]].map(([role, name, sig])=>(
              <div key={role} style={{border:'1px solid var(--border)',borderRadius:10,
                padding:14,background:'var(--surface)',textAlign:'center'}}>
                <div style={{fontSize:'0.6rem',fontWeight:700,color:'var(--muted)',
                  textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>
                  TTD {role}
                </div>
                {sig
                  ? <img src={sig} alt={`TTD ${role}`}
                      style={{width:'100%',height:80,objectFit:'contain',borderRadius:6,background:'#fafaf8'}}/>
                  : <div style={{height:80,background:'var(--bg)',borderRadius:6,display:'flex',
                      alignItems:'center',justifyContent:'center',fontSize:'0.6rem',color:'var(--muted2)'}}>
                      Belum ada tanda tangan
                    </div>
                }
                <div style={{fontSize:'0.6rem',color:'var(--muted)',marginTop:6,
                  borderTop:'1px solid var(--border2)',paddingTop:6,fontStyle:'italic'}}>
                  ( {name||'—'} )
                </div>
              </div>
            ))}
          </div>
        </PageWrapper>
      );
    }

    // ── History list view ──
    return (
      <PageWrapper>
        <TabBar/>

        {/* Filter tanggal */}
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12,alignItems:'center',
          background:'var(--surface)',border:'1px solid var(--border)',
          borderRadius:10,padding:'10px 14px'}}>
          <span style={{fontSize:'0.58rem',fontWeight:700,color:'var(--muted)',
            textTransform:'uppercase',letterSpacing:'0.06em',marginRight:4}}>
            Filter Tanggal
          </span>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:'0.62rem',color:'var(--muted)'}}>Dari</span>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
              style={{border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',
                fontSize:'0.65rem',fontFamily:'inherit',background:'var(--bg)',
                color:'var(--text)',cursor:'pointer',outline:'none'}}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:'0.62rem',color:'var(--muted)'}}>Sampai</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
              style={{border:'1px solid var(--border)',borderRadius:6,padding:'4px 8px',
                fontSize:'0.65rem',fontFamily:'inherit',background:'var(--bg)',
                color:'var(--text)',cursor:'pointer',outline:'none'}}/>
          </div>
          {(dateFrom||dateTo) && (
            <button className="btn danger" style={{padding:'4px 10px',fontSize:'0.62rem'}}
              onClick={()=>{setDateFrom('');setDateTo('');}}>✕ Reset</button>
          )}
          <div style={{flex:1}}/>
          <button className="btn success" onClick={()=>handleExport(filteredHistory,'History.xlsx')}>
            <FileSpreadsheet size={12}/>Export
          </button>
          <button className="btn-icon" onClick={()=>fetchData('History')}>
            <RefreshCw size={13} className={loading?'spin':''}/>
          </button>
        </div>

        <SearchBar value={searchInput} onChange={setSearchInput} onEnter={triggerSearch}
          debounced={searchTerm} placeholder="Cari session, kurir, security..."/>

        {/* Summary */}
        {(dateFrom||dateTo||searchTerm) && (
          <div style={{marginBottom:12,fontSize:'0.62rem',color:'var(--muted)',
            display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontWeight:700,color:'var(--text)'}}>{filteredHistory.length}</span> session ditemukan
            {(dateFrom||dateTo) && (
              <span style={{color:'var(--muted2)'}}>
                · {dateFrom||'...'} → {dateTo||'sekarang'}
              </span>
            )}
          </div>
        )}

        {loading ? <CardSkeleton count={6}/> : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
            {filteredHistory.map((s,i)=>(
              <div key={i} className="hist-card" onClick={()=>loadHistDetail(s)}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:'0.75rem',letterSpacing:'-0.01em',marginBottom:2}}>
                      {s.session_code}
                    </div>
                    <div style={{fontSize:'0.6rem',color:'var(--muted)',marginBottom:6}}>
                      {s.transporter_id||'-'}
                    </div>
                    <div style={{fontSize:'0.6rem',color:'var(--muted)'}}>
                      <span style={{marginRight:10}}>👤 {s.security_name||'-'}</span>
                      <span>🚚 {s.courier_name||'-'}</span>
                    </div>
                    {s.vehicle_number && (
                      <div style={{fontSize:'0.58rem',color:'var(--muted2)',marginTop:3}}>
                        🚗 {s.vehicle_number}
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:'1.3rem',fontWeight:900,letterSpacing:'-0.03em',lineHeight:1}}>
                      {s.total_sorted}
                    </div>
                    <div style={{fontSize:'0.55rem',color:'var(--muted)',marginBottom:4}}>paket</div>
                    <span className="tag tag-green">DONE</span>
                  </div>
                </div>
                <div style={{marginTop:10,paddingTop:8,borderTop:'1px solid var(--border2)',
                  fontSize:'0.58rem',color:'var(--muted2)',fontFamily:"'DM Mono',monospace"}}>
                  {formatWIB(s.closed_at)}
                </div>
              </div>
            ))}
            {filteredHistory.length===0 && (
              <div style={{gridColumn:'1/-1',textAlign:'center',padding:48,
                color:'var(--muted2)',fontSize:'0.68rem'}}>
                {historyData.length===0 ? 'Belum ada history handover' : 'Tidak ada data untuk filter ini'}
              </div>
            )}
          </div>
        )}
      </PageWrapper>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER: DISPATCH LOG & HANDOVER
  // ═══════════════════════════════════════════════════════════════════
  const isHO = localTab === 'Handover';
  return (
    <PageWrapper>
      <TabBar/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div/>
        <div style={{display:'flex',gap:6}}>
          <button className="btn success"
            onClick={()=>handleExport(filteredDispatch,`${localTab}.xlsx`)}>
            <FileSpreadsheet size={12}/>Export
          </button>
          <button className="btn-icon" onClick={()=>fetchData(localTab)}>
            <RefreshCw size={13} className={loading?'spin':''}/>
          </button>
        </div>
      </div>

      <SearchBar value={searchInput} onChange={setSearchInput} onEnter={triggerSearch} debounced={searchTerm}/>

      {loading ? <TableSkeleton rows={10} cols={isHO?8:7}/> : (
        <TableBox>
          <table className="data-table">
            <thead><tr>
              {isHO
                ? ['ID','Session','AWB / DO Ref','Status','Security','Kurir','No. Kendaraan','Handover At'].map(h=><th key={h}>{h}</th>)
                : ['ID','Session','Transporter','AWB / DO Ref','Operator','Status','Scanned At'].map(h=><th key={h}>{h}</th>)
              }
            </tr></thead>
            <tbody>
              {filteredDispatch.map((r,i)=>(
                <tr key={i}>
                  {isHO ? <>
                    <td className="mono">{r.id}</td>
                    <td style={{fontWeight:700}}>{r.session_code}</td>
                    <td style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem'}}>
                      {r.tracking_reference||r.do_reference||'-'}
                    </td>
                    <td><span className={`tag ${
                      r.status==='CONFIRMED'?'tag-green':r.status==='NOT_FOUND'?'tag-amber':'tag-red'
                    }`}>{r.status}</span></td>
                    <td>{r.security_name||'-'}</td>
                    <td>{r.courier_name||'-'}</td>
                    <td>{r.vehicle_number||'-'}</td>
                    <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>
                      {formatWIB(r.handover_at)}
                    </td>
                  </> : <>
                    <td className="mono">{r.id}</td>
                    <td style={{fontWeight:700}}>{r.session_code}</td>
                    <td>{r.transporter_id}</td>
                    <td style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem'}}>
                      {r.tracking_reference||r.do_reference||'-'}
                    </td>
                    <td>{r.operator}</td>
                    <td><span className={`tag ${
                      r.handover_status==='CONFIRMED'?'tag-green'
                      :r.handover_status==='NOT_FOUND'?'tag-amber':'tag-red'
                    }`}>{r.handover_status||'-'}</span></td>
                    <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>
                      {formatWIB(r.scanned_at)}
                    </td>
                  </>}
                </tr>
              ))}
              {filteredDispatch.length===0 && (
                <tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'var(--muted2)'}}>
                  Tidak ada data
                </td></tr>
              )}
            </tbody>
          </table>
        </TableBox>
      )}
    </PageWrapper>
  );
}