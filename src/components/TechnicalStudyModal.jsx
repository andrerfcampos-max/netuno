import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Map as MapIcon, Calculator, FileText, CheckCircle, XCircle, Crosshair, MapPin, Copy, Check, Upload, ImagePlus, Search, ChevronDown, CheckCircle2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RA_LIST, normalizeRAName } from '../utils/raList';
import { isValidDFCoordinate } from '../utils/geoUtils';

// Fix icons
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
  const [results, setResults] = useState(null);

  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);

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
    
    // Filtra hidrantes com coordenadas válidas
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

  const handleProcess = () => {
    const polyCoords = parseCoordinates(rawPolygon);
    const waterCoords = parseCoordinates(rawWaterNetwork);
    const radius = getRadius();
    let targetPos = null;
    let evalHydrant = null;

    if (studyType === 'relocation') {
      evalHydrant = hidrantes.find(h => 
        (h.codHidrante && h.codHidrante.trim().toLowerCase() === targetCode.trim().toLowerCase()) || 
        (h.nomHidrante && h.nomHidrante.trim().toLowerCase() === targetCode.trim().toLowerCase())
      );
      if (!evalHydrant) {
        alert("Hidrante não encontrado na base de dados. Utilize a lista suspensa para selecionar o código correto.");
        return;
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
      // Regra de Adjacência:
      // Todo hidrante cuja distância até o alvo seja d <= 2R (interseção entre círculos de cobertura)
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

    const city = normalizeRAName(evalHydrant ? evalHydrant.dscLocalidade : selectedRA);
    const otherCityHydrants = hidrantes.filter(h => {
      if (!isValidDFCoordinate(h.numLatitude, h.numLongitude)) return false;
      const sameCity = normalizeRAName(h.dscLocalidade) === city;
      const isTarget = evalHydrant && (h.codHidrante === evalHydrant.codHidrante || h._internalId === evalHydrant._internalId);
      const isAdjacent = adjacentHydrants.some(adj => adj.codHidrante === h.codHidrante || adj._internalId === h._internalId);
      return sameCity && !isTarget && !isAdjacent;
    });

    if (studyType === 'relocation' && targetPos) {
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

    setResults({
      polyCoords: studyType === 'relocation' ? [] : polyCoords,
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
    });
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

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 overflow-y-auto print:bg-white print:text-black">
      <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shadow-lg z-50 print:hidden">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="text-xs px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded font-semibold transition-colors flex items-center gap-1"
          >
            ← Voltar
          </button>
          <Calculator className="text-emerald-400" size={24} />
          <h2 className="text-xl font-bold text-white">Módulo de Estudo Técnico</h2>
        </div>
        <div className="flex items-center gap-3">
          {results && (
            <>
              <button 
                type="button"
                onClick={handleCopySEI} 
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                title="Copiar texto e tabela formatada para o SEI"
              >
                {copiedSEI ? <Check size={16} className="text-white" /> : <Copy size={16} />}
                {copiedSEI ? 'Copiado para SEI!' : 'Copiar Parecer (SEI)'}
              </button>
              <button 
                type="button"
                onClick={() => window.print()} 
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-semibold flex items-center gap-1.5 transition-colors border border-slate-600 shadow-sm"
              >
                <FileText size={16} /> Imprimir / PDF
              </button>
            </>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-red-400 p-1">
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Parâmetros do Estudo */}
        <div className="lg:col-span-4 space-y-4 print:hidden">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl">
            <h3 className="font-bold text-white text-base mb-3 border-b border-slate-700 pb-2 flex items-center gap-2">
              <MapPin size={18} className="text-emerald-400" /> Parâmetros de Entrada
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Documento de Solicitação (SEI/Ofício)</label>
                <input 
                  type="text" 
                  value={docRef} 
                  onChange={e => setDocRef(e.target.value)} 
                  placeholder="Ex: Memorando 123/2026 - CBMDF" 
                  className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-sm" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Informações Gerais / Solicitante (Item I)</label>
                <textarea 
                  value={infoGerais} 
                  onChange={e => setInfoGerais(e.target.value)} 
                  placeholder="Ex: Pleito solicitado pelo condomínio Alfa solicitando remoção para obras na calçada..." 
                  className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded h-20 text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Tipo de Estudo</label>
                <select value={studyType} onChange={e => setStudyType(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-sm">
                  <option value="relocation">Remanejamento / Remoção de Hidrante</option>
                  <option value="new_hydrant">Projeção de Novo Hidrante</option>
                </select>
              </div>

              {studyType === 'new_hydrant' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1">Região Administrativa (RA do Estudo)</label>
                  <select 
                    value={selectedRA} 
                    onChange={e => setSelectedRA(e.target.value)} 
                    className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  >
                    <option value="">Selecione uma RA...</option>
                    {RA_LIST.map(ra => (
                      <option key={ra.name} value={ra.name}>{ra.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Classificação da Ocupação (Raio NBR)</label>
                <select value={occupation} onChange={e => setOccupation(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-sm">
                  <option value="unifamiliar">Ocupação Unifamiliar (Raio 800m)</option>
                  <option value="verticalizada">Ocupação Verticalizada (Raio 600m)</option>
                  <option value="especiais">Ocupações Especiais (Raio 300m)</option>
                </select>
              </div>

              {studyType === 'relocation' && (
                <div className="relative" ref={dropdownRef}>
                  <label className="block text-sm font-semibold text-slate-400 mb-1">
                    Código do Hidrante Alvo
                    <span className="text-xs text-emerald-400 font-normal ml-1.5">(Busca rápida)</span>
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
                      placeholder="Digite o código (ex: GUA00101, 00101...)" 
                      className="w-full bg-slate-700 border border-slate-600 text-white p-2 pr-8 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono" 
                    />
                    <div 
                      className="absolute right-2 top-2.5 text-slate-400 cursor-pointer"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                      <ChevronDown size={18} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                    </div>
                  </div>

                  {/* Lista Suspensa (Dropdown Autocomplete) */}
                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-[100] max-h-56 overflow-y-auto divide-y divide-slate-700">
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

                  {/* Resumo do Hidrante Selecionado */}
                  {selectedHydrantObj && (
                    <div className="mt-2 p-2 bg-emerald-950/30 border border-emerald-800/40 rounded text-xs text-emerald-300 flex items-start gap-2">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1 truncate">
                        <strong>{selectedHydrantObj.nomHidrante || selectedHydrantObj.codHidrante}</strong> - {selectedHydrantObj.dscLocalidade}
                        <div className="text-[11px] text-slate-400 truncate">{selectedHydrantObj.dscEndereco}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Upload de Foto do Hidrante Atual */}
              <div className="flex flex-col gap-1.5 bg-slate-750 p-2.5 rounded border border-slate-700">
                <label className="block text-xs font-bold text-slate-300">Foto do Hidrante Atual (Motivo do Pleito)</label>
                {!fotoHidrante ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"
                  >
                    <ImagePlus size={16} /> Carregar Foto do Local
                  </button>
                ) : (
                  <div className="relative">
                    <img src={fotoHidrante} alt="Hidrante Atual" className="w-full h-28 object-cover rounded border border-slate-600" />
                    <button
                      type="button"
                      onClick={() => setFotoHidrante(null)}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow"
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
                  <label className="block text-sm font-semibold text-slate-400 mb-1">Poligonal das Edificações (Google Maps)</label>
                  <textarea value={rawPolygon} onChange={e => setRawPolygon(e.target.value)} placeholder="-16.000, -48.000&#10;-16.001, -48.001" className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded h-24 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Rede de Água CAESB (Opcional)</label>
                <textarea value={rawWaterNetwork} onChange={e => setRawWaterNetwork(e.target.value)} placeholder="-16.000, -48.000..." className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded h-16 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>

              <button type="button" onClick={handleProcess} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-emerald-900/50">
                <Calculator size={20} /> Processar Cálculo Espacial
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          {results ? (
            <>
              {/* Card de Status do Parecer */}
              <div className={`p-4 rounded-xl border flex items-center justify-between shadow-lg print:hidden ${results.isApproved ? 'bg-emerald-950/80 border-emerald-700 text-emerald-100' : 'bg-red-950/80 border-red-700 text-red-100'}`}>
                <div className="flex items-center gap-3">
                  {results.isApproved ? <CheckCircle size={32} className="text-emerald-400" /> : <XCircle size={32} className="text-red-400" />}
                  <div>
                    <h4 className="text-lg font-bold">
                      {results.isApproved ? 'PARECER FAVORÁVEL' : 'PARECER DESFAVORÁVEL'}
                    </h4>
                    <p className="text-xs opacity-90">
                      {results.isApproved 
                        ? (studyType === 'relocation' ? 'A área de cobertura do hidrante está 100% sobreposta por hidrantes adjacentes.' : 'A área atende integralmente ao raio de cobertura normativo.') 
                        : (studyType === 'relocation' ? 'A remoção deixará áreas descobertas fora do raio dos hidrantes adjacentes.' : 'Parte do polígono ultrapassa o raio normativo de cobertura.')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase font-bold tracking-wider">Raio Normativo</div>
                  <div className="text-xl font-black">{results.radius} metros</div>
                </div>
              </div>

              {/* Relatório SEI */}
              <div className="bg-white text-black p-8 rounded-xl shadow-2xl border border-slate-200 print:p-0 print:border-none print:shadow-none font-serif select-text">
                <div className="text-center border-b-2 border-black pb-4 mb-6">
                  <h3 className="font-bold text-sm tracking-wide uppercase">Corpo de Bombeiros Militar do Distrito Federal</h3>
                  <h4 className="font-bold text-xs uppercase text-slate-700">Comando Operacional - Diretoria de Serviços Técnicos</h4>
                  <h2 className="font-bold text-base mt-2 underline">PARECER TÉCNICO DE COBERTURA DE HIDRANTES URBANOS</h2>
                </div>

                <div className="space-y-4 text-justify text-sm leading-relaxed">
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
                    
                    <div className="my-4 border border-slate-300 rounded overflow-hidden">
                      <div className="h-96 w-full relative">
                        <MapContainer 
                          center={mapCenter} 
                          zoom={15} 
                          scrollWheelZoom={true} 
                          className="h-full w-full"
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

                          {/* Hidrantes Adjacentes - Marcadores Pretos com Circunferência Tracejada Preta */}
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

                          {/* Demais Hidrantes da Cidade (Não Adjacentes) - Pino Verde SEM Circunferência */}
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
                      <div className="bg-slate-50 border-t border-slate-300 p-3 text-xs flex flex-wrap gap-4 font-sans text-slate-700">
                        {studyType === 'relocation' && (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border-2 border-orange-500 bg-orange-100"></div>
                            <span className="font-semibold text-orange-950">Hidrante Alvo em Análise (Raio {results.radius}m - Tracejado Laranja)</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-black bg-slate-300" style={{ borderStyle: 'dashed' }}></div>
                          <span className="font-semibold text-slate-900">Hidrantes Adjacentes com Cobertura Concorrente (Raio {results.radius}m - Tracejado Preto)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm"></div>
                          <span className="font-semibold text-slate-700">Demais Hidrantes da Cidade (Pino Verde - Sem Sobreposição)</span>
                        </div>
                        {studyType === 'new_hydrant' && (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border-2 border-emerald-500 bg-emerald-100"></div>
                            <span className="font-semibold">Projeção da Nova Coordenada Sugerida</span>
                          </div>
                        )}
                        {studyType === 'new_hydrant' && (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded border-2 border-yellow-500 bg-yellow-100"></div>
                            <span className="font-semibold">Poligonal de Análise</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="mt-4 font-bold">Equipamentos Próximos e Adjacentes:</p>
                    <p>O levantamento da base de dados identificou os seguintes hidrantes adjacentes com áreas de cobertura coincidentes nas imediações do objeto estudado:</p>
                    
                    {/* TABELA DE EQUIPAMENTOS ADJACENTES EM TELA */}
                    <div className="overflow-x-auto border border-slate-300 rounded mt-2 mb-3 shadow-xs">
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
                      <div className="w-64 border-t border-black mx-auto mb-1"></div>
                      <p className="font-bold uppercase">{currentUser?.name || 'ANALISTA TÉCNICO'}</p>
                      <p className="text-xs">Matrícula: {currentUser?.matricula || currentUser?.username || '______'}</p>
                      <p className="text-xs">Assinatura Eletrônica</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/50 text-slate-500 font-bold p-10 text-center print:hidden">
              Preencha os parâmetros e processe o cálculo para gerar o mapa e o Relatório de Parecer Técnico.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TechnicalStudyModal;
