import React, { useState, useMemo, useEffect } from 'react';
import { MonthName, MONTHS, StationEvaluationRecord, EvidencePhoto, UserSession } from '../types';
import { exportModule2ToExcel } from '../utils/excelUtils';
import { EvidenceGalleryModal } from './EvidenceGalleryModal';
import { RecordTimerBadge } from './RecordTimerBadge';
import { RUBRO_ITEMS } from '../data/initialData';
import { getScoreCellFormat } from '../utils/evaluationFormulas';
import {
  Download,
  Upload,
  Search,
  Trash2,
  Plus,
  Filter,
  RefreshCw,
  CheckSquare,
  Square,
  Edit2,
  AlertCircle,
  Camera,
  Lock,
  Database,
  CheckCircle2,
  LayoutDashboard,
  TableProperties,
  ArrowRight,
} from 'lucide-react';
import { SUPABASE_CONFIG, checkSupabaseHealth } from '../lib/supabaseClient';
import { safeStorageGet, safeStorageSet } from '../utils/sessionManager';

interface Module2DatabaseProps {
  records: StationEvaluationRecord[];
  stations: string[];
  onAddRecord: (record: StationEvaluationRecord) => void;
  onUpdateRecord: (record: StationEvaluationRecord) => void;
  onDeleteRecords: (recordIds: string[]) => void;
  onClearAllRecords?: () => void;
  onOpenImportModal: () => void;
  onSyncAllToSupabase?: (onProgress?: (processed: number, total: number) => void) => Promise<{ success: boolean; count: number; error: string | null }>;
  onNavigateToModule1?: (station?: string) => void;
  onNavigateToMatrix?: (month?: MonthName) => void;
  user?: UserSession;
  entityLabel?: string;
}

