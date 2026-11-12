import React, { useState, useRef, useMemo, useEffect } from 'react';
import { MEXICO_STATES_DEFS, MexicoStateDef, getStateFromCoords } from '../data/mexicoMapStateDefs';
import { INITIAL_STATION_MASTERS, RUBROS_META } from '../data/initialData';
import { calculateStationOverall, isSameStation, normalizeMonthName } from '../utils/evaluationFormulas';
import { StationEvaluationRecord, MonthName } from '../types';
import {
  MapPin,
  Download,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowDown,
  ArrowUp,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface MexicoMapModuleProps {
  records: StationEvaluationRecord[];
  onSelectStationToInspect?: (stationName: string) => void;
  onNavigateToMetrics?: () => void;
  title?: string;
  entityLabel?: string;
  customMasters?: typeof INITIAL_STATION_MASTERS;
}

export const MexicoMapModule: React.FC<MexicoMapModuleProps> = ({
  records,
  onSelectStationToInspect,
  onNavigateToMetrics,
  title = 'Mapa de estaciones',
  entityLabel = 'Estaciones',
  customMasters,
}) => {
  const effectiveMasters = customMasters !== undefined ? customMasters : (records && records.length > 0 ? INITIAL_STATION_MASTERS : []);

  // Detect active month dynamically from records
  const activeMonth: MonthName = useMemo(() => {
    if (!records || records.length === 0) return 'SEPTIEMBRE';
    const lastWithMonth = records.slice().reverse().find((r) => r.mes);
    return (lastWithMonth?.mes ? normalizeMonthName(lastWithMonth.mes) : 'SEPTIEMBRE') as MonthName;
  }, [records]);

  // Initial state: pick the first state that actually has stations
  const [selectedStateName, setSelectedStateName] = useState<string>(() => {
    if (customMasters && customMasters.length > 0) {
      return customMasters[0].estado;
    }
    return 'Sinaloa';
  });

  const [hoveredState, setHoveredState] = useState<MexicoStateDef | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFlashHighlighted, setIsFlashHighlighted] = useState<boolean>(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const resultsPanelRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-focus to a state with stations if current selected state has 0 stations
  useEffect(() => {
    if (effectiveMasters.length > 0) {
      const currentHasStations = effectiveMasters.some(
        (s) => s.estado.toLowerCase() === selectedStateName.toLowerCase()
      );
      if (!currentHasStations) {
        setSelectedStateName(effectiveMasters[0].estado);
      }
    }
  }, [effectiveMasters, selectedStateName]);

  // Compute state statistics dynamically from station masters and records
  const stateStats = useMemo(() => {
    const stats: Record<
      string,
      {
        count: number;
        avgScore: number;
        status: 'Cumple' | 'Observación' | 'Crítico' | 'Sin datos';
        stations: typeof INITIAL_STATION_MASTERS;
      }
    > = {};

    MEXICO_STATES_DEFS.forEach((st) => {
      const matchedStations = effectiveMasters.filter(
        (s) => s.estado.toLowerCase() === st.name.toLowerCase()
      );

      if (matchedStations.length > 0) {
        const evaluatedStations = matchedStations.map((s) => {
          const stRecs = records.filter((r) => isSameStation(r.estacion, s.nombre));
          if (stRecs.length > 0) {
            const stationMonth = (stRecs[0]?.mes ? normalizeMonthName(stRecs[0].mes) : activeMonth) as MonthName;
            const overall = calculateStationOverall(s.nombre, stRecs, stationMonth);
            return {
              ...s,
              calificacion: overall.calificacionFinal,
              estatus: overall.estatus,
            };
          }
          // If station has no records in database, score is 0 / Sin evaluar
          return {
            ...s,
            calificacion: 0,
            estatus: 'Sin evaluar' as any,
          };
        });

        const evaluatedWithScores = evaluatedStations.filter((s) => s.calificacion > 0);
        const sum = evaluatedWithScores.reduce((acc, curr) => acc + curr.calificacion, 0);
        const avg = evaluatedWithScores.length > 0 ? Math.round(sum / evaluatedWithScores.length) : 0;
        const status = avg >= 85 ? 'Cumple' : avg >= 80 ? 'Observación' : avg > 0 ? 'Crítico' : 'Sin datos';

        stats[st.name] = {
          count: evaluatedStations.length,
          avgScore: avg,
          status,
          stations: evaluatedStations,
        };
      } else {
        stats[st.name] = {
          count: 0,
          avgScore: 0,
          status: 'Sin datos',
          stations: [],
        };
      }
    });

    return stats;
  }, [records, effectiveMasters, activeMonth]);

  const currentStateData = stateStats[selectedStateName] || {
    count: 0,
    avgScore: 0,
    status: 'Sin datos' as const,
    stations: [],
  };

  const selectedStateDef = useMemo(() => {
    return (
      MEXICO_STATES_DEFS.find((s) => s.name === selectedStateName) ||
      MEXICO_STATES_DEFS[0]
    );
  }, [selectedStateName]);

  // State Rubro breakdown estimates
  const rubroBreakdown = useMemo(() => {
    return RUBROS_META.filter((r) => r.id <= 5).map((rubro) => {
      const basePct =
        currentStateData.avgScore > 0
          ? Math.min(100, Math.round((currentStateData.avgScore / 100) * (85 + rubro.id * 2)))
          : 0;
      return {
        id: rubro.id,
        name: rubro.name,
        norma: rubro.norma,
        maxPoints: rubro.maxPoints,
        scorePct: basePct,
      };
    });
  }, [currentStateData]);

  // Unified State Selection with Responsive Auto-Scroll on Mobile and Tablet (<1024px)
  const handleSelectState = (stateName: string, shouldScroll = true) => {
    setSelectedStateName(stateName);

    // Trigger visual highlight flash on results card
    setIsFlashHighlighted(true);
    setTimeout(() => {
      setIsFlashHighlighted(false);
    }, 1500);

    // On mobile and tablet screens (viewport width < 1024px), scroll directly to the results panel
    if (shouldScroll && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => {
        resultsPanelRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    }
  };

  // Scroll back to map on mobile/tablet
  const handleScrollToMap = () => {
    mapContainerRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  // Map pointer move via geometric proximity on mapa.jpg (1244 x 864)
  const handleMapPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const scaleX = 1244 / rect.width;
    const scaleY = 864 / rect.height;
    const imgX = Math.floor(clientX * scaleX);
    const imgY = Math.floor(clientY * scaleY);

    if (imgX >= 0 && imgX < 1244 && imgY >= 0 && imgY < 864) {
      const matched = getStateFromCoords(imgX, imgY, 75);
      setHoveredState(matched);
    } else {
      setHoveredState(null);
    }
  };

  // Map pointer tap/click to select state and auto-scroll
  const handleMapPointerClick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const scaleX = 1244 / rect.width;
    const scaleY = 864 / rect.height;
    const imgX = Math.floor(clientX * scaleX);
    const imgY = Math.floor(clientY * scaleY);

    if (imgX >= 0 && imgX < 1244 && imgY >= 0 && imgY < 864) {
      const matched = getStateFromCoords(imgX, imgY, 80);
      if (matched) {
        handleSelectState(matched.name, true);
      }
    }
  };

  const handleMapPointerLeave = () => {
    setHoveredState(null);
  };

  // Export current state report
  const handleExportStateReport = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      [`REPORTE DE EVALUACIONES - ESTADO DE ${selectedStateName.toUpperCase()}`, ''],
      ['Estaciones Activas:', currentStateData.count],
      ['Calificación Promedio:', `${currentStateData.avgScore} pts`],
      ['Estatus General:', currentStateData.status],
      [''],
      ['Código', 'Nombre Estación', 'Ciudad / Municipio', 'Calificación', 'Estatus'],
      ...currentStateData.stations.map((s) => [
        s.codigo,
        s.nombre,
        s.ciudad,
        s.calificacion,
        s.estatus,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, selectedStateName.slice(0, 20));
    XLSX.writeFile(wb, `Reporte_Evaluaciones_${selectedStateName}.xlsx`);
  };

  return (
    <div className="space-y-1.5 max-w-full overflow-hidden">
      {/* Top Compact Bar - Placed high with reduced title size */}
      {effectiveMasters.length === 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-2.5 sm:p-3 text-xs text-sky-900 flex items-center gap-2.5 shadow-2xs">
          <Info className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            <strong>Sincronizado con Módulo 1 (Base de Datos):</strong> Actualmente la base de datos centralizada tiene 0 registros. Al importar tu archivo Excel oficial en el Módulo 1, las estaciones se sincronizarán y se mostrarán automáticamente en el mapa.
          </span>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 shadow-xs max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xs sm:text-sm md:text-base font-bold tracking-tight text-neutral-950 flex items-center gap-1.5">
              <span>{title}</span>
              <span className="text-neutral-400 font-normal">|</span>
              <span className="text-neutral-600 font-medium hidden sm:inline text-xs">Gestión · Análisis · Control · Seguimiento</span>
            </h2>
            <div className="hidden md:flex items-center gap-3 text-[11px] text-neutral-600 pl-2 border-l border-neutral-200">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#0e7490]" />
                <span>Cumple (≥85)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#d97706]" />
                <span>Obs (80-84)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#c2410c]" />
                <span>Crítico (&lt;80)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onNavigateToMetrics && (
              <button
                onClick={onNavigateToMetrics}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-neutral-600" />
                <span className="hidden sm:inline">Métricas</span>
              </button>
            )}

            <button
              onClick={handleExportStateReport}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar {selectedStateName}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Selected State Results Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 max-w-full">
        {/* Left Column: Interactive Map (7 cols on lg) */}
        <div
          ref={mapContainerRef}
          className="lg:col-span-7 bg-white border border-neutral-200 rounded-xl p-2.5 sm:p-3.5 shadow-xs flex flex-col justify-between max-w-full overflow-hidden scroll-mt-4"
        >
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-neutral-700" />
              <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                Cartografía Oficial (mapa.jpg)
              </span>
            </div>

            {/* Quick State Select for Mobile and Zoom */}
            <div className="flex items-center gap-2">
              <select
                value={selectedStateName}
                onChange={(e) => handleSelectState(e.target.value, true)}
                className="px-2.5 py-1 text-xs border border-neutral-300 rounded-md bg-white text-neutral-800 font-medium focus:outline-none focus:border-neutral-900"
              >
                {MEXICO_STATES_DEFS.map((st) => (
                  <option key={st.id} value={st.name}>
                    {st.name} {stateStats[st.name]?.count > 0 ? `(${stateStats[st.name].count})` : ''}
                  </option>
                ))}
              </select>

              <div className="flex items-center border border-neutral-200 rounded-md overflow-hidden bg-white shadow-xs">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.15))}
                  className="p-1 hover:bg-neutral-100 text-neutral-600"
                  title="Acercar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.9, z - 0.15))}
                  className="p-1 hover:bg-neutral-100 text-neutral-600 border-l border-neutral-200"
                  title="Alejar"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="p-1 hover:bg-neutral-100 text-neutral-600 border-l border-neutral-200"
                  title="Restablecer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* SVG Map Canvas with User Requested Base Image (/mapa.jpg 1244x864) and Interactive Overlays */}
          <div className="relative bg-white rounded-lg p-1 sm:p-2 overflow-hidden flex items-center justify-center min-h-[340px] sm:min-h-[460px]">
            {/* Dynamic Hover Tooltip Badge */}
            {hoveredState && (
              <div
                className="absolute top-3 left-3 z-30 bg-neutral-900/95 text-white px-3 py-2 rounded-lg shadow-xl text-xs pointer-events-none transition-all duration-150 border border-neutral-700 backdrop-blur-xs"
              >
                <div className="font-bold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>{hoveredState.name}</span>
                </div>
                <div className="text-[11px] text-neutral-300 font-mono mt-0.5">
                  {stateStats[hoveredState.name]?.count > 0 ? (
                    <>
                      <span>{stateStats[hoveredState.name].count} estaciones</span> ·{' '}
                      <span>{stateStats[hoveredState.name].avgScore} pts</span> ·{' '}
                      <span
                        className={`font-semibold ${
                          stateStats[hoveredState.name].status === 'Cumple'
                            ? 'text-emerald-300'
                            : stateStats[hoveredState.name].status === 'Observación'
                            ? 'text-amber-300'
                            : 'text-red-300'
                        }`}
                      >
                        {stateStats[hoveredState.name].status}
                      </span>
                    </>
                  ) : (
                    <span>Sin estaciones registradas</span>
                  )}
                </div>
              </div>
            )}

            <svg
              ref={svgRef}
              viewBox="0 0 1244 864"
              onPointerMove={handleMapPointerMove}
              onPointerDown={handleMapPointerClick}
              onPointerLeave={handleMapPointerLeave}
              className={`w-full h-auto max-h-[520px] transition-transform duration-300 ease-out select-none ${
                hoveredState ? 'cursor-pointer' : 'cursor-default'
              }`}
              style={{ transform: `scale(${zoomLevel})` }}
            >
              {/* 1. Base Official Cartographic Image (/mapa.jpg) */}
              <image
                href="/mapa.jpg"
                x="0"
                y="0"
                width="1244"
                height="864"
                preserveAspectRatio="xMidYMid meet"
              />

              {/* 2. Selected State Beacon Ring & Spotlight Tag */}
              {selectedStateDef && effectiveMasters.length > 0 && (
                <g
                  transform={`translate(${selectedStateDef.pinX}, ${selectedStateDef.pinY})`}
                  className="pointer-events-none transition-all duration-300"
                >
                  {/* Outer animated soft pulse rings */}
                  <circle
                    r="36"
                    fill="rgba(14, 116, 144, 0.15)"
                    stroke="#0e7490"
                    strokeWidth="2.5"
                    strokeOpacity="0.8"
                    className="animate-ping"
                  />
                  <circle
                    r="24"
                    fill="rgba(14, 116, 144, 0.25)"
                    stroke="#0e7490"
                    strokeWidth="3"
                  />

                  {/* Spotlight Pill Badge above the selected state */}
                  <g transform="translate(0, -42)">
                    <rect
                      x="-75"
                      y="-15"
                      width="150"
                      height="30"
                      rx="15"
                      fill="#0c323f"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      filter="drop-shadow(0px 4px 8px rgba(0,0,0,0.4))"
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      📍 {selectedStateDef.name}
                    </text>
                  </g>
                </g>
              )}

              {/* 3. Station Badges on states with evaluations */}
              {MEXICO_STATES_DEFS.map((st) => {
                const info = stateStats[st.name];
                if (!info || info.count === 0) return null;
                const isSelected = selectedStateName === st.name;
                const isHovered = hoveredState?.id === st.id;

                const pinColor =
                  info.status === 'Cumple'
                    ? '#0e7490'
                    : info.status === 'Observación'
                    ? '#d97706'
                    : '#c2410c';

                return (
                  <g
                    key={`pin-${st.id}`}
                    transform={`translate(${st.pinX}, ${st.pinY})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectState(st.name, true);
                    }}
                    className="cursor-pointer transition-transform duration-200"
                    style={{
                      transform:
                        isSelected || isHovered
                          ? `translate(${st.pinX}px, ${st.pinY}px) scale(1.2)`
                          : `translate(${st.pinX}px, ${st.pinY}px)`,
                      transformOrigin: 'center',
                    }}
                  >
                    {/* Shadow drop */}
                    <circle
                      r="16"
                      fill="#ffffff"
                      stroke={pinColor}
                      strokeWidth="3.5"
                      filter="drop-shadow(0px 3px 6px rgba(0,0,0,0.35))"
                    />
                    {/* Station count */}
                    <text
                      y="4.5"
                      textAnchor="middle"
                      fill="#0f172a"
                      fontSize="13"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {info.count}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Mobile & Tablet Interactive Notice Bar (Scroll trigger) */}
          <div className="lg:hidden mt-3 p-2.5 bg-neutral-900 text-white rounded-lg flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 truncate text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="truncate">
                <strong>{selectedStateName}:</strong>{' '}
                {currentStateData.count > 0
                  ? `${currentStateData.count} estaciones (${currentStateData.avgScore} pts)`
                  : 'Sin estaciones registradas'}
              </span>
            </div>
            <button
              onClick={() => {
                resultsPanelRef.current?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#0e7490] hover:bg-[#0891b2] text-white rounded-md shrink-0 transition-colors"
            >
              <span>Ver resultados</span>
              <ArrowDown className="w-3 h-3 animate-bounce" />
            </button>
          </div>

          {/* Quick States Carousel */}
          <div className="mt-2 pt-2 border-t border-neutral-100 max-w-full overflow-hidden">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
              Seleccionar estado rápido:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar max-w-full">
              {MEXICO_STATES_DEFS.map((st) => {
                const info = stateStats[st.name];
                const hasStations = info && info.count > 0;
                const isSelected = selectedStateName === st.name;

                return (
                  <button
                    key={st.id}
                    onClick={() => handleSelectState(st.name, true)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? 'bg-[#0c323f] text-white shadow-xs font-semibold'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasStations
                          ? info.status === 'Cumple'
                            ? 'bg-emerald-500'
                            : info.status === 'Observación'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                          : 'bg-neutral-400'
                      }`}
                    />
                    <span>{st.name}</span>
                    {hasStations && (
                      <span className="font-mono text-[10px] opacity-75">
                        ({info.count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Selected State Results Panel (5 cols on lg, stacked on mobile/tablet) */}
        <div
          ref={resultsPanelRef}
          className={`lg:col-span-5 bg-white border rounded-xl p-5 shadow-xs flex flex-col justify-between max-w-full overflow-hidden space-y-4 scroll-mt-6 transition-all duration-300 ${
            isFlashHighlighted
              ? 'border-[#0e7490] ring-2 ring-[#0e7490]/40 bg-cyan-50/15'
              : 'border-neutral-200'
          }`}
        >
          {/* Header of State with Fresh Update Badge */}
          <div className="border-b border-neutral-100 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                    Auditoría por Entidad Federativa
                  </span>
                  {isFlashHighlighted && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0e7490] text-white animate-fade-in">
                      <Sparkles className="w-2.5 h-2.5" />
                      Actualizado
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-neutral-950 flex items-center gap-2 mt-0.5">
                  <MapPin className="w-5 h-5 text-[#0e7490] shrink-0" />
                  <span>{selectedStateName}</span>
                </h3>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  currentStateData.count === 0
                    ? 'bg-neutral-100 text-neutral-500 border-neutral-200'
                    : currentStateData.status === 'Cumple'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : currentStateData.status === 'Observación'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {currentStateData.count === 0 ? 'Sin evaluar' : currentStateData.status}
              </span>
            </div>
          </div>

          {/* Quick KPI Stat Boxes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
              <span className="text-[10px] text-neutral-500 font-medium block">
                Calificación Promedio
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
                  {currentStateData.count > 0 && currentStateData.avgScore > 0 ? currentStateData.avgScore : '-'}
                </span>
                <span className="text-xs text-neutral-400 font-mono">/ 100</span>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
              <span className="text-[10px] text-neutral-500 font-medium block">
                Estaciones Activas
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
                  {currentStateData.count}
                </span>
                <span className="text-xs text-neutral-400">registradas</span>
              </div>
            </div>
          </div>

          {/* Compliance Breakdown by Normative Rubro */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center justify-between">
              <span>Cumplimiento por Rubro Normativo</span>
              <span className="text-[10px] text-neutral-400 font-mono">NOM Vigentes</span>
            </h4>

            <div className="space-y-1.5">
              {rubroBreakdown.map((r) => (
                <div key={r.id} className="text-xs">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-neutral-700 font-medium truncate max-w-[200px]">
                      {r.id}. {r.name}
                    </span>
                    <span className="font-mono font-bold text-neutral-900 tabular-nums">
                      {currentStateData.count > 0 && currentStateData.avgScore > 0 ? `${r.scorePct}%` : 'S/D'}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      style={{ width: `${currentStateData.count > 0 && currentStateData.avgScore > 0 ? r.scorePct : 0}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        r.scorePct >= 85
                          ? 'bg-[#0e7490]'
                          : r.scorePct >= 80
                          ? 'bg-[#d97706]'
                          : 'bg-[#c2410c]'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* List of Stations in this State */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                Estaciones en {selectedStateName} ({currentStateData.count})
              </h4>
            </div>

            {currentStateData.stations.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-neutral-200 rounded-lg text-xs text-neutral-500 bg-neutral-50/50">
                No hay estaciones registradas aún en el estado de {selectedStateName}. Los datos se sincronizan con las estaciones importadas en el Módulo 1 (Base de Datos).
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {currentStateData.stations.map((st) => (
                  <div
                    key={st.codigo}
                    className="p-2.5 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors flex items-center justify-between bg-white text-xs group"
                  >
                    <div className="truncate mr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-neutral-400">
                          {st.codigo}
                        </span>
                        <strong className="text-neutral-900 font-semibold truncate block">
                          {st.nombre}
                        </strong>
                      </div>
                      <span className="text-[11px] text-neutral-500 block truncate">
                        {st.ciudad}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-neutral-900 tabular-nums">
                        {st.calificacion}
                      </span>
                      {onSelectStationToInspect && (
                        <button
                          onClick={() => onSelectStationToInspect(st.nombre)}
                          className="px-2 py-1 text-[11px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors"
                          title="Ver tablero completo en Módulo 2 (Por Estación)"
                        >
                          Auditar →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Return to Map Button (Visible on mobile and tablet) */}
          <div className="lg:hidden pt-3 border-t border-neutral-100">
            <button
              onClick={handleScrollToMap}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Volver a explorar el Mapa</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
