import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import Head from 'next/head'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseClient = createClient(supabaseUrl, supabaseKey)

export default function ServicesDashboard() {
  const [servicesList, setServicesList] = useState([])
  const [clientsList, setClientsList] = useState([])
  const [cpaDatabase, setCpaDatabase] = useState([])

  // Filtro per Cliente selezionato ('ALL' oppure l'ID del cliente)
  const [selectedClientId, setSelectedClientId] = useState('ALL')
  const [showClientMenu, setShowClientMenu] = useState(false)
  const [clientFilterSearch, setClientFilterSearch] = useState('')
  const clientMenuRef = useRef(null)

  // Stato per la nota univoca del cliente selezionato
  const [clientNote, setClientNote] = useState('')

  // Filtro per Codice CPA Globale ("Ricerca")
  const [selectedCpaFilter, setSelectedCpaFilter] = useState('ALL')
  const [showCpaSearchMenu, setShowCpaSearchMenu] = useState(false)
  const [cpaMenuSearchQuery, setCpaMenuSearchQuery] = useState('')
  const cpaSearchMenuRef = useRef(null)

  // Stati Modale Inserimento/Modifica Servizio
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentServiceId, setCurrentServiceId] = useState(null)

  // Campi del form Servizio
  const [clientId, setClientId] = useState('')
  const [thirdPartyName, setThirdPartyName] = useState('')
  const [isVendor, setIsVendor] = useState(false)
  const [serviceDescription, setServiceDescription] = useState('')
  const [cpaCode, setCpaCode] = useState('')
  const [delivery, setDelivery] = useState('I')
  const [collectionType, setCollectionType] = useState('R')

  // Stato per il Dropdown CPA nel form Servizi
  const [cpaSearchQuery, setCpaSearchQuery] = useState('')
  const [showCpaDropdown, setShowCpaDropdown] = useState(false)
  const cpaRef = useRef(null)

  // Stato per l'Autocomplete del Cliente nel form Servizi
  const [formClientSearch, setFormClientSearch] = useState('')
  const [showFormClientDropdown, setShowFormClientDropdown] = useState(false)
  const formClientRef = useRef(null)

  useEffect(() => {
    loadClients()
    loadServices()
    loadCpaCodes()

    function handleClickOutside(event) {
      if (cpaRef.current && !cpaRef.current.contains(event.target)) {
        setShowCpaDropdown(false)
      }
      if (formClientRef.current && !formClientRef.current.contains(event.target)) {
        setShowFormClientDropdown(false)
      }
      if (clientMenuRef.current && !clientMenuRef.current.contains(event.target)) {
        setShowClientMenu(false)
      }
      if (cpaSearchMenuRef.current && !cpaSearchMenuRef.current.contains(event.target)) {
        setShowCpaSearchMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Carica le note quando cambia il cliente selezionato
  useEffect(() => {
    if (selectedClientId === 'ALL') {
      setClientNote('')
    } else {
      const currentClient = clientsList.find(c => c.id === selectedClientId)
      setClientNote(currentClient?.note || '')
    }
  }, [selectedClientId, clientsList])

  async function loadClients() {
    const { data, error } = await supabaseClient
      .from('clients')
      .select('id, name, note')
      .order('name', { ascending: true })
    if (!error && data) {
      setClientsList(data)
      if (selectedClientId && selectedClientId !== 'ALL') {
        const currentClient = data.find(c => c.id === selectedClientId)
        if (currentClient) setClientNote(currentClient.note || '')
      }
    }
  }

  async function loadServices() {
    const { data, error } = await supabaseClient
      .from('services')
      .select('id, clientid, thirdpartyname, isvendor, servicedescription, cpacode, delivery, collectiontype, clients(name)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setServicesList(data)
    }
  }

  async function loadCpaCodes() {
    const { data, error } = await supabaseClient
      .from('cpacodes')
      .select('code, description')
      .order('code', { ascending: true })
      .range(0, 4999)

    if (!error && data) {
      setCpaDatabase(data)
    }
  }

  // --- GESTIONE NOTE CLIENTE ---
  async function handleSaveClientNote() {
    if (selectedClientId === 'ALL') return

    const { error } = await supabaseClient
      .from('clients')
      .update({ note: clientNote && clientNote.trim() !== '' ? clientNote : null })
      .eq('id', selectedClientId)

    if (!error) {
      loadClients()
    }
  }

  // --- GESTIONE SERVIZI ---
  function openInsertModal() {
    setIsEditMode(false)
    setCurrentServiceId(null)
    setClientId('')
    setFormClientSearch('')
    setShowFormClientDropdown(false)
    setThirdPartyName('')
    setIsVendor(false)
    setServiceDescription('')
    setCpaCode('')
    setCpaSearchQuery('')
    setShowCpaDropdown(false)
    setDelivery('I')
    setCollectionType('A')
    setIsModalOpen(true)
  }

  function openEditModal(service) {
    setIsEditMode(true)
    setCurrentServiceId(service.id)
    setClientId(service.clientid)
    
    const matchedClient = clientsList.find(c => c.id === service.clientid)
    setFormClientSearch(matchedClient ? matchedClient.name : '')
    setShowFormClientDropdown(false)

    setThirdPartyName(service.thirdpartyname || '')
    setIsVendor(service.isvendor)
    setServiceDescription(service.servicedescription)
    setCpaCode(service.cpacode)
    setCpaSearchQuery(service.cpacode)
    setShowCpaDropdown(false)
    setDelivery(service.delivery)
    setCollectionType(service.collectiontype)
    setIsModalOpen(true)
  }

  function handleSelectCpaItem(item) {
    setCpaCode(item.code)
    setCpaSearchQuery(item.code)
    setShowCpaDropdown(false)
    setServiceDescription(item.description)
  }

  async function handleSaveService(e) {
    e.preventDefault()

    if (!clientId) {
      alert("Seleziona un cliente valido dall'elenco dei suggerimenti.")
      return
    }

    const payload = {
      clientid: clientId,
      thirdpartyname: thirdPartyName.trim(),
      isvendor: isVendor,
      servicedescription: serviceDescription.trim(),
      cpacode: cpaCode.trim(),
      delivery,
      collectiontype: collectionType
    }

    if (isEditMode) {
      const { error } = await supabaseClient
        .from('services')
        .update(payload)
        .eq('id', currentServiceId)

      if (error) {
        alert("Errore durante l'aggiornamento: " + error.message)
        return
      }
    } else {
      const { error } = await supabaseClient
        .from('services')
        .insert([payload])

      if (error) {
        alert("Errore durante l'inserimento: " + error.message)
        return
      }
    }

    setIsModalOpen(false)
    loadServices()
  }

  const filteredCpaList = cpaDatabase.filter(item => 
    item.code.toLowerCase().includes(cpaSearchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(cpaSearchQuery.toLowerCase())
  )

  const filteredCpaSearchMenu = cpaDatabase.filter(item =>
    item.code.toLowerCase().includes(cpaMenuSearchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(cpaMenuSearchQuery.toLowerCase())
  )

  const filteredClientsList = clientsList.filter(client =>
    client.name.toLowerCase().includes(clientFilterSearch.toLowerCase())
  )

  const filteredFormClientsList = clientsList.filter(client =>
    client.name.toLowerCase().includes(formClientSearch.toLowerCase())
  )

  // --- FILTRAGGIO GLOBALE SERVIZI ---
  let displayedServices = selectedClientId === 'ALL' 
    ? servicesList 
    : servicesList.filter(s => s.clientid === selectedClientId)

  if (selectedCpaFilter !== 'ALL') {
    displayedServices = displayedServices.filter(s => s.cpacode === selectedCpaFilter)
  }

  // Ordinamento alfabetico per Cliente/Fornitore (thirdpartyname)
  const sortedServices = [...displayedServices].sort((a, b) => 
    (a.thirdpartyname || '').localeCompare(b.thirdpartyname || '', undefined, { sensitivity: 'base' })
  )

  const salesServices = sortedServices.filter(s => !s.isvendor)
  const purchaseServices = sortedServices.filter(s => s.isvendor)

  const currentSelectedClientName = selectedClientId === 'ALL' 
    ? 'Tutti i Clienti' 
    : clientsList.find(c => c.id === selectedClientId)?.name || 'Cliente'

  const currentSelectedCpaName = selectedCpaFilter === 'ALL'
    ? 'Tutti i Codici'
    : selectedCpaFilter

  return (
    <>
      <Head>
        <title>Gestione Servizi - Studio Guerriero S.R.L.</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>

      {/* Sfondo stile foglio di calcolo / Excel */}
      <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-3 sm:p-5">
        <div className="max-w-[98%] mx-auto space-y-4">
          
          {/* Header Principale in stile Toolbar Excel */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 rounded border border-slate-300 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-sm tracking-wider font-mono">EXCEL</div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">Gestione Servizi</h1>
                <p className="text-slate-500 text-xs">
                  Filtri attivi: <span className="font-semibold text-slate-700">{currentSelectedClientName}</span> | CPA: <span className="font-semibold text-slate-700">{currentSelectedCpaName}</span>
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              
              {/* Menu a Scomparsa "Cliente" */}
              <div className="relative" ref={clientMenuRef}>
                <button 
                  onClick={() => setShowClientMenu(!showClientMenu)}
                  className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded border border-slate-300 text-xs font-medium shadow-xs"
                >
                  <span>👤 Cliente:</span>
                  <span className="font-bold">{selectedClientId === 'ALL' ? 'Tutti ▾' : `${currentSelectedClientName} ▾`}</span>
                </button>

                {showClientMenu && (
                  <div className="absolute right-0 mt-1 w-72 bg-white border border-slate-300 rounded shadow-lg p-2 z-50 space-y-2">
                    <button 
                      onClick={() => { setSelectedClientId('ALL'); setShowClientMenu(false); setClientFilterSearch(''); }}
                      className="w-full text-left px-2 py-1 text-xs text-emerald-700 font-bold hover:bg-emerald-50 rounded border border-emerald-200 text-center"
                    >
                      Mostra Tutti i Clienti
                    </button>
                    
                    <input 
                      type="text" 
                      className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 text-xs outline-none focus:border-emerald-600"
                      placeholder="Cerca cliente..."
                      value={clientFilterSearch}
                      onChange={(e) => setClientFilterSearch(e.target.value)}
                    />

                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                      {filteredClientsList.map(client => (
                        <div 
                          key={client.id}
                          onClick={() => { setSelectedClientId(client.id); setShowClientMenu(false); setClientFilterSearch(''); }}
                          className="p-1.5 hover:bg-slate-100 cursor-pointer text-xs text-slate-700 truncate"
                          title={client.name}
                        >
                          {client.name}
                        </div>
                      ))}
                      {filteredClientsList.length === 0 && (
                        <div className="p-2 text-xs text-slate-400 italic text-center">Nessun cliente trovato.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Menu a Scomparsa "Ricerca" CPA */}
              <div className="relative" ref={cpaSearchMenuRef}>
                <button 
                  onClick={() => setShowCpaSearchMenu(!showCpaSearchMenu)}
                  className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded border border-slate-300 text-xs font-medium shadow-xs"
                >
                  <span>🔍 CPA:</span>
                  <span className="font-bold">{selectedCpaFilter === 'ALL' ? 'Tutti ▾' : `${selectedCpaFilter} ▾`}</span>
                </button>

                {showCpaSearchMenu && (
                  <div className="absolute right-0 mt-1 w-80 bg-white border border-slate-300 rounded shadow-lg p-2 z-50 space-y-2">
                    <button 
                      onClick={() => { setSelectedCpaFilter('ALL'); setShowCpaSearchMenu(false); }}
                      className="w-full text-left px-2 py-1 text-xs text-emerald-700 font-bold hover:bg-emerald-50 rounded border border-emerald-200 text-center"
                    >
                      Mostra Tutti i Codici CPA
                    </button>
                    
                    <input 
                      type="text" 
                      className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 text-xs outline-none focus:border-emerald-600 font-mono"
                      placeholder="Cerca codice o descrizione..."
                      value={cpaMenuSearchQuery}
                      onChange={(e) => setCpaMenuSearchQuery(e.target.value)}
                    />

                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {filteredCpaSearchMenu.map(item => (
                        <div 
                          key={item.code}
                          onClick={() => { setSelectedCpaFilter(item.code); setShowCpaSearchMenu(false); }}
                          className="p-1.5 hover:bg-slate-100 cursor-pointer text-xs"
                        >
                          <span className="font-bold text-emerald-700 font-mono mr-2">{item.code}</span>
                          <span className="text-slate-600 line-clamp-1">{item.description}</span>
                        </div>
                      ))}
                      {filteredCpaSearchMenu.length === 0 && (
                        <div className="p-2 text-xs text-slate-400 italic text-center">Nessun codice trovato.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={openInsertModal}
                className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded font-semibold text-xs shadow-xs transition-colors"
              >
                + Inserisci Servizio
              </button>
            </div>
          </div>

          {/* Campo Note Cliente a tutta larghezza (visibile se è selezionato un cliente specifico) */}
          {selectedClientId !== 'ALL' && (
            <div className="bg-white p-3 rounded border border-slate-300 shadow-sm space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                📝 Note per il cliente: <span className="text-emerald-800">{currentSelectedClientName}</span>
              </label>
              <textarea 
                rows={5}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 text-slate-800 text-xs focus:bg-white focus:border-emerald-600 outline-none"
                placeholder="Inserisci note univoche associate a questo cliente..."
                value={clientNote}
                onChange={(e) => setClientNote(e.target.value)}
                onBlur={handleSaveClientNote}
              />
              <p className="text-[10px] text-slate-400 italic">Le modifiche vengono salvate automaticamente uscendo dal campo.</p>
            </div>
          )}

          {/* SEZIONE VENDITE */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
                <span>🟢 TABELLA VENDITE</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300 normal-case font-normal">
                  Fornitore: Cliente
                </span>
              </h2>
              <span className="text-xs text-slate-500 font-mono">Righe: {salesServices.length}</span>
            </div>

            <div className="bg-white border border-slate-300 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-300 text-slate-700 font-semibold uppercase tracking-wider">
                      <th className="py-1.5 px-3 border-r border-slate-300 w-1/6">Cliente</th>
                      <th className="py-1.5 px-3 border-r border-slate-300 w-1/6">Cliente / Fornitore</th>
                      <th className="py-1.5 px-3 border-r border-slate-300">Descrizione Servizio</th>
                      <th className="py-1.5 px-3 border-r border-slate-300 w-28 text-center">Codice CPA</th>
                      <th className="py-1.5 px-3 border-r border-slate-300 w-24 text-center">Erogazione</th>
                      <th className="py-1.5 px-3 border-r border-slate-300 w-24 text-center">Incasso</th>
                      <th className="py-1.5 px-3 text-center w-20">Azione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {salesServices.map((item, idx) => (
                      <tr 
                        key={item.id} 
                        className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-emerald-50/50 transition-colors`}
                      >
                        <td className="py-1.5 px-3 border-r border-slate-200 font-medium text-slate-900 truncate">
                          {item.clients?.name || 'Sconosciuto'}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-slate-700 font-semibold">
                          {item.thirdpartyname || '-'}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-slate-600 truncate max-w-md" title={item.servicedescription}>
                          {item.servicedescription}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-800">
                          {item.cpacode}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-semibold text-slate-700">
                          {item.delivery}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-semibold text-slate-700">
                          {item.collectiontype}
                        </td>
                        <td className="py-1 px-2 text-center">
                          <button 
                            onClick={() => openEditModal(item)}
                            className="bg-slate-100 hover:bg-amber-100 text-amber-800 hover:text-amber-900 px-2 py-0.5 rounded border border-amber-300 text-[11px] font-medium transition-colors"
                          >
                            Modifica
                          </button>
                        </td>
                      </tr>
                    ))}
                    {salesServices.length === 0 && (
                      <tr>
                        <td colSpan="7" className="py-4 text-center text-slate-400 italic">
                          Nessun record disponibile per i filtri selezionati.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SEZIONE ACQUISTI */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-2">
                <span>🟠 TABELLA ACQUISTI</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300 normal-case font-normal">
                  Acquirente: Cliente
                </span>
              </h2>
              <span className="text-xs text-slate-500 font-mono">Righe: {purchaseServices.length}</span>
            </div>

            <div className="bg-white border border-slate-300 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-300 text-slate-700 font-semibold uppercase tracking-wider">
                      <th className="py-1.5 px-3 border-r border-slate-300 w-1/6">Cliente</th>
                      <th className="py-1.5 px-3 border-r border-slate-300 w-1/6">Cliente / Fornitore</th>
                      <th className="py-1.5 px-3 border-r border-slate-300">Descrizione Servizio</th>
                      <th className="py-1.5 px-3 border-r border-slate-300 w-28 text-center">Codice CPA</th>
                      <th className="py-1.5 px-3 border-r border-slate-300 w-24 text-center">Erogazione</th>
                      <th className="py-1.5 px-3 border-r border-slate-300 w-24 text-center">Incasso</th>
                      <th className="py-1.5 px-3 text-center w-20">Azione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {purchaseServices.map((item, idx) => (
                      <tr 
                        key={item.id} 
                        className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-amber-50/50 transition-colors`}
                      >
                        <td className="py-1.5 px-3 border-r border-slate-200 font-medium text-slate-900 truncate">
                          {item.clients?.name || 'Sconosciuto'}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-slate-700 font-semibold">
                          {item.thirdpartyname || '-'}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-slate-600 truncate max-w-md" title={item.servicedescription}>
                          {item.servicedescription}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-800">
                          {item.cpacode}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-semibold text-slate-700">
                          {item.delivery}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-semibold text-slate-700">
                          {item.collectiontype}
                        </td>
                        <td className="py-1 px-2 text-center">
                          <button 
                            onClick={() => openEditModal(item)}
                            className="bg-slate-100 hover:bg-amber-100 text-amber-800 hover:text-amber-900 px-2 py-0.5 rounded border border-amber-300 text-[11px] font-medium transition-colors"
                          >
                            Modifica
                          </button>
                        </td>
                      </tr>
                    ))}
                    {purchaseServices.length === 0 && (
                      <tr>
                        <td colSpan="7" className="py-4 text-center text-slate-400 italic">
                          Nessun record disponibile per i filtri selezionati.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Form Inserimento/Modifica Servizio Stile Dialog Excel */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 z-50 overflow-y-auto">
            <div className="bg-white border border-slate-400 rounded shadow-2xl max-w-lg w-full space-y-4 p-5">
              
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  {isEditMode ? '✏️ Modifica Scheda Servizio' : '➕ Nuova Scheda Servizio'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm">✕</button>
              </div>

              <form onSubmit={handleSaveService} className="space-y-3 text-xs">
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Selezione Cliente */}
                  <div className="relative" ref={formClientRef}>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">CLIENTE *</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:bg-white focus:border-emerald-600 outline-none"
                      value={formClientSearch}
                      onChange={(e) => {
                        setFormClientSearch(e.target.value)
                        setShowFormClientDropdown(true)
                        setClientId('')
                      }}
                      onFocus={() => setShowFormClientDropdown(true)}
                      placeholder="Cerca cliente..."
                    />

                    {showFormClientDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-40 overflow-y-auto z-[100] divide-y divide-slate-100">
                        {filteredFormClientsList.map(c => (
                          <div 
                            key={c.id}
                            onClick={() => {
                              setClientId(c.id)
                              setFormClientSearch(c.name)
                              setShowFormClientDropdown(false)
                            }}
                            className="p-2 hover:bg-emerald-50 cursor-pointer text-slate-700"
                          >
                            {c.name}
                          </div>
                        ))}
                        {filteredFormClientsList.length === 0 && (
                          <div className="p-2 text-slate-400 italic">Nessun cliente trovato.</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">CLIENTE/FORNITORE *</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:bg-white focus:border-emerald-600 outline-none"
                      value={thirdPartyName}
                      onChange={(e) => setThirdPartyName(e.target.value)}
                      placeholder="Nome controparte..."
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">TIPOLOGIA SERVIZIO *</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:bg-white focus:border-emerald-600 outline-none font-medium"
                    value={isVendor ? 'true' : 'false'}
                    onChange={(e) => setIsVendor(e.target.value === 'true')}
                  >
                    <option value="false">Servizio in Vendita</option>
                    <option value="true">Servizio in Acquisto (Fornitore)</option>
                  </select>
                </div>

                {/* Selezione Codice CPA */}
                <div className="relative" ref={cpaRef}>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">CODICE CPA *</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:bg-white focus:border-emerald-600 outline-none font-mono"
                    value={cpaSearchQuery}
                    onClick={() => setShowCpaDropdown(true)}
                    onChange={(e) => {
                      setCpaSearchQuery(e.target.value)
                      setCpaCode(e.target.value)
                      setShowCpaDropdown(true)
                    }}
                    placeholder="Digita codice CPA..."
                    required
                  />

                  {showCpaDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-48 overflow-y-auto z-[100] divide-y divide-slate-100">
                      {filteredCpaList.map((item) => (
                        <div 
                          key={item.code} 
                          onClick={() => handleSelectCpaItem(item)}
                          className="p-2 hover:bg-emerald-50 cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold text-emerald-700 font-mono mr-2">{item.code}</span>
                            <span className="text-slate-600">{item.description}</span>
                          </div>
                        </div>
                      ))}
                      {filteredCpaList.length === 0 && (
                        <div className="p-2 text-slate-400 italic">Nessun codice trovato.</div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">DESCRIZIONE SERVIZIO *</label>
                  <textarea 
                    rows="2"
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:bg-white focus:border-emerald-600 outline-none"
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    placeholder="Descrizione dettagliata..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">EROGAZIONE (I / R) *</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:bg-white focus:border-emerald-600 outline-none font-medium"
                      value={delivery}
                      onChange={(e) => setDelivery(e.target.value)}
                      required
                    >
                      <option value="I">I (Immediata / Interna)</option>
                      <option value="R">R (Rilasciata / Remota)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">INCASSO (A / B / X) *</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 focus:bg-white focus:border-emerald-600 outline-none font-medium"
                      value={collectionType}
                      onChange={(e) => setCollectionType(e.target.value)}
                      required
                    >
                      <option value="A">A (Rimessa diretta)</option>
                      <option value="B">B (Bonifico bancario)</option>
                      <option value="X">X (Altro)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                  >
                    Annulla
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs transition-colors"
                  >
                    Salva
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
