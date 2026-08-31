import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  X, 
  Map as MapIcon, 
  Calculator, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Crosshair, 
  MapPin, 
  Copy, 
  Check, 
  Upload, 
  ImagePlus, 
  Search, 
  ChevronDown, 
  CheckCircle2,
  Plus,
  Save,
  Trash2,
  Edit,
  Eye,
  ArrowLeft,
  Filter,
  Building,
  RotateCcw,
  Sparkles,
  Layers,
  FolderOpen
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RA_LIST, normalizeRAName } from '../utils/raList';
import { isValidDFCoordinate } from '../utils/geoUtils';
import { 
  getTechnicalStudies, 
  saveTechnicalStudy, 
  deleteTechnicalStudy 
} from '../utils/technicalStudiesStorage';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const customDivIcon = (color, borderColor = 'white', borderWidth = '3px') => L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: ${borderWidth} solid ${borderColor}; box-shadow: 0 0 10px rgba(0,0,0,0.6);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const parseCoordinates = (text) => {
  if (!text) return [];
  const regex = /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/g;
  const coords = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    coords.push({ lat: parseFloat(match[1]), lng: parseFloat(match[2]) });
  }
  return coords;
};

const getCentroid = (coords) => {
  if (coords.length === 0) return null;
  let sumLat = 0, sumLng = 0;
  coords.forEach(c => {
    sumLat += c.lat;
    sumLng += c.lng;
  });
  return { lat: sumLat / coords.length, lng: sumLng / coords.length };
};

const findClosestPointOnLines = (point, lines) => {
  if (!lines || lines.length === 0) return point;
  let closest = lines[0];
  let minDist = Infinity;
  lines.forEach(p => {
    const dist = calculateDistance(point.lat, point.lng, p.lat, p.lng);
    if (dist < minDist) {
      minDist = dist;
      closest = p;
    }
  });
  return closest;
};

