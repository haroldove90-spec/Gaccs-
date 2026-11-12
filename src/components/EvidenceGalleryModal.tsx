import React, { useState, useRef } from 'react';
import { EvidencePhoto, StationEvaluationRecord, UserSession } from '../types';
import { RecordTimerBadge, formatSecondsHuman } from './RecordTimerBadge';
import {
  X,
  Camera,
  Download,
  Trash2,
  ZoomIn,
  Plus,
  Calendar,
  Building2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCheck,
  CheckCircle2,
  Clock,
  Upload,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface EvidenceGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: StationEvaluationRecord | null;
  user?: UserSession;
  onUpdateRecord?: (updatedRecord: StationEvaluationRecord) => void;
  onUpdateRecordEvidences?: (updatedEvidences: EvidencePhoto[]) => void;
  onOpenEditModal?: () => void;
}

export const EvidenceGalleryModal: React.FC<EvidenceGalleryModalProps> = ({
  isOpen,
  onClose,
  record,
  user,
  onUpdateRecord,
  onUpdateRecordEvidences,
  onOpenEditModal,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [activeGallerySection, setActiveGallerySection] = useState<'inspector' | 'userFinal'>('inspector');
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  // States for user final response evidence uploading
  const [userFinalNotes, setUserFinalNotes] = useState<string>(() => record?.userFinalObservaciones || '');
  const [isSavingUserFinal, setIsSavingUserFinal] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // States for inspector evidence uploading inside modal
  const [inspectorNotes, setInspectorNotes] = useState<string>(() => record?.observaciones || '');

  // Hidden file input references
  const inspectorFileInputRef = useRef<HTMLInputElement | null>(null);
  const userFinalFileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetSlot, setTargetSlot] = useState<number>(1);

  if (!isOpen || !record) return null;

  const isAdminOrCoord =
    user?.role === 'Admin' ||
    user?.role === 'Coordinador' ||
    user?.role === 'Administrador' ||
    user?.username?.toLowerCase().includes('admin') ||
    user?.username?.toLowerCase().includes('coord');

  const isUsuarioFinal = user?.role === 'Usuario final' || !isAdminOrCoord;

  const inspectorEvidences: EvidencePhoto[] = record.evidencias || [];
  const userFinalEvidencias: EvidencePhoto[] = record.userFinalEvidencias || [];
  const userFinalEvidences: EvidencePhoto[] = userFinalEvidencias;

  const displayedEvidences =
    activeGallerySection === 'inspector' ? inspectorEvidences : userFinalEvidences;
  const currentPhoto = displayedEvidences[selectedPhotoIndex] || displayedEvidences[0];

  const hasInspectorSubmitted = Boolean(record.inspectorSubmittedAt || inspectorEvidences.length > 0 || record.observaciones);
  const isTimerFrozen = Boolean(record.timerFrozen || record.userFinalSubmittedAt);

  const handleDownload = (photo: EvidencePhoto, index: number, prefix: string) => {
    const link = document.createElement('a');
    link.href = photo.dataUrl;
    link.download = `${prefix}_${record.estacion.replace(/\s+/g, '_')}_${record.mes}_Foto_${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to compress and convert image to dataUrl
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Inspector photo upload handler
  const handleInspectorFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const dataUrl = await processImageFile(files[0]);
      const nowStr = new Date().toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const newPhoto: EvidencePhoto = {
        id: `insp-ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        dataUrl,
        caption: `Evidencia Auditoría - Foto ${targetSlot}`,
        timestamp: nowStr,
        slotIndex: targetSlot,
      };

      const updatedEvidences = inspectorEvidences.filter((p) => p.slotIndex !== targetSlot);
      updatedEvidences.push(newPhoto);
      updatedEvidences.sort((a, b) => (a.slotIndex || 1) - (b.slotIndex || 1));

      // Inicia cronómetro si es la primera vez que sube evidencias
      const nowIso = new Date().toISOString();
      const updatedRec: StationEvaluationRecord = {
        ...record,
        evidencias: updatedEvidences,
        observaciones: inspectorNotes.trim() || record.observaciones,
        inspectorSubmittedAt: record.inspectorSubmittedAt || nowIso,
        inspectorUser: record.inspectorUser || user?.name || user?.username || 'Coordinador',
      };

      if (onUpdateRecord) onUpdateRecord(updatedRec);
      if (onUpdateRecordEvidences) onUpdateRecordEvidences(updatedEvidences);

      setFeedbackMsg('Foto de auditoría guardada. Cronómetro iniciado.');
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err) {
      console.error(err);
    }
    e.target.value = '';
  };

  // User Final photo upload handler
  const handleUserFinalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const dataUrl = await processImageFile(files[0]);
      const nowStr = new Date().toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const newPhoto: EvidencePhoto = {
        id: `usr-ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        dataUrl,
        caption: `Subsanación Usuario Final - Foto ${targetSlot}`,
        timestamp: nowStr,
        slotIndex: targetSlot,
      };

      const updated = userFinalEvidencias.filter((p: EvidencePhoto) => p.slotIndex !== targetSlot);
      updated.push(newPhoto);
      updated.sort((a: EvidencePhoto, b: EvidencePhoto) => (a.slotIndex || 1) - (b.slotIndex || 1));

      // Calculate elapsed time and freeze stopwatch
      const nowIso = new Date().toISOString();
      let elapsedSec = record.timerElapsedSeconds;
      if (!isTimerFrozen && record.inspectorSubmittedAt) {
        elapsedSec = Math.max(
          1,
          Math.floor(
            (new Date(nowIso).getTime() - new Date(record.inspectorSubmittedAt).getTime()) / 1000
          )
        );
      }

      const updatedRec: StationEvaluationRecord = {
        ...record,
        userFinalEvidencias: updated,
        userFinalObservaciones: userFinalNotes.trim() || record.userFinalObservaciones,
        userFinalSubmittedAt: record.userFinalSubmittedAt || nowIso,
        userFinalUser: record.userFinalUser || user?.name || user?.username || 'Usuario Final',
        timerElapsedSeconds: elapsedSec,
        timerFrozen: true,
      };

      if (onUpdateRecord) onUpdateRecord(updatedRec);

      setFeedbackMsg('¡Evidencia de Usuario Final agregada y cronómetro detenido con éxito!');
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err) {
      console.error(err);
    }
    e.target.value = '';
  };

  // Guardar observaciones y evidencias de Usuario Final y detener cronómetro
  const handleSaveUserFinalResponse = () => {
    setIsSavingUserFinal(true);
    const nowIso = new Date().toISOString();

    let elapsedSec = record.timerElapsedSeconds;
    if (!isTimerFrozen && record.inspectorSubmittedAt) {
      elapsedSec = Math.max(
        1,
        Math.floor(
          (new Date(nowIso).getTime() - new Date(record.inspectorSubmittedAt).getTime()) / 1000
        )
      );
    }

    const updatedRec: StationEvaluationRecord = {
      ...record,
      userFinalEvidencias: userFinalEvidencias,
      userFinalObservaciones: userFinalNotes.trim(),
      userFinalSubmittedAt: record.userFinalSubmittedAt || nowIso,
      userFinalUser: record.userFinalUser || user?.name || user?.username || 'Usuario Final',
      timerElapsedSeconds: elapsedSec,
      timerFrozen: true,
    };

    if (onUpdateRecord) onUpdateRecord(updatedRec);

    setIsSavingUserFinal(false);
    const timeText = elapsedSec ? formatSecondsHuman(elapsedSec) : '0s';
    setFeedbackMsg(`✓ ¡Evidencias de Usuario Final guardadas! Cronómetro detenido permanentemente en ${timeText}.`);
    setTimeout(() => setFeedbackMsg(null), 4500);
  };

  // Guardar observaciones de Inspector
  const handleSaveInspectorNotes = () => {
    const nowIso = new Date().toISOString();
    const updatedRec: StationEvaluationRecord = {
      ...record,
      observaciones: inspectorNotes.trim(),
      inspectorSubmittedAt: record.inspectorSubmittedAt || nowIso,
      inspectorUser: record.inspectorUser || user?.name || user?.username || 'Coordinador',
    };
    if (onUpdateRecord) onUpdateRecord(updatedRec);
    setFeedbackMsg('Observaciones de auditoría guardadas y cronómetro activado.');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Delete Inspector Photo
  const handleDeleteInspectorPhoto = (photoId: string) => {
    if (window.confirm('¿Confirmas eliminar esta foto de auditoría?')) {
      const next = inspectorEvidences.filter((p) => p.id !== photoId);
      const updatedRec: StationEvaluationRecord = {
        ...record,
        evidencias: next,
      };
      if (onUpdateRecord) onUpdateRecord(updatedRec);
      if (onUpdateRecordEvidences) onUpdateRecordEvidences(next);
      if (selectedPhotoIndex >= next.length && next.length > 0) {
        setSelectedPhotoIndex(next.length - 1);
      }
    }
  };

  // Delete User Final Photo
  const handleDeleteUserFinalPhoto = (photoId: string) => {
    if (window.confirm('¿Confirmas eliminar esta foto de respuesta?')) {
      const next = userFinalEvidencias.filter((p: EvidencePhoto) => p.id !== photoId);
      const updatedRec: StationEvaluationRecord = {
        ...record,
        userFinalEvidencias: next,
      };
      if (onUpdateRecord) onUpdateRecord(updatedRec);
      if (selectedPhotoIndex >= next.length && next.length > 0) {
        setSelectedPhotoIndex(next.length - 1);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      {/* Hidden file pickers */}
      <input
        ref={inspectorFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInspectorFileChange}
        className="hidden"
      />
      <input
        ref={userFinalFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUserFinalFileChange}
        className="hidden"
      />

      <div className="bg-white rounded-xl border border-neutral-200 max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950 text-white flex items-start justify-between">
          <div className="space-y-1 pr-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="flex items-center gap-1 text-cyan-400 font-bold uppercase tracking-wider">
                <Camera className="w-3.5 h-3.5" />
                Flujo de Evidencias e Inspección
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold leading-tight mt-1 text-white">
              {record.punto}
            </h3>

            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300 font-mono pt-0.5">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                {record.estacion}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                {record.mes} {record.anio}
              </span>
              <span>·</span>
              <span className="text-emerald-400 font-bold">
                Calificación: {record.calificacion} pts
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors shrink-0 cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FEEDBACK TOAST / ALERT */}
        {feedbackMsg && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-between shrink-0 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-white/80 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">

          {/* PANEL DE CRONÓMETRO EN EL MODAL DE EVIDENCIAS */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-[#0e7490]" />
                <span>Cronómetro de Atención y Carga de Evidencias</span>
              </span>
              {record.inspectorSubmittedAt && !record.timerFrozen && (
                <span className="text-[11px] text-amber-600 font-bold font-mono animate-pulse flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  ● Corriendo en vivo
                </span>
              )}
              {record.timerFrozen && (
                <span className="text-[11px] text-emerald-600 font-bold font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Congelado permanente
                </span>
              )}
            </div>

            <RecordTimerBadge
              inspectorSubmittedAt={record.inspectorSubmittedAt}
              userFinalSubmittedAt={record.userFinalSubmittedAt}
              timerElapsedSeconds={record.timerElapsedSeconds}
              timerFrozen={record.timerFrozen}
              hasCalificacion={record.calificacion !== undefined && record.calificacion !== ''}
              variant="panel"
            />
          </div>

          {/* ========================================================================= */}
          {/* SECCIÓN 1: EVIDENCIAS Y OBSERVACIONES DEL ADMIN / COORDINADOR (SUPERIOR)  */}
          {/* ========================================================================= */}
          <div className="border border-neutral-300 rounded-xl overflow-hidden bg-neutral-50/50 shadow-xs">
            {/* Section Header */}
            <div className="p-3 sm:p-4 bg-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-300">
                    1. Evidencias de Auditoría / Inspección (Admin y Coordinador)
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Evidencias fotográficas y hallazgos registrados durante la evaluación
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-200">
                  {inspectorEvidences.length} / 4 Fotos
                </span>
                {isAdminOrCoord && (
                  <button
                    type="button"
                    onClick={() => {
                      const filled = inspectorEvidences.map((e) => e.slotIndex || 1);
                      let s = 1;
                      for (let i = 1; i <= 4; i++) {
                        if (!filled.includes(i)) {
                          s = i;
                          break;
                        }
                      }
                      setTargetSlot(s);
                      inspectorFileInputRef.current?.click();
                    }}
                    disabled={inspectorEvidences.length >= 4}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded transition-colors cursor-pointer"
                    title="Subir foto como Admin/Coordinador"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Subir Foto</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inspector Content */}
            <div className="p-3 sm:p-4 space-y-4">
              {/* Photo Display / Viewer for Inspector */}
              {inspectorEvidences.length === 0 ? (
                <div className="text-center py-6 px-4 border-2 border-dashed border-neutral-200 rounded-lg bg-white">
                  <Camera className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-neutral-700">
                    El Admin o Coordinador aún no ha adjuntado fotos de evidencia de auditoría
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {isAdminOrCoord
                      ? 'Como Administrador o Coordinador, puedes subir hasta 4 fotos y registrar observaciones.'
                      : 'El Usuario Final podrá ver aquí las fotos cuando sean cargadas por el inspector.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Photo Thumbnails / Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[1, 2, 3, 4].map((slotNum) => {
                      const photo = inspectorEvidences.find((p) => (p.slotIndex || 1) === slotNum);
                      return (
                        <div
                          key={`insp-slot-${slotNum}`}
                          className={`relative rounded-lg border overflow-hidden aspect-video sm:aspect-square flex flex-col items-center justify-center transition-all bg-white ${
                            photo ? 'border-cyan-300 shadow-xs' : 'border-dashed border-neutral-300 bg-neutral-50/80'
                          }`}
                        >
                          {photo ? (
                            <>
                              <img
                                src={photo.dataUrl}
                                alt={`Evidencia Auditoría ${slotNum}`}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                onClick={() => {
                                  setActiveGallerySection('inspector');
                                  const idx = inspectorEvidences.findIndex((p) => p.id === photo.id);
                                  if (idx >= 0) setSelectedPhotoIndex(idx);
                                }}
                              />
                              <div className="absolute top-1 left-1 px-1.5 py-0.2 bg-black/75 text-cyan-300 text-[9px] font-mono font-bold rounded">
                                Foto {slotNum}
                              </div>
                              <div className="absolute bottom-1 right-1 flex items-center gap-1 bg-black/70 p-0.5 rounded">
                                <button
                                  type="button"
                                  onClick={() => handleDownload(photo, slotNum - 1, 'Auditoria')}
                                  className="p-1 text-white hover:text-cyan-300"
                                  title="Descargar"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                                {isAdminOrCoord && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteInspectorPhoto(photo.id)}
                                    className="p-1 text-red-300 hover:text-red-100"
                                    title="Eliminar foto"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="text-center p-2 text-neutral-400">
                              <span className="block text-[10px] font-mono font-bold mb-1">
                                Slot {slotNum}
                              </span>
                              {isAdminOrCoord ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetSlot(slotNum);
                                    inspectorFileInputRef.current?.click();
                                  }}
                                  className="px-2 py-1 text-[10px] font-semibold bg-white border border-neutral-300 hover:border-neutral-500 rounded text-neutral-700 transition-colors shadow-2xs"
                                >
                                  + Agregar
                                </button>
                              ) : (
                                <span className="text-[10px] italic">Vacío</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Inspector Observations */}
              <div className="bg-white border border-neutral-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-800 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-700" />
                    Observaciones y Hallazgos del Auditor
                  </span>
                  {record.inspectorSubmittedAt && (
                    <span className="text-[10px] font-mono text-neutral-500 font-normal">
                      Registrado: {new Date(record.inspectorSubmittedAt).toLocaleDateString('es-MX')} {new Date(record.inspectorSubmittedAt).toLocaleTimeString('es-MX')}
                    </span>
                  )}
                </div>

                {isAdminOrCoord ? (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={inspectorNotes}
                      onChange={(e) => setInspectorNotes(e.target.value)}
                      placeholder="Escribe las observaciones, hallazgos o no conformidades para esta estación..."
                      className="w-full text-xs p-2.5 border border-neutral-300 rounded focus:ring-1 focus:ring-neutral-900 focus:outline-none bg-neutral-50/50"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveInspectorNotes}
                        className="px-3 py-1.5 text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 rounded transition-colors shadow-xs"
                      >
                        Guardar Observaciones del Auditor
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-line bg-neutral-50 p-2.5 rounded border border-neutral-100">
                    {record.observaciones || 'Sin observaciones registradas por el auditor para este punto.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECCIÓN 2: EVIDENCIAS DE RESPUESTA / SUBSANACIÓN DEL USUARIO FINAL         */}
          {/* (COLOCADO EXACTAMENTE ABAJO DE LAS EVIDENCIAS DEL ADMIN Y COORDINADOR)    */}
          {/* ========================================================================= */}
          <div className="border border-emerald-300 rounded-xl overflow-hidden bg-emerald-50/30 shadow-xs">
            {/* Section Header */}
            <div className="p-3 sm:p-4 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-400/20 text-emerald-300 flex items-center justify-center font-bold">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-300">
                    2. Evidencias de Subsanación / Corrección (Usuario Final)
                  </h4>
                  <p className="text-[11px] text-emerald-100/80">
                    El Usuario Final sube sus evidencias de respuesta aquí para detener y congelar el cronómetro
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-200">
                  {userFinalEvidencias.length} / 4 Fotos
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const filled = userFinalEvidencias.map((e: EvidencePhoto) => e.slotIndex || 1);
                    let s = 1;
                    for (let i = 1; i <= 4; i++) {
                      if (!filled.includes(i)) {
                        s = i;
                        break;
                      }
                    }
                    setTargetSlot(s);
                    userFinalFileInputRef.current?.click();
                  }}
                  disabled={userFinalEvidencias.length >= 4}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded transition-colors cursor-pointer shadow-xs"
                  title="Subir foto de respuesta del Usuario Final"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Subir Evidencia Final</span>
                </button>
              </div>
            </div>

            {/* User Final Content */}
            <div className="p-3 sm:p-4 space-y-4">
              {/* Notice when cronometer is running */}
              {!isTimerFrozen && record.inspectorSubmittedAt && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-center gap-2 animate-pulse">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    <strong>Cronómetro corriendo:</strong> Al subir tus evidencias o guardar tu respuesta abajo, el cronómetro se detendrá y se registrará el tiempo exacto que tomó resolver este punto.
                  </span>
                </div>
              )}

              {/* When already resolved / frozen */}
              {isTimerFrozen && (
                <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      <strong>Cronómetro congelado permanentemente:</strong> Tiempo total de respuesta: <strong>{record.timerElapsedSeconds ? formatSecondsHuman(record.timerElapsedSeconds) : 'Registrado'}</strong> ({record.userFinalSubmittedAt ? new Date(record.userFinalSubmittedAt).toLocaleString('es-MX') : 'Finalizado'}).
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-emerald-800 text-white px-2 py-0.5 rounded">
                    CONGELADO
                  </span>
                </div>
              )}

              {/* Photo Slots for User Final */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[1, 2, 3, 4].map((slotNum) => {
                  const photo = userFinalEvidencias.find((p: EvidencePhoto) => (p.slotIndex || 1) === slotNum);
                  return (
                    <div
                      key={`usr-slot-${slotNum}`}
                      className={`relative rounded-lg border overflow-hidden aspect-video sm:aspect-square flex flex-col items-center justify-center transition-all bg-white ${
                        photo ? 'border-emerald-400 shadow-xs' : 'border-dashed border-emerald-300/80 bg-emerald-50/40'
                      }`}
                    >
                      {photo ? (
                        <>
                          <img
                            src={photo.dataUrl}
                            alt={`Evidencia Subsanación ${slotNum}`}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => {
                              setActiveGallerySection('userFinal');
                              const idx = userFinalEvidencias.findIndex((p: EvidencePhoto) => p.id === photo.id);
                              if (idx >= 0) setSelectedPhotoIndex(idx);
                            }}
                          />
                          <div className="absolute top-1 left-1 px-1.5 py-0.2 bg-emerald-950/90 text-emerald-300 text-[9px] font-mono font-bold rounded">
                            Respuesta {slotNum}
                          </div>
                          <div className="absolute bottom-1 right-1 flex items-center gap-1 bg-black/70 p-0.5 rounded">
                            <button
                              type="button"
                              onClick={() => handleDownload(photo, slotNum - 1, 'Subsanacion')}
                              className="p-1 text-white hover:text-emerald-300"
                              title="Descargar"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUserFinalPhoto(photo.id)}
                              className="p-1 text-red-300 hover:text-red-100"
                              title="Eliminar foto"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-2 text-emerald-700/60">
                          <span className="block text-[10px] font-mono font-bold mb-1">
                            Respuesta {slotNum}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetSlot(slotNum);
                              userFinalFileInputRef.current?.click();
                            }}
                            className="px-2 py-1 text-[10px] font-semibold bg-white border border-emerald-300 hover:border-emerald-600 rounded text-emerald-800 transition-colors shadow-2xs cursor-pointer"
                          >
                            + Subir Foto
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* User Final Notes / Justification */}
              <div className="bg-white border border-emerald-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-700" />
                    Observaciones y Justificación de la Subsanación (Usuario Final)
                  </span>
                  {record.userFinalSubmittedAt && (
                    <span className="text-[10px] font-mono text-neutral-500 font-normal">
                      Subido: {new Date(record.userFinalSubmittedAt).toLocaleDateString('es-MX')} {new Date(record.userFinalSubmittedAt).toLocaleTimeString('es-MX')}
                    </span>
                  )}
                </div>

                <textarea
                  rows={2}
                  value={userFinalNotes}
                  onChange={(e) => setUserFinalNotes(e.target.value)}
                  placeholder="Escribe la justificación, solución implementada o comentarios del Usuario Final..."
                  className="w-full text-xs p-2.5 border border-emerald-200 rounded focus:ring-1 focus:ring-emerald-700 focus:outline-none bg-emerald-50/30 text-neutral-900"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-neutral-500 italic">
                    * Guarda las evidencias y observaciones de subsanación del Usuario Final.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveUserFinalResponse}
                    disabled={isSavingUserFinal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar Evidencias de Usuario Final</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-3 sm:p-4 border-t border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-neutral-500 font-mono">
            <span>
              Total: {inspectorEvidences.length} evidencias auditoría · {userFinalEvidencias.length} evidencias respuesta
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAdminOrCoord && onOpenEditModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditModal();
                }}
                className="px-3 py-1.5 text-xs font-semibold text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Editar Calificación</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
