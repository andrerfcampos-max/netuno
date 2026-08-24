import { useState, useMemo, useEffect, useRef } from 'react';
import { Upload, GitMerge, FolderOpen, PlusCircle, Calculator, LogOut, ShieldAlert, RefreshCw, Map as MapIcon, List, Navigation, BarChart3, Cloud, Building2 } from 'lucide-react';
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
import BuildingStudiesModal from './components/BuildingStudiesModal';
import InconsistentHydrantsModal from './components/InconsistentHydrantsModal';
import CloudConfigModal from './components/CloudConfigModal';
import ErrorBoundary from './components/ErrorBoundary';
import { loadPreloadedDatabase } from './utils/xlsxParser';
import { loadMissions, saveMissions, createNewMission, loadFolders, saveFolders, loadHydrantChanges, saveHydrantChanges, loadActiveMissionState, saveActiveMissionState, mergeMissions, mergeFolders } from './utils/storage';
import { fetchMissionsFromCloud, syncMissionToCloud, deleteMissionFromCloud, fetchFoldersFromCloud, syncFolderToCloud, syncInspectionToCloud, syncHydrantMutationToCloud, fetchHydrantMutationsFromCloud, subscribeToCloudRealtime } from './services/syncService';
import { isCloudConfigured } from './services/supabase';
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

