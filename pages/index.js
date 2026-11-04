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

// Funzione per ottenere la data odierna in formato GG/MM/AAAA
function getCurrentDateIT() {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const year = today.getFullYear()
  return `${day}/${month}/${year}`
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
            margin: 8mm;
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
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
            }
            .no-print { display: none !important; }
            .print-hide { display: none !important; }

            /* Stile Intestazione Professionale Studio Guerriero */
            .print-header-container {
              display: flex !important;
              justify-content: space-between !important;
              align-items: flex-start !important;
              border-bottom: 3px solid #000000 !important;
              padding-bottom: 8px !important;
              margin-bottom: 12px !important;
              width: 100% !important;
            }
            .print-brand-box {
              display: flex !important;
              align-items: center !important;
              gap: 10px !important;
            }
            .print-logo {
              width: 48px !important;
              height: 48px !important;
              object-fit: contain !important;
            }
            .print-company-info {
              font-size: 10px !important;
              line-height: 1.3 !important;
              color: #000000 !important;
            }
            .print-company-name {
              font-weight: 900 !important;
              font-size: 12px !important;
            }
            .print-client-meta {
              text-align: right !important;
              font-size: 10px !important;
              line-height: 1.3 !important;
              color: #000000 !important;
            }
            .print-client-name-bold {
              font-weight: 900 !important;
              font-size: 12px !important;
            }
            
            .print-section-header {
              background-color: #334155 !important;
              color: white !important;
              font-size: 8.5px !important;
              font-weight: 800 !important;
              text-transform: uppercase !important;
              padding: 5px 8px !important;
              letter-spacing: 0.05em;
              margin-top: 8px !important;
              margin-bottom: 0px !important;
              border: 1px solid #1e293b !important;
            }

            .print-grid-tables {
              display: flex !important;
              flex-direction: row !important;
              gap: 8px !important;
              width: 100% !important;
              margin-bottom: 6px !important;
              page-break-inside: avoid;
            }
            .print-table-column {
              flex: 1 !important;
              width: 50% !important;
            }

            table {
              width: 100% !important;
              border-collapse: collapse !important;
              border: 1px solid #1e293b !important;
              margin-bottom: 0px !important;
              page-break-inside: avoid;
            }
            th, td {
              border: 1px solid #64748b !important;
              padding: 3px 5px !important;
              font-size: 8px !important;
              color: #0f172a !important;
              background: white !important;
            }
            th {
              background-color: #cbd5e1 !important;
              font-weight: bold !important;
              text-align: left;
              color: #0f172a !important;
              font-size: 7.5px !important;
            }
            tfoot tr td {
              background-color: #e2e8f0 !important;
              font-weight: bold !important;
              color: #0f172a !important;
            }
            .text-right { text-align: right !important; }
            .text-center { text-align: center !important; }
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
                  <option key={clientItem.id} value={clientItem.id}>{clientItem.name}</option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-48">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Anno</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="">Tutti gli anni</option>
                {availableYears.map((yearItem) => (
                  <option key={yearItem} value={yearItem}>{yearItem}</option>
                ))}
              </select>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
