import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

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
      .select('id, invoicenumber, clientid, issuedate, taxableamount, note, clients(name)')

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
    setInvoiceNotes('')
    setInvoiceDate(new Date().toISOString().split('T')[0])

    // Calcola il prossimo numero fattura in base all'anno attuale
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
    setInvoiceNotes(invoiceItem.note || '')
    setIsModalOpen(true)
  }

  async function handleSaveInvoice(event) {
    event.preventDefault()

    const invoicePayload = {
      invoicenumber: Number(invoiceNumber),
      clientid: selectedClientId,
      issuedate: invoiceDate,
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
        alert('Errore durante l\'inserimento: ' + error.message)
        return
      }
    }

    setIsModalOpen(false)
    loadInvoices()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-6">Gestione Fatture</h1>

      {/* Sezione Filtri e Pulsante Inserisci */}
      <div className="flex flex-wrap gap-4 mb-6 items-center justify-between bg-gray-50 p-4 rounded shadow-sm">
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Filtra per Cliente</label>
            <select 
              className="border p-2 rounded bg-white"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
            >
              <option value="">Tutti i clienti</option>
              {clientsList.map((clientItem) => (
                <option key={clientItem.id} value={clientItem.id}>
                  {clientItem.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Filtra per Anno</label>
            <input 
              type="text" 
              className="border p-2 rounded w-28 bg-white"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            />
          </div>
        </div>

        <button 
          onClick={openInsertModal}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold"
        >
          Inserisci Fattura
        </button>
      </div>

      {/* Tabella Visualizza Fatture */}
      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-3">N. Fattura</th>
              <th className="p-3">Data</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Imponibile (€)</th>
              <th className="p-3">Note</th>
              <th className="p-3">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {invoicesList.map((invoiceItem) => (
              <tr key={invoiceItem.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-semibold">{invoiceItem.invoicenumber}</td>
                <td className="p-3">{invoiceItem.issuedate}</td>
                <td className="p-3">{invoiceItem.clients?.name || 'Cliente sconosciuto'}</td>
                <td className="p-3">€ {Number(invoiceItem.taxableamount).toFixed(2)}</td>
                <td className="p-3 text-gray-600">{invoiceItem.note}</td>
                <td className="p-3">
                  <button 
                    onClick={() => openEditModal(invoiceItem)}
                    className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                  >
                    Modifica
                  </button>
                </td>
              </tr>
            ))}
            {invoicesList.length === 0 && (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-500">Nessuna fattura trovata.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pannello Modale Inserimento / Modifica */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
            <h2 className="text-xl font-bold mb-4">
              {isEditMode ? 'Modifica Fattura' : 'Inserisci Nuova Fattura'}
            </h2>

            <form onSubmit={handleSaveInvoice} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cliente</label>
                <select 
                  className="border p-2 rounded w-full"
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

              <div>
                <label className="block text-sm font-medium mb-1">Numero Fattura</label>
                <input 
                  type="number" 
                  className="border p-2 rounded w-full"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Imponibile (€)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="border p-2 rounded w-full"
                  value={taxableAmount}
                  onChange={(e) => setTaxableAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Data Emissione</label>
                <input 
                  type="date" 
                  className="border p-2 rounded w-full"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Note</label>
                <textarea 
                  className="border p-2 rounded w-full"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Annulla
                </button>
                <button 
                  type="submit" 
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
