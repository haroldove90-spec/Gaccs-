import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MonthName, MONTHS, StationEvaluationRecord, UserSession, AnexoFile } from '../types';
import { RUBRO_ITEMS, RUBROS_META, INITIAL_STATION_MASTERS, INITIAL_PLANT_MASTERS } from '../data/initialData';
import { exportModule3ToExcel, exportModule3DatabaseOnlyToExcel, exportModule3ToCsv } from '../utils/excelUtils';
import { EvidenceGalleryModal } from './EvidenceGalleryModal';
import { TimerLedIndicator } from './RecordTimerBadge';
import { AnexosModal } from './AnexosModal';
import {
  fetchAnexosFromSupabase,
  saveAnexoToSupabase,
  deleteAnexoFromSupabase,
  clearAllAnexosFromSupabase,
  loadLocalAnexos,
} from '../lib/supabaseClient';
import {
  calculateStationOverall,
  calculateSectionStats,
  getScoreCellFormat,
  normalizeStationName,
  isSameStation,
  normalizeMonthName,
  isMatchingRubroItem,
} from '../utils/evaluationFormulas';
import { safeStorageGet, safeStorageSet } from '../utils/sessionManager';
import {
  Download,
  Upload,
  Filter,
  Calendar,
  FileText,
  Award,
  Building2,
  Factory,
  Search,
  ArrowUpDown,
  Sparkles,
  X,
  Check,
  MapPin,
  Trash2,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Loader2,
  ChevronDown,
  Calculator,
  Info,
  CheckCircle2,
  Camera,
} from 'lucide-react';

interface Module3MatrixProps {
  records: StationEvaluationRecord[];
  stations: string[];
  onOpenImportModal: () => void;
  onDeleteRecords?: (recordIds: string[]) => void;
  onClearAllRecords?: () => void;
  user?: UserSession;
  entityLabel?: string;
  customMasters?: Array<{ nombre: string; estado?: string; [key: string]: any }>;
  showToast?: (msg: string) => void;
  onUpdateRecord?: (updatedRec: StationEvaluationRecord) => void;
}

