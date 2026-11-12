import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AnexoFile, MonthName, UserSession } from '../types';
import { isSameStation } from '../utils/evaluationFormulas';
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  File,
  Download,
  UploadCloud,
  Trash2,
  X,
  Search,
  ExternalLink,
  ShieldCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Eye,
  Building2,
  Lock,
} from 'lucide-react';

interface AnexosModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: MonthName | string;
  year?: number;
  stationName?: string;
  availableStations?: string[];
  user?: UserSession | null;
  anexos: AnexoFile[];
  onAddAnexo: (anexo: AnexoFile) => Promise<void> | void;
  onDeleteAnexo: (id: string) => Promise<void> | void;
  onClearAllAnexos?: (month?: string, year?: number, stationName?: string) => Promise<void> | void;
}

export const AnexosModal: React.FC<AnexosModalProps> = ({
  isOpen,
  onClose,
  month,
  year = 2026,
  stationName,
  availableStations = [],
  user,
  anexos,
  onAddAnexo,
  onDeleteAnexo,
  onClearAllAnexos,
}) => {
  const isFixedStation = !!stationName && stationName !== 'ALL';
  const [filterStation, setFilterStation] = useState<string>(() => (isFixedStation ? stationName : 'ALL'));
  const [targetUploadStation, setTargetUploadStation] = useState<string>(() =>
    isFixedStation
      ? stationName
      : availableStations && availableStations.length > 0
      ? availableStations[0]
      : 'General'
  );

  useEffect(() => {
    if (isFixedStation) {
      setFilterStation(stationName);
      setTargetUploadStation(stationName);
    } else if (availableStations && availableStations.length > 0) {
      setTargetUploadStation((prev) => (prev && prev !== 'General' ? prev : availableStations[0]));
    }
  }, [stationName, isFixedStation, availableStations]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para confirmación en modal de eliminación
  const [fileToDelete, setFileToDelete] = useState<AnexoFile | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [isConfirmClearAllOpen, setIsConfirmClearAllOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Determine permissions
  const isAdmin =
    user?.role === 'Admin' ||
    user?.role === 'Administrador' ||
    user?.username?.toLowerCase().includes('admin') ||
    user?.username === 'haroldo90';

  const isCoordinator =
    user?.role === 'Coordinador' || user?.username?.toLowerCase().includes('coord');

  // Filter anexos strictly for the active month, year, and station
  const monthAnexos = useMemo(() => {
    return anexos.filter((a) => {
      const matchMonth =
        !month ||
        a.mes?.trim().toUpperCase() === month.trim().toUpperCase() ||
        a.mes?.slice(0, 3).toUpperCase() === month.slice(0, 3).toUpperCase();
      const matchYear = !year || !a.anio || a.anio === year;

      const effectiveStation = isFixedStation ? stationName : filterStation;
      const matchStation =
        !effectiveStation ||
        effectiveStation === 'ALL' ||
        isSameStation(a.estacion, effectiveStation);

      return matchMonth && matchYear && matchStation;
    });
  }, [anexos, month, year, isFixedStation, stationName, filterStation]);

  // Apply search & type filter
  const filteredAnexos = useMemo(() => {
    return monthAnexos.filter((a) => {
      if (selectedTypeFilter !== 'all' && a.tipoArchivo !== selectedTypeFilter) {
        return false;
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        a.nombreArchivo.toLowerCase().includes(term) ||
        (a.descripcion && a.descripcion.toLowerCase().includes(term)) ||
        (a.estacion && a.estacion.toLowerCase().includes(term)) ||
        a.subidoPor.toLowerCase().includes(term)
      );
    });
  }, [monthAnexos, selectedTypeFilter, searchTerm]);

  if (!isOpen) return null;

  // Detect file category from name/extension
  const getFileType = (fileName: string, mime?: string): AnexoFile['tipoArchivo'] => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext) || mime?.includes('pdf')) return 'pdf';
    if (['xlsx', 'xls', 'csv'].includes(ext) || mime?.includes('spreadsheet') || mime?.includes('excel'))
      return 'excel';
    if (['doc', 'docx'].includes(ext) || mime?.includes('word') || mime?.includes('officedocument.word'))
      return 'word';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext) || mime?.includes('image'))
      return 'image';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'zip';
    if (['txt', 'log'].includes(ext)) return 'text';
    return 'other';
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Process file upload
  const handleProcessFile = async (file: File) => {
    if (!file) return;
    setUploadError(null);
    setUploadSuccess(null);

    // Limit check: 25 MB
    if (file.size > 25 * 1024 * 1024) {
      setUploadError('El archivo excede el límite máximo permitido (25 MB).');
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target?.result as string;
          const detectedType = getFileType(file.name, file.type);
          const finalStation = isFixedStation
            ? stationName
            : targetUploadStation || 'General';

          const newAnexo: AnexoFile = {
            id: `anx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            mes: month,
            anio: year,
            estacion: finalStation,
            nombreArchivo: file.name,
            tipoArchivo: detectedType,
            mimeType: file.type || undefined,
            tamanoBytes: file.size,
            tamanoFormatted: formatFileSize(file.size),
            contenidoUrl: base64Data,
            descripcion: descriptionInput.trim() || undefined,
            subidoPor: user?.name || user?.username || 'Administrador General',
            subidoPorRol: user?.role || 'Admin',
            createdAt: new Date().toISOString(),
          };

          await onAddAnexo(newAnexo);
          setDescriptionInput('');
          setUploadSuccess(`Archivo guardado exitosamente y de forma exclusiva para "${finalStation}".`);
          if (fileInputRef.current) fileInputRef.current.value = '';
          setTimeout(() => setUploadSuccess(null), 4000);
        } catch (err: any) {
          setUploadError(err?.message || 'Error al procesar el archivo');
        } finally {
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setUploadError('Error al leer el archivo desde el dispositivo');
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err?.message || 'Error al iniciar la lectura del archivo');
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDownload = (anexo: AnexoFile) => {
    try {
      const link = document.createElement('a');
      link.href = anexo.contenidoUrl;
      link.download = anexo.nombreArchivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.open(anexo.contenidoUrl, '_blank');
    }
  };

  const handlePreview = (anexo: AnexoFile) => {
    const w = window.open('');
    if (w) {
      if (anexo.tipoArchivo === 'pdf' || anexo.tipoArchivo === 'image') {
        w.location.href = anexo.contenidoUrl;
      } else {
        w.close();
        handleDownload(anexo);
      }
    }
  };

  const handleOpenDelete = (anexo: AnexoFile) => {
    setFileToDelete(anexo);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeletingFile(true);
    setUploadError(null);
    try {
      await onDeleteAnexo(fileToDelete.id);
      setUploadSuccess(`Archivo "${fileToDelete.nombreArchivo}" eliminado permanentemente.`);
      setFileToDelete(null);
      setTimeout(() => setUploadSuccess(null), 3500);
    } catch (e: any) {
      setUploadError(`Error al eliminar: ${e?.message || 'Error desconocido'}`);
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleConfirmClearAll = async () => {
    setIsClearingAll(true);
    setUploadError(null);
    try {
      const effectiveStation = isFixedStation
        ? stationName
        : filterStation !== 'ALL'
        ? filterStation
        : undefined;

      if (onClearAllAnexos) {
        await onClearAllAnexos(String(month), year, effectiveStation);
      } else {
        for (const anexo of monthAnexos) {
          await onDeleteAnexo(anexo.id);
        }
      }
      setUploadSuccess(`Archivos de este periodo eliminados permanentemente.`);
      setIsConfirmClearAllOpen(false);
      setTimeout(() => setUploadSuccess(null), 3500);
    } catch (e: any) {
      setUploadError(`Error al vaciar: ${e?.message || 'Error desconocido'}`);
    } finally {
      setIsClearingAll(false);
    }
  };

  const renderFileIcon = (tipo: AnexoFile['tipoArchivo']) => {
    switch (tipo) {
      case 'pdf':
        return (
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center shrink-0 border border-red-200 shadow-2xs">
            <FileText className="w-5 h-5" />
          </div>
        );
      case 'excel':
        return (
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        );
      case 'word':
        return (
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200 shadow-2xs">
            <FileText className="w-5 h-5" />
          </div>
        );
      case 'image':
        return (
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 shadow-2xs">
            <FileImage className="w-5 h-5" />
          </div>
        );
      case 'zip':
        return (
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200 shadow-2xs">
            <FileArchive className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center shrink-0 shadow-2xs">
            <File className="w-5 h-5" />
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="px-5 py-4 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 flex items-center justify-center">
              <FileText className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Anexos</span>
                  <span className="text-cyan-400">·</span>
                  <span className="text-cyan-300 font-mono uppercase text-sm">
                    {month} {year}
                  </span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {isAdmin ? 'Gestión Admin' : isCoordinator ? 'Consulta Coordinador' : 'Consulta Usuario'}
                </span>
                {isFixedStation && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                    <Building2 className="w-3 h-3 text-cyan-400" />
                    <span>Estación: {stationName}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>Documentos técnicos y respaldo normativo para consulta y descarga</span>
                {isFixedStation && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-400" />
                      Archivos vinculados exclusivamente a {stationName}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* BANNER FOR COORDINATORS AND FINAL USERS */}
          {!isAdmin && (
            <div className="p-3.5 bg-cyan-50 border border-cyan-200 rounded-lg flex items-start gap-3 text-xs text-cyan-950">
              <ShieldCheck className="w-5 h-5 text-cyan-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-cyan-900">
                  Ventana de Consulta y Descarga de Anexos ({month} {year})
                  {isFixedStation && ` - ${stationName}`}
                </p>
                <p className="text-[11px] text-cyan-800 mt-0.5 leading-relaxed">
                  Aquí puedes consultar y descargar todos los archivos oficiales publicados para respaldar las evaluaciones de este periodo y estación.
                </p>
              </div>
            </div>
          )}

          {/* ADMIN UPLOAD ZONE */}
          {isAdmin && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-neutral-900" />
                  <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                    Subir Nuevo Archivo Anexo (PDF, Excel, Word, etc.)
                  </span>
                </div>
                <span className="text-[10px] text-neutral-500 font-mono">
                  Guarda directamente en Supabase
                </span>
              </div>

              {/* Station assignment indicator or selector */}
              {isFixedStation ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-950 font-semibold shadow-2xs">
                  <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Guardado exclusivo para: <strong>{stationName}</strong>
                  </span>
                  <span className="text-[10.5px] text-emerald-700 font-normal ml-auto bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-200">
                    Solo visible en {stationName}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 border border-neutral-300 rounded-lg text-xs">
                  <Building2 className="w-4 h-4 text-neutral-700 shrink-0" />
                  <span className="font-bold text-neutral-800 shrink-0">Asignar a Estación:</span>
                  <select
                    value={targetUploadStation}
                    onChange={(e) => setTargetUploadStation(e.target.value)}
                    className="flex-1 px-2.5 py-1 text-xs bg-white border border-neutral-300 rounded-md font-semibold text-neutral-900 focus:outline-none focus:border-neutral-900"
                  >
                    {(availableStations || []).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                    <option value="General">General (Todas las estaciones)</option>
                  </select>
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-cyan-600 bg-cyan-50/60'
                    : 'border-neutral-300 hover:border-neutral-900 bg-white hover:bg-neutral-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileInputChange}
                  accept=".pdf,.xlsx,.xls,.doc,.docx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.zip,.txt"
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700">
                    <UploadCloud className="w-5 h-5 text-neutral-800" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-900">
                      {isUploading
                        ? 'Procesando y guardando archivo...'
                        : 'Haz clic para seleccionar o arrastra y suelta tu archivo aquí'}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Formatos admitidos: <strong>PDF, Excel (.xlsx, .xls, .csv), Word (.docx, .doc), Imágenes, ZIP</strong> (Máx. 25 MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Description Input */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="Descripción o propósito del documento (ej. 'Procedimiento operativo oficial', 'Matriz de control')..."
                  className="flex-1 px-3 py-1.5 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Subiendo...' : 'Examinar Archivo'}</span>
                </button>
              </div>

              {/* Status messages */}
              {uploadError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
              {uploadSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{uploadSuccess}</span>
                </div>
              )}
            </div>
          )}

          {/* LIST & FILTER TOOLBAR */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
              {/* Type filter tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('all')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                    selectedTypeFilter === 'all'
                      ? 'bg-neutral-900 text-white font-bold'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  Todos ({monthAnexos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('pdf')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                    selectedTypeFilter === 'pdf'
                      ? 'bg-red-700 text-white font-bold'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  PDFs ({monthAnexos.filter((a) => a.tipoArchivo === 'pdf').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('excel')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                    selectedTypeFilter === 'excel'
                      ? 'bg-emerald-700 text-white font-bold'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  Excel ({monthAnexos.filter((a) => a.tipoArchivo === 'excel').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('word')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                    selectedTypeFilter === 'word'
                      ? 'bg-blue-700 text-white font-bold'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  Word ({monthAnexos.filter((a) => a.tipoArchivo === 'word').length})
                </button>
              </div>

              {/* Search Box, Station Filter and Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {!isFixedStation && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                    <select
                      value={filterStation}
                      onChange={(e) => setFilterStation(e.target.value)}
                      className="px-2 py-1 text-xs border border-neutral-300 rounded-lg bg-white font-medium text-neutral-800 focus:outline-none focus:border-neutral-900"
                    >
                      <option value="ALL">Todas las Estaciones</option>
                      {(availableStations || []).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="relative min-w-[180px] flex-1 sm:flex-initial">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar archivo..."
                    className="w-full pl-8 pr-3 py-1 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400"
                  />
                </div>

                {monthAnexos.length > 0 && isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmClearAllOpen(true)}
                    className="px-2.5 py-1 text-xs font-bold text-red-700 hover:text-white bg-red-50 hover:bg-red-600 border border-red-300 hover:border-red-600 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
                    title={`Eliminar archivos de ${isFixedStation ? stationName : 'este mes'}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vaciar {isFixedStation ? stationName : 'mes'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* List of files */}
            {filteredAnexos.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-neutral-200 rounded-xl bg-neutral-50/50">
                <File className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-neutral-700">
                  {searchTerm
                    ? 'No se encontraron anexos que coincidan con la búsqueda.'
                    : `No hay archivos anexos registrados para ${isFixedStation ? stationName : 'este periodo'} en ${month} ${year}.`}
                </p>
                <p className="text-[11px] text-neutral-500 mt-1 max-w-md mx-auto">
                  {isAdmin
                    ? `Usa el recuadro superior para subir documentos oficiales que pertenezcan a ${isFixedStation ? stationName : 'las estaciones'}.`
                    : 'Aún no se han subido documentos para este periodo. Vuelve a consultar más tarde.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredAnexos.map((anexo) => {
                  const uploadDate = new Date(anexo.createdAt).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={anexo.id}
                      className="p-3 bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      {/* Left: Icon and Details */}
                      <div className="flex items-start gap-3 min-w-0">
                        {renderFileIcon(anexo.tipoArchivo)}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4
                              className="text-xs font-bold text-neutral-900 truncate max-w-[280px] sm:max-w-[360px]"
                              title={anexo.nombreArchivo}
                            >
                              {anexo.nombreArchivo}
                            </h4>
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                              {anexo.tipoArchivo}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-500 font-medium">
                              {anexo.tamanoFormatted}
                            </span>
                          </div>

                          {anexo.descripcion && (
                            <p className="text-[11px] text-neutral-600 mt-1 line-clamp-2 leading-relaxed">
                              {anexo.descripcion}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                              <Building2 className="w-3 h-3 text-cyan-600" />
                              <span>{anexo.estacion || 'General'}</span>
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">·</span>
                            <span className="text-[10px] text-neutral-500 font-mono">Subido: {uploadDate}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">·</span>
                            <span className="text-[10px] text-neutral-500 font-mono">
                              Por: {anexo.subidoPor} ({anexo.subidoPorRol || 'Admin'})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleDownload(anexo)}
                          className="px-3 py-1.5 text-xs font-semibold bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                          title="Descargar archivo a tu dispositivo"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Descargar</span>
                        </button>

                        {(anexo.tipoArchivo === 'pdf' || anexo.tipoArchivo === 'image') && (
                          <button
                            type="button"
                            onClick={() => handlePreview(anexo)}
                            className="p-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                            title="Abrir vista previa en nueva pestaña"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(anexo)}
                            className="p-1.5 text-xs text-neutral-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar anexo permanentemente de Supabase y navegador"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span>
              Total: {filteredAnexos.length} documento{filteredAnexos.length === 1 ? '' : 's'} disponible{filteredAnexos.length === 1 ? '' : 's'}
              {isFixedStation && ` para ${stationName}`} en {month} {year}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        {/* MODAL DE CONFIRMACIÓN: BORRADO INDIVIDUAL */}
        {fileToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
            <div className="bg-white rounded-xl border border-neutral-300 p-5 max-w-sm w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">¿Eliminar archivo anexo?</h4>
                  <p className="text-[11px] text-neutral-500 truncate max-w-[220px]">
                    {fileToDelete.nombreArchivo}
                  </p>
                </div>
              </div>

              <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200 text-[11px] text-neutral-700 space-y-1">
                <p><strong>Estación:</strong> {fileToDelete.estacion || 'General'}</p>
                <p><strong>Mes:</strong> {fileToDelete.mes} {fileToDelete.anio}</p>
                <p className="text-red-700 font-semibold pt-1">
                  Este anexo se borrará definitivamente de Supabase y del almacenamiento local.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFileToDelete(null)}
                  disabled={isDeletingFile}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeletingFile}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingFile ? 'Eliminando...' : 'Sí, eliminar archivo'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CONFIRMACIÓN: VACIAR ANEXOS */}
        {isConfirmClearAllOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
            <div className="bg-white rounded-xl border border-neutral-300 p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">
                    ¿Vaciar anexos de {isFixedStation ? stationName : 'este mes'}?
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Se eliminarán los {monthAnexos.length} archivos de {isFixedStation ? stationName : `${month} ${year}`}
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-2">
                <p className="font-semibold">
                  Se eliminarán permanentemente los siguientes documentos:
                </p>
                <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                  {monthAnexos.slice(0, 3).map((a) => (
                    <li key={a.id} className="truncate">
                      {a.nombreArchivo} ({a.estacion})
                    </li>
                  ))}
                  {monthAnexos.length > 3 && (
                    <li>+{monthAnexos.length - 3} archivo(s) más</li>
                  )}
                </ul>
                <p className="text-[11px] pt-1 text-amber-950 font-medium">
                  Los anexos de las demás estaciones permanecerán intactos.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsConfirmClearAllOpen(false)}
                  disabled={isClearingAll}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearAll}
                  disabled={isClearingAll}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isClearingAll ? 'Borrando...' : 'Sí, vaciar anexos'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
