import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MonthName, MONTHS, StationEvaluationRecord, ImportedFileRecord, UserSession } from '../types';
import { parseExcelFile, ParseResult } from '../utils/excelUtils';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  ArrowRight,
  Loader2,
  Database,
  RefreshCw,
  Copy,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SUPABASE_CONFIG } from '../lib/supabaseClient';
import { isSameStation, normalizeMonthName, cleanTextForMatch } from '../utils/evaluationFormulas';

export type DuplicateAction = 'replace' | 'skip' | 'keep_both';

interface FileImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserSession;
  stations: string[];
  existingRecords?: StationEvaluationRecord[];
  entityLabel?: string;
  initialModule?: 'auto' | 'modulo1' | 'modulo2' | 'modulo3';
  onImportComplete: (
    newRecords: StationEvaluationRecord[],
    historyEntry: ImportedFileRecord,
    onProgress?: (processed: number, total: number) => void,
    duplicateAction?: DuplicateAction
  ) => Promise<{ success: boolean; count?: number; error?: string | null }>;
}

interface DuplicateSample {
  station: string;
  month: string;
  punto: string;
  existingScore: string;
  newScore: string;
}

export const FileImportModal: React.FC<FileImportModalProps> = ({
  isOpen,
  onClose,
  user,
  stations,
  existingRecords = [],
  entityLabel = 'Estación',
  initialModule = 'auto',
  onImportComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [targetModule, setTargetModule] = useState<'auto' | 'modulo1' | 'modulo2' | 'modulo3'>(initialModule);
  const [overrideStation, setOverrideStation] = useState<string>(stations[0] || 'Mochis - Topolobampo');
  const [overrideMonth, setOverrideMonth] = useState<MonthName>('SEPTIEMBRE');

  // Duplicate resolution
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('replace');
  const [showDuplicateSamples, setShowDuplicateSamples] = useState(false);

  // Dedicated upload popup window state
  const [showUploadProgressWindow, setShowUploadProgressWindow] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState(0);
  const [uploadProcessed, setUploadProcessed] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadStageMessage, setUploadStageMessage] = useState('Iniciando subida...');
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'success' | 'error'>('uploading');
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [uploadSuccessSummary, setUploadSuccessSummary] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setParseResult(null);
      setIsParsing(false);
      setTargetModule(initialModule);
      setErrorMsg(null);
      setDuplicateAction('replace');
      setShowDuplicateSamples(false);
      setShowUploadProgressWindow(false);
      setUploadPercentage(0);
      setUploadProcessed(0);
      setUploadTotal(0);
      setUploadStatus('uploading');
      setUploadErrorMessage(null);
      setUploadSuccessSummary(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setSelectedFile(null);
      setParseResult(null);
      setIsParsing(false);
      setShowUploadProgressWindow(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen, initialModule]);

  // Compute duplicate analysis dynamically against existing records
  const duplicateAnalysis = useMemo(() => {
    if (!parseResult || !parseResult.records || parseResult.records.length === 0) {
      return { duplicateCount: 0, newCount: 0, samples: [] as DuplicateSample[] };
    }

    if (!existingRecords || existingRecords.length === 0) {
      return {
        duplicateCount: 0,
        newCount: parseResult.records.length,
        samples: [] as DuplicateSample[],
      };
    }

    let duplicateCount = 0;
    let newCount = 0;
    const samples: DuplicateSample[] = [];
    const claimedIndices = new Set<number>();

    parseResult.records.forEach((newR) => {
      const cleanNewP = cleanTextForMatch(newR.punto);
      const normNewM = normalizeMonthName(newR.mes);

      const existingMatch = existingRecords.find((r, idx) => {
        if (claimedIndices.has(idx)) return false;
        return (
          isSameStation(r.estacion, newR.estacion) &&
          normalizeMonthName(r.mes) === normNewM &&
          cleanTextForMatch(r.punto) === cleanNewP
        );
      });

      if (existingMatch) {
        duplicateCount++;
        if (samples.length < 5) {
          samples.push({
            station: newR.estacion,
            month: newR.mes,
            punto: newR.punto,
            existingScore: String(existingMatch.calificacion ?? '-'),
            newScore: String(newR.calificacion ?? '-'),
          });
        }
      } else {
        newCount++;
      }
    });

    return { duplicateCount, newCount, samples };
  }, [parseResult, existingRecords]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setErrorMsg(null);
    setParseResult(null);
    setDuplicateAction('replace');
    setShowDuplicateSamples(false);

    try {
      const result = await parseExcelFile(file);
      setParseResult(result);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`No se pudo leer el archivo Excel: ${err.message || 'Formato no reconocido'}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  // Launch upload with visual real-time progress window
  const handleConfirmImport = async () => {
    if (!selectedFile || !parseResult) return;

    const assignedModule =
      targetModule === 'auto' ? parseResult.detectedModule : targetModule;

    const sizeKB = (selectedFile.size / 1024).toFixed(1) + ' KB';
    const totalRecords = parseResult.records.length;

    const historyEntry: ImportedFileRecord = {
      id: `imp-${Date.now()}`,
      fileName: selectedFile.name,
      moduleTarget: assignedModule,
      uploadDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
      uploadedBy: user.username,
      recordsCount: totalRecords,
      fileSizeFormatted: sizeKB,
      stationName: parseResult.stationsFound[0] || overrideStation,
      month: overrideMonth,
      status: 'Completado',
    };

    // Open prominent progress window
    setShowUploadProgressWindow(true);
    setUploadStatus('uploading');
    setUploadErrorMessage(null);
    setUploadSuccessSummary(null);
    setUploadProcessed(0);
    setUploadTotal(totalRecords);
    setUploadPercentage(10);
    setUploadStageMessage('Leyendo estructura y verificando registros...');

    // Progress simulation steps while waiting for network batches
    const progressTimer = setInterval(() => {
      setUploadPercentage((prev) => {
        if (prev >= 85) return prev;
        return prev + 5;
      });
    }, 250);

    try {
      // Stage 2: Duplicates resolved
      setTimeout(() => {
        if (duplicateAnalysis.duplicateCount > 0) {
          if (duplicateAction === 'replace') {
            setUploadStageMessage(`Actualizando ${duplicateAnalysis.duplicateCount} duplicados y agregando ${duplicateAnalysis.newCount} registros nuevos...`);
          } else if (duplicateAction === 'skip') {
            setUploadStageMessage(`Omitiendo duplicados e incorporando ${duplicateAnalysis.newCount} registros nuevos...`);
          } else {
            setUploadStageMessage(`Preparando todos los ${totalRecords} registros como nuevas entradas...`);
          }
        } else {
          setUploadStageMessage('Preparando lotes para almacenamiento en base de datos...');
        }
      }, 400);

      const result = await onImportComplete(
        parseResult.records,
        historyEntry,
        (processed, total) => {
          setUploadProcessed(processed);
          setUploadTotal(total);
          const computedPct = Math.min(95, Math.round((processed / total) * 90) + 5);
          setUploadPercentage((prev) => Math.max(prev, computedPct));
          setUploadStageMessage(`Guardando en Supabase: ${processed} de ${total} registros procesados...`);
        },
        duplicateAction
      );

      clearInterval(progressTimer);

      if (result && result.success) {
        setUploadPercentage(100);
        setUploadProcessed(totalRecords);
        setUploadStageMessage('¡Sincronización completada exitosamente!');
        setUploadStatus('success');

        const successText =
          duplicateAnalysis.duplicateCount > 0 && duplicateAction === 'replace'
            ? `Se actualizaron ${duplicateAnalysis.duplicateCount} registros duplicados y se agregaron ${duplicateAnalysis.newCount} nuevos. Tus registros previos se conservaron intactos.`
            : duplicateAnalysis.duplicateCount > 0 && duplicateAction === 'skip'
            ? `Se conservaron los registros existentes intactos y se añadieron ${duplicateAnalysis.newCount} registros nuevos.`
            : `Se importaron y guardaron ${result.count ?? totalRecords} registros con éxito en Supabase y memoria local.`;

        setUploadSuccessSummary(successText);

        // Auto-close smoothly after 2.5 seconds if user doesn't click
        setTimeout(() => {
          onClose();
        }, 2600);
      } else {
        setUploadStatus('error');
        setUploadErrorMessage(
          result?.error || 'Error al comunicarse con la base de datos de Supabase. Verifica tu conexión.'
        );
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error(err);
      setUploadStatus('error');
      setUploadErrorMessage(
        err?.message || 'Error inesperado durante la subida y procesamiento del archivo.'
      );
    }
  };

  return (
    <>
      {/* Ventanita de subida y porcentaje de subida en tiempo real */}
      {showUploadProgressWindow && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl border border-neutral-300 p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5">
            {/* Window Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    uploadStatus === 'success'
                      ? 'bg-emerald-100 text-emerald-700'
                      : uploadStatus === 'error'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {uploadStatus === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : uploadStatus === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <Database className="w-5 h-5 animate-pulse text-emerald-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-neutral-950 truncate">
                    {uploadStatus === 'success'
                      ? '¡Subida y Sincronización Exitosa!'
                      : uploadStatus === 'error'
                      ? 'Error en la Subida'
                      : 'Subiendo Archivo Excel'}
                  </h4>
                  <p className="text-[11px] text-neutral-500 truncate font-mono">
                    {selectedFile?.name || 'Archivo Excel'}
                  </p>
                </div>
              </div>

              {uploadStatus === 'uploading' && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold font-mono shrink-0 animate-pulse">
                  {uploadPercentage}%
                </span>
              )}
            </div>

            {/* Window Body: Uploading State */}
            {uploadStatus === 'uploading' && (
              <div className="space-y-4">
                {/* Large percentage display */}
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold text-neutral-950 font-mono tracking-tight">
                      {uploadPercentage}%
                    </span>
                    <span className="text-xs text-neutral-500 font-medium">completado</span>
                  </div>
                  <span className="text-xs font-semibold text-neutral-600 font-mono">
                    {uploadProcessed > 0
                      ? `${uploadProcessed} de ${uploadTotal} registros`
                      : `${uploadTotal} registros en cola`}
                  </span>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full bg-neutral-100 rounded-full h-3 p-0.5 overflow-hidden border border-neutral-200">
                  <div
                    className="bg-linear-to-r from-emerald-500 via-teal-500 to-emerald-600 h-full rounded-full transition-all duration-300 relative shadow-xs"
                    style={{ width: `${Math.max(6, uploadPercentage)}%` }}
                  >
                    <div className="absolute inset-0 bg-white/25 animate-pulse" />
                  </div>
                </div>

                {/* Stage description box */}
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs space-y-1">
                  <div className="flex items-center gap-2 text-neutral-800 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                    <span>{uploadStageMessage}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    El sistema está procesando activamente los datos. No cierres esta ventana.
                  </p>
                </div>
              </div>
            )}

            {/* Window Body: Success State */}
            {uploadStatus === 'success' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-950 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>¡Registros guardados en el sistema!</span>
                  </div>
                  <p className="text-[12px] text-emerald-800 leading-relaxed">
                    {uploadSuccessSummary}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-mono pt-1">
                    Base de datos Supabase sincronizada en tiempo real.
                  </p>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-5 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    Aceptar y Ver Base de Datos
                  </button>
                </div>
              </div>
            )}

            {/* Window Body: Error State */}
            {uploadStatus === 'error' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-xs text-red-950 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-red-900">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>No se pudo completar la subida</span>
                  </div>
                  <p className="text-[12px] text-red-800 leading-relaxed">
                    {uploadErrorMessage}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowUploadProgressWindow(false)}
                    className="px-4 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reintentar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Import Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-lg border border-neutral-300 p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <div>
              <h3 className="text-base font-bold text-neutral-950 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Importar Archivo Excel y Actualizar Base de Datos</span>
              </h3>
              <p className="text-xs text-neutral-500">
                Sube tu archivo .xlsx o .csv. Los registros existentes se conservarán y podrás decidir qué hacer con los duplicados.
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={showUploadProgressWindow}
              className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded disabled:opacity-40 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Supabase connection indicator banner */}
          <div className="mt-3 flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <div>
                <span className="font-bold">Conexión con Supabase activa</span>
                <span className="text-emerald-700 ml-1.5 font-mono text-[11px]">
                  ({SUPABASE_CONFIG.projectId})
                </span>
              </div>
            </div>
            <span className="text-[11px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded font-medium">
              Sincronización en la nube
            </span>
          </div>

          {/* Dropzone */}
          <div className="mt-4 space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => !showUploadProgressWindow && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? 'border-neutral-900 bg-neutral-50/50'
                  : 'border-neutral-300 hover:border-neutral-500 bg-neutral-50/20'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls,.csv"
                disabled={showUploadProgressWindow}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center">
                <Upload className="w-8 h-8 text-neutral-400 mb-2" />
                <p className="text-xs font-semibold text-neutral-900">
                  {selectedFile ? selectedFile.name : 'Haz clic o arrastra tu archivo Excel aquí'}
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Formatos compatibles: .xlsx, .xls, .csv
                </p>
              </div>
            </div>

            {isParsing && (
              <div className="flex items-center justify-center gap-2 p-3 text-xs text-neutral-600 bg-neutral-50 rounded border border-neutral-200">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-900" />
                <span>Analizando estructura del archivo Excel y buscando duplicados...</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Parse Result Summary & Duplicate Resolver */}
            {parseResult && (
              <div className="border border-neutral-200 rounded-lg p-4 space-y-4 bg-neutral-50/50">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-neutral-200">
                  <span className="font-semibold text-neutral-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Archivo Excel leído correctamente
                  </span>
                  <span className="font-mono text-neutral-600 font-bold">
                    {parseResult.records.length} registros en archivo
                  </span>
                </div>

                {/* DUPLICATE DETECTION PROMPT */}
                {duplicateAnalysis.duplicateCount > 0 ? (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-3.5 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-amber-950">
                          Se detectaron {duplicateAnalysis.duplicateCount} registros duplicados en la base de datos
                        </h4>
                        <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                          El archivo contiene {duplicateAnalysis.duplicateCount} registros que coinciden en misma estación, mes y rubro con los ya existentes en el sistema. Además, incluye {duplicateAnalysis.newCount} registros nuevos. Tus demás registros anteriores <strong>NO se borrarán</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Interactive choice selector */}
                    <div className="pt-1 space-y-2">
                      <label className="block text-[11px] font-bold text-amber-950 uppercase tracking-wider">
                        ¿Cómo deseas gestionar los {duplicateAnalysis.duplicateCount} registros duplicados?
                      </label>

                      {/* Option 1: Replace / Update (Recommended) */}
                      <label
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          duplicateAction === 'replace'
                            ? 'bg-white border-amber-500 shadow-xs ring-1 ring-amber-400 text-neutral-950'
                            : 'bg-amber-100/40 border-amber-200 text-neutral-700 hover:bg-white/80'
                        }`}
                      >
                        <input
                          type="radio"
                          name="duplicateAction"
                          value="replace"
                          checked={duplicateAction === 'replace'}
                          onChange={() => setDuplicateAction('replace')}
                          className="mt-0.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-neutral-950">
                              Reemplazar / Actualizar duplicados con el nuevo Excel
                            </span>
                            <span className="text-[10px] font-extrabold uppercase bg-amber-500 text-white px-1.5 py-0.2 rounded">
                              Recomendado
                            </span>
                          </div>
                          <span className="block text-[11px] text-neutral-600 mt-0.5">
                            Sobrescribe las calificaciones y notas de los {duplicateAnalysis.duplicateCount} registros existentes con los nuevos valores del Excel, y añade los {duplicateAnalysis.newCount} registros nuevos. Todos los demás registros previos se mantienen a salvo.
                          </span>
                        </div>
                      </label>

                      {/* Option 2: Skip duplicates */}
                      <label
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          duplicateAction === 'skip'
                            ? 'bg-white border-amber-500 shadow-xs ring-1 ring-amber-400 text-neutral-950'
                            : 'bg-amber-100/40 border-amber-200 text-neutral-700 hover:bg-white/80'
                        }`}
                      >
                        <input
                          type="radio"
                          name="duplicateAction"
                          value="skip"
                          checked={duplicateAction === 'skip'}
                          onChange={() => setDuplicateAction('skip')}
                          className="mt-0.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <span className="font-bold text-neutral-950">
                            Omitir duplicados y conservar los registros actuales
                          </span>
                          <span className="block text-[11px] text-neutral-600 mt-0.5">
                            Conserva intactos los registros existentes sin modificarlos, e importa únicamente los {duplicateAnalysis.newCount} registros nuevos del archivo.
                          </span>
                        </div>
                      </label>

                      {/* Option 3: Keep both */}
                      <label
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          duplicateAction === 'keep_both'
                            ? 'bg-white border-amber-500 shadow-xs ring-1 ring-amber-400 text-neutral-950'
                            : 'bg-amber-100/40 border-amber-200 text-neutral-700 hover:bg-white/80'
                        }`}
                      >
                        <input
                          type="radio"
                          name="duplicateAction"
                          value="keep_both"
                          checked={duplicateAction === 'keep_both'}
                          onChange={() => setDuplicateAction('keep_both')}
                          className="mt-0.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <span className="font-bold text-neutral-950">
                            Conservar ambos (importar todos sin reemplazar)
                          </span>
                          <span className="block text-[11px] text-neutral-600 mt-0.5">
                            Agrega los {parseResult.records.length} registros del archivo como nuevas entradas independientes sin sobrescribir las existentes.
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* Duplicate Samples Preview Accordion */}
                    {duplicateAnalysis.samples.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setShowDuplicateSamples(!showDuplicateSamples)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 hover:text-amber-950 hover:underline cursor-pointer"
                        >
                          {showDuplicateSamples ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {showDuplicateSamples ? 'Ocultar' : 'Ver'} {duplicateAnalysis.samples.length} ejemplos de registros duplicados detectados
                          </span>
                        </button>

                        {showDuplicateSamples && (
                          <div className="mt-2 border border-amber-200 rounded overflow-hidden bg-white text-[11px] font-mono shadow-2xs">
                            <table className="w-full text-left">
                              <thead className="bg-amber-100/70 text-amber-900 border-b border-amber-200">
                                <tr>
                                  <th className="py-1 px-2">{entityLabel}</th>
                                  <th className="py-1 px-2">Mes</th>
                                  <th className="py-1 px-2">Punto Evaluado</th>
                                  <th className="py-1 px-2 text-center">Actual</th>
                                  <th className="py-1 px-2 text-center">Nuevo en Excel</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-amber-100">
                                {duplicateAnalysis.samples.map((s, idx) => (
                                  <tr key={idx}>
                                    <td className="py-1 px-2 font-medium">{s.station}</td>
                                    <td className="py-1 px-2">{s.month}</td>
                                    <td className="py-1 px-2 truncate max-w-[150px]">{s.punto}</td>
                                    <td className="py-1 px-2 text-center text-neutral-500 font-semibold">{s.existingScore}</td>
                                    <td className="py-1 px-2 text-center font-bold text-amber-900 bg-amber-50/50">{s.newScore}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      No se encontraron duplicados: los {parseResult.records.length} registros son completamente nuevos y se incorporarán a la base de datos sin alterar los registros existentes.
                    </span>
                  </div>
                )}

                {/* Module selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">
                      Módulo Destino
                    </label>
                    <select
                      value={targetModule}
                      onChange={(e: any) => setTargetModule(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-neutral-300 rounded bg-white"
                    >
                      <option value="auto">
                        Auto-detectado ({parseResult.detectedModule === 'modulo1' ? 'Módulo 1 (Base de Datos)' : parseResult.detectedModule === 'modulo2' ? 'Módulo 2 (Por Estación)' : 'Módulo 3 (Matriz General)'})
                      </option>
                      <option value="modulo1">Módulo 1: Base de Datos Centralizada</option>
                      <option value="modulo2">Módulo 2: Tablero por Estación</option>
                      <option value="modulo3">Módulo 3: Matriz Multi-Estación</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1">
                      Estaciones Detectadas ({parseResult.stationsFound.length})
                    </label>
                    <div className="text-xs text-neutral-700 truncate font-mono py-1.5 px-2 bg-white border border-neutral-200 rounded">
                      {parseResult.stationsFound.slice(0, 3).join(', ')}
                      {parseResult.stationsFound.length > 3 && ` +${parseResult.stationsFound.length - 3} más`}
                    </div>
                  </div>
                </div>

                {/* Preview sample */}
                <div className="pt-1">
                  <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                    Vista previa de los primeros 3 registros del archivo:
                  </span>
                  <div className="border border-neutral-200 rounded overflow-hidden text-[11px] font-mono bg-white">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-100 text-neutral-600 border-b border-neutral-200">
                        <tr>
                          <th className="py-1 px-2">{entityLabel}</th>
                          <th className="py-1 px-2">Mes</th>
                          <th className="py-1 px-2">Punto</th>
                          <th className="py-1 px-2 text-center">Calif</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {parseResult.records.slice(0, 3).map((r, i) => (
                          <tr key={i}>
                            <td className="py-1 px-2 font-medium">{r.estacion}</td>
                            <td className="py-1 px-2">{r.mes}</td>
                            <td className="py-1 px-2 truncate max-w-[200px]">{r.punto}</td>
                            <td className="py-1 px-2 text-center font-bold">{r.calificacion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="mt-6 pt-3 border-t border-neutral-200 flex items-center justify-between gap-2">
            <span className="text-[11px] text-neutral-400 font-mono">
              Los registros anteriores en la base de datos se mantendrán intactos.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={showUploadProgressWindow}
                className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-40 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!parseResult || parseResult.records.length === 0 || showUploadProgressWindow}
                onClick={handleConfirmImport}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-lg shadow-sm transition-colors disabled:opacity-40 cursor-pointer"
              >
                <span>
                  {duplicateAnalysis.duplicateCount > 0 && duplicateAction === 'replace'
                    ? `Actualizar e Importar (${parseResult ? `${parseResult.records.length} reg` : ''})`
                    : duplicateAnalysis.duplicateCount > 0 && duplicateAction === 'skip'
                    ? `Importar ${duplicateAnalysis.newCount} Nuevos`
                    : `Subir y Guardar (${parseResult ? `${parseResult.records.length} reg` : ''})`}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
