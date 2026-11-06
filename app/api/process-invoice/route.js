import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request) {
  try {
    const { filePath } = await request.json();

    // 1. Scarica il file PDF da Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('fatture-pdf')
      .download(filePath);

    if (downloadError) throw downloadError;

    const arrayBuffer = await fileData.arrayBuffer();
    const base64Pdf = Buffer.from(arrayBuffer).toString('base64');

    // 2. Chiamata a Gemini per estrazione dati con Schema JSON strutturato
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Pdf
          }
        },
        'Estrai i dati della fattura per la dichiarazione Intrastat.'
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pIvaFornitore: { type: Type.STRING },
            pIvaCliente: { type: Type.STRING },
            destinazione: { type: Type.STRING },
            totaleFattura: { type: Type.NUMBER },
            articoli: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  descrizione: { type: Type.STRING },
                  voceDoganale: { type: Type.STRING },
                  numeroPezzi: { type: Type.NUMBER },
                  pesoNettoKg: { type: Type.NUMBER },
                  origine: { type: Type.STRING }
                },
                required: ['descrizione', 'voceDoganale']
              }
            }
          },
          required: ['pIvaFornitore', 'pIvaCliente', 'totaleFattura', 'articoli']
        }
      }
    });

    const extractedData = JSON.parse(response.text);

    // 3. Verifica e calcolo dei pesi mancanti tramite Supabase DB
    for (const articolo of extractedData.articoli) {
      if (!articolo.pesoNettoKg || articolo.pesoNettoKg === 0) {
        const { data: pesoRef } = await supabase
          .from('pesi_stimati_merce')
          .select('peso_unitario_kg')
          .eq('voce_doganale', articolo.voceDoganale)
          .single();

        if (pesoRef && articolo.numeroPezzi) {
          articolo.pesoNettoKg = Number((articolo.numeroPezzi * pesoRef.peso_unitario_kg).toFixed(3));
          articolo.isPesoStimato = true;
        } else {
          articolo.pesoNettoKg = 0;
          articolo.isPesoStimato = true;
        }
      } else {
        articolo.isPesoStimato = false;
      }
    }

    return Response.json(extractedData);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
