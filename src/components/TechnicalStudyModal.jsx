import React, { useState, useMemo, useRef } from 'react';
import { X, Map as MapIcon, Calculator, FileText, CheckCircle, XCircle, Crosshair, MapPin, Copy, Check, Upload, ImagePlus } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RA_LIST, normalizeRAName } from '../utils/raList';

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

const TechnicalStudyModal = ({ isOpen, onClose, hidrantes, currentUser }) => {
  const [docRef, setDocRef] = useState('');
  const [infoGerais, setInfoGerais] = useState('');
  const [studyType, setStudyType] = useState('relocation');
  const [selectedRA, setSelectedRA] = useState('');
  const [occupation, setOccupation] = useState('unifamiliar');
  const [rawPolygon, setRawPolygon] = useState('');
  const [rawWaterNetwork, setRawWaterNetwork] = useState('');
  const [targetCode, setTargetCode] = useState('');
  const [fotoHidrante, setFotoHidrante] = useState(null);
  const [copiedSEI, setCopiedSEI] = useState(false);
  const [results, setResults] = useState(null);

  const fileInputRef = useRef(null);

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
        const MAX_WIDTH = 900;
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
        alert("Hidrante não encontrado na base de dados. Verifique o código digitado.");
        return;
      }
      targetPos = { lat: parseFloat(evalHydrant.numLatitude), lng: parseFloat(evalHydrant.numLongitude) };
    }

    let suggestedPos = null;
    let maxDist = 0;
    let isApproved = false;
    let analysisPolyCoords = polyCoords;

    const centroid = getCentroid(polyCoords);
    const refPos = targetPos || centroid;

    let nearest = [];
    if (refPos) {
      // Nova regra de cálculo espacial:
      // Considerar na análise hidrantes adjacentes cujos raios de cobertura alcancem/cubram os pontos do perímetro da área de cobertura do hidrante alvo.
      const searchRadius = studyType === 'relocation' ? (radius * 2.1) : (radius * 3);
      nearest = hidrantes.filter(h => {
        if (evalHydrant && (h.codHidrante === evalHydrant.codHidrante || h._internalId === evalHydrant._internalId)) return false;
        const d = calculateDistance(refPos.lat, refPos.lng, h.numLatitude, h.numLongitude);
        return d <= searchRadius;
      }).sort((a, b) => {
        const da = calculateDistance(refPos.lat, refPos.lng, a.numLatitude, a.numLongitude);
        const db = calculateDistance(refPos.lat, refPos.lng, b.numLatitude, b.numLongitude);
        return da - db;
      }).slice(0, 8);
    }

    // Identificar a cidade (RA) do estudo
    const city = evalHydrant ? normalizeRAName(evalHydrant.dscLocalidade) : (selectedRA || (nearest[0] ? normalizeRAName(nearest[0].dscLocalidade) : ''));

    // Plotar todos os hidrantes da cidade referida no estudo
    const cityHydrants = hidrantes.filter(h => {
      if (evalHydrant && (h.codHidrante === evalHydrant.codHidrante || h._internalId === evalHydrant._internalId)) return false;
      const hRA = normalizeRAName(h.dscLocalidade);
      return city && hRA && hRA.toLowerCase() === city.toLowerCase();
    });

    // Unir hidrantes da cidade com adjacentes próximos (sem duplicar)
    const mapHydrantsMap = new Map();
    cityHydrants.forEach(h => mapHydrantsMap.set(h.codHidrante || h._internalId || h.nomHidrante, h));
    nearest.forEach(h => mapHydrantsMap.set(h.codHidrante || h._internalId || h.nomHidrante, h));
    const allMapAdjacentHydrants = Array.from(mapHydrantsMap.values());

    if (studyType === 'relocation') {
      analysisPolyCoords = [];
      for (let i = 0; i < 30; i++) {
        const angle = (i * 360 / 30) * Math.PI / 180;
        const dLat = (radius / 111320) * Math.cos(angle);
        const dLng = (radius / (111320 * Math.cos(targetPos.lat * Math.PI / 180))) * Math.sin(angle);
        analysisPolyCoords.push({ lat: targetPos.lat + dLat, lng: targetPos.lng + dLng });
      }

      let allCovered = true;
      let maxDistToCover = 0;

      analysisPolyCoords.forEach(point => {
        let pointCovered = false;
        let closestDist = Infinity;
        nearest.forEach(h => {
          const d = calculateDistance(point.lat, point.lng, h.numLatitude, h.numLongitude);
          if (d < closestDist) closestDist = d;
          if (d <= radius) pointCovered = true;
        });
        if (closestDist > maxDistToCover) maxDistToCover = closestDist;
        if (!pointCovered) allCovered = false;
      });

      maxDist = maxDistToCover;
      isApproved = allCovered;
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
      nearest,
      city,
      allMapAdjacentHydrants
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
      
      // Item I - REFERÊNCIA (sem cabeçalho de título nem assinatura, pronto para o SEI)
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
      
      html += `<p><strong>Equipamentos Próximos:</strong></p>`;
      html += `<p>O levantamento da base de dados identificou os seguintes hidrantes nas imediações do objeto estudado:</p>`;
      html += `<ul>`;
      if (results.nearest && results.nearest.length > 0) {
        results.nearest.forEach(h => {
          html += `<li><strong>Código:</strong> ${h.nomHidrante || h.codHidrante} | <strong>Coordenadas:</strong> (${h.numLatitude}, ${h.numLongitude}) | <strong>Endereço:</strong> ${h.dscEndereco || '-'}</li>`;
        });
      } else {
        html += `<li>Nenhum hidrante próximo encontrado.</li>`;
      }
      html += `</ul>`;

      html += `<p><strong>Processamento Espacial e Geodésico:</strong></p>`;
      if (studyType === 'relocation') {
        html += `<p>A análise computacional avaliou espacialmente a área de cobertura atual do hidrante em questão. Verificou-se que ${results.isApproved ? "toda a área de cobertura do referido hidrante já pertence à área de cobertura de outros hidrantes adjacentes consolidados supracitados." : "a área de cobertura do referido hidrante NÃO está integralmente coberta pelos hidrantes adjacentes, havendo portanto déficit de proteção caso seja removido."}</p>`;
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
        <div className="flex items-center gap-2">
          {results && (
            <button 
              type="button"
              onClick={handleCopySEI}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${copiedSEI ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
            >
              {copiedSEI ? <Check size={16} /> : <Copy size={16} />}
              {copiedSEI ? 'Copiado para SEI!' : 'Copiar Texto (Padrão SEI)'}
            </button>
          )}
          <button onClick={onClose} className="p-2 bg-slate-700 hover:bg-red-600 rounded-full transition-colors text-white">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 print:block print:p-0">
        <div className="lg:col-span-4 space-y-4 print:hidden">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
            <h3 className="text-lg font-bold text-slate-200 mb-3 border-b border-slate-700 pb-2">Parâmetros do Estudo</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Documento de Solicitação (Ref)</label>
                <input type="text" value={docRef} onChange={e => setDocRef(e.target.value)} placeholder="Ex: Memorando 123/2026 - SEI" className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
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
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1">Código do Hidrante Alvo</label>
                  <input type="text" value={targetCode} onChange={e => setTargetCode(e.target.value)} placeholder="Ex: GUA00101" className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
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
              <div className="bg-white text-black p-8 sm:p-12 rounded-xl shadow-lg font-serif text-[15px] print:shadow-none print:p-0 print:m-0 print:w-full print:page-break-before-always text-justify leading-relaxed">
                <div className="text-center mb-8">
                  <h1 className="font-bold text-lg uppercase">Governo do Distrito Federal</h1>
                  <h2 className="font-bold text-base uppercase">Corpo de Bombeiros Militar do Distrito Federal</h2>
                  <h3 className="font-bold text-sm uppercase">Subseção de Operações e Manutenção</h3>
                  <br />
                  <h4 className="font-bold text-base underline">Parecer Técnico n.º {Math.floor(Math.random()*9000)+1000}/{new Date().getFullYear()} - CBMDF/DIVIS/SEHUR/SUOMA</h4>
                </div>
                <div className="space-y-6">
                  <section>
                    <h5 className="font-bold">I - REFERÊNCIA</h5>
                    <p>De acordo com a solicitação contida no <strong>{docRef || '[Inserir Documento]'}</strong>, a qual versa sobre o estudo técnico de <strong>{studyType === 'relocation' ? 'Remanejamento/remoção de hidrante instalado' : 'Projeção de novo hidrante'}</strong> na localidade especificada.</p>
                    {infoGerais && infoGerais.trim() && (
                      <p className="mt-2">{infoGerais.trim()}</p>
                    )}
                  </section>
                  <section>
                    <h5 className="font-bold">II - FINALIDADE</h5>
                    <p>Emitir parecer técnico sobre a cobertura e viabilidade espacial do sistema de hidrantes urbanos de incêndio para a área em questão, em conformidade com a normatização vigente.</p>
                    {fotoHidrante && (
                      <div className="my-4 text-center">
                        <img src={fotoHidrante} alt="Hidrante Atual" className="max-w-md mx-auto h-auto rounded border border-slate-300 shadow-sm" />
                        <p className="text-xs text-slate-500 italic mt-1">Figura 1: Registro fotográfico da situação motivadora do pleito.</p>
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
                    
                    <div className="my-6 border border-slate-300 rounded overflow-hidden shadow-sm page-break-inside-avoid">
                      <div className="h-[420px] w-full relative z-0">
                        <MapContainer 
                          center={mapCenter} 
                          zoom={15} 
                          style={{ height: '100%', width: '100%' }} 
                          zoomControl={true} 
                          scrollWheelZoom={true}
                          dragging={true}
                          doubleClickZoom={true}
                        >
                          <TileLayer url="http://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}" maxZoom={20} />
                          {results.polyCoords.length > 0 && <Polygon positions={results.polyCoords} pathOptions={{ color: '#eab308', fillColor: '#eab308', fillOpacity: 0.2 }} />}
                          {results.waterCoords.length > 0 && <Polyline positions={results.waterCoords} pathOptions={{ color: '#06b6d4', weight: 4 }} />}
                          
                          {/* Hidrante Alvo - Marcador Laranja com borda grossa */}
                          {results.targetPos && (
                            <>
                              <Marker position={results.targetPos} icon={customDivIcon('#f97316', '#ffffff', '3.5px')}>
                                <Popup>
                                  <strong>Hidrante Avaliado:</strong> {results.evalHydrant?.nomHidrante || results.evalHydrant?.codHidrante}
                                  <br />
                                  <strong>RA:</strong> {results.evalHydrant?.dscLocalidade || '-'}
                                  <br />
                                  <strong>Endereço:</strong> {results.evalHydrant?.dscEndereco || '-'}
                                </Popup>
                              </Marker>
                              {studyType === 'relocation' && (
                                <Circle center={results.targetPos} radius={results.radius} pathOptions={{ color: '#ea580c', weight: 3, fillColor: '#f97316', fillOpacity: 0.12, dashArray: '6, 8' }} />
                              )}
                            </>
                          )}

                          {/* Hidrantes da Cidade e Adjacentes - Marcadores Pretos com Circunferência Tracejada Preta */}
                          {(results.allMapAdjacentHydrants || results.nearest).map(h => (
                            <React.Fragment key={h.codHidrante || h._internalId || h.nomHidrante}>
                              <Marker position={[h.numLatitude, h.numLongitude]} icon={customDivIcon('#000000', '#ffffff', '3.5px')}>
                                <Popup>
                                  <strong>{h.nomHidrante || h.codHidrante}</strong>
                                  <br />
                                  <span>{h.dscLocalidade || '-'}</span>
                                  <br />
                                  <span className="text-xs">{h.dscEndereco || '-'}</span>
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
                            <span className="font-semibold text-orange-950">Hidrante Alvo em Análise (Raio {results.radius}m)</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-black bg-slate-300" style={{ borderStyle: 'dashed' }}></div>
                          <span className="font-semibold text-slate-900">Hidrantes da Cidade / Adjacentes (Raio {results.radius}m - Tracejado Preto)</span>
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

                    <p className="mt-4 font-bold">Equipamentos Próximos:</p>
                    <p>O levantamento da base de dados identificou os seguintes hidrantes nas imediações do objeto estudado:</p>
                    <ul className="list-disc pl-5 mt-1 text-sm">
                      {results.nearest.length > 0 ? results.nearest.map(h => (
                        <li key={h.codHidrante || h._internalId}>
                          <strong>Código:</strong> {h.nomHidrante || h.codHidrante} | <strong>Coordenadas:</strong> ({h.numLatitude}, {h.numLongitude}) | <strong>Endereço:</strong> {h.dscEndereco || '-'}
                        </li>
                      )) : <li>Nenhum hidrante próximo encontrado.</li>}
                    </ul>
                    <p className="mt-4 font-bold">Processamento Espacial e Geodésico:</p>
                    {studyType === 'relocation' ? (
                      <p>
                        A análise computacional avaliou espacialmente a área de cobertura atual do hidrante em questão. Verificou-se que {results.isApproved ? "toda a área de cobertura do referido hidrante já pertence à área de cobertura de outros hidrantes adjacentes consolidados supracitados." : "a área de cobertura do referido hidrante NÃO está integralmente coberta pelos hidrantes adjacentes, havendo portanto déficit de proteção caso seja removido."}
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