const normalizeSearchText = (str) => {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const getFilteredData = (filters = {}, dataList = []) => {
  let result = [...dataList];

  // 1. Filtro por Região Administrativa (RA)
  if (filters.ra && String(filters.ra).trim() !== '') {
    const targetRA = normalizeRAName(filters.ra);
    result = result.filter(h => {
      const hRA = normalizeRAName(h.dscLocalidade);
      return hRA === targetRA || (h.dscLocalidade && h.dscLocalidade.toLowerCase() === filters.ra.toLowerCase());
    });
  }

  // 2. Filtro de Busca Livre Inteligente (conectado à Cidade/RA e cruzando todos os campos)
  if (filters.buscaGeral && String(filters.buscaGeral).trim() !== '') {
    const termoNorm = normalizeSearchText(filters.buscaGeral);
    const palavras = termoNorm.split(/\s+/).filter(Boolean);
    if (palavras.length > 0) {
      result = result.filter(h => {
        const nom = normalizeSearchText(h.nomHidrante);
        const cod = normalizeSearchText(h.codHidrante);
        const end = normalizeSearchText(h.dscEndereco);
        const ref = normalizeSearchText(h.dscPontoReferencia);
        const loc = normalizeSearchText(h.dscLocalidade);
        const prob = normalizeSearchText(h.problemasHidrante);
        
        // Todas as palavras digitadas devem estar presentes em algum dos campos do hidrante
        return palavras.every(palavra => 
          nom.includes(palavra) || 
          cod.includes(palavra) || 
          end.includes(palavra) || 
          ref.includes(palavra) || 
          loc.includes(palavra) ||
          prob.includes(palavra)
        );
      });
    }
  }
  if (filters.periodo && String(filters.periodo).trim() !== '') {
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
  if (filters.problema && String(filters.problema).trim() !== '') {
    const targetProb = String(filters.problema).toUpperCase().trim();
    result = result.filter(h => {
      if (!h.problemasHidrante) return false;
      const list = extractProblemsList(String(h.problemasHidrante));
      return list.some(p => String(p).toUpperCase().includes(targetProb));
    });
  }
  return result;
};

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('netuno_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [hidrantes, setHidrantes] = useState([]);
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

  const filteredList = useMemo(() => {
    return getFilteredData(activeFilters, hidrantes);
  }, [activeFilters, hidrantes]);

  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [inspectingHidrante, setInspectingHidrante] = useState(null);
  const [editingHydrante, setEditingHydrante] = useState(null);
  const [lastInspectedCoords, setLastInspectedCoords] = useState(null);
  const [mapCenterPosition, setMapCenterPosition] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Controle de Missões Persistentes
  const [missions, setMissions] = useState(loadMissions());
  const [folders, setFolders] = useState(loadFolders());
  const savedMissionState = useMemo(() => loadActiveMissionState(), []);
  const [openMissionIds, setOpenMissionIds] = useState(savedMissionState.openMissionIds || []);
  const [activeMissionId, setActiveMissionId] = useState(savedMissionState.activeMissionId || null);
  const [isMissionManagerOpen, setIsMissionManagerOpen] = useState(false);
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);
  const [isTechnicalStudyOpen, setIsTechnicalStudyOpen] = useState(false);
  const [isBuildingStudiesOpen, setIsBuildingStudiesOpen] = useState(false);
  const [isInconsistentModalOpen, setIsInconsistentModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Fecha o menu suspenso ao clicar em qualquer lugar fora da tela
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMenuOpen]);

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

  const isCitySelected = useMemo(() => {
    return Boolean(activeFilters?.ra && activeFilters.ra.trim() !== '');
  }, [activeFilters?.ra]);

  const mapHidrantes = useMemo(() => {
    if (mapCenterPosition) {
      const exists = filteredList.some(h => (h.codHidrante === mapCenterPosition.codHidrante && h.nomHidrante === mapCenterPosition.nomHidrante) || (h._internalId && h._internalId === mapCenterPosition._internalId));
      if (isCitySelected) {
        return exists ? filteredList : [...filteredList, mapCenterPosition];
      }
      return [mapCenterPosition];
    }
    if (!isCitySelected) {
      return [];
    }
    return filteredList;
  }, [isCitySelected, mapCenterPosition, filteredList]);

  // Suporte a abertura direta de modais e deep links de hidrante (?hid=...) via URL parameter
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const modal = params.get('modal') || params.get('view');
    if ((modal === 'estudo-tecnico' || modal === 'technical-study') && (currentUser?.role === 'gestor' || currentUser?.role === 'admin')) {
      setIsTechnicalStudyOpen(true);
    } else if ((modal === 'estudo-edificacoes' || modal === 'estudo-edificacao' || modal === 'building-study' || modal === 'ppo') && (currentUser?.role === 'gestor' || currentUser?.role === 'admin')) {
      setIsBuildingStudiesOpen(true);
    } else if ((modal === 'novo-hidrante' || modal === 'new-hydrant') && (currentUser?.role === 'gestor' || currentUser?.role === 'admin')) {
      setEditingHydrante({});
    } else if (modal === 'admin' && currentUser?.role === 'admin') {
      setIsUserManagerOpen(true);
    } else if (modal === 'inconsistentes' && (currentUser?.role === 'gestor' || currentUser?.role === 'admin')) {
      setIsInconsistentModalOpen(true);
    } else if (modal === 'central-missoes' || modal === 'missoes' || modal === 'missions') {
      setIsMissionManagerOpen(true);
    }

    const hidParam = params.get('hid') || params.get('hidrante') || params.get('id');
    if (hidParam && hidrantes.length > 0) {
      const target = hidrantes.find(h => 
        String(h.nomHidrante || '').trim().toUpperCase() === hidParam.trim().toUpperCase() ||
        String(h.codHidrante || '').trim().toUpperCase() === hidParam.trim().toUpperCase() ||
        String(h._internalId || '').trim().toUpperCase() === hidParam.trim().toUpperCase()
      );
      if (target) {
        setMapCenterPosition({ ...target, _ts: Date.now() });
        setActiveView('map');
      }
    }
  }, [currentUser, hidrantes]);

  const handleCloseTechnicalStudy = () => {
    setIsTechnicalStudyOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has('modal')) {
      url.searchParams.delete('modal');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  };

  const handleCloseBuildingStudies = () => {
    setIsBuildingStudiesOpen(false);
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
    const isGestor = currentUser?.role === 'gestor' || currentUser?.role === 'admin';
    if (isGestor) {
      setInspectingHidrante(h);
      return;
    }

    const bloqueioMsg = "vc está a mais de 100 M de distância do hidrante. Não pode. Se houver problemas técnico, envie o relatório da vistoria através do sei para GPCIU/sehur";

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!pos || !pos.coords) {
            alert(bloqueioMsg);
            return;
          }
          const distKm = calculateDistance(pos.coords.latitude, pos.coords.longitude, h.numLatitude, h.numLongitude);
          const distMeters = distKm * 1000;
          if (distMeters > 100) {
            alert(bloqueioMsg);
          } else {
            setInspectingHidrante(h);
          }
        },
        (err) => {
          console.warn('Erro ao obter GPS do vistoriador:', err);
          alert(bloqueioMsg);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
      );
    } else {
      alert(bloqueioMsg);
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

  // Sincroniza abas abertas e missão ativa com LocalStorage
  useEffect(() => {
    saveActiveMissionState({ openMissionIds, activeMissionId });
  }, [openMissionIds, activeMissionId]);

  // Sincronização com o Banco de Dados em Nuvem (Supabase / Cloud DB)
  useEffect(() => {
    const syncWithCloud = async () => {
      if (!isCloudConfigured()) return;

      try {
        const [cloudMissions, cloudFolders, cloudMutations] = await Promise.all([
          fetchMissionsFromCloud(),
          fetchFoldersFromCloud(),
          fetchHydrantMutationsFromCloud()
        ]);

        if (Array.isArray(cloudMissions)) {
          setMissions(prevMissions => {
            const merged = mergeMissions(prevMissions, cloudMissions);
            saveMissions(merged);
            return merged;
          });
        }

        if (Array.isArray(cloudFolders) && cloudFolders.length > 0) {
          setFolders(prevFolders => {
            const merged = mergeFolders(prevFolders, cloudFolders);
            saveFolders(merged);
            return merged;
          });
        }

        if (cloudMutations) {
          const localChanges = loadHydrantChanges();
          const mergedChanges = {
            updated: { ...localChanges.updated, ...cloudMutations.updated },
            added: [...localChanges.added, ...cloudMutations.added.filter(ca => !localChanges.added.some(la => (la._internalId || la.codHidrante) === (ca._internalId || ca.codHidrante)))],
            deleted: Array.from(new Set([...localChanges.deleted, ...cloudMutations.deleted]))
          };
          saveHydrantChanges(mergedChanges);

          if (hidrantes.length > 0) {
            let updatedHidrantes = hidrantes.filter(h => !mergedChanges.deleted.includes(h._internalId) && !mergedChanges.deleted.includes(h.codHidrante) && !mergedChanges.deleted.includes(h.nomHidrante));
            updatedHidrantes = updatedHidrantes.map(h => {
              const k = h._internalId || h.codHidrante || h.nomHidrante;
              return mergedChanges.updated[k] ? { ...h, ...mergedChanges.updated[k] } : h;
            });
            setHidrantes(updatedHidrantes);
          }
        }
      } catch (e) {
        console.warn('Erro ao sincronizar com banco em nuvem:', e);
      }
    };

    syncWithCloud();

    // Listener Realtime (WebSockets) para atualizações instantâneas entre Mobile e Desktop
    const unsubscribe = subscribeToCloudRealtime({
      onMissionsChange: (freshMissions) => {
        if (Array.isArray(freshMissions)) {
          setMissions(prevMissions => {
            const merged = mergeMissions(prevMissions, freshMissions);
            saveMissions(merged);
            return merged;
          });
        }
      },
      onFoldersChange: (freshFolders) => {
        if (Array.isArray(freshFolders)) {
          setFolders(prevFolders => {
            const merged = mergeFolders(prevFolders, freshFolders);
            saveFolders(merged);
            return merged;
          });
        }
      },
      onHydrantChange: () => {
        syncWithCloud();
      }
    });

    // Polling inteligente a cada 15 segundos
    const pollInterval = setInterval(() => {
      if (isCloudConfigured() && navigator.onLine) {
        syncWithCloud();
      }
    }, 15000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [hidrantes.length]);

  // Hidratação por Link Mágico (?ds=ID1,ID2) e Carregamento Automático com Fusão de Mutações
  useEffect(() => {
    // 1. Carregar Base Pre-carregada automaticamente se estiver vazio e aplicar mutações persistidas
    if (hidrantes.length === 0) {
      loadPreloadedDatabase((data) => {
        if (data.length > 0) {
          const changes = loadHydrantChanges();
          // 1. Filtra excluídos
          let merged = data.filter(h => {
            const delKeys = [h._internalId, h.codHidrante, h.nomHidrante].filter(Boolean);
            return !delKeys.some(k => changes.deleted.includes(k));
          });
          // 2. Aplica alterações/vistorias cadastradas
          merged = merged.map(h => {
            const idKey = h._internalId || h.codHidrante || h.nomHidrante;
            if (changes.updated && changes.updated[idKey]) {
              return { ...h, ...changes.updated[idKey] };
            }
            return h;
          });
          // 3. Anexa novos hidrantes cadastrados
          if (changes.added && changes.added.length > 0) {
            merged = [...merged, ...changes.added];
          }

          setHidrantes(merged);
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
        const newMission = createNewMission("Missão Importada", null, currentUser);
        newMission.selectedIds = ids;
        newMission.createdBy = currentUser?.matricula;
        newMission.createdByName = currentUser?.nome;
        setMissions(prev => [...prev, newMission]);
        setOpenMissionIds(prev => [...prev, newMission.id]);
        setActiveMissionId(newMission.id);
        setActiveView('route');
        syncMissionToCloud(newMission);
        // Limpa a URL para não duplicar no F5
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [hidrantes.length]);

  const updateCurrentMission = (updates) => {
    if (!activeMissionId) return;
    let target = null;
    setMissions(prev => prev.map(m => {
      if (m.id === activeMissionId) {
        target = { ...m, ...updates, updatedAt: new Date().toISOString() };
        return target;
      }
      return m;
    }));
    if (target) {
      syncMissionToCloud(target);
    }
  };

  const toggleMissionSelection = (id) => {
    let currentM = missions.find(m => m.id === activeMissionId);
    let createdMission = null;

    if (!currentM) {
      createdMission = createNewMission("Rascunho de Hoje", null, currentUser);
      createdMission.createdBy = currentUser?.matricula;
      createdMission.createdByName = currentUser?.nome;
      currentM = createdMission;
    }

    const currentSel = currentM.selectedIds || [];
    const currentComp = currentM.completedIds || [];

    const newSelected = currentSel.includes(id) 
      ? currentSel.filter(missionId => missionId !== id) 
      : [...currentSel, id];
    
    const newCompleted = currentSel.includes(id)
      ? currentComp.filter(cId => cId !== id)
      : currentComp;

    const target = {
      ...currentM,
      selectedIds: newSelected,
      completedIds: newCompleted,
      updatedAt: new Date().toISOString()
    };

    if (createdMission) {
      setMissions(prev => [...prev.filter(m => m.id !== target.id), target]);
      setOpenMissionIds(prev => prev.includes(target.id) ? prev : [...prev, target.id]);
      setActiveMissionId(target.id);
    } else {
      setMissions(prev => prev.map(m => m.id === target.id ? target : m));
    }

    syncMissionToCloud(target);
  };

  const selectAllFiltered = (isChecked, currentFilteredData) => {
    let currentM = missions.find(m => m.id === activeMissionId);
    let createdMission = null;

    if (!currentM) {
      createdMission = createNewMission("Rascunho de Hoje", null, currentUser);
      createdMission.createdBy = currentUser?.matricula;
      createdMission.createdByName = currentUser?.nome;
      currentM = createdMission;
    }

    const currentSel = currentM.selectedIds || [];
    const currentComp = currentM.completedIds || [];

    const filteredIds = currentFilteredData.map(h => h.codHidrante || h.nomHidrante || h._internalId);
    let newSelected = currentSel;
    let newCompleted = currentComp;
    
    if (isChecked) {
      const idsToAdd = filteredIds.filter(id => !currentSel.includes(id));
      newSelected = [...currentSel, ...idsToAdd];
    } else {
      newSelected = currentSel.filter(id => !filteredIds.includes(id));
      newCompleted = currentComp.filter(id => !filteredIds.includes(id));
    }

    const target = {
      ...currentM,
      selectedIds: newSelected,
      completedIds: newCompleted,
      updatedAt: new Date().toISOString()
    };

    if (createdMission) {
      setMissions(prev => [...prev.filter(m => m.id !== target.id), target]);
      setOpenMissionIds(prev => prev.includes(target.id) ? prev : [...prev, target.id]);
      setActiveMissionId(target.id);
    } else {
      setMissions(prev => prev.map(m => m.id === target.id ? target : m));
    }

    syncMissionToCloud(target);
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
    if (activeFilters.ra && activeFilters.ra.trim() !== '') {
      const targetRA = normalizeRAName(activeFilters.ra);
      baseList = baseList.filter(h => normalizeRAName(h.dscLocalidade) === targetRA || h.dscLocalidade === activeFilters.ra);
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
    if (activeFilters.ra && activeFilters.ra.trim() !== '') {
      const targetRA = normalizeRAName(activeFilters.ra);
      baseList = baseList.filter(h => normalizeRAName(h.dscLocalidade) === targetRA || h.dscLocalidade === activeFilters.ra);
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
      });
    }
  };

  const handleFilterChange = (filters) => {
    setActiveFilters(filters);
    try {
      localStorage.setItem('netuno_saved_filters', JSON.stringify(filters));
    } catch (e) {}
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
    
    // Grava alteração no localStorage para persistir após F5
    const changes = loadHydrantChanges();
    const idKey = sanitized._internalId || sanitized.codHidrante || sanitized.nomHidrante;
    changes.updated[idKey] = sanitized;
    saveHydrantChanges(changes);

    const id = sanitized.codHidrante || sanitized.nomHidrante;
    if (activeMissionId && selectedMissionIds.includes(id) && !completedMissionIds.includes(id)) {
      updateCurrentMission({ completedIds: [...completedMissionIds, id] });
    }

    setLastInspectedCoords({ lat: sanitized.numLatitude, lng: sanitized.numLongitude });
    setInspectingHidrante(null);
    syncInspectionToCloud(sanitized);
    syncHydrantMutationToCloud('update', sanitized);
    toast.success('Vistoria salva com sucesso e sincronizada!');
  };

  const handleSaveEdit = (updatedHidrante) => {
    const sanitized = {
      ...updatedHidrante,
      dscLocalidade: normalizeRAName(updatedHidrante.dscLocalidade)
    };
    let exists = false;
    const isExisting = Boolean(sanitized._internalId);
    
    let newHidrantes = [];
    const changes = loadHydrantChanges();

    if (isExisting) {
      newHidrantes = hidrantes.map(h => {
        if (h._internalId === sanitized._internalId) {
          exists = true;
          return sanitized;
        }
        return h;
      });
      if (exists) {
        changes.updated[sanitized._internalId] = sanitized;
      }
    }

    if (!exists) {
      const newEntity = {
        ...sanitized,
        _internalId: `hid_new_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      };
      newHidrantes = isExisting ? [...newHidrantes, newEntity] : [...hidrantes, newEntity];
      changes.added.push(newEntity);
    }
    
    saveHydrantChanges(changes);
    setHidrantes(newHidrantes);
    handleCloseEditHydrant();
    syncHydrantMutationToCloud(isExisting ? 'update' : 'add', sanitized);
    toast.success('Hidrante salvo com sucesso e sincronizado!');
  };

  const handleDeleteHydrant = (hydrantToDelete) => {
    const delId = hydrantToDelete._internalId || hydrantToDelete.codHidrante || hydrantToDelete.nomHidrante;
    const newHidrantes = hidrantes.filter(h => {
      if (hydrantToDelete._internalId && h._internalId) {
        return h._internalId !== hydrantToDelete._internalId;
      }
      const idA = hydrantToDelete.codHidrante || hydrantToDelete.nomHidrante;
      const idB = h.codHidrante || h.nomHidrante;
      return idA !== idB;
    });
    
    const changes = loadHydrantChanges();
    if (!changes.deleted.includes(delId)) {
      changes.deleted.push(delId);
    }
    changes.added = changes.added.filter(h => (h._internalId || h.codHidrante) !== delId);
    delete changes.updated[delId];
    saveHydrantChanges(changes);

    setHidrantes(newHidrantes);
    syncHydrantMutationToCloud('delete', delId);
    toast.success('Hidrante excluído da base com sucesso!');
  };

  // ---- Controle de Missões ----
  const handleNewMission = (parentFolderId = null) => {
    const newMission = createNewMission("Rascunho de Hoje", parentFolderId, currentUser);
    newMission.createdBy = currentUser?.matricula;
    newMission.createdByName = currentUser?.nome;
    setMissions(prev => [...prev, newMission]);
    setOpenMissionIds(prev => [...prev, newMission.id]);
    setActiveMissionId(newMission.id);
    syncMissionToCloud(newMission);
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
    setMissions(prev => {
      const updated = prev.filter(m => m.id !== id);
      saveMissions(updated);
      return updated;
    });
    handleCloseTab(id);
    deleteMissionFromCloud(id);
  };

  const handleFoldersChange = (newFolders) => {
    setFolders(newFolders);
    saveFolders(newFolders);
    if (Array.isArray(newFolders)) {
      newFolders.forEach(f => syncFolderToCloud(f));
    }
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
          <p className="text-slate-400 text-center text-xs sm:text-sm mb-6 leading-relaxed">Sistema de mapeamento de hidrantes urbanos e estudos das edificações para operações de incêndio</p>
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
          <p className="text-[11px] text-slate-500 text-center mt-5 font-medium tracking-wide select-none">
            Desenvolvido por Sgt Roméro
          </p>
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
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <h1 className="text-xl font-bold tracking-tight text-emerald-400 drop-shadow-md shrink-0">NETUNO</h1>
          <span className="hidden sm:inline-block text-[11px] lg:text-xs text-slate-400 font-medium border-l border-slate-700 pl-3 leading-tight line-clamp-2 max-w-xl">
            Sistema de mapeamento de hidrantes urbanos e estudos das edificações para operações de incêndio
          </span>
        </div>
        
        <div className="relative z-50 flex items-center gap-2 shrink-0">
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
            <div className="relative" ref={menuRef}>
              <button 
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 text-emerald-400 font-semibold rounded shadow-sm cursor-pointer hover:bg-slate-700 active:scale-95 transition-all relative select-none"
              >
                <span className="hidden sm:inline">Menu</span>
                {inconsistentCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping absolute top-2 right-2"></span>
                )}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>

              {isMenuOpen && (
                <>
                  {/* Backdrop para fechar ao clicar em qualquer lugar da tela */}
                  <div 
                    className="fixed inset-0 z-[110]" 
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl flex flex-col gap-1.5 p-2 z-[120] animate-scaleUp">
                    {currentUser.role === 'admin' && (
                      <a 
                        href="?modal=admin"
                        onClick={(e) => {
                          if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                            e.preventDefault();
                            setIsUserManagerOpen(true);
                            setIsMenuOpen(false);
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
                            setIsMenuOpen(false);
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
                        href="?modal=estudo-edificacoes"
                        onClick={(e) => {
                          if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                            e.preventDefault();
                            setIsBuildingStudiesOpen(true);
                            setIsMenuOpen(false);
                          }
                        }}
                        className="flex items-start gap-2.5 w-full px-3 py-2 text-left bg-gradient-to-r from-amber-950/50 to-red-950/40 border border-amber-500/30 text-amber-300 font-semibold rounded-lg hover:from-amber-900/70 hover:to-red-900/60 transition-all group"
                      >
                        <Building2 size={18} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-amber-300 group-hover:text-white transition-colors">
                            Estudo de edificações
                          </span>
                          <span className="text-[11px] text-slate-400 font-normal leading-tight group-hover:text-slate-300 transition-colors">
                            informações importantes para operações de incêndio
                          </span>
                        </div>
                      </a>
                    )}
                    {(currentUser.role === 'admin' || currentUser.role === 'gestor') && (
                      <a 
                        href="?modal=estudo-tecnico"
                        onClick={(e) => {
                          if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                            e.preventDefault();
                            setIsTechnicalStudyOpen(true);
                            setIsMenuOpen(false);
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
                            setIsMenuOpen(false);
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
                          setIsMenuOpen(false);
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
                        setIsMenuOpen(false);
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

                    <div className="pt-2 mt-1 border-t border-slate-700/60 text-center text-[10px] text-slate-500 font-medium select-none">
                      Desenvolvido por Sgt Roméro
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>



      {/* MÓDULO 1: BARRA DE FILTROS FIXA NO TOPO (SEMPRE VISÍVEL) */}
      {!isMapFullscreen && (
        <div className="flex-shrink-0 px-2 pt-1.5 z-20 w-full">
          <FilterBar 
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange} 
            regions={regions} 
            anos={anosVistoria} 
            problemasAtivos={problemasVistoria} 
            isVisible={!isMapFullscreen} 
            currentUser={currentUser} 
            onLogout={handleLogout}
            filteredCount={filteredList.length}
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
                  : (selectedMissionIds.length === 0 
                     ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200' 
                     : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-200')
              }`}
            >
              Rota de Missão ({selectedMissionIds.length})
            </button>
            {(currentUser?.role === 'gestor' || currentUser?.role === 'admin') && (
              <button 
                onClick={() => setActiveView('report')}
                className={`min-h-[38px] sm:min-h-[40px] py-1.5 px-2 border rounded-lg text-xs sm:text-sm font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center truncate ${
                  activeView === 'report' ? 'bg-emerald-600 border-emerald-500 text-white ring-2 ring-emerald-400/30' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                Relatórios
              </button>
            )}
          </div>
        </div>
      )}

      {/* ÁREA PRINCIPAL DE CONTEÚDO */}
      <main 
        className={isMapFullscreen ? "h-full w-full p-0 m-0 relative" : "flex-1 min-h-0 w-full relative p-2 pt-0 flex flex-col select-none overflow-hidden"}
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
              isCitySelected={isCitySelected}
              hasFilter={Boolean(isCitySelected || hasSecondaryFilter)}
              selectedCity={activeFilters?.ra}
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
        {activeView === 'route' && (
          <div id="modulo-rota" className="w-full h-full flex-1 min-h-0 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
            <MissionRoutePanel 
              hidrantes={hidrantes}
              selectedMissionIds={selectedMissionIds}
              completedMissionIds={completedMissionIds}
              currentMission={currentMission}
              onUpdateMission={(updates) => updateCurrentMission(updates)}
              onClose={() => setActiveView('map')}
              onBackToManager={() => setIsMissionManagerOpen(true)}
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
                let targetMission = missions.find(m => m.id === activeMissionId);
                const finalName = (newName && newName.trim()) ? newName.trim() : (targetMission?.name || 'Nova Rota');
                
                const isDuplicate = missions.some(m => 
                  m.id !== activeMissionId && 
                  (m.parentFolderId || null) === (folderId || null) && 
                  (m.name || '').trim().toLowerCase() === finalName.toLowerCase()
                );
                if (isDuplicate) {
                  if (!window.confirm(`Já existe uma missão com o nome "${finalName}" nesta pasta. Deseja salvar assim mesmo e duplicar?`)) {
                    return;
                  }
                }

                if (!targetMission) {
                  const created = createNewMission(finalName, folderId, currentUser);
                  created.selectedIds = [...selectedMissionIds];
                  created.completedIds = [...completedMissionIds];
                  created.isDraft = false;
                  created.createdBy = currentUser?.matricula;
                  created.createdByName = currentUser?.nome;
                  created.updatedAt = new Date().toISOString();

                  setMissions(prev => {
                    const updated = [...prev.filter(m => m.id !== created.id), created];
                    saveMissions(updated);
                    return updated;
                  });
                  setOpenMissionIds(prev => prev.includes(created.id) ? prev : [...prev, created.id]);
                  setActiveMissionId(created.id);
                  syncMissionToCloud(created);
                } else {
                  const updatedMission = {
                    ...targetMission,
                    parentFolderId: folderId,
                    name: finalName,
                    isDraft: false,
                    updatedAt: new Date().toISOString()
                  };

                  setMissions(prev => {
                    const updated = prev.map(m => m.id === targetMission.id ? updatedMission : m);
                    saveMissions(updated);
                    return updated;
                  });
                  syncMissionToCloud(updatedMission);
                }

                toast.success(`Rota "${finalName}" salva com sucesso na Central de Missões!`);
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

      {/* BARRA DE NAVEGAÇÃO INFERIOR ERGONÔMICA NO MOBILE (BOTTOM NAV FIXA) */}
      {!isMapFullscreen && (
        <nav className="md:hidden flex-shrink-0 bg-slate-900/98 border-t border-slate-700/90 backdrop-blur-md px-2 py-1 z-40 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.5)] min-h-[52px]">
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
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all relative ${
              activeView === 'route' 
                ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 font-bold' 
                : (selectedMissionIds.length === 0 ? 'text-slate-400 hover:text-slate-200' : 'text-slate-300 hover:text-slate-200')
            }`}
          >
            <Navigation size={20} className={activeView === 'route' ? 'text-emerald-400' : ''} />
            <span className="text-[10px] font-semibold mt-0.5">Rota de Missão</span>
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
              <span className="text-[10px] font-semibold mt-0.5">Relatórios</span>
            </button>
          )}
        </nav>
      )}

      {/* Barramento de Seleção Inferior (Desktop apenas) */}
      <footer className={isMapFullscreen ? "hidden" : "hidden md:flex bg-slate-900 border-t border-slate-700 p-3 justify-between items-center z-20"}>
        <div className="flex flex-col">
          {activeMissionId && (
            <div className="text-sm font-semibold text-slate-400">
              <span className="text-emerald-400 font-bold">{selectedMissionIds.length}</span> hidrantes na {currentMission?.name} 
              {completedMissionIds.length > 0 && ` (${completedMissionIds.length} concluídos)`}
            </div>
          )}
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
          onFoldersChange={handleFoldersChange}
          onMissionsChange={setMissions}
          currentUser={currentUser}
        />
      )}

      {isCloudModalOpen && (
        <CloudConfigModal 
          onClose={() => setIsCloudModalOpen(false)}
          onSyncNow={async () => {
            toast.info('Sincronizando dados com o Supabase...');
            try {
              if (Array.isArray(missions)) {
                for (const m of missions) await syncMissionToCloud(m);
              }
              if (Array.isArray(folders)) {
                for (const f of folders) await syncFolderToCloud(f);
              }
              toast.success('Banco de Dados em Nuvem sincronizado com sucesso!');
            } catch (err) {
              toast.error('Falha ao sincronizar: ' + err.message);
            }
          }}
        />
      )}

      {/* Toasts */}
      <ToastContainer theme="dark" position="bottom-center" />

      <TechnicalStudyModal
        isOpen={isTechnicalStudyOpen}
        onClose={handleCloseTechnicalStudy}
        hidrantes={hidrantes}
        currentUser={currentUser}
      />

      <BuildingStudiesModal
        isOpen={isBuildingStudiesOpen}
        onClose={handleCloseBuildingStudies}
        allHydrantes={hidrantes}
        currentUser={currentUser}
      />
    </div>
  );
}

export default App;