export const Module3Matrix: React.FC<Module3MatrixProps> = ({
  records,
  stations,
  onOpenImportModal,
  onDeleteRecords,
  onClearAllRecords,
  user,
  entityLabel = 'Estación',
  customMasters,
  showToast,
  onUpdateRecord,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<MonthName>(() => {
    try {
      const saved = safeStorageGet('evaluaciones_m3_selected_month');
      if (saved) return saved as MonthName;
    } catch {}
    return 'SEPTIEMBRE';
  });
  const [selectedYear, setSelectedYear] = useState<number | 'ALL'>(() => {
    try {
      const saved = safeStorageGet('evaluaciones_m3_selected_year');
      if (saved) {
        if (saved === 'ALL') return 'ALL';
        const num = parseInt(saved, 10);
        if (!isNaN(num)) return num;
      }
    } catch {}
    return 'ALL';
  });

  useEffect(() => {
    if (selectedMonth) safeStorageSet('evaluaciones_m3_selected_month', selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (selectedYear) safeStorageSet('evaluaciones_m3_selected_year', String(selectedYear));
  }, [selectedYear]);

  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [filterRubro, setFilterRubro] = useState<number | 'ALL'>('ALL');
  const [stationSearch, setStationSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'pct'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Search within checklist points or norma (same as Module 1)
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  // Evidence Gallery modal state
  const [selectedRecordForGallery, setSelectedRecordForGallery] = useState<StationEvaluationRecord | null>(null);

  // Actions Dropdown Menu state
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

  // Filter option: only show stations evaluated in current month
  const [filterOnlyEvaluatedInMonth, setFilterOnlyEvaluatedInMonth] = useState(true);

  // Selection and deletion state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedEntityNames, setSelectedEntityNames] = useState<Set<string>>(new Set());
  const [deleteScope, setDeleteScope] = useState<'current_month' | 'all_year' | 'all_records'>('all_records');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmClearAllOpen, setIsConfirmClearAllOpen] = useState(false);
  const [lastDeletedCount, setLastDeletedCount] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Ventana Flotante de Anexos
  const [isAnexosModalOpen, setIsAnexosModalOpen] = useState(false);
  const [anexosList, setAnexosList] = useState<AnexoFile[]>(() => loadLocalAnexos());

  useEffect(() => {
    let isMounted = true;
    fetchAnexosFromSupabase().then((res) => {
      if (isMounted && res.anexos !== undefined) {
        setAnexosList(res.anexos);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddAnexo = async (newAnexo: AnexoFile) => {
    const updated = [newAnexo, ...anexosList.filter((a) => a.id !== newAnexo.id)];
    setAnexosList(updated);
    await saveAnexoToSupabase(newAnexo);
  };

  const handleDeleteAnexo = async (id: string) => {
    const updated = anexosList.filter((a) => a.id !== id);
    setAnexosList(updated);
    await deleteAnexoFromSupabase(id);
  };

  const handleClearAllAnexos = async (month?: string, year?: number) => {
    await clearAllAnexosFromSupabase(month, year);
    const updated = loadLocalAnexos();
    setAnexosList(updated);
  };

  // Click outside to close actions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
        setIsActionsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Detect which months have uploaded records in the database
  const detectedMonthsWithRecords = useMemo(() => {
    const map = new Map<string, number>();
    (records || []).forEach((r) => {
      if (r.mes) {
        const m = normalizeMonthName(r.mes);
        if (m) map.set(m, (map.get(m) || 0) + 1);
      }
    });
    return map;
  }, [records]);

  // Available years from records (sin años fantasmas)
  const availableYears = useMemo(() => {
    if (!records || records.length === 0) return [];
    const set = new Set<number>();
    (records || []).forEach((r) => {
      if (r.anio) {
        const y = Number(r.anio);
        if (!isNaN(y) && y > 2000) set.add(y);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [records]);

  // Auto-select the month with actual evaluations from the database
  useEffect(() => {
    const saved = safeStorageGet('evaluaciones_m3_selected_month');
    if (saved && detectedMonthsWithRecords.has(normalizeMonthName(saved))) {
      setSelectedMonth(saved as MonthName);
      return;
    }
    if (detectedMonthsWithRecords.size > 0) {
      const currentNorm = normalizeMonthName(selectedMonth);
      const currentCount = detectedMonthsWithRecords.get(currentNorm) || 0;
      if (currentCount === 0) {
        let bestMonth: MonthName = selectedMonth;
        let maxCount = 0;
        detectedMonthsWithRecords.forEach((count, m) => {
          if (count > maxCount) {
            maxCount = count;
            bestMonth = m as MonthName;
          }
        });
        setSelectedMonth(bestMonth);
      }
    }
  }, [detectedMonthsWithRecords]);

  const entityPluralLabel = entityLabel === 'Planta' ? 'Plantas' : 'Estaciones';

  // Helper para determinar el Estado de cada estación o planta
  const getEntityState = (name: string): string => {
    if (!name) return 'Sinaloa';

    // 1. Catálogo custom si fue provisto
    if (customMasters && customMasters.length > 0) {
      const match = customMasters.find((m) => m.nombre === name);
      if (match?.estado) return match.estado;
    }

    // 2. Registros de evaluación directamente (su campo ciudad suele tener "Estado - Ciudad")
    const recMatch = (records || []).find((r) => isSameStation(r.estacion, name) && r.ciudad);
    if (recMatch?.ciudad) {
      const parts = recMatch.ciudad.split('-');
      if (parts.length > 0 && parts[0].trim()) {
        const potentialState = parts[0].trim();
        if (potentialState.length > 2) return potentialState;
      }
    }

    // 3. LocalStorage guardado previamente
    try {
      const storageKey =
        entityLabel === 'Planta' ? 'evaluaciones_plant_masters_v1' : 'evaluaciones_station_masters_v1';
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const match = parsed.find((m: any) => m.nombre === name);
          if (match?.estado) return match.estado;
        }
      }
    } catch {
      // ignore
    }

    // 4. Catálogo inicial de datos
    const catalog = entityLabel === 'Planta' ? INITIAL_PLANT_MASTERS : INITIAL_STATION_MASTERS;
    const matchInit = catalog.find((m) => m.nombre === name);
    if (matchInit?.estado) return matchInit.estado;

    // 5. Mapeo inteligente por palabras clave en el nombre
    const lower = name.toLowerCase();
    if (
      lower.startsWith('mochis') ||
      lower.includes('culiacán') ||
      lower.includes('mazatlán') ||
      lower.includes('topolobampo') ||
      lower.includes('fuerte')
    ) {
      return 'Sinaloa';
    }
    if (lower.includes('hermosillo') || lower.includes('obregón') || lower.includes('sonora')) {
      return 'Sonora';
    }
    if (
      lower.includes('monterrey') ||
      lower.includes('huinalá') ||
      lower.includes('norte') ||
      lower.includes('apodaca')
    ) {
      return 'Nuevo León';
    }
    if (
      lower.includes('zapopan') ||
      lower.includes('guadalajara') ||
      lower.includes('salto') ||
      lower.includes('jalisco')
    ) {
      return 'Jalisco';
    }
    if (
      lower.includes('silao') ||
      lower.includes('celaya') ||
      lower.includes('león') ||
      lower.includes('guanajuato')
    ) {
      return 'Guanajuato';
    }
    if (lower.includes('puebla') || lower.includes('tehuacán')) {
      return 'Puebla';
    }
    if (lower.includes('juárez') || lower.includes('chihuahua')) {
      return 'Chihuahua';
    }
    if (lower.includes('torreón') || lower.includes('laguna') || lower.includes('coahuila')) {
      return 'Coahuila';
    }
    if (lower.includes('querétaro') || lower.includes('quintana')) {
      return 'Querétaro';
    }
    if (
      lower.includes('toluca') ||
      lower.includes('lerma') ||
      lower.includes('tlalnepantla') ||
      lower.includes('méxico')
    ) {
      return 'Estado de México';
    }
    if (lower.includes('veracruz')) {
      return 'Veracruz';
    }
    if (lower.includes('reynosa') || lower.includes('tamaulipas')) {
      return 'Tamaulipas';
    }

    return 'Sinaloa';
  };

  // Todas las plantas/estaciones registradas por el sistema o detectadas en los registros cargados
  const detectedPlantsList = useMemo(() => {
    // Si la base de datos está vacía (0 registros), no mostrar estaciones de muestra residuales
    if (!records || records.length === 0) {
      return [];
    }
    const map = new Map<string, string>(); // normKey -> displayStationName
    // Extraer única y estrictamente las estaciones que existen en los registros reales
    records.forEach((r) => {
      if (r.estacion && r.estacion.trim()) {
        const norm = normalizeStationName(r.estacion);
        if (!map.has(norm)) {
          map.set(norm, r.estacion.trim());
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const cleanA = a.replace('Mochis - ', '').trim();
      const cleanB = b.replace('Mochis - ', '').trim();
      return cleanA.localeCompare(cleanB, 'es', { sensitivity: 'base' });
    });
  }, [records]);

  // Lista única de Estados detectados para las estaciones o plantas del sistema (sin estados fantasmas)
  const detectedStatesList = useMemo(() => {
    if (!records || records.length === 0 || detectedPlantsList.length === 0) return [];
    const set = new Set<string>();
    detectedPlantsList.forEach((st) => {
      const state = getEntityState(st);
      if (state && state.trim()) set.add(state.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [detectedPlantsList, records, customMasters, entityLabel]);

  // Sincronizar y limpiar estado/año si ya no están disponibles
  useEffect(() => {
    if (selectedState !== 'ALL' && !detectedStatesList.includes(selectedState)) {
      setSelectedState('ALL');
    }
  }, [detectedStatesList, selectedState]);

  useEffect(() => {
    if (selectedYear !== 'ALL' && !availableYears.includes(Number(selectedYear))) {
      setSelectedYear('ALL');
    }
  }, [availableYears, selectedYear]);

  // Parser Inteligente para consultas combinadas como "septiembre - Sinaloa", "marzo Topolobampo", "octubre Sonora", etc.
  const parsedSearch = useMemo(() => {
    const raw = stationSearch.trim();
    if (!raw) {
      return {
        detectedMonth: null as MonthName | null,
        detectedYear: null as number | null,
        detectedState: null as string | null,
        stationFilterText: '',
        isSmartFilter: false,
      };
    }

    const MONTH_LOOKUP: Array<{ synonyms: string[]; month: MonthName }> = [
      { synonyms: ['septiembre', 'setiembre', 'sep', 'sept'], month: 'SEPTIEMBRE' },
      { synonyms: ['octubre', 'oct'], month: 'OCTUBRE' },
      { synonyms: ['noviembre', 'nov'], month: 'NOVIEMBRE' },
      { synonyms: ['diciembre', 'dic'], month: 'DICIEMBRE' },
      { synonyms: ['enero', 'ene'], month: 'ENERO' },
      { synonyms: ['febrero', 'feb'], month: 'FEBRERO' },
      { synonyms: ['marzo', 'mar'], month: 'MARZO' },
      { synonyms: ['abril', 'abr'], month: 'ABRIL' },
      { synonyms: ['mayo', 'may'], month: 'MAYO' },
      { synonyms: ['junio', 'jun'], month: 'JUNIO' },
      { synonyms: ['julio', 'jul'], month: 'JULIO' },
      { synonyms: ['agosto', 'ago'], month: 'AGOSTO' },
    ];

    let query = raw.toLowerCase();
    let foundMonth: MonthName | null = null;
    let foundYear: number | null = null;
    let foundState: string | null = null;

    // 1. Detectar año si está presente (ej. 2025, 2026)
    const yrMatch = query.match(/\b(2024|2025|2026|2027)\b/);
    if (yrMatch) {
      foundYear = parseInt(yrMatch[1], 10);
      query = query.replace(yrMatch[0], ' ');
    }

    // 2. Detectar mes en el texto (ej. "septiembre", "sep", "enero")
    for (const item of MONTH_LOOKUP) {
      for (const syn of item.synonyms) {
        const regex = new RegExp(`(^|[\\s\\-_/,.])${syn}([\\s\\-_/,.]|$)`, 'i');
        if (regex.test(query)) {
          foundMonth = item.month;
          query = query.replace(regex, ' ');
          break;
        }
      }
      if (foundMonth) break;
    }

    // 3. Detectar Estado en el texto (ej. "sinaloa", "sonora", "nuevo león", "jalisco", etc.)
    const normalizeStr = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const queryNorm = normalizeStr(query);

    for (const st of detectedStatesList) {
      const stNorm = normalizeStr(st);
      const regex = new RegExp(`(^|[\\s\\-_/,.])${stNorm}([\\s\\-_/,.]|$)`, 'i');
      if (regex.test(queryNorm)) {
        foundState = st;
        // Quitar el estado de la cadena restante de búsqueda
        query = queryNorm.replace(regex, ' ');
        break;
      }
    }

    // 4. Limpiar el resto del texto para buscar la estación o planta por nombre
    const cleanStationText = query
      .replace(/[\\-_/,.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      detectedMonth: foundMonth,
      detectedYear: foundYear,
      detectedState: foundState,
      stationFilterText: cleanStationText,
      isSmartFilter: Boolean(foundMonth || foundYear || foundState || cleanStationText),
    };
  }, [stationSearch, detectedStatesList]);

  // Mes y Año efectivos considerando el buscador inteligente
  const activeConsultMonth = parsedSearch.detectedMonth || selectedMonth;
  const activeConsultYear = parsedSearch.detectedYear || selectedYear;

  // Sincronizar automáticamente selectedState si el usuario escribe el nombre de un estado en el buscador
  useEffect(() => {
    if (parsedSearch.detectedState && selectedState !== parsedSearch.detectedState) {
      setSelectedState(parsedSearch.detectedState);
    }
  }, [parsedSearch.detectedState, selectedState]);

  // Estado efectivo a filtrar
  const effectiveState = selectedState !== 'ALL' ? selectedState : parsedSearch.detectedState || 'ALL';

  // Función para normalizar nombres de estados sin acentos ni mayúsculas
  const normalizeStateName = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Detectar si existen registros cargados en la base de datos para el mes/año consultado
  const monthHasRecords = useMemo(() => {
    const targetM = normalizeMonthName(activeConsultMonth);
    return (records || []).some((r) => {
      if (!r) return false;
      const rM = normalizeMonthName(r.mes);
      return rM === targetM && (activeConsultYear === 'ALL' || !r.anio || String(r.anio) === String(activeConsultYear));
    });
  }, [records, activeConsultMonth, activeConsultYear]);

  // Filter stations strictly based on state, month evaluations, and search query
  const visibleStations = useMemo(() => {
    let list = detectedPlantsList;

    // 1. Filtro estricto por dropdown o búsqueda de Estado
    if (effectiveState !== 'ALL') {
      const normState = normalizeStateName(effectiveState);
      list = list.filter((st) => normalizeStateName(getEntityState(st)) === normState);
    }

    // 2. Filtro estricto por texto en el buscador (nombre específico de estación o planta)
    if (parsedSearch.stationFilterText) {
      const needle = parsedSearch.stationFilterText.toLowerCase().trim();
      list = list.filter(
        (st) =>
          st.toLowerCase().includes(needle) ||
          st.replace('Mochis - ', '').toLowerCase().includes(needle) ||
          getEntityState(st).toLowerCase().includes(needle)
      );
    }

    // 3. Filtro por mes: si está activado y hay registros en la base para este mes, mostrar únicamente estaciones evaluadas en este mes
    if (filterOnlyEvaluatedInMonth && monthHasRecords) {
      const targetM = normalizeMonthName(activeConsultMonth);
      list = list.filter((st) => {
        return (records || []).some((r) => {
          if (!r || !isSameStation(r.estacion, st)) return false;
          const rMes = normalizeMonthName(r.mes);
          if (rMes && targetM && rMes !== targetM) return false;
          if (activeConsultYear !== 'ALL' && r.anio && String(r.anio) !== String(activeConsultYear)) return false;
          return true;
        });
      });
    }

    return list;
  }, [
    detectedPlantsList,
    effectiveState,
    parsedSearch.stationFilterText,
    filterOnlyEvaluatedInMonth,
    monthHasRecords,
    activeConsultMonth,
    activeConsultYear,
    records,
  ]);

  // Compute station scores for selected month using official formulas (excluding N/A via rule of three)
  const stationStats = useMemo(() => {
    return detectedPlantsList.map((st) => {
      const overall = calculateStationOverall(st, records, activeConsultMonth, activeConsultYear);
      let evaluatedPointsCount = 0;
      const targetM = normalizeMonthName(activeConsultMonth);

      RUBRO_ITEMS.forEach((item) => {
        if (item.isInformative) return;
        const match = records.find((r) => {
          if (!r) return false;
          if (!isSameStation(r.estacion, st)) return false;
          const rMes = normalizeMonthName(r.mes);
          if (rMes && targetM && rMes !== targetM) return false;
          if (activeConsultYear !== 'ALL' && r.anio && String(r.anio) !== String(activeConsultYear)) return false;
          return isMatchingRubroItem(r.punto, item);
        });
        if (match) evaluatedPointsCount++;
      });

      return {
        station: st,
        state: getEntityState(st),
        totalScore: overall.totalPuntosPonderados,
        pct: overall.calificacionFinal,
        estatus: overall.estatus,
        evaluatedPointsCount,
      };
    });
  }, [detectedPlantsList, records, activeConsultMonth, activeConsultYear, customMasters]);

  // Sorted list of stations/plants
  const sortedStations = useMemo(() => {
    const list = [...visibleStations];
    return list.sort((a, b) => {
      const statA = stationStats.find((s) => s.station === a);
      const statB = stationStats.find((s) => s.station === b);

      if (sortBy === 'name') {
        return sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
      }
      if (sortBy === 'score' || sortBy === 'pct') {
        const valA = statA ? statA.totalScore : 0;
        const valB = statB ? statB.totalScore : 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [visibleStations, stationStats, sortBy, sortOrder]);

  // Pre-index records per station for fast lookup in matrix table and section calculations
  const stationRecordsMap = useMemo(() => {
    const map: Record<string, StationEvaluationRecord[]> = {};
    for (const st of sortedStations) {
      map[st] = (records || []).filter((r) => isSameStation(r.estacion, st));
    }
    return map;
  }, [sortedStations, records]);

  // Registros que coinciden con las entidades seleccionadas y el alcance para borrar
  const matchingRecordsToDelete = useMemo(() => {
    if (selectedEntityNames.size === 0) return [];
    return records.filter((r) => {
      const matchEntity = Array.from(selectedEntityNames).some(
        (name) =>
          isSameStation(r.estacion, name) ||
          r.estacion.toLowerCase() === name.toLowerCase() ||
          r.estacion.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(r.estacion.toLowerCase())
      );
      if (!matchEntity) return false;

      // Si el alcance es todos los registros históricos, coincide de inmediato
      if (deleteScope === 'all_records') return true;

      const matchYear =
        activeConsultYear === 'ALL' ||
        !r.anio ||
        String(r.anio) === String(activeConsultYear);

      if (deleteScope === 'all_year') return matchYear;

      // Alcance de mes consultado
      const matchMonth =
        !r.mes ||
        normalizeMonthName(r.mes) === normalizeMonthName(activeConsultMonth);

      return matchYear && matchMonth;
    });
  }, [selectedEntityNames, records, deleteScope, activeConsultYear, activeConsultMonth]);

  const handleToggleSelectAllVisibleEntities = () => {
    if (selectedEntityNames.size === sortedStations.length && sortedStations.length > 0) {
      setSelectedEntityNames(new Set());
    } else {
      setSelectedEntityNames(new Set(sortedStations));
    }
  };

  const handleToggleEntitySelection = (name: string) => {
    const next = new Set(selectedEntityNames);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedEntityNames(next);
  };

  const handleConfirmDelete = () => {
    if (!onDeleteRecords || matchingRecordsToDelete.length === 0) return;
    const ids = matchingRecordsToDelete.map((r) => r.id);
    onDeleteRecords(ids);
    setLastDeletedCount(ids.length);
    setSelectedEntityNames(new Set());
    setIsSelectionMode(false);
    setIsConfirmDeleteOpen(false);
  };

  const handleExport = (format: 'xlsx' | 'csv' = 'xlsx') => {
    setIsExporting(true);
    try {
      const stationsToExport =
        visibleStations.length > 0
          ? visibleStations
          : detectedPlantsList.length > 0
          ? detectedPlantsList
          : stations.length > 0
          ? stations
          : Array.from(new Set(records.map((r) => r.estacion))).filter(Boolean);

      const finalStations =
        stationsToExport.length > 0
          ? stationsToExport
          : [];

      const exportYear = activeConsultYear === 'ALL' ? (availableYears[0] || 2026) : Number(activeConsultYear);
      const fileName = `Matriz_General_${entityLabel === 'Planta' ? 'Plantas' : 'Estaciones'}_${activeConsultMonth}_${exportYear}.${format}`;

      if (format === 'csv') {
        exportModule3ToCsv(
          finalStations,
          records,
          activeConsultMonth,
          exportYear,
          fileName
        );
      } else {
        exportModule3ToExcel(
          finalStations,
          records,
          activeConsultMonth,
          exportYear,
          fileName
        );
      }

      if (showToast) {
        showToast(`¡Matriz exportada exitosamente en formato ${format.toUpperCase()}!`);
      }
    } catch (e: any) {
      console.error('Error al exportar matriz:', e);
      if (showToast) {
        showToast(`Error al exportar: ${e?.message || 'Error desconocido'}`);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDatabase = () => {
    setIsExporting(true);
    try {
      const stationsToExport =
        visibleStations.length > 0
          ? visibleStations
          : detectedPlantsList.length > 0
          ? detectedPlantsList
          : stations.length > 0
          ? stations
          : Array.from(new Set(records.map((r) => r.estacion))).filter(Boolean);

      const exportYear = activeConsultYear === 'ALL' ? (availableYears[0] || 2026) : Number(activeConsultYear);
      const fileName = `Base_Evaluaciones_${entityLabel === 'Planta' ? 'Plantas' : 'Estaciones'}_${activeConsultMonth}_${exportYear}.xlsx`;

      exportModule3DatabaseOnlyToExcel(
        stationsToExport,
        records,
        activeConsultMonth,
        exportYear,
        fileName
      );

      if (showToast) {
        showToast('¡Base de Datos de Evaluaciones exportada exitosamente (.xlsx)!');
      }
    } catch (e: any) {
      console.error('Error al exportar base de datos:', e);
      if (showToast) {
        showToast(`Error al exportar: ${e?.message || 'Error desconocido'}`);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const rubrosToDisplay = useMemo(() => {
    if (filterRubro === 'ALL') return RUBROS_META;
    return RUBROS_META.filter((r) => r.id === filterRubro);
  }, [filterRubro]);

  const filteredItems = useMemo(() => {
    return RUBRO_ITEMS.filter((i) => {
      if (filterRubro !== 'ALL' && i.rubroId !== filterRubro) return false;
      if (!itemSearchTerm) return true;
      const q = itemSearchTerm.toLowerCase();
      return (
        i.description.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        i.norma.toLowerCase().includes(q)
      );
    });
  }, [filterRubro, itemSearchTerm]);

  // Overall statistics for visible stations/plants
  const generalAvgScore = useMemo(() => {
    const activeStats = stationStats.filter((s) => visibleStations.includes(s.station));
    if (activeStats.length === 0) return '0.0';
    const sum = activeStats.reduce((acc, curr) => acc + curr.totalScore, 0);
    return (sum / activeStats.length).toFixed(1);
  }, [stationStats, visibleStations]);

  const generalAvgPct = useMemo(() => {
    const activeStats = stationStats.filter((s) => visibleStations.includes(s.station));
    if (activeStats.length === 0) return 0;
    const sum = activeStats.reduce((acc, curr) => acc + curr.pct, 0);
    return Math.round(sum / activeStats.length);
  }, [stationStats, visibleStations]);

  const handleSelectState = (stateName: string) => {
    setSelectedState(stateName);
    if (stateName === 'ALL') {
      if (parsedSearch.detectedMonth) {
        setStationSearch(parsedSearch.detectedMonth.toLowerCase());
      } else {
        setStationSearch('');
      }
    } else {
      if (parsedSearch.detectedMonth) {
        setStationSearch(`${parsedSearch.detectedMonth.toLowerCase()} ${stateName}`);
      }
    }
  };

  const canEdit = user?.role === 'Admin' || user?.role === 'Coordinador' || user?.role === 'Administrador';

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Top Banner and Controls */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 max-w-full overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 mb-1">
              <span>MÓDULO 3</span>
              <span>/</span>
              <span>TABLERO GENERAL COMPARATIVO</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-950">
              {entityLabel === 'Planta' ? 'Matriz Comparativa Multi-Planta' : 'Matriz Comparativa Multi-Estación'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Consolidado de cumplimiento y comparativa de calificaciones para {detectedPlantsList.length} {entityPluralLabel.toLowerCase()} en {detectedStatesList.length} estados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            {/* Botón directo para Seleccionar / Borrar Registros (de 1 a todas las entidades) */}
            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) {
                  setSelectedEntityNames(new Set());
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded transition-all shadow-xs cursor-pointer border ${
                isSelectionMode
                  ? 'bg-red-600 text-white border-red-700 hover:bg-red-700'
                  : 'bg-white text-neutral-800 hover:text-red-700 border-neutral-300 hover:border-red-300'
              }`}
              title="Seleccionar desde una hasta todas las estaciones/plantas y borrar sus registros"
            >
              <Trash2 className={`w-3.5 h-3.5 ${isSelectionMode ? 'text-white' : 'text-red-600'}`} />
              <span>{isSelectionMode ? 'Cancelar Selección' : 'Seleccionar / Borrar Registros'}</span>
            </button>

            {records.length > 0 && onClearAllRecords && (
              <button
                type="button"
                onClick={() => setIsConfirmClearAllOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded transition-all shadow-xs cursor-pointer border bg-red-100 hover:bg-red-200 text-red-800 border-red-300"
                title={`Eliminar permanentemente todos los registros de prueba (${records.length} evaluaciones)`}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-700" />
                <span>Vaciar Toda la Base (0 registros de muestra)</span>
              </button>
            )}

            {/* LISTA DESPLEGABLE: Exportar matriz, exportar base, exportar */}
            <div className="relative inline-block text-left" ref={actionsDropdownRef}>
              <button
                type="button"
                onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded transition-all shadow-xs cursor-pointer border bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800"
                aria-expanded={isActionsDropdownOpen}
                aria-haspopup="true"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>Exportar</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isActionsDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isActionsDropdownOpen && (
                <div
                  className="absolute right-0 mt-1.5 w-68 rounded-xl bg-white shadow-xl ring-1 ring-black/10 divide-y divide-neutral-100 z-50 focus:outline-none animate-in fade-in-50 zoom-in-95 duration-100"
                  role="menu"
                >
                  <div className="p-1.5 space-y-0.5">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                      Exportaciones
                    </div>

                    {/* Botón 1: Exportar matriz */}
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => {
                        setIsActionsDropdownOpen(false);
                        handleExport('xlsx');
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs text-neutral-800 hover:bg-neutral-100 hover:text-neutral-950 rounded-lg transition-colors text-left cursor-pointer group"
                      role="menuitem"
                    >
                      <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100 flex items-center justify-center shrink-0">
                        <Download className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-neutral-900 leading-tight">Exportar matriz</div>
                        <div className="text-[10px] text-neutral-500 truncate">Matriz comparativa (.xlsx)</div>
                      </div>
                    </button>

                    {/* Botón 2: Exportar base */}
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => {
                        setIsActionsDropdownOpen(false);
                        handleExportDatabase();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs text-neutral-800 hover:bg-neutral-100 hover:text-neutral-950 rounded-lg transition-colors text-left cursor-pointer group"
                      role="menuitem"
                    >
                      <div className="w-7 h-7 rounded-md bg-cyan-50 text-cyan-700 group-hover:bg-cyan-100 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-neutral-900 leading-tight">Exportar base</div>
                        <div className="text-[10px] text-neutral-500 truncate">Base BD de evaluaciones (.xlsx)</div>
                      </div>
                    </button>

                    {/* Botón 3: Exportar */}
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => {
                        setIsActionsDropdownOpen(false);
                        handleExport('csv');
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs text-neutral-800 hover:bg-neutral-100 hover:text-neutral-950 rounded-lg transition-colors text-left cursor-pointer group"
                      role="menuitem"
                    >
                      <div className="w-7 h-7 rounded-md bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200 flex items-center justify-center shrink-0">
                        <Download className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-neutral-900 leading-tight">Exportar</div>
                        <div className="text-[10px] text-neutral-500 truncate">Archivo plano (.csv)</div>
                      </div>
                    </button>
                  </div>

                  <div className="p-1.5">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                      Gestión de Registros
                    </div>

                    {/* Botón 4: Seleccionar / borrar registros */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsDropdownOpen(false);
                        setIsSelectionMode(!isSelectionMode);
                        if (isSelectionMode) {
                          setSelectedEntityNames(new Set());
                        }
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg transition-colors text-left cursor-pointer group ${
                        isSelectionMode
                          ? 'bg-red-50 text-red-900 hover:bg-red-100'
                          : 'text-neutral-800 hover:bg-red-50 hover:text-red-700'
                      }`}
                      role="menuitem"
                    >
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                          isSelectionMode
                            ? 'bg-red-200 text-red-800'
                            : 'bg-red-50 text-red-600 group-hover:bg-red-100'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold leading-tight">
                          {isSelectionMode ? 'Cancelar Selección' : 'Seleccionar / borrar registros'}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">
                          {isSelectionMode ? 'Desactivar modo selección' : 'Marcar estaciones y eliminar'}
                        </div>
                      </div>
                    </button>

                    {/* Botón 5: Vaciar todas las evaluaciones de muestra */}
                    {onClearAllRecords && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionsDropdownOpen(false);
                          setIsConfirmClearAllOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs text-red-700 hover:bg-red-50 hover:text-red-900 rounded-lg transition-colors text-left cursor-pointer group mt-0.5"
                        role="menuitem"
                      >
                        <div className="w-7 h-7 rounded-md bg-red-100 text-red-700 group-hover:bg-red-200 flex items-center justify-center shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold leading-tight text-red-800">Vaciar toda la base</div>
                          <div className="text-[10px] text-red-500 truncate">Borrar registros de prueba ({records.length})</div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filtros: Mes/Año, Estado (después del mes) + Estadísticas */}
        <div className="mt-5 pt-4 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* 1. FILTRO DE MES Y AÑO */}
          <div className="lg:col-span-4 sm:col-span-1">
            <label className="block text-[11px] font-semibold text-neutral-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-700" />
              <span>Seleccionar Mes a Consultar:</span>
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const m = e.target.value as MonthName;
                  setSelectedMonth(m);
                  if (parsedSearch.detectedMonth && parsedSearch.detectedMonth !== m) {
                    setStationSearch((prev) => prev.replace(new RegExp(parsedSearch.detectedMonth!, 'i'), m));
                  }
                }}
                className="w-full px-3 py-2 text-sm font-semibold border-2 border-neutral-900 rounded bg-white text-neutral-900 focus:outline-none shadow-2xs"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="w-32 px-2.5 py-2 text-sm font-semibold border border-neutral-300 rounded bg-white text-neutral-800 shadow-2xs"
              >
                <option value="ALL">
                  {availableYears.length === 0 ? 'Sin años (0)' : 'Todos (Años)'}
                </option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              {/* Botón de acceso a la Ventana Flotante: Anexos */}
              <button
                type="button"
                onClick={() => setIsAnexosModalOpen(true)}
                className="px-3 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                title={`Abrir ventana Anexos para consultar y descargar documentos de ${activeConsultMonth}`}
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Anexos ({activeConsultMonth.slice(0, 3)})</span>
                {anexosList.filter((a) => normalizeMonthName(a.mes) === normalizeMonthName(activeConsultMonth)).length > 0 && (
                  <span className="w-4 h-4 bg-amber-400 text-neutral-950 rounded-full text-[9px] flex items-center justify-center font-black">
                    {anexosList.filter((a) => normalizeMonthName(a.mes) === normalizeMonthName(activeConsultMonth)).length}
                  </span>
                )}
              </button>
            </div>

            {/* Indicador de meses que tienen datos cargados en el sistema */}
            {detectedMonthsWithRecords.size > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-neutral-500 font-medium">Meses con datos:</span>
                {Array.from(detectedMonthsWithRecords.entries()).map(([m, count]) => {
                  const isActive = selectedMonth === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMonth(m as MonthName)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-neutral-900 text-white shadow-xs'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-200'
                      }`}
                      title={`Clic para consultar ${m} (${count} registros cargados)`}
                    >
                      {m} <span className="opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. FILTRO: ESTADO (después del filtro de mes) */}
          <div className="lg:col-span-4 sm:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-neutral-700" />
                <span>Estado:</span>
              </label>
              {(selectedState !== 'ALL' || parsedSearch.detectedState) && (
                <button
                  type="button"
                  onClick={() => handleSelectState('ALL')}
                  className="text-[10px] text-cyan-700 hover:text-cyan-950 font-bold underline cursor-pointer"
                >
                  Ver todos
                </button>
              )}
            </div>
            <select
              value={selectedState}
              onChange={(e) => handleSelectState(e.target.value)}
              className={`w-full px-3 py-2 text-sm font-semibold border-2 rounded bg-white text-neutral-900 focus:outline-none shadow-2xs transition-all ${
                selectedState !== 'ALL'
                  ? 'border-cyan-600 bg-cyan-50/40 text-cyan-950 font-bold ring-1 ring-cyan-500'
                  : 'border-neutral-900'
              }`}
            >
              <option value="ALL">
                {detectedStatesList.length === 0
                  ? '-- Sin Estados (0 registros) --'
                  : `-- Todos los Estados (${detectedStatesList.length}) --`}
              </option>
              {detectedStatesList.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {monthHasRecords && (
              <label className="flex items-center gap-1.5 mt-2 text-[10.5px] text-neutral-600 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterOnlyEvaluatedInMonth}
                  onChange={(e) => setFilterOnlyEvaluatedInMonth(e.target.checked)}
                  className="rounded text-cyan-700 focus:ring-cyan-600 cursor-pointer"
                />
                <span>Mostrar solo evaluadas en {activeConsultMonth.toLowerCase()}</span>
              </label>
            )}
          </div>

          {/* 3. TOTAL EVALUADAS / FILTRADAS */}
          <div className="lg:col-span-2 sm:col-span-1">
            <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1 truncate">
              {selectedState !== 'ALL' ? `Estado: ${selectedState}` : `Total ${entityPluralLabel}`}
            </label>
            <div className="py-2 px-3 border border-neutral-200 bg-neutral-50 rounded text-xs font-mono font-bold text-neutral-900 flex items-center justify-between shadow-2xs">
              <span className="truncate">
                {selectedState !== 'ALL'
                  ? `${visibleStations.length} de ${detectedPlantsList.length}`
                  : `${detectedPlantsList.length} ${entityPluralLabel}`}
              </span>
              <Building2 className="w-4 h-4 text-neutral-400 shrink-0 ml-1" />
            </div>
          </div>

          {/* 4. PROMEDIO GENERAL */}
          <div className="lg:col-span-2 sm:col-span-1">
            <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1 truncate">
              Promedio ({activeConsultMonth.slice(0, 3)})
            </label>
            <div className="py-2 px-3 border border-neutral-200 bg-neutral-50 rounded text-xs font-mono font-bold text-neutral-900 flex items-center justify-between shadow-2xs">
              <span>{(!records || records.length === 0) ? '0 / 0 pts' : `${generalAvgScore} / 106 pts`}</span>
              <span
                className={`font-bold ${
                  (!records || records.length === 0)
                    ? 'text-neutral-500'
                    : generalAvgPct >= 85
                    ? 'text-emerald-700'
                    : generalAvgPct >= 70
                    ? 'text-amber-700'
                    : 'text-red-700'
                }`}
              >
                {(!records || records.length === 0) ? '0%' : `${generalAvgPct}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Station Leaderboard / Ranking Summary - Muestra ÚNICAMENTE las estaciones filtradas */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-neutral-700" />
            <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
              Resumen de Cumplimiento: {entityLabel} en {activeConsultMonth}
              {activeConsultYear !== 'ALL' ? ` ${activeConsultYear}` : ''}
              {effectiveState !== 'ALL' ? ` · ${effectiveState}` : ''}
              {' '}({sortedStations.length} {sortedStations.length === 1 ? entityLabel.toLowerCase() : entityPluralLabel.toLowerCase()})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSortBy('score');
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              }}
              className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Ordenar por Puntaje ({sortOrder.toUpperCase()})</span>
            </button>
          </div>
        </div>

        {sortedStations.length === 0 ? (
          <div className="py-8 px-4 text-center text-xs text-neutral-500 bg-neutral-50 rounded-lg border border-neutral-200">
            <Building2 className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="font-bold text-sm text-neutral-800">
              {(!records || records.length === 0)
                ? `Matriz General en Ceros: Base de Datos Vacía (0 registros en Módulo 2)`
                : `No se encontraron ${entityPluralLabel.toLowerCase()} para los filtros seleccionados`}
            </p>
            <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
              {(!records || records.length === 0)
                ? `No existen evaluaciones registradas en el Módulo 2. Todos los campos e indicadores se encuentran limpios y en ceros.`
                : `Filtro: Mes ${activeConsultMonth} ${activeConsultYear !== 'ALL' ? activeConsultYear : ''}`}
            </p>
            {filterOnlyEvaluatedInMonth && monthHasRecords && (
              <button
                type="button"
                onClick={() => setFilterOnlyEvaluatedInMonth(false)}
                className="mt-2.5 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded transition-colors cursor-pointer"
              >
                <span>Mostrar todas las estaciones del catálogo en {effectiveState !== 'ALL' ? effectiveState : 'este mes'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1">
            {sortedStations.map((st, idx) => {
              const stat = stationStats.find((s) => s.station === st);
              if (!stat) return null;
              const cleanName = st.replace('Mochis - ', '');
              const isEntitySelectedForDelete = isSelectionMode && selectedEntityNames.has(st);
              const isSelectedSpecific = parsedSearch.stationFilterText
                ? st.toLowerCase().includes(parsedSearch.stationFilterText.toLowerCase())
                : false;

              return (
                <div
                  key={st}
                  onClick={() => {
                    if (isSelectionMode) {
                      handleToggleEntitySelection(st);
                    } else {
                      if (parsedSearch.stationFilterText.toLowerCase() === cleanName.toLowerCase()) {
                        setStationSearch('');
                      } else {
                        setStationSearch(cleanName);
                      }
                    }
                  }}
                  className={`p-2 border rounded transition-all cursor-pointer flex items-center justify-between ${
                    isEntitySelectedForDelete
                      ? 'border-red-500 bg-red-50/90 shadow-xs ring-2 ring-red-400'
                      : isSelectedSpecific
                      ? 'border-cyan-600 bg-cyan-50/90 shadow-xs ring-2 ring-cyan-500'
                      : 'border-neutral-200 hover:border-neutral-400 bg-white'
                  }`}
                  title={
                    isSelectionMode
                      ? `Clic para marcar/desmarcar ${st} para eliminación`
                      : `Clic para filtrar únicamente la ${entityLabel.toLowerCase()} ${cleanName}`
                  }
                >
                  <div className="truncate mr-2 flex flex-col min-w-0">
                    <div className="flex items-center truncate">
                      {isSelectionMode ? (
                        <span className="mr-1.5 shrink-0 text-red-600">
                          {isEntitySelectedForDelete ? (
                            <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-neutral-400" />
                          )}
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-400 font-mono mr-1 shrink-0">#{idx + 1}</span>
                      )}
                      <span className="text-xs font-semibold text-neutral-900 truncate" title={st}>
                        {cleanName}
                      </span>
                      {isSelectedSpecific && !isSelectionMode && (
                        <div className="flex items-center gap-1 ml-1 shrink-0">
                          <Check className="w-3 h-3 text-cyan-700" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEntityNames(new Set([st]));
                              setIsConfirmDeleteOpen(true);
                            }}
                            className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title={`Eliminar registros de ${cleanName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-500 font-medium truncate flex items-center gap-0.5 mt-0.5">
                      <MapPin className="w-2.5 h-2.5 text-neutral-400 shrink-0" />
                      {stat.state}
                    </span>
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums shrink-0">
                    <span className="font-bold text-neutral-900">{stat.totalScore}</span>
                    <span
                      className={`ml-1 text-[11px] ${
                        stat.pct >= 85
                          ? 'text-emerald-700 font-semibold'
                          : stat.pct >= 70
                          ? 'text-amber-700'
                          : 'text-neutral-400'
                      }`}
                    >
                      ({stat.pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section Tabs & Item Search (idéntico a Módulo 1) */}
      <div className="space-y-2.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Section Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full text-xs no-scrollbar">
            <button
              onClick={() => setFilterRubro('ALL')}
              className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filterRubro === 'ALL'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              Todas las Secciones ({RUBROS_META.length})
            </button>
            {RUBROS_META.map((r) => (
              <button
                key={r.id}
                onClick={() => setFilterRubro(r.id)}
                className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  filterRubro === r.id
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                Sección {r.id}: {r.name.split(' ')[0]} ({r.maxPoints} pts)
              </button>
            ))}
          </div>

          {/* Search Box for checklist points or norms */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar punto o norma..."
              value={itemSearchTerm}
              onChange={(e) => setItemSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:border-neutral-900 bg-white shadow-2xs font-medium"
            />
            {itemSearchTerm && (
              <button
                type="button"
                onClick={() => setItemSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-800 rounded cursor-pointer"
                title="Limpiar búsqueda de puntos"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Visual Color Legend / Semáforo de Calificaciones (idéntico a Módulo 1) */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1 font-mono">
              <Info className="w-3.5 h-3.5 text-neutral-500" />
              Semáforo de Calificaciones:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-red-600 text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                0
              </span>
              <span className="text-neutral-700 font-medium">
                <strong>Cero (0)</strong> = Alerta Crítica (No cumple)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center shadow-xs">
                2
              </span>
              <span className="text-neutral-700 font-medium">
                <strong>Parcial (&lt; Máx)</strong> = Observación
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-white border border-neutral-300 text-neutral-900 font-bold text-[10px] flex items-center justify-center shadow-xs">
                5
              </span>
              <span className="text-neutral-700 font-medium">
                <strong>Máximo</strong> = Cumplimiento Total
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700 font-bold text-[10px] italic font-mono">
                N/A
              </span>
              <span className="text-neutral-700 font-medium">
                <strong>No Aplica</strong> = Excluido de base (Regla de tres)
              </span>
            </div>
            {/* Indicador LED de Cronómetro */}
            <div className="flex items-center gap-1.5 border-l border-neutral-300 pl-3">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-90 duration-700" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 border border-white shadow-[0_0_6px_#ef4444]" />
              </span>
              <span className="text-neutral-700 font-medium">
                <strong>LED Rojo (parpadeando)</strong> = Cronómetro Activo
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 border border-emerald-700 shrink-0 shadow-2xs" />
              <span className="text-neutral-700 font-medium">
                <strong>LED Verde (estático)</strong> = Cronómetro Inactivo
              </span>
            </div>
          </div>

          <div className="text-[11px] text-neutral-500 font-mono">
            Puntos base {entityLabel.toLowerCase()}: <strong>106 pts</strong>
          </div>
        </div>

        {/* Buscador de Mes/Estado y Filtros Activos */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative w-full sm:w-80 md:w-96">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={stationSearch}
              onChange={(e) => setStationSearch(e.target.value)}
              placeholder={`Buscador por mes y estado: ej. ${activeConsultMonth.toLowerCase()} ${
                detectedStatesList[0] || 'Sinaloa'
              }...`}
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-neutral-300 rounded bg-white focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 shadow-2xs font-medium"
            />
            {stationSearch && (
              <button
                type="button"
                onClick={() => {
                  setStationSearch('');
                  setSelectedState('ALL');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-800 rounded cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Feedback visual del buscador inteligente y sugerencias rápidas */}
          {parsedSearch.isSmartFilter || selectedState !== 'ALL' ? (
            <div className="flex flex-wrap items-center gap-1.5 bg-cyan-50 border border-cyan-200 text-cyan-900 px-2.5 py-1 rounded-md shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
              <span className="font-semibold text-[11px]">Filtros Activos:</span>
              <span className="bg-cyan-200/90 text-cyan-950 font-mono font-bold px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1.5">
                <span>Mes: {activeConsultMonth} {activeConsultYear}</span>
                <button
                  type="button"
                  onClick={() => setIsAnexosModalOpen(true)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-neutral-900 text-white rounded text-[10px] font-sans hover:bg-neutral-800 cursor-pointer shadow-2xs"
                  title="Abrir ventana Anexos para este mes"
                >
                  <FileText className="w-3 h-3 text-cyan-400" />
                  <span>Anexos</span>
                </button>
              </span>
              {(selectedState !== 'ALL' || parsedSearch.detectedState) && (
                <span className="bg-white border border-cyan-300 text-cyan-950 font-bold px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-cyan-700 shrink-0" />
                  Estado: {selectedState !== 'ALL' ? selectedState : parsedSearch.detectedState}
                </span>
              )}
              {parsedSearch.stationFilterText && (
                <span className="bg-white border border-cyan-300 text-cyan-950 font-bold px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-cyan-700 shrink-0" />
                  Nombre: {parsedSearch.stationFilterText}
                </span>
              )}
              <span className="text-neutral-500 font-mono text-[11px]">
                ({visibleStations.length} {visibleStations.length === 1 ? `${entityLabel.toLowerCase()} visible` : `${entityPluralLabel.toLowerCase()} visibles`})
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedState('ALL');
                  setStationSearch('');
                }}
                className="ml-1 text-cyan-800 hover:text-cyan-950 font-bold hover:underline cursor-pointer text-[11px]"
              >
                ✕ Limpiar filtro
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 overflow-x-auto">
              <span className="font-semibold text-neutral-700 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-600" />
                Buscar por mes y estado:
              </span>
              {[
                `septiembre ${detectedStatesList[0] || 'Sinaloa'}`,
                `octubre ${detectedStatesList[1] || 'Sonora'}`,
                'marzo',
                detectedStatesList[0] || 'Sinaloa',
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setStationSearch(example)}
                  className="px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 hover:text-neutral-900 rounded font-mono text-[10.5px] transition-colors cursor-pointer"
                >
                  "{example}"
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notification banner after deletion */}
      {lastDeletedCount !== null && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              ✓
            </span>
            <span>
              <strong>{lastDeletedCount} registros de {entityPluralLabel} eliminados exitosamente</strong> del sistema, del caché local y de Supabase. El sistema está limpio para subir nuevos archivos.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLastDeletedCount(null);
                onOpenImportModal();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir nuevo archivo Excel</span>
            </button>
            <button
              type="button"
              onClick={() => setLastDeletedCount(null)}
              className="px-2 py-1 text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Floating / Sticky Bar for Selection and Deletion Mode */}
      {isSelectionMode && (
        <div className="bg-red-50/90 border border-red-200 rounded-lg p-3.5 text-xs text-red-950 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold text-[11px] flex items-center gap-1">
              <Trash2 className="w-3 h-3" />
              Modo Borrado ({entityPluralLabel})
            </span>
            <span className="font-semibold text-neutral-800">
              {selectedEntityNames.size} de {sortedStations.length} {entityPluralLabel.toLowerCase()} seleccionadas
            </span>
            <button
              type="button"
              onClick={handleToggleSelectAllVisibleEntities}
              className="text-red-700 hover:text-red-900 font-bold underline cursor-pointer text-[11px]"
            >
              {selectedEntityNames.size === sortedStations.length ? 'Deseleccionar todas' : `Seleccionar todas (${sortedStations.length})`}
            </button>
            <span className="text-neutral-300">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-600 font-medium">Alcance:</span>
              <select
                value={deleteScope}
                onChange={(e) => setDeleteScope(e.target.value as any)}
                className="px-2 py-1 text-xs font-semibold bg-white border border-red-300 rounded text-neutral-900 focus:outline-none"
              >
                <option value="current_month">Solo mes consultado ({activeConsultMonth} {activeConsultYear})</option>
                <option value="all_year">Todo el año {activeConsultYear}</option>
                <option value="all_records">Todos los registros históricos</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsSelectionMode(false)}
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-300 rounded cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmDeleteOpen(true)}
              disabled={matchingRecordsToDelete.length === 0}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded shadow-xs transition-colors cursor-pointer ${
                matchingRecordsToDelete.length > 0
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                Borrar {matchingRecordsToDelete.length} Registros (Caché y Supabase)
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Matrix Table (Idéntico diseño, formato y clasificación por secciones de Módulo 1) */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[650px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-neutral-900 text-white font-mono text-xs border-b border-neutral-800">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center border-r border-neutral-800">No</th>
                <th className="py-2.5 px-3 min-w-[280px] border-r border-neutral-800">Punto a Revisar</th>
                <th className="py-2.5 px-2 w-14 text-center border-r border-neutral-800">Valor</th>
                {sortedStations.map((st) => (
                  <th
                    key={st}
                    className={`py-2 px-2 text-center min-w-[130px] font-semibold border-r border-neutral-800 truncate transition-colors ${
                      isSelectionMode && selectedEntityNames.has(st)
                        ? 'bg-red-950/80 text-red-200 ring-1 ring-red-400'
                        : 'text-neutral-100'
                    }`}
                    title={`${st} (${getEntityState(st)})`}
                  >
                    {isSelectionMode && (
                      <div className="flex justify-center mb-1">
                        <button
                          type="button"
                          onClick={() => handleToggleEntitySelection(st)}
                          className="p-0.5 text-neutral-300 hover:text-red-400 cursor-pointer inline-flex items-center justify-center"
                          title={`Seleccionar ${st} para borrar`}
                        >
                          {selectedEntityNames.has(st) ? (
                            <CheckSquare className="w-4 h-4 text-red-400" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-400" />
                          )}
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-1">
                      <span className="truncate font-bold text-white text-xs">{st.replace('Mochis - ', '')}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEntityNames(new Set([st]));
                          setDeleteScope('all_records');
                          setIsConfirmDeleteOpen(true);
                        }}
                        className="p-0.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                        title={`Eliminar registros de ${st}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="block text-[10px] text-cyan-300 font-normal truncate mt-0.5">
                      {getEntityState(st)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-800">
              {sortedStations.length === 0 ? (
                <tr>
                  <td colSpan={3 + Math.max(1, sortedStations.length)} className="py-16 px-4 text-center text-neutral-500 bg-neutral-50/50">
                    <Factory className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                    <p className="font-bold text-base text-neutral-900">
                      {(!records || records.length === 0)
                        ? 'Matriz General en Ceros: Base de Datos Vacía'
                        : `No se encontraron ${entityPluralLabel.toLowerCase()} para los filtros seleccionados`}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1.5 max-w-md mx-auto">
                      {(!records || records.length === 0)
                        ? 'No existen registros de evaluación en el Módulo 1 (Base de Datos). La Matriz General se encuentra completamente limpia y en ceros.'
                        : 'Intenta buscar con otro estado o término, o limpia los filtros para ver todas las opciones.'}
                    </p>
                    {records && records.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedState('ALL');
                          setStationSearch('');
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded shadow-xs cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Ver todas las {entityPluralLabel.toLowerCase()}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                rubrosToDisplay.map((rubro) => {
                  const rubroItems = RUBRO_ITEMS.filter((i) => i.rubroId === rubro.id).filter(
                    (item) => {
                      if (!itemSearchTerm) return true;
                      const q = itemSearchTerm.toLowerCase();
                      return (
                        item.description.toLowerCase().includes(q) ||
                        item.id.toLowerCase().includes(q) ||
                        item.norma.toLowerCase().includes(q)
                      );
                    }
                  );

                  if (rubroItems.length === 0) return null;

                  return (
                    <React.Fragment key={`rubro-${rubro.id}`}>
                      {/* SECTION HEADER ROW (IDÉNTICO A MÓDULO 1) */}
                      <tr className="bg-neutral-800 text-white border-t-2 border-neutral-900 font-mono">
                        <td colSpan={3} className="py-2.5 px-3 border-r border-neutral-700/60">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-[#0e7490] text-white flex items-center justify-center font-mono font-bold text-xs shrink-0">
                              {rubro.id}
                            </span>
                            <div>
                              <span className="font-bold tracking-wide uppercase text-neutral-100 text-xs">
                                SECCIÓN {rubro.id}: {rubro.name}
                              </span>
                              <span className="text-[11px] text-neutral-300 font-mono ml-2">
                                ({rubro.norma}) — Base: {rubro.maxPoints} pts
                              </span>
                            </div>
                          </div>
                        </td>
                        {sortedStations.map((st) => {
                          const stRecords = stationRecordsMap[st] || [];
                          const stSec = calculateSectionStats(
                            rubroItems,
                            stRecords,
                            activeConsultMonth,
                            rubro.id,
                            rubro.maxPoints,
                            rubro.name,
                            rubro.norma,
                            activeConsultYear
                          );
                          return (
                            <td
                              key={`sec-head-${rubro.id}-${st}`}
                              className="py-2 px-1 text-center font-mono text-[10px] text-cyan-200 bg-neutral-900/60 border-r border-neutral-700/60"
                            >
                              <div className="font-bold">{stSec.puntosPonderados} pts</div>
                              <div className="text-cyan-300/80">({stSec.pctCumplimiento}%)</div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* SECTION ITEM ROWS */}
                      {rubroItems.map((item) => {
                        return (
                          <tr key={item.id} className="hover:bg-neutral-50/80 transition-colors">
                            <td className="py-2 px-3 font-mono text-neutral-500 text-center font-medium border-r border-neutral-200">
                              {item.id}
                            </td>
                            <td className="py-2 px-3 border-r border-neutral-200">
                              <span className="font-medium text-neutral-900 block leading-snug">
                                {item.description}
                              </span>
                              <span className="text-[11px] text-neutral-400 font-mono block mt-0.5">
                                {item.norma} · {rubro.name}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-neutral-500 tabular-nums border-r border-neutral-200 font-semibold">
                              {item.isInformative ? '-' : item.maxPoints}
                            </td>

                            {/* Scores per station */}
                            {sortedStations.map((st) => {
                              const stRecords = stationRecordsMap[st] || [];
                              const targetM = normalizeMonthName(activeConsultMonth);
                              const match = stRecords.find((r) => {
                                if (!r) return false;
                                const rMes = normalizeMonthName(r.mes);
                                if (rMes && targetM && rMes !== targetM) return false;
                                if (activeConsultYear !== 'ALL' && r.anio && String(r.anio) !== String(activeConsultYear)) return false;
                                return isMatchingRubroItem(r.punto, item);
                              });

                              const calif = match ? match.calificacion : '-';
                              const cellFmt = getScoreCellFormat(calif, item.maxPoints, item.isInformative);
                              const evidenceCount = match?.evidencias?.length || 0;
                              const userFinalCount = match?.userFinalEvidencias?.length || 0;
                              const totalEvidences = evidenceCount + userFinalCount;
                              const hasScore = calif !== '-' && calif !== undefined && calif !== null && calif !== '';

                              return (
                                <td
                                  key={st}
                                  className="py-1.5 px-1.5 text-center font-mono tabular-nums border-r border-neutral-200"
                                  title={`${st} (${getEntityState(st)}) - ${item.description}: ${cellFmt.tooltipText}`}
                                >
                                  <div className="flex items-center justify-center gap-1.5">
                                    {/* LED Indicador de Cronómetro a un lado de la calificación / número */}
                                    {hasScore && (
                                      <TimerLedIndicator
                                        inspectorSubmittedAt={match?.inspectorSubmittedAt}
                                        timerFrozen={match?.timerFrozen}
                                        userFinalSubmittedAt={match?.userFinalSubmittedAt}
                                      />
                                    )}

                                    <span
                                      onClick={() => {
                                        if (match) setSelectedRecordForGallery(match);
                                      }}
                                      className={`inline-flex items-center justify-center min-w-[26px] px-2 py-0.5 rounded text-xs transition-transform ${cellFmt.bgClass} ${cellFmt.textClass} ${
                                        match ? 'cursor-pointer hover:opacity-90' : ''
                                      }`}
                                    >
                                      {cellFmt.badgeText}
                                    </span>

                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}

                      {/* SECTION SUBTOTAL ROW ("SANDWICHITO" - IDÉNTICO A MÓDULO 1) */}
                      <tr key={`rubro-sub-${rubro.id}`} className="bg-neutral-100/90 border-y-2 border-neutral-300 font-mono text-xs">
                        <td colSpan={2} className="py-2 px-3 border-r border-neutral-200">
                          <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                            <Calculator className="w-3.5 h-3.5 text-[#0e7490]" />
                            <span>SUBTOTAL SECCIÓN {rubro.id}: {rubro.name.toUpperCase()}</span>
                          </div>
                          <div className="text-[10px] text-neutral-500 font-normal">
                            Fórmula: (Puntos Obtenidos / Base sin N/A) × {rubro.maxPoints} pts base
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-neutral-900 border-r border-neutral-200">
                          {rubro.maxPoints}
                        </td>

                        {sortedStations.map((st) => {
                          const stRecords = stationRecordsMap[st] || [];
                          const mSec = calculateSectionStats(
                            rubroItems,
                            stRecords,
                            activeConsultMonth,
                            rubro.id,
                            rubro.maxPoints,
                            rubro.name,
                            rubro.norma,
                            activeConsultYear
                          );
                          return (
                            <td
                              key={`sub-${rubro.id}-${st}`}
                              className="py-2 px-1 text-center border-r border-neutral-200"
                            >
                              <div className="text-neutral-900 font-bold">
                                {mSec.puntosPonderados}
                              </div>
                              <div className="text-[10px] text-neutral-500 font-semibold">
                                {mSec.pctCumplimiento}%
                              </div>
                              {mSec.naCount > 0 && (
                                <div className="text-[9px] text-amber-700 italic">
                                  {mSec.naCount} N/A
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })
              )}

              {/* CONSOLIDATED GRAND TOTAL ROW (TOTAL GENERAL - IDÉNTICO A MÓDULO 1) */}
              {sortedStations.length > 0 && (
                <tr className="bg-neutral-900 text-white font-mono border-t-4 border-neutral-950 text-xs">
                  <td colSpan={2} className="py-3 px-3 border-r border-neutral-800">
                    <div className="font-extrabold text-sm uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>CALIFICACIÓN FINAL (TOTAL GENERAL)</span>
                    </div>
                    <div className="text-[11px] text-neutral-400 font-normal mt-0.5">
                      Suma consolidada de los subtotales ponderados de todas las secciones ({activeConsultMonth} {activeConsultYear !== 'ALL' ? activeConsultYear : ''})
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center font-extrabold text-sm text-neutral-200 border-r border-neutral-800">
                    106
                  </td>

                  {sortedStations.map((st) => {
                    const overall = calculateStationOverall(st, records, activeConsultMonth, activeConsultYear);
                    return (
                      <td
                        key={`grand-${st}`}
                        className="py-3 px-1 text-center border-r border-neutral-800"
                      >
                        <div className="text-sm font-bold text-white">
                          {overall.totalPuntosPonderados}
                        </div>
                        <div
                          className={`text-[11px] font-extrabold ${
                            overall.calificacionFinal >= 85
                              ? 'text-emerald-400'
                              : overall.calificacionFinal >= 80
                              ? 'text-amber-400'
                              : overall.totalPuntosPonderados > 0
                              ? 'text-red-400'
                              : 'text-neutral-500'
                          }`}
                        >
                          {overall.calificacionFinal}%
                        </div>
                        <div className="text-[9px] uppercase tracking-tighter opacity-80 text-neutral-300">
                          {overall.estatus}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bottom Bar when stations/plants are selected for deletion */}
      {selectedEntityNames.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-neutral-900 text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-neutral-700 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="font-bold flex items-center gap-1.5 text-neutral-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            {selectedEntityNames.size} de {sortedStations.length} {entityPluralLabel.toLowerCase()} seleccionadas ({matchingRecordsToDelete.length} registros)
          </span>
          <span className="text-neutral-600">|</span>
          <button
            type="button"
            onClick={handleToggleSelectAllVisibleEntities}
            className="text-cyan-300 hover:text-cyan-200 underline cursor-pointer text-xs font-semibold"
          >
            {selectedEntityNames.size === sortedStations.length ? 'Deseleccionar' : `Seleccionar todas (${sortedStations.length})`}
          </button>
          <span className="text-neutral-600">·</span>
          <button
            type="button"
            onClick={() => setSelectedEntityNames(new Set())}
            className="text-neutral-400 hover:text-white underline cursor-pointer text-xs"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => setIsConfirmDeleteOpen(true)}
            disabled={matchingRecordsToDelete.length === 0}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-white font-bold rounded-full transition-colors cursor-pointer shadow-md ${
              matchingRecordsToDelete.length > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-neutral-700 text-neutral-400 opacity-60 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Borrar {matchingRecordsToDelete.length} Registros</span>
          </button>
        </div>
      )}

      {/* Modal de confirmación para eliminar registros seleccionados */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Confirmar Eliminación de Registros
                </h3>
                <p className="text-xs text-neutral-500">
                  Módulo 3 · Matriz General de {entityPluralLabel}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-neutral-700 bg-neutral-50 p-3.5 rounded-lg border border-neutral-200">
              <p>
                Vas a eliminar <strong className="text-red-700 font-bold">{matchingRecordsToDelete.length}</strong> registro(s) de evaluación correspondientes a las <strong className="text-neutral-900 font-bold">{selectedEntityNames.size}</strong> {entityPluralLabel.toLowerCase()} seleccionadas.
              </p>
              <div className="text-[11px] text-neutral-600 font-medium bg-white p-2 rounded border border-neutral-200 space-y-1">
                <div>Alcance: <strong>{deleteScope === 'current_month' ? `Solo mes de ${activeConsultMonth} ${activeConsultYear}` : deleteScope === 'all_year' ? `Todo el año ${activeConsultYear}` : 'Todos los registros históricos'}</strong></div>
                <div>{entityPluralLabel}: <strong>{Array.from(selectedEntityNames).map((s) => s.replace('Mochis - ', '')).slice(0, 4).join(', ')}{selectedEntityNames.size > 4 ? ` y ${selectedEntityNames.size - 4} más...` : ''}</strong></div>
                {matchingRecordsToDelete.length === 0 && (
                  <div className="text-amber-700 bg-amber-50 p-1.5 rounded font-semibold mt-1">
                    Nota: No se encontraron registros evaluados en {activeConsultMonth}.
                    <button
                      type="button"
                      onClick={() => setDeleteScope('all_records')}
                      className="block text-cyan-800 underline font-bold mt-1 cursor-pointer"
                    >
                      Cambiar alcance a: Todos los registros históricos
                    </button>
                  </div>
                )}
              </div>
              <ul className="space-y-1.5 font-medium text-neutral-600">
                <li className="flex items-center gap-1.5 text-neutral-800">
                  <span className="text-red-500 font-bold">✓</span> Se removerán de la matriz comparativa y memoria del sistema.
                </li>
                <li className="flex items-center gap-1.5 text-neutral-800">
                  <span className="text-red-500 font-bold">✓</span> Se vaciará el caché local para que no vuelvan a mostrarse.
                </li>
                <li className="flex items-center gap-1.5 text-neutral-800">
                  <span className="text-red-500 font-bold">✓</span> Se eliminarán permanentemente de Supabase en tiempo real.
                </li>
              </ul>
              <p className="text-[11px] text-neutral-500 italic pt-1 border-t border-neutral-200">
                Esta acción te permitirá subir nuevos archivos Excel limpios para estas {entityPluralLabel.toLowerCase()} sin duplicados.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={matchingRecordsToDelete.length === 0}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors shadow-sm cursor-pointer ${
                  matchingRecordsToDelete.length > 0
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-neutral-300 cursor-not-allowed'
                }`}
              >
                Sí, Eliminar Permanentemente ({matchingRecordsToDelete.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para VACIAR TODA LA BASE DE DATOS (0 registros de prueba) */}
      {isConfirmClearAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-red-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Vaciar Base de Evaluaciones Completa
                </h3>
                <p className="text-xs text-neutral-500">
                  Módulo 3 · Matriz General de {entityPluralLabel}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-neutral-700 bg-neutral-50 p-3.5 rounded-lg border border-neutral-200">
              <p>
                ¿Deseas eliminar permanentemente todos los <strong className="text-red-700 font-bold">{records.length}</strong> registros de prueba de la base de datos?
              </p>
              <ul className="space-y-1.5 font-medium text-neutral-600">
                <li className="flex items-center gap-1.5 text-neutral-800">
                  <span className="text-red-500 font-bold">✓</span> Se eliminarán todas las calificaciones de prueba de <strong>todas</strong> las {entityPluralLabel.toLowerCase()}.
                </li>
                <li className="flex items-center gap-1.5 text-neutral-800">
                  <span className="text-red-500 font-bold">✓</span> Tanto la Matriz General como el Módulo 1 quedarán en <strong>0 evaluaciones</strong>.
                </li>
                <li className="flex items-center gap-1.5 text-neutral-800">
                  <span className="text-red-500 font-bold">✓</span> Se sincroniza en tiempo real con Supabase y el caché local.
                </li>
              </ul>
              <p className="text-[11px] text-neutral-500 italic pt-1 border-t border-neutral-200">
                El sistema quedará completamente limpio para que cargues tus archivos Excel oficiales sin registros residuales.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmClearAllOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmClearAllOpen(false);
                  onClearAllRecords?.();
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Sí, Vaciar Base Completa (0 evaluaciones)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Pill Bar for Selection Mode */}
      {selectedEntityNames.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-neutral-900 text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-neutral-700 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="font-bold flex items-center gap-1.5 text-neutral-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            {selectedEntityNames.size} de {sortedStations.length} {entityPluralLabel.toLowerCase()} ({matchingRecordsToDelete.length} registros)
          </span>
          <span className="text-neutral-600">|</span>
          <button
            type="button"
            onClick={handleToggleSelectAllVisibleEntities}
            className="text-cyan-300 hover:text-cyan-200 underline cursor-pointer text-xs font-semibold"
          >
            {selectedEntityNames.size === sortedStations.length ? 'Deseleccionar' : 'Seleccionar todas'}
          </button>
          <span className="text-neutral-600">·</span>
          <button
            type="button"
            onClick={() => setSelectedEntityNames(new Set())}
            className="text-neutral-400 hover:text-white underline cursor-pointer text-xs"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => setIsConfirmDeleteOpen(true)}
            disabled={matchingRecordsToDelete.length === 0}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-white font-bold rounded-full transition-colors cursor-pointer shadow-md ${
              matchingRecordsToDelete.length > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-neutral-700 text-neutral-400 opacity-60 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Borrar {matchingRecordsToDelete.length} Registros</span>
          </button>
        </div>
      )}

      {/* Evidence Gallery Modal with Timer and Inspector/User Response Tabs */}
      {selectedRecordForGallery && (
        <EvidenceGalleryModal
          isOpen={Boolean(selectedRecordForGallery)}
          onClose={() => setSelectedRecordForGallery(null)}
          record={selectedRecordForGallery}
          user={user}
          onUpdateRecord={(updated) => {
            setSelectedRecordForGallery(updated);
            if (onUpdateRecord) {
              onUpdateRecord(updated);
            }
          }}
        />
      )}

      {/* Ventana Flotante de Anexos (PDF, Excel, Word, etc.) */}
      {isAnexosModalOpen && (
        <AnexosModal
          isOpen={isAnexosModalOpen}
          onClose={() => setIsAnexosModalOpen(false)}
          month={activeConsultMonth}
          year={activeConsultYear !== 'ALL' ? Number(activeConsultYear) : 2026}
          availableStations={stations}
          user={user}
          anexos={anexosList}
          onAddAnexo={handleAddAnexo}
          onDeleteAnexo={handleDeleteAnexo}
          onClearAllAnexos={handleClearAllAnexos}
        />
      )}
    </div>
  );
};
