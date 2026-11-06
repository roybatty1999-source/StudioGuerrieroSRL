'use client';

import { useState } from 'react';
import ExcelJS from 'exceljs';

export default function Home() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [statusText, setStatusText] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const processInvoices = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setProgress({ current: 0, total: files.length });
    
    const allExtractedRows = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatusText(`Elaborazione fattura ${i + 1} di ${files.length}: ${file.name}`);

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/process-invoice', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          console.error(`Errore nel file ${file.name}:`, errData.error);
          continue; // Salta la fattura problematica e prosegue con le altre
        }

        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          allExtractedRows.push(...data.items);
        }

        setProgress({ current: i + 1, total: files.length });
      }

      setStatusText('Generazione file Excel in corso...');

      // Carica il modello Excel dalla cartella public
      const responseTemplate = await fetch('/intrastat_base_v3.xlsx');
      const arrayBuffer = await responseTemplate.arrayBuffer();
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.getWorksheet('Beni');

      // Popola le righe nel foglio "Beni" (colonne a-z)
      allExtractedRows.forEach((item) => {
        worksheet.addRow([
          item.tipo_operazione ?? 1,
          item.periodo ?? 1,
          item.mese ?? '',
          item.anno ?? '',
          '',
          item.stato_fornitore ?? '',
          item.piva_fornitore ?? '',
          item.ammontare_euro ?? 0,
          item.ammontare_valuta ?? 0,
          item.natura_transazione ?? '11',
          item.nomenclatura ?? '',
          item.massa_netta ?? 0,
          0,
          item.val_statistico ?? 0,
          item.cond_consegna ?? '',
          item.modo_trasporto ?? '',
          '',
          '',
          item.paese_provenienza ?? '',
          item.paese_origine ?? '',
          '',
          item.data_fattura ?? '',
          item.numero_fattura ?? '',
          '',
          '',
          ''
        ]);
      });

      // Esporta e scarica il file Excel finale
      const bufferOut = await workbook.xlsx.writeBuffer();
      const blob = new Blob([bufferOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'intrastat_compilato.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);

      setStatusText('Completato con successo! File scaricato.');

    } catch (err) {
      alert(`Errore critico: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: '700px', margin: '40px auto', fontFamily: 'sans-serif', padding: '20px' }}>
      <h1>Estrazione Intrastat Fatture (PDF ➔ Excel)</h1>
      <p>Seleziona uno o più file PDF di fatture. L'applicazione elaborerà i documenti in sequenza e genererà il file Excel pronto per l'invio doganale.</p>

      <div style={{ margin: '20px 0', padding: '20px', border: '2px dashed #ccc', borderRadius: '8px' }}>
        <input type="file" multiple accept="application/pdf" onChange={handleFileChange} disabled={loading} />
        <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          {files.length > 0 ? `${files.length} file selezionati` : 'Nessun file selezionato'}
        </p>
      </div>

      <button
        onClick={processInvoices}
        disabled={loading || files.length === 0}
        style={{
          padding: '12px 24px',
          backgroundColor: loading ? '#ccc' : '#0070f3',
          color: '#fff',
          border: 'none',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          fontWeight: 'bold'
        }}
      >
        {loading ? 'Elaborazione in corso...' : 'Elabora Fatture e Genera Excel'}
      </button>

      {loading && (
        <div style={{ marginTop: '20px' }}>
          <p><strong>{statusText}</strong></p>
          <progress value={progress.current} max={progress.total} style={{ width: '100%', height: '20px' }} />
          <p style={{ fontSize: '14px' }}>Progresso: {progress.current} / {progress.total}</p>
        </div>
      )}
    </main>
  );
}
