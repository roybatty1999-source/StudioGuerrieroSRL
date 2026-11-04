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
  const clientMenuRef = useRef(null)

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

  useEffect(() => {
    loadClients()
    loadServices()
    loadCpaCodes()

    function handleClickOutside(event) {
      if (cpaRef.current && !cpaRef.current.contains(event.target)) {
        setShowCpaDropdown(false)
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

  async function loadClients() {
    const { data, error } = await supabaseClient
      .from('clients')
      .select('id, name')
      .order('name', { ascending: true })
    if (!error && data) {
      setClientsList(data)
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

  // --- GESTIONE SERVIZI ---
  function openInsertModal() {
    setIsEditMode(false)
    setCurrentServiceId(null)
    setClientId(clientsList[0]?.id || '')
    setThirdPartyName('')
    setIsVendor(false)
    setServiceDescription('')
    setCpaCode('')
    setCpaSearchQuery('')
    setShowCpaDropdown(false)
    setDelivery('I')
    setCollectionType('R')
    setIsModalOpen(true)
  }

  function openEditModal(service) {
    setIsEditMode(true)
    setCurrentServiceId(service.id)
    setClientId(service.clientid)
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

  async function handleDeleteService(id) {
    if (confirm('Sei sicuro di voler eliminare questo servizio?')) {
      const { error } = await supabaseClient.from('services').delete().eq('id', id)
      if (error) {
        alert("Errore durante l'eliminazione: " + error.message)
      } else {
        loadServices()
      }
    }
  }

  function handleSelectCpaItem(item) {
    setCpaCode(item.code)
    setCpaSearchQuery(item.code)
    setShowCpaDropdown(false)
    setServiceDescription(item.description)
  }

  async function handleSaveService(e) {
    e.preventDefault()

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

  // --- FILTRAGGIO GLOBALE SERVIZI ---
  let displayedServices = selectedClientId === 'ALL' 
    ? servicesList 
    : servicesList.filter(s => s.clientid === selectedClientId)

  if (selectedCpaFilter !== 'ALL') {
    displayedServices = displayedServices.filter(s => s.cpacode === selectedCpaFilter)
  }

  const salesServices = displayedServices.filter(s => !s.isvendor)
  const purchaseServices = displayedServices.filter(s => s.isvendor)

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

      <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header Principale */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Gestione Servizi</h1>
              <p className="text-slate-400 text-sm mt-1">
                Cliente: <span className="text-indigo-400 font-semibold">{currentSelectedClientName}</span> | Codice CPA: <span className="text-indigo-400 font-semibold">{currentSelectedCpaName}</span>
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Menu a Scomparsa "Cliente" */}
              <div className="relative" ref={clientMenuRef}>
                <button 
                  onClick={() => setShowClientMenu(!showClientMenu)}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-semibold border border-slate-600 transition-all text-sm"
                >
                  👤 Cliente: {selectedClientId === 'ALL' ? 'Tutti ▾' : `${currentSelectedClientName} ▾`}
                </button>

                {showClientMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 max-h-60 overflow-y-auto">
                    <button 
                      onClick={() => { setSelectedClientId('ALL'); setShowClientMenu(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-indigo-400 font-bold hover:bg-indigo-600/35 transition-colors border-b border-slate-800"
                    >
                      🌐 Mostra Tutti i Clienti
                    </button>
                    {clientsList.map(client => (
                      <button 
                        key={client.id}
                        onClick={() => { setSelectedClientId(client.id); setShowClientMenu(false); }}
                        className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-indigo-600/30 transition-colors truncate"
                        title={client.name}
                      >
                        {client.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Menu a Scomparsa "Ricerca" CPA */}
              <div className="relative" ref={cpaSearchMenuRef}>
                <button 
                  onClick={() => setShowCpaSearchMenu(!showCpaSearchMenu)}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-semibold border border-slate-600 transition-all text-sm"
                >
                  🔍 Ricerca CPA: {selectedCpaFilter === 'ALL' ? 'Tutti ▾' : `${selectedCpaFilter} ▾`}
                </button>

                {showCpaSearchMenu && (
                  <div className="absolute right-0 mt-2 w-80 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 space-y-2">
                    <button 
                      onClick={() => { setSelectedCpaFilter('ALL'); setShowCpaSearchMenu(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-indigo-400 font-bold hover:bg-indigo-600/35 rounded-lg transition-colors border-b border-slate-800 mb-1"
                    >
                      🌐 Mostra Tutti i Codici CPA
                    </button>
                    
                    <input 
                      type="text" 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      placeholder="Cerca codice o descrizione..."
                      value={cpaMenuSearchQuery}
                      onChange={(e) => setCpaMenuSearchQuery(e.target.value)}
                    />

                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {filteredCpaSearchMenu.map(item => (
                        <div 
                          key={item.code}
                          onClick={() => { setSelectedCpaFilter(item.code); setShowCpaSearchMenu(false); }}
                          className="p-2 hover:bg-indigo-600/40 cursor-pointer text-xs rounded transition-colors"
                        >
                          <span className="font-bold text-indigo-400 font-mono mr-2">{item.code}</span>
                          <span className="text-slate-300 line-clamp-1">{item.description}</span>
                        </div>
                      ))}
                      {filteredCpaSearchMenu.length === 0 && (
                        <div className="p-2 text-xs text-slate-500 italic text-center">Nessun codice trovato.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={openInsertModal}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition-all text-sm"
              >
                + Nuovo Servizio
              </button>
            </div>
          </div>

          {/* SEZIONE VENDITE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                🟢 Vendite <span className="text-xs bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-emerald-300">Il cliente è fornitore</span>
              </h2>
              <span className="text-xs text-slate-400">Totale: {salesServices.length}</span>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/50 border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="py-3 px-6">Cliente</th>
                      <th className="py-3 px-6">Cliente/Fornitore</th>
                      <th className="py-3 px-6">Descrizione Servizio</th>
                      <th className="py-3 px-6">Codice CPA</th>
                      <th className="py-3 px-6 text-center">Erogazione</th>
                      <th className="py-3 px-6 text-center">Incasso</th>
                      <th className="py-3 px-6 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-sm">
                    {salesServices.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 px-6 font-medium text-white">
                          {item.clients?.name || 'Sconosciuto'}
                        </td>
                        <td className="py-3 px-6 text-slate-300">
                          {item.thirdpartyname || '-'}
                        </td>
                        <td className="py-3 px-6 text-slate-300 max-w-xs truncate" title={item.servicedescription}>
                          {item.servicedescription}
                        </td>
                        <td className="py-3 px-6 font-mono text-indigo-400 font-semibold">
                          {item.cpacode}
                        </td>
                        <td className="py-3 px-6 text-center font-bold text-slate-200">
                          {item.delivery}
                        </td>
                        <td className="py-3 px-6 text-center font-bold text-slate-200">
                          {item.collectiontype}
                        </td>
                        <td className="py-3 px-6 text-right space-x-2">
                          <button 
                            onClick={() => openEditModal(item)}
                            className="bg-slate-700 hover:bg-amber-600/80 text-amber-300 hover:text-white px-3 py-1.5 rounded-lg font-medium text-xs border border-amber-500/30 transition-all"
                          >
                            Modifica
                          </button>
                          <button 
                            onClick={() => handleDeleteService(item.id)}
                            className="bg-slate-700 hover:bg-rose-600/80 text-rose-300 hover:text-white px-3 py-1.5 rounded-lg font-medium text-xs border border-rose-500/30 transition-all"
                          >
                            Cancella
                          </button>
                        </td>
                      </tr>
                    ))}
                    {salesServices.length === 0 && (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500 font-medium text-xs">
                          Nessun servizio in vendita trovato per i filtri correnti.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SEZIONE ACQUISTI */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                🟠 Acquisti <span className="text-xs bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-amber-300">Il cliente è acquirente</span>
              </h2>
              <span className="text-xs text-slate-400">Totale: {purchaseServices.length}</span>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/50 border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="py-3 px-6">Cliente</th>
                      <th className="py-3 px-6">Cliente/Fornitore</th>
                      <th className="py-3 px-6">Descrizione Servizio</th>
                      <th className="py-3 px-6">Codice CPA</th>
                      <th className="py-3 px-6 text-center">Erogazione</th>
                      <th className="py-3 px-6 text-center">Incasso</th>
                      <th className="py-3 px-6 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-sm">
                    {purchaseServices.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 px-6 font-medium text-white">
                          {item.clients?.name || 'Sconosciuto'}
                        </td>
                        <td className="py-3 px-6 text-slate-300">
                          {item.thirdpartyname || '-'}
                        </td>
                        <td className="py-3 px-6 text-slate-300 max-w-xs truncate" title={item.servicedescription}>
                          {item.servicedescription}
                        </td>
                        <td className="py-3 px-6 font-mono text-indigo-400 font-semibold">
                          {item.cpacode}
                        </td>
                        <td className="py-3 px-6 text-center font-bold text-slate-200">
                          {item.delivery}
                        </td>
                        <td className="py-3 px-6 text-center font-bold text-slate-200">
                          {item.collectiontype}
                        </td>
                        <td className="py-3 px-6 text-right space-x-2">
                          <button 
                            onClick={() => openEditModal(item)}
                            className="bg-slate-700 hover:bg-amber-600/80 text-amber-300 hover:text-white px-3 py-1.5 rounded-lg font-medium text-xs border border-amber-500/30 transition-all"
                          >
                            Modifica
                          </button>
                          <button 
                            onClick={() => handleDeleteService(item.id)}
                            className="bg-slate-700 hover:bg-rose-600/80 text-rose-300 hover:text-white px-3 py-1.5 rounded-lg font-medium text-xs border border-rose-500/30 transition-all"
                          >
                            Cancella
                          </button>
                        </td>
                      </tr>
                    ))}
                    {purchaseServices.length === 0 && (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500 font-medium text-xs">
                          Nessun servizio in acquisto trovato per i filtri correnti.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Form Inserimento/Modifica Servizio */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6">
              
              <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <h2 className="text-xl font-bold text-white">
                  {isEditMode ? 'Modifica Servizio' : 'Nuovo Servizio'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleSaveService} className="space-y-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Cliente *</label>
                    <select 
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                    >
                      <option value="">Seleziona...</option>
                      {clientsList.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Cliente/Fornitore *</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={thirdPartyName}
                      onChange={(e) => setThirdPartyName(e.target.value)}
                      placeholder="Nome controparte..."
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tipologia Servizio *</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={isVendor ? 'true' : 'false'}
                    onChange={(e) => setIsVendor(e.target.value === 'true')}
                  >
                    <option value="false">Servizio in Vendita</option>
                    <option value="true">Servizio in Acquisto (Fornitore)</option>
                  </select>
                </div>

                {/* Selezione Codice CPA */}
                <div className="relative" ref={cpaRef}>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Codice CPA * (Cerca nel database)
                  </label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                    value={cpaSearchQuery}
                    onClick={() => setShowCpaDropdown(true)}
                    onChange={(e) => {
                      setCpaSearchQuery(e.target.value)
                      setCpaCode(e.target.value)
                      setShowCpaDropdown(true)
                    }}
                    placeholder="Digita codice o parola chiave..."
                    required
                  />

                  {showCpaDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-600 rounded-xl shadow-2xl max-h-52 overflow-y-auto z-[100] divide-y divide-slate-800">
                      {filteredCpaList.map((item) => (
                        <div 
                          key={item.code} 
                          onClick={() => handleSelectCpaItem(item)}
                          className="p-3 hover:bg-indigo-600/40 cursor-pointer text-xs transition-colors flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold text-indigo-400 font-mono mr-2">{item.code}</span>
                            <span className="text-slate-200">{item.description}</span>
                          </div>
                        </div>
                      ))}
                      {filteredCpaList.length === 0 && (
                        <div className="p-3 text-xs text-slate-400 italic">
                          Nessun codice trovato.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Descrizione Servizio *
                  </label>
                  <textarea 
                    rows="3"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    placeholder="Inserisci una descrizione dettagliata del servizio offerto o ricevuto..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Erogazione (I / R) *</label>
                    <select 
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={delivery}
                      onChange={(e) => setDelivery(e.target.value)}
                      required
                    >
                      <option value="I">I (Immediata / Interna)</option>
                      <option value="R">R (Rilasciata / Remota)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Incasso (R / B / X) *</label>
                    <select 
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={collectionType}
                      onChange={(e) => setCollectionType(e.target.value)}
                      required
                    >
                      <option value="R">R (Rimessa diretta)</option>
                      <option value="B">B (Bonifico bancario)</option>
                      <option value="X">X (Altro / Escluso)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-700 font-medium transition-colors text-sm"
                  >
                    Annulla
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all text-sm"
                  >
                    Salva Servizio
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
