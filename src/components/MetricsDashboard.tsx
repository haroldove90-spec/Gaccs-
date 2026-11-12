import React, { useState } from 'react';
import { StationEvaluationRecord, UserSession, UserRole } from '../types';
import { INITIAL_STATION_MASTERS } from '../data/initialData';
import { Calendar, TrendingUp, ShieldCheck, ClipboardCheck, Eye, Sparkles } from 'lucide-react';

interface MetricsDashboardProps {
  records: StationEvaluationRecord[];
  onNavigateToStations: () => void;
  onNavigateToEvaluaciones: () => void;
  user?: UserSession;
  isAdminAccount?: boolean;
  onAdminSwitchRole?: (role: UserRole) => void;
  title?: string;
  entityLabel?: string;
  customMasters?: typeof INITIAL_STATION_MASTERS;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  records,
  onNavigateToStations,
  onNavigateToEvaluaciones,
  user,
  isAdminAccount = false,
  onAdminSwitchRole,
  title = 'Tablero de Control y Métricas',
  entityLabel = 'Estaciones',
  customMasters,
}) => {
  const effectiveMasters = customMasters !== undefined ? customMasters : (records && records.length > 0 ? INITIAL_STATION_MASTERS : []);

  // Active period derived dynamically from records
  const activePeriod = React.useMemo(() => {
    if (records.length === 0) return 'Sin registros';
    const lastRec = records.slice().reverse().find((r) => r.mes);
    return lastRec?.mes ? String(lastRec.mes).toLowerCase() : 'sin registros';
  }, [records]);

  // Compute dynamic stats based on masters & records
  const totalStations = effectiveMasters.length;
  const closedEvals = records.length > 0 ? totalStations : 0;
  const avgNational = totalStations > 0 && records.length > 0
    ? Math.round(effectiveMasters.reduce((acc, curr) => acc + curr.calificacion, 0) / totalStations)
    : 0;
  const withObservations = records.length > 0 ? effectiveMasters.filter((m) => m.estatus === 'Observación').length : 0;
  const criticalCases = records.length > 0 ? effectiveMasters.filter((m) => m.estatus === 'Crítico').length : 0;
  const cumpleCount = records.length > 0 ? effectiveMasters.filter((m) => m.estatus === 'Cumple').length : 0;

  // States data for the bar chart dynamically computed
  const stateData = React.useMemo(() => {
    if (effectiveMasters.length === 0 || records.length === 0) return [];
    const grouped: Record<string, { totalScore: number; count: number }> = {};
    effectiveMasters.forEach((m) => {
      const st = m.estado || 'General';
      if (!grouped[st]) grouped[st] = { totalScore: 0, count: 0 };
      grouped[st].totalScore += m.calificacion;
      grouped[st].count += 1;
    });

    return Object.entries(grouped)
      .map(([state, data]) => {
        const score = Math.round(data.totalScore / (data.count || 1));
        const status = score >= 85 ? 'cumple' : score >= 80 ? 'observacion' : 'critico';
        return { state, score, status };
      })
      .sort((a, b) => b.score - a.score);
  }, [effectiveMasters, records.length]);

  // Incidences data dynamically computed from records with zero or partial scores
  const incidenceData = React.useMemo(() => {
    const rubroCount: Record<string, number> = {
      'Señalización': 0,
      'Extintores': 0,
      'Condiciones Eléctricas': 0,
      'Aspectos Mecánicos': 0,
      'Paros de Emergencia': 0,
    };

    records.forEach((r) => {
      const cal = String(r.calificacion).trim();
      const num = Number(cal);
      const isFinding = cal === '0' || cal === '2' || (!isNaN(num) && num < 5 && num >= 0);
      if (isFinding) {
        const text = `${r.punto} ${r.observaciones || ''}`.toLowerCase();
        if (text.includes('senal') || text.includes('senaltica') || text.includes('letrero') || r.rubroId === 4) {
          rubroCount['Señalización'] += 1;
        } else if (text.includes('extint') || text.includes('fuego') || text.includes('presion') || r.rubroId === 3) {
          rubroCount['Extintores'] += 1;
        } else if (text.includes('electr') || text.includes('tierra') || text.includes('cable') || r.rubroId === 1) {
          rubroCount['Condiciones Eléctricas'] += 1;
        } else if (text.includes('paro') || text.includes('emergencia') || text.includes('alarma') || r.rubroId === 2) {
          rubroCount['Paros de Emergencia'] += 1;
        } else {
          rubroCount['Aspectos Mecánicos'] += 1;
        }
      }
    });

    return [
      { name: 'Señalización', count: rubroCount['Señalización'], color: 'bg-[#c2410c]' },
      { name: 'Extintores', count: rubroCount['Extintores'], color: 'bg-[#d97706]' },
      { name: 'Condiciones Eléctricas', count: rubroCount['Condiciones Eléctricas'], color: 'bg-[#0f766e]' },
      { name: 'Aspectos Mecánicos', count: rubroCount['Aspectos Mecánicos'], color: 'bg-[#0284c7]' },
      { name: 'Paros de Emergencia', count: rubroCount['Paros de Emergencia'], color: 'bg-[#16a34a]' },
    ];
  }, [records]);

  // Monthly historical trend dynamically computed from records
  const trendData = React.useMemo(() => {
    const monthScores: Record<string, { sum: number; count: number }> = {};
    records.forEach((r) => {
      if (!r.mes) return;
      const num = Number(r.calificacion);
      if (!isNaN(num) && num > 0) {
        const m = r.mes.charAt(0).toUpperCase() + r.mes.slice(1).toLowerCase();
        if (!monthScores[m]) monthScores[m] = { sum: 0, count: 0 };
        monthScores[m].sum += num;
        monthScores[m].count += 1;
      }
    });

    const entries = Object.entries(monthScores);
    if (entries.length === 0) {
      return [];
    }

    return entries.map(([month, data]) => ({
      month,
      score: Math.min(100, Math.round((data.sum / data.count) * 20)),
    }));
  }, [records]);

  // SVG calculations for donut chart (circumference = 2 * PI * r)
  const radius = 55;
  const circ = 2 * Math.PI * radius; // ~345.57
  const cumplePct = totalStations > 0 ? cumpleCount / totalStations : 0;
  const obsPct = totalStations > 0 ? withObservations / totalStations : 0;
  const critPct = totalStations > 0 ? criticalCases / totalStations : 0;

  const cumpleDash = cumplePct * circ;
  const obsDash = obsPct * circ;
  const critDash = critPct * circ;

  return (
    <div className="space-y-5 max-w-full overflow-hidden">
      {/* Title & Subtitle with active period pill and Role Switcher in header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 truncate">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5 leading-snug">
            Resultados consolidados de {entityLabel.toLowerCase()} revisadas, hallazgos y seguimiento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Quick Role Switcher Button Group in Header for Admin */}
          {(isAdminAccount || user?.role === 'Admin') && onAdminSwitchRole && (
            <div className="flex items-center gap-1 bg-neutral-950 text-white border border-neutral-700/80 p-1 rounded-xl shadow-xs">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider px-2 hidden sm:inline">
                Cambiar Rol:
              </span>
              <button
                type="button"
                onClick={() => onAdminSwitchRole('Admin')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  user?.role === 'Admin'
                    ? 'bg-amber-400 text-neutral-950 shadow-xs'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                }`}
                title="Cambiar a Rol Administrador"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
              <button
                type="button"
                onClick={() => onAdminSwitchRole('Coordinador')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  user?.role === 'Coordinador'
                    ? 'bg-cyan-400 text-neutral-950 shadow-xs'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                }`}
                title="Cambiar a Rol Coordinador"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Coord</span>
              </button>
              <button
                type="button"
                onClick={() => onAdminSwitchRole('Usuario final')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  user?.role === 'Usuario final'
                    ? 'bg-emerald-400 text-neutral-950 shadow-xs'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                }`}
                title="Cambiar a Rol Usuario final"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Usuario Final</span>
              </button>
            </div>
          )}

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e8f3f6] text-[#0c323f] border border-[#b2d5de] text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-[#144e5e]" />
            <span>Periodo activo: {activePeriod}</span>
          </div>
        </div>
      </div>

      {/* Banner de sincronización con Base de Datos */}
      {records.length === 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 sm:p-4 text-xs text-sky-900 flex items-center gap-3 shadow-2xs">
          <Sparkles className="w-5 h-5 text-sky-600 shrink-0" />
          <span>
            <strong>Sincronizado con Módulo 1 (Base de Datos):</strong> Actualmente la base de datos centralizada tiene 0 registros. Todas las métricas, promedios, cortes mensuales e incidencias se calcularán de forma automática cuando importes tu archivo Excel.
          </span>
        </div>
      )}

      {/* PANEL DESTACADO: NAVEGADOR INTERACTIVO DE LOS 3 ROLES (SUPER ADMIN) */}
      {(isAdminAccount || user?.role === 'Admin') && onAdminSwitchRole && (
        <div className="bg-gradient-to-br from-neutral-950 via-[#0d2a35] to-neutral-950 rounded-2xl p-4 sm:p-5 text-white shadow-md border border-neutral-800 ring-1 ring-neutral-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-neutral-700/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-400 text-neutral-950 rounded-xl shadow-xs shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black tracking-tight uppercase text-white">
                    Navegación en los 3 Roles del Sistema
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-neutral-950 px-2 py-0.5 rounded-full shadow-2xs">
                    Super Admin
                  </span>
                </div>
                <p className="text-xs text-neutral-300 mt-0.5">
                  Haz clic en cualquier rol para navegar la plataforma y experimentar exactamente sus pantallas y permisos:
                </p>
              </div>
            </div>

            <div className="text-xs font-mono bg-neutral-900/90 border border-neutral-700/80 px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-2">
              <span className="text-neutral-400">Rol activo:</span>
              <strong className="text-amber-300 font-bold uppercase">{user?.role || 'Admin'}</strong>
            </div>
          </div>

          {/* Tarjetas interactivas de los 3 Roles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3.5">
            {/* Rol 1: Administrador */}
            <button
              type="button"
              onClick={() => onAdminSwitchRole('Admin')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                user?.role === 'Admin'
                  ? 'bg-amber-400/15 border-amber-400 ring-2 ring-amber-400/50 shadow-md'
                  : 'bg-neutral-900/70 border-neutral-800 hover:bg-neutral-900 hover:border-amber-400/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${user?.role === 'Admin' ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-800 text-amber-400'}`}>
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <span className="font-extrabold text-xs uppercase tracking-wider text-white">
                      1. Administrador
                    </span>
                  </div>
                  {user?.role === 'Admin' ? (
                    <span className="text-[9px] font-black bg-amber-400 text-neutral-950 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Activo
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-neutral-400 group-hover:text-amber-300">
                      Cambiar →
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-300 leading-snug">
                  Acceso y control total. Administración de usuarios, base Supabase, cronómetro, auditorías y gestión completa.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-neutral-700/60 flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">Nivel:</span>
                <span className="font-bold text-amber-300">Control Total</span>
              </div>
            </button>

            {/* Rol 2: Coordinador */}
            <button
              type="button"
              onClick={() => onAdminSwitchRole('Coordinador')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                user?.role === 'Coordinador'
                  ? 'bg-cyan-500/20 border-cyan-400 ring-2 ring-cyan-400/50 shadow-md'
                  : 'bg-neutral-900/70 border-neutral-800 hover:bg-neutral-900 hover:border-cyan-400/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${user?.role === 'Coordinador' ? 'bg-cyan-400 text-neutral-950' : 'bg-neutral-800 text-cyan-400'}`}>
                      <ClipboardCheck className="w-4 h-4" />
                    </div>
                    <span className="font-extrabold text-xs uppercase tracking-wider text-white">
                      2. Coordinador
                    </span>
                  </div>
                  {user?.role === 'Coordinador' ? (
                    <span className="text-[9px] font-black bg-cyan-400 text-neutral-950 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Activo
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-neutral-400 group-hover:text-cyan-300">
                      Cambiar →
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-300 leading-snug">
                  Auditoría operativa de campo. Carga de evidencias y observaciones de inspección; inicia el cronómetro.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-neutral-700/60 flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">Nivel:</span>
                <span className="font-bold text-cyan-300">Auditoría / Campo</span>
              </div>
            </button>

            {/* Rol 3: Usuario Final */}
            <button
              type="button"
              onClick={() => onAdminSwitchRole('Usuario final')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                user?.role === 'Usuario final'
                  ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/50 shadow-md'
                  : 'bg-neutral-900/70 border-neutral-800 hover:bg-neutral-900 hover:border-emerald-400/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${user?.role === 'Usuario final' ? 'bg-emerald-400 text-neutral-950' : 'bg-neutral-800 text-emerald-400'}`}>
                      <Eye className="w-4 h-4" />
                    </div>
                    <span className="font-extrabold text-xs uppercase tracking-wider text-white">
                      3. Usuario Final
                    </span>
                  </div>
                  {user?.role === 'Usuario final' ? (
                    <span className="text-[9px] font-black bg-emerald-400 text-neutral-950 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Activo
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-neutral-400 group-hover:text-emerald-300">
                      Cambiar →
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-300 leading-snug">
                  Consulta de notas y evidencias del auditor. Carga sus evidencias de respuesta para congelar el cronómetro.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-neutral-700/60 flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">Nivel:</span>
                <span className="font-bold text-emerald-300">Estación / Respuesta</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 5 KPI Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5 max-w-full">
        {/* Card 1 */}
        <div
          onClick={onNavigateToStations}
          className="bg-white border border-neutral-200 border-t-4 border-t-[#0e7490] rounded-lg p-3 sm:p-4 shadow-xs cursor-pointer hover:shadow-sm transition-all min-w-0 overflow-hidden"
        >
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 font-mono tabular-nums leading-none">
            {totalStations}
          </div>
          <div className="text-xs font-semibold text-neutral-800 mt-2 truncate">
            {entityLabel} activas
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
            {totalStations > 0 ? `${new Set(effectiveMasters.map((m) => m.estado)).size} entidades con seguimiento` : '0 entidades con seguimiento'}
          </div>
        </div>

        {/* Card 2 */}
        <div
          onClick={onNavigateToEvaluaciones}
          className="bg-white border border-neutral-200 border-t-4 border-t-[#0e7490] rounded-lg p-3 sm:p-4 shadow-xs cursor-pointer hover:shadow-sm transition-all min-w-0 overflow-hidden"
        >
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 font-mono tabular-nums leading-none">
            {closedEvals}
          </div>
          <div className="text-xs font-semibold text-neutral-800 mt-2 truncate">
            Evaluaciones cerradas
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
            {records.length > 0 ? `${records.length} registros cargados` : '0 registros de evaluación'}
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-neutral-200 border-t-4 border-t-[#d97706] rounded-lg p-3 sm:p-4 shadow-xs min-w-0 overflow-hidden">
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 font-mono tabular-nums leading-none">
            {avgNational}%
          </div>
          <div className="text-xs font-semibold text-neutral-800 mt-2 truncate">
            Promedio nacional
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5 truncate">
            {records.length > 0 ? `${totalStations} evaluadas` : 'Sin registros'}
          </div>
        </div>

        {/* Card 4 */}
        <div
          onClick={onNavigateToStations}
          className="bg-white border border-neutral-200 border-t-4 border-t-[#c2410c] rounded-lg p-3 sm:p-4 shadow-xs cursor-pointer hover:shadow-sm transition-all min-w-0 overflow-hidden"
        >
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 font-mono tabular-nums leading-none">
            {withObservations}
          </div>
          <div className="text-xs font-semibold text-neutral-800 mt-2 truncate">
            Con observaciones
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
            {withObservations > 0 ? 'Hallazgos por atender' : 'Sin observaciones'}
          </div>
        </div>

        {/* Card 5 */}
        <div
          onClick={onNavigateToStations}
          className="bg-white border border-neutral-200 border-t-4 border-t-[#991b1b] rounded-lg p-3 sm:p-4 shadow-xs cursor-pointer hover:shadow-sm transition-all col-span-2 sm:col-span-1 min-w-0 overflow-hidden"
        >
          <div className="text-2xl sm:text-3xl font-bold text-neutral-900 font-mono tabular-nums leading-none">
            {criticalCases}
          </div>
          <div className="text-xs font-semibold text-neutral-800 mt-2 truncate">
            Casos críticos
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
            {criticalCases > 0 ? 'Requieren seguimiento' : 'Sin casos críticos'}
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-full">
        {/* Promedio por estado (Bar Chart - 2 cols on lg) */}
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-xs max-w-full overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-neutral-900 truncate">
                Promedio por estado
              </h3>
              <p className="text-xs text-neutral-500 truncate">
                Calificación de estaciones con evaluación vigente.
              </p>
            </div>
            <div className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd] shrink-0">
              Meta ≥ 85
            </div>
          </div>

          {/* Bar Chart with internal responsive scroll to prevent viewport overflow */}
          <div className="pt-2 max-w-full">
            {stateData.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center text-xs text-neutral-400 bg-neutral-50/50 rounded-lg border border-dashed border-neutral-200 p-4 text-center">
                <span>No hay datos por estado registrados aún.</span>
                <span className="text-[11px] text-neutral-400 mt-1">Importa registros en el Módulo 1 (Base de Datos) para ver el comparativo.</span>
              </div>
            ) : (
              <div className="overflow-x-auto max-w-full pb-2 no-scrollbar">
                <div className="h-60 min-w-[520px] sm:min-w-0 flex items-end justify-between gap-2 sm:gap-3 border-b border-neutral-200 pb-2 px-1">
                  {stateData.map((item) => {
                    const heightPct = Math.max(15, ((item.score - 65) / 35) * 100);
                    const barColor =
                      item.status === 'cumple'
                        ? 'bg-[#0e7490] hover:bg-[#155e75]'
                        : item.status === 'observacion'
                        ? 'bg-[#d97706] hover:bg-[#b45309]'
                        : 'bg-[#c2410c] hover:bg-[#9a3412]';

                    return (
                      <div
                        key={item.state}
                        className="flex-1 min-w-0 flex flex-col items-center h-full justify-end group relative"
                      >
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-neutral-900 text-white text-[10px] font-mono py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-10">
                          {item.state}: {item.score} pts
                        </div>

                        <span className="text-[10px] font-mono font-bold text-neutral-700 mb-1 tabular-nums">
                          {item.score}
                        </span>

                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full max-w-[48px] rounded-t-sm transition-all duration-300 ${barColor}`}
                        />

                        <span className="text-[10px] text-neutral-600 mt-2 font-medium truncate w-full text-center block">
                          {item.state}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Y-axis hint */}
            <div className="flex justify-between items-center text-[10px] text-neutral-400 font-mono pt-1.5">
              <span>Escala base 70</span>
              <span className="sm:hidden text-neutral-400 font-sans">← Desliza para ver todos los estados →</span>
              <span>100 Máx</span>
            </div>
          </div>
        </div>

        {/* Cumplimiento general (Donut Chart - 1 col on lg) */}
        <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-xs flex flex-col justify-between max-w-full overflow-hidden">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 truncate">
              Cumplimiento general
            </h3>
            <p className="text-xs text-neutral-500 truncate">
              Distribución de {totalStations} estaciones.
            </p>
          </div>

          <div className="my-4 sm:my-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            {/* SVG Donut */}
            <div className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="#e2e8f0"
                  strokeWidth="16"
                  fill="transparent"
                />

                {/* Cumple slice (Teal) */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="#0e7490"
                  strokeWidth="16"
                  fill="transparent"
                  strokeDasharray={`${cumpleDash} ${circ - cumpleDash}`}
                  strokeDashoffset="0"
                />

                {/* Observación slice (Amber) */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="#d97706"
                  strokeWidth="16"
                  fill="transparent"
                  strokeDasharray={`${obsDash} ${circ - obsDash}`}
                  strokeDashoffset={-cumpleDash}
                />

                {/* Crítico slice (Red) */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="#c2410c"
                  strokeWidth="16"
                  fill="transparent"
                  strokeDasharray={`${critDash} ${circ - critDash}`}
                  strokeDashoffset={-(cumpleDash + obsDash)}
                />
              </svg>

              {/* Center Metric */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 leading-tight">
                  {totalStations > 0 && records.length > 0 ? `${avgNational}%` : '0%'}
                </span>
                <span className="text-[10px] text-neutral-500 font-medium">
                  {totalStations > 0 && records.length > 0 ? 'promedio' : 'sin datos'}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 text-xs w-full sm:w-auto">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0e7490] shrink-0" />
                  <span className="text-neutral-700">Cumple</span>
                </div>
                <strong className="font-mono text-neutral-900 tabular-nums">
                  {cumpleCount}
                </strong>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d97706] shrink-0" />
                  <span className="text-neutral-700">Observación</span>
                </div>
                <strong className="font-mono text-neutral-900 tabular-nums">
                  {withObservations}
                </strong>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c2410c] shrink-0" />
                  <span className="text-neutral-700">Crítico</span>
                </div>
                <strong className="font-mono text-neutral-900 tabular-nums">
                  {criticalCases}
                </strong>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
            <span>Evaluaciones vigentes</span>
            <button
              onClick={onNavigateToStations}
              className="text-[#0e7490] hover:underline font-semibold"
            >
              Ver estaciones →
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Calificación mensual & Criterios con mayor incidencia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-full">
        {/* Calificación mensual */}
        <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-xs max-w-full overflow-hidden">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-neutral-900 truncate">
                Calificación mensual
              </h3>
              <p className="text-xs text-neutral-500 truncate">
                {trendData.length > 0 ? 'Cortes de evaluación registrados.' : 'Sin evaluaciones registradas aún.'}
              </p>
            </div>
            {trendData.length >= 2 && (
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Historial activo</span>
              </div>
            )}
          </div>

          {/* Monthly trend cards or clean zero-state message */}
          {trendData.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400 bg-neutral-50/50 rounded-lg border border-dashed border-neutral-200">
              Sin historial mensual disponible. Los cortes de evaluación aparecerán al importar registros en el Módulo 1 (Base de Datos).
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 max-w-full">
              {trendData.map((item, idx) => (
                <div
                  key={item.month}
                  className="p-2.5 sm:p-3 border border-neutral-100 bg-neutral-50 rounded-lg text-center min-w-0 overflow-hidden"
                >
                  <span className="text-[11px] text-neutral-500 block truncate">
                    {item.month}
                  </span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-neutral-900 block mt-0.5 tabular-nums">
                    {item.score}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono mt-0.5 block truncate">
                    Corte 0{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Criterios con mayor incidencia */}
        <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-xs max-w-full overflow-hidden">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-neutral-900 truncate">
              Criterios con mayor incidencia
            </h3>
            <p className="text-xs text-neutral-500 truncate">
              Hallazgos registrados en visitas técnicas de inspección.
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            {incidenceData.map((crit) => {
              const widthPct = (crit.count / 16) * 100;
              return (
                <div key={crit.name} className="min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1 gap-2">
                    <span className="font-medium text-neutral-700 truncate">{crit.name}</span>
                    <span className="font-mono font-bold text-neutral-900 tabular-nums shrink-0">
                      {crit.count} hallazgos
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                    <div
                      style={{ width: `${widthPct}%` }}
                      className={`h-full rounded-full ${crit.color}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
