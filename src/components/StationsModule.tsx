import React, { useState, useMemo, useEffect } from 'react';
import { StationMaster } from '../types';
import { INITIAL_STATION_MASTERS } from '../data/initialData';
import { Search, Plus, Download, ChevronRight, X, Building2, Trash2, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface StationsModuleProps {
  onSelectStationToInspect: (stationName: string) => void;
  entityType?: 'estaciones' | 'plantas';
  title?: string;
  entityLabel?: string;
  pluralLabel?: string;
  initialMasters?: StationMaster[];
  storageKey?: string;
  codePrefix?: string;
  allowedStates?: string[];
  onDeleteStations?: (stationNames: string[], stationCodes: string[]) => void;
}

export const StationsModule: React.FC<StationsModuleProps> = ({
  onSelectStationToInspect,
  entityType = 'estaciones',
  title = 'Estaciones',
  entityLabel = 'Estación',
  pluralLabel = 'Estaciones',
  initialMasters = [],
  storageKey = 'evaluaciones_station_masters_v1',
  codePrefix = 'GAS-',
  allowedStates,
  onDeleteStations,
}) => {
  const [stationsList, setStationsList] = useState<StationMaster[]>(() => {
    try {
      const isPurged = localStorage.getItem('evaluaciones_records_purged') === 'true';
      if (isPurged) return [];
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return initialMasters || [];
  });

  // Keep stationsList in sync with incoming initialMasters (e.g. from Excel imports or purges)
  useEffect(() => {
    if (initialMasters !== undefined) {
      setStationsList(initialMasters);
    }
  }, [initialMasters]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEstado, setSelectedEstado] = useState('Todos los estados');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Selecciones múltiples para borrado
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [stationToDeleteSingle, setStationToDeleteSingle] = useState<StationMaster | null>(null);
  const [lastDeletedCount, setLastDeletedCount] = useState<number | null>(null);

  // New station form
  const [newStation, setNewStation] = useState({
    codigo: '',
    nombre: '',
    estado: 'Nuevo León',
    ciudad: '',
    calificacion: 85,
    estatus: 'Cumple' as const,
  });

  // Effective list considering allowedStates permissions
  const effectiveStationsList = useMemo(() => {
    if (!allowedStates || allowedStates.length === 0) return stationsList;
    const lower = allowedStates.map((s) => s.trim().toLowerCase());
    return stationsList.filter((s) => lower.includes(s.estado.trim().toLowerCase()));
  }, [stationsList, allowedStates]);

  // Unique list of states
  const uniqueStates = useMemo(() => {
    const set = new Set<string>();
    effectiveStationsList.forEach((s) => set.add(s.estado));
    return ['Todos los estados', ...Array.from(set).sort()];
  }, [effectiveStationsList]);

  // Filtered stations
  const filteredStations = useMemo(() => {
    return effectiveStationsList.filter((s) => {
      const matchSearch =
        searchTerm === '' ||
        s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.ciudad.toLowerCase().includes(searchTerm.toLowerCase());

      const matchState =
        selectedEstado === 'Todos los estados' || s.estado === selectedEstado;

      return matchSearch && matchState;
    });
  }, [effectiveStationsList, searchTerm, selectedEstado]);

  const handleCreateStation = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newStation.codigo.trim() || `${codePrefix}0${stationsList.length + 1}`;
    const entry: StationMaster = {
      codigo: code,
      nombre: newStation.nombre.trim(),
      estado: newStation.estado,
      ciudad: newStation.ciudad.trim() || newStation.estado,
      calificacion: Number(newStation.calificacion),
      estatus:
        Number(newStation.calificacion) >= 85
          ? 'Cumple'
          : Number(newStation.calificacion) >= 80
          ? 'Observación'
          : 'Crítico',
      evaluacionesCerradas: 1,
      ultimoPeriodo: 'Septiembre 2026',
    };

    const next = [entry, ...stationsList];
    setStationsList(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (err) {
      console.error(err);
    }
    setIsNewModalOpen(false);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Código', entityLabel, 'Estado', 'Ciudad', 'Calificación', 'Estatus'],
      ...filteredStations.map((s) => [
        s.codigo,
        s.nombre,
        s.estado,
        s.ciudad,
        s.calificacion,
        s.estatus,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, pluralLabel);
    XLSX.writeFile(wb, `${pluralLabel}_Republica_Mexicana.xlsx`);
  };

  const handleToggleSelectAllVisible = () => {
    const allCodes = filteredStations.map((s) => s.codigo);
    if (selectedCodes.size === allCodes.length && allCodes.length > 0) {
      setSelectedCodes(new Set());
    } else {
      setSelectedCodes(new Set(allCodes));
    }
  };

  const handleToggleSelectOne = (code: string) => {
    const next = new Set(selectedCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedCodes(next);
  };

  const handleClearSelection = () => {
    setSelectedCodes(new Set());
  };

  const handleOpenDeleteSelected = () => {
    if (selectedCodes.size === 0) return;
    setStationToDeleteSingle(null);
    setIsConfirmDeleteOpen(true);
  };

  const handleOpenDeleteSingle = (station: StationMaster) => {
    setStationToDeleteSingle(station);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    const codesToDelete = stationToDeleteSingle
      ? [stationToDeleteSingle.codigo]
      : Array.from(selectedCodes);
    if (codesToDelete.length === 0) return;

    const codeSet = new Set(codesToDelete);
    const stationsBeingDeleted = stationsList.filter((s) => codeSet.has(s.codigo));
    const namesBeingDeleted = stationsBeingDeleted.map((s) => s.nombre);

    const next = stationsList.filter((s) => !codeSet.has(s.codigo));
    setStationsList(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (e) {
      console.error(e);
    }

    if (onDeleteStations) {
      onDeleteStations(namesBeingDeleted, codesToDelete);
    }

    setLastDeletedCount(codesToDelete.length);
    setSelectedCodes(new Set());
    setStationToDeleteSingle(null);
    setIsConfirmDeleteOpen(false);
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Registro de {pluralLabel.toLowerCase()} por estado de la República Mexicana y resultados de evaluación.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botón para seleccionar todo / borrar */}
          <button
            type="button"
            onClick={handleToggleSelectAllVisible}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-300 rounded shadow-xs transition-colors cursor-pointer"
            title="Seleccionar desde una hasta todas las entidades"
          >
            <CheckSquare className="w-3.5 h-3.5 text-neutral-600" />
            <span>
              {selectedCodes.size === filteredStations.length && filteredStations.length > 0
                ? 'Deseleccionar todas'
                : `Seleccionar todas (${filteredStations.length})`}
            </span>
          </button>

          {selectedCodes.size > 0 && (
            <button
              type="button"
              onClick={handleOpenDeleteSelected}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded shadow-xs transition-colors cursor-pointer animate-pulse"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Borrar seleccionadas ({selectedCodes.size})</span>
            </button>
          )}

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar {entityLabel}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Lista (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Banner de eliminación exitosa */}
      {lastDeletedCount !== null && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 text-emerald-900 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              <strong>{lastDeletedCount} {pluralLabel.toLowerCase()} eliminadas exitosamente</strong> del directorio y memoria local.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLastDeletedCount(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Card with Filter Bar & Table */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-xs max-w-full overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Buscar ${entityLabel.toLowerCase()} o código`}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:border-[#0e7490] focus:ring-1 focus:ring-[#0e7490] transition-colors"
            />
          </div>

          {/* State Select Dropdown with teal border matching Image 2 */}
          <div className="w-full sm:w-56">
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-medium border-2 border-[#0e7490] rounded-lg bg-white text-neutral-900 focus:outline-none"
            >
              {uniqueStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action bar for multi-selection */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-1 mb-2 text-xs border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSelectAllVisible}
              className="text-neutral-700 hover:text-neutral-950 font-semibold underline cursor-pointer text-xs"
            >
              {selectedCodes.size === filteredStations.length && filteredStations.length > 0
                ? 'Deseleccionar todas'
                : `Seleccionar todas (${filteredStations.length})`}
            </button>
            {selectedCodes.size > 0 && (
              <>
                <span className="text-neutral-300">·</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-neutral-500 hover:text-neutral-800 cursor-pointer text-xs"
                >
                  Limpiar selección
                </button>
                <span className="text-neutral-950 font-bold bg-neutral-100 px-2 py-0.5 rounded ml-1">
                  {selectedCodes.size} seleccionadas
                </span>
              </>
            )}
          </div>

          {selectedCodes.size > 0 && (
            <button
              type="button"
              onClick={handleOpenDeleteSelected}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded shadow-xs transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Borrar {selectedCodes.size} {pluralLabel.toLowerCase()}</span>
            </button>
          )}
        </div>

        {/* Stations Table matching Image 2 layout */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 font-semibold text-xs">
                {/* Header Checkbox */}
                <th className="py-3 px-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleToggleSelectAllVisible}
                    className="text-neutral-500 hover:text-neutral-900 cursor-pointer"
                    title="Seleccionar todas las visibles"
                  >
                    {selectedCodes.size === filteredStations.length && filteredStations.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-neutral-900" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4 w-32">Código</th>
                <th className="py-3 px-4 min-w-[200px]">{entityLabel}</th>
                <th className="py-3 px-4 min-w-[150px]">Estado</th>
                <th className="py-3 px-4 w-28 text-center">Calificación</th>
                <th className="py-3 px-4 w-32 text-center">Estatus</th>
                <th className="py-3 px-3 w-20 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-800">
              {filteredStations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs">
                    <p className="font-semibold text-neutral-600 mb-1">
                      No hay {pluralLabel.toLowerCase()} registradas actualmente
                    </p>
                    <p className="text-neutral-400">
                      Los registros se sincronizan automáticamente según los datos importados en el Módulo 1 (Base de Datos).
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStations.map((station) => {
                  const isChecked = selectedCodes.has(station.codigo);
                  return (
                    <tr
                      key={station.codigo}
                      onClick={() => onSelectStationToInspect(station.nombre)}
                      className={`hover:bg-neutral-50/80 transition-colors cursor-pointer group ${
                        isChecked ? 'bg-red-50/40' : ''
                      }`}
                    >
                      {/* Checkbox Cell */}
                      <td
                        className="py-4 px-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectOne(station.codigo);
                        }}
                      >
                        <button
                          type="button"
                          className="text-neutral-400 hover:text-neutral-900 cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-red-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-4 px-4 font-mono font-medium text-neutral-600 text-xs">
                        {station.codigo}
                      </td>
                      <td className="py-4 px-4 font-medium text-neutral-950">
                        {station.nombre}
                      </td>
                      <td className="py-4 px-4 text-neutral-600">
                        {station.estado}
                      </td>
                      <td className="py-4 px-4 text-center font-mono font-bold text-neutral-900 tabular-nums">
                        {station.calificacion}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            station.estatus === 'Cumple'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : station.estatus === 'Observación'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {station.estatus}
                        </span>
                      </td>
                      <td
                        className="py-4 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteSingle(station)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={`Eliminar ${entityLabel.toLowerCase()} permanentemente`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectStationToInspect(station.nombre)}
                            className="p-1 text-neutral-300 hover:text-neutral-700 group-hover:text-neutral-700 transition-colors"
                            title={`Ver en Módulo 2 (Por ${entityLabel})`}
                          >
                            <ChevronRight className="w-4 h-4" />
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

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400">
          <span>
            Mostrando {filteredStations.length} de {stationsList.length} {pluralLabel.toLowerCase()}
          </span>
          <span className="font-mono text-[11px]">
            Puedes seleccionar desde 1 hasta todas las {pluralLabel.toLowerCase()} para borrarlas o inspeccionarlas.
          </span>
        </div>
      </div>

      {/* Floating Bottom Bar when items are selected */}
      {selectedCodes.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-neutral-900 text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-neutral-700 text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="font-bold flex items-center gap-1.5 text-neutral-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            {selectedCodes.size} {pluralLabel.toLowerCase()} seleccionadas
          </span>
          <span className="text-neutral-600">|</span>
          <button
            type="button"
            onClick={handleClearSelection}
            className="text-neutral-300 hover:text-white underline cursor-pointer text-xs"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={handleOpenDeleteSelected}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full transition-colors cursor-pointer shadow-md"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Borrar ({selectedCodes.size})</span>
          </button>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-neutral-300 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600 pb-2 border-b border-neutral-100">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Eliminar {stationToDeleteSingle ? entityLabel : `${selectedCodes.size} ${pluralLabel}`}
                </h3>
                <p className="text-xs text-neutral-500">
                  Esta acción es irreversible
                </p>
              </div>
            </div>

            <div className="text-xs text-neutral-700 space-y-2">
              <p>
                {stationToDeleteSingle ? (
                  <>
                    ¿Estás seguro de que deseas eliminar permanentemente{' '}
                    <strong className="text-neutral-950 font-bold">{stationToDeleteSingle.nombre}</strong> (
                    {stationToDeleteSingle.codigo})?
                  </>
                ) : (
                  <>
                    Estás a punto de eliminar <strong className="text-red-700 font-bold">{selectedCodes.size}</strong>{' '}
                    {pluralLabel.toLowerCase()} del directorio.
                  </>
                )}
              </p>
              <div className="p-2.5 bg-neutral-50 rounded border border-neutral-200 text-[11px] text-neutral-600">
                ℹ️ También se eliminarán sus registros de evaluación correspondientes en memoria, caché local y Supabase.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmDeleteOpen(false);
                  setStationToDeleteSingle(null);
                }}
                className="px-4 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  Sí, Eliminar {stationToDeleteSingle ? '1' : selectedCodes.size}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Station Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-neutral-300 p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
              <h3 className="text-base font-bold text-neutral-900">
                Registrar Nueva Estación
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStation} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Código (Ej. GAS-088)
                </label>
                <input
                  type="text"
                  value={newStation.codigo}
                  onChange={(e) => setNewStation({ ...newStation, codigo: e.target.value })}
                  placeholder="GAS-088"
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nombre de la Estación
                </label>
                <input
                  type="text"
                  required
                  value={newStation.nombre}
                  onChange={(e) => setNewStation({ ...newStation, nombre: e.target.value })}
                  placeholder="Estación..."
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Estado de la República
                  </label>
                  <select
                    value={newStation.estado}
                    onChange={(e) => setNewStation({ ...newStation, estado: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded bg-white"
                  >
                    <option value="Nuevo León">Nuevo León</option>
                    <option value="Jalisco">Jalisco</option>
                    <option value="Guanajuato">Guanajuato</option>
                    <option value="Puebla">Puebla</option>
                    <option value="Sinaloa">Sinaloa</option>
                    <option value="Chihuahua">Chihuahua</option>
                    <option value="Veracruz">Veracruz</option>
                    <option value="México">México</option>
                    <option value="Coahuila">Coahuila</option>
                    <option value="Sonora">Sonora</option>
                    <option value="Querétaro">Querétaro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Calificación Inicial (0-100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newStation.calificacion}
                    onChange={(e) => setNewStation({ ...newStation, calificacion: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Ciudad o Municipio
                </label>
                <input
                  type="text"
                  value={newStation.ciudad}
                  onChange={(e) => setNewStation({ ...newStation, ciudad: e.target.value })}
                  placeholder="Ciudad..."
                  className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-neutral-950 hover:bg-neutral-800 rounded transition-colors"
                >
                  Guardar Estación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
