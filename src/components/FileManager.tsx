import React, { useState } from 'react';
import { ImportedFileRecord, UserSession } from '../types';
import {
  FileSpreadsheet,
  Trash2,
  Upload,
  CheckSquare,
  Square,
  History,
  FileCheck,
  Clock,
  User,
  AlertTriangle,
  Download,
} from 'lucide-react';

interface FileManagerProps {
  files: ImportedFileRecord[];
  user: UserSession;
  onDeleteFiles: (fileIds: string[]) => void;
  onOpenImportModal: () => void;
}

export const FileManager: React.FC<FileManagerProps> = ({
  files,
  user,
  onDeleteFiles,
  onOpenImportModal,
}) => {
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [inspectFile, setInspectFile] = useState<ImportedFileRecord | null>(null);

  const canManageFiles = user.role === 'Admin' || user.role === 'Coordinador' || user.role === 'Administrador';
  const isReadOnly = user.role === 'Usuario final';

  const isAllSelected = files.length > 0 && selectedFileIds.size === files.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(files.map((f) => f.id)));
    }
  };

  const handleToggleFile = (id: string) => {
    const next = new Set(selectedFileIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedFileIds(next);
  };

  const handleDeleteSelected = () => {
    if (selectedFileIds.size === 0) return;
    const count = selectedFileIds.size;
    if (
      window.confirm(
        `¿Estás seguro de que deseas eliminar ${count} archivo(s) seleccionado(s) del historial?`
      )
    ) {
      onDeleteFiles(Array.from(selectedFileIds));
      setSelectedFileIds(new Set());
    }
  };

  const handleDeleteSingle = (id: string, name: string) => {
    if (window.confirm(`¿Deseas eliminar el archivo "${name}" del historial?`)) {
      onDeleteFiles([id]);
      const next = new Set(selectedFileIds);
      next.delete(id);
      setSelectedFileIds(next);
    }
  };

  const handleExecuteDeleteAll = () => {
    onDeleteFiles(files.map((f) => f.id));
    setSelectedFileIds(new Set());
    setConfirmDeleteAll(false);
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Top Card */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 max-w-full overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 mb-1">
              <span>HISTORIAL DE ARCHIVOS</span>
              <span>/</span>
              <span>AUDITORÍA Y GESTIÓN</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-950">
              Historial de Archivos Importados
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Consulta los registros que el administrador ha importado al sistema. Selecciona 1 o todos los archivos para eliminarlos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManageFiles && (
              <button
                onClick={onOpenImportModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-neutral-950 hover:bg-neutral-800 rounded transition-colors shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importar Nuevo Archivo Excel</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-5 pt-4 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 border border-neutral-200 rounded bg-neutral-50/50">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
              Total Archivos en Historial
            </span>
            <span className="text-lg font-bold font-mono text-neutral-900 tabular-nums">
              {files.length}
            </span>
          </div>

          <div className="p-3 border border-neutral-200 rounded bg-neutral-50/50">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
              Registros Procesados
            </span>
            <span className="text-lg font-bold font-mono text-neutral-900 tabular-nums">
              {files.reduce((acc, f) => acc + f.recordsCount, 0).toLocaleString()}
            </span>
          </div>

          <div className="p-3 border border-neutral-200 rounded bg-neutral-50/50">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
              Usuario Activo
            </span>
            <span className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5 mt-0.5">
              <User className="w-3.5 h-3.5 text-neutral-500" />
              <span>{user.name} ({user.username})</span>
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar: Select 1 or All & Delete */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleSelectAll}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-neutral-300 rounded bg-white hover:bg-neutral-50 transition-colors"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-neutral-900" />
            ) : (
              <Square className="w-4 h-4 text-neutral-500" />
            )}
            <span>
              {isAllSelected ? 'Deseleccionar Todos' : 'Seleccionar Todos los Archivos'}
            </span>
          </button>

          <span className="text-neutral-500">
            {selectedFileIds.size > 0 ? (
              <strong className="text-neutral-900">
                {selectedFileIds.size} de {files.length} seleccionados
              </strong>
            ) : (
              <span>Ningún archivo seleccionado</span>
            )}
          </span>
        </div>

        {canManageFiles && (
          <div className="flex items-center gap-2">
            {selectedFileIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Borrar Seleccionados ({selectedFileIds.size})</span>
              </button>
            )}

            {files.length > 0 && (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-red-700 hover:bg-neutral-100 border border-neutral-200 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Borrar Todo el Historial</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Files Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                <th className="py-2.5 px-3 w-10 text-center">
                  <button
                    onClick={handleToggleSelectAll}
                    className="text-neutral-500 hover:text-neutral-900"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-neutral-900" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3 min-w-[240px]">Nombre del Archivo</th>
                <th className="py-2.5 px-3 min-w-[140px]">Módulo Destino</th>
                <th className="py-2.5 px-3 text-center w-28">Registros</th>
                <th className="py-2.5 px-3 text-center w-24">Tamaño</th>
                <th className="py-2.5 px-3 text-center w-36">Fecha de Importación</th>
                <th className="py-2.5 px-3 text-center w-28">Usuario</th>
                <th className="py-2.5 px-3 text-center w-24">Estado</th>
                <th className="py-2.5 px-3 text-center w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-800">
              {files.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    <FileSpreadsheet className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-neutral-600">
                      No hay archivos importados en el historial
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Usa el botón "Importar Nuevo Archivo Excel" para cargar tus formatos de evaluación.
                    </p>
                  </td>
                </tr>
              ) : (
                files.map((file) => {
                  const isSelected = selectedFileIds.has(file.id);
                  const moduleLabel =
                    file.moduleTarget === 'modulo1'
                      ? 'Módulo 1: Base de Datos'
                      : file.moduleTarget === 'modulo2'
                      ? 'Módulo 2: Por Estación'
                      : file.moduleTarget === 'modulo3'
                      ? 'Módulo 3: Matriz General'
                      : 'General';

                  return (
                    <tr
                      key={file.id}
                      className={`hover:bg-neutral-50/70 transition-colors ${
                        isSelected ? 'bg-neutral-50' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleFile(file.id)}
                          className="text-neutral-400 hover:text-neutral-900"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-neutral-900" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                          <div>
                            <span className="font-semibold text-neutral-900 block">
                              {file.fileName}
                            </span>
                            {file.stationName && (
                              <span className="text-[11px] text-neutral-500 font-mono">
                                Estación: {file.stationName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-700 whitespace-nowrap font-medium">
                        {moduleLabel}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-neutral-900 tabular-nums">
                        {file.recordsCount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-neutral-500 text-[11px]">
                        {file.fileSizeFormatted}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-neutral-500 text-[11px] whitespace-nowrap">
                        <Clock className="w-3 h-3 inline mr-1 text-neutral-400" />
                        {file.uploadDate}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-neutral-700 text-xs">
                        {file.uploadedBy}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>{file.status}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {canManageFiles ? (
                          <button
                            onClick={() => handleDeleteSingle(file.id, file.fileName)}
                            className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors"
                            title="Eliminar este archivo del historial"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-neutral-400 font-mono text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal to Delete All */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-neutral-300 p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-neutral-900">
                ¿Eliminar todos los archivos del historial?
              </h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
              Esta acción borrará el registro de los <strong>{files.length} archivos</strong> del
              historial. Los registros actuales podrán ser reiniciados o preservados.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(false)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-950"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteAll}
                className="px-4 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Sí, borrar todos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
