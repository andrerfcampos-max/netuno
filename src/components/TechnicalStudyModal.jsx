import React, { useState, useMemo, useRef } from 'react';
import { X, Map as MapIcon, Calculator, FileText, CheckCircle, XCircle, Crosshair, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const customDivIcon = (color) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
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
  const [studyType, setStudyType] = useState('relocation');
  const [occupation, setOccupation] = useState('unifamiliar');
  const [rawPolygon, setRawPolygon] = useState('');
  const [rawWaterNetwork, setRawWaterNetwork] = useState('');
  const [targetCode, setTargetCode] = useState('');
  const [results, setResults] = useState(null);

  if (!isOpen) return null;

  const getRadius = () => {
    switch(occupation) {
      case 'unifamiliar': return 800;
      case 'verticalizada': return 600;
      case 'especiais': return 300;
      default: return 800;
    }
  };

  const handleProcess = () => {
    const polyCoords = parseCoordinates(rawPolygon);
    const waterCoords = parseCoordinates(rawWaterNetwork);
    const radius = getRadius();
    let targetPos = null;
    let evalHydrant = null;

    if (studyType === 'relocation') {
      evalHydrant = hidrantes.find(h => h.codHidrante === targetCode || h.nomHidrante === targetCode);
      if (!evalHydrant) {
        alert("Hidrante não encontrado na base de dados.");
        return;
      }
      targetPos = { lat: parseFloat(evalHydrant.numLatitude), lng: parseFloat(evalHydrant.numLongitude) };
    }

    const centroid = getCentroid(polyCoords);
    if (!centroid && polyCoords.length > 0) return;

    let suggestedPos = null;
    let maxDist = 0;
    let isApproved = false;

    if (polyCoords.length > 0) {
      if (studyType === 'relocation') {
        polyCoords.forEach(v => {
          const d = calculateDistance(targetPos.lat, targetPos.lng, v.lat, v.lng);
          if (d > maxDist) maxDist = d;
        });
        isApproved = maxDist <= radius;
      }
      
      if (studyType === 'new_hydrant' || !isApproved) {
        suggestedPos = centroid;
        if (waterCoords.length > 0) {
          suggestedPos = findClosestPointOnLines(centroid, waterCoords);
        }
        
        if (studyType === 'new_hydrant') {
          maxDist = 0;
          polyCoords.forEach(v => {
            const d = calculateDistance(suggestedPos.lat, suggestedPos.lng, v.lat, v.lng);
            if (d > maxDist) maxDist = d;
          });
          isApproved = maxDist <= radius;
        }
      }
    }

    const refPos = targetPos || suggestedPos || centroid || (polyCoords.length > 0 ? polyCoords[0] : null);
    let nearest = [];
    if (refPos) {
      nearest = hidrantes.filter(h => {
        if (evalHydrant && (h.codHidrante === evalHydrant.codHidrante)) return false;
        const d = calculateDistance(refPos.lat, refPos.lng, h.numLatitude, h.numLongitude);
        return d <= (radius * 2);
      }).slice(0, 5);
    }

    setResults({
      polyCoords,
      waterCoords,
      radius,
      targetPos,
      evalHydrant,
      suggestedPos,
      maxDist,
      isApproved,
      nearest
    });
  };

  const mapCenter = results?.polyCoords?.[0] || results?.targetPos || [-15.793, -47.882];
  
  const getOccupationName = () => {
    if (occupation === 'unifamiliar') return 'Ocupação Unifamiliar (Adensada, comercial, horizontalizadas)';
    if (occupation === 'verticalizada') return 'Ocupação Verticalizada (Adensada e baixa mobilidade)';
    return 'Ocupações Especiais (Hospitais, shoppings, escolas)';
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 overflow-y-auto print:bg-white print:text-black">
      <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shadow-lg z-50 print:hidden">
        <div className="flex items-center gap-3">
          <Calculator className="text-emerald-400" size={28} />
          <h2 className="text-xl font-bold text-white">Módulo de Estudo Técnico</h2>
        </div>
        <button onClick={onClose} className="p-2 bg-slate-700 hover:bg-red-600 rounded-full transition-colors text-white">
          <X size={24} />
        </button>
      </div>

      <div className="p-4 md:p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 print:block print:p-0">
        <div className="lg:col-span-4 space-y-4 print:hidden">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
            <h3 className="text-lg font-bold text-slate-200 mb-3 border-b border-slate-700 pb-2">Parâmetros do Estudo</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Documento de Solicitação (Ref)</label>
                <input type="text" value={docRef} onChange={e => setDocRef(e.target.value)} placeholder="Ex: Memorando 123/2026 - SEI" className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Tipo de Estudo</label>
                <select value={studyType} onChange={e => setStudyType(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="relocation">Remanejamento / Remoção de Hidrante</option>
                  <option value="new_hydrant">Projeção de Novo Hidrante</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Classificação da Ocupação (Raio NBR)</label>
                <select value={occupation} onChange={e => setOccupation(e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="unifamiliar">Ocupação Unifamiliar (Raio 800m)</option>
                  <option value="verticalizada">Ocupação Verticalizada (Raio 600m)</option>
                  <option value="especiais">Ocupações Especiais (Raio 300m)</option>
                </select>
              </div>
              {studyType === 'relocation' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1">Código do Hidrante Alvo</label>
                  <input type="text" value={targetCode} onChange={e => setTargetCode(e.target.value)} placeholder="Ex: GUA00101" className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Poligonal das Edificações (Google Maps)</label>
                <textarea value={rawPolygon} onChange={e => setRawPolygon(e.target.value)} placeholder="-16.000, -48.000\n-16.001, -48.001" className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded h-24 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">Rede de Água CAESB (Opcional)</label>
                <textarea value={rawWaterNetwork} onChange={e => setRawWaterNetwork(e.target.value)} placeholder="-16.000, -48.000..." className="w-full bg-slate-700 border border-slate-600 text-white p-2 rounded h-20 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <button onClick={handleProcess} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-emerald-900/50">
                <Calculator size={20} /> Processar Cálculo Espacial
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          {results ? (
            <>
              <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-sm h-[400px] relative print:h-[500px] print:border-gray-300 print:mb-8 print:!block print:page-break-inside-avoid">
                <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="http://mt0.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}" maxZoom={20} />
                  {results.polyCoords.length > 0 && <Polygon positions={results.polyCoords} pathOptions={{ color: 'yellow', fillColor: 'yellow', fillOpacity: 0.2 }} />}
                  {results.waterCoords.length > 0 && <Polyline positions={results.waterCoords} pathOptions={{ color: 'cyan', weight: 4 }} />}
                  {results.targetPos && (
                    <Marker position={results.targetPos} icon={customDivIcon('#f59e0b')}>
                      <Popup>Hidrante Avaliado: {results.evalHydrant?.nomHidrante}</Popup>
                    </Marker>
                  )}
                  {results.suggestedPos && (
                    <>
                      <Marker position={results.suggestedPos} icon={customDivIcon('#10b981')}>
                        <Popup>Coordenada Sugerida</Popup>
                      </Marker>
                      <Circle center={results.suggestedPos} radius={results.radius} pathOptions={{ color: '#10b981', fillOpacity: 0.1, dashArray: '5, 10' }} />
                    </>
                  )}
                  {results.targetPos && results.isApproved && (
                    <Circle center={results.targetPos} radius={results.radius} pathOptions={{ color: '#f59e0b', fillOpacity: 0.1, dashArray: '5, 10' }} />
                  )}
                  {results.nearest.map(h => (
                    <Marker key={h.codHidrante} position={[h.numLatitude, h.numLongitude]} icon={customDivIcon('#3b82f6')}>
                      <Popup>{h.nomHidrante || h.codHidrante}</Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className={`p-4 rounded-xl border font-bold flex items-center justify-between shadow-sm print:hidden ${results.isApproved ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : 'bg-red-900/30 border-red-500 text-red-400'}`}>
                <div className="flex items-center gap-3">
                  {results.isApproved ? <CheckCircle size={32} /> : <XCircle size={32} />}
                  <span className="text-xl">STATUS: {results.isApproved ? 'APROVADO / FAVORÁVEL' : 'REPROVADO / DESFAVORÁVEL'}</span>
                </div>
                <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 transition-colors">
                  <FileText size={20} /> Exportar PDF
                </button>
              </div>

              <div className="bg-white text-black p-8 sm:p-12 rounded-xl shadow-lg font-serif text-sm print:shadow-none print:p-0 print:m-0 print:w-full print:page-break-before-always">
                <div className="text-center mb-8">
                  <h1 className="font-bold text-lg uppercase">Governo do Distrito Federal</h1>
                  <h2 className="font-bold text-base uppercase">Corpo de Bombeiros Militar do Distrito Federal</h2>
                  <h3 className="font-bold text-sm uppercase">Subseção de Operações e Manutenção</h3>
                  <br />
                  <h4 className="font-bold text-base underline">Parecer Técnico n.º {Math.floor(Math.random()*9000)+1000}/{new Date().getFullYear()} - CBMDF/DIVIS/SEHUR/SUOMA</h4>
                </div>
                <div className="space-y-6 text-justify leading-relaxed">
                  <section>
                    <h5 className="font-bold">I - REFERÊNCIA</h5>
                    <p>De acordo com a solicitação contida no <strong>{docRef || '[Inserir Documento]'}</strong>, a qual versa sobre o estudo técnico de <strong>{studyType === 'relocation' ? 'Remanejamento/remoção de hidrantes instalados' : 'Projeção de novo hidrante'}</strong> na localidade delimitada em estudo.</p>
                  </section>
                  <section>
                    <h5 className="font-bold">II - FINALIDADE</h5>
                    <p>Emitir parecer técnico sobre a cobertura e viabilidade espacial do sistema de hidrantes urbanos de incêndio para o perímetro delimitado, conforme a normatização vigente.</p>
                  </section>
                  <section>
                    <h5 className="font-bold">III - FUNDAMENTAÇÃO LEGAL</h5>
                    <p>O presente Parecer possui amparo legal no Decreto Nº 7.163, de 29 de abril de 2010, que regulamenta o inciso I do art. 10-B da Lei nº 8.255, de 20 de novembro de 1991. Regulamento de Segurança Contra Incêndio e Pânico do Distrito Federal - RSIP, aprovado pelo Dec. 21.361, de 20 jul. 2000, publicado no DODF nº 1.398/00.</p>
                  </section>
                  <section>
                    <h5 className="font-bold">IV - METODOLOGIA E FATOS OBSERVADOS</h5>
                    <p><strong>Classificação da Ocupação:</strong> A área em estudo classifica-se como {getOccupationName()}.</p>
                    <p><strong>Exigência Normativa:</strong> Conforme a norma ABNT NBR 12.218/2017, a ocupação predominante exige um raio de cobertura máximo de <strong>{results.radius} metros</strong> a partir do hidrante para garantir a proteção de todas as edificações.</p>
                    <p className="mt-2 font-bold">Equipamentos Próximos (Consulta Automática):</p>
                    <p>O levantamento da base de dados identificou os seguintes hidrantes nas imediações do polígono estudado:</p>
                    <ul className="list-disc pl-5 mt-1">
                      {results.nearest.length > 0 ? results.nearest.map(h => (
                        <li key={h.codHidrante}>Código: {h.nomHidrante || h.codHidrante} | Endereço: {h.dscEndereco || '-'}</li>
                      )) : <li>Nenhum hidrante próximo encontrado.</li>}
                    </ul>
                    <p className="mt-2 font-bold">Processamento Matemático:</p>
                    <p>O sistema calculou as distâncias entre a coordenada alvo e os vértices do polígono. Maior distância identificada: <strong>{results.maxDist.toFixed(2)} metros.</strong></p>
                  </section>
                  <section>
                    <h5 className="font-bold">V - PARECER TÉCNICO</h5>
                    <p>Com base no processamento das coordenadas e na normatização técnica aplicável, os gestores signatários são do seguinte parecer:</p>
                    <div className="mt-2 pl-4 border-l-2 border-slate-300">
                      {results.isApproved ? (
                        <p><strong>1 - FAVORÁVEL</strong> ao pleito. A maior distância identificada do equipamento até o limite da área é de {results.maxDist.toFixed(2)} metros, atestando que a totalidade das edificações do polígono encontra-se coberta dentro do raio normativo de {results.radius} metros.</p>
                      ) : (
                        <>
                          <p><strong>1 - DESFAVORÁVEL</strong> ao pleito em sua coordenada original/ausência de cobertura, pois a distância do equipamento até o vértice da área atinge {results.maxDist.toFixed(2)} metros, ultrapassando o limite normativo de {results.radius} metros exigido para o local.</p>
                          {results.suggestedPos && (
                            <p className="mt-2"><strong>2 - SUGESTÃO TÉCNICA:</strong> Para garantir que toda a área fique coberta, sugere-se a instalação/remanejamento do hidrante para a coordenada <strong>{results.suggestedPos.lat.toFixed(6)}, {results.suggestedPos.lng.toFixed(6)}</strong> {results.waterCoords.length > 0 ? 'sobre o trecho da rede de água existente' : ''}.</p>
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
                      <p className="text-xs">Matrícula: {currentUser?.username || '______'}</p>
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
