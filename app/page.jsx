'use client';

import { useState } from 'react';

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
          continue; // Salta il file in errore e prosegue con gli altri
        }

        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          allExtractedRows.push(...data.items);
        }

        setProgress({ current: i + 1, total: files.length });
      }

      if (allExtractedRows.length === 0) {
        alert("Nessun dato estratto dalle fatture selezionate.");
        setLoading(false);
        return;
      }

      setStatusText('Generazione file Excel in corso...');

      const excelRes = await fetch('/api/generate-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: allExtractedRows }),
      });

      if (!excelRes.ok) throw new Error("Errore nella generazione del file Excel");

      const blob = await excelRes.blob();
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
      <p>Seleziona uno o più file PDF di fatture. L'applicazione elaborerà i documenti in sequenza e genererà il file Excel pronto per l'invio.</p>

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