const TechnicalStudyModal = ({ isOpen, onClose, hidrantes = [], currentUser }) => {
  // Controle de Visualização no padrão do PrePOP: 'list' (listagem de estudos salvos), 'form' (novo/edição de estudo)
  const [currentView, setCurrentView] = useState('list'); // 'list' | 'form'
  const [savedStudies, setSavedStudies] = useState(() => getTechnicalStudies());
  const [activeStudyId, setActiveStudyId] = useState(null);

  // Filtros na listagem
  const [listSearch, setListSearch] = useState('');
  const [listRA, setListRA] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Campos do Formulário / Estudo
  const [docRef, setDocRef] = useState('');
  const [infoGerais, setInfoGerais] = useState('');
  const [studyType, setStudyType] = useState('relocation');
  const [selectedRA, setSelectedRA] = useState('');
  const [occupation, setOccupation] = useState('unifamiliar');
  const [rawPolygon, setRawPolygon] = useState('');
  const [rawWaterNetwork, setRawWaterNetwork] = useState('');
  const [targetCode, setTargetCode] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [fotoHidrante, setFotoHidrante] = useState(null);
  const [copiedSEI, setCopiedSEI] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [results, setResults] = useState(null);

  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Recarregar estudos salvos ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      setSavedStudies(getTechnicalStudies());
    }
  }, [isOpen]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sugestões inteligentes para o autocomplete de código de hidrante
  const targetCodeSuggestions = useMemo(() => {
    const term = (targetCode || '').trim().toLowerCase().replace(/[\s-_]/g, '');
    const validHidrantes = hidrantes.filter(h => isValidDFCoordinate(h.numLatitude, h.numLongitude));

    if (!term) {
      if (selectedRA) {
        return validHidrantes
          .filter(h => normalizeRAName(h.dscLocalidade) === normalizeRAName(selectedRA))
          .slice(0, 15);
      }
      return validHidrantes.slice(0, 10);
    }

    return validHidrantes.filter(h => {
      const code = (h.nomHidrante || h.codHidrante || '').toLowerCase().replace(/[\s-_]/g, '');
      const addr = (h.dscEndereco || '').toLowerCase();
      const ra = (h.dscLocalidade || '').toLowerCase();
      return code.includes(term) || addr.includes(term) || ra.includes(term);
    }).slice(0, 20);
  }, [targetCode, hidrantes, selectedRA]);

  // Hidrante selecionado atual
  const selectedHydrantObj = useMemo(() => {
    if (!targetCode) return null;
    const term = targetCode.trim().toLowerCase();
    return hidrantes.find(h => 
      (h.nomHidrante && h.nomHidrante.trim().toLowerCase() === term) ||
      (h.codHidrante && h.codHidrante.trim().toLowerCase() === term)
    );
  }, [targetCode, hidrantes]);

  if (!isOpen) return null;

  const getRadius = () => {
    switch(occupation) {
      case 'unifamiliar': return 800;
      case 'verticalizada': return 600;
      case 'especiais': return 300;
      default: return 800;
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setFotoHidrante(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSuggestion = (h) => {
    const code = h.nomHidrante || h.codHidrante || '';
    setTargetCode(code);
    if (h.dscLocalidade) {
      setSelectedRA(normalizeRAName(h.dscLocalidade));
    }
    setIsDropdownOpen(false);
  };

  // Cálculo e Processamento Espacial
  const calculateStudy = (overrideParams = null) => {
    const activeDocRef = overrideParams ? overrideParams.docRef : docRef;
    const activeStudyType = overrideParams ? overrideParams.studyType : studyType;
    const activeRA = overrideParams ? overrideParams.selectedRA : selectedRA;
    const activeOcc = overrideParams ? overrideParams.occupation : occupation;
    const activeRawPoly = overrideParams ? overrideParams.rawPolygon : rawPolygon;
    const activeRawWater = overrideParams ? overrideParams.rawWaterNetwork : rawWaterNetwork;
    const activeTargetCode = overrideParams ? overrideParams.targetCode : targetCode;

    const polyCoords = parseCoordinates(activeRawPoly);
    const waterCoords = parseCoordinates(activeRawWater);
    
    let radius = 800;
    if (activeOcc === 'verticalizada') radius = 600;
    else if (activeOcc === 'especiais') radius = 300;

    let targetPos = null;
    let evalHydrant = null;

    if (activeStudyType === 'relocation') {
      evalHydrant = hidrantes.find(h => 
        (h.codHidrante && h.codHidrante.trim().toLowerCase() === (activeTargetCode || '').trim().toLowerCase()) || 
        (h.nomHidrante && h.nomHidrante.trim().toLowerCase() === (activeTargetCode || '').trim().toLowerCase())
      );
      if (!evalHydrant) {
        return { error: 'Hidrante não encontrado na base de dados. Utilize a busca para selecionar o código correto.' };
      }
      targetPos = { lat: parseFloat(evalHydrant.numLatitude), lng: parseFloat(evalHydrant.numLongitude) };
    }

    let suggestedPos = null;
    let maxDist = 0;
    let isApproved = false;

    const centroid = getCentroid(polyCoords);
    const refPos = targetPos || centroid;

    let adjacentHydrants = [];
    if (refPos) {
      const maxAdjacencyDistance = radius * 2;
      adjacentHydrants = hidrantes
        .filter(h => {
          if (!isValidDFCoordinate(h.numLatitude, h.numLongitude)) return false;
          if (evalHydrant && (h.codHidrante === evalHydrant.codHidrante || h._internalId === evalHydrant._internalId)) return false;
          const d = calculateDistance(refPos.lat, refPos.lng, h.numLatitude, h.numLongitude);
          return d <= maxAdjacencyDistance;
        })
        .map(h => ({
          ...h,
          distanceToTarget: calculateDistance(refPos.lat, refPos.lng, h.numLatitude, h.numLongitude)
        }))
        .sort((a, b) => a.distanceToTarget - b.distanceToTarget);
    }

    const city = normalizeRAName(evalHydrant ? evalHydrant.dscLocalidade : activeRA);
    const otherCityHydrants = hidrantes.filter(h => {
      if (!isValidDFCoordinate(h.numLatitude, h.numLongitude)) return false;
      const sameCity = normalizeRAName(h.dscLocalidade) === city;
      const isTarget = evalHydrant && (h.codHidrante === evalHydrant.codHidrante || h._internalId === evalHydrant._internalId);
      const isAdjacent = adjacentHydrants.some(adj => adj.codHidrante === h.codHidrante || adj._internalId === h._internalId);
      return sameCity && !isTarget && !isAdjacent;
    });

    if (activeStudyType === 'relocation' && targetPos) {
      const samplePoints = [];
      samplePoints.push({ lat: targetPos.lat, lng: targetPos.lng });

      const rings = [
        { rFraction: 0.33, count: 12 },
        { rFraction: 0.66, count: 24 },
        { rFraction: 0.85, count: 24 },
        { rFraction: 1.00, count: 24 }
      ];

      rings.forEach(ring => {
        const ringRadius = radius * ring.rFraction;
        for (let i = 0; i < ring.count; i++) {
          const angle = (i / ring.count) * 2 * Math.PI;
          const dLat = (ringRadius * Math.cos(angle)) / 111320;
          const dLng = (ringRadius * Math.sin(angle)) / (111320 * Math.cos(targetPos.lat * Math.PI / 180));
          samplePoints.push({
            lat: targetPos.lat + dLat,
            lng: targetPos.lng + dLng
          });
        }
      });

      let allCovered = true;
      let maxDistToCover = 0;

      samplePoints.forEach(point => {
        let pointCovered = false;
        let closestDist = Infinity;
        adjacentHydrants.forEach(h => {
          const d = calculateDistance(point.lat, point.lng, h.numLatitude, h.numLongitude);
          if (d < closestDist) closestDist = d;
          if (d <= radius) pointCovered = true;
        });
        if (closestDist > maxDistToCover) maxDistToCover = closestDist;
        if (!pointCovered) allCovered = false;
      });

      maxDist = maxDistToCover;
      isApproved = allCovered && adjacentHydrants.length > 0;
    } else {
      if (centroid && polyCoords.length > 0) {
        suggestedPos = centroid;
        if (waterCoords.length > 0) {
          suggestedPos = findClosestPointOnLines(centroid, waterCoords);
        }
        
        maxDist = 0;
        polyCoords.forEach(v => {
          const d = calculateDistance(suggestedPos.lat, suggestedPos.lng, v.lat, v.lng);
          if (d > maxDist) maxDist = d;
        });
        isApproved = maxDist <= radius;
      }
    }

    return {
      polyCoords: activeStudyType === 'relocation' ? [] : polyCoords,
      waterCoords,
      radius,
      targetPos,
      evalHydrant,
      suggestedPos,
      maxDist,
      isApproved,
      adjacentHydrants,
      otherCityHydrants,
      city
    };
  };

  const handleProcess = () => {
    const calc = calculateStudy();
    if (calc.error) {
      alert(calc.error);
      return;
    }
    setResults(calc);
  };

  // Salvar ou Atualizar Estudo Técnico
  const handleSaveTechnicalStudy = () => {
    let calc = results;
    if (!calc) {
      calc = calculateStudy();
      if (calc.error) {
        alert(calc.error);
        return;
      }
      setResults(calc);
    }

    const studyPayload = {
      id: activeStudyId,
      docRef: docRef.trim() || 'Estudo Técnico S/N',
      infoGerais: infoGerais.trim(),
      studyType,
      selectedRA: selectedRA || (calc.evalHydrant?.dscLocalidade) || 'Brasília',
      occupation,
      targetCode: targetCode.trim(),
      rawPolygon,
      rawWaterNetwork,
      fotoHidrante,
      isApproved: calc.isApproved,
      radius: calc.radius,
      maxDist: calc.maxDist,
      suggestedPos: calc.suggestedPos,
      adjacentCount: (calc.adjacentHydrants || []).length
    };

    const res = saveTechnicalStudy(studyPayload, currentUser);
    if (res.success) {
      setSavedStudies(res.data);
      if (res.savedStudy?.id) {
        setActiveStudyId(res.savedStudy.id);
      }
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3500);
    } else {
      alert('Erro ao salvar estudo técnico.');
    }
  };

  // Abrir Estudo Salvo da Lista
  const handleOpenSavedStudy = (study) => {
    setActiveStudyId(study.id);
    setDocRef(study.docRef || '');
    setInfoGerais(study.infoGerais || '');
    setStudyType(study.studyType || 'relocation');
    setSelectedRA(study.selectedRA || '');
    setOccupation(study.occupation || 'unifamiliar');
    setRawPolygon(study.rawPolygon || '');
    setRawWaterNetwork(study.rawWaterNetwork || '');
    setTargetCode(study.targetCode || '');
    setFotoHidrante(study.fotoHidrante || null);

    const calc = calculateStudy(study);
    if (!calc.error) {
      setResults(calc);
    }
    setCurrentView('form');
  };

  // Iniciar Novo Cadastro Limpo
  const handleStartNewStudy = () => {
    setActiveStudyId(null);
    setDocRef('');
    setInfoGerais('');
    setStudyType('relocation');
    setSelectedRA('');
    setOccupation('unifamiliar');
    setRawPolygon('');
    setRawWaterNetwork('');
    setTargetCode('');
    setFotoHidrante(null);
    setResults(null);
    setCurrentView('form');
  };

  // Excluir Estudo
  const handleDeleteStudy = (id) => {
    const res = deleteTechnicalStudy(id);
    if (res.success) {
      setSavedStudies(res.data);
      setDeleteConfirmId(null);
      if (activeStudyId === id) {
        handleStartNewStudy();
        setCurrentView('list');
      }
    }
  };

  const mapCenter = results?.polyCoords?.[0] || results?.targetPos || [-15.793, -47.882];
  
  const getOccupationName = () => {
    if (occupation === 'unifamiliar') return 'Ocupação Unifamiliar (Adensada, comercial, horizontalizadas)';
    if (occupation === 'verticalizada') return 'Ocupação Verticalizada (Adensada e baixa mobilidade)';
    return 'Ocupações Especiais (Hospitais, shoppings, escolas)';
  };

  const handleCopySEI = async () => {
    if (!results) return;
    try {
      let html = `<div style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #000; text-align: justify;">`;
      
      // Item I - REFERÊNCIA
      html += `<p><strong>I - REFERÊNCIA</strong></p>`;
      html += `<p>De acordo com a solicitação contida no <strong>${docRef || '[Inserir Documento SEI]'}</strong>, a qual versa sobre o estudo técnico de <strong>${studyType === 'relocation' ? 'Remanejamento/remoção de hidrante instalado' : 'Projeção de novo hidrante'}</strong> na localidade especificada.</p>`;
      if (infoGerais && infoGerais.trim()) {
        html += `<p>${infoGerais.trim()}</p>`;
      }

      // Item II - FINALIDADE
      html += `<p><strong>II - FINALIDADE</strong></p>`;
      html += `<p>Emitir parecer técnico sobre a cobertura e viabilidade espacial do sistema de hidrantes urbanos de incêndio para a área em questão, em conformidade com a normatização vigente.</p>`;
      if (fotoHidrante) {
        html += `<p style="text-align: center; margin: 15px 0;"><img src="${fotoHidrante}" style="max-width: 450px; height: auto; border: 1px solid #ccc; border-radius: 4px;" alt="Situação do Hidrante Atual" /><br><small style="color: #666;">Figura 1: Registro fotográfico da situação motivadora do pleito.</small></p>`;
      }

      // Item III - FUNDAMENTAÇÃO LEGAL
      html += `<p><strong>III - FUNDAMENTAÇÃO LEGAL</strong></p>`;
      html += `<p>O presente Parecer possui amparo legal no Decreto Nº 7.163, de 29 de abril de 2010, que regulamenta o inciso I do art. 10-B da Lei nº 8.255, de 20 de novembro de 1991. Regulamento de Segurança Contra Incêndio e Pânico do Distrito Federal - RSIP, aprovado pelo Dec. 21.361, de 20 jul. 2000, publicado no DODF nº 1.398/00.</p>`;

      // Item IV - METODOLOGIA E FATOS OBSERVADOS
      html += `<p><strong>IV - METODOLOGIA E FATOS OBSERVADOS</strong></p>`;
      html += `<p><strong>Classificação da Ocupação:</strong> A área em estudo classifica-se como ${getOccupationName()}.</p>`;
      html += `<p><strong>Exigência Normativa:</strong> Conforme a norma ABNT NBR 12.218/2017, a ocupação predominante exige um raio de cobertura de até <strong>${results.radius} metros</strong> a partir do hidrante para garantir a proteção de todas as edificações contidas no perímetro.</p>`;
      
      html += `<p><strong>Equipamentos Próximos e Adjacentes:</strong></p>`;
      html += `<p>O levantamento da base de dados identificou os seguintes hidrantes adjacentes com áreas de cobertura coincidentes nas imediações do objeto estudado:</p>`;
      
      // TABELA SEI DE EQUIPAMENTOS ADJACENTES
      html += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; margin: 12px 0; border: 1px solid #666;">`;
      html += `<thead>`;
      html += `<tr style="background-color: #f2f2f2; font-weight: bold; text-align: left;">`;
      html += `<th style="border: 1px solid #666; padding: 6px;">Código</th>`;
      html += `<th style="border: 1px solid #666; padding: 6px;">Distância ao Alvo</th>`;
      html += `<th style="border: 1px solid #666; padding: 6px;">Coordenadas Geográficas</th>`;
      html += `<th style="border: 1px solid #666; padding: 6px;">Endereço / Localidade</th>`;
      html += `<th style="border: 1px solid #666; padding: 6px; text-align: center;">Status</th>`;
      html += `</tr>`;
      html += `</thead>`;
      html += `<tbody>`;

      if (results.adjacentHydrants && results.adjacentHydrants.length > 0) {
        results.adjacentHydrants.forEach(h => {
          const lat = Number(h.numLatitude).toFixed(6);
          const lng = Number(h.numLongitude).toFixed(6);
          const dist = Math.round(h.distanceToTarget);
          const statusText = h.flgAtivo ? 'OPERANTE' : 'INOPERANTE';
          const statusColor = h.flgAtivo ? '#166534' : '#991b1b';
          
          html += `<tr>`;
          html += `<td style="border: 1px solid #666; padding: 6px; font-weight: bold;">${h.nomHidrante || h.codHidrante}</td>`;
          html += `<td style="border: 1px solid #666; padding: 6px;">${dist} metros</td>`;
          html += `<td style="border: 1px solid #666; padding: 6px; font-family: monospace;">(${lat}, ${lng})</td>`;
          html += `<td style="border: 1px solid #666; padding: 6px;">${h.dscEndereco || h.dscLocalidade || '-'}</td>`;
          html += `<td style="border: 1px solid #666; padding: 6px; text-align: center; color: ${statusColor}; font-weight: bold;">${statusText}</td>`;
          html += `</tr>`;
        });
      } else {
        html += `<tr><td colspan="5" style="border: 1px solid #666; padding: 8px; text-align: center; font-style: italic;">Nenhum hidrante adjacente com raio coincidente encontrado.</td></tr>`;
      }
      html += `</tbody>`;
      html += `</table>`;

      html += `<p><strong>Processamento Espacial e Geodésico:</strong></p>`;
      if (studyType === 'relocation') {
        html += `<p>A análise computacional avaliou espacialmente a totalidade da área de cobertura do hidrante em questão. Verificou-se que ${results.isApproved ? "toda a área de cobertura do referido hidrante já pertence e encontra-se integralmente sobreposta pelas áreas de cobertura dos hidrantes adjacentes consolidados supracitados." : "a área de cobertura do referido hidrante NÃO está integralmente coberta pelos hidrantes adjacentes, havendo portanto déficit de proteção caso seja removido."}</p>`;
      } else {
        html += `<p>O sistema calculou as distâncias entre a coordenada alvo e os vértices do polígono. Maior distância identificada: <strong>${results.maxDist.toFixed(2)} metros.</strong></p>`;
      }

      // Item V - PARECER TÉCNICO
      html += `<p><strong>V - PARECER TÉCNICO</strong></p>`;
      html += `<p>Com base no processamento das coordenadas e na normatização técnica aplicável, o analista signatário possui o seguinte parecer:</p>`;
      if (results.isApproved) {
        html += `<p style="margin-left: 20px;"><strong>1 - FAVORÁVEL</strong> ao pleito de ${studyType === 'relocation' ? 'REMOÇÃO/REMANEJAMENTO' : 'INSTALAÇÃO'}. ${studyType === 'relocation' ? 'Visualiza-se que a região permanece integralmente coberta e protegida pelos hidrantes adjacentes.' : `A maior distância identificada do equipamento até o limite da área é de ${results.maxDist.toFixed(2)} metros, atestando que a totalidade das edificações do polígono encontra-se coberta dentro do raio normativo.`}</p>`;
      } else {
        html += `<p style="margin-left: 20px;"><strong>1 - DESFAVORÁVEL</strong> ao pleito em sua coordenada original / configuração atual, pois ${studyType === 'relocation' ? 'a remoção acarretará em déficit de proteção contra incêndio na região' : `a distância do equipamento até o vértice da área atinge ${results.maxDist.toFixed(2)} metros, ultrapassando o limite normativo exigido para o local.`}</p>`;
        if (results.suggestedPos) {
          html += `<p style="margin-left: 20px;"><strong>2 - SUGESTÃO TÉCNICA:</strong> Para garantir que toda a área fique coberta, sugere-se a instalação/remanejamento de um hidrante para a coordenada centralizada aproximada <strong>${results.suggestedPos.lat.toFixed(6)}, ${results.suggestedPos.lng.toFixed(6)}</strong> ${results.waterCoords.length > 0 ? 'sobre o trecho da rede de água existente.' : '.'}</p>`;
        }
      }
      html += `<p>Este é o Parecer.</p>`;
      html += `</div>`;

      const plainText = html.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n');

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' })
        })
      ]);

      setCopiedSEI(true);
      setTimeout(() => setCopiedSEI(false), 3000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
      alert('Não foi possível copiar automaticamente para a área de transferência.');
    }
  };

  // Filtragem da lista de estudos salvos
  const filteredSavedStudies = savedStudies.filter(s => {
    const matchRA = !listRA || normalizeRAName(s.selectedRA) === normalizeRAName(listRA);
    const term = listSearch.trim().toLowerCase();
    const matchSearch = !term || 
      (s.docRef && s.docRef.toLowerCase().includes(term)) ||
      (s.targetCode && s.targetCode.toLowerCase().includes(term)) ||
      (s.infoGerais && s.infoGerais.toLowerCase().includes(term)) ||
      (s.analistaNome && s.analistaNome.toLowerCase().includes(term));
    return matchRA && matchSearch;
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/95 overflow-y-auto print:bg-white print:text-black flex flex-col">
      {/* CABEÇALHO PRINCIPAL ULTRA-RESPONSIVO COM ISOLAMENTO DE Z-INDEX */}
      <div className="sticky top-0 bg-slate-900 border-b border-slate-700/80 px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xl z-[1050] print:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-950/50 shrink-0">
            <Calculator size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
              Parecer Técnico de Hidrante
            </h2>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Dimensionamento e Viabilidade Espacial • ABNT NBR 12.218/2017
            </span>
          </div>
        </div>

        {/* BARRA DE AÇÕES DO TOPO */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 ml-auto shrink-0">
          {currentView === 'list' ? (
            <button
              type="button"
              onClick={handleStartNewStudy}
              className="h-8.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Novo Estudo</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setCurrentView('list')}
                className="h-8.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 transition-colors cursor-pointer"
                title="Ver lista de estudos cadastrados"
              >
                <FolderOpen size={14} className="text-amber-400" />
                <span className="hidden xs:inline">Estudos Salvos ({savedStudies.length})</span>
              </button>

              <button
                type="button"
                onClick={handleSaveTechnicalStudy}
                className={`h-8.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer ${
                  saveSuccessMsg 
                    ? 'bg-emerald-500 text-slate-950 font-black' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
                title="Salvar no banco de dados para consulta futura"
              >
                {saveSuccessMsg ? <Check size={15} strokeWidth={3} /> : <Save size={15} />}
                <span>{saveSuccessMsg ? 'Salvo no Banco!' : (activeStudyId ? 'Atualizar' : 'Salvar Estudo')}</span>
              </button>

              {results && (
                <>
                  <button 
                    type="button"
                    onClick={handleCopySEI} 
                    className="h-8.5 px-2.5 sm:px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                    title="Copiar texto e tabela formatada para o SEI"
                  >
                    {copiedSEI ? <Check size={14} className="text-white" /> : <Copy size={14} />}
                    <span className="hidden sm:inline">{copiedSEI ? 'Copiado!' : 'Copiar SEI'}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => window.print()} 
                    className="h-8.5 px-2.5 sm:px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border border-slate-700 shadow-sm cursor-pointer"
                    title="Imprimir ou Salvar em PDF"
                  >
                    <FileText size={14} />
                    <span className="hidden md:inline">PDF</span>
                  </button>
                </>
              )}
            </>
          )}

          <button 
            type="button"
            onClick={onClose} 
            className="h-8.5 w-8.5 flex items-center justify-center text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700/80 active:scale-95 transition-all cursor-pointer shrink-0"
            title="Fechar Modal"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VISTA 1: LISTAGEM DE ESTUDOS TÉCNICOS CADASTRADOS (PADRÃO PREPOP) */}
      {/* ======================================================== */}
      {currentView === 'list' && (
        <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 flex flex-col gap-4">
          {/* Banner Tático */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/50 flex items-center justify-center shrink-0">
                <Layers size={22} className="text-cyan-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Banco de Estudos e Pareceres Técnicos</h3>
                <p className="text-xs text-slate-400">
                  Consulte, edite ou exporte estudos de cobertura e dimensionamento de hidrantes previamente cadastrados.
                </p>
              </div>
            </div>
            <button
              onClick={handleStartNewStudy}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer active:scale-95 transition-all"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Cadastrar Novo Parecer</span>
            </button>
          </div>

          {/* Filtros de Busca na Lista */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 shadow-md">
            <div className="sm:col-span-4 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="Buscar por SEI, hidrante, solicitante..."
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="sm:col-span-4">
              <select
                value={listRA}
                onChange={e => setListRA(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">Todas as Cidades / RAs</option>
                {RA_LIST.map(ra => (
                  <option key={ra} value={ra}>{ra}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-4 flex items-center justify-end">
              <span className="text-xs font-bold text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                {filteredSavedStudies.length} {filteredSavedStudies.length === 1 ? 'estudo encontrado' : 'estudos encontrados'}
              </span>
            </div>
          </div>

          {/* Grid de Cards de Estudos Técnicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSavedStudies.length === 0 ? (
              <div className="col-span-full bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <FileText size={36} className="text-slate-600" />
                <p className="text-sm font-semibold">Nenhum estudo técnico encontrado com os filtros selecionados.</p>
                <button
                  onClick={handleStartNewStudy}
                  className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                >
                  Criar Primeiro Estudo
                </button>
              </div>
            ) : (
              filteredSavedStudies.map(s => {
                const isRelocation = s.studyType === 'relocation';
                const isApproved = s.isApproved;

                return (
                  <div 
                    key={s.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-lg transition-all"
                  >
                    <div>
                      {/* Topo do Card: Badge de Parecer e Tipo */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border flex items-center gap-1 ${
                          isApproved 
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' 
                            : 'bg-red-950/80 text-red-300 border-red-500/50'
                        }`}>
                          {isApproved ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          {isApproved ? 'FAVORÁVEL' : 'DESFAVORÁVEL'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                          {isRelocation ? 'Remoção / Remanejo' : 'Novo Hidrante'}
                        </span>
                      </div>

                      {/* Documento SEI e Cidade */}
                      <h4 className="font-bold text-sm text-white line-clamp-1">
                        {s.docRef || 'Estudo Técnico S/N'}
                      </h4>
                      <p className="text-xs text-cyan-400 font-semibold flex items-center gap-1 mt-0.5">
                        <MapPin size={12} className="shrink-0" />
                        {s.selectedRA || 'Distrito Federal'}
                        {s.targetCode && <span className="font-mono text-emerald-400 ml-1">({s.targetCode})</span>}
                      </p>

                      {s.infoGerais && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-2 bg-slate-850 p-2 rounded border border-slate-800">
                          {s.infoGerais}
                        </p>
                      )}

                      {/* Informações Técnicas */}
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-800 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Raio Normativo</span>
                          <span className="font-bold text-slate-200">{s.radius || 800}m</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Adjacentes</span>
                          <span className="font-bold text-slate-200">{s.adjacentCount || 0} hidrantes</span>
                        </div>
                      </div>
                    </div>

                    {/* Rodapé do Card: Analista, Data e Ações */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500">
                        {s.ultimaAtualizacao || s.dataCadastro} • {s.analistaNome || 'Analista CBMDF'}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenSavedStudy(s)}
                          className="p-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                          title="Abrir e Visualizar Parecer Completo"
                        >
                          <Eye size={14} />
                          <span>Ver</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(s.id)}
                          className="p-1.5 bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-500/50 rounded-lg text-xs transition-all cursor-pointer"
                          title="Excluir Estudo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Modal Confirmação de Exclusão */}
                    {deleteConfirmId === s.id && (
                      <div className="p-3 bg-red-950/90 border border-red-600 rounded-xl mt-2 flex flex-col gap-2">
                        <span className="text-xs text-red-200 font-bold">
                          Deseja realmente excluir este estudo técnico?
                        </span>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs rounded font-semibold"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleDeleteStudy(s.id)}
                            className="px-2.5 py-1 bg-red-600 text-white text-xs rounded font-bold"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA 2: FORMULÁRIO DE ENTRADA, CÁLCULO E PARECER TÉCNICO */}
      {/* ======================================================== */}
      {currentView === 'form' && (
        <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna da Esquerda: Parâmetros de Entrada */}
          <div className="lg:col-span-4 space-y-4 print:hidden">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                  <MapPin size={18} className="text-emerald-400" /> Parâmetros de Entrada
                </h3>
                {activeStudyId && (
                  <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-bold">
                    Editando Estudo
                  </span>
                )}
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Documento de Solicitação (SEI/Ofício) <span className="text-emerald-400">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={docRef} 
                    onChange={e => setDocRef(e.target.value)} 
                    placeholder="Ex: Memorando 123/2026 - CBMDF" 
                    className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs font-medium" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Informações Gerais / Solicitante (Item I)
                  </label>
                  <textarea 
                    value={infoGerais} 
                    onChange={e => setInfoGerais(e.target.value)} 
                    placeholder="Inserir informações complementares, histórico do solicitante, justificativa..." 
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl h-16 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tipo de Estudo</label>
                  <select 
                    value={studyType} 
                    onChange={e => {
                      setStudyType(e.target.value);
                      setResults(null);
                    }} 
                    className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-medium"
                  >
                    <option value="relocation">Remanejamento / Remoção de Hidrante Instalado</option>
                    <option value="new_hydrant">Projeção de Novo Hidrante</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Região Administrativa (RA)</label>
                  <select 
                    value={selectedRA} 
                    onChange={e => setSelectedRA(e.target.value)} 
                    className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-medium"
                  >
                    <option value="">Selecione a RA...</option>
                    {RA_LIST.map(ra => (
                      <option key={ra} value={ra}>{ra}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Classificação da Ocupação (ABNT NBR 12.218)</label>
                  <select 
                    value={occupation} 
                    onChange={e => setOccupation(e.target.value)} 
                    className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-medium"
                  >
                    <option value="unifamiliar">Unifamiliar (Adensada/Comercial/Horizontal) - Raio 800m</option>
                    <option value="verticalizada">Verticalizada (Adensada/Baixa mobilidade) - Raio 600m</option>
                    <option value="especiais">Ocupações Especiais (Hospitais, shoppings, escolas) - Raio 300m</option>
                  </select>
                </div>

                {studyType === 'relocation' && (
                  <div className="relative" ref={dropdownRef}>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Código do Hidrante Alvo <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={targetCode} 
                        onChange={e => {
                          setTargetCode(e.target.value);
                          setIsDropdownOpen(true);
                        }} 
                        onFocus={() => setIsDropdownOpen(true)}
                        placeholder="Buscar por código ou endereço..." 
                        className="w-full bg-slate-800 border border-slate-700 text-white pl-3 pr-8 py-2 rounded-xl font-mono text-xs focus:ring-1 focus:ring-emerald-500 outline-none" 
                      />
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {isDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-750">
                        {targetCodeSuggestions.length > 0 ? (
                          targetCodeSuggestions.map((h, idx) => {
                            const code = h.nomHidrante || h.codHidrante;
                            const isSelected = selectedHydrantObj && (selectedHydrantObj.nomHidrante === code || selectedHydrantObj.codHidrante === code);
                            return (
                              <button
                                key={h._internalId || code || idx}
                                type="button"
                                onClick={() => handleSelectSuggestion(h)}
                                className={`w-full text-left p-2.5 hover:bg-slate-700/80 transition-colors flex items-center justify-between gap-2 ${isSelected ? 'bg-emerald-950/40 border-l-4 border-emerald-500' : ''}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-emerald-400 text-xs">{code}</span>
                                    <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-medium">
                                      {h.dscLocalidade || 'Sem RA'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                    {h.dscEndereco || 'Endereço não informado'}
                                  </p>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${h.flgAtivo ? 'text-emerald-300 bg-emerald-950/60' : 'text-red-300 bg-red-950/60'}`}>
                                  {h.flgAtivo ? 'Operante' : 'Inoperante'}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-3 text-center text-xs text-slate-400 italic">
                            Nenhum hidrante encontrado com este termo.
                          </div>
                        )}
                      </div>
                    )}

                    {selectedHydrantObj && (
                      <div className="mt-2 p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                        <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                        <div className="flex-1 truncate">
                          <strong>{selectedHydrantObj.nomHidrante || selectedHydrantObj.codHidrante}</strong> - {selectedHydrantObj.dscLocalidade}
                          <div className="text-[11px] text-slate-400 truncate">{selectedHydrantObj.dscEndereco}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload de Foto do Hidrante */}
                <div className="flex flex-col gap-1.5 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <label className="block text-xs font-bold text-slate-300">Foto do Hidrante Atual (Motivo do Pleito)</label>
                  {!fotoHidrante ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 bg-slate-700/80 hover:bg-slate-700 border border-slate-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ImagePlus size={16} /> Carregar Foto do Local
                    </button>
                  ) : (
                    <div className="relative">
                      <img src={fotoHidrante} alt="Hidrante Atual" className="w-full h-28 object-cover rounded-lg border border-slate-600" />
                      <button
                        type="button"
                        onClick={() => setFotoHidrante(null)}
                        className="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow cursor-pointer"
                      >
                        Remover
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>

                {studyType === 'new_hydrant' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Poligonal das Edificações (Google Maps)</label>
                    <textarea value={rawPolygon} onChange={e => setRawPolygon(e.target.value)} placeholder="-16.000, -48.000&#10;-16.001, -48.001" className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl h-20 text-xs font-mono focus:ring-1 focus:ring-emerald-500 outline-none" />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Rede de Água CAESB (Opcional)</label>
                  <textarea value={rawWaterNetwork} onChange={e => setRawWaterNetwork(e.target.value)} placeholder="-16.000, -48.000..." className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl h-14 text-xs font-mono focus:ring-1 focus:ring-emerald-500 outline-none" />
                </div>

                {/* Botões de Ação do Formulário */}
                <div className="pt-2 flex flex-col gap-2">
                  <button 
                    type="button" 
                    onClick={handleProcess} 
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-emerald-950/50 cursor-pointer text-xs uppercase tracking-wide"
                  >
                    <Calculator size={17} /> Processar Cálculo Espacial
                  </button>

                  <button 
                    type="button" 
                    onClick={handleSaveTechnicalStudy} 
                    className="w-full bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs cursor-pointer"
                  >
                    <Save size={15} /> Salvar no Banco de Estudos
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna da Direita: Parecer Técnico Gerado e Mapa */}
          <div className="lg:col-span-8 space-y-4">
            {results ? (
              <>
                {/* Card de Status do Parecer */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg print:hidden ${results.isApproved ? 'bg-emerald-950/80 border-emerald-600 text-emerald-100' : 'bg-red-950/80 border-red-600 text-red-100'}`}>
                  <div className="flex items-center gap-3">
                    {results.isApproved ? <CheckCircle size={32} className="text-emerald-400 shrink-0" /> : <XCircle size={32} className="text-red-400 shrink-0" />}
                    <div>
                      <h4 className="text-base sm:text-lg font-bold">
                        {results.isApproved ? 'PARECER FAVORÁVEL' : 'PARECER DESFAVORÁVEL'}
                      </h4>
                      <p className="text-xs opacity-90">
                        {results.isApproved 
                          ? (studyType === 'relocation' ? 'A área de cobertura do hidrante está 100% sobreposta por hidrantes adjacentes.' : 'A área atende integralmente ao raio de cobertura normativo.') 
                          : (studyType === 'relocation' ? 'A remoção deixará áreas descobertas fora do raio dos hidrantes adjacentes.' : 'Parte do polígono ultrapassa o raio normativo de cobertura.')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">Raio Normativo</div>
                    <div className="text-lg sm:text-xl font-black">{results.radius}m</div>
                  </div>
                </div>

                {/* Relatório SEI com Mapa Integrado e Isolamento de Z-Index */}
                <div className="bg-white text-black p-4 sm:p-8 rounded-2xl shadow-2xl border border-slate-200 print:p-0 print:border-none print:shadow-none font-serif select-text">
                  <div className="text-center border-b-2 border-black pb-4 mb-6">
                    <h3 className="font-bold text-xs sm:text-sm tracking-wide uppercase">Corpo de Bombeiros Militar do Distrito Federal</h3>
                    <h4 className="font-bold text-[11px] uppercase text-slate-700">Comando Operacional - Diretoria de Serviços Técnicos</h4>
                    <h2 className="font-bold text-sm sm:text-base mt-2 underline">PARECER TÉCNICO DE COBERTURA DE HIDRANTES URBANOS</h2>
                  </div>

                  <div className="space-y-4 text-justify text-xs sm:text-sm leading-relaxed">
                    <section>
                      <h5 className="font-bold">I - REFERÊNCIA</h5>
                      <p>De acordo com a solicitação contida no <strong>{docRef || '[Inserir Documento SEI]'}</strong>, a qual versa sobre o estudo técnico de <strong>{studyType === 'relocation' ? 'Remanejamento/remoção de hidrante instalado' : 'Projeção de novo hidrante'}</strong> na localidade especificada.</p>
                      {infoGerais && infoGerais.trim() && (
                        <p className="mt-2">{infoGerais.trim()}</p>
                      )}
                    </section>

                    <section>
                      <h5 className="font-bold">II - FINALIDADE</h5>
                      <p>Emitir parecer técnico sobre a cobertura e viabilidade espacial do sistema de hidrantes urbanos de incêndio para a área em questão, em conformidade com a normatização vigente.</p>
                      {fotoHidrante && (
                        <div className="my-4 text-center">
                          <img src={fotoHidrante} alt="Registro Fotográfico" className="max-w-md max-h-64 object-contain mx-auto rounded border border-slate-300 shadow-sm" />
                          <span className="text-xs text-slate-500 block mt-1">Figura 1: Registro fotográfico da situação motivadora do pleito.</span>
                        </div>
                      )}
                    </section>

                    <section>
                      <h5 className="font-bold">III - FUNDAMENTAÇÃO LEGAL</h5>
                      <p>O presente Parecer possui amparo legal no Decreto Nº 7.163, de 29 de abril de 2010, que regulamenta o inciso I do art. 10-B da Lei nº 8.255, de 20 de novembro de 1991. Regulamento de Segurança Contra Incêndio e Pânico do Distrito Federal - RSIP, aprovado pelo Dec. 21.361, de 20 jul. 2000, publicado no DODF nº 1.398/00.</p>
                    </section>

                    <section>
                      <h5 className="font-bold">IV - METODOLOGIA E FATOS OBSERVADOS</h5>
                      <p><strong>Classificação da Ocupação:</strong> A área em estudo classifica-se como {getOccupationName()}.</p>
                      <p><strong>Exigência Normativa:</strong> Conforme a norma ABNT NBR 12.218/2017, a ocupação predominante exige um raio de cobertura de até <strong>{results.radius} metros</strong> a partir do hidrante para garantir a proteção de todas as edificações contidas no perímetro.</p>
                      
                      {/* CONTAINER DO MAPA COM ISOLAMENTO DE STACKING CONTEXT */}
                      <div className="my-4 border border-slate-300 rounded-xl overflow-hidden shadow-sm isolate relative z-0">
                        <div className="h-80 sm:h-96 w-full relative z-0">
                          <MapContainer 
                            center={mapCenter} 
                            zoom={15} 
                            scrollWheelZoom={true} 
                            className="h-full w-full relative z-0"
                          >
                            <TileLayer 
                              attribution='&copy; Google Maps'
                              url="https://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}"
                              maxZoom={20}
                            />
                            
                            {results.polyCoords.length > 0 && (
                              <Polygon positions={results.polyCoords} pathOptions={{ color: '#eab308', fillOpacity: 0.2 }} />
                            )}

                            {results.waterCoords.length > 0 && (
                              <Polyline positions={results.waterCoords} pathOptions={{ color: '#3b82f6', weight: 4 }} />
                            )}

                            {results.targetPos && (
                              <>
                                <Marker position={results.targetPos} icon={customDivIcon('#f97316', '#ffffff', '3.5px')}>
                                  <Popup>
                                    <strong>Hidrante em Avaliação</strong>
                                    <br />
                                    <span>{results.evalHydrant?.nomHidrante || results.evalHydrant?.codHidrante || 'Alvo'}</span>
                                  </Popup>
                                </Marker>
                                <Circle 
                                  center={results.targetPos} 
                                  radius={results.radius} 
                                  pathOptions={{ 
                                    color: '#f97316', 
                                    weight: 3, 
                                    fillColor: '#f97316', 
                                    fillOpacity: 0.1, 
                                    dashArray: '6, 6' 
                                  }} 
                                />
                              </>
                            )}

                            {/* Hidrantes Adjacentes */}
                            {(results.adjacentHydrants || []).map(h => (
                              <React.Fragment key={h.codHidrante || h._internalId || h.nomHidrante}>
                                <Marker position={[h.numLatitude, h.numLongitude]} icon={customDivIcon('#000000', '#ffffff', '3.5px')}>
                                  <Popup>
                                    <strong>{h.nomHidrante || h.codHidrante}</strong>
                                    <br />
                                    <span>{h.dscLocalidade || '-'}</span>
                                    <br />
                                    <span className="text-xs">{h.dscEndereco || '-'}</span>
                                    <br />
                                    <span className="text-xs font-semibold text-emerald-700">Distância: {Math.round(h.distanceToTarget)}m</span>
                                  </Popup>
                                </Marker>
                                <Circle 
                                  center={[h.numLatitude, h.numLongitude]} 
                                  radius={results.radius} 
                                  pathOptions={{ 
                                    color: '#000000', 
                                    weight: 2.5, 
                                    fillColor: '#000000', 
                                    fillOpacity: 0.05, 
                                    dashArray: '6, 6' 
                                  }} 
                                />
                              </React.Fragment>
                            ))}

                            {/* Demais Hidrantes da Cidade */}
                            {(results.otherCityHydrants || []).map(h => (
                              <Marker key={h.codHidrante || h._internalId || h.nomHidrante} position={[h.numLatitude, h.numLongitude]} icon={customDivIcon('#10b981', '#ffffff', '2px')}>
                                <Popup>
                                  <strong>{h.nomHidrante || h.codHidrante}</strong>
                                  <br />
                                  <span>{h.dscLocalidade || '-'}</span>
                                  <br />
                                  <span className="text-xs">{h.dscEndereco || '-'}</span>
                                </Popup>
                              </Marker>
                            ))}

                            {results.suggestedPos && (
                              <>
                                <Marker position={results.suggestedPos} icon={customDivIcon('#10b981', '#ffffff', '3px')}>
                                  <Popup>Coordenada Sugerida</Popup>
                                </Marker>
                                <Circle center={results.suggestedPos} radius={results.radius} pathOptions={{ color: '#10b981', fillOpacity: 0.1, dashArray: '5, 10' }} />
                              </>
                            )}
                          </MapContainer>
                        </div>

                        {/* Legenda do Mapa */}
                        <div className="bg-slate-50 border-t border-slate-300 p-3 text-xs flex flex-wrap gap-3 font-sans text-slate-700">
                          {studyType === 'relocation' && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-orange-500 bg-orange-100 shrink-0" />
                              <span className="font-semibold text-orange-950">Hidrante Alvo (Raio {results.radius}m - Tracejado Laranja)</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-black bg-slate-300 shrink-0" style={{ borderStyle: 'dashed' }} />
                            <span className="font-semibold text-slate-900">Hidrantes Adjacentes (Raio {results.radius}m - Tracejado Preto)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full border-2 border-white bg-emerald-500 shadow-sm shrink-0" />
                            <span className="font-semibold text-slate-700">Demais Hidrantes da Cidade (Verde)</span>
                          </div>
                          {studyType === 'new_hydrant' && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-500 bg-emerald-100 shrink-0" />
                              <span className="font-semibold">Nova Coordenada Sugerida</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="mt-4 font-bold">Equipamentos Próximos e Adjacentes:</p>
                      <p>O levantamento da base de dados identificou os seguintes hidrantes adjacentes com áreas de cobertura coincidentes nas imediações do objeto estudado:</p>
                      
                      {/* TABELA DE EQUIPAMENTOS ADJACENTES EM TELA */}
                      <div className="overflow-x-auto border border-slate-300 rounded-xl mt-2 mb-3 shadow-xs">
                        <table className="w-full text-left text-xs border-collapse bg-white">
                          <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                            <tr>
                              <th className="p-2 border-r border-slate-300">Código</th>
                              <th className="p-2 border-r border-slate-300">Distância ao Alvo</th>
                              <th className="p-2 border-r border-slate-300">Coordenadas (Lat, Lng)</th>
                              <th className="p-2 border-r border-slate-300">Endereço / Localidade</th>
                              <th className="p-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {results.adjacentHydrants && results.adjacentHydrants.length > 0 ? (
                              results.adjacentHydrants.map(h => (
                                <tr key={h.codHidrante || h._internalId} className="hover:bg-slate-50">
                                  <td className="p-2 font-mono font-bold text-slate-900 border-r border-slate-200">
                                    {h.nomHidrante || h.codHidrante}
                                  </td>
                                  <td className="p-2 font-semibold text-emerald-800 border-r border-slate-200">
                                    {Math.round(h.distanceToTarget)} m
                                  </td>
                                  <td className="p-2 font-mono text-slate-600 border-r border-slate-200">
                                    {Number(h.numLatitude).toFixed(6)}, {Number(h.numLongitude).toFixed(6)}
                                  </td>
                                  <td className="p-2 text-slate-700 border-r border-slate-200">
                                    {h.dscEndereco || h.dscLocalidade || '-'}
                                  </td>
                                  <td className="p-2 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${h.flgAtivo ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                                      {h.flgAtivo ? 'OPERANTE' : 'INOPERANTE'}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="5" className="p-3 text-center text-slate-500 italic">
                                  Nenhum hidrante adjacente com raio coincidente encontrado.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <p className="mt-4 font-bold">Processamento Espacial e Geodésico:</p>
                      {studyType === 'relocation' ? (
                        <p>
                          A análise computacional avaliou espacialmente a totalidade da área de cobertura do hidrante em questão. Verificou-se que {results.isApproved ? "toda a área de cobertura do referido hidrante já pertence e encontra-se integralmente sobreposta pelas áreas de cobertura dos hidrantes adjacentes consolidados supracitados." : "a área de cobertura do referido hidrante NÃO está integralmente coberta pelos hidrantes adjacentes, havendo portanto déficit de proteção caso seja removido."}
                        </p>
                      ) : (
                        <p>O sistema calculou as distâncias entre a coordenada alvo e os vértices do polígono. Maior distância identificada: <strong>{results.maxDist.toFixed(2)} metros.</strong></p>
                      )}
                    </section>

                    <section>
                      <h5 className="font-bold">V - PARECER TÉCNICO</h5>
                      <p>Com base no processamento das coordenadas e na normatização técnica aplicável, o analista signatário possui o seguinte parecer:</p>
                      <div className="mt-2 pl-4 border-l-2 border-slate-300">
                        {results.isApproved ? (
                          <p><strong>1 - FAVORÁVEL</strong> ao pleito de {studyType === 'relocation' ? 'REMOÇÃO/REMANEJAMENTO' : 'INSTALAÇÃO'}. {studyType === 'relocation' ? `Visualiza-se que a região permanece integralmente coberta e protegida pelos hidrantes adjacentes.` : `A maior distância identificada do equipamento até o limite da área é de ${results.maxDist.toFixed(2)} metros, atestando que a totalidade das edificações do polígono encontra-se coberta dentro do raio normativo.`}</p>
                        ) : (
                          <>
                            <p><strong>1 - DESFAVORÁVEL</strong> ao pleito em sua coordenada original / configuração atual, pois {studyType === 'relocation' ? 'a remoção acarretará em déficit de proteção contra incêndio na região' : `a distância do equipamento até o vértice da área atinge ${results.maxDist.toFixed(2)} metros, ultrapassando o limite normativo exigido para o local.`}</p>
                            {results.suggestedPos && (
                              <p className="mt-2"><strong>2 - SUGESTÃO TÉCNICA:</strong> Para garantir que toda a área fique coberta, sugere-se a instalação/remanejamento de um hidrante para a coordenada centralizada aproximada <strong>{results.suggestedPos.lat.toFixed(6)}, {results.suggestedPos.lng.toFixed(6)}</strong> {results.waterCoords.length > 0 ? 'sobre o trecho da rede de água existente.' : '.'}</p>
                            )}
                          </>
                        )}
                      </div>
                      <p className="mt-4">Este é o Parecer.</p>
                    </section>

                    <div className="pt-16 pb-8 text-center space-y-12 print:pt-32">
                      <div>
                        <div className="w-64 border-t border-black mx-auto mb-1" />
                        <p className="font-bold uppercase">{currentUser?.nome || currentUser?.name || 'ANALISTA TÉCNICO'}</p>
                        <p className="text-xs">Matrícula: {currentUser?.matricula || currentUser?.username || '______'}</p>
                        <p className="text-xs">Assinatura Eletrônica</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/50 text-slate-400 p-8 text-center print:hidden">
                <Calculator size={40} className="text-slate-600 mb-3" />
                <p className="text-sm font-bold text-white mb-1">Cálculo Espacial Pendente</p>
                <p className="text-xs text-slate-500 max-w-md">
                  Preencha os parâmetros de entrada na coluna ao lado e clique em "Processar Cálculo Espacial" para gerar o parecer e visualizar o mapa de cobertura.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalStudyModal;
