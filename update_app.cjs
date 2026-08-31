const fs = require('fs');

let appContent = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add cart state
appContent = appContent.replace(
  "  const [mapCenterPosition, setMapCenterPosition] = useState(null);",
  "  const [mapCenterPosition, setMapCenterPosition] = useState(null);\n  const [cartSelectionIds, setCartSelectionIds] = useState([]);\n  const [isCartOpen, setIsCartOpen] = useState(false);"
);

// 2. Add handlers
const newHandlers = `
  const toggleCartSelection = (id) => {
    setCartSelectionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllCart = (isChecked, currentFilteredData) => {
    const filteredIds = currentFilteredData.map(h => h.codHidrante || h.nomHidrante || h._internalId);
    if (isChecked) {
      setCartSelectionIds(prev => [...new Set([...prev, ...filteredIds])]);
    } else {
      setCartSelectionIds(prev => prev.filter(id => !filteredIds.includes(id)));
    }
  };

  const removeHydrantFromMission = (id) => {
    if (window.confirm('Deseja realmente remover o hidrante desta missão?')) {
      toggleMissionSelection(id);
    }
  };
`;

appContent = appContent.replace(
  "  const toggleMissionSelection = (id) => {",
  newHandlers + "\n  const toggleMissionSelection = (id) => {"
);

// 3. Remove "Rascunho de Hoje" logic from toggleMissionSelection
appContent = appContent.replace(
  /let currentM = missions\.find\(m => m\.id === activeMissionId\);\s+let createdMission = null;\s+if \(!currentM\) {[\s\S]*?currentM = createdMission;\s+}/g,
  "let currentM = missions.find(m => m.id === activeMissionId);\n    if (!currentM) return;"
);
appContent = appContent.replace(
  /if \(createdMission\) {[\s\S]*?\} else \{([\s\S]*?)\}/g,
  "$1"
);

// 4. Update MapComponent props
appContent = appContent.replace(
  "selectedMissionIds={selectedMissionIds}\n              onToggleMission={toggleMissionSelection}",
  "selectedMissionIds={cartSelectionIds}\n              onToggleMission={toggleCartSelection}"
);

// 5. Update DataTable props
appContent = appContent.replace(
  "selectedMissionIds={selectedMissionIds}\n              onToggleMission={toggleMissionSelection}\n              onSelectAllMission={selectAllFiltered}",
  "selectedMissionIds={cartSelectionIds}\n              onToggleMission={toggleCartSelection}\n              onSelectAllMission={selectAllCart}"
);

// 6. Update MissionRoutePanel props
appContent = appContent.replace(
  "onRemoveFromMission={toggleMissionSelection}",
  "onRemoveFromMission={removeHydrantFromMission}"
);

// 7. Render SelectionCart component
const cartComponent = `
        {/* ======================================================== */}
        {/* CARRINHO DE SELEÇÃO FLUTUANTE */}
        {/* ======================================================== */}
        {cartSelectionIds.length > 0 && (currentUser?.role === 'gestor' || currentUser?.role === 'admin') && (
          <div 
            className="fixed z-[9999] pointer-events-auto"
            style={{
              bottom: window.innerWidth < 768 ? '0' : '20px',
              right: window.innerWidth < 768 ? '0' : '20px',
              width: window.innerWidth < 768 ? '100%' : (isCartOpen ? '350px' : 'auto')
            }}
          >
            {/* Balão Fechado */}
            {!isCartOpen && (
              <div 
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full p-4 shadow-xl cursor-pointer flex items-center justify-center gap-2 transform hover:scale-105 transition-all mx-4 mb-4 md:mx-0 md:mb-0"
                onClick={() => setIsCartOpen(true)}
              >
                <div className="font-bold text-lg">🛒 {cartSelectionIds.length}</div>
              </div>
            )}

            {/* Carrinho Aberto */}
            {isCartOpen && (
              <div className="bg-slate-900 border border-slate-700 md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[60vh] md:max-h-[500px]">
                <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-800 md:rounded-t-2xl rounded-t-2xl">
                  <span className="font-bold text-emerald-400">📍 Selecionados ({cartSelectionIds.length})</span>
                  <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-white p-1">✕</button>
                </div>
                
                <div className="p-2 overflow-y-auto flex-1 flex flex-col gap-2">
                  {cartSelectionIds.map(id => {
                    const h = hidrantes.find(x => x.codHidrante === id || x._internalId === id || x.nomHidrante === id);
                    if (!h) return null;
                    return (
                      <div key={id} className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700">
                        <span className="font-mono text-sm text-slate-200">{h.codHidrante || h.nomHidrante}</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setMapCenterPosition({...h, _ts: Date.now()});
                              setActiveView('map');
                              if (window.innerWidth < 768) setIsCartOpen(false);
                            }}
                            className="bg-slate-700 p-1.5 rounded text-cyan-400 hover:bg-slate-600"
                            title="Focar no mapa"
                          >
                            👁️
                          </button>
                          <button 
                            onClick={() => toggleCartSelection(id)}
                            className="bg-red-900/50 p-1.5 rounded text-red-400 hover:bg-red-800"
                            title="Remover"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 border-t border-slate-800 flex flex-col gap-2 bg-slate-800 md:rounded-b-2xl">
                  <button 
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-sm"
                    onClick={() => {
                      const newMission = createNewMission("Nova Missão", null, currentUser);
                      newMission.selectedIds = [...cartSelectionIds];
                      newMission.createdBy = currentUser?.matricula;
                      newMission.createdByName = currentUser?.nome;
                      setMissions(prev => [...prev, newMission]);
                      setOpenMissionIds(prev => [...prev, newMission.id]);
                      setActiveMissionId(newMission.id);
                      setCartSelectionIds([]);
                      setIsCartOpen(false);
                      setIsMissionManagerOpen(true);
                    }}
                  >
                    + Nova Missão
                  </button>
                  <button 
                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-sm"
                    onClick={() => {
                      if (!activeMissionId) {
                        alert('Nenhuma missão aberta. Abra uma na Central primeiro.');
                        return;
                      }
                      updateCurrentMission({
                        selectedIds: [...new Set([...selectedMissionIds, ...cartSelectionIds])]
                      });
                      setCartSelectionIds([]);
                      setIsCartOpen(false);
                      setActiveView('route');
                    }}
                  >
                    + Adicionar à Ativa
                  </button>
                  <button 
                    className="w-full py-2 bg-red-900/40 hover:bg-red-900 text-red-400 rounded font-bold text-sm border border-red-900"
                    onClick={() => { setCartSelectionIds([]); setIsCartOpen(false); }}
                  >
                    🗑️ Limpar Tudo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
`;

appContent = appContent.replace(
  "{/* OVERLAYS E MODAIS REUTILIZÁVEIS */}",
  cartComponent + "\\n\\n        {/* OVERLAYS E MODAIS REUTILIZÁVEIS */}"
);

fs.writeFileSync('src/App.jsx', appContent, 'utf8');
console.log('App.jsx updated successfully.');
