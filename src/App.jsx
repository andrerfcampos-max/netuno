import { useState, useMemo, useEffect, useRef } from 'react';
import { Upload, GitMerge, FolderOpen, PlusCircle, Calculator, LogOut, ShieldAlert, RefreshCw, Map as MapIcon, List, Navigation, BarChart3 } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { parseHydrantsCSV } from './utils/csvParser';
import MapComponent from './components/MapComponent';
import FilterBar from './components/FilterBar';
import InspectionModal from './components/InspectionModal';
import EditHydrantModal from './components/EditHydrantModal';
import UserManagerModal from './components/UserManagerModal';
import DataTable from './components/DataTable';
import MissionRoutePanel from './components/MissionRoutePanel';
import MissionReportPanel from './components/MissionReportPanel';
import MissionTabs from './components/MissionTabs';
import MissionManagerModal from './components/MissionManagerModal';
import TechnicalStudyModal from './components/TechnicalStudyModal';
import InconsistentHydrantsModal from './components/InconsistentHydrantsModal';
import ErrorBoundary from './components/ErrorBoundary';
import { loadPreloadedDatabase } from './utils/xlsxParser';
import { loadMissions, saveMissions, createNewMission, loadFolders, saveFolders } from './utils/storage';
import { normalizeRAName, RA_LIST } from './utils/raList';
import { isValidDFCoordinate } from './utils/geoUtils';
import { extractProblemsList } from './utils/problemUtils';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('netuno_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [hidrantes, setHidrantes] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [activeView, _setActiveView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view && ['map', 'table', 'route', 'report'].includes(view)) return view;
    return localStorage.getItem('netuno_active_view') || 'map';
  });
  const [reportMode, setReportMode] = useState('global');

  const setActiveView = (view) => {
    _setActiveView(view);
    localStorage.setItem('netuno_active_view', view);
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    window.history.pushState({ view }, '', url.toString());
  };

  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.view) {
        _setActiveView(event.state.view);
        localStorage.setItem('netuno_active_view', event.state.view);
      } else {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view') || localStorage.getItem('netuno_active_view') || 'map';
        _setActiveView(view);
        localStorage.setItem('netuno_active_view', view);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [activeFilters, setActiveFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('netuno_saved_filters');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar netuno_saved_filters', e);
    }
    return {};
  });
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [inspectingHidrante, setInspectingHidrante] = useState(null);
  const [editingHydrante, setEditingHydrante] = useState(null);
  const [lastInspectedCoords, setLastInspectedCoords] = useState(null);
  const [mapCenterPosition, setMapCenterPosition] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Controle de Missões Persistentes
  const [missions, setMissions] = useState(loadMissions());
  const [folders, setFolders] = useState(loadFolders());
  const [openMissionIds, setOpenMissionIds] = useState([]);
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [isMissionManagerOpen, setIsMissionManagerOpen] = useState(false);
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);
  const [isTechnicalStudyOpen, setIsTechnicalStudyOpen] = useState(false);
  const [isInconsistentModalOpen, setIsInconsistentModalOpen] = useState(false);

  const inconsistentCount = useMemo(() => {
    return hidrantes.filter(h => !isValidDFCoordinate(h.numLatitude, h.numLongitude)).length;
  }, [hidrantes]);

  const hasSecondaryFilter = useMemo(() => {
    if (!activeFilters || typeof activeFilters !== 'object') return false;
    return Boolean(
      (activeFilters.buscaGeral && activeFilters.buscaGeral.trim() !== '') ||
      (activeFilters.periodo && activeFilters.periodo !== '') ||
      (activeFilters.status && activeFilters.status !== 'Todos') ||
      (activeFilters.problema && activeFilters.problema !== '')
    );
  }, [activeFilters]);

  const isAllCitiesOnly = useMemo(() => {
    return (activeFilters?.ra === '__TODAS__') && !hasSecondaryFilter;
  }, [activeFilters?.ra, hasSecondaryFilter]);

  const mapHidrantes = useMemo(() => {
    if (isAllCitiesOnly) {
      if (mapCenterPosition) {
        return [mapCenterPosition];
      }
      return [];
    }
    return filteredList;
  }, [isAllCitiesOnly, mapCenterPosition, filteredList]);

  // Suporte a abertura direta de modais via link/URL parameter
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const modal = params.get('modal') || params.get('view');
    if ((modal === 'estudo-tecnico' || modal === 'technical-study') && (currentUser?.role === 'gestor' || currentUser?.role === 'admin')) {
      setIsTechnicalStudyOpen(true);
    } else if ((modal === 'novo-hidrante' || modal === 'new-hydrant') && (currentUser?.role === 'gestor' || currentUser?.role === 'admin')) {
      setEditingHydrante({});
    } else if (modal === 'admin' && currentUser?.role === 'admin') {
      setIsUserManagerOpen(true);
    } else if (modal === 'inconsistentes' && (currentUser?.role === 'gestor' || currentUser?.role === 'admin')) {
      setIsInconsistentModalOpen(true);
    } else if (modal === 'central-missoes' || modal === 'missoes' || modal === 'missions') {
      setIsMissionManagerOpen(true);
    }
  }, [currentUser]);

  const handleCloseTechnicalStudy = () => {
    setIsTechnicalStudyOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has('modal')) {
      url.searchParams.delete('modal');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  };

  const handleCloseMissionManager = () => {
    setIsMissionManagerOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has('modal')) {
      url.searchParams.delete('modal');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  };

  const handleCloseUserManager = () => {
    setIsUserManagerOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has('modal')) {
      url.searchParams.delete('modal');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  };

  const handleCloseEditHydrant = () => {
    setEditingHydrante(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('modal')) {
      url.searchParams.delete('modal');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  };

  const handleInspect = (h) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, h.numLatitude, h.numLongitude);
          if (dist > 0.05) { // 50 metros
            if (window.confirm(`[TRAVA DE SEGURANÇA]\n\nVocê está a mais de 50 metros deste hidrante (${Math.round(dist * 1000)}m de distância).\n\nTem certeza que deseja registrar a vistoria à distância?`)) {
              setInspectingHidrante(h);
            }
          } else {
            setInspectingHidrante(h);
          }
        },
        (err) => {
          console.warn('Geofencing fallback (Erro de GPS)', err);
          setInspectingHidrante(h);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    } else {
      setInspectingHidrante(h);
    }
  };

  // Sincroniza estado de pastas com LocalStorage
  useEffect(() => {
    saveFolders(folders);
  }, [folders]);

  // Derivações da Missão Ativa
  const currentMission = missions.find(m => m.id === activeMissionId);
  const selectedMissionIds = currentMission?.selectedIds || [];
  const completedMissionIds = currentMission?.completedIds || [];

  // Sincroniza estado de missões com LocalStorage sempre que alterar
  useEffect(() => {
    saveMissions(missions);
  }, [missions]);

  // Hidratação por Link Mágico (?ds=ID1,ID2) e Carregamento Automático
  useEffect(() => {
    // 1. Carregar Base Pre-carregada automaticamente se estiver vazio
    if (hidrantes.length === 0) {
      loadPreloadedDatabase((data) => {
        if (data.length > 0) {
          setHidrantes(data);
          setFilteredList(getFilteredData(activeFilters, data));
        }
      });
    }

    // 2. Link Mágico
    const params = new URLSearchParams(window.location.search);
    const ds = params.get('ds');
    if (ds) {
      const ids = ds.split(',').filter(Boolean);
      if (ids.length > 0) {
        // Cria uma nova missão com esses IDs importados
        const newMission = createNewMission("Missão Importada");
        newMission.selectedIds = ids;
        newMission.createdBy = currentUser?.matricula;
        setMissions(prev => [...prev, newMission]);
        setOpenMissionIds(prev => [...prev, newMission.id]);
        setActiveMissionId(newMission.id);
        setActiveView('route');
        // Limpa a URL para não duplicar no F5
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [hidrantes.length]);

  const updateCurrentMission = (updates) => {
    if (!activeMissionId) return;
    setMissions(prev => prev.map(m => m.id === activeMissionId ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m));
  };

  const toggleMissionSelection = (id) => {
    let currentId = activeMissionId;
    let currentSel = selectedMissionIds;
    let currentComp = completedMissionIds;

    // Se tentar adicionar mas não tiver missão ativa, cria uma automaticamente
    if (!currentId) {
      const newMission = createNewMission();
      newMission.createdBy = currentUser?.matricula;
      setMissions(prev => [...prev, newMission]);
      setOpenMissionIds(prev => [...prev, newMission.id]);
      setActiveMissionId(newMission.id);
      currentId = newMission.id;
      currentSel = [];
      currentComp = [];
    }

    const newSelected = currentSel.includes(id) 
      ? currentSel.filter(missionId => missionId !== id) 
      : [...currentSel, id];
    
    const newCompleted = currentSel.includes(id)
      ? currentComp.filter(cId => cId !== id)
      : currentComp;

    // Atualiza o estado
    setMissions(prev => prev.map(m => m.id === currentId ? { ...m, selectedIds: newSelected, completedIds: newCompleted, updatedAt: new Date().toISOString() } : m));
  };

  const selectAllFiltered = (isChecked, currentFilteredData) => {
    let currentId = activeMissionId;
    let currentSel = selectedMissionIds;
    let currentComp = completedMissionIds;

    if (!currentId) {
      const newMission = createNewMission();
      newMission.createdBy = currentUser?.matricula;
      setMissions(prev => [...prev, newMission]);
      setOpenMissionIds(prev => [...prev, newMission.id]);
      setActiveMissionId(newMission.id);
      currentId = newMission.id;
      currentSel = [];
      currentComp = [];
    }

    const filteredIds = currentFilteredData.map(h => h.codHidrante || h.nomHidrante);
    
    if (isChecked) {
      const idsToAdd = filteredIds.filter(id => !currentSel.includes(id));
      setMissions(prev => prev.map(m => m.id === currentId ? { ...m, selectedIds: [...currentSel, ...idsToAdd], updatedAt: new Date().toISOString() } : m));
    } else {
      setMissions(prev => prev.map(m => m.id === currentId ? { ...m, selectedIds: newSelected, completedIds: newCompleted, updatedAt: new Date().toISOString() } : m));
    }
  };

  const parseDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return null;
    const str = String(dateStr).trim();
    if (!str || str === '-') return null;
    const [datePart] = str.split(' ');
    if (!datePart) return null;
    const parts = datePart.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        return new Date(y, m, d);
      }
    }
    if (datePart.includes('-')) {
      const partsIso = datePart.split('-');
      if (partsIso.length === 3) {
        const y = parseInt(partsIso[0], 10);
        const m = parseInt(partsIso[1], 10) - 1;
        const d = parseInt(partsIso[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          return new Date(y, m, d);
        }
      }
    }
    return null;
  };

  const getFilteredData = (filters = {}, dataList = hidrantes) => {
    const hasActiveFilter = 
      (filters.ra && filters.ra !== '') ||
      (filters.buscaGeral && filters.buscaGeral.trim() !== '') ||
      (filters.periodo && filters.periodo !== '') ||
      (filters.status && filters.status !== 'Todos') ||
      (filters.problema && filters.problema !== '');

    // Se nenhum filtro foi selecionado (estado inicial/padrão), retorna vazio para carga sob demanda
    if (!hasActiveFilter) {
      return [];
    }

    let result = [...dataList];
    if (filters.buscaGeral) {
      const termo = String(filters.buscaGeral).toLowerCase();
      result = result.filter(h => 
        (h.dscEndereco && String(h.dscEndereco).toLowerCase().includes(termo)) ||
        (h.nomHidrante && String(h.nomHidrante).toLowerCase().includes(termo)) ||
        (h.dscPontoReferencia && String(h.dscPontoReferencia).toLowerCase().includes(termo))
      );
    }
    if (filters.ra && filters.ra !== '__TODAS__') {
      result = result.filter(h => h.dscLocalidade === filters.ra);
    }
    if (filters.periodo) {
      const periodoStr = String(filters.periodo);
      result = result.filter(h => {
        const d = parseDate(h.datHoraUltimaVistoria);
        if (!d) return false;
        
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        if (periodoStr === 'hoje') {
          return d.getTime() === hoje.getTime();
        } else if (periodoStr === 'semana') {
          const start = new Date(hoje);
          start.setDate(start.getDate() - start.getDay());
          return d >= start;
        } else if (periodoStr === 'mes') {
          return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
        } else if (periodoStr === 'ano_atual') {
          return d.getFullYear() === hoje.getFullYear();
        } else if (periodoStr.startsWith('ano-')) {
          const targetYear = parseInt(periodoStr.split('-')[1], 10);
          return d.getFullYear() === targetYear;
        } else if (periodoStr === 'personalizado') {
          if (filters.dataInicio) {
            // Usa 'T00:00:00' para evitar shift de timezone no Date constructor
            const start = new Date(filters.dataInicio + 'T00:00:00');
            if (d < start) return false;
          }
          if (filters.dataFim) {
            const end = new Date(filters.dataFim + 'T23:59:59');
            if (d > end) return false;
          }
          return true;
        }
        return true;
      });
    }
    if (filters.status && filters.status !== 'Todos') {
      const isOperante = filters.status === 'Operante';
      result = result.filter(h => h.flgAtivo === isOperante);
    }
    if (filters.problema) {
      const targetProb = String(filters.problema).toUpperCase().trim();
      result = result.filter(h => {
        if (!h.problemasHidrante) return false;
        const list = extractProblemsList(String(h.problemasHidrante));
        return list.some(p => String(p).toUpperCase().includes(targetProb));
      });
    }
    return result;
  };

  // Touch Swipe na tela principal para alternar abas (desativado no Mapa para permitir arrasto livre)
  const mainTouchStartX = useRef(null);
  const mainTouchStartY = useRef(null);

  const handleMainTouchStart = (e) => {
    // Nunca capturar gesto de swipe na visualização do mapa nem em elementos interativos
    if (
      activeView === 'map' || 
      e.target.closest('.leaflet-container') || 
      e.target.closest('table') || 
      e.target.closest('input') || 
      e.target.closest('select') || 
      e.target.closest('textarea') || 
      e.target.closest('button')
    ) {
      mainTouchStartX.current = null;
      mainTouchStartY.current = null;
      return;
    }
    mainTouchStartX.current = e.touches[0].clientX;
    mainTouchStartY.current = e.touches[0].clientY;
  };

  const handleMainTouchEnd = (e) => {
    if (activeView === 'map' || mainTouchStartX.current === null || mainTouchStartY.current === null) {
      mainTouchStartX.current = null;
      mainTouchStartY.current = null;
      return;
    }
    const diffX = mainTouchStartX.current - e.changedTouches[0].clientX;
    const diffY = mainTouchStartY.current - e.changedTouches[0].clientY;

    // Apenas se for um gesto horizontal claro e expressivo fora do mapa
    if (Math.abs(diffX) > Math.abs(diffY) * 1.5 && Math.abs(diffX) > 80) {
      const views = ['map', 'table'];
      if (activeMissionId && selectedMissionIds.length > 0) views.push('route');
      if (currentUser?.role === 'gestor' || currentUser?.role === 'admin') views.push('report');

      const currentIndex = views.indexOf(activeView);
      if (currentIndex !== -1) {
        if (diffX > 0 && currentIndex < views.length - 1) {
          // Arrastou para esquerda -> próxima aba
          setActiveView(views[currentIndex + 1]);
        } else if (diffX < 0 && currentIndex > 0) {
          // Arrastou para direita -> aba anterior
          setActiveView(views[currentIndex - 1]);
        }
      }
    }
    mainTouchStartX.current = null;
    mainTouchStartY.current = null;
  };

  // Extrair Regiões (RAs) únicas dinamicamente
  const regions = useMemo(() => {
    if (hidrantes.length > 0) {
      const r = new Set();
      hidrantes.forEach(h => {
        const norm = normalizeRAName(h.dscLocalidade);
        if (norm) r.add(norm);
      });
      if (r.size > 0) {
        return Array.from(r).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      }
    }
    return RA_LIST.map(r => r.name).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [hidrantes]);

  // Extrair Anos dinamicamente baseado na Cidade/RA selecionada
  const anosVistoria = useMemo(() => {
    let baseList = hidrantes;
    if (activeFilters.ra && activeFilters.ra !== '__TODAS__') {
      baseList = baseList.filter(h => h.dscLocalidade === activeFilters.ra);
    }
    const anos = new Set();
    baseList.forEach(h => {
      if (h.datHoraUltimaVistoria && h.datHoraUltimaVistoria !== '-') {
        const match = String(h.datHoraUltimaVistoria).match(/\b(20\d{2})\b/);
        if (match) anos.add(match[1]);
      }
    });
    return Array.from(anos).sort((a, b) => b - a); // decrescente
  }, [hidrantes, activeFilters.ra]);

  // Extrair Problemas dinamicamente baseado na Cidade/RA e Período selecionados
  const problemasVistoria = useMemo(() => {
    let baseList = hidrantes;
    if (activeFilters.ra && activeFilters.ra !== '__TODAS__') {
      baseList = baseList.filter(h => h.dscLocalidade === activeFilters.ra);
    }
    if (activeFilters.periodo) {
      const periodoStr = String(activeFilters.periodo);
      baseList = baseList.filter(h => {
        const d = parseDate(h.datHoraUltimaVistoria);
        if (!d) return false;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        if (periodoStr === 'hoje') {
          return d.getTime() === hoje.getTime();
        } else if (periodoStr === 'semana') {
          const start = new Date(hoje);
          start.setDate(start.getDate() - start.getDay());
          return d >= start;
        } else if (periodoStr === 'mes') {
          return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
        } else if (periodoStr === 'ano_atual') {
          return d.getFullYear() === hoje.getFullYear();
        } else if (periodoStr.startsWith('ano-')) {
          const targetYear = parseInt(periodoStr.split('-')[1], 10);
          return d.getFullYear() === targetYear;
        } else if (periodoStr === 'personalizado') {
          if (activeFilters.dataInicio) {
            const start = new Date(activeFilters.dataInicio + 'T00:00:00');
            if (d < start) return false;
          }
          if (activeFilters.dataFim) {
            const end = new Date(activeFilters.dataFim + 'T23:59:59');
            if (d > end) return false;
          }
          return true;
        }
        return true;
      });
    }
    if (activeFilters.status && activeFilters.status !== 'Todos') {
      const isOperante = activeFilters.status === 'Operante';
      baseList = baseList.filter(h => h.flgAtivo === isOperante);
    }
    const problemas = new Set();
    baseList.forEach(h => {
      if (h.problemasHidrante) {
        const list = extractProblemsList(String(h.problemasHidrante));
        list.forEach(p => problemas.add(p));
      }
    });
    return Array.from(problemas).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [hidrantes, activeFilters.ra, activeFilters.periodo, activeFilters.dataInicio, activeFilters.dataFim, activeFilters.status]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      parseHydrantsCSV(file, (data) => {
        setHidrantes(data);
        setFilteredList(data);
      });
    }
  };

  const applyFilters = (filters, dataList = hidrantes) => {
    setFilteredList(getFilteredData(filters, dataList));
  };

  const handleFilterChange = (filters) => {
    setActiveFilters(filters);
    try {
      localStorage.setItem('netuno_saved_filters', JSON.stringify(filters));
    } catch (e) {}
    applyFilters(filters, hidrantes);
  };

  const handleSaveInspection = (updatedHidrante) => {
    const sanitized = {
      ...updatedHidrante,
      dscLocalidade: normalizeRAName(updatedHidrante.dscLocalidade)
    };
    const newHidrantes = hidrantes.map(h => {
      if (h._internalId === sanitized._internalId || 
         (h.nomHidrante === sanitized.nomHidrante && h.codHidrante === sanitized.codHidrante)) {
        return sanitized;
      }
      return h;
    });
    setHidrantes(newHidrantes);
    
    const id = sanitized.codHidrante || sanitized.nomHidrante;
    if (activeMissionId && selectedMissionIds.includes(id) && !completedMissionIds.includes(id)) {
      updateCurrentMission({ completedIds: [...completedMissionIds, id] });
    }

    applyFilters(activeFilters, newHidrantes);
    setLastInspectedCoords({ lat: sanitized.numLatitude, lng: sanitized.numLongitude });
    setInspectingHidrante(null);
  };

  const handleSaveEdit = (updatedHidrante) => {
    const sanitized = {
      ...updatedHidrante,
      dscLocalidade: normalizeRAName(updatedHidrante.dscLocalidade)
    };
    let exists = false;
    const isExisting = Boolean(sanitized._internalId);
    
    let newHidrantes = [];
    if (isExisting) {
      newHidrantes = hidrantes.map(h => {
        if (h._internalId === sanitized._internalId) {
          exists = true;
          return sanitized;
        }
        return h;
      });
    }

    if (!exists) {
      const newEntity = {
        ...sanitized,
        _internalId: `hid_new_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      };
      newHidrantes = isExisting ? [...newHidrantes, newEntity] : [...hidrantes, newEntity];
    }
    
    setHidrantes(newHidrantes);
    applyFilters(activeFilters, newHidrantes);
    handleCloseEditHydrant();
  };

  const handleDeleteHydrant = (hydrantToDelete) => {
    const newHidrantes = hidrantes.filter(h => {
      if (hydrantToDelete._internalId && h._internalId) {
        return h._internalId !== hydrantToDelete._internalId;
      }
      const idA = hydrantToDelete.codHidrante || hydrantToDelete.nomHidrante;
      const idB = h.codHidrante || h.nomHidrante;
      return idA !== idB;
    });
    setHidrantes(newHidrantes);
    applyFilters(activeFilters, newHidrantes);
    toast.success('Hidrante excluído da base com sucesso!');
  };

  // ---- Controle de Missões ----
  const handleNewMission = (parentFolderId = null) => {
    const newMission = createNewMission("Rascunho de Hoje", parentFolderId);
    newMission.createdBy = currentUser?.matricula;
    setMissions(prev => [...prev, newMission]);
    setOpenMissionIds(prev => [...prev, newMission.id]);
    setActiveMissionId(newMission.id);
  };

  const handleOpenMission = (id) => {
    if (!openMissionIds.includes(id)) {
      setOpenMissionIds(prev => [...prev, id]);
    }
    setActiveMissionId(id);
    setActiveView('route');
  };

  const handleCloseTab = (id) => {
    const newOpen = openMissionIds.filter(mid => mid !== id);
    setOpenMissionIds(newOpen);
    if (activeMissionId === id) {
      setActiveMissionId(newOpen.length > 0 ? newOpen[0] : null);
    }
  };

  const handleDeleteMission = (id) => {
    setMissions(prev => prev.filter(m => m.id !== id));
    handleCloseTab(id);
  };

  const handleLogout = () => {
    localStorage.removeItem('netuno_user');
    setCurrentUser(null);
    setOpenMissionIds([]);
    setActiveMissionId(null);
    setActiveView('map');
  };

  // Sessão de 8h e renovação silenciosa
  useEffect(() => {
    if (!currentUser) return;

    const checkSession = () => {
      const saved = localStorage.getItem('netuno_user');
      if (saved) {
        const user = JSON.parse(saved);
        if (user.expiresAt && Date.now() > user.expiresAt) {
          handleLogout();
          toast.error('Sua sessão expirou por inatividade. Faça login novamente.');
        }
      }
    };

    // Estende a sessão em 8 horas
    const extendSession = () => {
      const saved = localStorage.getItem('netuno_user');
      if (saved) {
        const user = JSON.parse(saved);
        user.expiresAt = Date.now() + 8 * 60 * 60 * 1000;
        localStorage.setItem('netuno_user', JSON.stringify(user));
        setCurrentUser(user);
      }
    };

    // Checa a cada 5 minutos
    const interval = setInterval(checkSession, 5 * 60 * 1000);

    // Renova na interação, com "throttle" rudimentar para não inundar o localStorage
    let throttleTimer;
    const handleActivity = () => {
      if (!throttleTimer) {
        extendSession();
        throttleTimer = setTimeout(() => { throttleTimer = null; }, 60000); // 1 min throttle
      }
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Checa na montagem inicial se já estava expirado
    checkSession();

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      clearTimeout(throttleTimer);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [currentUser?.matricula]); // Depende apenas da matrícula para não refazer os listeners atoa

  const handleLogin = (e) => {
    e.preventDefault();
    const mat = e.target.matricula.value;
    const senha = e.target.senha.value;
    
    // Simulação do backend
    if (senha !== '123' && senha !== 'senha123' && senha !== 'admin') {
      toast.error('Senha incorreta para testes. (Dica: use 123 ou admin)');
      return;
    }

    let user = null;
    if (mat === '123') {
      user = { matricula: '123', nome: 'Vistoriador Silva', role: 'vistoriador' };
    } else if (mat === '456') {
      user = { matricula: '456', nome: 'Gestor Souza', role: 'gestor' };
    } else if (mat === '789') {
      user = { matricula: '789', nome: 'Gestor Oliveira', role: 'gestor' };
    } else if (mat === 'admin') {
      user = { matricula: 'admin', nome: 'Administrador', role: 'admin' };
    } else if (mat === '1997400') {
      user = { matricula: '1997400', nome: 'Sgt Roméro', role: 'admin' };
    }
    
    if (user) {
      user.expiresAt = Date.now() + 8 * 60 * 60 * 1000;
      localStorage.setItem('netuno_user', JSON.stringify(user));
      setCurrentUser(user);
    } else {
      toast.error('Matrícula inválida. Use 123, 456, 789, admin ou 1997400.');
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-sm">
          <h1 className="text-3xl font-black tracking-tight text-emerald-400 drop-shadow-md text-center mb-2">NETUNO</h1>
          <p className="text-slate-400 text-center text-sm mb-6">Sistema de mapeamento de hidrantes urbanos de incêndio - SEHUR/GPCIU</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-slate-400 text-sm font-bold mb-2 block">Matrícula Militar</label>
              <input 
                name="matricula" 
                type="text" 
                maxLength={20}
                defaultValue="456"
                autoComplete="off"
                className="w-full p-3 rounded bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-emerald-500 font-mono text-center text-lg tracking-widest" 
                placeholder="Ex: 123, 456, admin, 1997400" 
                required 
              />
            </div>
            <div>
              <label className="text-slate-400 text-sm font-bold mb-2 block">Senha</label>
              <input 
                name="senha" 
                type="password" 
                maxLength={50}
                defaultValue="123"
                autoComplete="off"
                className="w-full p-3 rounded bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-emerald-500 font-mono text-center text-lg tracking-widest" 
                placeholder="***" 
                required 
              />
            </div>
            <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 active:scale-95 transition-all mt-2">
              Acessar Sistema
            </button>
          </form>
          <ToastContainer theme="dark" position="bottom-center" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-900 text-slate-100 font-sans overflow-hidden w-full max-w-full">
      {/* Banner Offline */}
      {isOffline && (
        <div className="bg-red-500 text-white text-center py-1 px-4 text-xs font-bold z-50 flex items-center justify-center relative w-full shadow-md animate-pulse">
          ⚠️ VOCÊ ESTÁ OFFLINE. Algumas funcionalidades, como o mapa, podem falhar.
        </div>
      )}

      {/* HEADER / FILTER BAR */}
      {inspectingHidrante && (
        <InspectionModal 
          hidrante={inspectingHidrante}
          onClose={() => setInspectingHidrante(null)}
          onSave={handleSaveInspection}
          currentUser={currentUser}
        />
      )}
      
      {editingHydrante && (
        <EditHydrantModal 
          hidrante={editingHydrante}
          onClose={() => setEditingHydrante(null)}
          onSave={handleSaveEdit}
          currentUser={currentUser}
          allHidrantes={hidrantes}
        />
      )}

      {isUserManagerOpen && (
        <UserManagerModal onClose={() => setIsUserManagerOpen(false)} />
      )}

      {isInconsistentModalOpen && (
        <InconsistentHydrantsModal
          isOpen={isInconsistentModalOpen}
          onClose={() => setIsInconsistentModalOpen(false)}
          hidrantes={hidrantes}
          onEditHydrant={(h) => setEditingHydrante(h)}
          onDeleteHydrant={handleDeleteHydrant}
          currentUser={currentUser}
        />
      )}

      {/* Header */}
      <header className={isMapFullscreen ? "hidden" : "flex justify-between items-center p-3 bg-slate-900 border-b border-slate-700 z-50"}>
        <h1 className="text-xl font-bold tracking-tight text-emerald-400 drop-shadow-md">NETUNO</h1>
        
        <div className="relative z-50 flex items-center gap-2">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-300 font-bold">
              {currentUser.nome}
            </span>
            <span className="text-[9px] text-emerald-500">
              {currentUser.role === 'gestor' ? 'Gestor' : currentUser.role === 'admin' ? 'Admin' : 'Vistoriador'}
            </span>
          </div>

          <button 
            onClick={handleLogout} 
            className="flex items-center justify-center p-2 bg-slate-800 hover:bg-red-900/50 hover:text-red-400 text-slate-400 border border-slate-700 rounded shadow-sm transition-all"
            title="Sair do sistema"
          >
            <LogOut size={20} />
          </button>

          {/* Vistoriador visualiza apenas a Central de Missões diretamente */}
          {currentUser.role === 'vistoriador' ? (
            <a 
              href="?modal=central-missoes"
              onClick={(e) => {
                if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                  e.preventDefault();
                  setIsMissionManagerOpen(true);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 text-emerald-400 font-semibold rounded shadow-sm hover:bg-slate-700 transition-all text-sm"
              title="Central de Missões"
            >
              <FolderOpen size={18} />
              <span className="hidden sm:inline">Central de Missões</span>
            </a>
          ) : (
            /* Gestores e Admins visualizam o Menu dropdown com todas as opções */
            <details className="group">
              <summary className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 text-emerald-400 font-semibold rounded shadow-sm cursor-pointer list-none hover:bg-slate-700 transition-all relative">
                <span className="hidden sm:inline">Menu</span>
                {inconsistentCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping absolute top-2 right-2"></span>
                )}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </summary>
              <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl flex flex-col gap-1 p-2">
                {currentUser.role === 'admin' && (
                  <a 
                    href="?modal=admin"
                    onClick={(e) => {
                      if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                        e.preventDefault();
                        setIsUserManagerOpen(true);
                        e.currentTarget.closest('details')?.removeAttribute('open');
                      }
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left bg-red-900/30 text-red-400 font-semibold rounded hover:bg-red-900/50 transition-all"
                  >
                    Painel Admin
                  </a>
                )}
                {(currentUser.role === 'admin' || currentUser.role === 'gestor') && (
                  <a 
                    href="?modal=novo-hidrante"
                    onClick={(e) => {
                      if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                        e.preventDefault();
                        setEditingHydrante({});
                        e.currentTarget.closest('details')?.removeAttribute('open');
                      }
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left bg-blue-900/30 text-blue-400 font-semibold rounded hover:bg-blue-900/50 transition-all"
                  >
                    <PlusCircle size={18} />
                    Novo Hidrante
                  </a>
                )}
                {(currentUser.role === 'admin' || currentUser.role === 'gestor') && (
                  <a 
                    href="?modal=estudo-tecnico"
                    onClick={(e) => {
                      if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                        e.preventDefault();
                        setIsTechnicalStudyOpen(true);
                        e.currentTarget.closest('details')?.removeAttribute('open');
                      }
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left bg-purple-900/30 text-purple-400 font-semibold rounded hover:bg-purple-900/50 transition-all"
                  >
                    <Calculator size={18} />
                    Estudo Técnico
                  </a>
                )}
                {(currentUser.role === 'admin' || currentUser.role === 'gestor') && (
                  <a 
                    href="?modal=inconsistentes"
                    onClick={(e) => {
                      if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                        e.preventDefault();
                        setIsInconsistentModalOpen(true);
                        e.currentTarget.closest('details')?.removeAttribute('open');
                      }
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 text-left bg-amber-900/30 text-amber-300 font-semibold rounded hover:bg-amber-900/50 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldAlert size={18} className="text-amber-400" />
                      Hidrantes Inconsistentes
                    </span>
                    {inconsistentCount > 0 && (
                      <span className="bg-amber-500/30 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/50 font-bold">
                        {inconsistentCount}
                      </span>
                    )}
                  </a>
                )}
                <a 
                  href="?modal=central-missoes"
                  onClick={(e) => {
                    if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                      e.preventDefault();
                      setIsMissionManagerOpen(true);
                      e.currentTarget.closest('details')?.removeAttribute('open');
                    }
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left bg-slate-700 text-emerald-400 font-semibold rounded hover:bg-slate-600 transition-all"
                >
                  <FolderOpen size={18} />
                  Central de Missões
                </a>

                <button
                  type="button"
                  onClick={async () => {
                    toast.info('Atualizando aplicação e limpando cache...');
                    try {
                      if ('serviceWorker' in navigator) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (const r of regs) await r.unregister();
                      }
                      if ('caches' in window) {
                        const keys = await caches.keys();
                        for (const k of keys) await caches.delete(k);
                      }
                    } catch (e) {
                      console.warn(e);
                    }
                    setTimeout(() => {
                      window.location.reload();
                    }, 400);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left bg-slate-800 border border-slate-600 text-cyan-300 font-semibold rounded hover:bg-slate-700 active:scale-95 transition-all text-xs"
                >
                  <RefreshCw size={16} className="text-cyan-400" />
                  Atualizar Sistema (Limpar Cache)
                </button>
              </div>
            </details>
          )}
        </div>
      </header>

      {/* TABS DE MISSÃO GLOBAL */}
      {!isMapFullscreen && (
        <div className="flex-shrink-0 z-25">
          <MissionTabs 
            missions={missions}
            activeMissionId={activeMissionId}
            openMissionIds={openMissionIds}
            onTabClick={setActiveMissionId}
            onCloseTab={handleCloseTab}
            onNewMission={currentUser.role === 'gestor' || currentUser.role === 'admin' ? handleNewMission : undefined}
            currentUser={currentUser}
          />
        </div>
      )}

      {/* MÓDULO 1: BARRA DE FILTROS FIXA NO TOPO (SEMPRE VISÍVEL) */}
      {!isMapFullscreen && (
        <div className="flex-shrink-0 px-2 pt-1.5 z-20 w-full">
          <FilterBar 
            onFilterChange={handleFilterChange} 
            regions={regions} 
            anos={anosVistoria} 
            problemasAtivos={problemasVistoria} 
            isVisible={!isMapFullscreen} 
            currentUser={currentUser} 
            onLogout={handleLogout} 
          />
        </div>
      )}

      {/* CONTROLES DE VISUALIZAÇÃO NO DESKTOP (LOGO ABAIXO DOS FILTROS) */}
      {!isMapFullscreen && (
        <div className="hidden md:block flex-shrink-0 px-2 py-1 z-10 w-full">
          <div className={`grid ${currentUser?.role === 'gestor' || currentUser?.role === 'admin' ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 sm:gap-2 px-0.5 max-w-4xl mx-auto`}>
            <button 
              onClick={() => setActiveView('map')}
              className={`min-h-[38px] sm:min-h-[40px] py-1.5 px-2 border rounded-lg text-xs sm:text-sm font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center truncate ${
                activeView === 'map' ? 'bg-emerald-600 border-emerald-500 text-white ring-2 ring-emerald-400/30' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              Mapa
            </button>
            <button 
              onClick={() => setActiveView('table')}
              className={`min-h-[38px] sm:min-h-[40px] py-1.5 px-2 border rounded-lg text-xs sm:text-sm font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center truncate ${
                activeView === 'table' ? 'bg-emerald-600 border-emerald-500 text-white ring-2 ring-emerald-400/30' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              Lista
            </button>
            <button 
              onClick={() => setActiveView('route')}
              className={`min-h-[38px] sm:min-h-[40px] py-1.5 px-2 border rounded-lg text-xs sm:text-sm font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center truncate ${
                activeView === 'route' 
                  ? 'bg-emerald-600 border-emerald-500 text-white ring-2 ring-emerald-400/30' 
                  : (!activeMissionId || selectedMissionIds.length === 0 
                     ? 'bg-slate-800/60 border-slate-700 text-slate-500 opacity-60' 
                     : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-200')
              }`}
              disabled={!activeMissionId}
            >
              Rota ({selectedMissionIds.length})
            </button>
            {(currentUser?.role === 'gestor' || currentUser?.role === 'admin') && (
              <button 
                onClick={() => setActiveView('report')}
                className={`min-h-[38px] sm:min-h-[40px] py-1.5 px-2 border rounded-lg text-xs sm:text-sm font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center truncate ${
                  activeView === 'report' ? 'bg-emerald-600 border-emerald-500 text-white ring-2 ring-emerald-400/30' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                Relatório
              </button>
            )}
          </div>
        </div>
      )}

      {/* ÁREA PRINCIPAL DE CONTEÚDO */}
      <main 
        onTouchStart={handleMainTouchStart}
        onTouchEnd={handleMainTouchEnd}
        className={isMapFullscreen ? "h-full w-full p-0 m-0 relative" : "flex-1 min-h-0 w-full relative p-2 pt-0 flex flex-col select-none touch-pan-y overflow-hidden"}
      >
        {/* MÓDULO 2: MAPA TÁTICO INTEGRADO */}
        <div className={`w-full h-full relative z-0 flex-1 min-h-0 ${activeView === 'map' ? 'block' : 'hidden'}`}>
          <ErrorBoundary>
            <MapComponent 
              hidrantes={mapHidrantes} 
              onInspect={handleInspect}
              onEdit={(h) => setEditingHydrante(h)}
              centerPosition={mapCenterPosition}
              selectedMissionIds={selectedMissionIds}
              onToggleMission={toggleMissionSelection}
              currentUser={currentUser}
              isMapFullscreen={isMapFullscreen}
              onMapClick={() => setIsMapFullscreen(prev => !prev)}
              onOpenFilters={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              activeView={activeView}
              isAllCitiesOnly={isAllCitiesOnly}
            />
          </ErrorBoundary>
        </div>

        {/* MÓDULO 4: TABELA */}
        {activeView === 'table' && (
          <div className="w-full h-full flex-1 min-h-0 bg-slate-800 rounded-xl overflow-hidden border border-slate-700 flex flex-col">
            <DataTable 
              data={filteredList} 
              onInspect={handleInspect}
              onEdit={(h) => setEditingHydrante(h)}
              onCenterMap={(h) => {
                setMapCenterPosition({...h, _ts: Date.now()});
                setActiveView('map');
              }} 
              selectedMissionIds={selectedMissionIds}
              onToggleMission={toggleMissionSelection}
              onSelectAllMission={selectAllFiltered}
              currentUser={currentUser}
            />
          </div>
        )}

        {/* MÓDULO ROTA DE MISSÃO */}
        {activeView === 'route' && activeMissionId && (
          <div id="modulo-rota" className="w-full h-full flex-1 min-h-0 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
            <MissionRoutePanel 
              hidrantes={hidrantes}
              selectedMissionIds={selectedMissionIds}
              completedMissionIds={completedMissionIds}
              currentMission={currentMission}
              onUpdateMission={(updates) => updateCurrentMission(updates)}
              onClose={() => setActiveView('map')}
              onClearMission={() => updateCurrentMission({ selectedIds: [], completedIds: [] })}
              onRemoveFromMission={toggleMissionSelection}
              lastInspectedCoords={lastInspectedCoords} 
              onInspect={handleInspect}
              onEdit={(h) => setEditingHydrante(h)}
              onCenterMap={(h) => {
                setMapCenterPosition({...h, _ts: Date.now()});
                setActiveView('map');
              }}
              currentUser={currentUser}
              folders={folders}
              onGenerateReport={() => {
                setReportMode('mission');
                setActiveView('report');
              }}
              onSaveRouteToFolder={(folderId, newName) => {
                const finalName = newName || currentMission.name;
                const isDuplicate = missions.some(m => m.id !== currentMission.id && m.parentFolderId === folderId && m.name.toLowerCase() === finalName.toLowerCase());
                if (isDuplicate) {
                  if (!window.confirm(`Já existe uma missão com o nome "${finalName}" nesta pasta. Deseja salvar assim mesmo e duplicar?`)) {
                    return;
                  }
                }
                updateCurrentMission({
                  parentFolderId: folderId,
                  name: finalName,
                  isDraft: false
                });
                toast.success('Rota salva na Central de Missões!');
              }}
            />
          </div>
        )}

        {/* MÓDULO RELATÓRIO TÁTICO */}
        {activeView === 'report' && (
          <div id="modulo-relatorio" className="w-full h-full flex-1 min-h-0 border border-slate-700 rounded-xl overflow-y-auto bg-slate-800/90 flex flex-col">
            <MissionReportPanel 
              hidrantes={reportMode === 'mission' ? hidrantes.filter(h => selectedMissionIds.includes(h.codHidrante) || selectedMissionIds.includes(h.nomHidrante) || selectedMissionIds.includes(h._internalId)) : filteredList}
              currentMission={reportMode === 'mission' ? currentMission : null}
              onClose={() => { setActiveView('map'); setReportMode('global'); }}
              currentUser={currentUser}
              isMissionReport={reportMode === 'mission'}
            />
          </div>
        )}
      </main>

      {/* BARRA DE NAVEGAÇÃO INFERIOR ERGONÔMICA NO MOBILE (BOTTOM NAV) */}
      {!isMapFullscreen && (
        <nav className="md:hidden flex-shrink-0 bg-slate-900/95 border-t border-slate-700/80 backdrop-blur-md px-2 py-1.5 z-30 flex items-center justify-around shadow-lg">
          <button
            onClick={() => setActiveView('map')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
              activeView === 'map' ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapIcon size={20} className={activeView === 'map' ? 'text-emerald-400' : ''} />
            <span className="text-[10px] font-semibold mt-0.5">Mapa</span>
          </button>

          <button
            onClick={() => setActiveView('table')}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
              activeView === 'table' ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List size={20} className={activeView === 'table' ? 'text-emerald-400' : ''} />
            <span className="text-[10px] font-semibold mt-0.5">Lista</span>
          </button>

          <button
            onClick={() => setActiveView('route')}
            disabled={!activeMissionId}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all relative ${
              activeView === 'route' 
                ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 font-bold' 
                : (!activeMissionId ? 'text-slate-600 opacity-50' : 'text-slate-400 hover:text-slate-200')
            }`}
          >
            <Navigation size={20} className={activeView === 'route' ? 'text-emerald-400' : ''} />
            <span className="text-[10px] font-semibold mt-0.5">Rota</span>
            {selectedMissionIds.length > 0 && (
              <span className="absolute top-0.5 right-3 bg-emerald-500 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow">
                {selectedMissionIds.length}
              </span>
            )}
          </button>

          {(currentUser?.role === 'gestor' || currentUser?.role === 'admin') && (
            <button
              onClick={() => setActiveView('report')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
                activeView === 'report' ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 size={20} className={activeView === 'report' ? 'text-emerald-400' : ''} />
              <span className="text-[10px] font-semibold mt-0.5">Relatório</span>
            </button>
          )}
        </nav>
      )}

      {/* Barramento de Seleção Inferior (Desktop apenas) */}
      <footer className={isMapFullscreen ? "hidden" : "hidden md:flex bg-slate-900 border-t border-slate-700 p-3 justify-between items-center z-20"}>
        <div className="flex flex-col">
          <div className="text-sm font-semibold text-slate-400">
            {activeMissionId ? (
              <>
                <span className="text-emerald-400 font-bold">{selectedMissionIds.length}</span> hidrantes na {currentMission?.name} 
                {completedMissionIds.length > 0 && ` (${completedMissionIds.length} concluídos)`}
              </>
            ) : (
              <span>Selecione ou crie uma Missão na Central</span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 opacity-60 mt-0.5 tracking-wide">
            Desenvolvido por Sgt Roméro
          </span>
        </div>
      </footer>

      {isMissionManagerOpen && (
        <MissionManagerModal 
          missions={missions}
          folders={folders}
          openMissionIds={openMissionIds}
          onClose={() => setIsMissionManagerOpen(false)}
          onOpenMission={handleOpenMission}
          onNewMission={handleNewMission}
          onDeleteMission={handleDeleteMission}
          onFoldersChange={setFolders}
          onMissionsChange={setMissions}
          currentUser={currentUser}
        />
      )}
      {/* Toasts */}
      <ToastContainer theme="dark" position="bottom-center" />

      <TechnicalStudyModal
        isOpen={isTechnicalStudyOpen}
        onClose={() => setIsTechnicalStudyOpen(false)}
        hidrantes={hidrantes}
        currentUser={currentUser}
      />
    </div>
  );
}

export default App;
