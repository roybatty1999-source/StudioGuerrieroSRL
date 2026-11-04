import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Head from 'next/head'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseClient = createClient(supabaseUrl, supabaseKey)

// Elenco/Database CPA Online integrato per ricerca rapida
const CPA_DATABASE = [
  { code: '62.01.11', description: 'Servizi di progettazione e sviluppo di pagine web e applicazioni' },
  { code: '62.02.10', description: 'Servizi di consulenza nel campo delle tecnologie dell’informazione' },
  { code: '62.03.10', description: 'Servizi di gestione di strutture e apparecchiature informatiche' },
  { code: '62.09.20', description: 'Altri servizi di tecnologia dell’informazione e di assistenza informatica' },
  { code: '63.11.11', description: 'Servizi di elaborazione dati, hosting e servizi connessi' },
  { code: '69.20.10', description: 'Servizi di contabilità, revisione dei conti e consulenza fiscale' },
  { code: '69.20.20', description: 'Servizi di tenuta delle scritture contabili' },
  { code: '69.10.10', description: 'Servizi legali e di consulenza giuridica' },
  { code: '70.22.11', description: 'Servizi di consulenza di direzione aziendale e gestione commerciale' },
  { code: '70.22.12', description: 'Servizi di consulenza in materia di gestione finanziaria' },
  { code: '71.12.11', description: 'Servizi di consulenza ingegneristica per lavori edili e civili' },
  { code: '71.11.10', description: 'Servizi di architettura' },
  { code: '73.11.11', description: 'Servizi pubblicitari completi e pianificazione di campagne' },
  { code: '73.20.11', description: 'Servizi di ricerche di mercato e sondaggi di opinione' },
  { code: '74.10.10', description: 'Servizi di design e grafica pubblicitaria' },
  { code: '78.10.10', description: 'Servizi di ricerca, selezione e collocamento del personale' },
  { code: '80.10.12', description: 'Servizi di vigilanza privata e protezione' },
  { code: '81.21.10', description: 'Servizi di pulizia generale di edifici' },
  { code: '82.11.10', description: 'Servizi integrati di supporto alle funzioni d’ufficio' }
]

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

  // Stato per la ricerca e il dropdown CPA
  const [cpaSearchQuery, setCpaSearchQuery] = useState('')
  const [showCpaDropdown, setShowCpaDropdown] = useState(false)

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
    setCpaSearchQuery('')
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
    setCpaSearchQuery(service.cpacode)
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
    setCpaSearchQuery(`${item.code} - ${item.description}`)
    setShowCpaDropdown(false)

    // Se la descrizione del servizio è vuota, suggeriamo automaticamente la descrizione CPA
    if (!serviceDescription || serviceDescription.trim().length === 0) {
      setServiceDescription(item.description)
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

  // Filtraggio CPA dinamico in base alla digitazione
  const filteredCpaList = CPA_DATABASE.filter(item => 
    item.code.toLowerCase().includes(cpaSearchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(cpaSearchQuery.toLowerCase())
  )

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

                {/* Campo Ricerca Codice CPA con Dropdown */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Codice CPA (Cerca o Seleziona da CPA Online) *</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                    value={cpaSearchQuery}
                    onChange={(e) => {
                      setCpaSearchQuery(e.target.value)
                      setCpaCode(e.target.value)
                      setShowCpaDropdown(true)
                    }}
                    onFocus={() => setShowCpaDropdown(true)}
                    placeholder="Digita codice o parola chiave (es. 62.01.11 o web)..."
                    required
                  />

                  {/* Dropdown dei Risultati CPA */}
                  {showCpaDropdown && filteredCpaList.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-800">
                      {filteredCpaList.map((item) => (
                        <div 
                          key={item.code} 
                          onClick={() => handleSelectCpaItem(item)}
                          className="p-3 hover:bg-indigo-600/30 cursor-pointer text-xs transition-colors flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold text-indigo-400 font-mono mr-2">{item.code}</span>
                            <span className="text-slate-200">{item.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
