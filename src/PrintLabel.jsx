import React from 'react';
import ReactDOM from 'react-dom';
import Barcode from 'react-barcode';
import QRCode from 'react-qr-code';

/* ================= PRINT CSS ================= */
const PRINT_CSS = `
@media print {
  @page {
    size: 10cm 10cm;
    margin: 0;
  }
  body > *:not(#print-root) {
    display: none !important;
  }
  #print-root {
    display: block !important;
  }
  .print-label-page {
    width: 10cm;
    height: 10cm;
    padding: 0.2cm;
    box-sizing: border-box;
    page-break-after: always;
    page-break-inside: avoid;
    overflow: hidden;
    font-family: 'Courier New', monospace;
    background: #fff;
    color: #000;
    display: flex;
    flex-direction: column;
  }
  .print-label-page:last-child {
    page-break-after: auto;
  }
  /* Pastikan warna background ikut terprint */
  .print-banner {
    background: #cc0000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color: #fff !important;
  }
  .print-table-head tr {
    background: #000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color: #fff !important;
  }
  .print-box-header {
    background: #f0f0f0 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .print-row-even { background: #fff !important; }
  .print-row-odd  { background: #f9f9f9 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
@media screen {
  #print-root { display: none; }
}
`;

function injectPrintCSS() {
  if (document.getElementById('print-label-css')) return;
  const style = document.createElement('style');
  style.id = 'print-label-css';
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);
}

