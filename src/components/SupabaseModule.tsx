import React, { useState, useEffect, useMemo } from 'react';
import { StationEvaluationRecord, UserSession } from '../types';
import {
  SUPABASE_CONFIG,
  checkSupabaseHealth,
  SupabaseHealthResult,
  fetchSupabaseEvaluationRecords,
  deleteSupabaseRecord,
  deleteSupabaseRecords,
  deleteAllSupabaseRecords,
  syncRecordsToSupabase,
} from '../lib/supabaseClient';
import { generateSupabaseSqlScript } from '../lib/supabaseSqlGenerator';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  UploadCloud,
  DownloadCloud,
  Search,
  Code2,
  TableProperties,
  KeyRound,
  ShieldAlert,
  Server,
  Activity,
  Filter,
} from 'lucide-react';

interface SupabaseModuleProps {
  localRecords: StationEvaluationRecord[];
  onSyncLocalRecords?: (newRecords: StationEvaluationRecord[]) => void;
  currentUser: UserSession;
  showToast?: (message: string) => void;
}

export const SupabaseModule: React.FC<SupabaseModuleProps> = ({
  localRecords,
  onSyncLocalRecords,
  currentUser,
  showToast,
}) => {
  // Navigation tabs within Supabase module
  const [activeTab, setActiveTab] = useState<'monitor' | 'records' | 'sql' | 'credentials'>('records');

  // Health and connection state
  const [health, setHealth] = useState<SupabaseHealthResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Supabase records state
  const [supabaseRecords, setSupabaseRecords] = useState<StationEvaluationRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [recordsSource, setRecordsSource] = useState<'supabase' | 'local'>('supabase');

  // Selection state for individual and global deletion
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStation, setFilterStation] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState('ALL');

  // Deletion modals state
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDeleteSelected, setShowConfirmDeleteSelected] = useState(false);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Credentials visibility
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Error monitor detail message
  const [lastOperationError, setLastOperationError] = useState<string | null>(null);

  // SQL Script
  const sqlScript = useMemo(() => generateSupabaseSqlScript(), []);

  // Run health check and load records on mount
  useEffect(() => {
    handleRunHealthCheck();
    handleLoadSupabaseRecords();
  }, []);

  const handleCopy = (text: string, keyName: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(keyName);
      setTimeout(() => setCopiedKey(null), 3000);
      showToast?.(`Copiado al portapapeles: ${keyName}`);
    }
  };

  const handleRunHealthCheck = async () => {
    setIsCheckingHealth(true);
    setLastOperationError(null);
    try {
      const res = await checkSupabaseHealth();
      setHealth(res);
      if (res.errorDetail) {
        setLastOperationError(res.errorDetail);
      }
    } catch (err: any) {
      setLastOperationError(err?.message || 'Error al conectar con Supabase');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleLoadSupabaseRecords = async () => {
    setIsLoadingRecords(true);
    setLastOperationError(null);
    try {
      const { records, error } = await fetchSupabaseEvaluationRecords();
      if (error) {
        setLastOperationError(
          `Error al consultar registros de Supabase: ${error}. Si la tabla no existe aún, ejecuta el script SQL provisto en la pestaña SQL.`
        );
        // Fallback to local records if supabase table is not ready
        setSupabaseRecords([]);
      } else {
        setSupabaseRecords(records);
        setSelectedIds(new Set());
      }
    } catch (err: any) {
      setLastOperationError(err?.message || 'Error al cargar registros');
    } finally {
      setIsLoadingRecords(false);
    }
  };

  // Records to display depending on selected source tab
  const activeRecordsList = recordsSource === 'supabase' ? supabaseRecords : localRecords;

  // Filtered records
  const filteredRecords = useMemo(() => {
    return activeRecordsList.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        r.estacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.punto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.ciudad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.calificacion).includes(searchTerm);

      const matchesStation = filterStation === 'ALL' || r.estacion === filterStation;
      const matchesMonth = filterMonth === 'ALL' || r.mes === filterMonth;

      return matchesSearch && matchesStation && matchesMonth;
    });
  }, [activeRecordsList, searchTerm, filterStation, filterMonth]);

  // Unique stations for filtering
  const uniqueStations = useMemo(() => {
    const set = new Set(activeRecordsList.map((r) => r.estacion).filter(Boolean));
    return Array.from(set).sort();
  }, [activeRecordsList]);

  // Individual selection toggles
  const handleToggleSelectRecord = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Global selection toggle (all visible/filtered)
  const isAllFilteredSelected =
    filteredRecords.length > 0 && filteredRecords.every((r) => selectedIds.has(r.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Deselect visible
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredRecords.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      // Select all visible
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredRecords.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  // Execute deletion of selected records
  const handleExecuteDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    setLastOperationError(null);

    const idsToDelete = Array.from(selectedIds);

    if (recordsSource === 'supabase') {
      const { success, error } = await deleteSupabaseRecords(idsToDelete);
      if (!success) {
        setLastOperationError(`Error al eliminar registros de Supabase: ${error}`);
        showToast?.(`Error al eliminar en Supabase: ${error}`);
      } else {
        setSupabaseRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)));
        setSelectedIds(new Set());
        showToast?.(`${idsToDelete.length} registros eliminados exitosamente de Supabase.`);
        handleRunHealthCheck();
      }
    } else {
      // Local source
      if (onSyncLocalRecords) {
        const remaining = localRecords.filter((r) => !selectedIds.has(r.id));
        onSyncLocalRecords(remaining);
      }
      setSelectedIds(new Set());
      showToast?.(`${idsToDelete.length} registros locales eliminados.`);
    }

    setIsDeleting(false);
    setShowConfirmDeleteSelected(false);
  };

  // Execute global deletion (all records in table)
  const handleExecuteDeleteAll = async () => {
    setIsDeleting(true);
    setLastOperationError(null);

    if (recordsSource === 'supabase') {
      const { success, error } = await deleteAllSupabaseRecords();
      if (!success) {
        setLastOperationError(`Error al vaciar registros de Supabase: ${error}`);
        showToast?.(`Error: ${error}`);
      } else {
        setSupabaseRecords([]);
        setSelectedIds(new Set());
        if (onSyncLocalRecords) {
          onSyncLocalRecords([]);
        }
        try {
          localStorage.setItem('evaluaciones_records_v1', JSON.stringify([]));
          sessionStorage.setItem('evaluaciones_records_v1', JSON.stringify([]));
          localStorage.setItem('evaluaciones_records_purged', 'true');
          sessionStorage.setItem('evaluaciones_records_purged', 'true');
          localStorage.removeItem('evaluaciones_deleted_record_ids_v1');
          sessionStorage.removeItem('evaluaciones_deleted_record_ids_v1');
        } catch (e) {
          console.error(e);
        }
        showToast?.('Todos los registros fueron eliminados de Supabase y de la memoria del sistema.');
        handleRunHealthCheck();
      }
    } else {
      if (onSyncLocalRecords) {
        onSyncLocalRecords([]);
      }
      try {
        localStorage.setItem('evaluaciones_records_v1', JSON.stringify([]));
        sessionStorage.setItem('evaluaciones_records_v1', JSON.stringify([]));
        localStorage.setItem('evaluaciones_records_purged', 'true');
        sessionStorage.setItem('evaluaciones_records_purged', 'true');
      } catch (e) {
        console.error(e);
      }
      setSelectedIds(new Set());
      showToast?.('Todos los registros locales fueron eliminados.');
    }

    setIsDeleting(false);
    setShowConfirmDeleteAll(false);
  };

  // Synchronize local records to Supabase
  const handleSyncLocalToSupabase = async () => {
    setIsSyncing(true);
    setLastOperationError(null);
    try {
      const { success, count, error } = await syncRecordsToSupabase(localRecords);
      if (!success) {
        setLastOperationError(`Error al sincronizar con Supabase: ${error}`);
        showToast?.(`Fallo al sincronizar: ${error}`);
      } else {
        showToast?.(`Sincronización exitosa: ${count} registros subidos a Supabase.`);
        await handleLoadSupabaseRecords();
        await handleRunHealthCheck();
      }
    } catch (err: any) {
      setLastOperationError(err?.message || 'Error en sincronización');
    } finally {
      setIsSyncing(false);
    }
  };

  // Import Supabase records to Local app state
  const handleImportSupabaseToLocal = () => {
    if (supabaseRecords.length === 0) {
      showToast?.('No hay registros en Supabase para importar a la memoria local.');
      return;
    }
    if (onSyncLocalRecords) {
      onSyncLocalRecords(supabaseRecords);
      showToast?.(`${supabaseRecords.length} registros de Supabase importados a la aplicación.`);
    }
  };

  return (
    <div className="space-y-5 max-w-full overflow-hidden">
      {/* Header Banner */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#0c323f] text-white">
                <Database className="w-5 h-5 text-cyan-400" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-neutral-950 flex items-center gap-2">
                <span>Módulo Supabase Database</span>
                <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded-full bg-cyan-100 text-[#0c323f]">
                  REST API v1
                </span>
              </h2>
            </div>
            <p className="text-xs text-neutral-500">
              Gestión centralizada de la base de datos PostgreSQL en la nube (Proyecto:{' '}
              <strong className="text-neutral-800 font-mono">yybannuorhqsykqagkwz</strong>).
            </p>
          </div>

          {/* Quick Monitor Status Badge & Ping Button */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                health?.connected && health.tableExists
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : health?.connected && !health.tableExists
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.connected && health.tableExists
                    ? 'bg-emerald-500 animate-pulse'
                    : health?.connected && !health.tableExists
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
              />
              <span>
                {health?.connected && health.tableExists
                  ? `Conectado (${health.latencyMs}ms · ${health.recordsCount} registros)`
                  : health?.connected && !health.tableExists
                  ? 'Servidor Activo (Tabla pendiente)'
                  : isCheckingHealth
                  ? 'Verificando...'
                  : 'Desconectado / Error'}
              </span>
            </div>

            <button
              onClick={handleRunHealthCheck}
              disabled={isCheckingHealth}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors border border-neutral-300 disabled:opacity-50"
              title="Probar conexión con Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              <span>{isCheckingHealth ? 'Probando...' : 'Probar Conexión'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('records')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'records'
                ? 'bg-[#0c323f] text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            <span>Registros de la Base ({filteredRecords.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'monitor'
                ? 'bg-[#0c323f] text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Monitor de Conexión</span>
          </button>

          <button
            onClick={() => setActiveTab('credentials')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'credentials'
                ? 'bg-[#0c323f] text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Credenciales de Acceso Supabase</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'sql'
                ? 'bg-[#0c323f] text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Script SQL Inicializador</span>
          </button>
        </div>
      </div>

      {/* ERROR MONITOR ALERT BANNER (If there is a failure, displays exact reason as requested) */}
      {lastOperationError && (
        <div className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-4 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs space-y-1">
              <strong className="font-semibold block text-red-800 text-sm">
                Diagnóstico del Monitor: Falla al comunicar o guardar en Supabase
              </strong>
              <p className="leading-relaxed text-red-700 font-mono bg-white/70 p-2 rounded border border-red-200 break-words">
                {lastOperationError}
              </p>
              <div className="pt-1 text-[11px] text-red-600 flex items-center gap-2">
                <span>¿Cómo solucionarlo?</span>
                <button
                  onClick={() => setActiveTab('sql')}
                  className="underline font-bold text-red-800 hover:text-red-950"
                >
                  Copiar script SQL y correrlo en Supabase SQL Editor →
                </button>
              </div>
            </div>
            <button
              onClick={() => setLastOperationError(null)}
              className="text-red-400 hover:text-red-700 text-xs px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: REGISTROS & GESTIÓN DE SELECCIÓN INDIVIDUAL Y GLOBAL                */}
      {/* ========================================================================= */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Controls Bar: Source Selector + Search + Actions */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Data Source Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-neutral-600">Fuente activa:</span>
                <div className="inline-flex rounded-lg border border-neutral-300 p-0.5 bg-neutral-100 text-xs font-medium">
                  <button
                    onClick={() => {
                      setRecordsSource('supabase');
                      handleLoadSupabaseRecords();
                    }}
                    className={`px-3 py-1 rounded-md transition-all ${
                      recordsSource === 'supabase'
                        ? 'bg-white text-neutral-900 shadow-xs font-bold'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Nube Supabase ({supabaseRecords.length})
                  </button>
                  <button
                    onClick={() => {
                      setRecordsSource('local');
                      setSelectedIds(new Set());
                    }}
                    className={`px-3 py-1 rounded-md transition-all ${
                      recordsSource === 'local'
                        ? 'bg-white text-neutral-900 shadow-xs font-bold'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Memoria Local ({localRecords.length})
                  </button>
                </div>

                <button
                  onClick={handleLoadSupabaseRecords}
                  disabled={isLoadingRecords}
                  className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded border border-neutral-200"
                  title="Recargar datos de Supabase"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecords ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Action Buttons: Sync to Supabase & Delete Batch */}
              <div className="flex items-center gap-2 flex-wrap">
                {recordsSource === 'supabase' ? (
                  <button
                    onClick={handleSyncLocalToSupabase}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0c323f] hover:bg-[#164e5e] rounded-lg transition-colors shadow-xs disabled:opacity-50"
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                    <span>{isSyncing ? 'Subiendo...' : 'Subir Locales a Supabase'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleImportSupabaseToLocal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors border border-neutral-300"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Importar desde Supabase</span>
                  </button>
                )}

                {/* Global Delete All Trigger */}
                <button
                  onClick={() => setShowConfirmDeleteAll(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                  title="Borrar todos los registros de la base"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar Base</span>
                </button>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-neutral-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar por estación, punto o valor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:bg-white focus:outline-none focus:border-neutral-900"
                />
              </div>

              <div>
                <select
                  value={filterStation}
                  onChange={(e) => setFilterStation(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:bg-white focus:outline-none font-medium"
                >
                  <option value="ALL">Todas las estaciones ({uniqueStations.length})</option>
                  {uniqueStations.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:bg-white focus:outline-none font-medium"
                >
                  <option value="ALL">Todos los meses</option>
                  {[
                    'ENERO',
                    'FEBRERO',
                    'MARZO',
                    'ABRIL',
                    'MAYO',
                    'JUNIO',
                    'JULIO',
                    'AGOSTO',
                    'SEPTIEMBRE',
                    'OCTUBRE',
                    'NOVIEMBRE',
                    'DICIEMBRE',
                  ].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selection Status Action Bar */}
            {selectedIds.size > 0 && (
              <div className="p-2.5 bg-neutral-900 text-white rounded-lg flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">
                    {selectedIds.size} registro(s) seleccionado(s) de {filteredRecords.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-neutral-400 hover:text-white text-xs underline px-2"
                  >
                    Deseleccionar
                  </button>
                  <button
                    onClick={() => setShowConfirmDeleteSelected(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-xs shadow-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar seleccionados ({selectedIds.size})</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-100 text-neutral-700 sticky top-0 z-10 border-b border-neutral-200 uppercase font-bold text-[10px] tracking-wider">
                  <tr>
                    {/* Header Checkbox for Global Select */}
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={handleToggleSelectAll}
                        className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer"
                        title={
                          isAllFilteredSelected
                            ? 'Deseleccionar todos'
                            : 'Seleccionar todos los registros visibles'
                        }
                      />
                    </th>
                    <th className="py-2.5 px-3">Estación</th>
                    <th className="py-2.5 px-3">Ciudad / Entidad</th>
                    <th className="py-2.5 px-2">Mes</th>
                    <th className="py-2.5 px-3">Punto Evaluado</th>
                    <th className="py-2.5 px-2 text-center">Calificación</th>
                    <th className="py-2.5 px-3">Observaciones</th>
                    <th className="py-2.5 px-2 text-center w-14">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-800">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-500">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <TableProperties className="w-8 h-8 text-neutral-300" />
                          <p className="font-medium text-xs">
                            {recordsSource === 'supabase' && (!health?.tableExists || supabaseRecords.length === 0)
                              ? 'No hay registros en Supabase o la tabla no está creada aún.'
                              : 'No se encontraron registros que coincidan con la búsqueda.'}
                          </p>
                          {recordsSource === 'supabase' && (!health?.tableExists || supabaseRecords.length === 0) && (
                            <div className="flex items-center gap-2 pt-2">
                              <button
                                onClick={handleSyncLocalToSupabase}
                                className="px-3 py-1.5 text-xs font-semibold bg-[#0c323f] text-white rounded-lg hover:bg-[#164e5e]"
                              >
                                Subir {localRecords.length} registros locales a Supabase
                              </button>
                              <button
                                onClick={() => setActiveTab('sql')}
                                className="px-3 py-1.5 text-xs font-medium bg-neutral-100 text-neutral-800 rounded-lg hover:bg-neutral-200"
                              >
                                Ver Script SQL
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => {
                      const isSelected = selectedIds.has(r.id);
                      return (
                        <tr
                          key={r.id}
                          className={`hover:bg-neutral-50 transition-colors ${
                            isSelected ? 'bg-cyan-50/50' : ''
                          }`}
                        >
                          {/* Row Checkbox for Individual Select */}
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectRecord(r.id)}
                              className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer"
                            />
                          </td>

                          <td className="py-2 px-3 font-semibold text-neutral-900 whitespace-nowrap">
                            {r.estacion}
                          </td>

                          <td className="py-2 px-3 text-neutral-500 whitespace-nowrap font-mono text-[11px]">
                            {r.ciudad || '-'}
                          </td>

                          <td className="py-2 px-2 text-neutral-700 font-mono text-[11px] whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                              {r.mes}
                            </span>
                          </td>

                          <td className="py-2 px-3 text-neutral-800 max-w-xs truncate" title={r.punto}>
                            {r.punto}
                          </td>

                          <td className="py-2 px-2 text-center font-mono font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-xs inline-block min-w-[28px] ${
                                Number(r.calificacion) > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.calificacion === 'N/A'
                                  ? 'bg-neutral-100 text-neutral-600'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {r.calificacion}
                            </span>
                          </td>

                          <td className="py-2 px-3 text-neutral-500 text-[11px] max-w-xs truncate" title={r.observaciones}>
                            {r.observaciones || <span className="text-neutral-300 italic">Sin observaciones</span>}
                          </td>

                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            <button
                              onClick={async () => {
                                if (recordsSource === 'supabase') {
                                  const { success, error } = await deleteSupabaseRecord(r.id);
                                  if (success) {
                                    setSupabaseRecords((prev) => prev.filter((item) => item.id !== r.id));
                                    showToast?.('Registro eliminado de Supabase.');
                                  } else {
                                    setLastOperationError(error);
                                    showToast?.(`Error: ${error}`);
                                  }
                                } else {
                                  if (onSyncLocalRecords) {
                                    onSyncLocalRecords(localRecords.filter((item) => item.id !== r.id));
                                    showToast?.('Registro local eliminado.');
                                  }
                                }
                              }}
                              className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors"
                              title="Borrar este registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer info */}
            <div className="p-3 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500 flex items-center justify-between">
              <span>
                Mostrando {filteredRecords.length} de {activeRecordsList.length} registros (Fuente:{' '}
                <strong>{recordsSource === 'supabase' ? 'Supabase Nube' : 'Local'}</strong>)
              </span>
              <span>{selectedIds.size} seleccionados</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONITOR DE CONEXIÓN EN TIEMPO REAL Y DIAGNÓSTICO                    */}
      {/* ========================================================================= */}
      {activeTab === 'monitor' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card: Estado General */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-600" />
                <span>Estado de Comunicación en Tiempo Real</span>
              </h3>
              <span className="text-[11px] font-mono text-neutral-400">
                Último test: {health?.testedAt || 'Pendiente'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-neutral-50 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-neutral-500 font-medium block">Servicio REST</span>
                  <span className="text-sm font-bold text-neutral-900 font-mono">
                    {health?.connected ? 'Activo y Respondiendo' : 'Inactivo / Error'}
                  </span>
                </div>
                <span
                  className={`w-3 h-3 rounded-full ${
                    health?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
              </div>

              <div className="p-3 bg-neutral-50 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-neutral-500 font-medium block">
                    Tabla "evaluaciones_registros"
                  </span>
                  <span className="text-sm font-bold text-neutral-900 font-mono">
                    {health?.tableExists ? 'Presente y Accesible' : 'Pendiente de Crear'}
                  </span>
                </div>
                <span
                  className={`w-3 h-3 rounded-full ${
                    health?.tableExists ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-neutral-50 rounded-lg">
                  <span className="text-[11px] text-neutral-500 font-medium block">Latencia de Red</span>
                  <span className="text-lg font-bold font-mono text-neutral-900">
                    {health?.latencyMs !== undefined ? `${health.latencyMs} ms` : '-'}
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-lg">
                  <span className="text-[11px] text-neutral-500 font-medium block">Total Registros</span>
                  <span className="text-lg font-bold font-mono text-neutral-900">
                    {health?.recordsCount !== undefined ? health.recordsCount : supabaseRecords.length}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleRunHealthCheck}
              disabled={isCheckingHealth}
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#0c323f] hover:bg-[#164e5e] rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              <span>Verificar Conexión Ahora</span>
            </button>
          </div>

          {/* Card: Diagnóstico Detallado */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-600" />
                <span>Detalle Técnico del Endpoint</span>
              </h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-[11px] text-neutral-400 font-mono uppercase block">Project ID</span>
                <span className="font-mono font-semibold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded">
                  {SUPABASE_CONFIG.projectId}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-neutral-400 font-mono uppercase block">API URL</span>
                <span className="font-mono text-neutral-800 break-all bg-neutral-100 px-2 py-0.5 rounded block">
                  {SUPABASE_CONFIG.url}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-neutral-400 font-mono uppercase block">
                  Diagnóstico del Conector
                </span>
                <div
                  className={`p-3 rounded-lg border text-xs font-mono leading-relaxed mt-1 ${
                    health?.connected && health.tableExists
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : health?.connected && !health.tableExists
                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                      : 'bg-red-50 text-red-900 border-red-200'
                  }`}
                >
                  {health?.connected && health.tableExists ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Conexión completamente funcional</span>
                      </div>
                      <p className="text-[11px] text-emerald-700">
                        El cliente de Supabase se comunica correctamente con PostgreSQL. Las consultas SELECT,
                        INSERT, UPDATE y DELETE están habilitadas para la clave anónima.
                      </p>
                    </div>
                  ) : health?.connected && !health.tableExists ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Tabla no encontrada en Supabase</span>
                      </div>
                      <p className="text-[11px] text-amber-700">
                        El proyecto de Supabase está activo, pero la tabla "evaluaciones_registros" aún no se ha
                        creado en la base de datos PostgreSQL.
                      </p>
                      <button
                        onClick={() => setActiveTab('sql')}
                        className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-amber-800 text-white rounded text-[11px] font-bold"
                      >
                        <Code2 className="w-3 h-3" />
                        <span>Ver Script SQL para crearla →</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-red-800">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Error de Conexión</span>
                      </div>
                      <p className="text-[11px] text-red-700">
                        {health?.errorDetail ||
                          'No fue posible alcanzar el host de Supabase. Revisa tu conexión a internet o los parámetros de red.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CREDENCIALES DE ACCESO AL PANEL DE SUPABASE (CONFORME AL BRIEF)    */}
      {/* ========================================================================= */}
      {activeTab === 'credentials' && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
            <div>
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-cyan-600" />
                <span>Credenciales de Acceso al Panel de Supabase</span>
              </h3>
              <p className="text-xs text-neutral-500">
                Usa estas credenciales para acceder al panel oficial de Supabase y administrar la base de datos.
              </p>
            </div>

            <a
              href={SUPABASE_CONFIG.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0c323f] hover:bg-[#164e5e] rounded-lg transition-colors shadow-xs shrink-0"
            >
              <span>Abrir Panel Supabase</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Usuario */}
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1.5">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                Usuario / Correo de Acceso
              </span>
              <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-neutral-200 font-mono text-xs text-neutral-900">
                <span className="font-semibold select-all">{SUPABASE_CONFIG.credentials.user}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(SUPABASE_CONFIG.credentials.user, 'Usuario')}
                  className="p-1 text-neutral-400 hover:text-neutral-800 transition-colors"
                  title="Copiar usuario"
                >
                  {copiedKey === 'Usuario' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Clave con ojito */}
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1.5">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                Clave de Acceso
              </span>
              <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-neutral-200 font-mono text-xs text-neutral-900">
                <span className="font-semibold select-all">
                  {showPassword ? SUPABASE_CONFIG.credentials.pass : '••••••••••••••••'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-neutral-400 hover:text-neutral-800 transition-colors"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(SUPABASE_CONFIG.credentials.pass, 'Contraseña')}
                    className="p-1 text-neutral-400 hover:text-neutral-800 transition-colors"
                    title="Copiar contraseña"
                  >
                    {copiedKey === 'Contraseña' ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Project Name & Project ID */}
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1.5">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                Nombre & ID de Proyecto
              </span>
              <div className="bg-white p-2.5 rounded-lg border border-neutral-200 text-xs space-y-1 font-mono">
                <div>
                  <span className="text-neutral-400">Nombre: </span>
                  <strong className="text-neutral-900">{SUPABASE_CONFIG.projectName}</strong>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                  <div>
                    <span className="text-neutral-400">ID: </span>
                    <strong className="text-neutral-900">{SUPABASE_CONFIG.projectId}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(SUPABASE_CONFIG.projectId, 'Project ID')}
                    className="p-1 text-neutral-400 hover:text-neutral-800"
                  >
                    {copiedKey === 'Project ID' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* REST API URL */}
            <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1.5">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                URL de Endpoint REST
              </span>
              <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-neutral-200 font-mono text-xs text-neutral-900">
                <span className="truncate select-all">{SUPABASE_CONFIG.restUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(SUPABASE_CONFIG.restUrl, 'API URL')}
                  className="p-1 text-neutral-400 hover:text-neutral-800 transition-colors shrink-0"
                  title="Copiar URL"
                >
                  {copiedKey === 'API URL' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Anon / Publishable Key Box */}
          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                API Key Pública (Publishable / Anon Key)
              </span>
              <button
                type="button"
                onClick={() => handleCopy(SUPABASE_CONFIG.anonKey, 'API Key')}
                className="inline-flex items-center gap-1 text-xs text-neutral-700 hover:text-neutral-950 font-medium"
              >
                {copiedKey === 'API Key' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Copiada</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar clave completa</span>
                  </>
                )}
              </button>
            </div>
            <p className="font-mono text-[11px] text-neutral-600 bg-white p-2.5 rounded-lg border border-neutral-200 break-all select-all">
              {SUPABASE_CONFIG.anonKey}
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SCRIPT SQL PARA CORRER EN SUPABASE (SIN BORRAR REGISTROS)          */}
      {/* ========================================================================= */}
      {activeTab === 'sql' && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
            <div>
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <Code2 className="w-5 h-5 text-cyan-600" />
                <span>Script SQL de Actualización Segura (Sin Borrar Registros)</span>
              </h3>
              <p className="text-xs text-neutral-500">
                Ejecuta este código en el <strong>SQL Editor</strong> de Supabase para actualizar columnas,
                índices y políticas conservando intactos todos tus registros existentes.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(sqlScript, 'Script SQL')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0c323f] hover:bg-[#164e5e] rounded-lg transition-colors shadow-xs"
              >
                {copiedKey === 'Script SQL' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>¡SQL Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar SQL Completo</span>
                  </>
                )}
              </button>

              <a
                href={`${SUPABASE_CONFIG.dashboardUrl}/sql`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors border border-neutral-300"
              >
                <span>Ir al SQL Editor</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Step by step guide */}
          <div className="p-3 bg-cyan-50/60 border border-cyan-200 rounded-lg text-xs text-neutral-800 space-y-1">
            <strong className="text-[#0c323f] font-bold block">Instrucciones de Ejecución:</strong>
            <ol className="list-decimal list-inside space-y-0.5 text-neutral-700">
              <li>Haz clic en el botón superior <strong>"Copiar SQL Completo"</strong>.</li>
              <li>Abre el <strong>SQL Editor de Supabase</strong> con tu usuario y clave.</li>
              <li>Pega el código en una nueva consulta (New query) y presiona <strong>RUN</strong>.</li>
              <li>Regresa a este módulo y presiona <strong>"Probar Conexión"</strong>.</li>
            </ol>
          </div>

          {/* Quick migration for avatar column if tables were created previously */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div>
              <strong className="font-bold text-amber-900 block">
                Comando rápido para habilitar Fotos de Perfil en tablas existentes de Supabase:
              </strong>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Si tu tabla de usuarios ya estaba creada, corre esta línea en el SQL Editor para permitir guardar fotos en la nube:
              </p>
              <code className="text-[11px] font-mono text-amber-950 bg-white px-2 py-1 rounded border border-amber-300 mt-1.5 inline-block select-all">
                ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;
              </code>
            </div>
            <button
              type="button"
              onClick={() =>
                handleCopy('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;', 'Comando Avatar')
              }
              className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors"
            >
              {copiedKey === 'Comando Avatar' ? '¡Copiado!' : 'Copiar comando'}
            </button>
          </div>

          {/* SQL Code Viewport */}
          <div className="relative">
            <pre className="bg-[#0b1320] text-cyan-200 font-mono text-[11px] p-4 rounded-xl overflow-x-auto max-h-[500px] leading-relaxed select-all border border-neutral-800">
              {sqlScript}
            </pre>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DELETE SELECTED RECORDS */}
      {showConfirmDeleteSelected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-neutral-200">
            <div className="flex items-center gap-3 text-red-600">
              <span className="p-2 bg-red-100 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-neutral-900 text-base">Eliminar registros seleccionados</h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              ¿Estás seguro de eliminar <strong>{selectedIds.size}</strong> registro(s) de{' '}
              <strong>{recordsSource === 'supabase' ? 'la base de datos de Supabase' : 'la memoria local'}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteSelected(false)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteSelected}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {isDeleting ? 'Eliminando...' : `Sí, eliminar ${selectedIds.size} registros`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: GLOBAL DELETE ALL RECORDS */}
      {showConfirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-neutral-200">
            <div className="flex items-center gap-3 text-red-600">
              <span className="p-2 bg-red-100 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-neutral-900 text-base">VACIAR TODA LA BASE DE DATOS</h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              ATENCIÓN: Estás a punto de borrar <strong>TODOS</strong> los registros de{' '}
              <strong>{recordsSource === 'supabase' ? 'la tabla evaluaciones_registros en Supabase' : 'la aplicación local'}</strong>.
              Todos los datos almacenados serán purgados.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteAll(false)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteAll}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                {isDeleting ? 'Vaciando...' : 'Confirmar y Vaciar Todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
