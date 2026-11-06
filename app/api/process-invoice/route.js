import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60; // Timeout esteso a 60 secondi per l'IA

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'Nessun file PDF fornito' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Pdf = buffer.toString('base64');

    let response;
    let retries = 3;
    let delay = 2000;

    const promptText = `
      Analizza questa fattura Intrastat ed estrai un array JSON con gli articoli.
      Per ogni articolo/riga della fattura, restituisci un oggetto con queste chiavi esatte:
      - tipo_operazione: 1 per acquisto (default 1)
      - periodo: 1 per mensile, 0 per trimestrale
      - mese: numero del mese a due cifre (es. "06")
      - anno: anno a 4 cifre (es. "2026")
      - stato_fornitore: codice paese ISO 2 lettere del fornitore (es. "DE")
      - piva_fornitore: partita IVA del fornitore senza prefisso paese
      - ammontare_euro: importo imponibile in Euro dell'articolo (numero)
      - ammontare_valuta: importo in valuta originale (numero)
      - natura_transazione: codice a 2 cifre (es. "11")
      - nomenclatura: codice NC / Nomenclatura Combinata a 8 cifre
      - massa_netta: peso netto in kg (numero)
      - val_statistico: valore statistico in Euro (numero)
      - cond_consegna: incoterm (es. "EXW", "DDP")
      - modo_trasporto: codice modo trasporto (es. 3)
      - paese_provenienza: codice ISO paese provenienza
      - paese_origine: codice ISO paese origine
      - data_fattura: data fattura nel formato "YYYY-MM-DD"
      - numero_fattura: numero della fattura
    `;

    // Chiamata a Gemini con logica di Retry per errori 503 (sovraccarico)
    for (let i = 0; i < retries; i++) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            { inlineData: { mimeType: 'application/pdf', data: base64Pdf } },
            { text: promptText },
          ],
        });
        break;
      } catch (err) {
        if (i === retries - 1 || (!err.message.includes('503') && !err.message.includes('UNAVAILABLE'))) {
          throw err;
        }
        await sleep(delay);
        delay *= 2;
      }
    }

    const textResult = response.text ? response.text() : JSON.stringify(response);
    let cleanedJson = textResult.trim();
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.replace(/^```json/, '').replace(/```\$/, '').trim();
    } else if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const extractedItems = JSON.parse(cleanedJson);
    const itemsArray = Array.isArray(extractedItems) ? extractedItems : (extractedItems.articoli || [extractedItems]);

    return Response.json({ items: itemsArray });

  } catch (err) {
    console.error('Errore durante l\'elaborazione della fattura:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