/* ================= LABEL CONTENT (shared preview & print) ================= */
function LabelContent({ box, pageIndex, totalPages, isPreview }) {
  if (!box) return null;
  const items = box.item_details || [];
  const pItems = items.slice(pageIndex * 12, (pageIndex + 1) * 12);
  const p = isPreview;

  return (
    <div style={{
      width: '100%', height: '100%',
      padding: p ? '6px' : '0.2cm',
      boxSizing: 'border-box', overflow: 'hidden',
      fontFamily: "'Courier New', monospace",
      color: '#000', background: '#fff',
      display: 'flex', flexDirection: 'column',
      gap: p ? '2px' : '1pt',
    }}>

      {/* BANNER MERAH */}
      <div className="print-banner" style={{
        background: '#cc0000', color: '#fff',
        textAlign: 'center',
        padding: p ? '2px 3px' : '2pt 3pt',
        fontSize: p ? '7px' : '6pt',
        fontWeight: 900, lineHeight: 1.2, flexShrink: 0,
      }}>
        ⚠ WAJIB VIDEO UNBOXING — KOMPLAIN TANPA VIDEO TIDAK DILAYANI
      </div>

      {/* HEADER: PT + QR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: p ? '10px' : '9pt' }}>PT DUA PULUH TIGA</div>
          <div style={{ fontSize: p ? '6px' : '5.5pt', color: '#444' }}>Jl. Kopo Bihbul Raya No 68, Bandung</div>
          <div style={{ fontSize: p ? '6px' : '5pt', marginTop: '1px' }}>HUID: <b>{box.huid}</b></div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <QRCode value={box.huid || '-'} size={p ? 40 : 52} level="H" />
        </div>
      </div>

      <div style={{ borderTop: '1px solid #000', flexShrink: 0 }} />

      {/* PICKLIST + TOKO */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontWeight: 900, fontSize: p ? '8px' : '7.5pt' }}>{box.picklist_number}</div>
        <div style={{ fontWeight: 900, fontSize: p ? '8px' : '7.5pt' }}>{box.nama_toko || '-'}</div>
        <div style={{ fontSize: p ? '6px' : '5.5pt', color: '#555' }}>{box.alamat_toko || '-'}</div>
      </div>

      <div style={{ borderTop: '1px dashed #000', flexShrink: 0 }} />

      {/* BOX CONTENT HEADER */}
      <div className="print-box-header" style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: p ? '6px' : '5.5pt', fontWeight: 900,
        background: '#f0f0f0',
        padding: p ? '1px 2px' : '1pt 2pt', flexShrink: 0,
      }}>
        <span>BOX CONTENT</span>
        <span>BOX: {box.container_number || '1'} ({pageIndex + 1}/{totalPages})</span>
      </div>

      {/* TABLE */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: p ? '6px' : '5.5pt', flex: 1, overflow: 'hidden' }}>
        <thead className="print-table-head">
          <tr style={{ background: '#000', color: '#fff' }}>
            <th style={{ padding: p ? '1px 2px' : '1pt 2pt', textAlign: 'left', width: '28%' }}>Artikel</th>
            <th style={{ padding: p ? '1px 2px' : '1pt 2pt', textAlign: 'left' }}>Description</th>
            <th style={{ padding: p ? '1px 2px' : '1pt 2pt', textAlign: 'center', width: '12%' }}>Qty</th>
          </tr>
        </thead>
        <tbody>
          {pItems.map((it, k) => (
            <tr key={k} className={k % 2 === 0 ? 'print-row-even' : 'print-row-odd'}
              style={{ borderBottom: '0.5px solid #ccc', background: k % 2 === 0 ? '#fff' : '#f9f9f9' }}>
              <td style={{ padding: p ? '0.5px 2px' : '0.5pt 2pt', fontWeight: 700 }}>{it?.sku}</td>
              <td style={{ padding: p ? '0.5px 2px' : '0.5pt 2pt', color: '#333', overflow: 'hidden', maxWidth: 0, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it?.nama_item || it?.name || '-'}</td>
              <td style={{ padding: p ? '0.5px 2px' : '0.5pt 2pt', textAlign: 'center', fontWeight: 900 }}>{it?.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: '1px solid #000', flexShrink: 0 }} />

      {/* FOOTER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', fontSize: p ? '5.5px' : '5pt', flexShrink: 0 }}>
        <div>Packer: <b>{box.packer_name || '-'}</b></div>
        <div style={{ textAlign: 'right' }}>Total: <b>{box.total_pcs_box || 0} PCS</b></div>
        <div>Tgl: <b>{box.tanggal_packing?.substring(0, 10)}</b></div>
        <div style={{ textAlign: 'right' }}>Berat: <b>{box.weight_kg || '0'} KG</b></div>
      </div>

      {/* BARCODE */}
      <div style={{ textAlign: 'center', flexShrink: 0, marginTop: 'auto' }}>
        <div style={{ fontSize: p ? '5.5px' : '5pt', fontWeight: 700 }}>NO SJ: {box.no_sj || box.picklist_number}</div>
        <Barcode
          value={box.no_sj || box.picklist_number || 'NOSJ'}
          width={p ? 0.9 : 1.5}
          height={p ? 22 : 32}
          fontSize={0}
          margin={0}
        />
      </div>
    </div>
  );
}

/* ================= PRINT PORTAL ================= */
function PrintPortal({ box, totalPages, onAfterPrint }) {
  const el = React.useRef(document.getElementById('print-root') || (() => {
    const d = document.createElement('div');
    d.id = 'print-root';
    document.body.appendChild(d);
    return d;
  })());

  React.useEffect(() => {
    // Setelah portal dirender, tunggu QR/Barcode selesai lalu print
    const timer = setTimeout(() => {
      window.print();
      setTimeout(() => { onAfterPrint(); }, 800);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  return ReactDOM.createPortal(
    <>
      {Array.from({ length: totalPages }, (_, i) => (
        <div key={i} className="print-label-page">
          <LabelContent box={box} pageIndex={i} totalPages={totalPages} isPreview={false} />
        </div>
      ))}
    </>,
    el.current
  );
}

/* ================= PRINT LABEL PANEL ================= */
export function PrintLabelPanel({ data, selectedPcb, setSelectedPcb, selectedBoxHuid, setSelectedBoxHuid, boxOptions, fetchBoxByPcb, loading }) {
  const [previewPage, setPreviewPage] = React.useState(0);
  const [isPrinting, setIsPrinting] = React.useState(false);

  React.useEffect(() => { injectPrintCSS(); }, []);

  const currentPrintData = React.useMemo(() => {
    return boxOptions.find(b => b.huid === selectedBoxHuid) || null;
  }, [selectedBoxHuid, boxOptions]);

  const totalPages = React.useMemo(() => {
    if (!currentPrintData?.item_details) return 1;
    return Math.max(1, Math.ceil(currentPrintData.item_details.length / 12));
  }, [currentPrintData]);

  React.useEffect(() => { setPreviewPage(0); }, [selectedBoxHuid]);

  const handlePrint = () => {
    if (!currentPrintData) return;
    setIsPrinting(true);
  };

  return (
    <>
      {/* Portal print — hanya aktif saat isPrinting */}
      {isPrinting && currentPrintData && (
        <PrintPortal
          box={currentPrintData}
          totalPages={totalPages}
          onAfterPrint={() => setIsPrinting(false)}
        />
      )}

      <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 180px)', fontFamily: 'Lexend, sans-serif' }}>

        {/* ---- LEFT PANEL ---- */}
        <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

          <div style={formCard}>
            <div style={stepLabel}>STEP 1 — PILIH PCB</div>
            <select style={selectStyle} value={selectedPcb} onChange={e => {
              setSelectedPcb(e.target.value);
              fetchBoxByPcb(e.target.value);
              setSelectedBoxHuid('');
            }}>
              <option value="">-- Pilih Picklist --</option>
              {[...new Set(data.map(b => b.picklist_number))].map((p, i) => (
                <option key={i} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div style={formCard}>
            <div style={stepLabel}>STEP 2 — PILIH BOX</div>
            <select style={selectStyle} value={selectedBoxHuid} disabled={!boxOptions.length}
              onChange={e => setSelectedBoxHuid(e.target.value)}>
              <option value="">-- Pilih Box --</option>
              {boxOptions.map((b, i) => (
                <option key={i} value={b.huid}>BOX {b.container_number} — {b.huid}</option>
              ))}
            </select>
          </div>

          {currentPrintData && (
            <div style={infoCard}>
              {[
                ['HUID', currentPrintData.huid],
                ['TOKO', currentPrintData.nama_toko || '-'],
                ['BOX #', currentPrintData.container_number],
                ['TOTAL PCS', currentPrintData.total_pcs_box || 0],
                ['BERAT', `${currentPrintData.weight_kg || '0'} KG`],
                ['PACKER', currentPrintData.packer_name || '-'],
                ['HALAMAN', `${totalPages} hal`],
              ].map(([k, v]) => (
                <div key={k} style={infoRow}>
                  <span style={infoLabel}>{k}</span>
                  <span style={infoValue}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {currentPrintData && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setPreviewPage(p => Math.max(0, p - 1))} disabled={previewPage === 0} style={navBtn}>‹</button>
              <span style={{ fontSize: '0.7rem', flex: 1, textAlign: 'center', fontFamily: 'Lexend' }}>
                {previewPage + 1} / {totalPages}
              </span>
              <button onClick={() => setPreviewPage(p => Math.min(totalPages - 1, p + 1))} disabled={previewPage === totalPages - 1} style={navBtn}>›</button>
            </div>
          )}

          {currentPrintData && (
            <button onClick={handlePrint} disabled={isPrinting} style={{ ...printBtn, opacity: isPrinting ? 0.6 : 1 }}>
              {isPrinting ? '⏳ Menyiapkan...' : `🖨 PRINT LABEL (${totalPages} halaman)`}
            </button>
          )}
        </div>

        {/* ---- RIGHT PREVIEW ---- */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: currentPrintData ? 'flex-start' : 'center',
          background: '#f5f5f5', borderRadius: '12px', padding: '24px', overflow: 'auto',
        }}>
          {!currentPrintData ? (
            <div style={{ textAlign: 'center', color: '#ccc' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🖨</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Lexend' }}>Pilih PCB dan Box</div>
              <div style={{ fontSize: '0.65rem', color: '#ddd', marginTop: '4px', fontFamily: 'Lexend' }}>Preview label akan muncul di sini</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '344px', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.6rem', color: '#999', fontFamily: 'Lexend' }}>10 cm × 10 cm</span>
                <span style={{ fontSize: '0.6rem', color: '#999', fontFamily: 'Lexend' }}>Offset: 0.2 cm</span>
                <span style={{ fontSize: '0.6rem', color: '#999', fontFamily: 'Lexend' }}>Hal. {previewPage + 1}/{totalPages}</span>
              </div>

              <div style={{
                width: '344px', height: '344px', background: '#fff',
                border: '2px solid #333', boxShadow: '4px 4px 0 #333',
                overflow: 'hidden', position: 'relative', flexShrink: 0,
              }}>
                <div style={{ position: 'absolute', inset: '7px', border: '0.5px dashed #ddd', zIndex: 0, pointerEvents: 'none' }} />
                <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
                  <LabelContent box={currentPrintData} pageIndex={previewPage} totalPages={totalPages} isPreview={true} />
                </div>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <div key={i} onClick={() => setPreviewPage(i)} style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: i === previewPage ? '#000' : '#ddd', cursor: 'pointer',
                    }} />
                  ))}
                </div>
              )}

              <div style={{ marginTop: '10px', fontSize: '0.6rem', color: '#aaa', textAlign: 'center', fontFamily: 'Lexend' }}>
                Preview • Ukuran cetak: 10×10 cm • Offset: 0.2 cm semua sisi
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ================= STYLES ================= */
const formCard = { background: '#fff', border: '1px solid #eee', borderRadius: '10px', padding: '14px' };
const stepLabel = { fontSize: '0.6rem', fontWeight: 900, color: '#999', letterSpacing: '1px', marginBottom: '8px', fontFamily: 'Lexend' };
const selectStyle = { width: '100%', padding: '10px', border: '1px solid #eee', borderRadius: '8px', fontFamily: 'Lexend, sans-serif', fontSize: '0.75rem', background: '#fff', cursor: 'pointer', outline: 'none' };
const infoCard = { background: '#fff', border: '1px solid #eee', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' };
const infoRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem' };
const infoLabel = { color: '#999', fontWeight: 700, fontFamily: 'Lexend' };
const infoValue = { fontWeight: 800, color: '#000', maxWidth: '150px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Lexend' };
const printBtn = { width: '100%', background: '#000', color: '#fff', border: 'none', borderRadius: '10px', padding: '14px', fontFamily: 'Lexend, sans-serif', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', letterSpacing: '0.5px' };
const navBtn = { background: '#fff', border: '1px solid #eee', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '1rem', fontWeight: 900 };