import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { PrintLabelPanel } from './PrintLabel';
import {
  RefreshCw, FileSpreadsheet, Trash2, LogOut, Upload, Search,
  ChevronLeft, ClipboardCheck, PackageCheck, BarChart3, Download,
  CheckCircle2, Loader2, Check, Plus, Database as DbIcon, LayoutGrid, X,
  Truck, Package, Globe, Printer, ArrowLeft, ChevronDown, ChevronRight,
  FileText
} from 'lucide-react';

/* --- API ENDPOINTS --- */
const API_BASE     = 'https://wms-neon-bridge.vercel.app/api/inventory';
const API_OUTBOUND = 'https://wms-neon-bridge.vercel.app/api/to_web';
const API_DISPATCH = 'https://wms-neon-bridge.vercel.app/api/dispatch';

function App() {
  /* ================= STATE ================= */
  const [isLoggedIn, setIsLoggedIn]     = useState(false);
  const [user, setUser]                 = useState(null);
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeMenu, setActiveMenu]     = useState('Master Lokasi');
  const [activeDispatch, setActiveDispatch] = useState(null); // 'dispatch_log' | 'handover' | 'history'
  const [dispatchOpen, setDispatchOpen] = useState(false);

  const [masterTab, setMasterTab]       = useState('grid');
  const [explorerTab, setExplorerTab]   = useState('active');
  const [data, setData]                 = useState([]);
  const [loading, setLoading]           = useState(false);
  const [searchTerm, setSearchTerm]     = useState('');
  const [selectedRows, setSelectedRows] = useState([]);
  const [showAddForm, setShowAddForm]   = useState(false);
  const [newLoc, setNewLoc]             = useState({ id: '', zone: '', aisle: '', unique: '', assign: 'closed' });
  const [toast, setToast]               = useState({ show: false, msg: '', type: 'success' });
  const [selectedHeader, setSelectedHeader] = useState(null);

  /* Print Integration */
  const [selectedPcb, setSelectedPcb]         = useState('');
  const [selectedBoxHuid, setSelectedBoxHuid] = useState('');
  const [boxOptions, setBoxOptions]           = useState([]);

  /* Dispatch */
  const [dispatchData, setDispatchData]       = useState([]);
  const [dispatchLoading, setDispatchLoading] = useState(false);

  /* History PDF reprint */
  const [historyData, setHistoryData]         = useState([]);
  const [selectedHistSession, setSelectedHistSession] = useState(null);
  const [histDetail, setHistDetail]           = useState(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    if (newLoc.id && newLoc.zone && newLoc.aisle)
      setNewLoc(prev => ({ ...prev, unique: `${prev.zone.toUpperCase()}-${prev.aisle}` }));
  }, [newLoc.id, newLoc.zone, newLoc.aisle]);

  /* ================= UTILS ================= */
  const formatWIB = (dateStr) => {
    if (!dateStr || dateStr === '-' || dateStr === 'null') return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
      const pad  = n => String(n).padStart(2, '0');
      return `${pad(wib.getUTCDate())}/${pad(wib.getUTCMonth()+1)}/${wib.getUTCFullYear()}, ${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())}`;
    } catch { return dateStr; }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };

  const getDesc = (item) => item?.description || item?.sku_desc || item?.nama_barang || '-';

  const handleExportExcel = (rows, filename) => {
    if (!rows || rows.length === 0) return showToast("Tidak ada data", "error");
    const exportData = rows.map(item => {
      const n = { ...item };
      ['scanned_at','timestamp','tanggal_packing','created_at','closed_at','handover_at'].forEach(k => { if (n[k]) n[k] = formatWIB(n[k]); });
      return n;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, filename || `export.xlsx`);
  };

  /* ================= FETCH ================= */
  const fetchData = async () => {
    if (!isLoggedIn || activeDispatch) return;
    setLoading(true); setSelectedHeader(null);
    try {
      if (activeMenu === 'Print Label') {
        const res = await axios.get(`${API_OUTBOUND}?target=packing_transactions`);
        setData(res.data?.data || []);
      } else {
        const targetMap = {
          'Master Lokasi'  : masterTab === 'database' ? 'master_all' : 'master',
          'Snapshoot'      : 'snapshot_list',
          '1st Count'      : 'first', '2nt Count': 'second', 'Reconciliation': 'recon',
          'Picking'        : 'picking_transactions',
          'Packing'        : 'packing_transactions',
          'Explorer'       : 'outbound_explorer'
        };
        const currentAPI = ['Picking','Packing','Explorer'].includes(activeMenu) ? API_OUTBOUND : API_BASE;
        const res = await axios.get(`${currentAPI}?action=get_data&target=${targetMap[activeMenu]}`);
        setData(res.data?.data || []);
      }
    } catch { setData([]); }
    finally { setLoading(false); setSelectedRows([]); }
  };

  useEffect(() => { fetchData(); }, [activeMenu, masterTab, isLoggedIn]);

  /* Fetch dispatch data */
  const fetchDispatch = async (sub) => {
    setDispatchLoading(true);
    try {
      if (sub === 'dispatch_log') {
        const res = await axios.get(`${API_DISPATCH}?action=get_data&target=dispatch_list`);
        setDispatchData(res.data?.data || []);
      } else if (sub === 'handover') {
        const res = await axios.get(`${API_DISPATCH}?action=get_data&target=handover_list`);
        setDispatchData(res.data?.data || []);
      } else if (sub === 'history') {
        // Ambil semua session yang sudah HANDOVER_DONE
        const res = await axios.get(`${API_DISPATCH}?action=get_data&target=session_list`);
        const all = res.data?.data || [];
        setHistoryData(all.filter(s => s.status === 'HANDOVER_DONE'));
        setSelectedHistSession(null);
        setHistDetail(null);
      }
    } catch { setDispatchData([]); }
    finally { setDispatchLoading(false); }
  };

  useEffect(() => {
    if (activeDispatch) fetchDispatch(activeDispatch);
  }, [activeDispatch]);

  const fetchBoxByPcb = async (pcb) => {
    if (!pcb) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_OUTBOUND}?action=get_print_data&pcb=${pcb}`);
      setBoxOptions(res.data?.data || []);
    } catch { showToast("Gagal tarik box", "error"); }
    finally { setLoading(false); }
  };

  /* ================= HANDLERS ================= */
  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}?action=login`, { username, password });
      if (res.data?.status === 'success') { setUser(res.data.user); setIsLoggedIn(true); }
      else showToast("User/Pass Salah", "error");
    } catch { showToast("Server Error", "error"); }
    finally { setLoginLoading(false); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setLoading(true);
      try {
        const workbook  = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
        const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        await axios.post(`${API_BASE}?action=upload_snap`, { data: excelData });
        showToast("Snapshot Terupload!"); fetchData();
      } catch { showToast("Gagal Upload", "error"); }
      finally { setLoading(false); e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleToggle = async (uid, currentStatus) => {
    const nextStatus = currentStatus === 'open' ? 'closed' : 'open';
    try {
      await axios.post(`${API_BASE}?action=assign_location`, { unique_id: uid, status: nextStatus });
      setData(prev => prev.map(item => item.unique_id === uid ? { ...item, assign: nextStatus } : item));
    } catch { showToast("Gagal Toggle", "error"); }
  };

  /* ================= HISTORY PDF ================= */
  const loadHistDetail = async (session) => {
    setSelectedHistSession(session);
    try {
      const res = await axios.get(`${API_DISPATCH}?action=get_data&target=session_log&session_code=${session.session_code}`);
      setHistDetail(res.data?.data || []);
    } catch { showToast("Gagal load detail", "error"); }
  };

  const printHandoverPdf = () => {
    if (!selectedHistSession || !histDetail) return;
    const s   = selectedHistSession;
    const now = formatWIB(new Date().toISOString());
    const rows = histDetail.map((item, i) =>
      `<tr style="background:${i%2===0?'#fff':'#fafafa'}">
        <td style="${tdPdf}">${i+1}</td>
        <td style="${tdPdf}">${item.tracking_reference || item.do_reference || '-'}</td>
        <td style="${tdPdf};color:${statusColor(item.handover_status)};font-weight:700">${item.handover_status || '-'}</td>
       </tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Handover List - ${s.session_code}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; margin: 30px; color: #000; }
      h2 { text-align:center; margin-bottom: 4px; }
      .info-grid { display:grid; grid-template-columns:1fr 1fr; gap: 4px 20px; margin: 12px 0; }
      .info-row { display:flex; gap:6px; }
      .info-label { font-weight:700; min-width:100px; }
      table { width:100%; border-collapse:collapse; margin-top:12px; }
      th { background:#eee; padding:7px 10px; text-align:left; font-size:10px; border:1px solid #ddd; }
      td { padding:6px 10px; border:1px solid #eee; }
      .sign-area { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:30px; }
      .sign-box { border:1px solid #ccc; height:80px; border-radius:4px; }
      .sign-label { font-weight:700; font-size:10px; margin-bottom:6px; }
      .sign-name { text-align:center; font-size:10px; color:#666; margin-top:6px; }
      @media print { body { margin: 15px; } }
    </style></head><body>
    <h2>Handover List</h2>
    <div class="info-grid">
      <div class="info-row"><span class="info-label">Session</span><span>: ${s.session_code}</span></div>
      <div class="info-row"><span class="info-label">Tgl Handover</span><span>: ${formatWIB(s.closed_at)?.split(',')[0] || '-'}</span></div>
      <div class="info-row"><span class="info-label">Security</span><span>: ${s.security_name || '-'}</span></div>
      <div class="info-row"><span class="info-label">Jam</span><span>: ${formatWIB(s.closed_at)?.split(',')[1]?.trim() || '-'}</span></div>
      <div class="info-row"><span class="info-label">Kurir</span><span>: ${s.courier_name || '-'}</span></div>
      <div class="info-row"><span class="info-label">No. Kendaraan</span><span>: ${s.vehicle_number || '-'}</span></div>
      <div class="info-row"><span class="info-label">Total Paket</span><span>: ${histDetail.length} paket</span></div>
    </div>
    <table>
      <thead><tr><th style="width:40px">No.</th><th>No. AWB</th><th style="width:100px">Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sign-area">
      <div>
        <div class="sign-label">Security</div>
        <div class="sign-box"></div>
        <div class="sign-name">( ${s.security_name || '_______________'} )</div>
      </div>
      <div>
        <div class="sign-label">Kurir</div>
        <div class="sign-box"></div>
        <div class="sign-name">( ${s.courier_name || '_______________'} )</div>
      </div>
    </div>
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  };

  const statusColor = (s) => {
    if (s === 'CONFIRMED')   return '#2E7D32';
    if (s === 'NOT_FOUND')   return '#E65100';
    if (s === 'CANCELLED')   return '#757575';
    if (s === 'DISCREPANCY') return '#B71C1C';
    return '#000';
  };
  const tdPdf = 'padding:6px 10px;border:1px solid #eee;font-size:11px';

  /* ================= LAYOUT DRILLDOWN ================= */
  const headerData = useMemo(() => {
    const drilldownMenus = ['Picking', 'Packing', 'Explorer'];
    if (!drilldownMenus.includes(activeMenu) || !data) return null;
    const groups = data.reduce((acc, curr) => {
      const key = curr.picklist_number; if (!key) return acc;
      if (!acc[key]) acc[key] = { id: key, name: curr.nama_customer || curr.nama_toko || '-', count: 0, allPacked: true };
      acc[key].count++;
      if (activeMenu === 'Explorer' && curr.status !== 'packed') acc[key].allPacked = false;
      return acc;
    }, {});
    const results = Object.values(groups);
    if (activeMenu === 'Explorer') return { active: results.filter(h => !h.allPacked), completed: results.filter(h => h.allPacked) };
    return results;
  }, [data, activeMenu]);

  const filteredData = (data || []).filter(item => {
    if (selectedHeader) return (item.picklist_number === selectedHeader);
    if (!searchTerm) return true;
    const s = searchTerm.toUpperCase();
    return String(item.location_id || item.picklist_number || item.id || '').includes(s) ||
      String(item.artikel || item.product_id || item.sku || '').includes(s);
  });

  const filteredDispatch = (dispatchData || []).filter(item => {
    if (!searchTerm) return true;
    const s = searchTerm.toUpperCase();
    return Object.values(item).some(v => String(v).toUpperCase().includes(s));
  });

  /* ================= LOGIN ================= */
  if (!isLoggedIn) {
    return (
      <div style={loginPage}>
        <div style={loginCard}>
          <div style={loginHeader}><h2>COOL DASHBOARD</h2><p>WMS MANAGEMENT</p></div>
          <div style={{ padding: '30px' }}>
            <input placeholder="Username" style={mInput} value={username} onChange={e => setUsername(e.target.value)} />
            <input type="password" placeholder="Password" style={mInput} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button onClick={handleLogin} style={btnBlack}>{loginLoading ? <Loader2 className="animate-spin" size={18} /> : "LOGIN"}</button>
          </div>
        </div>
      </div>
    );
  }

  /* ================= DISPATCH PANEL ================= */
  const renderDispatchPanel = () => {
    if (activeDispatch === 'history') {
      return (
        <div>
          {/* Header */}
          <div style={headerStyle}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              {selectedHistSession && (
                <button onClick={() => { setSelectedHistSession(null); setHistDetail(null); }} style={btnIcon}>
                  <ArrowLeft size={16} />
                </button>
              )}
              <div style={{ fontWeight:'800', fontSize:'1.1rem' }}>
                {selectedHistSession ? `HISTORY: ${selectedHistSession.session_code}` : 'HISTORY HANDOVER'}
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {selectedHistSession && histDetail && (
                <>
                  <button onClick={() => handleExportExcel(histDetail, `Handover_${selectedHistSession.session_code}.xlsx`)} style={{ ...btnWhite, color:'#16a34a' }}>
                    <FileSpreadsheet size={12} /> EXCEL
                  </button>
                  <button onClick={printHandoverPdf} style={{ ...btnWhite, color:'#800000' }}>
                    <FileText size={12} /> CETAK PDF
                  </button>
                </>
              )}
              <button onClick={() => fetchDispatch('history')} style={btnIcon}><RefreshCw size={14} /></button>
            </div>
          </div>

          {selectedHistSession ? (
            /* Detail log session */
            <div>
              {/* Info bar */}
              <div style={{ background:'#FFF8F8', border:'1px solid #eee', borderRadius:8, padding:'12px 16px', marginBottom:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                {[
                  ['Session', selectedHistSession.session_code],
                  ['Transporter', selectedHistSession.transporter_id],
                  ['Security', selectedHistSession.security_name || '-'],
                  ['Kurir', selectedHistSession.courier_name || '-'],
                  ['No. Kendaraan', selectedHistSession.vehicle_number || '-'],
                  ['Total Paket', `${histDetail?.length || 0} paket`],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:'flex', gap:8, fontSize:'0.75rem' }}>
                    <span style={{ fontWeight:800, minWidth:100 }}>{k}</span>
                    <span style={{ color:'#666' }}>: {v}</span>
                  </div>
                ))}
              </div>

              <div style={tableWrapper}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ background:'#fafafa' }}>
                      <th style={thStyle}>NO.</th>
                      <th style={thStyle}>NO. AWB</th>
                      <th style={thStyle}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(histDetail || []).map((row, i) => (
                      <tr key={i} style={{ borderBottom:'1px solid #eee' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={tdStyle}>{row.tracking_reference || row.do_reference || '-'}</td>
                        <td style={{ ...tdStyle, color: statusColor(row.handover_status), fontWeight:700 }}>
                          {row.handover_status || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* List session HANDOVER_DONE */
            <div>
              <div style={searchContainer}>
                <Search size={14} style={{ position:'absolute', left:12, top:14, color:'#999' }} />
                <input placeholder="Cari session..." style={searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px,1fr))', gap:16 }}>
                {historyData.filter(s => JSON.stringify(s).toUpperCase().includes(searchTerm.toUpperCase())).map((s, i) => (
                  <div key={i} onClick={() => loadHistDetail(s)}
                    style={{ border:'1px solid #eee', borderRadius:10, padding:16, cursor:'pointer', background:'#fff', transition:'0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='#800000'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='#eee'}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontWeight:900, fontSize:'0.9rem', color:'#800000' }}>{s.session_code}</div>
                        <div style={{ fontSize:'0.7rem', color:'#999', marginTop:2 }}>{s.transporter_id}</div>
                        <div style={{ fontSize:'0.7rem', color:'#666', marginTop:4 }}>
                          Security: {s.security_name || '-'} | Kurir: {s.courier_name || '-'}
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontWeight:900, fontSize:'1.2rem', color:'#212121' }}>{s.total_sorted}</div>
                        <div style={{ fontSize:'0.6rem', color:'#999' }}>PAKET</div>
                        <div style={{ marginTop:4, background:'#dcfce7', color:'#166534', fontSize:'0.6rem', fontWeight:800, padding:'2px 8px', borderRadius:4 }}>DONE</div>
                      </div>
                    </div>
                    <div style={{ fontSize:'0.65rem', color:'#ccc', marginTop:8, borderTop:'1px solid #f5f5f5', paddingTop:8 }}>
                      {formatWIB(s.closed_at) || '-'}
                    </div>
                  </div>
                ))}
                {historyData.length === 0 && (
                  <div style={{ gridColumn:'1/-1', textAlign:'center', color:'#ccc', padding:40 }}>
                    Belum ada history handover
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    /* dispatch_log & handover tabel */
    const isHandover = activeDispatch === 'handover';
    const title      = isHandover ? 'HANDOVER SESSION' : 'DISPATCH LOG';

    return (
      <div>
        <div style={headerStyle}>
          <div style={{ fontWeight:'800', fontSize:'1.1rem' }}>{title}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => handleExportExcel(filteredDispatch, `${title}.xlsx`)} style={{ ...btnWhite, color:'#16a34a' }}>
              <FileSpreadsheet size={12} /> EXPORT
            </button>
            <button onClick={() => fetchDispatch(activeDispatch)} style={btnIcon}>
              <RefreshCw size={14} className={dispatchLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div style={searchContainer}>
          <Search size={14} style={{ position:'absolute', left:12, top:14, color:'#999' }} />
          <input placeholder="Cari data..." style={searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        {dispatchLoading ? (
          <div style={{ textAlign:'center', padding:40, color:'#ccc' }}>Loading...</div>
        ) : (
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background:'#fafafa' }}>
                  {isHandover ? (
                    <>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>SESSION</th>
                      <th style={thStyle}>AWB / DO REF</th>
                      <th style={thStyle}>STATUS</th>
                      <th style={thStyle}>SECURITY</th>
                      <th style={thStyle}>KURIR</th>
                      <th style={thStyle}>NO. KENDARAAN</th>
                      <th style={thStyle}>HANDOVER AT</th>
                    </>
                  ) : (
                    <>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>SESSION</th>
                      <th style={thStyle}>TRANSPORTER</th>
                      <th style={thStyle}>AWB / DO REF</th>
                      <th style={thStyle}>OPERATOR</th>
                      <th style={thStyle}>HANDOVER</th>
                      <th style={thStyle}>SCANNED AT</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredDispatch.map((row, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #eee' }}>
                    {isHandover ? (
                      <>
                        <td style={tdStyle}>{row.id}</td>
                        <td style={{ ...tdStyle, fontWeight:800, color:'#800000' }}>{row.session_code}</td>
                        <td style={tdStyle}>{row.tracking_reference || row.do_reference || '-'}</td>
                        <td style={{ ...tdStyle, fontWeight:700, color: statusColor(row.status) }}>{row.status}</td>
                        <td style={tdStyle}>{row.security_name || '-'}</td>
                        <td style={tdStyle}>{row.courier_name || '-'}</td>
                        <td style={tdStyle}>{row.vehicle_number || '-'}</td>
                        <td style={tdStyle}>{formatWIB(row.handover_at)}</td>
                      </>
                    ) : (
                      <>
                        <td style={tdStyle}>{row.id}</td>
                        <td style={{ ...tdStyle, fontWeight:800, color:'#800000' }}>{row.session_code}</td>
                        <td style={tdStyle}>{row.transporter_id}</td>
                        <td style={tdStyle}>{row.tracking_reference || row.do_reference || '-'}</td>
                        <td style={tdStyle}>{row.operator}</td>
                        <td style={{ ...tdStyle, fontWeight:700, color: statusColor(row.handover_status) }}>
                          {row.handover_status || '-'}
                        </td>
                        <td style={tdStyle}>{formatWIB(row.scanned_at)}</td>
                      </>
                    )}
                  </tr>
                ))}
                {filteredDispatch.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign:'center', padding:30, color:'#ccc' }}>Tidak ada data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  /* ================= MAIN RENDER ================= */
  return (
    <div style={mainLayout}>
      <style>{`
        .header-card { background:#fff; border:1px solid #eee; padding:18px; border-radius:10px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:0.2s; }
        .header-card:hover { border-color:#000; box-shadow:0 4px 12px rgba(0,0,0,0.05); }
        .tab-btn { padding:10px 24px; font-size:0.75rem; font-weight:800; border:none; background:#f5f5f5; cursor:pointer; border-radius:8px; }
        .tab-btn.active { background:#000; color:#fff; }
        .sub-item { padding:9px 20px 9px 36px; cursor:pointer; font-size:0.7rem; display:flex; align-items:center; gap:8px; transition:0.15s; }
        .sub-item:hover { background:#f5f5f5; }
        .sub-item.active { color:#800000; font-weight:800; background:#FFF8F8; border-right:2px solid #800000; }
      `}</style>

      {toast.show && <div style={toastStyle(toast.type)}>{toast.msg}</div>}

      {/* SIDEBAR */}
      <nav style={sidebarStyle(isMobile)}>
        <div style={{ padding:'20px 20px 10px', position:'relative' }}>
          <div style={{ fontWeight:900, fontSize:'1rem' }}>COOL DASHBOARD</div>
          <div
            onClick={() => setUserMenuOpen(o => !o)}
            style={{ fontSize:'0.7rem', color:'#16a34a', fontWeight:800, marginTop:4, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
            👤 {user?.full_name}
            <ChevronDown size={10} />
          </div>
          {userMenuOpen && (
            <div style={{ position:'absolute', top:52, left:20, background:'#fff', border:'1px solid #eee', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.1)', zIndex:100, minWidth:140 }}>
              <div
                onClick={() => { setIsLoggedIn(false); setUserMenuOpen(false); }}
                style={{ padding:'10px 16px', fontSize:'0.7rem', color:'red', fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:8, borderRadius:8 }}
                onMouseEnter={e => e.currentTarget.style.background='#fff5f5'}
                onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                <LogOut size={12} /> Logout
              </div>
            </div>
          )}
        </div>

        <div style={menuSectionLabel}>INVENTORY</div>
        {['Master Lokasi','Snapshoot','1st Count','2nt Count','Reconciliation'].map(m => (
          <div key={m} onClick={() => { setActiveMenu(m); setMasterTab('grid'); setActiveDispatch(null); }} style={navItem(activeMenu === m && !activeDispatch)}>{m}</div>
        ))}

        <div style={menuSectionLabel}>OUTBOUND</div>
        {['Picking','Packing','Explorer','Print Label'].map(m => (
          <div key={m} onClick={() => { setActiveMenu(m); setActiveDispatch(null); }} style={navItem(activeMenu === m && !activeDispatch)}>
            <Printer size={14} style={{ marginRight:8 }} /> {m}
          </div>
        ))}

        <div style={menuSectionLabel}>DISPATCH</div>
        {/* Dispatch parent toggle */}
        <div onClick={() => setDispatchOpen(o => !o)} style={{ ...navItem(!!activeDispatch), justifyContent:'space-between', paddingRight:16 }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}><Truck size={14} /> DISPATCH</span>
          {dispatchOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        {dispatchOpen && (
          <>
            {[
              { key:'dispatch_log', label:'Dispatch Log', icon:<Package size={12}/> },
              { key:'handover',     label:'Handover',     icon:<ClipboardCheck size={12}/> },
              { key:'history',      label:'History',      icon:<FileText size={12}/> },
            ].map(({ key, label, icon }) => (
              <div key={key}
                className={`sub-item${activeDispatch === key ? ' active' : ''}`}
                onClick={() => { setActiveDispatch(key); setSearchTerm(''); }}>
                {icon} {label}
              </div>
            ))}
          </>
        )}


      </nav>

      {/* CONTENT */}
      <div style={contentArea(isMobile)}>

        {/* Jika menu dispatch aktif */}
        {activeDispatch ? renderDispatchPanel() : (
          <>
            <header style={headerStyle}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                {selectedHeader && <button onClick={() => setSelectedHeader(null)} style={btnIcon}><ArrowLeft size={16} /></button>}
                <div style={{ fontWeight:'800', fontSize:'1.1rem' }}>{selectedHeader ? `${activeMenu}: ${selectedHeader}` : activeMenu.toUpperCase()}</div>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                {activeMenu === 'Master Lokasi' && masterTab === 'database' && (
                  <button onClick={() => setShowAddForm(true)} style={{ ...btnWhite, background:'#000', color:'#fff' }}><Plus size={12} /> ADD NEW</button>
                )}
                {activeMenu === 'Snapshoot' && (
                  <label style={{ ...btnWhite, background:'#000', color:'#fff', cursor:'pointer' }}><Upload size={12} /> UPLOAD SNAP <input type="file" hidden onChange={handleFileUpload} /></label>
                )}
                {['1st Count','2nt Count','Snapshoot','Reconciliation'].includes(activeMenu) && (
                  <button onClick={() => { if (window.confirm("Hapus data menu ini?")) axios.post(`${API_BASE}?action=clear_${activeMenu.includes('1st') ? 'first' : activeMenu.includes('2nt') ? 'second' : activeMenu.includes('Snap') ? 'snap' : 'recon'}`).then(() => fetchData()); }} style={{ ...btnWhite, color:'red' }}><Trash2 size={12} /> CLEAR</button>
                )}
                <button onClick={() => handleExportExcel(data, `COOL_${activeMenu}.xlsx`)} style={{ ...btnWhite, color:'#16a34a' }}><FileSpreadsheet size={12} /> EXPORT</button>
                <button onClick={fetchData} style={btnIcon}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
              </div>
            </header>

            {activeMenu === 'Explorer' && !selectedHeader && (
              <div style={{ display:'flex', gap:10, marginBottom:20 }}>
                <button className={`tab-btn ${explorerTab === 'active' ? 'active' : ''}`} onClick={() => setExplorerTab('active')}>ACTIVE PICKLIST</button>
                <button className={`tab-btn ${explorerTab === 'completed' ? 'active' : ''}`} onClick={() => setExplorerTab('completed')}>COMPLETED (CLOSE)</button>
              </div>
            )}

            {activeMenu === 'Master Lokasi' && (
              <div style={{ display:'flex', gap:15, marginBottom:20, borderBottom:'1px solid #eee' }}>
                <div onClick={() => setMasterTab('grid')} style={tabItem(masterTab === 'grid')}><LayoutGrid size={14} /> ASSIGN CC</div>
                <div onClick={() => setMasterTab('database')} style={tabItem(masterTab === 'database')}><DbIcon size={14} /> DATABASE LOKASI</div>
              </div>
            )}

            {!selectedHeader && activeMenu !== 'Print Label' && (
              <div style={searchContainer}>
                <Search size={14} style={{ position:'absolute', left:12, top:14, color:'#999' }} />
                <input placeholder="Cari data..." style={searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            )}

            {activeMenu === 'Explorer' && !selectedHeader ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))', gap:20 }}>
                {headerData[explorerTab].filter(h => h.id.toUpperCase().includes(searchTerm.toUpperCase())).map((h, i) => (
                  <div key={i} className="header-card" onClick={() => setSelectedHeader(h.id)}>
                    <div><div style={{ fontWeight:900, fontSize:'0.9rem' }}>{h.id}</div><div style={{ fontSize:'0.7rem', color:'#999' }}>{h.name}</div></div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                      <div style={{ fontSize:'0.55rem', padding:'3px 10px', borderRadius:4, fontWeight:900, background: h.allPacked ? '#dcfce7' : '#fee2e2', color: h.allPacked ? '#166534' : '#991b1b' }}>{h.allPacked ? 'CLOSE' : 'OPEN'}</div>
                      <div style={{ background:'#f5f5f5', padding:'4px 10px', borderRadius:20, fontSize:'0.65rem', fontWeight:800 }}>{h.count} LINES</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : ['Picking','Packing'].includes(activeMenu) && !selectedHeader ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))', gap:20 }}>
                {headerData.filter(h => h.id.toUpperCase().includes(searchTerm.toUpperCase())).map((h, i) => (
                  <div key={i} className="header-card" onClick={() => setSelectedHeader(h.id)}>
                    <div><div style={{ fontWeight:900, fontSize:'0.9rem' }}>{h.id}</div><div style={{ fontSize:'0.7rem', color:'#999' }}>{h.name}</div></div>
                    <div style={{ background:'#f5f5f5', padding:'4px 12px', borderRadius:20, fontSize:'0.65rem', fontWeight:800 }}>{h.count} ITEMS</div>
                  </div>
                ))}
              </div>
            ) : activeMenu === 'Print Label' ? (
              <PrintLabelPanel data={data} selectedPcb={selectedPcb} setSelectedPcb={setSelectedPcb} selectedBoxHuid={selectedBoxHuid} setSelectedBoxHuid={setSelectedBoxHuid} boxOptions={boxOptions} fetchBoxByPcb={fetchBoxByPcb} loading={loading} />
            ) : activeMenu === 'Master Lokasi' && masterTab === 'grid' ? (
              <div style={gridContainer()}>
                {filteredData.map((row, idx) => (
                  <div key={idx} style={cardGrid}>
                    <span style={{ fontWeight:800, marginBottom:8 }}>{row?.unique_id}</span>
                    <div onClick={() => handleToggle(row.unique_id, row.assign)} style={toggleContainer(row.assign === 'open')}><div style={toggleCircle(row.assign === 'open')} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={tableWrapper}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ background:'#fafafa' }}>
                      {activeMenu === 'Master Lokasi' ? (<><th style={thStyle}>LOKASI</th><th style={thStyle}>ZONE</th><th style={thStyle}>AISLE</th><th style={thStyle}>UNIQUE</th><th style={thStyle}>STATUS</th></>)
                      : activeMenu === 'Reconciliation' ? (<><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>SNAP</th><th style={thStyle}>1ST</th><th style={thStyle}>2ND</th><th style={thStyle}>DIFF</th><th style={thStyle}>STATUS</th></>)
                      : activeMenu === 'Picking' ? (<><th style={thStyle}>ID</th><th style={thStyle}>PRODUCT</th><th style={thStyle}>LOC</th><th style={thStyle}>QTY</th><th style={thStyle}>PICKER</th><th style={thStyle}>TIME</th><th style={thStyle}>STATUS</th></>)
                      : activeMenu === 'Packing' ? (<><th style={thStyle}>ID</th><th style={thStyle}>BOX #</th><th style={thStyle}>PRODUCT</th><th style={thStyle}>QTY</th><th style={thStyle}>PACKER</th><th style={thStyle}>TIME</th><th style={thStyle}>HUID</th><th style={thStyle}>STATUS</th></>)
                      : activeMenu === 'Explorer' ? (<><th style={thStyle}>SKU</th><th style={thStyle}>DESC</th><th style={thStyle}>REQ</th><th style={thStyle}>PICK</th><th style={thStyle}>PACK</th><th style={thStyle}>STATUS</th></>)
                      : activeMenu === 'Snapshoot' ? (<><th style={thStyle}>LOKASI</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>QTY_SNAP</th><th style={thStyle}>DESCRIPTION</th></>)
                      : (<><th style={thStyle}>LOCATION_ID</th><th style={thStyle}>ARTIKEL</th><th style={thStyle}>DESCRIPTION</th><th style={thStyle}>QTY</th><th style={thStyle}>TIMESTAMP (WIB)</th><th style={thStyle}>OPERATOR</th></>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((row, i) => (
                      <tr key={i} style={{ borderBottom:'1px solid #eee' }}>
                        {activeMenu === 'Master Lokasi' ? (<><td style={tdStyle}>{row?.location_id}</td><td style={tdStyle}>{row?.zone}</td><td style={tdStyle}>{row?.aisle}</td><td style={tdStyle}>{row?.unique_id}</td><td style={{ ...tdStyle, color: row?.assign === 'open' ? 'green' : 'red', fontWeight:800 }}>{row?.assign?.toUpperCase()}</td></>)
                        : activeMenu === 'Reconciliation' ? (<><td style={tdStyle}>{row?.location_id}</td><td style={tdStyle}>{row?.artikel}</td><td style={tdStyle}>{row?.qty_snap}</td><td style={tdStyle}>{row?.qty_1st}</td><td style={tdStyle}>{row?.qty_2nd}</td><td style={{ ...tdStyle, color:'red', fontWeight:900 }}>{(Number(row?.qty_2nd || row?.qty_1st || 0) - Number(row?.qty_snap || 0))}</td><td style={tdStyle}>{row?.final_status}</td></>)
                        : activeMenu === 'Picking' ? (<><td style={tdStyle}>{row?.id}</td><td style={tdStyle}>{row?.product_id}</td><td style={tdStyle}>{row?.location_id}</td><td style={tdStyle}>{row?.qty_actual}</td><td style={tdStyle}>{row?.picker_name}</td><td style={tdStyle}>{formatWIB(row?.scanned_at)}</td><td style={tdStyle}>{row?.status}</td></>)
                        : activeMenu === 'Packing' ? (<><td style={tdStyle}>{row?.id}</td><td style={tdStyle}>{row?.box_number}</td><td style={tdStyle}>{row?.product_id}</td><td style={tdStyle}>{row?.qty_packed}</td><td style={tdStyle}>{row?.scanned_by}</td><td style={tdStyle}>{formatWIB(row?.scanned_at)}</td><td style={tdStyle}>{row?.huid}</td><td style={tdStyle}>{row?.status}</td></>)
                        : activeMenu === 'Explorer' ? (<><td style={tdStyle}>{row?.sku}</td><td style={tdDescSmall}>{getDesc(row)}</td><td style={tdStyle}>{row?.qty_req}</td><td style={tdStyle}>{row?.qty_picked}</td><td style={tdStyle}>{row?.qty_packed}</td><td style={tdStyle}>{row?.status}</td></>)
                        : activeMenu === 'Snapshoot' ? (<><td style={tdStyle}>{row?.location_id}</td><td style={tdStyle}>{row?.artikel}</td><td style={tdStyle}>{row?.qty_snap}</td><td style={tdDescSmall}>{getDesc(row)}</td></>)
                        : (<><td style={tdStyle}>{row?.location_id}</td><td style={tdStyle}>{row?.artikel}</td><td style={tdDescSmall}>{getDesc(row)}</td><td style={tdStyle}>{row?.qty_1st || row?.qty_2nd || row?.qty}</td><td style={tdStyle}>{formatWIB(row?.scanned_at || row?.timestamp)}</td><td style={tdStyle}>{row?.operator}</td></>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {showAddForm && (
        <div style={popupOverlay}>
          <div style={{ ...popupContent, textAlign:'left', padding:30 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:15 }}>
              <h3 style={{ fontWeight:900 }}>ADD NEW</h3>
              <button onClick={() => setShowAddForm(false)} style={{ border:'none', background:'none' }}><X size={20} /></button>
            </div>
            <label style={labelStyle}>LOKASI ID</label>
            <input style={mInput} value={newLoc.id} onChange={e => setNewLoc({ ...newLoc, id: e.target.value })} />
            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1 }}><label style={labelStyle}>ZONE</label><input style={mInput} value={newLoc.zone} onChange={e => setNewLoc({ ...newLoc, zone: e.target.value.toUpperCase() })} /></div>
              <div style={{ flex:1 }}><label style={labelStyle}>AISLE</label><input style={mInput} type="number" value={newLoc.aisle} onChange={e => setNewLoc({ ...newLoc, aisle: e.target.value })} /></div>
            </div>
            <button onClick={async () => {
              try {
                await axios.post(`${API_BASE}?action=add_location`, { ...newLoc, location_id: newLoc.id.toUpperCase() });
                showToast("Added!"); setShowAddForm(false); fetchData();
              } catch { showToast("Error!", "error"); }
            }} style={{ ...btnBlack, marginTop:10 }}>SAVE LOCATION</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

/* ================= STYLES ================= */
const menuSectionLabel = { padding:'15px 20px 5px', fontSize:'0.6rem', fontWeight:900, color:'#999', letterSpacing:'1px' };
const tabItem = (a) => ({ padding:'10px 15px', cursor:'pointer', fontSize:'0.7rem', fontWeight:800, color: a ? '#000' : '#ccc', borderBottom: a ? '2px solid #000' : 'none', display:'flex', alignItems:'center', gap:5 });
const sidebarStyle = (m) => ({ width: m ? '0px' : '220px', display: m ? 'none' : 'block', borderRight:'1px solid #eee', height:'100vh', position:'fixed', backgroundColor:'#fff', zIndex:10, overflowY:'auto' });
const contentArea  = (m) => ({ flex:1, marginLeft: m ? 0 : 220, padding: m ? '15px' : '35px' });
const headerStyle  = { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'25px', borderBottom:'1px solid #eee', paddingBottom:'15px' };
const navItem = (a) => ({ padding:'12px 20px', cursor:'pointer', color: a ? '#000' : '#ccc', fontWeight: a ? '800' : '400', display:'flex', alignItems:'center', fontSize:'0.75rem' });
const tableWrapper = { border:'1px solid #eee', borderRadius:'8px', overflowY:'auto', maxHeight:'calc(100vh - 240px)' };
const tableStyle   = { width:'100%', borderCollapse:'collapse', textAlign:'left' };
const thStyle      = { padding:'12px 15px', fontSize:'0.65rem', color:'#999', borderBottom:'1px solid #eee', textTransform:'uppercase', whiteSpace:'nowrap' };
const tdStyle      = { padding:'12px 15px', fontSize:'0.7rem', whiteSpace:'nowrap' };
const tdDescSmall  = { padding:'12px 15px', fontSize:'0.65rem', color:'#999' };
const mInput       = { width:'100%', padding:'12px', border:'1px solid #eee', marginBottom:'10px', borderRadius:'8px', fontFamily:'Lexend', fontSize:'0.8rem', boxSizing:'border-box' };
const btnBlack     = { width:'100%', background:'#000', color:'#fff', padding:'14px', border:'none', borderRadius:'8px', fontWeight:'800', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' };
const btnWhite     = { background:'#fff', border:'1px solid #eee', padding:'8px 16px', borderRadius:'6px', fontSize:'0.7rem', display:'flex', alignItems:'center', gap:6, cursor:'pointer' };
const btnIcon      = { background:'#fff', border:'1px solid #eee', padding:'8px', borderRadius:'6px', cursor:'pointer' };

const loginPage    = { height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', background:'#f5f5f5' };
const loginCard    = { width:'340px', background:'#fff', border:'1px solid #eee', borderRadius:'12px', textAlign:'center', overflow:'hidden', boxShadow:'0 10px 30px rgba(0,0,0,0.05)' };
const loginHeader  = { background:'#000', color:'#fff', padding:'25px' };
const popupOverlay = { position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000 };
const popupContent = { background:'#fff', padding:40, borderRadius:24, textAlign:'center', width:'85%', maxWidth:'450px', boxShadow:'0 20px 40px rgba(0,0,0,0.2)' };
const toastStyle   = (t) => ({ position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)', backgroundColor: t === 'success' ? '#16a34a' : '#ef4444', color:'#fff', padding:'12px 25px', borderRadius:'50px', fontWeight:'800', zIndex:9999, fontSize:'0.75rem' });
const labelStyle   = { fontSize:'0.65rem', fontWeight:'800', color:'#999', marginBottom:'6px', display:'block' };
const gridContainer = () => ({ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))', gap:'15px' });
const cardGrid     = { border:'1px solid #eee', padding:'15px', display:'flex', flexDirection:'column', alignItems:'center', borderRadius:'8px', background:'#fff' };
const toggleContainer = (on) => ({ width:'38px', height:'20px', background: on ? '#16a34a' : '#eee', borderRadius:'12px', position:'relative', cursor:'pointer' });
const toggleCircle    = (on) => ({ width:'14px', height:'14px', background:'#fff', borderRadius:'50%', position:'absolute', top:'3px', left: on ? '21px' : '3px', transition:'0.2s' });
const searchContainer = { position:'relative', marginBottom:'20px' };
const searchInput  = { width:'100%', padding:'12px 12px 12px 40px', border:'1px solid #eee', borderRadius:'10px', fontFamily:'Lexend', fontSize:'0.8rem', boxSizing:'border-box' };
const mainLayout   = { display:'flex', fontFamily:'Lexend, sans-serif', backgroundColor:'#fff', minHeight:'100vh', fontSize:'0.75rem' };