export const Module2Database: React.FC<Module2DatabaseProps> = ({
  records,
  stations,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecords,
  onClearAllRecords,
  onOpenImportModal,
  onSyncAllToSupabase,
  onNavigateToModule1,
  onNavigateToMatrix,
  user,
  entityLabel = 'Estación',
}) => {
  const canEdit = user?.role === 'Admin' || user?.role === 'Coordinador' || user?.role === 'Administrador' || user?.username === 'admin' || user?.username === 'coordinador';
  // Activado para todos los roles incluidos Usuario final según requerimiento
  const canDelete = true;
  const isReadOnly = user?.role === 'Usuario final';

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStation, setFilterStation] = useState<string>(() => {
    try {
      const saved = safeStorageGet('evaluaciones_m2_filter_station');
      if (saved) return saved;
    } catch {}
    return 'ALL';
  });
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    try {
      const saved = safeStorageGet('evaluaciones_m2_filter_month');
      if (saved) return saved;
    } catch {}
    return 'ALL';
  });
  const [filterYear, setFilterYear] = useState<string>(() => {
    try {
      const saved = safeStorageGet('evaluaciones_m2_filter_year');
      if (saved) return saved;
    } catch {}
    return 'ALL';
  });

  useEffect(() => {
    safeStorageSet('evaluaciones_m2_filter_station', filterStation);
  }, [filterStation]);

  useEffect(() => {
    safeStorageSet('evaluaciones_m2_filter_month', filterMonth);
  }, [filterMonth]);

  useEffect(() => {
    safeStorageSet('evaluaciones_m2_filter_year', filterYear);
  }, [filterYear]);

  // Supabase live connection monitor state
  const [supabaseStatus, setSupabaseStatus] = useState<{
    connected: boolean;
    latencyMs: number | null;
    cloudRecordsCount: number | null;
    lastChecked: string | null;
    error: string | null;
  }>({
    connected: true,
    latencyMs: null,
    cloudRecordsCount: null,
    lastChecked: null,
    error: null,
  });
  const [isCheckingSupabase, setIsCheckingSupabase] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ processed: number; total: number } | null>(null);
  const [syncBannerMessage, setSyncBannerMessage] = useState<string | null>(null);

  // Health check and real-time records counter in Supabase
  const runHealthCheck = async () => {
    setIsCheckingSupabase(true);
    try {
      const res = await checkSupabaseHealth();
      setSupabaseStatus({
        connected: res.connected && res.tableExists,
        latencyMs: res.latencyMs,
        cloudRecordsCount: res.recordsCount,
        lastChecked: res.testedAt,
        error: res.errorDetail,
      });
    } catch (e: any) {
      setSupabaseStatus((prev) => ({
        ...prev,
        connected: false,
        error: e?.message || 'Error al conectar con Supabase',
      }));
    } finally {
      setIsCheckingSupabase(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, [records.length]);

  const handleTriggerSyncAll = async () => {
    if (!onSyncAllToSupabase) return;
    setIsSyncingAll(true);
    setSyncProgress({ processed: 0, total: records.length });
    setSyncBannerMessage(null);
    try {
      const res = await onSyncAllToSupabase((processed, total) => {
        setSyncProgress({ processed, total });
      });
      if (res.success) {
        setSyncBannerMessage(`✓ ${res.count} registros sincronizados y respaldados exitosamente en Supabase.`);
        runHealthCheck();
      } else {
        setSyncBannerMessage(`Error al sincronizar con Supabase: ${res.error}`);
      }
    } catch (e: any) {
      setSyncBannerMessage(`Error de comunicación con Supabase: ${e?.message || e}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Selected records for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [recordToDeleteSingle, setRecordToDeleteSingle] = useState<StationEvaluationRecord | null>(null);
  const [isConfirmClearAllOpen, setIsConfirmClearAllOpen] = useState(false);
  const [lastDeletedCount, setLastDeletedCount] = useState<number | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // New record modal & gallery modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StationEvaluationRecord | null>(null);
  const [selectedRecordForGallery, setSelectedRecordForGallery] = useState<StationEvaluationRecord | null>(null);

  // Form state for add/edit
  const [formData, setFormData] = useState({
    ciudad: 'Sinaloa - Mochis',
    estacion: stations[0] || 'Mochis - Topolobampo',
    mes: 'SEPTIEMBRE' as MonthName,
    anio: 2026,
    punto: '',
    calificacion: '0',
    observaciones: '',
  });

  // Combined list of stations strictly from active records (no ghost stations)
  const effectiveStations = useMemo(() => {
    if (!records || records.length === 0) return [];
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.estacion && r.estacion.trim()) set.add(r.estacion.trim());
    });
    return Array.from(set).sort((a, b) => {
      const cleanA = a.replace('Mochis - ', '').trim();
      const cleanB = b.replace('Mochis - ', '').trim();
      return cleanA.localeCompare(cleanB, 'es', { sensitivity: 'base' });
    });
  }, [records]);

  // Dynamic available years from records (no ghost years)
  const availableYears = useMemo(() => {
    if (!records || records.length === 0) return [];
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.anio) {
        const y = String(r.anio).trim();
        if (y && !isNaN(Number(y))) set.add(y);
      }
    });
    return Array.from(set).sort().reverse();
  }, [records]);

  // Sincronizar y limpiar filtros si ya no existen en la base de datos
  useEffect(() => {
    if (filterStation !== 'ALL' && !effectiveStations.includes(filterStation)) {
      setFilterStation('ALL');
    }
  }, [effectiveStations, filterStation]);

  useEffect(() => {
    if (filterYear !== 'ALL' && !availableYears.includes(filterYear)) {
      setFilterYear('ALL');
    }
  }, [availableYears, filterYear]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        searchTerm === '' ||
        r.punto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.estacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.ciudad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.concatenar.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.observaciones && r.observaciones.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStation = filterStation === 'ALL' || r.estacion === filterStation;
      const matchMonth = filterMonth === 'ALL' || r.mes === filterMonth;
      const matchYear = filterYear === 'ALL' || String(r.anio) === filterYear;

      return matchSearch && matchStation && matchMonth && matchYear;
    });
  }, [records, searchTerm, filterStation, filterMonth, filterYear]);

  // Paginated view
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;

  // Toggle selection (permite seleccionar desde 1 hasta todos los registros filtrados)
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length && filteredRecords.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
    }
  };

  const handleSelectPageOnly = () => {
    setSelectedIds(new Set(paginatedRecords.map((r) => r.id)));
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setRecordToDeleteSingle(null);
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleOpenConfirmDelete = () => {
    if (selectedIds.size === 0) return;
    setRecordToDeleteSingle(null);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    const idsToDelete = recordToDeleteSingle
      ? [recordToDeleteSingle.id]
      : Array.from(selectedIds);
    const count = idsToDelete.length;
    if (count === 0) return;

    onDeleteRecords(idsToDelete);
    setSelectedIds(new Set());
    setRecordToDeleteSingle(null);
    setIsConfirmDeleteOpen(false);
    setLastDeletedCount(count);
  };

  const handleExport = () => {
    exportModule2ToExcel(filteredRecords, 'BASE_DE_DATOS_SEGURIDAD_ESTACIONES.xlsx');
  };

  const handleOpenAdd = () => {
    setEditingRecord(null);
    setFormData({
      ciudad: 'Sinaloa - Mochis',
      estacion: stations[0] || 'Mochis - Topolobampo',
      mes: 'SEPTIEMBRE',
      anio: 2026,
      punto: '',
      calificacion: '0',
      observaciones: '',
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (rec: StationEvaluationRecord) => {
    setEditingRecord(rec);
    setFormData({
      ciudad: rec.ciudad,
      estacion: rec.estacion,
      mes: rec.mes,
      anio: rec.anio,
      punto: rec.punto,
      calificacion: String(rec.calificacion),
      observaciones: rec.observaciones || '',
    });
    setIsAddModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const rawVal = formData.calificacion.trim();
    const num = parseFloat(rawVal);
    const parsedCalif = isNaN(num) ? rawVal : num;
    const cleanObs = formData.observaciones?.trim() || undefined;

    if (editingRecord) {
      onUpdateRecord({
        ...editingRecord,
        ciudad: formData.ciudad,
        estacion: formData.estacion,
        mes: formData.mes,
        anio: formData.anio,
        punto: formData.punto,
        calificacion: parsedCalif,
        observaciones: cleanObs,
        concatenar: `${formData.estacion}${formData.mes}${formData.punto}`,
      });
    } else {
      onAddRecord({
        id: `rec-${Date.now()}`,
        concatenar: `${formData.estacion}${formData.mes}${formData.punto}`,
        ciudad: formData.ciudad,
        estacion: formData.estacion,
        mes: formData.mes,
        anio: formData.anio,
        punto: formData.punto,
        calificacion: parsedCalif,
        observaciones: cleanObs,
      });
    }
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header and actions */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 max-w-full overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 mb-1">
              <span>MÓDULO 1</span>
              <span>/</span>
              <span>BASE DE DATOS MAESTRA</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-950">
              Módulo 1: Base de Datos Centralizada ({entityLabel === 'Planta' ? 'Plantas' : 'Estaciones'})
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Repositorio centralizado de calificaciones por punto, estación, mes y año. Importación y sincronización oficial.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Registro</span>
              </button>
            )}

            {canEdit && (
              <button
                onClick={onOpenImportModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-50 border border-neutral-300 rounded transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importar Excel</span>
              </button>
            )}

            {onNavigateToModule1 && (
              <button
                type="button"
                onClick={() =>
                  onNavigateToModule1(
                    filterStation !== 'ALL' ? filterStation : effectiveStations[0] || undefined
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 rounded transition-colors shadow-2xs cursor-pointer"
                title={`Ir a Módulo 2 para evaluar ${filterStation !== 'ALL' ? filterStation : 'la estación'}`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-cyan-700" />
                <span>Ver en Módulo 2 (Por {entityLabel})</span>
              </button>
            )}

            {onNavigateToMatrix && (
              <button
                type="button"
                onClick={() =>
                  onNavigateToMatrix(
                    filterMonth !== 'ALL' ? (filterMonth as MonthName) : undefined
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition-colors shadow-2xs cursor-pointer"
                title="Ir a Matriz General para ver registros consolidados"
              >
                <TableProperties className="w-3.5 h-3.5 text-emerald-700" />
                <span>Ver en Matriz General</span>
              </button>
            )}

            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel (.xlsx)</span>
            </button>

            {canDelete && onClearAllRecords && (
              <button
                type="button"
                onClick={() => setIsConfirmClearAllOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-red-700 hover:text-white bg-red-50 hover:bg-red-600 border border-red-300 hover:border-red-600 rounded transition-all shadow-2xs cursor-pointer"
                title={`Eliminar permanentemente todos los registros de prueba (${records.length}) de Supabase y navegador`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar Base de Datos (Borrar pruebas)</span>
              </button>
            )}
          </div>
        </div>

        {/* Supabase Connection & Cloud Backup Banner */}
        <div className="mt-4 p-3.5 bg-neutral-900 text-white rounded-lg border border-neutral-800 shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 bg-neutral-800 rounded-lg text-emerald-400 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        supabaseStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                      }`}
                    ></span>
                    <span className="font-bold text-xs tracking-wide">
                      {supabaseStatus.connected ? 'CONEXIÓN SUPABASE EN VIVO' : 'SIN CONEXIÓN A SUPABASE'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                    ID: {SUPABASE_CONFIG.projectId}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                    Tabla: {entityLabel === 'Planta' ? 'evaluaciones_plantas_registros' : 'evaluaciones_registros'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-1 flex-wrap">
                  <span>
                    ☁️ En Supabase:{' '}
                    <strong className="text-emerald-400 font-mono">
                      {supabaseStatus.cloudRecordsCount !== null
                        ? `${supabaseStatus.cloudRecordsCount.toLocaleString()} registros`
                        : 'Verificando...'}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    💻 En Memoria Local:{' '}
                    <strong className="text-white font-mono">{records.length.toLocaleString()} registros</strong>
                  </span>
                  {supabaseStatus.latencyMs !== null && (
                    <>
                      <span>•</span>
                      <span>
                        ⚡ Latencia: <span className="font-mono text-neutral-300">{supabaseStatus.latencyMs} ms</span>
                      </span>
                    </>
                  )}
                  {supabaseStatus.lastChecked && (
                    <>
                      <span>•</span>
                      <span className="text-neutral-500">Última prueba: {supabaseStatus.lastChecked}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={runHealthCheck}
                disabled={isCheckingSupabase}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded transition-colors disabled:opacity-50 cursor-pointer"
                title="Probar conexión en tiempo real con Supabase"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingSupabase ? 'animate-spin' : ''}`} />
                <span>{isCheckingSupabase ? 'Probando...' : 'Probar Conexión'}</span>
              </button>

              {onSyncAllToSupabase && canEdit && (
                <button
                  type="button"
                  onClick={handleTriggerSyncAll}
                  disabled={isSyncingAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  title="Subir todos los registros actuales directamente a Supabase"
                >
                  {isSyncingAll ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sincronizando ({syncProgress ? `${syncProgress.processed}/${syncProgress.total}` : ''})...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Sincronizar a Supabase</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Sync Progress Bar */}
          {isSyncingAll && syncProgress && syncProgress.total > 0 && (
            <div className="mt-3 pt-3 border-t border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-neutral-300">
                <span>Guardando registros en Supabase...</span>
                <span className="font-mono text-emerald-400">
                  {syncProgress.processed} de {syncProgress.total} (
                  {Math.round((syncProgress.processed / syncProgress.total) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-200"
                  style={{
                    width: `${Math.round((syncProgress.processed / syncProgress.total) * 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          )}

          {/* Banner message */}
          {syncBannerMessage && (
            <div
              className={`mt-2.5 px-3 py-1.5 text-xs rounded border flex items-center justify-between ${
                syncBannerMessage.startsWith('✓')
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  : 'bg-red-950/60 text-red-300 border-red-800'
              }`}
            >
              <span>{syncBannerMessage}</span>
              <button
                type="button"
                onClick={() => setSyncBannerMessage(null)}
                className="text-neutral-400 hover:text-white text-xs ml-2"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Filters and search */}
        <div className="mt-5 pt-4 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">
              Filtrar por {entityLabel}
            </label>
            <select
              value={filterStation}
              onChange={(e) => {
                setFilterStation(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs font-medium border border-neutral-300 rounded bg-white focus:outline-none focus:border-neutral-900"
            >
              <option value="ALL">Todas las {entityLabel === 'Planta' ? 'Plantas' : 'Estaciones'} ({effectiveStations.length})</option>
              {effectiveStations.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">
              Mes de Revisión
            </label>
            <select
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs font-medium border border-neutral-300 rounded bg-white focus:outline-none focus:border-neutral-900"
            >
              <option value="ALL">Todos los Meses</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">
              Año
            </label>
            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs font-medium border border-neutral-300 rounded bg-white focus:outline-none focus:border-neutral-900"
            >
              <option value="ALL">
                {availableYears.length === 0 ? 'Sin años (0 registros)' : `Todos los Años (${availableYears.length})`}
              </option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">
              Búsqueda en Registros
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar punto, estación..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-300 rounded bg-white focus:outline-none focus:border-neutral-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notification banner after deletion */}
      {lastDeletedCount !== null && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              ✓
            </span>
            <span>
              <strong>{lastDeletedCount} registros eliminados exitosamente</strong> del sistema, caché local y Supabase. El repositorio está listo para nuevos archivos.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
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
              onClick={() => setLastDeletedCount(null)}
              className="px-2 py-1 text-emerald-700 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Action bar for multi-selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-600 px-1 py-1 bg-neutral-50/80 rounded-lg border border-neutral-200">
        <div className="flex flex-wrap items-center gap-2 px-2">
          <span>
            Mostrando <strong className="text-neutral-900">{filteredRecords.length}</strong> registros
            {records.length !== filteredRecords.length && ` (de ${records.length} totales)`}
          </span>
          {selectedIds.size > 0 && (
            <span className="text-neutral-950 font-bold bg-neutral-200 px-2 py-0.5 rounded">
              {selectedIds.size} seleccionados
            </span>
          )}
          {filteredRecords.length > 0 && (
            <div className="flex items-center gap-2 ml-1">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="inline-flex items-center gap-1 text-[#0e7490] hover:text-[#0b5c71] font-bold underline cursor-pointer text-xs"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Seleccionar todos ({filteredRecords.length})</span>
              </button>
              <button
                type="button"
                onClick={handleSelectPageOnly}
                className="text-neutral-600 hover:text-neutral-900 underline cursor-pointer text-[11px]"
              >
                Solo esta página ({paginatedRecords.length})
              </button>
              {selectedIds.size > 0 && (
                <>
                  <span className="text-neutral-300">·</span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-neutral-500 hover:text-neutral-800 cursor-pointer text-xs underline"
                  >
                    Limpiar selección
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleOpenConfirmDelete}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-xs cursor-pointer animate-pulse"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Borrar {selectedIds.size} Registros (Caché y Supabase)</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Database Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                {canDelete && (
                  <th className="py-2.5 px-3 w-10 text-center">
                    <button
                      onClick={handleToggleSelectAll}
                      className="text-neutral-500 hover:text-neutral-900 cursor-pointer"
                      title={
                        selectedIds.size === filteredRecords.length && filteredRecords.length > 0
                          ? 'Deseleccionar todos los registros'
                          : `Seleccionar todos (${filteredRecords.length})`
                      }
                    >
                      {selectedIds.size === filteredRecords.length && filteredRecords.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-neutral-900" />
                      ) : selectedIds.size > 0 ? (
                        <div className="w-4 h-4 rounded border-2 border-neutral-900 bg-neutral-900 flex items-center justify-center text-white text-[10px] font-bold">
                          -
                        </div>
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                <th className="py-2.5 px-3 min-w-[200px]">CONCATENAR</th>
                <th className="py-2.5 px-3 min-w-[120px]">CIUDAD</th>
                <th className="py-2.5 px-3 min-w-[150px]">ESTACION</th>
                <th className="py-2.5 px-2 text-center w-24">MES</th>
                <th className="py-2.5 px-2 text-center w-16">AÑO</th>
                <th className="py-2.5 px-3 min-w-[320px]">PUNTO A REVISAR</th>
                <th className="py-2.5 px-3 text-center w-24">CALIFICACION</th>
                <th className="py-2.5 px-3 min-w-[220px]">OBSERVACIONES</th>
                <th className="py-2.5 px-3 text-center w-28">EVIDENCIAS</th>
                <th className="py-2.5 px-3 text-center w-20">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-800">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 11 : 10} className="py-12 text-center text-neutral-400">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-neutral-300 mb-2" />
                      <p className="text-sm font-medium text-neutral-600">No se encontraron registros</p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Intenta ajustar los filtros de búsqueda o exportar los registros.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r) => {
                  const isSelected = selectedIds.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-neutral-50/70 transition-colors ${
                        isSelected ? 'bg-neutral-50' : ''
                      }`}
                    >
                      {canDelete && (
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleToggleRow(r.id)}
                            className="text-neutral-400 hover:text-neutral-900"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-neutral-900" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-500 truncate max-w-[220px]" title={r.concatenar}>
                        {r.concatenar}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-700 whitespace-nowrap">
                        {r.ciudad}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-neutral-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{r.estacion}</span>
                          {onNavigateToModule1 && (
                            <button
                              type="button"
                              onClick={() => onNavigateToModule1(r.estacion)}
                              className="text-[10px] text-cyan-700 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors inline-flex items-center gap-0.5 font-sans"
                              title={`Abrir formato Módulo 1 para evaluar ${r.estacion}`}
                            >
                              <span>Ver M1</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center text-neutral-600 font-mono text-[11px] whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <span>{r.mes}</span>
                          {onNavigateToMatrix && (
                            <button
                              type="button"
                              onClick={() => onNavigateToMatrix(r.mes as MonthName)}
                              className="text-[9px] text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1 py-0.2 rounded cursor-pointer transition-colors font-sans"
                              title={`Ver ${r.mes} en Matriz General`}
                            >
                              Matriz
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center text-neutral-600 font-mono tabular-nums">
                        {r.anio}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-800 leading-snug">
                        {r.punto}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                        {(() => {
                          const matchItem = RUBRO_ITEMS.find((it) =>
                            r.punto.toLowerCase().includes(it.description.slice(0, 25).toLowerCase())
                          );
                          const maxPts = matchItem ? matchItem.maxPoints : 5;
                          const cellFmt = getScoreCellFormat(r.calificacion, maxPts, matchItem?.isInformative);
                          return (
                            <span
                              className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded text-xs ${cellFmt.bgClass} ${cellFmt.textClass}`}
                              title={cellFmt.tooltipText}
                            >
                              {cellFmt.badgeText}
                            </span>
                          );
                        })()}
                      </td>
                      {/* Columna OBSERVACIONES */}
                      <td className="py-2.5 px-3 min-w-[200px] max-w-[320px]">
                        {r.observaciones ? (
                          <div
                            className="bg-amber-50/90 border border-amber-200/90 rounded px-2 py-1 text-[11px] text-amber-900 leading-snug line-clamp-2"
                            title={r.observaciones}
                          >
                            {r.observaciones}
                          </div>
                        ) : (
                          <span className="text-neutral-300 font-mono text-[11px] select-none">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {(() => {
                          const inspCount = r.evidencias?.length || 0;
                          const usrCount = r.userFinalEvidencias?.length || 0;
                          const total = inspCount + usrCount;

                          return (
                            <div className="flex flex-col items-center gap-1">
                              {total > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecordForGallery(r)}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-300 transition-colors shadow-2xs cursor-pointer"
                                  title={`Ver ${total} evidencias fotográficas (${inspCount} auditoría / ${usrCount} respuesta)`}
                                >
                                  <span>{total} Fotos</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecordForGallery(r)}
                                  className="inline-flex items-center gap-1 text-[11px] text-neutral-400 p-1 hover:text-neutral-700 cursor-pointer"
                                  title="Abrir galería de evidencias"
                                >
                                  <span>0</span>
                                </button>
                              )}

                              {/* Cronómetro Badge */}
                              {(r.inspectorSubmittedAt || r.timerFrozen || r.userFinalSubmittedAt) && (
                                <RecordTimerBadge
                                  inspectorSubmittedAt={r.inspectorSubmittedAt}
                                  userFinalSubmittedAt={r.userFinalSubmittedAt}
                                  timerElapsedSeconds={r.timerElapsedSeconds}
                                  timerFrozen={r.timerFrozen}
                                  hasCalificacion={true}
                                  isCompact={true}
                                  variant="badge"
                                />
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEdit(r)}
                              className="px-2 py-0.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded border border-neutral-200 hover:bg-neutral-50"
                              title="Editar registro"
                            >
                              Editar
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setRecordToDeleteSingle(r);
                              setIsConfirmDeleteOpen(true);
                            }}
                            className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                            title="Eliminar registro permanentemente (Memoria, Caché y Supabase)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="py-3 px-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between text-xs text-neutral-600">
            <span>
              Página <strong className="text-neutral-900 font-mono">{currentPage}</strong> de{' '}
              <strong className="text-neutral-900 font-mono">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-neutral-300 rounded bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                Anterior
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 border border-neutral-300 rounded bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Record Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg border border-neutral-200 p-6 max-w-lg w-full shadow-lg">
            <h3 className="text-base font-bold text-neutral-950 mb-1">
              {editingRecord ? 'Editar Registro de Evaluación' : 'Nuevo Registro de Evaluación'}
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Ingresa los datos para registrar la calificación del punto inspeccionado.
            </p>

            <form onSubmit={handleSaveForm} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Ciudad / Región
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ciudad}
                    onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Estación
                  </label>
                  <select
                    value={formData.estacion}
                    onChange={(e) => setFormData({ ...formData, estacion: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded bg-white"
                  >
                    {stations.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Mes de Revisión
                  </label>
                  <select
                    value={formData.mes}
                    onChange={(e) => setFormData({ ...formData, mes: e.target.value as MonthName })}
                    className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded bg-white"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Año
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.anio}
                    onChange={(e) => setFormData({ ...formData, anio: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Punto a Revisar
                </label>
                <textarea
                  required
                  rows={2}
                  value={formData.punto}
                  onChange={(e) => setFormData({ ...formData, punto: e.target.value })}
                  placeholder="Descripción del punto inspeccionado..."
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Calificación (Número, N/A, o texto)
                </label>
                <input
                  type="text"
                  required
                  value={formData.calificacion}
                  onChange={(e) => setFormData({ ...formData, calificacion: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Observaciones / Hallazgos (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Notas, hallazgos o recomendaciones de la inspección..."
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-neutral-950 hover:bg-neutral-800 rounded transition-colors"
                >
                  {editingRecord ? 'Actualizar Registro' : 'Crear Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Evidence Gallery Modal */}
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
        />
      )}
      {/* Floating Bottom Bar when items are selected */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-neutral-900 text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-neutral-700 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="font-bold flex items-center gap-1.5 text-neutral-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            {selectedIds.size} de {filteredRecords.length} seleccionados
          </span>
          <span className="text-neutral-600">|</span>
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="text-cyan-300 hover:text-cyan-200 underline cursor-pointer text-xs font-semibold"
          >
            Seleccionar todos ({filteredRecords.length})
          </button>
          <span className="text-neutral-600">·</span>
          <button
            type="button"
            onClick={handleClearSelection}
            className="text-neutral-400 hover:text-white underline cursor-pointer text-xs"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={handleOpenConfirmDelete}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full transition-colors cursor-pointer shadow-md"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Borrar ({selectedIds.size})</span>
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
                  {recordToDeleteSingle ? 'Eliminar Registro' : 'Confirmar Eliminación Permanente'}
                </h3>
                <p className="text-xs text-neutral-500">
                  Módulo 2 · {entityLabel}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-neutral-700 bg-neutral-50 p-3.5 rounded-lg border border-neutral-200">
              <p>
                {recordToDeleteSingle ? (
                  <>
                    Estás a punto de eliminar el registro de{' '}
                    <strong className="text-neutral-900 font-bold">{recordToDeleteSingle.estacion}</strong> (
                    {recordToDeleteSingle.mes} {recordToDeleteSingle.anio}):
                    <br />
                    <span className="font-medium text-neutral-600 block mt-1">
                      {recordToDeleteSingle.punto}
                    </span>
                  </>
                ) : (
                  <>
                    Estás a punto de eliminar <strong className="text-red-700 font-bold">{selectedIds.size}</strong>{' '}
                    registro(s) seleccionado(s).
                  </>
                )}
              </p>
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
                Esta acción te permitirá subir nuevos archivos Excel limpios sin conflictos.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmDeleteOpen(false);
                  setRecordToDeleteSingle(null);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Sí, Eliminar {recordToDeleteSingle ? '1' : selectedIds.size} Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Vaciar Base de Datos Completa */}
      {isConfirmClearAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Vaciar Base de Datos ({entityLabel}s)
                </h3>
                <p className="text-xs text-red-600 font-semibold">
                  Borrado permanente de registros de prueba
                </p>
              </div>
            </div>

            <div className="text-xs text-neutral-600 space-y-2 mb-6 bg-red-50/70 p-4 rounded-xl border border-red-200">
              <p className="font-semibold text-neutral-800">
                ¿Estás seguro de que deseas eliminar permanentemente <strong>TODOS los registros</strong> ({records.length} registros) de la base de datos de <strong>{entityLabel}s</strong>?
              </p>
              <ul className="space-y-1.5 pt-1 text-neutral-700">
                <li className="flex items-center gap-1.5">
                  <span className="text-red-600 font-bold">✓</span> Se vaciará la tabla completa en <strong>Supabase</strong>.
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-red-600 font-bold">✓</span> Se limpiará el caché y memoria del navegador (0 registros).
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-red-600 font-bold">✓</span> Podrás importar tus archivos Excel reales desde cero.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmClearAllOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmClearAllOpen(false);
                  onClearAllRecords?.();
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, vaciar base de datos</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
