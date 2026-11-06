'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function IntrastatExtractor() {
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);

  // Inizializzazione sicura all'interno del client component
  const getSupabaseClient = () => {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  };

const handleFileUpload = async (event) => {
  const selectedFile = event.target.files[0];
  if (!selectedFile) return;

  setLoading(true);
  try {
    const supabaseClient = getSupabaseClient();
    
    // Pulisce spazi e caratteri speciali dal nome del file
    const safeName = selectedFile.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
    const finalName = `${Date.now()}_${safeName}`;

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('fatture-pdf')
      .upload(finalName, selectedFile);

    if (uploadError) throw uploadError;

    const res = await fetch('/api/process-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: uploadData.path })
    });

    const parsedData = await res.json();
    if (!res.ok) throw new Error(parsedData.error || 'Errore di elaborazione');

    setInvoiceData({ ...parsedData, filePath: uploadData.path });

  } catch (err) {
    alert(`Errore nell'elaborazione: ${err.message}`);
  } finally {
    setLoading(false);
  }
};

  const handleArticleChange = (index, field, value) => {
    const updatedArticoli = [...invoiceData.articoli];
    updatedArticoli[index][field] = value;
    setInvoiceData({ ...invoiceData, articoli: updatedArticoli });
  };

  const handleSaveToDatabase = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: fattura, error: fError } = await supabase
        .from('fatture_intrastat')
        .insert({
          file_path: invoiceData.filePath,
          p_iva_fornitore: invoiceData.pIvaFornitore,
          p_iva_cliente: invoiceData.pIvaCliente,
          destinazione: invoiceData.destinazione,
          totale_fattura: invoiceData.totaleFattura,
          stato: 'confermato'
        })
        .select()
        .single();

      if (fError) throw fError;

      const righeArticoli = invoiceData.articoli.map((art) => ({
        fattura_id: fattura.id,
        descrizione: art.descrizione,
        voce_doganale: art.voceDoganale,
        quantita: art.numeroPezzi,
        peso_netto: art.pesoNettoKg,
        is_peso_stimato: art.isPesoStimato,
        origine: art.origine
      }));

      const { error: aError } = await supabase
        .from('articoli_fattura')
        .insert(righeArticoli);

      if (aError) throw aError;

      alert('Fattura salvata con successo nel database!');
      setInvoiceData(null);
    } catch (err) {
      alert(`Errore durante il salvataggio: ${err.message}`);
    }
  };

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <h2>Estrazione Fatture Intrastat</h2>
      <p>Carica il file PDF della fattura per estrarre automaticamente i dati doganali e calcolare i pesi.</p>

      <div style={{ margin: '20px 0', padding: '20px', border: '2px dashed #ccc', borderRadius: '8px' }}>
        <input type="file" accept="application/pdf" onChange={handleFileUpload} disabled={loading} />
        {loading && <p style={{ color: '#0070f3', marginTop: '10px' }}>Analisi del documento in corso con IA...</p>}
      </div>

      {invoiceData && (
        <div style={{ marginTop: '30px' }}>
          <h3>Intestazione Fattura</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px' }}>
              P.IVA Fornitore:
              <input 
                type="text" 
                value={invoiceData.pIvaFornitore || ''} 
                onChange={(e) => setInvoiceData({...invoiceData, pIvaFornitore: e.target.value})} 
                style={{ padding: '8px', marginTop: '5px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px' }}>
              P.IVA Cliente:
              <input 
                type="text" 
                value={invoiceData.pIvaCliente || ''} 
                onChange={(e) => setInvoiceData({...invoiceData, pIvaCliente: e.target.value})} 
                style={{ padding: '8px', marginTop: '5px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px' }}>
              Destinazione:
              <input 
                type="text" 
                value={invoiceData.destinazione || ''} 
                onChange={(e) => setInvoiceData({...invoiceData, destinazione: e.target.value})} 
                style={{ padding: '8px', marginTop: '5px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px' }}>
              Totale (€):
              <input 
                type="number" 
                value={invoiceData.totaleFattura || 0} 
                onChange={(e) => setInvoiceData({...invoiceData, totaleFattura: parseFloat(e.target.value)})} 
                style={{ padding: '8px', marginTop: '5px' }}
              />
            </label>
          </div>

          <h3>Dettaglio Articoli Estratti</h3>
          <table border="1" cellPadding="10" style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '20px' }}>
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                <th>Descrizione</th>
                <th>Voce Doganale</th>
                <th>Quantità</th>
                <th>Peso Netto (kg)</th>
                <th>Origine</th>
              </tr>
            </thead>
            <tbody>
              {invoiceData.articoli.map((art, idx) => (
                <tr key={idx}>
                  <td>
                    <input 
                      type="text" 
                      value={art.descrizione || ''} 
                      onChange={(e) => handleArticleChange(idx, 'descrizione', e.target.value)} 
                      style={{ width: '100%', padding: '6px' }}
                    />
                  </td>
                  <td>
                    <input 
                      type="text" 
                      value={art.voceDoganale || ''} 
                      onChange={(e) => handleArticleChange(idx, 'voceDoganale', e.target.value)} 
                      style={{ width: '100%', padding: '6px' }}
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      value={art.numeroPezzi || 0} 
                      onChange={(e) => handleArticleChange(idx, 'numeroPezzi', parseFloat(e.target.value))} 
                      style={{ width: '100%', padding: '6px' }}
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      step="0.001"
                      value={art.pesoNettoKg || 0} 
                      onChange={(e) => handleArticleChange(idx, 'pesoNettoKg', parseFloat(e.target.value))} 
                      style={{ width: '80%', padding: '6px' }}
                    />
                    {art.isPesoStimato && <div style={{ color: '#d97706', fontSize: '11px', marginTop: '2px' }}>Stimato da DB</div>}
                  </td>
                  <td>
                    <input 
                      type="text" 
                      value={art.origine || ''} 
                      onChange={(e) => handleArticleChange(idx, 'origine', e.target.value)} 
                      style={{ width: '100%', padding: '6px' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button 
            onClick={handleSaveToDatabase} 
            style={{ background: '#0070f3', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}
          >
            Conferma e Salva nel Database
          </button>
        </div>
      )}
    </main>
  );
}
