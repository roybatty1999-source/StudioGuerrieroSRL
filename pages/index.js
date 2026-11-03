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
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentInvoiceId, setCurrentInvoiceId] = useState(null)
  
  // Campi del form
  const [selectedClientId, setSelectedClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [taxableAmount, setTaxableAmount] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentDate, setPaymentDate] = useState('')
  const [invoiceNotes, setInvoiceNotes] = useState('')

  // Filtri di visualizzazione (default 2026)
  const [filterClient, setFilterClient] = useState('')
  const [filterYear, setFilterYear] = useState('2026')

  useEffect(() => {
    loadClients()
    loadYears()
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [filterClient, filterYear])

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
    // Aggiungiamo sempre l'anno corrente (2026) e eventuali anni recenti per sicurezza
    yearsSet.add('2026')
    yearsSet.add(new Date().getFullYear().toString())

    if (!error && data) {
      data.forEach(item => {
        if (item.issuedate) {
          // Estrae i primi 4 caratteri della data (l'anno) indipendentemente dal formato stringa
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
      .select('id, invoicenumber, clientid, issuedate, paymentdate, taxableamount, note, clients(name)')

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

  async function openInsertModal() {
    setIsEditMode(false)
    setCurrentInvoiceId(null)
    setSelectedClientId('')
    setTaxableAmount('')
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
    setTaxableAmount(invoiceItem.taxableamount.toString())
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
      taxableamount: Number(taxableAmount),
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
            <button 
              onClick={openInsertModal}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Nuova Fattura
            </button>
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
                      <td className="py-4 px-6 font-semibold text-emerald-400">
                        € {Number(invoiceItem.taxableamount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      <td colSpan="7" className="py-12 text-center text-slate-500 font-medium">
                        Nessuna fattura trovata con i filtri selezionati.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Modifica/Inserimento */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Imponibile (€) *</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={taxableAmount}
                      onChange={(e) => setTaxableAmount(e.target.value)}
                      placeholder="0.00"
                      required
                    />
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
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Note</label>
                  <textarea 
                    rows="3"
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
