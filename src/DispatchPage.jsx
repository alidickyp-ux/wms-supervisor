import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { RefreshCw, FileSpreadsheet, FileText } from 'lucide-react';
import { API_DISPATCH, formatWIB, statusColor, SearchBar, TableBox, TableSkeleton, CardSkeleton, PageWrapper, useDebounce } from './shared';

export default function DispatchPage({ activeMenu, showToast }) {
  const [dispatchData, setDispatchData]           = useState([]);
  const [historyData, setHistoryData]             = useState([]);
  const [selectedHistSession, setSelectedHistSession] = useState(null);
  const [histDetail, setHistDetail]               = useState(null);
  const [histSignature, setHistSignature]         = useState({ sig_security: null, sig_kurir: null });
  const [loading, setLoading]                     = useState(false);
  const [searchInput, setSearchInput]             = useState('');
  const searchTerm = useDebounce(searchInput);

  useEffect(() => {
    setSearchInput('');
    setSelectedHistSession(null);
    setHistDetail(null);
    fetchData(activeMenu);
  }, [activeMenu]);

  const fetchData = async (menu) => {
    setLoading(true);
    try {
      if (menu === 'Dispatch Log') {
        const res = await axios.get(`${API_DISPATCH}?action=get_data&target=dispatch_list`);
        setDispatchData(res.data?.data || []);
      } else if (menu === 'Handover') {
        const res = await axios.get(`${API_DISPATCH}?action=get_data&target=handover_list`);
        setDispatchData(res.data?.data || []);
      } else if (menu === 'History') {
        const res = await axios.get(`${API_DISPATCH}?action=get_data&target=session_list`);
        setHistoryData((res.data?.data || []).filter(s => s.status === 'HANDOVER_DONE'));
      }
    } catch { setDispatchData([]); }
    finally { setLoading(false); }
  };

  const loadHistDetail = async (session) => {
    setSelectedHistSession(session);
    setHistSignature({ sig_security: null, sig_kurir: null });
    try {
      const [logRes, sigRes] = await Promise.all([
        axios.get(`${API_DISPATCH}?action=get_data&target=session_log&session_code=${session.session_code}`),
        axios.get(`${API_DISPATCH}?action=get_data&target=session_signature&session_code=${session.session_code}`)
      ]);
      setHistDetail(logRes.data?.data || []);
      if (sigRes.data?.status === 'success') setHistSignature(sigRes.data.data);
    } catch { showToast("Gagal load detail", "error"); }
  };

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
    XLSX.writeFile(wb, filename || `${activeMenu}.xlsx`);
  };

  const printHandoverPdf = () => {
    if (!selectedHistSession || !histDetail) return;
    const s = selectedHistSession;
    const rows = histDetail.map((r,i) =>
      `<tr style="background:${i%2===0?'#fff':'#f9f9f9'}">
        <td>${i+1}</td>
        <td>${r.tracking_reference||r.do_reference||'-'}</td>
        <td style="color:${statusColor(r.handover_status)};font-weight:700">${r.handover_status||'-'}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Handover ${s.session_code}</title>
    <style>*{font-family:Arial;font-size:11px}body{margin:30px}h2{text-align:center;margin-bottom:16px}
    .g{display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;margin:12px 0;padding:12px;background:#f9f9f9;border-radius:4px}
    .r{display:flex;gap:6px}.lb{font-weight:700;min-width:100px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#222;color:#fff;padding:7px 10px;text-align:left}
    td{padding:6px 10px;border-bottom:1px solid #eee}
    .signs{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:32px}
    .sb{border:1px solid #ccc;height:80px;border-radius:4px;margin-top:6px}
    .sn{text-align:center;margin-top:6px;color:#666}
    @media print{body{margin:15px}}</style></head><body>
    <h2>HANDOVER LIST</h2>
    <div class="g">
      <div class="r"><span class="lb">Session</span><span>: ${s.session_code}</span></div>
      <div class="r"><span class="lb">Tgl Handover</span><span>: ${formatWIB(s.closed_at)?.split(' ')[0]||'-'}</span></div>
      <div class="r"><span class="lb">Security</span><span>: ${s.security_name||'-'}</span></div>
      <div class="r"><span class="lb">Jam</span><span>: ${formatWIB(s.closed_at)?.split(' ')[1]||'-'}</span></div>
      <div class="r"><span class="lb">Kurir</span><span>: ${s.courier_name||'-'}</span></div>
      <div class="r"><span class="lb">No. Kendaraan</span><span>: ${s.vehicle_number||'-'}</span></div>
      <div class="r"><span class="lb">Total Paket</span><span>: ${histDetail.length} paket</span></div>
    </div>
    <table><thead><tr><th style="width:40px">No.</th><th>No. AWB</th><th style="width:110px">Status</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="signs">
      <div>
        <div style="font-weight:700;margin-bottom:6px">Security</div>
        ${histSignature.sig_security
          ? `<img src="${histSignature.sig_security}" style="width:100%;height:80px;object-fit:contain;border:1px solid #ccc;border-radius:4px"/>`
          : '<div class="sb"></div>'}
        <div class="sn">( ${s.security_name||'_____________'} )</div>
      </div>
      <div>
        <div style="font-weight:700;margin-bottom:6px">Kurir</div>
        ${histSignature.sig_kurir
          ? `<img src="${histSignature.sig_kurir}" style="width:100%;height:80px;object-fit:contain;border:1px solid #ccc;border-radius:4px"/>`
          : '<div class="sb"></div>'}
        <div class="sn">( ${s.courier_name||'_____________'} )</div>
      </div>
    </div>
    <script>window.onload=()=>window.print()<\/script></body></html>`;
    const w = window.open('', '_blank'); w.document.write(html); w.document.close();
  };

  const filteredDispatch = (() => {
    if (!searchTerm) return dispatchData;
    const s = searchTerm.toUpperCase();
    return dispatchData.filter(r => Object.values(r).some(v => String(v).toUpperCase().includes(s)));
  })();

  /* ── HISTORY ── */
  if (activeMenu === 'History') {
    if (selectedHistSession) {
      return (
        <PageWrapper>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <button className="btn-icon" onClick={()=>{setSelectedHistSession(null);setHistDetail(null);}}>←</button>
            <div style={{display:'flex',gap:6}}>
              <button className="btn success" onClick={()=>handleExport(histDetail,`Handover_${selectedHistSession.session_code}.xlsx`)}>
                <FileSpreadsheet size={12}/>Excel
              </button>
              <button className="btn" style={{color:'var(--orange)'}} onClick={printHandoverPdf}>
                <FileText size={12}/>PDF
              </button>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8,
            background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,
            padding:'14px 16px',marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            {[['Session',selectedHistSession.session_code],['Transporter',selectedHistSession.transporter_id],
              ['Security',selectedHistSession.security_name||'-'],['Kurir',selectedHistSession.courier_name||'-'],
              ['No. Kendaraan',selectedHistSession.vehicle_number||'-'],['Total',`${histDetail?.length||0} paket`]
            ].map(([k,v])=>(
              <div key={k}>
                <div style={{fontSize:'0.55rem',color:'var(--muted)',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:2}}>{k}</div>
                <div style={{fontSize:'0.7rem',fontWeight:700}}>{v}</div>
              </div>
            ))}
          </div>
          <TableBox>
            <table className="data-table">
              <thead><tr><th>No.</th><th>No. AWB</th><th>Status</th></tr></thead>
              <tbody>
                {(histDetail||[]).map((r,i)=>(
                  <tr key={i}>
                    <td className="mono">{i+1}</td>
                    <td style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem'}}>{r.tracking_reference||r.do_reference||'-'}</td>
                    <td><span className={`tag ${r.handover_status==='CONFIRMED'?'tag-green':r.handover_status==='NOT_FOUND'?'tag-amber':'tag-red'}`}>{r.handover_status||'-'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableBox>
          {/* Signatures */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:16}}>
            {['security','kurir'].map(role => {
              const sig  = role==='security' ? histSignature.sig_security : histSignature.sig_kurir;
              const name = role==='security' ? selectedHistSession?.security_name : selectedHistSession?.courier_name;
              return (
                <div key={role} style={{border:'1px solid var(--border)',borderRadius:10,padding:14,background:'var(--surface)'}}>
                  <div style={{fontSize:'0.6rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>
                    TTD {role==='security'?'Security':'Kurir'}
                  </div>
                  {sig ? (
                    <img src={sig} alt={`TTD ${role}`} style={{width:'100%',height:80,objectFit:'contain',borderRadius:6,background:'#fafaf8'}}/>
                  ) : (
                    <div style={{height:80,background:'var(--bg)',borderRadius:6,display:'flex',alignItems:'center',
                      justifyContent:'center',fontSize:'0.6rem',color:'var(--muted2)'}}>Belum ada tanda tangan</div>
                  )}
                  <div style={{fontSize:'0.6rem',color:'var(--muted)',textAlign:'center',marginTop:6,fontStyle:'italic'}}>
                    ( {name||'—'} )
                  </div>
                </div>
              );
            })}
          </div>
        </PageWrapper>
      );
    }

    return (
      <PageWrapper>
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
          <button className="btn-icon" onClick={()=>fetchData('History')}><RefreshCw size={13} className={loading?'spin':''}/></button>
        </div>
        <SearchBar value={searchInput} onChange={setSearchInput} debounced={searchTerm} placeholder="Cari session, kurir, security..."/>
        {loading ? <CardSkeleton count={6}/> : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
            {historyData
              .filter(s => !searchTerm || JSON.stringify(s).toUpperCase().includes(searchTerm.toUpperCase()))
              .map((s,i)=>(
              <div key={i} className="hist-card" onClick={()=>loadHistDetail(s)}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:'0.75rem',letterSpacing:'-0.01em',marginBottom:2}}>{s.session_code}</div>
                    <div style={{fontSize:'0.6rem',color:'var(--muted)',marginBottom:6}}>{s.transporter_id}</div>
                    <div style={{fontSize:'0.6rem',color:'var(--muted)'}}>
                      <span style={{marginRight:10}}>👤 {s.security_name||'-'}</span>
                      <span>🚚 {s.courier_name||'-'}</span>
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:'1.3rem',fontWeight:900,letterSpacing:'-0.03em',lineHeight:1}}>{s.total_sorted}</div>
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
            {historyData.length===0 && !loading && (
              <div style={{gridColumn:'1/-1',textAlign:'center',padding:48,color:'var(--muted2)',fontSize:'0.68rem'}}>
                Belum ada history handover
              </div>
            )}
          </div>
        )}
      </PageWrapper>
    );
  }

  /* ── DISPATCH LOG & HANDOVER ── */
  const isHO = activeMenu === 'Handover';
  return (
    <PageWrapper>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div/>
        <div style={{display:'flex',gap:6}}>
          <button className="btn success" onClick={()=>handleExport(filteredDispatch,`${activeMenu}.xlsx`)}>
            <FileSpreadsheet size={12}/>Export
          </button>
          <button className="btn-icon" onClick={()=>fetchData(activeMenu)}>
            <RefreshCw size={13} className={loading?'spin':''}/>
          </button>
        </div>
      </div>
      <SearchBar value={searchInput} onChange={setSearchInput} debounced={searchTerm}/>
      {loading ? <TableSkeleton rows={10} cols={isHO ? 8 : 7}/> : (
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
                    <td style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem'}}>{r.tracking_reference||r.do_reference||'-'}</td>
                    <td><span className={`tag ${r.status==='CONFIRMED'?'tag-green':r.status==='NOT_FOUND'?'tag-amber':'tag-red'}`}>{r.status}</span></td>
                    <td>{r.security_name||'-'}</td><td>{r.courier_name||'-'}</td>
                    <td>{r.vehicle_number||'-'}</td>
                    <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>{formatWIB(r.handover_at)}</td>
                  </> : <>
                    <td className="mono">{r.id}</td>
                    <td style={{fontWeight:700}}>{r.session_code}</td>
                    <td>{r.transporter_id}</td>
                    <td style={{fontFamily:"'DM Mono',monospace",fontSize:'0.62rem'}}>{r.tracking_reference||r.do_reference||'-'}</td>
                    <td>{r.operator}</td>
                    <td><span className={`tag ${r.handover_status==='CONFIRMED'?'tag-green':r.handover_status==='NOT_FOUND'?'tag-amber':'tag-red'}`}>{r.handover_status||'-'}</span></td>
                    <td className="mono" style={{fontSize:'0.6rem',color:'var(--muted)'}}>{formatWIB(r.scanned_at)}</td>
                  </>}
                </tr>
              ))}
              {filteredDispatch.length===0 && (
                <tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'var(--muted2)'}}>Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </TableBox>
      )}
    </PageWrapper>
  );
}