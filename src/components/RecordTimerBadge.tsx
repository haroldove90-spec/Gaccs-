import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface RecordTimerBadgeProps {
  inspectorSubmittedAt?: string;
  userFinalSubmittedAt?: string;
  timerElapsedSeconds?: number;
  timerFrozen?: boolean;
  hasCalificacion?: boolean;
  isCompact?: boolean;
  variant?: 'compact' | 'badge' | 'panel';
}

export function formatSecondsToTime(totalSeconds: number): string {
  if (totalSeconds < 0 || isNaN(totalSeconds)) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function formatSecondsHuman(totalSeconds: number): string {
  if (totalSeconds < 0 || isNaN(totalSeconds)) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export const RecordTimerBadge: React.FC<RecordTimerBadgeProps> = ({
  inspectorSubmittedAt,
  userFinalSubmittedAt,
  timerElapsedSeconds,
  timerFrozen,
  hasCalificacion = true,
  isCompact = false,
  variant = 'badge',
}) => {
  const [now, setNow] = useState<number>(Date.now());

  const isRunning = Boolean(
    inspectorSubmittedAt && !timerFrozen && !userFinalSubmittedAt
  );
  const isCompleted = Boolean(
    timerFrozen || userFinalSubmittedAt
  );

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Si no tiene calificación, no se muestra cronómetro activo
  if (!hasCalificacion) {
    if (variant === 'panel') {
      return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-neutral-700 shrink-0" />
            <div>
              <div className="text-xs font-mono text-neutral-400">CRONÓMETRO INACTIVO</div>
              <div className="text-[11px] text-neutral-500">Sin calificación asignada</div>
            </div>
          </div>
          <span className="font-mono text-xl text-neutral-500 font-bold tracking-widest">--:--:--</span>
        </div>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-[10px] text-neutral-400 bg-neutral-100/90 border border-neutral-300/60 px-2 py-0.5 rounded select-none opacity-60"
        title="Sin calificación asignada: El cronómetro se activará cuando se registre la calificación correspondiente"
      >
        <Clock className="w-2.5 h-2.5 text-neutral-400" />
        <span className="tracking-wider">--:--</span>
      </span>
    );
  }

  // Si tiene calificación pero aún no ha subido evidencias el admin / coordinador (INACTIVO / ESPERA)
  if (!inspectorSubmittedAt) {
    if (variant === 'panel') {
      return (
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 sm:p-4 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Luz sólida inactiva: NO PARPADEA */}
            <div className="w-3.5 h-3.5 rounded-full bg-neutral-600 border border-neutral-500 shrink-0 shadow-inner" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono">
                  Cronómetro Inactivo
                </span>
                <span className="text-[9px] bg-neutral-800 text-neutral-400 font-bold px-2 py-0.5 rounded uppercase">
                  Luz fija / Sin parpadeo
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                En espera: Se activará automáticamente cuando el usuario comience a subir sus evidencias u observaciones desde su dashboard.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-2xl font-black tracking-widest text-neutral-400 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800 self-start sm:self-auto">
            <Clock className="w-4 h-4 text-neutral-500" />
            <span>00:00:00</span>
          </div>
        </div>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 font-mono select-none rounded-md bg-neutral-950 text-neutral-200 border border-neutral-700 shadow-xs transition-all ${
          isCompact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-xs'
        }`}
        title="En espera: El cronómetro comenzará a correr automáticamente cuando el usuario comience a subir sus evidencias u observaciones desde su dashboard."
      >
        <span className="w-2 h-2 rounded-full bg-neutral-500 shrink-0" />
        <Clock className="w-3 h-3 text-neutral-400" />
        <span className="font-black tracking-widest text-neutral-300">00:00</span>
        <span className="text-[8px] bg-neutral-800 text-neutral-400 px-1 py-0.2 rounded font-sans uppercase font-bold tracking-tight">
          Inactivo
        </span>
      </span>
    );
  }

  // 1. Cronómetro Congelado / Detenido definitivamente por Usuario Final (NO PARPADEA / LUZ VERDE FIJA)
  if (isCompleted) {
    let finalSeconds = timerElapsedSeconds;
    if (finalSeconds === undefined && inspectorSubmittedAt && userFinalSubmittedAt) {
      finalSeconds = Math.max(
        0,
        Math.floor(
          (new Date(userFinalSubmittedAt).getTime() -
            new Date(inspectorSubmittedAt).getTime()) /
            1000
        )
      );
    }
    const safeSeconds = finalSeconds || 0;
    const timeFormatted = formatSecondsToTime(safeSeconds);
    const humanFormatted = formatSecondsHuman(safeSeconds);

    if (variant === 'panel') {
      return (
        <div className="bg-neutral-950 border-2 border-emerald-500/80 rounded-xl p-3.5 sm:p-4 text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Luz fija verde esmeralda: DEJA DE PARPADEAR CUANDO ESTÁ INACTIVO/FINALIZADO */}
            <div className="relative flex h-4 w-4 shrink-0">
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 shadow-[0_0_12px_#10b981] border-2 border-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
                  Cronómetro Detenido y Congelado
                </span>
                <span className="text-[9px] bg-emerald-950 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-600 uppercase">
                  Luz fija / Inactivo permanente
                </span>
              </div>
              <div className="text-[11px] text-neutral-300 mt-0.5">
                Subsanado con evidencias y comentarios por el Usuario Final. Tiempo total: <strong className="text-emerald-300">{humanFormatted}</strong>.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-2xl sm:text-3xl font-black tracking-widest text-emerald-300 bg-neutral-900 px-4 py-1.5 rounded-lg border border-emerald-600/50 shadow-inner self-start sm:self-auto">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{timeFormatted}</span>
          </div>
        </div>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 font-mono font-black rounded-md select-none bg-neutral-950 text-white border-2 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.30)] ring-1 ring-emerald-500/40 transition-all ${
          isCompact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
        }`}
        title={`CRONÓMETRO CONGELADO Y PERMANENTE: El usuario final tardó ${humanFormatted} (${safeSeconds}s) en subir sus evidencias y comentarios.`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_#10b981]" />
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="tracking-widest text-white font-black">{timeFormatted}</span>
        <span className="text-[8px] bg-emerald-400 text-neutral-950 font-black px-1.5 py-0.2 rounded font-sans uppercase tracking-wider shadow-2xs">
          Congelado
        </span>
      </span>
    );
  }

  // 2. Cronómetro Corriendo en Vivo (ACTIVO: LUZ INTERMITENTE LLAMATIVA)
  const startMs = new Date(inspectorSubmittedAt).getTime();
  const currentElapsedSeconds = Math.max(0, Math.floor((now - startMs) / 1000));
  const timeFormatted = formatSecondsToTime(currentElapsedSeconds);

  if (variant === 'panel') {
    return (
      <div className="bg-neutral-950 border-2 border-amber-400 rounded-xl p-3.5 sm:p-4 text-white shadow-[0_0_25px_rgba(245,158,11,0.45)] ring-2 ring-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
        <div className="flex items-center gap-3.5">
          {/* LUZ INTERMITENTE LLAMATIVA (ESTROBO / PULSO VIVO INTENSO) */}
          <div className="relative flex h-5 w-5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-90 duration-700" />
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-5 w-5 bg-amber-400 shadow-[0_0_18px_#f59e0b] border-2 border-white ring-2 ring-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400 animate-spin text-[10px]" style={{ animationDuration: '4s' }} />
                Cronómetro Activo · Corriendo en Vivo
              </span>
              <span className="text-[9px] bg-amber-400 text-neutral-950 font-black px-2 py-0.5 rounded uppercase tracking-wider animate-bounce">
                ¡Luz Parpadeante Activa!
              </span>
            </div>
            <div className="text-[11px] text-amber-100/90 mt-0.5">
              Cronómetro en curso: Se activó al comenzar a subir evidencias desde el dashboard. Se detendrá y congelará al completar la carga.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-2xl sm:text-3xl font-black tracking-widest text-amber-300 bg-black/80 px-4 py-1.5 rounded-lg border-2 border-amber-400/80 shadow-[inset_0_0_15px_rgba(245,158,11,0.3)] self-start sm:self-auto">
          <span>{timeFormatted}</span>
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-black rounded-md select-none bg-neutral-950 text-white border-2 border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.50)] ring-1 ring-amber-400/60 transition-all ${
        isCompact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      }`}
      title={`CRONÓMETRO EN VIVO: Corriendo desde que Admin/Coordinador subió evidencias (${new Date(inspectorSubmittedAt).toLocaleTimeString('es-MX')}). Se detendrá y congelará de forma definitiva cuando el Usuario Final suba sus evidencias.`}
    >
      {/* Luz intermitente llamativa */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-90" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 shadow-[0_0_8px_#f59e0b] border border-white" />
      </span>
      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span className="tracking-widest text-white font-black">{timeFormatted}</span>
      <span className="text-[8px] bg-amber-400 text-neutral-950 font-black px-1.5 py-0.2 rounded font-sans uppercase tracking-wider shadow-2xs">
        Activo
      </span>
    </span>
  );
};

export interface TimerLedIndicatorProps {
  inspectorSubmittedAt?: string;
  timerFrozen?: boolean;
  userFinalSubmittedAt?: string;
  className?: string;
  showTooltip?: boolean;
}

/**
 * Pequeño LED indicativo del estado del cronómetro:
 * - Rojo y parpadeando: Cronómetro ACTIVO (corriendo en vivo tras carga del coordinador).
 * - Verde estático: Cronómetro INACTIVO (en espera o ya detenido/congelado).
 */
export const TimerLedIndicator: React.FC<TimerLedIndicatorProps> = ({
  inspectorSubmittedAt,
  timerFrozen,
  userFinalSubmittedAt,
  className = '',
  showTooltip = true,
}) => {
  const isTimerActive = Boolean(
    inspectorSubmittedAt && !timerFrozen && !userFinalSubmittedAt
  );

  if (isTimerActive) {
    return (
      <span
        className={`relative inline-flex items-center justify-center h-2.5 w-2.5 shrink-0 ${className}`}
        title={
          showTooltip
            ? 'Cronómetro ACTIVO (Parpadeando en rojo) - En espera de subsanación del Usuario Final'
            : undefined
        }
      >
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-90 duration-700" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 border border-white shadow-[0_0_8px_#ef4444]" />
      </span>
    );
  }

  // Cronómetro INACTIVO: LED VERDE ESTÁTICO (Sin parpadeo)
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full bg-emerald-500 border border-emerald-700 shrink-0 shadow-2xs ${className}`}
      title={showTooltip ? 'Cronómetro INACTIVO (Verde estático)' : undefined}
    />
  );
};
