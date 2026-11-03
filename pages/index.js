import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Head from 'next/head'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseClient = createClient(supabaseUrl, supabaseKey)

export default function InvoiceDashboard() {
  const [invoicesList, setInvoicesList] = useState([])
  const [clientsList, setClientsList] = useState([])
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

  // Filtri di visualizzazione
  const [filterClient, setFilterClient] = useState('')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())

  useEffect(() => {
    loadClients()
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

    const currentYearValue = new Date().getFullYear()
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
              <input 
                type="text" 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                placeholder="AAAA"
              />
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
                    <th className="py-4 px-6">Im
