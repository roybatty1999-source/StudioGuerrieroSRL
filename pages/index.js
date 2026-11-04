import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Head from 'next/head'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseClient = createClient(supabaseUrl, supabaseKey)

export default function ServicesDashboard() {
  const [servicesList, setServicesList] = useState([])
  const [clientsList, setClientsList] = useState([])

  // Stati Modale Inserimento/Modifica Servizio
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentServiceId, setCurrentServiceId] = useState(null)

  // Campi del form Servizio
  const [clientId, setClientId] = useState('')
  const [isVendor, setIsVendor] = useState(false) // false = Vendita, true = Acquisto
  const [serviceDescription, setServiceDescription] = useState('')
  const [cpaCode, setCpaCode] = useState('')
  const [delivery, setDelivery] = useState('I') // 'I' o 'R'
  const [collectionType, setCollectionType] = useState('R') // 'R', 'B' o 'X'

  useEffect(() => {
    loadClients()
    loadServices()
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
      .select('id, clientid, isvendor, servicedescription, cpacode, delivery, collectiontype, clients(name)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setServicesList(data)
    }
  }

  function openInsertModal() {
    setIsEditMode(false)
    setCurrentServiceId(null)
    setClientId(clientsList[0]?.id || '')
    setIsVendor(false)
    setServiceDescription('')
    setCpaCode('')
    setDelivery('I')
    setCollectionType('R')
    setIsModalOpen(true)
  }

  function openEditModal(service) {
    setIsEditMode(true)
    setCurrentServiceId(service.id)
    setClientId(service.clientid)
    setIsVendor(service.isvendor)
    setServiceDescription(service.servicedescription)
    setCpaCode(service.cpacode)
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

  async function handleSaveService(e) {
    e.preventDefault()

    if (serviceDescription.trim().length < 50) {
      alert('La descrizione del servizio deve contenere almeno 50 caratteri.')
      return
    }

    const payload = {
      clientid: clientId,
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

  return (
    <>
      <Head>
        <title>Gestione Servizi - Studio Guerriero S.R.L.</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>

      <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Intestazione */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Gestione Servizi</h1>
              <p className="text-slate-400 text-sm mt-1">Servizi in Acquisto e in Vendita associati ai Clienti/Fornitori</p>
            </div>
            <button 
              onClick={openInsertModal}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition-all text-sm"
            >
              + Nuovo Servizio
            </button>
          </div>

          {/* Tabella Elenco Servizi */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="py-4 px-6">Tipo</th>
                    <th className="py-4 px-6">Cliente / Fornitore</th>
                    <th className="py-4 px-6">Descrizione Servizio</th>
                    <th className="py-4 px-6">Codice CPA</th>
                    <th className="py-4 px-6 text-center">Erogazione</th>
                    <th className="py-4 px-6 text-center">Incasso</th>
                    <th className="py-4 px-6 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-sm">
                  {servicesList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.isvendor ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                          {item.isvendor ? 'Acquisto' : 'Vendita'}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium text-white">
                        {item.clients?.name || 'Sconosciuto'}
                      </td>
                      <td className="py-4 px-6 text-slate-300 max-w-md truncate" title={item.servicedescription}>
                        {item.servicedescription}
                      </td>
                      <td className="py-4 px-6 font-mono text-indigo-400 font-semibold">
                        {item.cpacode}
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-slate-200">
                        {item.delivery}
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-slate-200">
                        {item.collectiontype}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
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
                  {servicesList.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-500 font-medium">
                        Nessun servizio registrato. Clicca su &quot;Nuovo Servizio&quot; per iniziare.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Inserimento / Modifica Servizio */}
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
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Cliente / Fornitore *</label>
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
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Descrizione Servizio (min. 50 caratteri) * [{serviceDescription.length}/50]
                  </label>
                  <textarea 
                    rows="3"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    placeholder="Inserisci una descrizione dettagliata del servizio offerto o ricevuto..."
                    required
                  />
                  {serviceDescription.length > 0 && serviceDescription.length < 50 && (
                    <p className="text-rose-400 text-xs mt-1">Mancano ancora {50 - serviceDescription.length} caratteri.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Codice CPA (Tabella CPA) *</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                    value={cpaCode}
                    onChange={(e) => setCpaCode(e.target.value)}
                    placeholder="Es. 71.12.11"
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
