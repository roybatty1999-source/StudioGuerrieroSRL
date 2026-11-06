import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Inizializza Supabase con le credenziali di servizio o anonime del server
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Funzione di supporto per attendere qualche secondo in caso di errore 503
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return Response.json({ error: 'Percorso del file mancante' }, { status: 400 });
    }

    // 1. Scarica il PDF da Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('fatture-pdf')
      .download(filePath);

    if (downloadError) {
      throw new Error(`Errore nel download del file da Supabase: ${downloadError.message}`);
    }

    // Converte il file in array buffer e poi in base64 per Gemini
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Pdf = buffer.toString('base64');

    let response;
    let retries = 3; // Numero di tentativi in caso di 503
    let delay = 2000; // 2 secondi di attesa iniziale

    // 2. Chiamata a Gemini con logica di Retry per i sovraccarichi (503)
    for (let i = 0; i < retries; i++) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Pdf,
              },
            },
            {
              text: "Analizza questa fattura Intrastat, estrai i dati doganali, gli articoli e calcola i pesi stimati della merce strutturando l'output in formato JSON.",
            },
          ],
        });
        break; // Se ha successo, esce dal ciclo
      } catch (err) {
        // Se è l'ultimo tentativo o non riguarda un errore di servizio (503), rilancia l'errore
        if (i === retries - 1 || (!err.message.includes('503') && !err.message.includes('UNAVAILABLE'))) {
          throw err;
        }
        console.warn(`Tentativo ${i + 1} fallito per sovraccarico (503). Riprovo tra ${delay / 1000} secondi...`);
        await sleep(delay);
        delay *= 2; // Raddoppia l'attesa (backoff esponenziale)
      }
    }

    // Estrae il testo della risposta generata da Gemini
    const textResult = response.text ? response.text() : JSON.stringify(response);

    // Pulizia e parsing del JSON restituito da Gemini (rimuove eventuali blocchi markdown di codice)
    let cleanedJson = textResult.trim();
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.replace(/^```json/, '').replace(/```\$/, '').trim();
    } else if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedData = JSON.parse(cleanedJson);

    return Response.json(parsedData);

  } catch (err) {
    console.error('Errore durante l\'elaborazione dell\'API:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
