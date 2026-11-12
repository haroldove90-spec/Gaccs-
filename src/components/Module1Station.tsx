import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MonthName, MONTHS, StationEvaluationRecord, EvidencePhoto, RubroItem, UserSession, AnexoFile } from '../types';
import { RUBRO_ITEMS, RUBROS_META } from '../data/initialData';
import { exportModule1ToExcel } from '../utils/excelUtils';
import {
  calculateSectionStats,
  calculateStationOverall,
  getScoreCellFormat,
  isMatchingRubroItem,
  isSameStation,
  normalizeMonthName,
} from '../utils/evaluationFormulas';
import { safeStorageGet, safeStorageSet } from '../utils/sessionManager';
import { EvidenceGalleryModal } from './EvidenceGalleryModal';
import { CameraCaptureViewfinder } from './CameraCaptureViewfinder';
import { RecordTimerBadge, TimerLedIndicator, formatSecondsHuman } from './RecordTimerBadge';
import { AnexosModal } from './AnexosModal';
import { PRESET_FINDINGS_BY_ID } from '../data/zohoChecklistDef';
import {
  fetchAnexosFromSupabase,
  saveAnexoToSupabase,
  deleteAnexoFromSupabase,
  clearAllAnexosFromSupabase,
  loadLocalAnexos,
} from '../lib/supabaseClient';
import {
  Download,
  Upload,
  Search,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Camera,
  Image as ImageIcon,
  Trash2,
  ZoomIn,
  Plus,
  AlertCircle,
  Eye,
  Check,
  FileText,
  Info,
  Layers,
  Calculator,
  NotebookPen,
  Lock,
  MessageSquareText,
  CheckSquare,
  Square,
  Clock,
  Shield,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';

interface Module1StationProps {
  records: StationEvaluationRecord[];
  stations: string[];
  onUpdateRecord: (record: StationEvaluationRecord) => void;
  onDeleteRecords?: (recordIds: string[]) => void;
  onClearAllRecords?: () => void;
  onOpenImportModal: () => void;
  user?: UserSession;
  targetStation?: string | null;
  onStationChange?: (station: string) => void;
  entityLabel?: string;
}

interface EditingCellState {
  itemId: string;
  itemDesc: string;
  month: MonthName;
  currentVal: number | string;
  maxPoints: number;
  evidences: EvidencePhoto[]; // Evidencias del Coordinador / Auditor
  observaciones: string; // Observaciones del Coordinador / Auditor
  inspectorSubmittedAt?: string;
  inspectorUser?: string;
  userFinalEvidencias: EvidencePhoto[]; // Evidencias del Usuario Final (Subsanación / Respuesta)
  userFinalObservaciones: string; // Comentarios / justificación del Usuario Final
  userFinalSubmittedAt?: string;
  userFinalUser?: string;
  timerElapsedSeconds?: number;
  timerFrozen?: boolean;
}

export const Module1Station: React.FC<Module1StationProps> = ({
  records,
  stations,
  onUpdateRecord,
  onDeleteRecords,
  onClearAllRecords,
  onOpenImportModal,
  user,
  targetStation,
  onStationChange,
  entityLabel = 'Estación',
}) => {
  const [selectedStation, setSelectedStation] = useState<string>(() => {
    if (targetStation && stations.includes(targetStation)) return targetStation;
    try {
      const storageKey =
        entityLabel === 'Planta' ? 'evaluaciones_target_plant_v1' : 'evaluaciones_target_station_v1';
      const saved = safeStorageGet(storageKey);
      if (saved && stations.includes(saved)) return saved;
    } catch {}
    return stations[0] || '';
  });

  // Selection and deletion state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [deleteMonthScope, setDeleteMonthScope] = useState<'ALL' | MonthName>('ALL');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmClearAllOpen, setIsConfirmClearAllOpen] = useState(false);
  const [singleRecordToDelete, setSingleRecordToDelete] = useState<StationEvaluationRecord | null>(null);
  const [lastDeletedCount, setLastDeletedCount] = useState<number | null>(null);

  // Sync when targetStation prop changes
  useEffect(() => {
    if (targetStation && targetStation !== selectedStation) {
      const match = stations.find(
        (s) => isSameStation(s, targetStation) || s.trim().toLowerCase() === targetStation.trim().toLowerCase()
      );
      if (match) {
        setSelectedStation(match);
      } else if (stations.length > 0) {
        setSelectedStation(targetStation);
      }
    }
  }, [targetStation, stations, selectedStation]);

  // Sync if stations list updates and selectedStation is not in it
  useEffect(() => {
    if (stations.length > 0) {
      const exists = stations.some(
        (s) => isSameStation(s, selectedStation) || s.trim().toLowerCase() === selectedStation.trim().toLowerCase()
      );
      if (!exists) {
        setSelectedStation(stations[0]);
        onStationChange?.(stations[0]);
      }
    } else if (stations.length === 0 && selectedStation !== '') {
      setSelectedStation('');
      onStationChange?.('');
    }
  }, [stations, selectedStation]);

  useEffect(() => {
    if (selectedStation) {
      const storageKey =
        entityLabel === 'Planta' ? 'evaluaciones_target_plant_v1' : 'evaluaciones_target_station_v1';
      safeStorageSet(storageKey, selectedStation);
    }
  }, [selectedStation, entityLabel]);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    try {
      const saved = safeStorageGet('evaluaciones_m1_selected_year');
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num >= 2020 && num <= 2030) return num;
      }
    } catch {}
    return 2026;
  });

  useEffect(() => {
    if (selectedYear) {
      safeStorageSet('evaluaciones_m1_selected_year', String(selectedYear));
    }
  }, [selectedYear]);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeRubroTab, setActiveRubroTab] = useState<number | 'all'>('all');

  // General observations by section (stored in localStorage)
  const [sectionObservations, setSectionObservations] = useState<
    Record<string, { text: string; updatedAt: string; updatedBy: string }>
  >(() => {
    try {
      const saved = localStorage.getItem('evaluaciones_section_observations_v1');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Modal state for General Section Observations by Month
  const [activeObsRubro, setActiveObsRubro] = useState<{
    id: number;
    name: string;
    norma: string;
    maxPoints: number;
  } | null>(null);
  const [activeObsMonth, setActiveObsMonth] = useState<MonthName>('SEPTIEMBRE');
  const [tempObsText, setTempObsText] = useState<string>('');

  const canEdit = user?.role === 'Admin' || user?.role === 'Coordinador' || user?.role === 'Administrador' || user?.username === 'admin' || user?.username === 'coordinador';
  // Solo el admin podrá ver y editar las observaciones; los demás roles solo podrán ver
  const isAdmin = user?.role === 'Admin' || user?.role === 'Administrador' || user?.username === 'admin' || user?.username === 'admin1';
  const isReadOnly = user?.role === 'Usuario final';

  const handleOpenSectionMonthObs = (rubro: typeof RUBROS_META[0], month: MonthName) => {
    setActiveObsRubro(rubro);
    setActiveObsMonth(month);
    const key = `${selectedStation}_${selectedYear}_${rubro.id}_${month}`;
    const legacyKey = `${selectedStation}_${selectedYear}_${rubro.id}`;
    const current = sectionObservations[key] || (month === 'SEPTIEMBRE' ? sectionObservations[legacyKey] : undefined);
    setTempObsText(current?.text || '');
  };

  const handleSaveSectionObservation = () => {
    if (!activeObsRubro) return;
    const key = `${selectedStation}_${selectedYear}_${activeObsRubro.id}_${activeObsMonth}`;
    const updated = {
      ...sectionObservations,
      [key]: {
        text: tempObsText.trim(),
        month: activeObsMonth,
        rubroId: activeObsRubro.id,
        updatedAt: new Date().toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        updatedBy: user?.name || user?.username || 'Administrador',
      },
    };
    setSectionObservations(updated);
    try {
      localStorage.setItem('evaluaciones_section_observations_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setActiveObsRubro(null);
  };

  // Estado de la ventana flotante de Anexos (Archivos de consulta: PDF, Excel, Word, etc.)
  const [isAnexosModalOpen, setIsAnexosModalOpen] = useState<boolean>(false);
  const [anexosTargetMonth, setAnexosTargetMonth] = useState<MonthName>('SEPTIEMBRE');
  const [anexosList, setAnexosList] = useState<AnexoFile[]>(() => loadLocalAnexos());

  // Cargar anexos desde Supabase al montar y mantener sincronizado
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

  const handleOpenAnexos = (m: MonthName) => {
    setAnexosTargetMonth(m);
    setIsAnexosModalOpen(true);
  };

  const handleAddAnexo = async (newAnexo: AnexoFile) => {
    const taggedAnexo: AnexoFile = {
      ...newAnexo,
      estacion: selectedStation,
    };
    const updated = [taggedAnexo, ...anexosList.filter((a) => a.id !== taggedAnexo.id)];
    setAnexosList(updated);
    await saveAnexoToSupabase(taggedAnexo);
  };

  const handleDeleteAnexo = async (id: string) => {
    const updated = anexosList.filter((a) => a.id !== id);
    setAnexosList(updated);
    await deleteAnexoFromSupabase(id);
  };

  const handleClearAllAnexos = async (month?: string, year?: number) => {
    await clearAllAnexosFromSupabase(month, year, selectedStation);
    const updated = loadLocalAnexos();
    setAnexosList(updated);
  };

  // Cell quick edit modal state (including up to 4 photos for Coord and 4 photos for Usuario Final)
  const [editingCell, setEditingCell] = useState<EditingCellState | null>(null);

  // Gallery view modal state
  const [selectedRecordForGallery, setSelectedRecordForGallery] = useState<StationEvaluationRecord | null>(null);

  // In-app live camera viewfinder state
  const [liveCameraSlot, setLiveCameraSlot] = useState<number | null>(null);
  const [targetUploadType, setTargetUploadType] = useState<'inspector' | 'userFinal'>('inspector');

  // Preview full photo modal state
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; caption?: string } | null>(null);

  // Native camera & file picker refs
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const [targetSlotForUpload, setTargetSlotForUpload] = useState<number>(1);

  // Filter records for this station and year (robusto con isSameStation)
  const stationRecords = useMemo(() => {
    if (!selectedStation) return [];
    return records.filter(
      (r) =>
        isSameStation(r.estacion, selectedStation) &&
        (!r.anio || Number(r.anio) === Number(selectedYear))
    );
  }, [records, selectedStation, selectedYear]);

  const isDbEmpty = (records || []).length === 0;
  const isStationEmpty = !selectedStation || stationRecords.length === 0;

  const stationOptions = useMemo(() => {
    if (isDbEmpty || !records || records.length === 0) return [];
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.estacion && r.estacion.trim()) set.add(r.estacion.trim());
    });
    return Array.from(set).sort((a, b) => {
      const cleanA = a.replace('Mochis - ', '').trim();
      const cleanB = b.replace('Mochis - ', '').trim();
      return cleanA.localeCompare(cleanB, 'es', { sensitivity: 'base' });
    });
  }, [isDbEmpty, records]);

  // Lista dinámica de años presentes exclusivamente en los registros (sin años fantasmas)
  const availableYears = useMemo(() => {
    if (isDbEmpty || !records || records.length === 0) return [];
    const set = new Set<number>();
    records.forEach((r) => {
      const y = Number(r.anio);
      if (!isNaN(y) && y >= 2000 && y <= 2100) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [isDbEmpty, records]);

  // Sincronizar automáticamente la estación seleccionada cuando cambien los registros
  useEffect(() => {
    if (stationOptions.length === 0) {
      if (selectedStation) {
        setSelectedStation('');
      }
    } else if (!stationOptions.includes(selectedStation)) {
      const nextSt = targetStation && stationOptions.includes(targetStation) ? targetStation : stationOptions[0];
      setSelectedStation(nextSt);
      onStationChange?.(nextSt);
    }
  }, [stationOptions, selectedStation, targetStation, onStationChange]);

  // Sincronizar automáticamente el año seleccionado cuando cambien los registros
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  // Registros que coinciden con los puntos seleccionados y el alcance de mes para borrado
  const matchingRecordsToDelete = useMemo(() => {
    if (singleRecordToDelete) return [singleRecordToDelete];
    if (selectedItemIds.size === 0) return [];
    const isAllSelected = selectedItemIds.size === RUBRO_ITEMS.length;
    const selectedItems = RUBRO_ITEMS.filter((i) => selectedItemIds.has(i.id));

    return stationRecords.filter((r) => {
      const matchMonth =
        deleteMonthScope === 'ALL' ||
        normalizeMonthName(r.mes) === normalizeMonthName(deleteMonthScope);
      if (!matchMonth) return false;

      // Si seleccionó todos los puntos, borra todos los registros correspondientes
      if (isAllSelected) return true;

      // Coincidencia normalizada y exacta por norma / ID / descripción
      return selectedItems.some((item) => isMatchingRubroItem(r.punto, item));
    });
  }, [selectedItemIds, stationRecords, deleteMonthScope, singleRecordToDelete]);

  const handleToggleSelectAllItems = () => {
    if (selectedItemIds.size === RUBRO_ITEMS.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(RUBRO_ITEMS.map((i) => i.id)));
    }
  };

  const handleToggleItemSelection = (itemId: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setSelectedItemIds(next);
  };

  const handleConfirmDelete = () => {
    if (!onDeleteRecords) return;
    if (singleRecordToDelete) {
      onDeleteRecords([singleRecordToDelete.id]);
      setLastDeletedCount(1);
      setSingleRecordToDelete(null);
      setIsConfirmDeleteOpen(false);
      return;
    }
    if (matchingRecordsToDelete.length === 0) return;
    const ids = matchingRecordsToDelete.map((r) => r.id);
    onDeleteRecords(ids);
    setLastDeletedCount(ids.length);
    setSelectedItemIds(new Set());
    setIsSelectionMode(false);
    setIsConfirmDeleteOpen(false);
  };

  const handleOpenWipeStationRecords = () => {
    setSingleRecordToDelete(null);
    setSelectedItemIds(new Set(RUBRO_ITEMS.map((i) => i.id)));
    setDeleteMonthScope('ALL');
    setIsSelectionMode(true);
    setIsConfirmDeleteOpen(true);
  };

  // Calculate overall scores per month using the official formulas (including N/A rule-of-three)
  const monthlyOverallTotals = useMemo(() => {
    const result: Record<MonthName, { totalPonderado: number; pctFinal: number; estatus: string }> = {} as any;

    MONTHS.forEach((m) => {
      const overall = calculateStationOverall(selectedStation, stationRecords, m, selectedYear);
      result[m] = {
        totalPonderado: overall.totalPuntosPonderados,
        pctFinal: overall.calificacionFinal,
        estatus: overall.estatus,
      };
    });

    return result;
  }, [selectedStation, stationRecords, selectedYear]);

  // Detect available months with records for this station
  const evaluatedMonthsForStation = useMemo(() => {
    const set = new Set<MonthName>();
    stationRecords.forEach((r) => {
      const norm = normalizeMonthName(r.mes);
      if (norm) set.add(norm as MonthName);
    });
    return Array.from(set);
  }, [stationRecords]);

  // Active month calculation: prefer evaluated month with data (e.g. MAYO, SEPTIEMBRE, etc.)
  const activeEvaluatedMonth = useMemo<MonthName>(() => {
    const sepRecords = stationRecords.filter((r) => normalizeMonthName(r.mes) === 'SEPTIEMBRE');
    if (sepRecords.length > 0) return 'SEPTIEMBRE';
    let bestMonth: MonthName = 'SEPTIEMBRE';
    let maxCount = 0;
    MONTHS.forEach((m) => {
      const cnt = stationRecords.filter((r) => normalizeMonthName(r.mes) === normalizeMonthName(m)).length;
      if (cnt > maxCount) {
        maxCount = cnt;
        bestMonth = m;
      }
    });
    return bestMonth;
  }, [stationRecords]);

  const activeOverall = useMemo(() => {
    return calculateStationOverall(selectedStation, stationRecords, activeEvaluatedMonth, selectedYear);
  }, [selectedStation, stationRecords, activeEvaluatedMonth, selectedYear]);

  // Keep septemberOverall for backward compatibility
  const septemberOverall = useMemo(() => {
    return calculateStationOverall(selectedStation, stationRecords, 'SEPTIEMBRE', selectedYear);
  }, [selectedStation, stationRecords, selectedYear]);

  const handleExport = () => {
    exportModule1ToExcel(selectedStation, records, selectedYear);
  };

  // Open edit modal for a specific item and month
  const handleOpenEditCell = (item: RubroItem, month: MonthName) => {
    const targetM = normalizeMonthName(month);
    const rec = stationRecords.find(
      (r) =>
        normalizeMonthName(r.mes) === targetM &&
        isMatchingRubroItem(r.punto, item)
    );

    setEditingCell({
      itemId: item.id,
      itemDesc: item.description,
      month,
      currentVal: rec !== undefined ? rec.calificacion : 0,
      maxPoints: item.maxPoints,
      evidences: rec?.evidencias ? [...rec.evidencias] : [],
      observaciones: rec?.observaciones || '',
      inspectorSubmittedAt: rec?.inspectorSubmittedAt,
      inspectorUser: rec?.inspectorUser,
      userFinalEvidencias: rec?.userFinalEvidencias ? [...rec.userFinalEvidencias] : [],
      userFinalObservaciones: rec?.userFinalObservaciones || '',
      userFinalSubmittedAt: rec?.userFinalSubmittedAt,
      userFinalUser: rec?.userFinalUser,
      timerElapsedSeconds: rec?.timerElapsedSeconds,
      timerFrozen: rec?.timerFrozen,
    });
  };

  // Save changes to score + up to 4 evidence photos + observaciones (Coordinador y Usuario Final)
  const handleSaveCell = (newVal: number | string) => {
    if (!editingCell) return;

    const targetM = normalizeMonthName(editingCell.month);
    const existingRec = stationRecords.find(
      (r) =>
        normalizeMonthName(r.mes) === targetM &&
        isMatchingRubroItem(r.punto, {
          id: editingCell.itemId,
          description: editingCell.itemDesc,
          maxPoints: editingCell.maxPoints,
          rubroId: 1,
          rubroName: '',
          norma: '',
        })
    );

    const hasInspectorEvidences = editingCell.evidences && editingCell.evidences.length > 0;
    const hasInspectorNotes = Boolean(editingCell.observaciones && editingCell.observaciones.trim().length > 0);
    const hasUserFinalEvidences = editingCell.userFinalEvidencias && editingCell.userFinalEvidencias.length > 0;
    const hasUserFinalNotes = Boolean(editingCell.userFinalObservaciones && editingCell.userFinalObservaciones.trim().length > 0);
    const nowIso = new Date().toISOString();

    // 1. Cronómetro se activa cuando el Coordinador/Admin llena el formulario y sube sus evidencias u observaciones
    let inspectorSubmittedAt = editingCell.inspectorSubmittedAt || existingRec?.inspectorSubmittedAt;
    let inspectorUser = editingCell.inspectorUser || existingRec?.inspectorUser;

    if (!inspectorSubmittedAt && (hasInspectorEvidences || hasInspectorNotes) && (canEdit || !isReadOnly)) {
      inspectorSubmittedAt = nowIso;
      inspectorUser = user?.name || user?.username || 'Coordinador';
    }

    // 2. Cronómetro se detiene y congela cuando el Usuario Final sube sus evidencias y comentarios
    let userFinalSubmittedAt = editingCell.userFinalSubmittedAt || existingRec?.userFinalSubmittedAt;
    let userFinalUser = editingCell.userFinalUser || existingRec?.userFinalUser;
    let timerElapsedSeconds = editingCell.timerElapsedSeconds ?? existingRec?.timerElapsedSeconds;
    let timerFrozen = editingCell.timerFrozen ?? existingRec?.timerFrozen ?? false;

    // Si es Usuario final o si se subieron evidencias/comentarios del usuario final:
    if ((isReadOnly || user?.role === 'Usuario final' || hasUserFinalEvidences || hasUserFinalNotes) && (hasUserFinalEvidences || hasUserFinalNotes)) {
      if (!userFinalSubmittedAt) {
        userFinalSubmittedAt = nowIso;
      }
      userFinalUser = user?.name || user?.username || 'Usuario Final';
      if (!timerFrozen && inspectorSubmittedAt) {
        timerElapsedSeconds = Math.max(
          1,
          Math.floor((new Date(nowIso).getTime() - new Date(inspectorSubmittedAt).getTime()) / 1000)
        );
        timerFrozen = true;
      } else if (!timerFrozen) {
        timerFrozen = true;
      }
    }

    const recToSave: StationEvaluationRecord = existingRec
      ? {
          ...existingRec,
          calificacion: canEdit ? newVal : existingRec.calificacion,
          evidencias: editingCell.evidences,
          observaciones: editingCell.observaciones,
          inspectorSubmittedAt,
          inspectorUser,
          userFinalEvidencias: editingCell.userFinalEvidencias,
          userFinalObservaciones: editingCell.userFinalObservaciones,
          userFinalSubmittedAt,
          userFinalUser,
          timerElapsedSeconds,
          timerFrozen,
        }
      : {
          id: `rec-${Date.now()}`,
          concatenar: `${selectedStation}${editingCell.month}${editingCell.itemDesc}`,
          ciudad: 'Sinaloa - Mochis',
          estacion: selectedStation,
          mes: editingCell.month,
          anio: selectedYear,
          punto: editingCell.itemDesc,
          calificacion: canEdit ? newVal : 0,
          evidencias: editingCell.evidences,
          observaciones: editingCell.observaciones,
          inspectorSubmittedAt,
          inspectorUser,
          userFinalEvidencias: editingCell.userFinalEvidencias,
          userFinalObservaciones: editingCell.userFinalObservaciones,
          userFinalSubmittedAt,
          userFinalUser,
          timerElapsedSeconds,
          timerFrozen,
        };

    onUpdateRecord(recToSave);
    setEditingCell(null);
  };

  // Add or replace photo in a specific slot (1, 2, 3, 4) for either inspector or userFinal
  const handleAddPhotoToSlot = (
    dataUrl: string,
    slotIdx: number,
    type: 'inspector' | 'userFinal' = targetUploadType,
    caption = ''
  ) => {
    if (!editingCell) return;
    const now = new Date();
    const timestamp = now.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const nowIso = now.toISOString();

    const newPhoto: EvidencePhoto = {
      id: `${type === 'inspector' ? 'insp' : 'usr'}-photo-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      dataUrl,
      caption: caption || `${type === 'inspector' ? 'Evidencia Auditoría' : 'Subsanación Usuario Final'} - Foto ${slotIdx}`,
      timestamp,
      slotIndex: slotIdx,
    };

    if (type === 'inspector') {
      const nextEvidences = [...editingCell.evidences];
      const existingSlotIdx = nextEvidences.findIndex((p) => p.slotIndex === slotIdx);
      if (existingSlotIdx !== -1) {
        nextEvidences[existingSlotIdx] = newPhoto;
      } else {
        nextEvidences.push(newPhoto);
      }
      nextEvidences.sort((a, b) => (a.slotIndex || 1) - (b.slotIndex || 1));

      // Inicia cronómetro si es primera vez que sube evidencias
      const startAt = editingCell.inspectorSubmittedAt || nowIso;
      setEditingCell({
        ...editingCell,
        evidences: nextEvidences,
        inspectorSubmittedAt: startAt,
        inspectorUser: editingCell.inspectorUser || user?.name || user?.username || 'Coordinador',
      });
    } else {
      // type === 'userFinal'
      const nextUserFinal = [...editingCell.userFinalEvidencias];
      const existingSlotIdx = nextUserFinal.findIndex((p) => p.slotIndex === slotIdx);
      if (existingSlotIdx !== -1) {
        nextUserFinal[existingSlotIdx] = newPhoto;
      } else {
        nextUserFinal.push(newPhoto);
      }
      nextUserFinal.sort((a, b) => (a.slotIndex || 1) - (b.slotIndex || 1));

      // Detiene y congela el cronómetro al subir evidencias del usuario final
      let elapsedSec = editingCell.timerElapsedSeconds;
      if (!editingCell.timerFrozen && editingCell.inspectorSubmittedAt) {
        elapsedSec = Math.max(
          1,
          Math.floor((new Date(nowIso).getTime() - new Date(editingCell.inspectorSubmittedAt).getTime()) / 1000)
        );
      }

      setEditingCell({
        ...editingCell,
        userFinalEvidencias: nextUserFinal,
        userFinalSubmittedAt: editingCell.userFinalSubmittedAt || nowIso,
        userFinalUser: editingCell.userFinalUser || user?.name || user?.username || 'Usuario Final',
        timerElapsedSeconds: elapsedSec,
        timerFrozen: true,
      });
    }
  };

  // Remove photo from slot
  const handleRemovePhotoFromSlot = (slotIdx: number, type: 'inspector' | 'userFinal') => {
    if (!editingCell) return;
    if (type === 'inspector') {
      const nextEvidences = editingCell.evidences.filter((p) => p.slotIndex !== slotIdx);
      setEditingCell({
        ...editingCell,
        evidences: nextEvidences,
      });
    } else {
      const nextUserFinal = editingCell.userFinalEvidencias.filter((p) => p.slotIndex !== slotIdx);
      setEditingCell({
        ...editingCell,
        userFinalEvidencias: nextUserFinal,
      });
    }
  };

  // Update caption for a slot
  const handleUpdateCaption = (slotIdx: number, type: 'inspector' | 'userFinal', caption: string) => {
    if (!editingCell) return;
    if (type === 'inspector') {
      const nextEvidences = editingCell.evidences.map((p) =>
        p.slotIndex === slotIdx ? { ...p, caption } : p
      );
      setEditingCell({
        ...editingCell,
        evidences: nextEvidences,
      });
    } else {
      const nextUserFinal = editingCell.userFinalEvidencias.map((p) =>
        p.slotIndex === slotIdx ? { ...p, caption } : p
      );
      setEditingCell({
        ...editingCell,
        userFinalEvidencias: nextUserFinal,
      });
    }
  };

  // Gallery file picker change
  const handleGalleryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingCell) return;

    Array.from(files).forEach((file, i) => {
      const targetSlot = Math.min(4, targetSlotForUpload + i);
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          handleAddPhotoToSlot(result, targetSlot, targetUploadType, file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  // Native mobile camera change
  const handleNativeCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingCell) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          handleAddPhotoToSlot(result, targetSlotForUpload, targetUploadType);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Open evidence viewer for an existing record
  const handleOpenGalleryForRecord = (item: RubroItem, month: MonthName) => {
    const targetM = normalizeMonthName(month);
    const rec = stationRecords.find(
      (r) =>
        normalizeMonthName(r.mes) === targetM &&
        isMatchingRubroItem(r.punto, item)
    );

    if (rec) {
      setSelectedRecordForGallery(rec);
    } else {
      const virtualRec: StationEvaluationRecord = {
        id: `rec-temp-${Date.now()}`,
        concatenar: `${selectedStation}${month}${item.description}`,
        ciudad: 'Sinaloa - Mochis',
        estacion: selectedStation,
        mes: month,
        anio: selectedYear,
        punto: item.description,
        calificacion: 0,
        evidencias: [],
      };
      setSelectedRecordForGallery(virtualRec);
    }
  };

  // Group items by Section/Rubro
  const rubrosToDisplay = useMemo(() => {
    return activeRubroTab === 'all'
      ? RUBROS_META
      : RUBROS_META.filter((r) => r.id === activeRubroTab);
  }, [activeRubroTab]);

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Hidden File and Native Camera Inputs */}
      <input
        ref={galleryFileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleGalleryFileChange}
        className="hidden"
      />
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativeCameraChange}
        className="hidden"
      />

      {/* Top Banner and Controls */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 max-w-full overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 mb-1">
              <span>MÓDULO 2</span>
              <span>/</span>
              <span>SEGUIMIENTO POR SECCIONES Y FORMULAS NORMATIVAS</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-950 flex items-center gap-2">
              <span>Módulo 2: Tablero de Seguimiento por {entityLabel} {selectedYear}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 font-mono font-semibold">
                Fórmulas por Secciones
              </span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Cálculo seccionado con regla de tres para exclusión de N/A y formato condicional visual (0 en rojo, parciales en naranja).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel (.xlsx) con Fórmulas</span>
            </button>

            {/* Botón para seleccionar y borrar registros para permitir subir nuevos archivos */}
            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) {
                  setSelectedItemIds(new Set());
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded transition-colors border shadow-xs cursor-pointer ${
                isSelectionMode
                  ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                  : 'bg-white text-neutral-800 hover:text-red-700 border-neutral-300 hover:border-red-300'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>{isSelectionMode ? 'Cancelar Selección' : 'Seleccionar / Borrar Registros'}</span>
            </button>

            {stationRecords.length > 0 && (
              <button
                type="button"
                onClick={handleOpenWipeStationRecords}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors shadow-xs cursor-pointer"
                title={`Eliminar todos los registros de evaluación de ${selectedStation}`}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>Vaciar {selectedStation.replace('Mochis - ', '')} ({stationRecords.length})</span>
              </button>
            )}

            {records.length > 0 && onClearAllRecords && (
              <button
                type="button"
                onClick={() => setIsConfirmClearAllOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-800 bg-red-100 hover:bg-red-200 border border-red-300 rounded transition-colors shadow-xs cursor-pointer"
                title={`Eliminar permanentemente todos los registros de prueba (${records.length} evaluaciones) de todas las ${entityLabel === 'Planta' ? 'plantas' : 'estaciones'}`}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-700" />
                <span>Vaciar Toda la Base (0 registros de muestra)</span>
              </button>
            )}
          </div>
        </div>

        {/* Station and Year Selectors */}
        <div className="mt-5 pt-4 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">
              Estación
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <select
                value={selectedStation}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedStation(val);
                  onStationChange?.(val);
                }}
                disabled={isDbEmpty}
                className="w-full pl-8 pr-3 py-1.5 text-xs font-medium bg-neutral-50 border border-neutral-300 rounded focus:bg-white focus:outline-none focus:border-neutral-900 transition-colors disabled:opacity-60"
              >
                {stationOptions.length === 0 ? (
                  <option value="">-- Sin estaciones (0 registros en Base de Datos) --</option>
                ) : (
                  stationOptions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">
              Año de Revisión
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                disabled={isDbEmpty || availableYears.length === 0}
                className="w-full pl-8 pr-3 py-1.5 text-xs font-medium bg-neutral-50 border border-neutral-300 rounded focus:bg-white focus:outline-none focus:border-neutral-900 transition-colors disabled:opacity-60"
              >
                {availableYears.length === 0 ? (
                  <option value={2026}>-- Sin años (0 registros) --</option>
                ) : (
                  availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">
              Planta / Distribuidor
            </label>
            <input
              type="text"
              readOnly
              value={
                isDbEmpty || isStationEmpty
                  ? '0 (Sin registros)'
                  : (stationRecords[0]?.ciudad?.split('-')[0]?.trim() || (entityLabel === 'Planta' ? selectedStation : 'Planta Registrada'))
              }
              className="w-full px-3 py-1.5 text-xs bg-neutral-100 border border-neutral-200 rounded text-neutral-600 font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
                Calificación {activeEvaluatedMonth} (Regla de Tres)
              </label>
              {evaluatedMonthsForStation.length > 0 && !isDbEmpty && (
                <span className="text-[10px] text-neutral-400 font-mono">
                  {evaluatedMonthsForStation.join(', ')}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded">
              <span className="text-xs font-mono font-bold text-neutral-900">
                {isDbEmpty || isStationEmpty ? '0 / 0 pts' : `${activeOverall.totalPuntosPonderados} / 106 pts`}
              </span>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  isDbEmpty || isStationEmpty
                    ? 'bg-neutral-200 text-neutral-700'
                    : activeOverall.estatus === 'Cumple'
                    ? 'bg-emerald-100 text-emerald-800'
                    : activeOverall.estatus === 'Observación'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {isDbEmpty || isStationEmpty
                  ? '0% · Sin Evaluaciones'
                  : `${activeOverall.calificacionFinal}% · ${activeOverall.estatus}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Month-by-Month Progress Summary */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5">
        <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-3 flex items-center justify-between">
          <span>Resumen Anual de Cumplimiento Ponderado (Consolidado de 6 Secciones)</span>
          <span className="text-[11px] font-mono text-neutral-400 font-normal">
            Base Máxima: 106 pts
          </span>
        </h3>

        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2 text-center">
          {MONTHS.map((m) => {
            const data = monthlyOverallTotals[m];
            const isSep = m === 'SEPTIEMBRE';
            const mAnexosCount = anexosList.filter(
              (a) =>
                isSameStation(a.estacion, selectedStation) &&
                normalizeMonthName(a.mes) === normalizeMonthName(m) &&
                (!a.anio || a.anio === selectedYear)
            ).length;

            return (
              <div
                key={m}
                className={`p-2 rounded border transition-colors ${
                  isSep
                    ? 'bg-neutral-50 border-neutral-900 shadow-xs'
                    : 'bg-white border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-mono text-neutral-500 font-medium">
                    {m.slice(0, 3)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenAnexos(m)}
                    className={`relative p-0.5 rounded cursor-pointer transition-colors ${
                      mAnexosCount > 0
                        ? 'text-cyan-700 hover:text-cyan-900 bg-cyan-100 hover:bg-cyan-200'
                        : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                    }`}
                    title={`Anexos de ${m} (${mAnexosCount} archivo${mAnexosCount === 1 ? '' : 's'}) - Clic para abrir ventana Anexos`}
                  >
                    <FileText className="w-3 h-3" />
                    {mAnexosCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
                    )}
                  </button>
                </div>
                <span className="block text-sm font-bold font-mono text-neutral-900 my-0.5">
                  {isDbEmpty || isStationEmpty ? 0 : data.totalPonderado}
                </span>
                <span
                  className={`block text-[10px] font-mono font-bold ${
                    isDbEmpty || isStationEmpty
                      ? 'text-neutral-400'
                      : data.pctFinal >= 85
                      ? 'text-emerald-700'
                      : data.pctFinal >= 80
                      ? 'text-amber-700'
                      : data.totalPonderado > 0
                      ? 'text-red-700'
                      : 'text-neutral-400'
                  }`}
                >
                  {isDbEmpty || isStationEmpty ? '0%' : `${data.pctFinal}%`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters, Rubro Navigation & Visual Legend */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Rubro Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full text-xs no-scrollbar">
            <button
              onClick={() => setActiveRubroTab('all')}
              className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors ${
                activeRubroTab === 'all'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              Todas las Secciones ({RUBROS_META.length})
            </button>
            {RUBROS_META.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRubroTab(r.id)}
                className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors ${
                  activeRubroTab === r.id
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                Sección {r.id}: {r.name.split(' ')[0]} ({r.maxPoints} pts)
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar punto o norma..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded focus:outline-none focus:border-neutral-900 bg-white"
            />
          </div>
        </div>

        {/* Visual Color Legend requested by Client */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1">
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
              <span className="px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700 font-bold text-[10px] italic">
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
            Puntos base estación: <strong>106 pts</strong>
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
                <strong>{lastDeletedCount} registros de {entityLabel} eliminados exitosamente</strong> del sistema, del caché local y de Supabase. Puedes subir un nuevo archivo Excel limpio.
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

        {/* Selection Bar for Selection and Deletion Mode */}
        {!isSelectionMode && stationRecords.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-600 shadow-2xs">
            <span className="text-[11px] font-medium text-neutral-700">
              ¿Deseas seleccionar y borrar registros de prueba de {entityLabel}: <strong>{selectedStation}</strong>?
            </span>
            <button
              type="button"
              onClick={() => setIsSelectionMode(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-red-700 hover:text-red-800 bg-white hover:bg-red-50 border border-red-300 rounded shadow-2xs transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Activar selección para borrar</span>
            </button>
          </div>
        )}

        {/* Empty state banner when database or station has 0 records */}
        {(isDbEmpty || isStationEmpty) && (
          <div className="py-12 px-6 text-center bg-neutral-50 border border-neutral-200 rounded-lg shadow-2xs my-4">
            <Building2 className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="font-bold text-base text-neutral-900">
              Módulo 2 en Ceros: Base de Datos Vacía
            </p>
            <p className="text-xs text-neutral-500 mt-1.5 max-w-md mx-auto">
              No existen registros de evaluación cargados en el Módulo 1 (Base de Datos). Todos los campos de estación, planta y calificaciones están completamente limpios y en ceros. Para registrar evaluaciones oficiales, utiliza el Módulo 1: Base de Datos.
            </p>
          </div>
        )}

        {/* Sectioned Evaluation Table ("Sandwichitos") */}
        {!isDbEmpty && !isStationEmpty && (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto shadow-xs">
          <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
            <thead>
              <tr className="bg-neutral-900 text-white font-mono text-[11px]">
                {isSelectionMode && (
                  <th className="py-2.5 px-2 w-10 text-center bg-red-950/90 border-r border-red-800">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllItems}
                      className="text-white hover:text-red-200 cursor-pointer inline-flex items-center justify-center"
                      title="Seleccionar / deseleccionar todos los 39 puntos"
                    >
                      {selectedItemIds.size === RUBRO_ITEMS.length ? (
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Square className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </th>
                )}
                <th className="py-2.5 px-3 w-12 text-center">No</th>
                <th className="py-2.5 px-3 min-w-[320px]">Punto a Revisar</th>
                <th className="py-2.5 px-2 text-center w-14">Valor</th>
                {MONTHS.map((m) => {
                  const mAnexosCount = anexosList.filter(
                    (a) =>
                      isSameStation(a.estacion, selectedStation) &&
                      normalizeMonthName(a.mes) === normalizeMonthName(m) &&
                      (!a.anio || a.anio === selectedYear)
                  ).length;
                  const isSep = m === 'SEPTIEMBRE';
                  return (
                    <th
                      key={m}
                      className={`py-2 px-1 text-center w-14 ${
                        isSep ? 'bg-cyan-900 font-bold text-white' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="font-mono text-[11px] font-bold tracking-wide">
                          {m.slice(0, 3)}
                        </span>
                        {/* Ícono de Documento para Anexos (PDF, Excel, Word, etc.) */}
                        <button
                          type="button"
                          onClick={() => handleOpenAnexos(m)}
                          className={`relative inline-flex items-center justify-center p-1 rounded-md transition-all hover:scale-115 cursor-pointer ${
                            mAnexosCount > 0
                              ? isSep
                                ? 'bg-cyan-400/30 text-cyan-200 hover:bg-cyan-400/50 hover:text-white shadow-2xs'
                                : 'bg-neutral-800 text-amber-300 hover:bg-neutral-700 hover:text-amber-200 shadow-2xs'
                              : isSep
                              ? 'text-cyan-300/80 hover:text-white hover:bg-cyan-800/80'
                              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                          title={`Anexos de ${m}: Clic para ${
                            isAdmin ? 'subir y gestionar' : 'consultar y descargar'
                          } archivos (${mAnexosCount} archivo${mAnexosCount === 1 ? '' : 's'})`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {mAnexosCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-amber-400 text-neutral-950 font-sans font-black text-[8px] rounded-full flex items-center justify-center leading-none shadow-xs border border-neutral-900">
                              {mAnexosCount}
                            </span>
                          )}
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rubrosToDisplay.map((rubro) => {
                const rubroItems = RUBRO_ITEMS.filter((i) => i.rubroId === rubro.id).filter(
                  (item) => {
                    if (!searchTerm) return true;
                    return (
                      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      item.norma.toLowerCase().includes(searchTerm.toLowerCase())
                    );
                  }
                );

                if (rubroItems.length === 0) return null;

                // Compute section statistics for September
                const sepSectionStats = calculateSectionStats(
                  rubroItems,
                  stationRecords,
                  'SEPTIEMBRE',
                  rubro.id,
                  rubro.maxPoints,
                  rubro.name,
                  rubro.norma
                );

                return (
                  <React.Fragment key={`rubro-${rubro.id}`}>
                    {/* SECTION HEADER ROW */}
                    <tr className="bg-neutral-800 text-white border-t-2 border-neutral-900">
                      <td colSpan={isSelectionMode ? 4 : 3} className="py-2.5 px-3">
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
                      {MONTHS.map((m) => {
                        const mSec = calculateSectionStats(
                          rubroItems,
                          stationRecords,
                          m,
                          rubro.id,
                          rubro.maxPoints,
                          rubro.name,
                          rubro.norma
                        );
                        const isSep = m === 'SEPTIEMBRE';
                        const monthObsKey = `${selectedStation}_${selectedYear}_${rubro.id}_${m}`;
                        const legacyObsKey = `${selectedStation}_${selectedYear}_${rubro.id}`;
                        const monthObs = sectionObservations[monthObsKey] || (m === 'SEPTIEMBRE' ? sectionObservations[legacyObsKey] : undefined);
                        const hasMonthObs = Boolean(monthObs?.text?.trim());

                        return (
                          <td
                            key={`head-${rubro.id}-${m}`}
                            className={`py-2 px-1 text-center font-mono text-[10px] ${
                              isSep ? 'bg-cyan-950/80 font-bold text-cyan-200' : 'text-neutral-400'
                            }`}
                          >
                            <div>{mSec.puntosPonderados} pts</div>
                            <div className="opacity-80">({mSec.pctCumplimiento}%)</div>

                            {/* Solo un icono debajo del mes para agregar/ver observaciones */}
                            <div className="mt-1 flex items-center justify-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenSectionMonthObs(rubro, m);
                                }}
                                className={`p-0.5 rounded transition-all inline-flex items-center justify-center ${
                                  hasMonthObs
                                    ? 'text-amber-400 hover:text-amber-300 drop-shadow-xs'
                                    : 'text-neutral-500 hover:text-neutral-200 opacity-60 hover:opacity-100'
                                }`}
                                title={
                                  hasMonthObs
                                    ? `Observaciones de ${m} (${isAdmin ? 'Editar' : 'Solo lectura'})`
                                    : isAdmin
                                    ? `Agregar observaciones de ${m}`
                                    : `Sin observaciones en ${m}`
                                }
                              >
                                <NotebookPen className="w-3.5 h-3.5" />
                                {hasMonthObs && (
                                  <span className="w-1 h-1 rounded-full bg-amber-400 ml-0.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-center text-[10px] font-mono text-neutral-400">
                        {rubroItems.length} puntos
                      </td>
                    </tr>

                    {/* SECTION ITEM ROWS */}
                    {rubroItems.map((item) => {
                      const sepRec = stationRecords.find(
                        (r) =>
                          normalizeMonthName(r.mes) === 'SEPTIEMBRE' &&
                          isMatchingRubroItem(r.punto, item)
                      );
                      const califVal = sepRec !== undefined ? sepRec.calificacion : undefined;
                      const hasCalificacion =
                        califVal !== undefined &&
                        califVal !== null &&
                        califVal !== '' &&
                        califVal !== '-' &&
                        califVal !== 'N/A';
                      const hasEvidences = Boolean(sepRec?.evidencias && sepRec.evidencias.length > 0);
                      const evidenceCount = sepRec?.evidencias?.length || 0;
                      const hasUserFinalEvidences = Boolean(
                        sepRec?.userFinalEvidencias && sepRec.userFinalEvidencias.length > 0
                      );
                      const userFinalEvidenceCount = sepRec?.userFinalEvidencias?.length || 0;
                      const totalEvidences = evidenceCount + userFinalEvidenceCount;

                      return (
                        <tr key={item.id} className="hover:bg-neutral-50/80 transition-colors">
                          {isSelectionMode && (
                            <td className="py-2.5 px-2 text-center bg-red-50/30 border-r border-red-100">
                              <button
                                type="button"
                                onClick={() => handleToggleItemSelection(item.id)}
                                className="text-neutral-500 hover:text-neutral-900 cursor-pointer inline-flex items-center justify-center"
                              >
                                {selectedItemIds.has(item.id) ? (
                                  <CheckSquare className="w-4 h-4 text-red-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-neutral-400" />
                                )}
                              </button>
                            </td>
                          )}
                          <td className="py-2.5 px-3 font-mono text-neutral-400 text-center font-semibold">
                            {item.id}
                          </td>

                          <td className="py-2.5 px-3">
                            <div
                              onClick={() => handleOpenEditCell(item, 'SEPTIEMBRE')}
                              className="font-medium text-neutral-900 leading-snug cursor-pointer hover:text-[#0e7490] transition-colors"
                              title="Clic para abrir formulario de evidencias y cronómetro"
                            >
                              {item.description}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono mt-0.5 flex flex-wrap items-center gap-2">
                              <span>{item.norma}</span>
                              {item.isInformative && (
                                <>
                                  <span>·</span>
                                  <span className="text-amber-600 font-semibold">(Informativo)</span>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-2 font-mono text-center text-neutral-600 font-bold">
                            {item.maxPoints > 0 ? item.maxPoints : '-'}
                          </td>

                          {MONTHS.map((m) => {
                            const targetM = normalizeMonthName(m);
                            const rec = stationRecords.find(
                              (r) =>
                                normalizeMonthName(r.mes) === targetM &&
                                isMatchingRubroItem(r.punto, item)
                            );
                            const calif = rec !== undefined ? rec.calificacion : '-';
                            const isSep = m === 'SEPTIEMBRE';
                            const recEvidences = rec?.evidencias || [];
                            const hasScore = calif !== '-' && calif !== undefined && calif !== null && calif !== '';

                            // Apply Client's Conditional Formatting Logic
                            const cellFormat = getScoreCellFormat(calif, item.maxPoints, item.isInformative);

                            return (
                              <td
                                key={m}
                                className={`py-2 px-1 text-center cursor-pointer transition-colors ${
                                  isSep ? 'bg-cyan-50/20' : ''
                                }`}
                                onClick={() => handleOpenEditCell(item, m)}
                                title={`${cellFormat.tooltipText} - Clic para editar`}
                              >
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* LED Indicador de Cronómetro a un lado de la calificación / número */}
                                  {hasScore && (
                                    <TimerLedIndicator
                                      inspectorSubmittedAt={rec?.inspectorSubmittedAt}
                                      timerFrozen={rec?.timerFrozen}
                                      userFinalSubmittedAt={rec?.userFinalSubmittedAt}
                                    />
                                  )}

                                  <span
                                    className={`px-2 py-0.5 rounded text-xs transition-transform inline-flex items-center justify-center min-w-[26px] ${cellFormat.bgClass} ${cellFormat.textClass}`}
                                  >
                                    {cellFormat.badgeText}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* SECTION SUBTOTAL ROW ("SANDWICHITO") */}
                    <tr className="bg-neutral-100/90 border-y-2 border-neutral-300 font-mono text-xs">
                      <td colSpan={2} className="py-2 px-3">
                        <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-[#0e7490]" />
                          <span>SUBTOTAL SECCIÓN {rubro.id}: {rubro.name.toUpperCase()}</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 font-normal">
                          Fórmula: (Puntos Obtenidos / Base sin N/A) × {rubro.maxPoints} pts base
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-neutral-900">
                        {rubro.maxPoints}
                      </td>

                      {MONTHS.map((m) => {
                        const mSec = calculateSectionStats(
                          rubroItems,
                          stationRecords,
                          m,
                          rubro.id,
                          rubro.maxPoints,
                          rubro.name,
                          rubro.norma
                        );
                        const isSep = m === 'SEPTIEMBRE';
                        return (
                          <td
                            key={`sub-${rubro.id}-${m}`}
                            className={`py-2 px-1 text-center ${
                              isSep ? 'bg-cyan-100/60 font-bold' : ''
                            }`}
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
              })}

              {/* CONSOLIDATED GRAND TOTAL ROW */}
              <tr className="bg-neutral-900 text-white font-mono border-t-4 border-neutral-950 text-xs">
                <td colSpan={2} className="py-3 px-3">
                  <div className="font-extrabold text-sm uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>CALIFICACIÓN FINAL DE LA {entityLabel.toUpperCase()} (TOTAL GENERAL)</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 font-normal mt-0.5">
                    Suma consolidada de los subtotales ponderados de todas las secciones
                  </div>
                </td>
                <td className="py-3 px-2 text-center font-extrabold text-sm text-neutral-200">
                  106
                </td>

                {MONTHS.map((m) => {
                  const overall = calculateStationOverall(selectedStation, stationRecords, m, selectedYear);
                  const isSep = m === 'SEPTIEMBRE';
                  return (
                    <td
                      key={`grand-${m}`}
                      className={`py-3 px-1 text-center ${
                        isSep ? 'bg-cyan-950 font-black text-cyan-300' : ''
                      }`}
                    >
                      <div className="text-sm font-bold">
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
                      <div className="text-[9px] uppercase tracking-tighter opacity-80">
                        {overall.estatus}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* Cell Quick Edit Modal (Dual Evidences: Coordinador & Usuario Final + Cronómetro en Vivo) */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-neutral-300 p-4 sm:p-6 max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[94vh] space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-[#0e7490] font-bold uppercase tracking-wider">
                  <span>Formulario de Evaluación y Validación</span>
                  <span>·</span>
                  <span>{editingCell.month} {selectedYear}</span>
                  <span>·</span>
                  <span>{selectedStation}</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-950 mt-1 leading-snug">
                  {editingCell.itemId} · {editingCell.itemDesc}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Puntaje base: {editingCell.maxPoints > 0 ? `${editingCell.maxPoints} pts máx` : 'Informativo'}
                  </span>
                  {editingCell.inspectorSubmittedAt && (
                    <span className="text-[10px] bg-cyan-100 text-cyan-800 font-bold px-2 py-0.5 rounded font-mono">
                      ● Auditoría Iniciada
                    </span>
                  )}
                  {editingCell.timerFrozen && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded font-mono">
                      ✓ Subsanación Finalizada
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors text-lg font-bold cursor-pointer"
                title="Cerrar ventana"
              >
                ✕
              </button>
            </div>

            {/* CRONÓMETRO PANEL DESTACADO EN EL FORMULARIO */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5 text-[#0e7490]" />
                  <span>Cronómetro de Atención y Subida de Evidencias</span>
                </span>
                {editingCell.inspectorSubmittedAt && !editingCell.timerFrozen && (
                  <span className="text-[11px] text-amber-600 font-bold font-mono animate-pulse flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    ● Corriendo en vivo
                  </span>
                )}
                {editingCell.timerFrozen && (
                  <span className="text-[11px] text-emerald-600 font-bold font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Congelado permanente
                  </span>
                )}
              </div>

              <RecordTimerBadge
                inspectorSubmittedAt={editingCell.inspectorSubmittedAt}
                userFinalSubmittedAt={editingCell.userFinalSubmittedAt}
                timerElapsedSeconds={editingCell.timerElapsedSeconds}
                timerFrozen={editingCell.timerFrozen}
                hasCalificacion={editingCell.currentVal !== undefined && editingCell.currentVal !== ''}
                variant="panel"
              />

              <div className="text-[11px] px-1 text-neutral-500">
                {editingCell.inspectorSubmittedAt && !editingCell.timerFrozen ? (
                  <span className="text-amber-700 font-medium">
                    ⏱ El cronómetro se activó al subir las evidencias del coordinador. El usuario final debe subir sus evidencias y comentarios para detenerlo.
                  </span>
                ) : editingCell.timerFrozen ? (
                  <span className="text-emerald-700 font-medium">
                    ✓ El usuario final completó la carga de evidencias y comentarios. El cronómetro se detuvo de forma definitiva.
                  </span>
                ) : (
                  <span>
                    El cronómetro se activará automáticamente cuando el coordinador llene el formulario y suba sus evidencias.
                  </span>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECCIÓN 1: FORMULARIO Y EVIDENCIAS DEL COORDINADOR (AUDITORÍA)            */}
            {/* ========================================================================= */}
            <div className="border border-neutral-300 rounded-xl p-3.5 sm:p-4 bg-neutral-50/70 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-cyan-700 text-white flex items-center justify-center font-bold text-xs">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      1. Formulario y Evidencias del Coordinador (Auditoría)
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      Calificación, fotos y hallazgos registrados por el inspector
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded">
                  {editingCell.evidences.length} / 4 Fotos
                </span>
              </div>

              {/* Calificación Asignada */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider">
                  Calificación Asignada
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="cellEditInput"
                    type="text"
                    defaultValue={editingCell.currentVal}
                    disabled={!canEdit}
                    readOnly={!canEdit}
                    className={`w-32 px-3 py-2 text-sm font-bold font-mono border rounded ${
                      canEdit
                        ? 'border-neutral-300 focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 bg-white'
                        : 'border-neutral-200 bg-neutral-100 text-neutral-800 cursor-not-allowed'
                    }`}
                  />
                  <span className="text-xs text-neutral-500 font-mono">
                    / {editingCell.maxPoints > 0 ? `${editingCell.maxPoints} pts máx` : 'N/A'}
                  </span>
                  {!canEdit && (
                    <span className="text-[11px] text-neutral-400 italic">
                      (Asignada por el auditor, no modificable por Usuario Final)
                    </span>
                  )}
                </div>

                {canEdit && editingCell.maxPoints > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('cellEditInput') as HTMLInputElement;
                        if (input) input.value = String(editingCell.maxPoints);
                      }}
                      className="px-2.5 py-1 text-xs border border-neutral-300 rounded bg-white hover:bg-neutral-100 font-mono font-bold text-neutral-900 cursor-pointer"
                    >
                      Máx ({editingCell.maxPoints})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('cellEditInput') as HTMLInputElement;
                        if (input) input.value = String(editingCell.maxPoints / 2);
                      }}
                      className="px-2.5 py-1 text-xs border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-mono font-semibold cursor-pointer"
                    >
                      50% ({(editingCell.maxPoints / 2).toFixed(1)})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('cellEditInput') as HTMLInputElement;
                        if (input) input.value = '0';
                      }}
                      className="px-2.5 py-1 text-xs border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 font-mono font-bold cursor-pointer"
                    >
                      0 (Crítico)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('cellEditInput') as HTMLInputElement;
                        if (input) input.value = 'N/A';
                      }}
                      className="px-2.5 py-1 text-xs border border-neutral-300 rounded bg-neutral-100 hover:bg-neutral-200 font-mono font-bold text-neutral-700 italic cursor-pointer"
                    >
                      N/A
                    </button>
                  </div>
                )}
              </div>

              {/* 4 Photo Slots - Coordinador */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                    Fotos de Auditoría (Coordinador)
                  </span>
                  {canEdit && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetUploadType('inspector');
                          const filled = editingCell.evidences.map((e) => e.slotIndex);
                          let target = 1;
                          for (let s = 1; s <= 4; s++) {
                            if (!filled.includes(s)) {
                              target = s;
                              break;
                            }
                          }
                          setLiveCameraSlot(target);
                        }}
                        disabled={editingCell.evidences.length >= 4}
                        className="px-2 py-0.5 text-xs font-semibold text-white bg-[#0e7490] hover:bg-[#0891b2] disabled:opacity-40 rounded flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Cámara</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetUploadType('inspector');
                          const filled = editingCell.evidences.map((e) => e.slotIndex);
                          let target = 1;
                          for (let s = 1; s <= 4; s++) {
                            if (!filled.includes(s)) {
                              target = s;
                              break;
                            }
                          }
                          setTargetSlotForUpload(target);
                          galleryFileInputRef.current?.click();
                        }}
                        disabled={editingCell.evidences.length >= 4}
                        className="px-2 py-0.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-100 disabled:opacity-40 rounded flex items-center gap-1 cursor-pointer"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span>Galería</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((slotNum) => {
                    const photo = editingCell.evidences.find((p) => p.slotIndex === slotNum);
                    return (
                      <div
                        key={`insp-slot-${slotNum}`}
                        className={`rounded-lg border p-1.5 flex flex-col justify-between transition-all bg-white min-h-[110px] ${
                          photo ? 'border-cyan-400 shadow-2xs' : 'border-dashed border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 mb-1">
                          <span>Foto {slotNum}</span>
                          {photo && <span className="text-cyan-700 font-bold">Adjunta</span>}
                        </div>

                        {photo ? (
                          <div className="space-y-1">
                            <div className="relative h-20 w-full rounded overflow-hidden bg-black group">
                              <img
                                src={photo.dataUrl}
                                alt={`Auditoría Foto ${slotNum}`}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                                onClick={() => setPreviewPhoto({ url: photo.dataUrl, caption: photo.caption })}
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhoto({ url: photo.dataUrl, caption: photo.caption })}
                                  className="p-1 bg-white/20 text-white rounded hover:bg-white/40"
                                  title="Ver foto ampliada"
                                >
                                  <ZoomIn className="w-3 h-3" />
                                </button>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePhotoFromSlot(slotNum, 'inspector')}
                                    className="p-1 bg-red-600/80 text-white rounded hover:bg-red-600"
                                    title="Eliminar foto"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {canEdit ? (
                              <input
                                type="text"
                                value={photo.caption || ''}
                                onChange={(e) => handleUpdateCaption(slotNum, 'inspector', e.target.value)}
                                placeholder="Pie de foto..."
                                className="w-full text-[10px] px-1 py-0.5 border border-neutral-200 rounded"
                              />
                            ) : (
                              <p className="text-[10px] text-neutral-600 truncate" title={photo.caption}>
                                {photo.caption || 'Sin pie de foto'}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-20 text-neutral-400">
                            <span className="text-[10px] italic">Vacío</span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetUploadType('inspector');
                                  setTargetSlotForUpload(slotNum);
                                  galleryFileInputRef.current?.click();
                                }}
                                className="mt-1 text-[10px] text-cyan-700 hover:underline font-semibold"
                              >
                                + Subir
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Observaciones del Auditor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider">
                    Observaciones de Auditoría (Coordinador)
                  </label>
                  {PRESET_FINDINGS_BY_ID[editingCell.itemId]?.length > 0 && canEdit && (
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Catálogo: {PRESET_FINDINGS_BY_ID[editingCell.itemId].length} hallazgos
                    </span>
                  )}
                </div>

                {canEdit ? (
                  <div className="space-y-1.5">
                    {/* Preset findings selector */}
                    {PRESET_FINDINGS_BY_ID[editingCell.itemId]?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const chosen = e.target.value;
                            const currentVal = editingCell.observaciones || '';
                            const newVal = currentVal.trim().length === 0
                              ? chosen
                              : currentVal.includes(chosen)
                                ? currentVal
                                : `${currentVal}; ${chosen}`;
                            const nowIso = new Date().toISOString();
                            const startAt = editingCell.inspectorSubmittedAt || nowIso;
                            setEditingCell({
                              ...editingCell,
                              observaciones: newVal,
                              inspectorSubmittedAt: startAt,
                            });
                          }}
                          className="w-full text-xs px-2.5 py-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-300 rounded focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                        >
                          <option value="">📋 Seleccionar hallazgo estándar del catálogo...</option>
                          {PRESET_FINDINGS_BY_ID[editingCell.itemId].map((f, fIdx) => (
                            <option key={fIdx} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="relative">
                      <textarea
                        rows={2}
                        value={editingCell.observaciones || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const nowIso = new Date().toISOString();
                          const startAt = editingCell.inspectorSubmittedAt || (val.trim() ? nowIso : undefined);
                          setEditingCell({
                            ...editingCell,
                            observaciones: val,
                            inspectorSubmittedAt: startAt,
                          });
                        }}
                        placeholder="Escribe aquí las observaciones, desviaciones normativas o hallazgos técnicos del coordinador..."
                        className="w-full px-2.5 py-2 text-xs border rounded-md border-neutral-300 focus:ring-1 focus:ring-neutral-900 bg-white"
                      />
                      {editingCell.observaciones && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingCell({
                              ...editingCell,
                              observaciones: '',
                            })
                          }
                          title="Borrar texto"
                          className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-700 p-0.5 rounded hover:bg-neutral-100 cursor-pointer text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Quick suggestion pills */}
                    {PRESET_FINDINGS_BY_ID[editingCell.itemId]?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider mr-1">
                          Sugerencias rápidas:
                        </span>
                        {PRESET_FINDINGS_BY_ID[editingCell.itemId].map((f, fIdx) => {
                          const isSelected = (editingCell.observaciones || '').includes(f);
                          return (
                            <button
                              key={fIdx}
                              type="button"
                              onClick={() => {
                                const currentVal = editingCell.observaciones || '';
                                let updated = '';
                                if (isSelected) {
                                  updated = currentVal
                                    .replace(f, '')
                                    .replace(/;\s*;/g, ';')
                                    .replace(/^;\s*|\s*;$/g, '')
                                    .trim();
                                } else {
                                  updated = currentVal.trim() ? `${currentVal}; ${f}` : f;
                                }
                                const nowIso = new Date().toISOString();
                                const startAt = editingCell.inspectorSubmittedAt || (updated.trim() ? nowIso : undefined);
                                setEditingCell({
                                  ...editingCell,
                                  observaciones: updated,
                                  inspectorSubmittedAt: startAt,
                                });
                              }}
                              className={`text-[10px] px-2 py-0.5 rounded border transition-all truncate max-w-full cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold'
                                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                              }`}
                            >
                              {isSelected ? `✓ ${f}` : f}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-700 bg-white p-2.5 rounded border border-neutral-200 whitespace-pre-line">
                    {editingCell.observaciones || 'Sin observaciones registradas por el coordinador para este punto.'}
                  </p>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECCIÓN 2: EVIDENCIAS Y COMENTARIOS DEL USUARIO FINAL (SUBSANACIÓN)       */}
            {/* ========================================================================= */}
            <div className="border-2 border-emerald-400/90 rounded-xl p-3.5 sm:p-4 bg-emerald-50/40 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      2. Evidencias y Comentarios de Subsanación (Usuario Final)
                    </h4>
                    <p className="text-[11px] text-emerald-800">
                      Al subir tus fotos y comentarios aquí, el cronómetro se detendrá y congelará permanentemente
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                  {editingCell.userFinalEvidencias.length} / 4 Fotos
                </span>
              </div>

              {/* Notice for Usuario Final */}
              {!editingCell.timerFrozen && editingCell.inspectorSubmittedAt && (
                <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>
                    <strong>Cronómetro activo:</strong> Sube tus fotos de corrección y escribe tus comentarios. Al guardar, el cronómetro se congelará de inmediato.
                  </span>
                </div>
              )}

              {editingCell.timerFrozen && (
                <div className="p-2 bg-emerald-100 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      <strong>Cronómetro Congelado:</strong> Respuesta completada en{' '}
                      <strong>{editingCell.timerElapsedSeconds ? formatSecondsHuman(editingCell.timerElapsedSeconds) : '0s'}</strong>.
                    </span>
                  </div>
                  {editingCell.userFinalSubmittedAt && (
                    <span className="text-[10px] font-mono text-emerald-800">
                      {new Date(editingCell.userFinalSubmittedAt).toLocaleDateString('es-MX')} {new Date(editingCell.userFinalSubmittedAt).toLocaleTimeString('es-MX')}
                    </span>
                  )}
                </div>
              )}

              {/* 4 Photo Slots - Usuario Final */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Fotos de Subsanación / Corrección (Usuario Final)
                  </span>

                  {/* Botones de Carga para Usuario Final */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetUploadType('userFinal');
                        const filled = editingCell.userFinalEvidencias.map((e) => e.slotIndex);
                        let target = 1;
                        for (let s = 1; s <= 4; s++) {
                          if (!filled.includes(s)) {
                            target = s;
                            break;
                          }
                        }
                        setLiveCameraSlot(target);
                      }}
                      disabled={editingCell.userFinalEvidencias.length >= 4}
                      className="px-2 py-0.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 rounded flex items-center gap-1 cursor-pointer shadow-xs"
                      title="Abrir cámara en vivo para tomar foto de respuesta"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Cámara</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetUploadType('userFinal');
                        const filled = editingCell.userFinalEvidencias.map((e) => e.slotIndex);
                        let target = 1;
                        for (let s = 1; s <= 4; s++) {
                          if (!filled.includes(s)) {
                            target = s;
                            break;
                          }
                        }
                        setTargetSlotForUpload(target);
                        galleryFileInputRef.current?.click();
                      }}
                      disabled={editingCell.userFinalEvidencias.length >= 4}
                      className="px-2 py-0.5 text-xs font-medium text-emerald-900 bg-white border border-emerald-300 hover:bg-emerald-100 disabled:opacity-40 rounded flex items-center gap-1 cursor-pointer"
                      title="Subir fotos de respuesta desde archivos"
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span>Galería</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((slotNum) => {
                    const photo = editingCell.userFinalEvidencias.find((p) => p.slotIndex === slotNum);
                    return (
                      <div
                        key={`usr-slot-${slotNum}`}
                        className={`rounded-lg border p-1.5 flex flex-col justify-between transition-all bg-white min-h-[110px] ${
                          photo ? 'border-emerald-500 shadow-2xs' : 'border-dashed border-emerald-300/80 bg-emerald-50/20'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-emerald-800 mb-1">
                          <span>Respuesta {slotNum}</span>
                          {photo && <span className="text-emerald-700 font-bold">Lista</span>}
                        </div>

                        {photo ? (
                          <div className="space-y-1">
                            <div className="relative h-20 w-full rounded overflow-hidden bg-black group">
                              <img
                                src={photo.dataUrl}
                                alt={`Subsanación Foto ${slotNum}`}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                                onClick={() => setPreviewPhoto({ url: photo.dataUrl, caption: photo.caption })}
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhoto({ url: photo.dataUrl, caption: photo.caption })}
                                  className="p-1 bg-white/20 text-white rounded hover:bg-white/40"
                                  title="Ver foto ampliada"
                                >
                                  <ZoomIn className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhotoFromSlot(slotNum, 'userFinal')}
                                  className="p-1 bg-red-600/80 text-white rounded hover:bg-red-600"
                                  title="Eliminar foto"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <input
                              type="text"
                              value={photo.caption || ''}
                              onChange={(e) => handleUpdateCaption(slotNum, 'userFinal', e.target.value)}
                              placeholder="Pie de foto..."
                              className="w-full text-[10px] px-1 py-0.5 border border-emerald-200 rounded focus:border-emerald-700"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-20 text-emerald-700/60">
                            <span className="text-[10px] italic">Sin foto</span>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetUploadType('userFinal');
                                setTargetSlotForUpload(slotNum);
                                galleryFileInputRef.current?.click();
                              }}
                              className="mt-1 text-[10px] text-emerald-800 hover:underline font-semibold cursor-pointer"
                            >
                              + Subir Foto
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Comentarios y Justificación del Usuario Final */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Comentarios y Justificación de Cumplimiento (Usuario Final)
                </label>
                <textarea
                  rows={2}
                  value={editingCell.userFinalObservaciones || ''}
                  onChange={(e) => {
                    setEditingCell({
                      ...editingCell,
                      userFinalObservaciones: e.target.value,
                    });
                  }}
                  placeholder="Escribe la explicación, justificación o detalles de las acciones tomadas para subsanar este punto..."
                  className="w-full px-2.5 py-2 text-xs border rounded-md border-emerald-300 focus:ring-1 focus:ring-emerald-700 bg-white placeholder:text-neutral-400 text-neutral-900"
                />
                {editingCell.userFinalUser && (
                  <div className="text-[10px] text-neutral-500 font-mono text-right">
                    Registrado por: {editingCell.userFinalUser}
                  </div>
                )}
              </div>
            </div>

            {/* Lightbox / Zoom Modal de Fotos */}
            {previewPhoto && (
              <div className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4">
                <div className="relative max-w-3xl w-full max-h-[85vh] flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(null)}
                    className="absolute -top-10 right-0 text-white hover:text-neutral-300 text-2xl font-bold p-1 cursor-pointer"
                  >
                    ✕ Cerrar
                  </button>
                  <img
                    src={previewPhoto.url}
                    alt={previewPhoto.caption || 'Foto ampliada'}
                    className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
                  />
                  {previewPhoto.caption && (
                    <p className="text-white text-xs text-center mt-2 font-mono">
                      {previewPhoto.caption}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            {(() => {
              const targetM = normalizeMonthName(editingCell.month);
              const existingRec = stationRecords.find(
                (r) =>
                  normalizeMonthName(r.mes) === targetM &&
                  isMatchingRubroItem(r.punto, {
                    id: editingCell.itemId,
                    description: editingCell.itemDesc,
                    maxPoints: editingCell.maxPoints,
                    rubroId: 0,
                    rubroName: '',
                    norma: '',
                  })
              );

              return (
                <div className="mt-4 pt-3 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCell(null)}
                      className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
                    >
                      Cerrar sin guardar
                    </button>

                    {existingRec && onDeleteRecords && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteRecords([existingRec.id]);
                          setEditingCell(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar permanentemente la evaluación y evidencias de esta celda"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        <span>Borrar esta evaluación</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('cellEditInput') as HTMLInputElement;
                      const raw = input ? input.value.trim() : String(editingCell.currentVal);
                      if (raw === 'N/A' || raw === 'NA') {
                        handleSaveCell('N/A');
                      } else {
                        const num = parseFloat(raw);
                        handleSaveCell(isNaN(num) ? raw : num);
                      }
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                      isReadOnly || user?.role === 'Usuario final'
                        ? 'bg-emerald-700 hover:bg-emerald-600 text-white ring-2 ring-emerald-500/40'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {isReadOnly || user?.role === 'Usuario final'
                        ? '✓ Guardar Evidencias y Comentarios (Detener Cronómetro)'
                        : 'Guardar Formulario y Auditoría (Activar Cronómetro)'}
                    </span>
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* In-App Live Camera Viewfinder Modal */}
      {liveCameraSlot !== null && (
        <CameraCaptureViewfinder
          isOpen={liveCameraSlot !== null}
          slotNumber={liveCameraSlot}
          onClose={() => setLiveCameraSlot(null)}
          onCapturePhoto={(dataUrl) => {
            handleAddPhotoToSlot(dataUrl, liveCameraSlot, targetUploadType);
          }}
        />
      )}

      {/* Fullscreen Evidence Gallery Modal with Dual Roles and Live Stopwatch */}
      {selectedRecordForGallery && (
        <EvidenceGalleryModal
          isOpen={selectedRecordForGallery !== null}
          record={selectedRecordForGallery}
          user={user}
          onClose={() => setSelectedRecordForGallery(null)}
          onUpdateRecord={(updatedRec) => {
            onUpdateRecord(updatedRec);
            setSelectedRecordForGallery(updatedRec);
          }}
          onUpdateRecordEvidences={(updatedEvidences) => {
            const nextRec: StationEvaluationRecord = {
              ...selectedRecordForGallery,
              evidencias: updatedEvidences,
            };
            onUpdateRecord(nextRec);
            setSelectedRecordForGallery(nextRec);
          }}
          onOpenEditModal={() => {
            const item = RUBRO_ITEMS.find((r) =>
              selectedRecordForGallery.punto.toLowerCase().includes(r.description.slice(0, 25).toLowerCase())
            );
            if (item) {
              handleOpenEditCell(item, selectedRecordForGallery.mes);
            }
          }}
        />
      )}

      {/* MODAL / VENTANA EMERGENTE: OBSERVACIONES GENERALES DE LA SECCIÓN (Solo Admin puede editar) */}
      {activeObsRubro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-neutral-200 p-5 sm:p-6 max-w-xl w-full shadow-2xl overflow-y-auto max-h-[92vh]">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold shrink-0">
                  <NotebookPen className="w-4 h-4 text-amber-800" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-[#0e7490] font-bold uppercase tracking-wider block">
                    Observaciones Generales del Mes · {activeObsMonth}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-neutral-950 mt-0.5 leading-snug">
                    Sección {activeObsRubro.id}: {activeObsRubro.name}
                  </h3>
                  <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                    Mes: <strong className="text-[#0e7490] font-bold">{activeObsMonth}</strong> · Estación: <strong className="text-neutral-900">{selectedStation}</strong> · Periodo: {selectedYear}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveObsRubro(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded"
              >
                ✕
              </button>
            </div>

            {/* Role indicator banner */}
            {isAdmin ? (
              <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-900">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  <strong>Permiso de Administrador activo:</strong> Puedes redactar, actualizar o eliminar las observaciones generales de <strong>{activeObsMonth}</strong>.
                </span>
              </div>
            ) : (
              <div className="mb-4 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-900">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Modo solo lectura:</strong> Solo el <strong>Administrador</strong> puede registrar y modificar las observaciones generales. (Tu rol: {user?.role || 'Consultante'})
                </span>
              </div>
            )}

            {/* Meta info if previously saved */}
            {(() => {
              const currentKey = `${selectedStation}_${selectedYear}_${activeObsRubro.id}_${activeObsMonth}`;
              const legacyKey = `${selectedStation}_${selectedYear}_${activeObsRubro.id}`;
              const savedMeta = sectionObservations[currentKey] || (activeObsMonth === 'SEPTIEMBRE' ? sectionObservations[legacyKey] : undefined);
              if (savedMeta && savedMeta.updatedAt) {
                return (
                  <div className="mb-3 text-[11px] text-neutral-500 font-mono flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded border border-neutral-200">
                    <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span>
                      Última actualización: <strong>{savedMeta.updatedAt}</strong> por <strong>{savedMeta.updatedBy}</strong>
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            {/* Quick chips (Admin only) */}
            {isAdmin && (
              <div className="space-y-1.5 mb-3">
                <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider block">
                  Plantillas Rápidas:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Requiere atención y mantenimiento preventivo prioritario.',
                    'Cumplimiento normativo satisfactorio.',
                    'Observaciones menores en proceso de subsanación.',
                    'Compromiso de entrega de evidencia física.',
                  ].map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      onClick={() => {
                        setTempObsText((prev) => (prev ? `${prev}\n• ${phrase}` : `• ${phrase}`));
                      }}
                      className="px-2 py-0.5 text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded border border-neutral-200 transition-colors"
                    >
                      + {phrase.slice(0, 30)}...
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                Detalle de las Observaciones Generales
              </label>
              <textarea
                rows={6}
                value={tempObsText}
                onChange={(e) => setTempObsText(e.target.value)}
                readOnly={!isAdmin}
                disabled={!isAdmin}
                placeholder={
                  isAdmin
                    ? `Redacta aquí las observaciones técnicas, hallazgos o directrices de seguridad para ${activeObsRubro.name} en el mes de ${activeObsMonth}...`
                    : `No se han registrado observaciones generales por el administrador para esta sección en el mes de ${activeObsMonth}.`
                }
                className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-1 focus:outline-none leading-relaxed font-sans ${
                  isAdmin
                    ? 'border-neutral-300 focus:ring-neutral-900 focus:border-neutral-900 bg-white placeholder:text-neutral-400'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-800'
                }`}
              />
            </div>

            {/* Modal Actions */}
            <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
              <div>
                {isAdmin && tempObsText && (
                  <button
                    type="button"
                    onClick={() => setTempObsText('')}
                    className="text-xs text-red-600 hover:text-red-800 underline font-medium"
                  >
                    Borrar texto
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveObsRubro(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                >
                  {isAdmin ? 'Cancelar' : 'Cerrar'}
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleSaveSectionObservation}
                    className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar Observaciones Generales</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Bar when items are selected in Module 1 */}
      {selectedItemIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-neutral-900 text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-neutral-700 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="font-bold flex items-center gap-1.5 text-neutral-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            {selectedItemIds.size} de {RUBRO_ITEMS.length} puntos ({matchingRecordsToDelete.length} registros)
          </span>
          <span className="text-neutral-600">|</span>
          <button
            type="button"
            onClick={handleToggleSelectAllItems}
            className="text-cyan-300 hover:text-cyan-200 underline cursor-pointer text-xs font-semibold"
          >
            {selectedItemIds.size === RUBRO_ITEMS.length ? 'Deseleccionar' : 'Seleccionar los 39'}
          </button>
          <span className="text-neutral-600">·</span>
          <button
            type="button"
            onClick={() => setSelectedItemIds(new Set())}
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
                  Módulo 1 · {entityLabel}: {selectedStation}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-neutral-700 bg-neutral-50 p-3.5 rounded-lg border border-neutral-200">
              {singleRecordToDelete ? (
                <>
                  <p>
                    Vas a eliminar permanentemente la calificación del punto: <strong className="text-neutral-900 font-bold">{singleRecordToDelete.punto}</strong>.
                  </p>
                  <div className="text-[11px] text-neutral-600 font-medium bg-white p-2 rounded border border-neutral-200 space-y-1">
                    <div>Mes: <strong>{singleRecordToDelete.mes} {singleRecordToDelete.anio}</strong></div>
                    <div>{entityLabel}: <strong>{selectedStation}</strong></div>
                    <div>Calificación actual: <strong>{singleRecordToDelete.calificacion}</strong></div>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    Vas a eliminar <strong className="text-red-700 font-bold">{matchingRecordsToDelete.length}</strong> registro(s) evaluados de los <strong className="text-neutral-900 font-bold">{selectedItemIds.size}</strong> puntos seleccionados.
                  </p>
                  <div className="text-[11px] text-neutral-600 font-medium bg-white p-2 rounded border border-neutral-200 space-y-1">
                    <div>Alcance: <strong>{deleteMonthScope === 'ALL' ? `Todos los meses (${selectedYear})` : `Mes ${deleteMonthScope}`}</strong></div>
                    <div>{entityLabel}: <strong>{selectedStation}</strong></div>
                    {matchingRecordsToDelete.length === 0 && (
                      <div className="text-amber-700 bg-amber-50 p-1.5 rounded font-semibold mt-1">
                        Nota: Los puntos marcados no tienen calificaciones en {deleteMonthScope}.
                        <button
                          type="button"
                          onClick={() => setDeleteMonthScope('ALL')}
                          className="block text-cyan-800 underline font-bold mt-1 cursor-pointer"
                        >
                          Cambiar alcance a: Todos los meses del año {selectedYear}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
              <ul className="space-y-1.5 font-medium text-neutral-600">
                <li className="flex items-center gap-1.5 text-neutral-800">
                  <span className="text-red-500 font-bold">✓</span> Se removerán de la tabla y memoria del sistema.
                </li>
                <li className="flex items-center gap-1.5 text-neutral-800">
                  <span className="text-red-500 font-bold">✓</span> Se vaciará el caché local para que no vuelvan a mostrarse.
                </li>
                <li className="flex items-center gap-1.5 text-neutral-800">
                  <span className="text-red-500 font-bold">✓</span> Se eliminarán permanentemente de Supabase en tiempo real.
                </li>
              </ul>
              <p className="text-[11px] text-neutral-500 italic pt-1 border-t border-neutral-200">
                Esto permitirá cargar un nuevo archivo Excel limpio sin duplicados ni calificaciones residuales.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmDeleteOpen(false);
                  setSingleRecordToDelete(null);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={matchingRecordsToDelete.length === 0 && !singleRecordToDelete}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors shadow-sm cursor-pointer ${
                  matchingRecordsToDelete.length > 0 || singleRecordToDelete
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-neutral-300 cursor-not-allowed'
                }`}
              >
                Sí, Eliminar Permanentemente ({singleRecordToDelete ? 1 : matchingRecordsToDelete.length})
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
                  {entityLabel === 'Planta' ? 'Plantas' : 'Estaciones'} · Borrado permanente de registros de muestra
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-neutral-700 bg-neutral-50 p-3.5 rounded-lg border border-neutral-200">
              <p>
                ¿Deseas eliminar permanentemente todos los <strong className="text-red-700 font-bold">{records.length}</strong> registros de prueba de la base de datos?
              </p>
              <ul className="space-y-1.5 font-medium text-neutral-600">
                <li className="flex items-center gap-1.5 text-neutral-800">
                  <span className="text-red-500 font-bold">✓</span> Se eliminarán todas las calificaciones de prueba de <strong>todas</strong> las {entityLabel === 'Planta' ? 'plantas' : 'estaciones'}.
                </li>
                <li className="flex items-center gap-1.5 text-neutral-800">
                  <span className="text-red-500 font-bold">✓</span> Tanto el Módulo 1 como la Matriz General quedarán en <strong>0 evaluaciones</strong>.
                </li>
                <li className="flex items-center gap-1.5 text-neutral-800">
                  <span className="text-red-500 font-bold">✓</span> Se sincroniza en tiempo real con Supabase y el caché local.
                </li>
              </ul>
              <p className="text-[11px] text-neutral-500 italic pt-1 border-t border-neutral-200">
                El sistema quedará completamente limpio para que importes tus archivos Excel oficiales o captures nuevas evaluaciones reales.
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

      {/* Ventana Flotante de Anexos (PDF, Excel, Word, etc.) */}
      {isAnexosModalOpen && (
        <AnexosModal
          isOpen={isAnexosModalOpen}
          onClose={() => setIsAnexosModalOpen(false)}
          month={anexosTargetMonth}
          year={selectedYear}
          stationName={selectedStation}
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
