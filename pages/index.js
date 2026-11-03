import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Head from 'next/head'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseClient = createClient(supabaseUrl, supabaseKey)

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

    const { data, error } = await query.order('invoicenumber', { ascending: false })
    if (!error && data) {
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
      } else {
        if (!unpaidByYear[year]) unpaidByYear[year] = { taxable: 0, vat: 0, total: 0 }
        unpaidByYear[year].taxable += tax
        unpaidByYear[year].vat += vat
        unpaidByYear[year].total += tot
      }
    })

    return { paidByYear, unpaidByYear }
  }

  const { paidByYear, unpaidByYear } = calculateProspectSummary()
  const allProspectYears = Array.from(new Set([...Object.keys(paidByYear), ...Object.keys(unpaidByYear)])).sort((a, b) => Number(b) - Number(a))

  // Fatture filtrate per anno e per stato nel prospetto
  const filteredProspectInvoices = prospectInvoices.filter(item => {
    const matchesYear = !prospectFilterYear || (item.issuedate && item.issuedate.substring(0, 4) === prospectFilterYear)
    
    let matchesStatus = true
    if (prospectFilterStatus === 'unpaid') {
      matchesStatus = !item.paymentdate
    } else if (prospectFilterStatus === 'paid') {
      matchesStatus = !!item.paymentdate
    }

    return matchesYear && matchesStatus
  })

  async function openInsertModal() {
    setIsEditMode(false)
    setCurrentInvoiceId(null)
    setSelectedClientId('')
    setTaxableAmount('')
    setVatAmount('')
    setTotalAmount('')
    setPaymentDate('')
    setInvoiceNotes('')
    setInvoiceDate(new Date().toISOString().split('T')[0])

    const currentYearValue = filterYear || new Date().getFullYear().toString()
    const startDate = `${currentYearValue}-01-01`
    const endDate = `${currentYearValue}-12-31`

    const { data, error } = await supabaseClient
      .from('invoices')
      .select('invoicenumber')
      .gte('issuedate', startDate)
      .lte('issuedate', endDate)
      .order('invoicenumber', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      const nextNumber = Number(data[0].invoicenumber) + 1
      setInvoiceNumber(nextNumber.toString())
    } else {
      setInvoiceNumber('1')
    }

    setIsModalOpen(true)
  }

  function openEditModal(invoiceItem) {
    setIsEditMode(true)
    setCurrentInvoiceId(invoiceItem.id)
    setSelectedClientId(invoiceItem.clientid)
    setInvoiceNumber(invoiceItem.invoicenumber.toString())
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
      invoicenumber: Number(invoiceNumber),
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
      </Head>
      
      <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
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
                  {invoicesList.map((invoiceItem) => (
                    <tr key={invoiceItem.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-4 px-6 font-bold text-indigo-400">
                        #{invoiceItem.invoicenumber}
                      </td>
                      <td className="py-4 px-6 text-slate-300">
                        {invoiceItem.issuedate}
                      </td>
                      <td className="py-4 px-6 text-slate-300">
                        {invoiceItem.paymentdate ? (
                          <span className="text-emerald-400 font-medium">{invoiceItem.paymentdate}</span>
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
                  ))}
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
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-6xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Prospetto Finanziario Cliente</h2>
                  <p className="text-slate-400 text-sm mt-1">Seleziona un cliente per visualizzare il dettaglio e i totali per anno</p>
                </div>
                <button 
                  onClick={() => setIsProspectOpen(false)} 
                  className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                >
                  ✕ Chiudi
                </button>
              </div>

              {/* Selezione Cliente per il Prospetto */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 max-w-md">
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
                <div className="space-y-8">
                  
                  {/* Sezione Tabelle di Riepilogo per Anno (Pagate e Da Pagare con IVA e Incasso) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Tabella Pagate */}
                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 shadow-inner space-y-3">
                      <h3 className="text-emerald-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Pagate (per anno di emissione)
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
                        </table>
                      </div>
                    </div>

                    {/* Tabella Da Pagare */}
                    <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 shadow-inner space-y-3">
                      <h3 className="text-amber-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Da Pagare (per anno di emissione)
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
                        </table>
                      </div>
                    </div>

                  </div>

                  {/* Sezione Filtri Anno e Stato per l'Elenco Fatture del Prospetto */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-700">
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
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-slate-950 text-slate-400 uppercase tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Data Emissione</th>
                            <th className="py-3 px-4">N° Fattura</th>
                            <th className="py-3 px-4">Imponibile</th>
                            <th className="py-3 px-4">IVA</th>
                            <th className="py-3 px-4">Incasso</th>
                            <th className="py-3 px-4">Data Incasso (Pagamento)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {filteredProspectInvoices.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-800/40">
                              <td className="py-3 px-4 text-slate-300">{item.issuedate}</td>
                              <td className="py-3 px-4 font-bold text-indigo-400">#{item.invoicenumber}</td>
                              <td className="py-3 px-4 text-slate-300">€ {Number(item.taxableamount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-3 px-4 text-slate-300">€ {Number(item.vatamount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-3 px-4 font-semibold text-emerald-400">€ {Number(item.totalamount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-3 px-4">
                                {item.paymentdate ? (
                                  <span className="text-emerald-400 font-medium">{item.paymentdate}</span>
                                ) : (
                                  <span className="text-amber-500 italic">Da pagare</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {filteredProspectInvoices.length === 0 && (
                            <tr>
                              <td colSpan="6" className="py-8 text-center text-slate-500">Nessuna fattura trovata con i filtri selezionati.</td>
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
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">N° Fattura *</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
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
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">IVA (€)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={vatAmount}
                      onChange={(e) => setVatAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Incasso (€)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
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
