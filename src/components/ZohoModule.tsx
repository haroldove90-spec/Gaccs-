import React, { useState, useEffect, useMemo } from 'react';
import { MonthName, MONTHS, StationEvaluationRecord, UserSession } from '../types';
import {
  ZOHO_CHECKLIST_ITEMS,
  ZOHO_RUBROS,
  ZohoChecklistItemDef,
  generateStepScores,
} from '../data/zohoChecklistDef';
import { ZohoAuditRecord, ZohoAuditItem } from '../types';
import { downloadWorkbook } from '../utils/excelUtils';
import * as XLSX from 'xlsx';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  Search,
  Calendar,
  Clock,
  User,
  Building2,
  MapPin,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  Sparkles,
  Eye,
  Edit2,
  Filter,
  Check,
  X,
  FileText,
  ShieldCheck,
  History,
} from 'lucide-react';
import { detectStateFromRecord } from '../App';
import { saveRecordToSupabase } from '../lib/supabaseClient';

interface ZohoModuleProps {
  user: UserSession;
  stations: string[];
  existingRecords?: StationEvaluationRecord[];
  onSaveAuditToSystem: (
    audit: ZohoAuditRecord,
    records: StationEvaluationRecord[]
  ) => Promise<{ success: boolean; count: number; error: string | null }>;
  onUpdateRecord?: (rec: StationEvaluationRecord) => void;
  showToast: (msg: string) => void;
}

const STORAGE_KEY_AUDITS = 'evaluaciones_zoho_auditorias_v1';

