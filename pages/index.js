import { useState, useEffect, useRef } from 'react'
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
  const [allInvoicesList, setAllInvoicesList] = useState([])
  const [clientsList, setClientsList] = useState([])
  const [availableYears, setAvailableYears] = useState([])
  
  // Stati Modale Inserimento/Modifica Fattura
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentInvoiceId, setCurrentInvoiceId] = useState(null)
  
  // Stati Modale Aggiungi/Modifica Cliente
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [isClientEditMode, setIsClientEditMode] = useState(false)
  const [selectedClientToEditId, setSelectedClientToEditId] = useState('')
  const [newClientName, setNewClientName] = useState('')

  // Stati per i menu a tendina di selezione interattiva (Modifica/Cancella)
  const [isSelectClientModalOpen, setIsSelectClientModalOpen] = useState(false)
  const [clientActionType, setClientActionType] = useState('edit')
  const [targetClientId, setTargetClientId] = useState('')

  const [isSelectInvoiceModalOpen, setIsSelectInvoiceModalOpen] = useState(false)
  const [invoiceActionType, setInvoiceActionType] = useState('edit')
  const [targetInvoiceId, setTargetInvoiceId] = useState('')

  // Stati per i menu a tendina (Dropdown) della barra superiore
  const [clientMenuOpen, setClientMenuOpen] = useState(false)
  const [invoiceMenuOpen, setInvoiceMenuOpen] = useState(false)

  // Stati per la vista Prospetto Cliente
  const [isProspectOpen, setIsProspectOpen] = useState(false)
  const [prospectClientId, setProspectClientId] = useState('')
  const [prospectInvoices, setProspectInvoices] = useState([])
  const [prospectFilterYear, setProspectFilterYear] = useState('')
  const [prospectFilterStatus, setProspectFilterStatus] = useState('all')

  // Stati per la vista Gestione (Prospetto Generale & Grafico)
  const [isManagementOpen, setIsManagementOpen] = useState(false)
  const chartRef = useRef(null)
  const chartInstanceRef = useRef(null)

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
    loadAllInvoicesForManagement()
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [filterClient, filterYear])

  // Gestione sicura del caricamento e renderizzazione del grafico nella modale Gestione
  useEffect(() => {
    if (isManagementOpen) {
      loadAllInvoicesForManagement().then(() => {
        const timer = setTimeout(() => {
          if (!window.Chart) {
            const script = document.createElement('script')
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js'
            script.async = true
            script.onload = () => renderManagementChart()
            document.body.appendChild(script)
          } else {
            renderManagementChart()
          }
        }, 50)
        return () => clearTimeout(timer)
      })
    } else {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
        chartInstanceRef.current = null
      }
    }
  }, [isManagementOpen])

  useEffect(() => {
    if (isManagementOpen) {
      const timer = setTimeout(() => {
        renderManagementChart()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [allInvoicesList, isManagementOpen])

  useEffect(() => {
    if (isProspectOpen && prospectClientId) {
      loadProspectData(prospectClientId)
    } else {
      setProspectInvoices([])
      setProspectFilterYear('')
      setProspectFilterStatus('all')
    }
  }, [isProspectOpen, prospectClientId])

  // Scarica TUTTE le fatture bypassando il limite dei 1000 record di Supabase tramite paginazione
  async function loadAllInvoicesForManagement() {
    let allData = []
    let page = 0
    const pageSize = 1000
    let fetchMore = true

    while (fetchMore) {
      const { data, error } = await supabaseClient
        .from('invoices')
        .select('id, invoicenumber, clientid, issuedate, paymentdate, taxableamount, vatamount, totalamount, note')
        .order('issuedate', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error || !data || data.length === 0) {
        fetchMore = false
      } else {
        allData = [...allData, ...data]
        if (data.length < pageSize) {
          fetchMore = false
        } else {
          page++
        }
      }
    }

    setAllInvoicesList(allData)
  }

  function renderManagementChart() {
    if (!chartRef.current || !window.Chart) return
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy()
      chartInstanceRef.current = null
    }

    const { generalByYear, allGeneralYears } = calculateGeneralManagementSummary()
    const sortedYears = [...allGeneralYears].sort((a, b) => Number(a) - Number(b))
    const taxableData = sortedYears.map(year => generalByYear[year]?.taxable || 0)

    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    chartInstanceRef.current = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: sortedYears,
        datasets: [{
          label: 'Imponibile (€)',
          data: taxableData,
          borderColor: '#818cf8',
          backgroundColor: 'rgba(129, 140, 248, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#818cf8',
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#cbd5e1' } }
        },
        scales: {
          x: { 
            grid: { color: 'rgba(51, 65, 85, 0.4)' },
            ticks: { color: '#cbd5e1' }
          },
          y: { 
            grid: { color: 'rgba(51, 65, 85, 0.4)' },
            ticks: { color: '#cbd5e1' }
          }
        }
      }
    })
  }

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

  // Gestione menu Cliente
  function openAddClientModal() {
    setIsClientEditMode(false)
    setNewClientName('')
    setSelectedClientToEditId('')
    setIsClientModalOpen(true)
    setClientMenuOpen(false)
  }

  function openSelectClientForEdit() {
    if (clientsList.length === 0) {
      alert("Nessun cliente disponibile.")
      return
    }
    setClientActionType('edit')
    setTargetClientId(clientsList[0].id)
    setIsSelectClientModalOpen(true)
    setClientMenuOpen(false)
  }

  function openSelectClientForDelete() {
    if (clientsList.length === 0) {
      alert("Nessun cliente disponibile.")
      return
    }
    setClientActionType('delete')
    setTargetClientId(clientsList[0].id)
    setIsSelectClientModalOpen(true)
    setClientMenuOpen(false)
  }

  async function handleConfirmClientSelection(e) {
    e.preventDefault()
    if (!targetClientId) return

    if (clientActionType === 'edit') {
      const found = clientsList.find(c => c.id === targetClientId)
      if (found) {
        setIsClientEditMode(true)
        setSelectedClientToEditId(found.id)
        setNewClientName(found.name)
        setIsSelectClientModalOpen(false)
        setIsClientModalOpen(true)
      }
    } else if (clientActionType === 'delete') {
      const found = clientsList.find(c => c.id === targetClientId)
      if (found && confirm(`Sei sicuro di voler eliminare il cliente ${found.name} e tutte le sue fatture collegate?`)) {
        await supabaseClient.from('invoices').delete().eq('clientid', found.id)
        const { error } = await supabaseClient.from('clients').delete().eq('id', found.id)
        if (error) {
          alert("Errore durante l'eliminazione: " + error.message)
        } else {
          alert("Cliente eliminato con successo.")
          loadClients()
          loadInvoices()
          loadAllInvoicesForManagement()
        }
        setIsSelectClientModalOpen(false)
      }
    }
  }

  async function handleSaveClient(event) {
    event.preventDefault()
    if (!newClientName.trim()) return

    if (isClientEditMode && selectedClientToEditId) {
      const { error } = await supabaseClient
        .from('clients')
        .update({ name: newClientName.trim() })
        .eq('id', selectedClientToEditId)

      if (error) {
        alert('Errore durante l\'aggiornamento del cliente: ' + error.message)
        return
      }
    } else {
      const { data, error } = await supabaseClient
        .from('clients')
        .insert([{ name: newClientName.trim() }])
        .select()

      if (error) {
        alert('Errore durante l\'inserimento del cliente: ' + error.message)
        return
      }
      if (data && data.length > 0) {
        setSelectedClientId(data[0].id)
      }
    }

    setNewClientName('')
    setIsClientModalOpen(false)
    loadClients()
  }

  // Gestione menu Fatture
  function handleAddInvoiceAction() {
    openInsertModal()
    setInvoiceMenuOpen(false)
  }

  function openSelectInvoiceForEdit() {
    if (invoicesList.length === 0) {
      alert("Nessuna fattura presente.")
      return
    }
    setInvoiceActionType('edit')
    setTargetInvoiceId(invoicesList[0].id)
    setIsSelectInvoiceModalOpen(true)
    setInvoiceMenuOpen(false)
  }

  function openSelectInvoiceForDelete() {
    if (invoicesList.length === 0) {
      alert("Nessuna fattura presente.")
      return
    }
    setInvoiceActionType('delete')
    setTargetInvoiceId(invoicesList[0].id)
    setIsSelectInvoiceModalOpen(true)
    setInvoiceMenuOpen(false)
  }

  async function handleConfirmInvoiceSelection(e) {
    e.preventDefault()
    if (!targetInvoiceId) return

    const found = invoicesList.find(i => i.id === targetInvoiceId)
    if (!found) return

    if (invoiceActionType === 'edit') {
      setIsSelectInvoiceModalOpen(false)
      openEditModal(found)
    } else if (invoiceActionType === 'delete') {
      const yearFromDate = found.issuedate ? found.issuedate.substring(0, 4) : ''
      const displayNum = found.invoicenumber && yearFromDate ? `${found.invoicenumber}/${yearFromDate}` : found.invoicenumber
      
      if (confirm(`Sei sicuro di voler eliminare la fattura numero ${displayNum}?`)) {
        const { error } = await supabaseClient.from('invoices').delete().eq('id', found.id)
        if (error) {
          alert("Errore durante l'eliminazione: " + error.message)
        } else {
          alert("Fattura eliminata con successo.")
          loadInvoices()
          loadYears()
          loadAllInvoicesForManagement()
        }
        setIsSelectInvoiceModalOpen(false)
      }
    }
  }

  // Calcoli per il prospetto generale (Gestione) basato su TUTTI i dati del database
  function calculateGeneralManagementSummary() {
    const generalByYear = {}
    let totalCount = 0
    let totalTaxable = 0
    let totalVat = 0
    let totalIncasso = 0

    allInvoicesList.forEach(item => {
      if (!item.issuedate) return
      const year = item.issuedate.substring(0, 4)
      const tax = Number(item.taxableamount) || 0
      const vat = Number(item.vatamount) || 0
      const tot = Number(item.totalamount) || 0

      if (!generalByYear[year]) {
        generalByYear[year] = { count: 0, taxable: 0, vat: 0, total: 0 }
      }
      generalByYear[year].count += 1
      generalByYear[year].taxable += tax
      generalByYear[year].vat += vat
      generalByYear[year].total += tot

      totalCount += 1
      totalTaxable += tax
      totalVat += vat
      totalIncasso += tot
    })

    const allGeneralYears = Object.keys(generalByYear)
    return {
      generalByYear,
      allGeneralYears,
      totals: { count: totalCount, taxable: totalTaxable, vat: totalVat, total: totalIncasso }
    }
  }

  const { generalByYear, allGeneralYears, totals: generalTotals } = calculateGeneralManagementSummary()
  const sortedGeneralYears = [...allGeneralYears].sort((a, b) => Number(b) - Number(a))

  // Calcoli per il prospetto cliente
  function calculateProspectSummary() {
    const paidByYear = {}
    const unpaidByYear = {}

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
    loadAllInvoicesForManagement()
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
            
            .print-hide { display: none !important; }

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
          
          {/* Header con menu a tendina e pulsante Gestione */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl relative z-20">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Gestionale Fatture</h1>
              <p className="text-slate-400 text-sm mt-1">Gestisci, filtra ed emetti le tue fatture in modo semplice</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Menu a tendina CLIENTE */}
              <div className="relative">
                <button 
                  onClick={() => { setClientMenuOpen(!clientMenuOpen); setInvoiceMenuOpen(false); }}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg transition-all duration-200 border border-slate-600 text-sm"
                >
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Cliente ▾
                </button>
                {clientMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-30">
                    <button onClick={openAddClientModal} className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 hover:text-white">Aggiungi</button>
                    <button onClick={openSelectClientForEdit} className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 hover:text-white">Modifica</button>
                    <button onClick={openSelectClientForDelete} className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-slate-800 hover:text-rose-300">Cancella</button>
                  </div>
                )}
              </div>

              {/* Menu a tendina FATTURE */}
              <div className="relative">
                <button 
                  onClick={() => { setInvoiceMenuOpen(!invoiceMenuOpen); setClientMenuOpen(false); }}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg transition-all duration-200 border border-slate-600 text-sm"
                >
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Fatture ▾
                </button>
                {invoiceMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-30">
                    <button onClick={handleAddInvoiceAction} className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 hover:text-white">Aggiungi</button>
                    <button onClick={openSelectInvoiceForEdit} className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 hover:text-white">Modifica</button>
                    <button onClick={openSelectInvoiceForDelete} className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-slate-800 hover:text-rose-300">Cancella</button>
                  </div>
                )}
              </div>

              {/* Pulsante Gestione */}
              <button 
                onClick={() => setIsManagementOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Gestione
              </button>

              <button 
                onClick={() => setIsProspectOpen(true)}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg transition-all duration-200 border border-slate-600 text-sm"
              >
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 4v12l-4-2-4 2V4M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Prospetto Cliente
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

        {/* Modal Gestione (Prospetto Generale & Grafico) */}
        {isManagementOpen && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-5xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              
              <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Prospetto Generale di Gestione</h2>
                  <p className="text-slate-400 text-sm mt-1">Riepilogo finanziario complessivo di tutte le fatture nel database suddiviso per anno</p>
                </div>
                <button 
                  onClick={() => setIsManagementOpen(false)} 
                  className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                >
                  ✕ Chiudi
                </button>
              </div>

              {/* Tabella Prospetto Generale */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 shadow-inner space-y-3">
                <h3 className="text-indigo-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span> Totali per Anno di Emissione
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-3 px-4">Anno</th>
                        <th className="py-3 px-4 text-center">N° Fatture</th>
                        <th className="py-3 px-4 text-right">Imponibile</th>
                        <th className="py-3 px-4 text-right">IVA</th>
                        <th className="py-3 px-4 text-right">Incasso Totale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {sortedGeneralYears.map(year => {
                        const data = generalByYear[year]
                        return (
                          <tr key={`general-${year}`} className="hover:bg-slate-800/50">
                            <td className="py-3 px-4 font-semibold text-white">{year}</td>
                            <td className="py-3 px-4 text-center text-slate-300">{data.count}</td>
                            <td className="py-3 px-4 text-right text-slate-300">€ {data.taxable.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="py-3 px-4 text-right text-slate-300">€ {data.vat.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-400">€ {data.total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-indigo-500/40 bg-slate-950/60 font-bold">
                        <td className="py-3 px-4 text-white uppercase text-xs">Totale Generale</td>
                        <td className="py-3 px-4 text-center text-white">{generalTotals.count}</td>
                        <td className="py-3 px-4 text-right text-slate-200">€ {generalTotals.taxable.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-right text-slate-200">€ {generalTotals.vat.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-right text-emerald-400">€ {generalTotals.total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Grafico a linee (Imponibile per Anno) */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 shadow-inner space-y-3">
                <h3 className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span> Andamento Imponibile per Anno
                </h3>
                <div className="h-72 relative w-full">
                  <canvas ref={chartRef}></canvas>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Modal Selezione Cliente per Modifica/Cancella */}
        {isSelectClientModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <h2 className="text-xl font-bold text-white">
                  {clientActionType === 'edit' ? 'Seleziona Cliente da Modificare' : 'Seleziona Cliente da Eliminare'}
                </h2>
                <button onClick={() => setIsSelectClientModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleConfirmClientSelection} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cliente</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={targetClientId}
                    onChange={(e) => setTargetClientId(e.target.value)}
                    required
                  >
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <button 
                    type="button" 
                    onClick={() => setIsSelectClientModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                  >
                    Annulla
                  </button>
                  <button 
                    type="submit" 
                    className={`px-5 py-2.5 rounded-xl font-semibold text-white shadow-lg transition-all ${clientActionType === 'delete' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'}`}
                  >
                    {clientActionType === 'edit' ? 'Avanti' : 'Elimina Cliente'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Selezione Fattura per Modifica/Cancella */}
        {isSelectInvoiceModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <h2 className="text-xl font-bold text-white">
                  {invoiceActionType === 'edit' ? 'Seleziona Fattura da Modificare' : 'Seleziona Fattura da Eliminare'}
                </h2>
                <button onClick={() => setIsSelectInvoiceModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleConfirmInvoiceSelection} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Fattura</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={targetInvoiceId}
                    onChange={(e) => setTargetInvoiceId(e.target.value)}
                    required
                  >
                    {invoicesList.map((i) => {
                      const yearFromDate = i.issuedate ? i.issuedate.substring(0, 4) : ''
                      const displayNum = i.invoicenumber && yearFromDate ? `${i.invoicenumber}/${yearFromDate}` : i.invoicenumber
                      const clientName = i.clients?.name || 'Cliente sconosciuto'
                      return (
                        <option key={i.id} value={i.id}>
                          N° {displayNum} - {clientName} ({formatDateToIT(i.issuedate)})
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <button 
                    type="button" 
                    onClick={() => setIsSelectInvoiceModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                  >
                    Annulla
                  </button>
                  <button 
                    type="submit" 
                    className={`px-5 py-2.5 rounded-xl font-semibold text-white shadow-lg transition-all ${invoiceActionType === 'delete' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'}`}
                  >
                    {invoiceActionType === 'edit' ? 'Avanti' : 'Elimina Fattura'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Aggiungi/Modifica Cliente */}
        {isClientModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <h2 className="text-xl font-bold text-white">{isClientEditMode ? 'Modifica Cliente' : 'Nuovo Cliente'}</h2>
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
                    {isClientEditMode ? 'Salva Modifiche' : 'Salva Cliente'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Prospetto Cliente */}
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

                  {/* Sezione Filtri Anno e Stato per l'Elenco Fatture del Prospetto (Nascosto in stampa) */}
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

                  {/* Tabella Dettaglio Fatture INTERATTIVA a schermo (Filtri applicati dall'utente) */}
                  <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden no-print">
                    <div className="p-3 bg-slate-950 font-bold text-xs uppercase tracking-wider text-slate-300 hidden print:block">
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
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Tabella Dettaglio Fatture ESCLUSIVA per la STAMPA (Mostra SEMPRE e SOLO le NON PAGATE) */}
                  <div className="hidden print:block bg-white rounded-xl overflow-hidden mt-4">
                    <div className="print-sub-title">
                      ELENCO FATTURE NON PAGATE
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-black">
                            <th className="py-2 px-3">Data Emissione</th>
                            <th className="py-2 px-3">N° Fattura</th>
                            <th className="py-2 px-3 text-right">Imponibile</th>
                            <th className="py-2 px-3 text-right">IVA</th>
                            <th className="py-2 px-3 text-right">Incasso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300">
                          {prospectInvoices.filter(item => !item.paymentdate).map((item) => {
                            const yearFromDate = item.issuedate ? item.issuedate.substring(0, 4) : ''
                            const displayInvoiceNum = item.invoicenumber && yearFromDate ? `${item.invoicenumber}/${yearFromDate}` : item.invoicenumber

                            return (
                              <tr key={`print-unpaid-${item.id}`}>
                                <td className="py-2 px-3">{formatDateToIT(item.issuedate)}</td>
                                <td className="py-2 px-3 font-bold">{displayInvoiceNum}</td>
                                <td className="py-2 px-3 text-right">€ {Number(item.taxableamount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="py-2 px-3 text-right">€ {Number(item.vatamount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="py-2 px-3 text-right font-bold">€ {Number(item.totalamount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </tr>
                            )
                          })}
                          {prospectInvoices.filter(item => !item.paymentdate).length === 0 && (
                            <tr>
                              <td colSpan="5" className="py-4 text-center text-slate-500">Nessuna fattura non pagata presente per questo cliente.</td>
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
