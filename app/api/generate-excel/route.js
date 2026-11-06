import ExcelJS from 'exceljs';
import path from 'path';

export async function POST(request) {
  try {
    const { rows } = await request.json();

    if (!rows || !Array.isArray(rows)) {
      return Response.json({ error: 'Nessun dato fornito per l\'Excel' }, { status: 400 });
    }

    const templatePath = path.join(process.cwd(), 'public', 'intrastat_base_v3.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const worksheet = workbook.getWorksheet('Beni');

    rows.forEach((item) => {
      worksheet.addRow([
        item.tipo_operazione ?? 1,      // a = TIPO OPERAZ.
        item.periodo ?? 1,              // b = PERIODO
        item.mese ?? '',                // c = MESE
        item.anno ?? '',                // d = ANNO
        '',                             // e = P. IVA IT
        item.stato_fornitore ?? '',     // f = STATO
        item.piva_fornitore ?? '',      // g = P.IVA FORNITORE
        item.ammontare_euro ?? 0,       // h = AMMONTARE
        item.ammontare_valuta ?? 0,     // i = AMMONTARE IN VALUTA
        item.natura_transazione ?? '11',// j = NAT. TRANS
        item.nomenclatura ?? '',        // k = NOMENCLATURA
        item.massa_netta ?? 0,          // l = MASSA NETTA
        0,                              // m = U.S.
        item.val_statistico ?? 0,       // n = VAL. STATISTICO
        item.cond_consegna ?? '',       // o = COND. CONSEGNA
        item.modo_trasporto ?? '',      // p = MODO TRASPORTO
        '',                             // q = PAESE DESTIN.
        '',                             // r = PROVINCIA ORIGINE
        item.paese_provenienza ?? '',   // s = PAESE PROVEN.
        item.paese_origine ?? '',       // t = PAESE ORIGINE
        '',                             // u = PROVINCIA DESTIN.
        item.data_fattura ?? '',        // v = data fattura
        item.numero_fattura ?? '',      // w = numero fattura
        '',                             // x = raggruppatore
        '',                             // y = progressivo cliente
        ''                              // z = protocollo iva
      ]);
    });

    const bufferOut = await workbook.xlsx.writeBuffer();

    return new Response(bufferOut, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="intrastat_compilato.xlsx"',
      },
    });

  } catch (err) {
    console.error('Errore nella generazione dell\'Excel:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