export const ZohoModule: React.FC<ZohoModuleProps> = ({
  user,
  stations,
  existingRecords = [],
  onSaveAuditToSystem,
  onUpdateRecord,
  showToast,
}) => {
  // Navigation tabs within Zoho module
  const [activeTab, setActiveTab] = useState<'formulario' | 'historial'>('formulario');

  // Form Metadata: Fecha y Hora automáticas, Auditor automático
  const getCurrentDateStr = () => new Date().toISOString().slice(0, 10);
  const getCurrentTimeStr = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  };

  const [fecha, setFecha] = useState<string>(getCurrentDateStr);
  const [hora, setHora] = useState<string>(getCurrentTimeStr);
  const [auditor, setAuditor] = useState<string>(user.name || user.username || 'Auditor');
  const [selectedStation, setSelectedStation] = useState<string>(stations[0] || 'Mochis - Topolobampo');
  const [customStationName, setCustomStationName] = useState<string>('');
  const [isAddingNewStation, setIsAddingNewStation] = useState<boolean>(false);
  const [ciudad, setCiudad] = useState<string>('Sinaloa - Mochis');
  const [mes, setMes] = useState<MonthName>('SEPTIEMBRE');
  const [anio, setAnio] = useState<number>(2026);

  // Form values for the 54 items (scores and observations) - unselected by default
  const [itemsData, setItemsData] = useState<
    Record<
      number,
      {
        calificacion: number | string;
        observaciones: string;
      }
    >
  >(() => {
    // Attempt to restore active draft if available
    try {
      const savedDraft = localStorage.getItem('evaluaciones_zoho_active_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.error('Error loading draft:', e);
    }
    const initial: Record<number, { calificacion: number | string; observaciones: string }> = {};
    ZOHO_CHECKLIST_ITEMS.forEach((it) => {
      initial[it.index] = {
        calificacion: it.isInformative ? (it.defaultScore ?? '') : '',
        observaciones: '',
      };
    });
    return initial;
  });

  // Track save status for each individual card
  const [savedCards, setSavedCards] = useState<Record<number, boolean>>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('Guardado');

  // Auto-save draft on every change to itemsData, station, or period
  useEffect(() => {
    try {
      localStorage.setItem('evaluaciones_zoho_active_draft', JSON.stringify(itemsData));
      setAutoSaveStatus('⚡ Guardado automáticamente');
    } catch (e) {
      console.error('Auto-save error:', e);
    }
  }, [itemsData, selectedStation, mes, anio]);

  // Handler for saving a single card/item
  const handleSaveSingleCard = async (item: ZohoChecklistItemDef) => {
    const effectiveStation = isAddingNewStation ? customStationName.trim() : selectedStation.trim();
    if (!effectiveStation) {
      showToast('Por favor selecciona o escribe el nombre de la estación antes de guardar.');
      return;
    }

    const current = itemsData[item.index] || { calificacion: '', observaciones: '' };
    const califValue = current.calificacion === '' ? 0 : current.calificacion;

    const singleRec: StationEvaluationRecord = {
      id: `eval_zh_${effectiveStation.replace(/[^a-zA-Z0-9_-]/g, '_')}_${mes}_${item.index}`,
      concatenar: `${effectiveStation}${mes}${item.punto}`,
      ciudad: ciudad || 'Sinaloa - Mochis',
      estacion: effectiveStation,
      mes: mes,
      anio: anio,
      punto: item.punto,
      calificacion: califValue,
      observaciones: current.observaciones || '',
      rubroId: item.rubroId,
      inspectorSubmittedAt: new Date().toISOString(),
      inspectorUser: auditor || user.name || user.username || 'Auditor',
    };

    // 1. Guardar en memoria de App.tsx
    if (onUpdateRecord) {
      onUpdateRecord(singleRec);
    }

    // 2. Guardar en Supabase directamente
    try {
      await saveRecordToSupabase(singleRec);
    } catch (e) {
      console.error(e);
    }

    // 3. Persistir borrador
    try {
      localStorage.setItem('evaluaciones_zoho_active_draft', JSON.stringify(itemsData));
    } catch (e) {
      console.error(e);
    }

    // 4. Feedback visual en la tarjeta
    setSavedCards((prev) => ({ ...prev, [item.index]: true }));
    setTimeout(() => {
      setSavedCards((prev) => ({ ...prev, [item.index]: false }));
    }, 2500);

    showToast(`✓ Punto ${item.id} guardado correctamente (${califValue} pts).`);
  };

  // Collapsible sections state
  const [collapsedRubros, setCollapsedRubros] = useState<Record<number, boolean>>({});

  // History state
  const [auditsHistory, setAuditsHistory] = useState<ZohoAuditRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUDITS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // History search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('TODOS');
  const [viewingAuditDetail, setViewingAuditDetail] = useState<ZohoAuditRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-detect city when station changes
  useEffect(() => {
    const effectiveStation = isAddingNewStation ? customStationName : selectedStation;
    if (effectiveStation) {
      // Find matching station in existing records if any
      const existingMatch = existingRecords.find(
        (r) => r.estacion.toLowerCase().trim() === effectiveStation.toLowerCase().trim()
      );
      if (existingMatch && existingMatch.ciudad) {
        setCiudad(existingMatch.ciudad);
      } else {
        const detected = detectStateFromRecord('', effectiveStation);
        setCiudad(`${detected} - ${effectiveStation.split('-')[0]?.trim() || 'Mochis'}`);
      }
    }
  }, [selectedStation, customStationName, isAddingNewStation, existingRecords]);

  // Update auditor default if user session changes
  useEffect(() => {
    if (user && (user.name || user.username)) {
      setAuditor(user.name || user.username);
    }
  }, [user]);

  // Calculate live score for the audit
  const scoreSummary = useMemo(() => {
    let obtainedPoints = 0;
    let maxApplicablePoints = 0;
    let obsCount = 0;

    ZOHO_CHECKLIST_ITEMS.forEach((it) => {
      const current = itemsData[it.index];
      const calif = current?.calificacion;
      const obs = current?.observaciones;

      if (obs && obs.trim().length > 0) {
        obsCount++;
      }

      if (!it.isInformative && it.maxPoints > 0) {
        if (calif !== 'N/A' && calif !== undefined && calif !== '') {
          maxApplicablePoints += it.maxPoints;
          const num = typeof calif === 'number' ? calif : parseFloat(String(calif));
          if (!isNaN(num)) {
            obtainedPoints += Math.min(it.maxPoints, Math.max(0, num));
          }
        }
      }
    });

    const scorePct =
      maxApplicablePoints > 0
        ? Math.round((obtainedPoints / maxApplicablePoints) * 1000) / 10
        : 100;

    let estatus: 'Cumple' | 'Observación' | 'Crítico' = 'Cumple';
    if (scorePct < 70) estatus = 'Crítico';
    else if (scorePct < 85) estatus = 'Observación';

    return {
      obtainedPoints: Math.round(obtainedPoints * 10) / 10,
      maxApplicablePoints,
      scorePct,
      estatus,
      obsCount,
    };
  }, [itemsData]);

  // Quick actions on the form
  const handleSetAllOptimal = () => {
    const updated: typeof itemsData = {};
    ZOHO_CHECKLIST_ITEMS.forEach((it) => {
      updated[it.index] = {
        calificacion: it.defaultScore ?? (it.isInformative ? '' : it.maxPoints),
        observaciones: itemsData[it.index]?.observaciones || '',
      };
    });
    setItemsData(updated);
    showToast('Todos los rubros se marcaron con cumplimiento óptimo.');
  };

  const handleClearObservations = () => {
    const updated: typeof itemsData = {};
    ZOHO_CHECKLIST_ITEMS.forEach((it) => {
      updated[it.index] = {
        calificacion: itemsData[it.index]?.calificacion ?? '',
        observaciones: '',
      };
    });
    setItemsData(updated);
    showToast('Observaciones limpiadas.');
  };

  const handleResetForm = () => {
    const initial: typeof itemsData = {};
    ZOHO_CHECKLIST_ITEMS.forEach((it) => {
      initial[it.index] = {
        calificacion: it.isInformative ? (it.defaultScore ?? '') : '',
        observaciones: '',
      };
    });
    setItemsData(initial);
    try {
      localStorage.removeItem('evaluaciones_zoho_active_draft');
    } catch (e) {
      console.error(e);
    }
    setFecha(getCurrentDateStr());
    setHora(getCurrentTimeStr());
    setIsAddingNewStation(false);
    setCustomStationName('');
    showToast('Formulario reiniciado (calificaciones limpias para que el usuario seleccione).');
  };

  // Toggle rubro collapse
  const toggleRubro = (rubroId: number) => {
    setCollapsedRubros((prev) => ({
      ...prev,
      [rubroId]: !prev[rubroId],
    }));
  };

  // Submit and save audit
  const handleSaveAudit = async () => {
    const effectiveStation = (isAddingNewStation ? customStationName : selectedStation).trim();

    if (!effectiveStation) {
      showToast('Por favor selecciona o escribe el nombre de la estación.');
      return;
    }
    if (!auditor.trim()) {
      showToast('Por favor ingresa el nombre del auditor.');
      return;
    }
    if (!fecha) {
      showToast('Por favor ingresa la fecha de la inspección.');
      return;
    }

    setIsSaving(true);

    try {
      // Build the ZohoAuditRecord
      const auditItems: ZohoAuditItem[] = ZOHO_CHECKLIST_ITEMS.map((def) => {
        const userEntry = itemsData[def.index] || {
          calificacion: def.defaultScore ?? (def.isInformative ? '' : def.maxPoints),
          observaciones: '',
        };
        return {
          puntoIndex: def.index,
          id: def.id,
          rubroId: def.rubroId,
          rubroName: def.rubroName,
          punto: def.punto,
          calificacion: userEntry.calificacion,
          observaciones: userEntry.observaciones.trim(),
          maxPoints: def.maxPoints,
          isInformative: def.isInformative,
        };
      });

      const auditRecord: ZohoAuditRecord = {
        id: `zoho-aud-${Date.now()}`,
        fecha,
        hora,
        auditor: auditor.trim(),
        estacion: effectiveStation,
        ciudad: ciudad.trim() || 'Sinaloa',
        mes,
        anio,
        overallScore: scoreSummary.scorePct,
        estatus: scoreSummary.estatus,
        observacionesCount: scoreSummary.obsCount,
        items: auditItems,
        createdAt: new Date().toISOString(),
      };

      // Convert items to 54 StationEvaluationRecord objects for central system
      const evaluationRecords: StationEvaluationRecord[] = auditItems.map((item) => ({
        id: `zoho-${Date.now()}-${item.puntoIndex}-${Math.random().toString(36).slice(2, 6)}`,
        concatenar: `${effectiveStation}${mes}${item.punto}`,
        ciudad: ciudad.trim() || 'Sinaloa',
        estacion: effectiveStation,
        mes,
        anio,
        punto: item.punto,
        calificacion: item.calificacion,
        rubroId: item.rubroId,
        observaciones: item.observaciones || undefined,
        inspectorSubmittedAt: `${fecha} ${hora}`,
        inspectorUser: auditor.trim(),
      }));

      // Call system save (persists to Supabase and records in App.tsx)
      const res = await onSaveAuditToSystem(auditRecord, evaluationRecords);

      // Save in Zoho audits history
      const updatedHistory = [auditRecord, ...auditsHistory];
      setAuditsHistory(updatedHistory);
      try {
        localStorage.setItem(STORAGE_KEY_AUDITS, JSON.stringify(updatedHistory));
      } catch (e) {
        console.error(e);
      }

      if (res && res.success) {
        showToast(
          `¡Inspección de "${effectiveStation}" guardada con éxito! (${scoreSummary.scorePct}% - ${scoreSummary.estatus})`
        );
      } else {
        showToast(
          `Guardada en historial de Formulario Estaciones. Nota Supabase: ${res?.error || 'Sincronizado localmente'}`
        );
      }

      // Switch to history or stay
      setActiveTab('historial');
    } catch (err: any) {
      console.error(err);
      showToast(`Error al guardar la inspección: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete audit from history
  const handleDeleteAudit = (auditId: string) => {
    if (!window.confirm('¿Deseas eliminar esta inspección del historial de Formulario Estaciones?')) return;
    const next = auditsHistory.filter((a) => a.id !== auditId);
    setAuditsHistory(next);
    try {
      localStorage.setItem(STORAGE_KEY_AUDITS, JSON.stringify(next));
    } catch {}
    if (viewingAuditDetail?.id === auditId) {
      setViewingAuditDetail(null);
    }
    showToast('Auditoría eliminada del historial.');
  };

  // Load audit into form for editing
  const handleLoadAuditToForm = (audit: ZohoAuditRecord) => {
    setFecha(audit.fecha);
    setHora(audit.hora);
    setAuditor(audit.auditor);
    setSelectedStation(audit.estacion);
    setCiudad(audit.ciudad);
    setMes(audit.mes);
    setAnio(audit.anio);
    setIsAddingNewStation(false);

    const reloaded: typeof itemsData = {};
    audit.items.forEach((item) => {
      reloaded[item.puntoIndex] = {
        calificacion: item.calificacion,
        observaciones: item.observaciones,
      };
    });
    setItemsData(reloaded);
    setActiveTab('formulario');
    setViewingAuditDetail(null);
    showToast(`Auditoría de "${audit.estacion}" cargada en el formulario para edición.`);
  };

  // Export exact CSV/Excel matching original file format
  const handleExportAudit = (
    audit: ZohoAuditRecord,
    format: 'xlsx' | 'csv' = 'xlsx',
    includeMetadataHeader: boolean = true
  ) => {
    const wb = XLSX.utils.book_new();

    // Row 1: Original title
    // Row 2: Headers exact
    // Rows 3..56: Data rows
    const wsData: any[][] = [
      ['', 'BASE DE DATOS SEGURIDAD ESTACIONES', '', '', '', '', '', ''],
      [
        'CONCATENAR',
        'CIUDAD',
        'ESTACION',
        'MES DE REVISION',
        'AÑO',
        'PUNTO A REVISAR',
        'CALIFICACION',
        'OBSERVACIONES',
      ],
    ];

    audit.items.forEach((item) => {
      wsData.push([
        `${audit.estacion}${audit.mes}${item.punto}`,
        audit.ciudad,
        audit.estacion,
        audit.mes,
        audit.anio,
        item.punto,
        item.calificacion,
        item.observaciones || '',
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 40 },
      { wch: 22 },
      { wch: 30 },
      { wch: 16 },
      { wch: 8 },
      { wch: 75 },
      { wch: 14 },
      { wch: 45 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'BD Seguridad Estaciones');

    const cleanName = audit.estacion.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Formulario_Estaciones_Auditoria_${cleanName}_${audit.mes}_${audit.anio}.${format}`;

    downloadWorkbook(wb, fileName);
    showToast(`Archivo "${fileName}" descargado con las tablas exactas.`);
  };

  // Export all audits consolidated in exact format
  const handleExportAllAudits = (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (auditsHistory.length === 0) {
      showToast('No hay auditorías en el historial para exportar.');
      return;
    }

    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [
      ['', 'BASE DE DATOS SEGURIDAD ESTACIONES', '', '', '', '', '', ''],
      [
        'CONCATENAR',
        'CIUDAD',
        'ESTACION',
        'MES DE REVISION',
        'AÑO',
        'PUNTO A REVISAR',
        'CALIFICACION',
        'OBSERVACIONES',
      ],
    ];

    auditsHistory.forEach((audit) => {
      audit.items.forEach((item) => {
        wsData.push([
          `${audit.estacion}${audit.mes}${item.punto}`,
          audit.ciudad,
          audit.estacion,
          audit.mes,
          audit.anio,
          item.punto,
          item.calificacion,
          item.observaciones || '',
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 40 },
      { wch: 22 },
      { wch: 30 },
      { wch: 16 },
      { wch: 8 },
      { wch: 75 },
      { wch: 14 },
      { wch: 45 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'BD Seguridad Consolidada');
    const fileName = `Formulario_Estaciones_Base_Datos_Consolidado_${new Date().toISOString().slice(0, 10)}.${format}`;
    downloadWorkbook(wb, fileName);
    showToast(`Base consolidada (${auditsHistory.length} auditorías) exportada con éxito.`);
  };

  // Filtered history
  const filteredAudits = useMemo(() => {
    return auditsHistory.filter((a) => {
      const matchSearch =
        a.estacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.auditor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.ciudad.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMonth = filterMonth === 'TODOS' || a.mes === filterMonth;
      return matchSearch && matchMonth;
    });
  }, [auditsHistory, searchTerm, filterMonth]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Module Header */}
      <div className="bg-gradient-to-r from-[#0c323f] via-[#134453] to-[#0c323f] text-white p-5 sm:p-6 rounded-xl border border-[#195a6d] shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-xs">
            <ClipboardCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight">Formulario Estaciones</h2>
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                Formulario & Auditoría
              </span>
              <span className="text-[10px] bg-white/10 text-neutral-200 px-2 py-0.5 rounded-full font-mono">
                54 Puntos Normativos
              </span>
            </div>
            <p className="text-xs text-[#a2bcc4] mt-1">
              Captura de inspecciones en campo con fecha, hora y auditor automáticos. Sincronización en tiempo real y exportación en las mismas tablas del Excel original.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-[#09252f] p-1 rounded-lg border border-[#144453] shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('formulario')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'formulario'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-[#9cb5be] hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Formulario</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('historial')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'historial'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-[#9cb5be] hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial ({auditsHistory.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: FORMULARIO DE CAPTURA ZOHO */}
      {activeTab === 'formulario' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Metadata Card: Fecha, Hora, Auditor, Estación, Ciudad, Mes, Año */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Datos Generales de la Inspección
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors cursor-pointer"
                  title="Reiniciar valores"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reiniciar</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Fecha de Recabación Automática */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Fecha de Recabación</span>
                  <span className="text-[10px] text-emerald-700 font-normal bg-emerald-50 px-1.5 rounded">
                    Auto
                  </span>
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg bg-neutral-50/50 font-mono focus:bg-white focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
                />
              </div>

              {/* Hora de Recabación Automática */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Hora de Recabación</span>
                  <span className="text-[10px] text-emerald-700 font-normal bg-emerald-50 px-1.5 rounded">
                    Auto
                  </span>
                </label>
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg bg-neutral-50/50 font-mono focus:bg-white focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
                />
              </div>

              {/* Nombre del Auditor Automático */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Nombre del Auditor</span>
                  <span className="text-[10px] text-emerald-700 font-normal bg-emerald-50 px-1.5 rounded">
                    Sesión
                  </span>
                </label>
                <input
                  type="text"
                  value={auditor}
                  onChange={(e) => setAuditor(e.target.value)}
                  placeholder="Nombre y Apellido del Auditor"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg bg-neutral-50/50 focus:bg-white focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
                />
              </div>

              {/* Estación */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Estación a Inspeccionar</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewStation(!isAddingNewStation)}
                    className="text-[10px] text-emerald-700 hover:underline font-normal cursor-pointer"
                  >
                    {isAddingNewStation ? 'Elegir existente' : '+ Nueva'}
                  </button>
                </label>

                {isAddingNewStation ? (
                  <input
                    type="text"
                    value={customStationName}
                    onChange={(e) => setCustomStationName(e.target.value)}
                    placeholder="Ej: Mochis - Nueva Estación"
                    className="w-full px-3 py-2 text-xs border border-amber-400 bg-amber-50/30 rounded-lg focus:ring-1 focus:ring-amber-500 font-semibold"
                  />
                ) : (
                  <select
                    value={selectedStation}
                    onChange={(e) => setSelectedStation(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg bg-white focus:ring-1 focus:ring-neutral-900 font-semibold text-neutral-900"
                  >
                    {stations.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Ciudad / Ubicación */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Ciudad / Estado</span>
                </label>
                <input
                  type="text"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  placeholder="Ej: Sinaloa - Mochis"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg bg-white"
                />
              </div>

              {/* Mes de Revisión */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Mes de Revisión
                </label>
                <select
                  value={mes}
                  onChange={(e) => setMes(e.target.value as MonthName)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg bg-white font-semibold"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Año */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Año
                </label>
                <select
                  value={anio}
                  onChange={(e) => setAnio(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg bg-white font-mono"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>
              </div>

              {/* Preview Identificador CONCATENAR */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                  Identificador Concatenar (Fórmula)
                </label>
                <div className="px-3 py-2 text-xs bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-600 font-mono truncate" title="[Estación][Mes][Punto]">
                  {isAddingNewStation ? customStationName : selectedStation}{mes}[Punto]
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Score Bar & Actions */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm sticky top-2 z-20 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-neutral-950 font-mono">
                  {scoreSummary.scorePct}%
                </span>
                <span className="text-xs text-neutral-500 font-medium">Calificación Final</span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${
                    scoreSummary.estatus === 'Cumple'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : scoreSummary.estatus === 'Observación'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}
                >
                  {scoreSummary.estatus}
                </span>

                <span className="text-xs font-semibold text-neutral-600 font-mono bg-neutral-100 px-2.5 py-1 rounded border border-neutral-200">
                  {scoreSummary.obtainedPoints} / {scoreSummary.maxApplicablePoints} pts
                </span>

                {scoreSummary.obsCount > 0 && (
                  <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>{scoreSummary.obsCount} observaciones</span>
                  </span>
                )}
              </div>
            </div>

            {/* Helper buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSetAllOptimal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
                title="Llenar calificaciones sugeridas con puntaje máximo"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Puntaje Máximo Rápido</span>
              </button>

              <button
                type="button"
                onClick={handleClearObservations}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
              >
                <span>Limpiar Notas</span>
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAudit}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-neutral-950 hover:bg-neutral-800 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Inspección'}</span>
              </button>
            </div>
          </div>

          {/* 54 Checklist Items by 5 Rubros */}
          <div className="space-y-5">
            {ZOHO_RUBROS.map((rubro) => {
              const rubroItems = ZOHO_CHECKLIST_ITEMS.filter((it) => it.rubroId === rubro.id);
              const isCollapsed = !!collapsedRubros[rubro.id];

              // Calculate rubro score
              let rubroObtained = 0;
              let rubroMax = 0;
              rubroItems.forEach((it) => {
                const calif = itemsData[it.index]?.calificacion;
                if (!it.isInformative && it.maxPoints > 0 && calif !== 'N/A') {
                  rubroMax += it.maxPoints;
                  const num = typeof calif === 'number' ? calif : parseFloat(String(calif));
                  if (!isNaN(num)) rubroObtained += num;
                }
              });

              return (
                <div
                  key={rubro.id}
                  className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs"
                >
                  {/* Rubro Header */}
                  <div
                    onClick={() => toggleRubro(rubro.id)}
                    className="p-4 bg-neutral-50/70 hover:bg-neutral-100/70 border-b border-neutral-200 flex items-center justify-between cursor-pointer select-none transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center text-xs font-bold font-mono">
                        {rubro.id}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-950 uppercase tracking-wider">
                          {rubro.name}
                        </h4>
                        <span className="text-[11px] text-neutral-500 font-mono">
                          Norma: {rubro.norma} · {rubroItems.length} puntos a evaluar
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-bold font-mono text-neutral-900">
                          {Math.round(rubroObtained * 10) / 10} / {rubroMax} pts
                        </span>
                        <div className="w-24 bg-neutral-200 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all"
                            style={{
                              width: `${rubroMax > 0 ? Math.min(100, Math.round((rubroObtained / rubroMax) * 100)) : 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-neutral-400" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>
                  </div>

                  {/* Rubro Items list */}
                  {!isCollapsed && (
                    <div className="divide-y divide-neutral-100 p-2 sm:p-4 space-y-3">
                      {rubroItems.map((item) => {
                        const current = itemsData[item.index] || {
                          calificacion: item.defaultScore ?? 0,
                          observaciones: '',
                        };

                        const isMax =
                          typeof current.calificacion === 'number' &&
                          current.calificacion === item.maxPoints;
                        const isZero =
                          current.calificacion === 0 || current.calificacion === '0';
                        const isNA = current.calificacion === 'N/A';

                        return (
                          <div
                            key={item.index}
                            className={`p-3.5 rounded-lg border transition-all ${
                              current.observaciones.trim()
                                ? 'border-amber-200 bg-amber-50/20'
                                : 'border-neutral-200/70 bg-white hover:border-neutral-300'
                            }`}
                          >
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                              {/* Left: Description & Index */}
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded border border-neutral-200">
                                    #{item.index} · {item.id}
                                  </span>
                                  {!item.isInformative && (
                                    <span className="text-[10px] font-semibold text-neutral-500 font-mono">
                                      Max: {item.maxPoints} pts
                                    </span>
                                  )}
                                  {item.isInformative && (
                                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                      Campo Informativo / Conteo
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-semibold text-neutral-900 leading-relaxed">
                                  {item.punto}
                                </p>
                              </div>

                              {/* Right: Score Controls */}
                              <div className="shrink-0 space-y-1 self-start">
                                <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                  Calificación
                                </span>

                                {item.inputType === 'number' ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      value={current.calificacion}
                                      onChange={(e) =>
                                        setItemsData((prev) => ({
                                          ...prev,
                                          [item.index]: {
                                            ...prev[item.index],
                                            calificacion: e.target.value === '' ? '' : Number(e.target.value),
                                          },
                                        }))
                                      }
                                      className="w-20 px-2 py-1 text-xs font-mono font-bold border border-neutral-300 rounded text-center bg-white"
                                    />
                                    <span className="text-[11px] text-neutral-500">piezas</span>
                                  </div>
                                ) : item.inputType === 'text' ? (
                                  <input
                                    type="text"
                                    value={String(current.calificacion)}
                                    onChange={(e) =>
                                      setItemsData((prev) => ({
                                        ...prev,
                                        [item.index]: {
                                          ...prev[item.index],
                                          calificacion: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="Texto / fecha / %"
                                    className="w-36 px-2.5 py-1 text-xs font-mono border border-neutral-300 rounded bg-white"
                                  />
                                ) : (
                                  /* Score buttons */
                                  <div className="flex items-center gap-1 flex-wrap max-w-md">
                                    {(item.suggestedScores && item.suggestedScores.length > 0
                                      ? item.suggestedScores
                                      : generateStepScores(item.maxPoints)
                                    ).map((scoreVal) => {
                                      const isSelected =
                                        current.calificacion !== '' &&
                                        current.calificacion !== null &&
                                        current.calificacion !== undefined &&
                                        String(current.calificacion) === String(scoreVal);
                                      const isMaxBtn =
                                        typeof scoreVal === 'number' &&
                                        scoreVal === item.maxPoints;
                                      const isZeroBtn =
                                        scoreVal === 0 || scoreVal === '0';
                                      const isNABtn = scoreVal === 'N/A';

                                      return (
                                        <button
                                          key={String(scoreVal)}
                                          type="button"
                                          onClick={() => {
                                            const nextVal = isSelected ? '' : scoreVal;
                                            setItemsData((prev) => ({
                                              ...prev,
                                              [item.index]: {
                                                ...prev[item.index],
                                                calificacion: nextVal,
                                              },
                                            }));
                                          }}
                                          className={`px-2 py-1 min-w-[28px] text-center rounded text-xs font-bold font-mono transition-all cursor-pointer ${
                                            isSelected
                                              ? isMaxBtn
                                                ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-700 font-extrabold'
                                                : isZeroBtn
                                                ? 'bg-red-600 text-white shadow-xs ring-1 ring-red-700 font-extrabold'
                                                : isNABtn
                                                ? 'bg-neutral-800 text-white shadow-xs ring-1 ring-neutral-900 font-extrabold'
                                                : 'bg-amber-500 text-white shadow-xs ring-1 ring-amber-600 font-extrabold'
                                              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200'
                                          }`}
                                          title={`Calificación: ${scoreVal}`}
                                        >
                                          {scoreVal}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Observations / Preset response section */}
                            <div className="mt-3 pt-2.5 border-t border-neutral-100 space-y-2.5">
                              {/* 1. Dropdown for preset findings (Grupo 1) */}
                              {item.presetFindings && item.presetFindings.length > 0 && (
                                <div>
                                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                                    Seleccionar respuesta de la lista:
                                  </label>
                                  <select
                                    value={
                                      item.presetFindings.includes(current.observaciones)
                                        ? current.observaciones
                                        : ''
                                    }
                                    onChange={(e) => {
                                      const chosen = e.target.value;
                                      setItemsData((prev) => ({
                                        ...prev,
                                        [item.index]: {
                                          ...prev[item.index],
                                          observaciones: chosen,
                                        },
                                      }));
                                    }}
                                    className="w-full text-xs px-3 py-2 bg-white text-neutral-800 border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-900 cursor-pointer shadow-2xs"
                                  >
                                    <option value="">
                                      -- Seleccionar hallazgo de la lista ({item.presetFindings.length} opciones) --
                                    </option>
                                    {item.presetFindings.map((finding, fIdx) => (
                                      <option key={fIdx} value={finding}>
                                        {finding}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* 2. Custom response / observation input */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider">
                                    {item.presetFindings && item.presetFindings.length > 0
                                      ? 'O escribir tu propia respuesta / observación personalizada:'
                                      : 'Observaciones / Hallazgo técnico:'}
                                  </label>
                                  {current.observaciones && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setItemsData((prev) => ({
                                          ...prev,
                                          [item.index]: {
                                            ...prev[item.index],
                                            observaciones: '',
                                          },
                                        }))
                                      }
                                      className="text-[11px] text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                                      title="Borrar respuesta actual"
                                    >
                                      <X className="w-3 h-3" /> Limpiar
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={current.observaciones}
                                  onChange={(e) =>
                                    setItemsData((prev) => ({
                                      ...prev,
                                      [item.index]: {
                                        ...prev[item.index],
                                        observaciones: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder={
                                    item.presetFindings && item.presetFindings.length > 0
                                      ? 'Si no seleccionaste una opción del menú, escribe aquí tu propia respuesta...'
                                      : `Anotar hallazgo o notas técnicas del punto ${item.id} (opcional)...`
                                  }
                                  className="w-full px-3 py-2 text-xs border border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 rounded-lg bg-white shadow-2xs transition-colors"
                                />
                              </div>

                              {/* 3. Preview: ONLY the selected response is shown in foreground */}
                              {current.observaciones && (
                                <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-950">
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-200/80 px-1.5 py-0.5 rounded shrink-0">
                                      Respuesta actual:
                                    </span>
                                    <span className="truncate font-semibold text-neutral-900">
                                      {current.observaciones}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setItemsData((prev) => ({
                                        ...prev,
                                        [item.index]: {
                                          ...prev[item.index],
                                          observaciones: '',
                                        },
                                      }))
                                    }
                                    className="text-neutral-400 hover:text-red-600 p-0.5 ml-2 cursor-pointer shrink-0"
                                    title="Quitar respuesta"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              {/* 4. Per-card Save Button */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-neutral-100">
                                <div className="text-xs text-neutral-500">
                                  {savedCards[item.index] ? (
                                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                      ¡Punto {item.id} guardado con éxito!
                                    </span>
                                  ) : current.calificacion !== '' ? (
                                    <span className="text-neutral-700">
                                      Calificación seleccionada:{' '}
                                      <strong className="font-mono text-neutral-900">
                                        {current.calificacion} pts
                                      </strong>
                                      {current.observaciones ? ' · Con observación registrada' : ''}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-400 italic">
                                      Punto sin calificar (selecciona calificación arriba)
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleSaveSingleCard(item)}
                                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                                    savedCards[item.index]
                                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                                      : 'bg-neutral-900 hover:bg-neutral-800 text-white active:scale-95'
                                  }`}
                                  title={`Guardar calificación y observaciones del punto ${item.id} en la base de datos`}
                                >
                                  {savedCards[item.index] ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-white" />
                                      <span>✓ Guardado</span>
                                    </>
                                  ) : (
                                    <>
                                      <Save className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Guardar este punto</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Save Bar */}
          <div className="p-4 bg-white rounded-xl border border-neutral-200 shadow-sm flex items-center justify-between gap-4">
            <div className="text-xs text-neutral-600">
              Al guardar, se registrarán los <strong>54 puntos normativos</strong> en el historial de Formulario Estaciones y en la Base de Datos Centralizada con el formato original.
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAudit}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4 text-emerald-400" />
              <span>{isSaving ? 'Guardando en Base de Datos...' : 'Guardar Inspección Completa'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: HISTORIAL DE AUDITORIAS RECADAS */}
      {activeTab === 'historial' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Action bar: Search, filters and export buttons */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              {/* Search box */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por estación, auditor o ciudad..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
                />
              </div>

              {/* Month filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-neutral-500" />
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-neutral-300 rounded-lg bg-white"
                >
                  <option value="TODOS">Todos los meses</option>
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Export all button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportAllAudits('xlsx')}
                disabled={auditsHistory.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                title="Descargar base de datos consolidada con formato idéntico al Excel original"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Exportar Todo a Excel</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportAllAudits('csv')}
                disabled={auditsHistory.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                title="Descargar CSV idéntico al original"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Audits table */}
          {filteredAudits.length > 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Fecha y Hora</th>
                      <th className="py-3 px-4">Auditor</th>
                      <th className="py-3 px-4">Estación</th>
                      <th className="py-3 px-4">Ciudad / Estado</th>
                      <th className="py-3 px-4">Periodo</th>
                      <th className="py-3 px-4 text-center">Calificación</th>
                      <th className="py-3 px-4 text-center">Hallazgos</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredAudits.map((audit) => (
                      <tr key={audit.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-neutral-800">
                          <div className="font-semibold">{audit.fecha}</div>
                          <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{audit.hora}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-neutral-900 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{audit.auditor}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap font-bold text-neutral-950">
                          {audit.estacion}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-neutral-600">
                          {audit.ciudad}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap font-mono">
                          <span className="font-semibold text-neutral-800">{audit.mes}</span>{' '}
                          <span className="text-neutral-500">{audit.anio}</span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs text-neutral-900">
                              {audit.overallScore}%
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                audit.estatus === 'Cumple'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : audit.estatus === 'Observación'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {audit.estatus}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          {audit.observacionesCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>{audit.observacionesCount}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              0 notas
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingAuditDetail(audit)}
                              className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                              title="Ver detalle completo de los 54 puntos"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleLoadAuditToForm(audit)}
                              className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                              title="Editar en el formulario"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleExportAudit(audit, 'xlsx')}
                              className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                              title="Exportar archivo Excel exacto"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteAudit(audit.id)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Eliminar auditoría"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center space-y-3">
              <ClipboardCheck className="w-12 h-12 text-neutral-300 mx-auto" />
              <h4 className="text-sm font-bold text-neutral-800">
                No hay auditorías registradas todavía
              </h4>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                Utiliza la pestaña <strong>Formulario</strong> para realizar una inspección de 54 puntos con fecha, hora y auditor automáticos.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('formulario')}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-950 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Capturar Nueva Inspección</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL: VER DETALLE COMPLETO DE AUDITORIA */}
      {viewingAuditDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl border border-neutral-300 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-200 bg-neutral-50/70 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-neutral-950">
                    Inspección: {viewingAuditDetail.estacion}
                  </h3>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      viewingAuditDetail.estatus === 'Cumple'
                        ? 'bg-emerald-100 text-emerald-800'
                        : viewingAuditDetail.estatus === 'Observación'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {viewingAuditDetail.overallScore}% ({viewingAuditDetail.estatus})
                  </span>
                </div>
                <div className="text-xs text-neutral-500 flex items-center gap-3 mt-1 font-mono flex-wrap">
                  <span>📅 {viewingAuditDetail.fecha} {viewingAuditDetail.hora}</span>
                  <span>👤 Auditor: {viewingAuditDetail.auditor}</span>
                  <span>📍 {viewingAuditDetail.ciudad}</span>
                  <span>🗓️ {viewingAuditDetail.mes} {viewingAuditDetail.anio}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportAudit(viewingAuditDetail, 'xlsx')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Exportar Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingAuditDetail(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Items List */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <div className="border border-neutral-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-neutral-100 text-neutral-700 border-b border-neutral-200 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2 px-3 w-12">#</th>
                      <th className="py-2 px-3">Punto a Revisar</th>
                      <th className="py-2 px-3 w-28 text-center">Calificación</th>
                      <th className="py-2 px-3">Observaciones / Hallazgo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-mono text-[11px]">
                    {viewingAuditDetail.items.map((it) => (
                      <tr
                        key={it.puntoIndex}
                        className={it.observaciones ? 'bg-amber-50/30' : ''}
                      >
                        <td className="py-2 px-3 font-bold text-neutral-500">{it.puntoIndex}</td>
                        <td className="py-2 px-3 font-sans text-neutral-900">{it.punto}</td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`font-bold px-2 py-0.5 rounded ${
                              String(it.calificacion) === '0'
                                ? 'bg-red-100 text-red-800'
                                : String(it.calificacion) === 'N/A'
                                ? 'bg-neutral-200 text-neutral-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {it.calificacion}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-sans text-neutral-700">
                          {it.observaciones || <span className="text-neutral-300">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleLoadAuditToForm(viewingAuditDetail)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar en Formulario</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingAuditDetail(null)}
                className="px-4 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
