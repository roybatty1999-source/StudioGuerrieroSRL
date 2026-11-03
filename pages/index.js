import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Head from 'next/head'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseClient = createClient(supabaseUrl, supabaseKey)

// Funzione di utilità per formattare la data da AAAA-MM-GG a GG/MM/AAAA
function formatDateToIT(dateString) {
  if (!dateString) return '-'
  const parts = dateString.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateString
}

export default function InvoiceDashboard() {
  const [invoicesList, setInvoicesList] = useState([])
  const [clientsList, setClientsList] = useState([])
  const [availableYears, setAvailableYears] = useState([])
  
  // Stati Modale Inserimento/Modifica Fattura
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentInvoiceId, setCurrentInvoiceId] = useState(null)
  
  // Stati Modale Aggiungi Cliente
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [newClientName, setNewClientName] = useState('')

  // Stati per la vista Prospetto
  const [isProspectOpen, setIsProspectOpen] = useState(false)
  const [prospectClientId, setProspectClientId] = useState('')
  const [prospectInvoices, setProspectInvoices] = useState([])
  const [prospectFilterYear, setProspectFilterYear] = useState('')
  const [prospectFilterStatus, setProspectFilterStatus] = useState('all')

  // Campi del form inserimento/modifica fattura
  const [selectedClientId, setSelectedClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [taxableAmount, setTaxableAmount] = useState('')
  const [vatAmount, setVatAmount] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentDate, setPaymentDate] = useState('')
  const [invoiceNotes, setInvoiceNotes] = useState('')

  // Filtri di visualizzazione dashboard
  const [filterClient, setFilterClient] = useState('')
  const [filterYear, setFilterYear] = useState('2026')

  useEffect(() => {
    loadClients()
    loadYears()
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [filterClient, filterYear])

  useEffect(() => {
    if (isProspectOpen && prospectClientId) {
      loadProspectData(prospectClientId)
    } else {
      setProspectInvoices([])
      setProspectFilterYear('')
      setProspectFilterStatus('all')
    }
  }, [isProspectOpen, prospectClientId])

  // Calcolo automatico di IVA e Incasso al variare dell'Imponibile
  useEffect(() => {
    const tax = Number(taxableAmount)
    if (!isNaN(tax) && taxableAmount !== '') {
      const vat = tax * 0.22
      const tot = tax + vat
      setVatAmount(vat.toFixed(2))
      setTotalAmount(tot.toFixed(2))
    } else {
      setVatAmount('')
      setTotalAmount('')
    }
  }, [taxableAmount])

  // Calcolo automatico del prossimo numero progressivo per l'anno di emissione scelto (Azzeramento annuale)
  useEffect(() => {
    if (!isEditMode && invoiceDate) {
      const yearStr = invoiceDate.substring(0, 4)
      updateNextInvoiceNumber(yearStr)
    }
  }, [invoiceDate, isEditMode])

  async function updateNextInvoiceNumber(yearStr) {
    const startDate = `${yearStr}-01-01`
    const endDate = `${yearStr}-12-31`

    const { data, error } = await supabaseClient
      .from('invoices')
      .select('invoicenumber')
      .gte('issuedate', startDate)
      .lte('issuedate', endDate)

    if (!error && data && data.length > 0) {
      let maxNum = 0
      data.forEach(item => {
        const num = Number(item.invoicenumber)
        if (!isNaN(num) && num > maxNum) {
          maxNum = num
        }
      })
      const nextNum = maxNum + 1
      setInvoiceNumber(nextNum.toString())
    } else {
      setInvoiceNumber('1')
    }
  }

  async function loadClients() {
    const { data, error } = await supabaseClient
      .from('clients')
      .select('id, name')
      .order('name', { ascending: true })
    if (!error && data) {
      setClientsList(data)
    }
  }

  async function loadYears() {
    const { data, error } = await supabaseClient
      .from('invoices')
      .select('issuedate')
    
    const yearsSet = new Set()
    yearsSet.add('2026')
    yearsSet.add(new Date().getFullYear().toString())

    if (!error && data) {
      data.forEach(item => {
        if (item.issuedate) {
          const yearValue = String(item.issuedate).substring(0, 4)
          if (yearValue && !isNaN(yearValue) && yearValue.length === 4) {
            yearsSet.add(yearValue)
          }
        }
      })
    }

    const yearsArray = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a))
    setAvailableYears(yearsArray)
  }

  async function loadInvoices() {
    let query = supabaseClient
      .from('invoices')
      .select('id, invoicenumber, clientid, issuedate, paymentdate, taxableamount, vatamount, totalamount, note, clients(name)')

    if (filterClient) {
      query = query.eq('clientid', filterClient)
    }

    if (filterYear) {
      const startDate = `${filterYear}-01-01`
      const endDate = `${filterYear}-12-31`
      query = query.gte('issuedate', startDate).lte('issuedate', endDate)
    }

    const { data, error } = await query.order('issuedate', { ascending: false })
    if (!error && data) {
      data.sort((a, b) => {
        const numA = Number(a.invoicenumber) || 0
        const numB = Number(b.invoicenumber) || 0
        return numB - numA
      })
      setInvoicesList(data)
    }
  }

  async function loadProspectData(clientId) {
    const { data, error } = await supabaseClient
      .from('invoices')
      .select('id, invoicenumber, issuedate, paymentdate, taxableamount, vatamount, totalamount')
      .eq('clientid', clientId)
      .order('issuedate', { ascending: true })

    if (!error && data) {
      // Ordinamento rigoroso dal più vecchio al più nuovo: prima per data, poi per numero fattura crescente
      data.sort((a, b) => {
        const dateCompare = (a.issuedate || '').localeCompare(b.issuedate || '')
        if (dateCompare !== 0) return dateCompare
        return (Number(a.invoicenumber) || 0) - (Number(b.invoicenumber) || 0)
      })
      setProspectInvoices(data)
    } else {
      setProspectInvoices([])
    }
  }

  // Salvataggio nuovo cliente
  async function handleSaveClient(event) {
    event.preventDefault()
    if (!newClientName.trim()) return

    const { data, error } = await supabaseClient
      .from('clients')
      .insert([{ name: newClientName.trim() }])
      .select()

    if (error) {
      alert('Errore durante l\'inserimento del cliente: ' + error.message)
      return
    }

    setNewClientName('')
    setIsClientModalOpen(false)
    loadClients()

    if (data && data.length > 0) {
      setSelectedClientId(data[0].id)
    }
  }

  // Calcoli per il prospetto (raggruppamento per anno di emissione)
  function calculateProspectSummary() {
    const paidByYear = {}
    const unpaidByYear = {}

    // Totali generali pagati e non pagati
    let totalPaidTaxable = 0
    let totalPaidVat = 0
    let totalPaidTotal = 0

    let totalUnpaidTaxable = 0
    let totalUnpaidVat = 0
    let totalUnpaidTotal = 0

    prospectInvoices.forEach(item => {
      if (!item.issuedate) return
      const year = item.issuedate.substring(0, 4)
      const tax = Number(item.taxableamount) || 0
      const vat = Number(item.vatamount) || 0
      const tot = Number(item.totalamount) || 0

      if (item.paymentdate) {
        if (!paidByYear[year]) paidByYear[year] = { taxable: 0, vat: 0, total: 0 }
        paidByYear[year].taxable += tax
        paidByYear[year].vat += vat
        paidByYear[year].total += tot

        totalPaidTaxable += tax
        totalPaidVat += vat
        totalPaidTotal += tot
      } else {
        if (!unpaidByYear[year]) unpaidByYear[year] = { taxable: 0, vat: 0, total: 0 }
        unpaidByYear[year].taxable += tax
        unpaidByYear[year].vat += vat
        unpaidByYear[year].total += tot

        totalUnpaidTaxable += tax
        totalUnpaidVat += vat
        totalUnpaidTotal += tot
      }
    })

    return { 
      paidByYear, 
      unpaidByYear, 
      paidTotals: { taxable: totalPaidTaxable, vat: totalPaidVat, total: totalPaidTotal },
      unpaidTotals: { taxable: totalUnpaidTaxable, vat: totalUnpaidVat, total: totalUnpaidTotal }
    }
  }

  const { paidByYear, unpaidByYear, paidTotals, unpaidTotals } = calculateProspectSummary()
  const allProspectYears = Array.from(new Set([...Object.keys(paidByYear), ...Object.keys(unpaidByYear)])).sort((a, b) => Number(b) - Number(a))

  // Nome del cliente attualmente selezionato nel prospetto
  const currentSelectedClientName = clientsList.find(c => c.id === prospectClientId)?.name || ''

  async function openInsertModal() {
    setIsEditMode(false)
    setCurrentInvoiceId(null)
    setSelectedClientId('')
    setTaxableAmount('')
    setVatAmount('')
    setTotalAmount('')
    setPaymentDate('')
    setInvoiceNotes('')
    const today = new Date().toISOString().split('T')[0]
    setInvoiceDate(today)
    
    const currentYearValue = today.substring(0, 4)
    await updateNextInvoiceNumber(currentYearValue)

    setIsModalOpen(true)
  }

  function openEditModal(invoiceItem) {
    setIsEditMode(true)
    setCurrentInvoiceId(invoiceItem.id)
    setSelectedClientId(invoiceItem.clientid)
    setInvoiceNumber(invoiceItem.invoicenumber != null ? invoiceItem.invoicenumber.toString() : '')
    setTaxableAmount(invoiceItem.taxableamount != null ? invoiceItem.taxableamount.toString() : '')
    setVatAmount(invoiceItem.vatamount != null ? invoiceItem.vatamount.toString() : '')
    setTotalAmount(invoiceItem.totalamount != null ? invoiceItem.totalamount.toString() : '')
    setInvoiceDate(invoiceItem.issuedate)
    setPaymentDate(invoiceItem.paymentdate || '')
    setInvoiceNotes(invoiceItem.note || '')
    setIsModalOpen(true)
  }

  async function handleSaveInvoice(event) {
    event.preventDefault()

    const invoicePayload = {
      invoicenumber: invoiceNumber ? Number(invoiceNumber) : null,
      clientid: selectedClientId,
      issuedate: invoiceDate,
      paymentdate: paymentDate || null,
      taxableamount: taxableAmount ? Number(taxableAmount) : null,
      vatamount: vatAmount ? Number(vatAmount) : null,
      totalamount: totalAmount ? Number(totalAmount) : null,
      note: invoiceNotes || null
    }

    if (isEditMode) {
      const { error } = await supabaseClient
        .from('invoices')
        .update(invoicePayload)
        .eq('id', currentInvoiceId)

      if (error) {
        alert('Errore durante la modifica: ' + error.message)
        return
      }
    } else {
      const { error } = await supabaseClient
        .from('invoices')
        .insert([invoicePayload])

      if (error) {
        alert("Errore durante l'inserimento: " + error.message)
        return
      }
    }

    setIsModalOpen(false)
    loadYears()
    loadInvoices()
    if (isProspectOpen && prospectClientId) {
      loadProspectData(prospectClientId)
    }
  }

  return (
    <>
      <Head>
        <title>Gestionale Fatture</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style dangerouslySetInnerHTML={{__html: `
          @page {
            size: portrait;
            margin: 10mm;
          }
          @media print {
            body * {
              visibility: hidden !important;
            }
            .printable-prospect-container, .printable-prospect-container * {
              visibility: visible !important;
            }
            .printable-prospect-container {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .no-print { display: none !important; }
            
            .print-client-title {
              text-align: center !important;
              font-size: 16px !important;
              font-weight: bold !important;
              text-transform: uppercase !important;
              margin-bottom: 12px !important;
              color: black !important;
            }
            .print-sub-title {
              font-size: 11px !important;
              font-weight: bold !important;
              margin-top: 10px !important;
              margin-bottom: 4px !important;
              color: black !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-bottom: 10px !important;
              page-break-inside: avoid;
            }
            th, td {
              border: 1px solid #334155 !important;
              padding: 4px 6px !important;
              font-size: 9px !important;
              color: black !important;
              background: white !important;
            }
            th {
              background-color: #f1f5f9 !important;
              font-weight: bold !important;
              text-align: left;
            }
            .text-right { text-align: right !important; }
          }
        `}} />
      </Head>
      
      <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6 no-print">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Gestionale Fatture</h1>
              <p className="text-slate-400 text-sm mt-1">Gestisci, filtra ed emetti le tue fatture in modo semplice</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => setIsClientModalOpen(true)}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg transition-all duration-200 border border-slate-600 text-sm"
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Aggiungi Cliente
              </button>
              <button 
                onClick={() => setIsProspectOpen(true)}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg transition-all duration-200 border border-slate-600 text-sm"
              >
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Prospetto
              </button>
              <button 
                onClick={openInsertModal}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Inserisci Fattura
              </button>
            </div>
          </div>

          {/* Bar Filtri */}
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-lg flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cliente</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
              >
                <option value="">Tutti i clienti ({clientsList.length})</option>
                {clientsList.map((clientItem) => (
                  <option key={clientItem.id} value={clientItem.id}>
                    {clientItem.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-48">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Anno di emissione</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="">Tutti gli anni</option>
                {availableYears.map((yearItem) => (
                  <option key={yearItem} value={yearItem}>
                    {yearItem}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabella Fatture */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="py-4 px-6">N° Fattura</th>
                    <th className="py-4 px-6">Data Emissione</th>
                    <th className="py-4 px-6">Data Pagamento</th>
                    <th className="py-4 px-6">Cliente</th>
                    <th className="py-4 px-6">Imponibile</th>
                    <th className="py-4 px-6">IVA</th>
                    <th className="py-4 px-6">Incasso</th>
                    <th className="py-4 px-6">Note</th>
                    <th className="py-4 px-6 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-sm">
                  {invoicesList.map((invoiceItem) => {
                    const yearFromDate = invoiceItem.issuedate ? invoiceItem.issuedate.substring(0, 4) : ''
                    const displayInvoiceNum = invoiceItem.invoicenumber && yearFromDate ? `${invoiceItem.invoicenumber}/${yearFromDate}` : invoiceItem.invoicenumber

                    return (
                      <tr key={invoiceItem.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-4 px-6 font-bold text-indigo-400">
                          {displayInvoiceNum}
                        </td>
                        <td className="py-4 px-6 text-slate-300">
                          {formatDateToIT(invoiceItem.issuedate)}
                        </td>
                        <td className="py-4 px-6 text-slate-300">
                          {invoiceItem.paymentdate ? (
                            <span className="text-emerald-400 font-medium">{formatDateToIT(invoiceItem.paymentdate)}</span>
                          ) : (
                            <span className="text-slate-500 italic">Non pagata</span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-medium text-white">
                          {invoiceItem.clients?.name || 'Cliente non specificato'}
                        </td>
                        <td className="py-4 px-6 text-slate-300">
                          {invoiceItem.taxableamount != null ? `€ ${Number(invoiceItem.taxableamount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-4 px-6 text-slate-300">
                          {invoiceItem.vatamount != null ? `€ ${Number(invoiceItem.vatamount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-4 px-6 font-semibold text-emerald-400">
                          {invoiceItem.totalamount != null ? `€ ${Number(invoiceItem.totalamount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-4 px-6 text-slate-400 max-w-xs truncate">
                          {invoiceItem.note || '-'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button 
                            onClick={() => openEditModal(invoiceItem)}
                            className="bg-slate-700 hover:bg-amber-600/80 text-amber-300 hover:text-white px-3.5 py-1.5 rounded-lg font-medium text-xs border border-amber-500/30 transition-all duration-150"
                          >
                            Modifica
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {invoicesList.length === 0 && (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-500 font-medium">
                        Nessuna fattura trovata con i filtri selezionati.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Aggiungi Cliente */}
        {isClientModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <h2 className="text-xl font-bold text-white">Nuovo Cliente</h2>
                <button 
                  onClick={() => setIsClientModalOpen(false)} 
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveClient} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Nome Azienda / Cliente *</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Es. ACME S.R.L."
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <button 
                    type="button" 
                    onClick={() => setIsClientModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                  >
                    Annulla
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all"
                  >
                    Salva Cliente
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Prospetto */}
        {isProspectOpen && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-6xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto printable-prospect-container">
              
              <div className="flex justify-between items-center border-b border-slate-700 pb-4 no-print">
                <div>
                  <h2 className="text-2xl font-bold text-white">Prospetto Finanziario Cliente</h2>
                  <p className="text-slate-400 text-sm mt-1">Seleziona un cliente per visualizzare il dettaglio e i totali per anno</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => window.print()} 
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Stampa Prospetto
                  </button>
                  <button 
                    onClick={() => setIsProspectOpen(false)} 
                    className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                  >
                    ✕ Chiudi
                  </button>
                </div>
              </div>

              {/* Titolo visibile solo in stampa */}
              <div className="hidden print:block print-client-title">
                {currentSelectedClientName}
              </div>

              {/* Selezione Cliente per il Prospetto */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 max-w-md no-print">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Seleziona Cliente</label>
                <select 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={prospectClientId}
                  onChange={(e) => {
                    setProspectClientId(e.target.value)
                    setProspectFilterYear('')
                    setProspectFilterStatus('all')
                  }}
                >
                  <option value="">-- Scegli un cliente --</option>
                  {clientsList.map((clientItem) => (
                    <option key={clientItem.id} value={clientItem.id}>
                      {clientItem.name}
                    </option>
                  ))}
                </select>
              </div>

              {prospectClientId ? (
                <div className="space-y-6">
                  
                  {/* Sezione Tabelle di Riepilogo per Anno (Pagate e Non Pagate) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Tabella Pagate */}
                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 shadow-inner space-y-3">
                      <h3 className="text-emerald-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2 print-sub-title">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 no-print"></span> Pagate (per anno di emissione)
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="py-2 px-3">Anno</th>
                              <th className="py-2 px-3 text-right">Imponibile</th>
                              <th className="py-2 px-3 text-right">IVA</th>
                              <th className="py-2 px-3 text-right">Incasso</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {allProspectYears.map(year => {
                              const data = paidByYear[year] || { taxable: 0, vat: 0, total: 0 }
                              return (
                                <tr key={`paid-${year}`} className="hover:bg-slate-800/50">
                                  <td className="py-2.5 px-3 font-semibold text-white">{year}</td>
                                  <td className="py-2.5 px-3 text-right text-slate-300">€ {data.taxable.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="py-2.5 px-3 text-right text-slate-300">€ {data.vat.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="py-2.5 px-3 text-right font-bold text-emerald-400">€ {data.total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                          {/* Riga Totale Complessivo Pagate */}
                          <tfoot>
                            <tr className="border-t-2 border-emerald-500/40 bg-slate-950/60 font-bold">
                              <td className="py-2.5 px-3 text-white uppercase text-[10px]">Totale</td>
                              <td className="py-2.5 px-3 text-right text-slate-200">€ {paidTotals.taxable.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-2.5 px-3 text-right text-slate-200">€ {paidTotals.vat.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-400">€ {paidTotals.total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Tabella Non Pagate */}
                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 shadow-inner space-y-3">
                      <h3 className="text-amber-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2 print-sub-title">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 no-print"></span> Non Pagate (per anno di emissione)
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="py-2 px-3">Anno</th>
                              <th className="py-2 px-3 text-right">Imponibile</th>
                              <th className="py-2 px-3 text-right">IVA</th>
                              <th className="py-2 px-3 text-right">Incasso</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {allProspectYears.map(year => {
                              const data = unpaidByYear[year] || { taxable: 0, vat: 0, total: 0 }
                              return (
                                <tr key={`unpaid-${year}`} className="hover:bg-slate-800/50">
                                  <td className="py-2.5 px-3 font-semibold text-white">{year}</td>
                                  <td className="py-2.5 px-3 text-right text-slate-300">€ {data.taxable.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="py-2.5 px-3 text-right text-slate-300">€ {data.vat.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="py-2.5 px-3 text-right font-bold text-amber-400">€ {data.total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                          {/* Riga Totale Complessivo Non Pagate */}
                          <tfoot>
                            <tr className="border-t-2 border-amber-500/40 bg-slate-950/60 font-bold">
                              <td className="py-2.5 px-3 text-white uppercase text-[10px]">Totale</td>
                              <td className="py-2.5 px-3 text-right text-slate-200">€ {unpaidTotals.taxable.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-2.5 px-3 text-right text-slate-200">€ {unpaidTotals.vat.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-2.5 px-3 text-right text-amber-400">€ {unpaidTotals.total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                  </div>

                  {/* Sezione Filtri Anno e Stato per l'Elenco Fatture del Prospetto */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-700 no-print">
                    <h3 className="text-white font-bold text-sm">Elenco Fatture del Cliente</h3>
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Anno:</label>
                        <select 
                          className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-36"
                          value={prospectFilterYear}
                          onChange={(e) => setProspectFilterYear(e.target.value)}
                        >
                          <option value="">Tutti gli anni</option>
                          {allProspectYears.map(yearItem => (
                            <option key={`prospect-filter-${yearItem}`} value={yearItem}>
                              {yearItem}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Stato:</label>
                        <select 
                          className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-40"
                          value={prospectFilterStatus}
                          onChange={(e) => setProspectFilterStatus(e.target.value)}
                        >
                          <option value="all">Tutte le fatture</option>
                          <option value="unpaid">Solo non pagate</option>
                          <option value="paid">Solo pagate</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Tabella Dettaglio Fatture del Cliente */}
                  <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="p-3 bg-slate-950 font-bold text-xs uppercase tracking-wider text-slate-300 hidden print:block print-sub-title">
                      ELENCO FATTURE DEL CLIENTE
                    </div>
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-slate-950 text-slate-400 uppercase tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Data Emissione</th>
                            <th className="py-3 px-4">N° Fattura</th>
                            <th className="py-3 px-4">Imponibile</th>
                            <th className="py-3 px-4">IVA</th>
                            <th className="py-3 px-4">Incasso</th>
                            <th className="py-3 px-4 no-print">Stato</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {prospectInvoices.map((item) => {
                            const matchesYear = !prospectFilterYear || (item.issuedate && item.issuedate.substring(0, 4) === prospectFilterYear)
                            let matchesStatus = true
                            if (prospectFilterStatus === 'unpaid') matchesStatus = !item.paymentdate
                            else if (prospectFilterStatus === 'paid') matchesStatus = !!item.paymentdate
                            
                            if (!matchesYear || !matchesStatus) return null

                            const yearFromDate = item.issuedate ? item.issuedate.substring(0, 4) : ''
                            const displayInvoiceNum = item.invoicenumber && yearFromDate ? `${item.invoicenumber}/${yearFromDate}` : item.invoicenumber

                            return (
                              <tr key={item.id} className="hover:bg-slate-800/40">
                                <td className="py-3 px-4 text-slate-300">{formatDateToIT(item.issuedate)}</td>
                                <td className="py-3 px-4 font-bold text-indigo-400">{displayInvoiceNum}</td>
                                <td className="py-3 px-4 text-slate-300">€ {Number(item.taxableamount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="py-3 px-4 text-slate-300">€ {Number(item.vatamount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="py-3 px-4 font-semibold text-emerald-400">€ {Number(item.totalamount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="py-3 px-4 no-print">
                                  {item.paymentdate ? (
                                    <span className="text-emerald-400 font-medium">{formatDateToIT(item.paymentdate)}</span>
                                  ) : (
                                    <span className="text-amber-500 italic">Da pagare</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                          {prospectInvoices.length === 0 && (
                            <tr>
                              <td colSpan="6" className="py-8 text-center text-slate-500">Nessuna fattura trovata per questo cliente.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="py-16 text-center text-slate-500 bg-slate-900 rounded-xl border border-slate-700">
                  Seleziona un cliente dal menu sopra per generare il prospetto finanziario.
                </div>
              )}

            </div>
          </div>
        )}

        {/* Modal Modifica/Inserimento Fattura */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <h2 className="text-xl font-bold text-white">
                  {isEditMode ? 'Modifica Fattura' : 'Nuova Fattura'}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveInvoice} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Cliente *</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    required
                  >
                    <option value="">Seleziona un cliente...</option>
                    {clientsList.map((clientItem) => (
                      <option key={clientItem.id} value={clientItem.id}>
                        {clientItem.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">N° Fattura (Auto) *</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 cursor-not-allowed outline-none font-bold text-indigo-400"
                      value={invoiceDate && invoiceNumber ? `${invoiceNumber}/${invoiceDate.substring(0, 4)}` : invoiceNumber}
                      readOnly
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Data Emissione *</label>
                    <input 
                      type="date" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Imponibile (€)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={taxableAmount}
                      onChange={(e) => setTaxableAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">IVA (€ - Auto)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-400 cursor-not-allowed outline-none"
                      value={vatAmount}
                      readOnly
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Incasso (€ - Auto)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-400 cursor-not-allowed outline-none"
                      value={totalAmount}
                      readOnly
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Data Pagamento</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Note</label>
                  <textarea 
                    rows="2"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    placeholder="Note o descrizione facoltativa..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                  >
                    Annulla
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all"
                  >
                    Salva Fattura
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
