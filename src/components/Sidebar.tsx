import React from 'react';
import { MainNavSection, EvalSubModule, UserSession, UserRole } from '../types';
import { ImageSlider } from './ImageSlider';
import {
  Map,
  LayoutDashboard,
  Building2,
  Factory,
  FileSpreadsheet,
  Users,
  User,
  History,
  Upload,
  LogOut,
  ChevronDown,
  Database,
  ShieldCheck,
  ClipboardCheck,
  Eye,
  Layers,
  Home,
} from 'lucide-react';

interface SidebarProps {
  currentSection: MainNavSection;
  setCurrentSection: (section: MainNavSection) => void;
  currentEvalSubModule: EvalSubModule;
  setCurrentEvalSubModule: (sub: EvalSubModule) => void;
  currentPlantEvalSubModule?: EvalSubModule;
  setCurrentPlantEvalSubModule?: (sub: EvalSubModule) => void;
  user: UserSession;
  isAdminAccount?: boolean;
  onAdminSwitchRole?: (role: UserRole) => void;
  onLogout: () => void;
  onOpenImportModal: () => void;
  onOpenPurgeModal?: () => void;
  stationsCount?: number;
  plantsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  setCurrentSection,
  currentEvalSubModule,
  setCurrentEvalSubModule,
  currentPlantEvalSubModule = 'modulo1',
  setCurrentPlantEvalSubModule,
  user,
  isAdminAccount = false,
  onAdminSwitchRole,
  onLogout,
  onOpenImportModal,
  onOpenPurgeModal,
  stationsCount = 0,
  plantsCount = 0,
}) => {
  const isEstacionesSubActive = ['mapa', 'metricas', 'estaciones'].includes(currentSection);
  const isEvaluacionesActive = currentSection === 'evaluaciones';
  const isEstacionesGroupActive = isEstacionesSubActive || isEvaluacionesActive;

  const isPlantasSubActive = ['plantas_mapa', 'plantas_metricas', 'plantas'].includes(currentSection);
  const isPlantasEvaluacionesActive = currentSection === 'plantas_evaluaciones';
  const isPlantasGroupActive = isPlantasSubActive || isPlantasEvaluacionesActive;

  // Auto-expand submenus when the active section belongs to them (e.g. after refresh or navigation)
  const [estacionesOpen, setEstacionesOpen] = React.useState<boolean>(() => isEstacionesGroupActive);
  const [evaluacionesOpen, setEvaluacionesOpen] = React.useState<boolean>(() => isEvaluacionesActive);

  const [plantasOpen, setPlantasOpen] = React.useState<boolean>(() => isPlantasGroupActive);
  const [plantasEvaluacionesOpen, setPlantasEvaluacionesOpen] = React.useState<boolean>(() => isPlantasEvaluacionesActive);

  React.useEffect(() => {
    if (isEstacionesGroupActive) {
      setEstacionesOpen(true);
    }
    if (isEvaluacionesActive) {
      setEvaluacionesOpen(true);
    }
  }, [isEstacionesGroupActive, isEvaluacionesActive]);

  React.useEffect(() => {
    if (isPlantasGroupActive) {
      setPlantasOpen(true);
    }
    if (isPlantasEvaluacionesActive) {
      setPlantasEvaluacionesOpen(true);
    }
  }, [isPlantasGroupActive, isPlantasEvaluacionesActive]);

  return (
    <aside className="hidden md:flex flex-col w-64 bg-[#0c323f] text-[#d3e3e8] shrink-0 min-h-screen border-r border-[#144453] select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#144453]/60 space-y-3">
        {/* Logo GACCS centrado sin texto a un lado */}
        <div className="flex items-center justify-center">
          <img
            src="https://appdesignproyectos.com/gaccs.png"
            alt="GACCS"
            className="h-10 w-auto object-contain bg-white/95 px-2.5 py-1 rounded-lg shadow-sm"
          />
        </div>

        {/* Slider de imágenes abajo del logo */}
        <ImageSlider variant="sidebar" intervalMs={5000} />

        {/* Accent divider line */}
        <div className="h-0.5 w-12 bg-[#eab308] mx-auto rounded-full" />
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        {/* 0. INICIO / PANTALLA DE BIENVENIDA */}
        <button
          type="button"
          onClick={() => setCurrentSection('inicio')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            currentSection === 'inicio'
              ? 'bg-[#164e5e] text-white shadow-xs ring-1 ring-amber-400/40'
              : 'hover:bg-[#12414f] text-[#d3e3e8] hover:text-white'
          }`}
          title="Pantalla Principal / Bienvenida"
        >
          <div className="flex items-center gap-2.5">
            <Home className={`w-4 h-4 ${currentSection === 'inicio' ? 'text-amber-400' : 'text-[#8ea7af]'}`} />
            <span>Inicio</span>
          </div>
          <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">
            GACCS
          </span>
        </button>

        {/* 1. GRUPO: ESTACIONES Y SU SUBMENÚ */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setEstacionesOpen(!estacionesOpen)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isEstacionesGroupActive
                ? 'bg-[#164e5e] text-white shadow-xs'
                : 'hover:bg-[#12414f] text-[#d3e3e8] hover:text-white'
            }`}
            title="1. Estaciones: Desplegar submenú"
          >
            <div className="flex items-center gap-2.5">
              <Building2 className={`w-4 h-4 ${isEstacionesGroupActive ? 'text-[#38bdf8]' : 'text-[#8ea7af]'}`} />
              <div className="flex items-center gap-2">
                <span>1. Estaciones</span>
                <span className="text-[9px] bg-[#103a46] text-[#8ea7af] px-1.5 py-0.5 rounded font-mono font-bold">
                  {stationsCount}
                </span>
              </div>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#8ea7af] transition-transform duration-200 ${
                estacionesOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Submenú de 1. Estaciones */}
          {estacionesOpen && (
            <div className="border-l-2 border-[#164e5e]/80 ml-4 pl-2.5 my-1 space-y-1">
              {/* Mapa de Estaciones - Visible para todos los roles, incluyendo Usuario final */}
              <button
                type="button"
                onClick={() => setCurrentSection('mapa')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  currentSection === 'mapa'
                    ? 'bg-[#12414f] text-[#38bdf8] font-bold shadow-2xs'
                    : 'text-[#9cb5be] hover:text-white hover:bg-[#103a46]'
                }`}
              >
                <Map className={`w-3.5 h-3.5 ${currentSection === 'mapa' ? 'text-[#38bdf8]' : 'text-[#8ea7af]'}`} />
                <span>Mapa de estaciones</span>
              </button>

              {/* Submódulos de Estaciones */}
              {/* Métricas / Inicio */}
              <button
                type="button"
                onClick={() => setCurrentSection('metricas')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  currentSection === 'metricas'
                    ? 'bg-[#12414f] text-[#38bdf8] font-bold shadow-2xs'
                    : 'text-[#9cb5be] hover:text-white hover:bg-[#103a46]'
                }`}
              >
                <LayoutDashboard className={`w-3.5 h-3.5 ${currentSection === 'metricas' ? 'text-[#38bdf8]' : 'text-[#8ea7af]'}`} />
                <span>Métricas</span>
              </button>

                  {/* Estaciones */}
                  <button
                    type="button"
                    onClick={() => setCurrentSection('estaciones')}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      currentSection === 'estaciones'
                        ? 'bg-[#12414f] text-[#38bdf8] font-bold shadow-2xs'
                        : 'text-[#9cb5be] hover:text-white hover:bg-[#103a46]'
                    }`}
                  >
                    <Building2 className={`w-3.5 h-3.5 ${currentSection === 'estaciones' ? 'text-[#38bdf8]' : 'text-[#8ea7af]'}`} />
                    <span>Estaciones</span>
                  </button>

                  {/* Evaluaciones y su submenú (DENTRO del grupo de Estaciones) */}
                  <div className="pt-1.5 border-t border-[#144453]/60 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!evaluacionesOpen) {
                          setEvaluacionesOpen(true);
                          setCurrentSection('evaluaciones');
                        } else if (isEvaluacionesActive) {
                          setEvaluacionesOpen(!evaluacionesOpen);
                        } else {
                          setCurrentSection('evaluaciones');
                        }
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        isEvaluacionesActive
                          ? 'bg-[#12414f] text-[#38bdf8] shadow-2xs'
                          : 'text-[#d3e3e8] hover:text-white hover:bg-[#103a46]'
                      }`}
                      title="Evaluaciones: Desplegar submenú"
                    >
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className={`w-3.5 h-3.5 ${isEvaluacionesActive ? 'text-[#38bdf8]' : 'text-[#8ea7af]'}`} />
                        <span>Evaluaciones</span>
                      </div>
                      <ChevronDown
                        className={`w-3 h-3 text-[#8ea7af] transition-transform duration-200 ${
                          evaluacionesOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Submódulos de Evaluaciones */}
                    {evaluacionesOpen && (
                      <div className="border-l-2 border-[#195a6d] ml-3 pl-2 my-1 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentSection('evaluaciones');
                            setCurrentEvalSubModule('modulo1');
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10.5px] font-medium transition-all cursor-pointer ${
                            isEvaluacionesActive && currentEvalSubModule === 'modulo1'
                              ? 'bg-[#0e333e] text-[#38bdf8] font-bold'
                              : 'text-[#8ea7af] hover:text-white hover:bg-[#103a46]/70'
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isEvaluacionesActive && currentEvalSubModule === 'modulo1'
                                ? 'bg-[#38bdf8]'
                                : 'bg-[#627d86]'
                            }`}
                          />
                          <span className="truncate">Módulo 1: Base de Datos</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCurrentSection('evaluaciones');
                            setCurrentEvalSubModule('modulo2');
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10.5px] font-medium transition-all cursor-pointer ${
                            isEvaluacionesActive && currentEvalSubModule === 'modulo2'
                              ? 'bg-[#0e333e] text-[#38bdf8] font-bold'
                              : 'text-[#8ea7af] hover:text-white hover:bg-[#103a46]/70'
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isEvaluacionesActive && currentEvalSubModule === 'modulo2'
                                ? 'bg-[#38bdf8]'
                                : 'bg-[#627d86]'
                            }`}
                          />
                          <span className="truncate">Módulo 2: Por Estación</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCurrentSection('evaluaciones');
                            setCurrentEvalSubModule('modulo3');
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10.5px] font-medium transition-all cursor-pointer ${
                            isEvaluacionesActive && currentEvalSubModule === 'modulo3'
                              ? 'bg-[#0e333e] text-[#38bdf8] font-bold'
                              : 'text-[#8ea7af] hover:text-white hover:bg-[#103a46]/70'
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isEvaluacionesActive && currentEvalSubModule === 'modulo3'
                                ? 'bg-[#38bdf8]'
                                : 'bg-[#627d86]'
                            }`}
                          />
                          <span className="truncate">Módulo 3: Matriz General</span>
                        </button>
                      </div>
                    )}
                  </div>
            </div>
          )}
        </div>

        {/* 2. GRUPO: PLANTAS Y SU SUBMENÚ */}
        <div className="space-y-1 pt-1">
          <button
            type="button"
            onClick={() => setPlantasOpen(!plantasOpen)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isPlantasGroupActive
                ? 'bg-[#164e5e] text-white shadow-xs'
                : 'hover:bg-[#12414f] text-[#d3e3e8] hover:text-white'
            }`}
            title="2. Plantas: Desplegar submenú"
          >
            <div className="flex items-center gap-2.5">
              <Factory className={`w-4 h-4 ${isPlantasGroupActive ? 'text-[#38bdf8]' : 'text-[#8ea7af]'}`} />
              <div className="flex items-center gap-2">
                <span>2. Plantas</span>
                <span className="text-[9px] bg-[#103a46] text-[#8ea7af] px-1.5 py-0.5 rounded font-mono font-bold">
                  {plantsCount}
                </span>
              </div>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#8ea7af] transition-transform duration-200 ${
                plantasOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Submenú de 2. Plantas */}
          {plantasOpen && (
            <div className="border-l-2 border-[#164e5e]/80 ml-4 pl-2.5 my-1 space-y-1">
              {/* Mapa de Plantas - Visible para todos los roles, incluyendo Usuario final */}
              <button
                type="button"
                onClick={() => setCurrentSection('plantas_mapa')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  currentSection === 'plantas_mapa'
                    ? 'bg-[#12414f] text-[#38bdf8] font-bold shadow-2xs'
                    : 'text-[#9cb5be] hover:text-white hover:bg-[#103a46]'
                }`}
              >
                <Map className={`w-3.5 h-3.5 ${currentSection === 'plantas_mapa' ? 'text-[#38bdf8]' : 'text-[#8ea7af]'}`} />
                <span>Mapa de plantas</span>
              </button>

              {/* Submódulos de Plantas */}
              {/* Métricas / Inicio */}
              <button
                type="button"
                onClick={() => setCurrentSection('plantas_metricas')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  currentSection === 'plantas_metricas'
                    ? 'bg-[#12414f] text-[#38bdf8] font-bold shadow-2xs'
                    : 'text-[#9cb5be] hover:text-white hover:bg-[#103a46]'
                }`}
              >
                <LayoutDashboard className={`w-3.5 h-3.5 ${currentSection === 'plantas_metricas' ? 'text-[#38bdf8]' : 'text-[#8ea7af]'}`} />
                <span>Métricas</span>
              </button>

                  {/* Plantas */}
                  <button
                    type="button"
                    onClick={() => setCurrentSection('plantas')}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      currentSection === 'plantas'
                        ? 'bg-[#12414f] text-[#38bdf8] font-bold shadow-2xs'
                        : 'text-[#9cb5be] hover:text-white hover:bg-[#103a46]'
                    }`}
                  >
                    <Factory className={`w-3.5 h-3.5 ${currentSection === 'plantas' ? 'text-[#38bdf8]' : 'text-[#8ea7af]'}`} />
                    <span>Plantas</span>
                  </button>

                  {/* Evaluaciones y su submenú (DENTRO del grupo de Plantas) */}
                  <div className="pt-1.5 border-t border-[#144453]/60 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!plantasEvaluacionesOpen) {
                          setPlantasEvaluacionesOpen(true);
                          setCurrentSection('plantas_evaluaciones');
                        } else if (isPlantasEvaluacionesActive) {
                          setPlantasEvaluacionesOpen(!plantasEvaluacionesOpen);
                        } else {
                          setCurrentSection('plantas_evaluaciones');
                        }
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                        isPlantasEvaluacionesActive
                          ? 'bg-[#12414f] text-[#38bdf8] shadow-2xs'
                          : 'text-[#d3e3e8] hover:text-white hover:bg-[#103a46]'
                      }`}
                      title="Evaluaciones: Desplegar submenú"
                    >
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className={`w-3.5 h-3.5 ${isPlantasEvaluacionesActive ? 'text-[#38bdf8]' : 'text-[#8ea7af]'}`} />
                        <span>Evaluaciones</span>
                      </div>
                      <ChevronDown
                        className={`w-3 h-3 text-[#8ea7af] transition-transform duration-200 ${
                          plantasEvaluacionesOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Submódulos de Evaluaciones de Plantas */}
                    {plantasEvaluacionesOpen && (
                      <div className="border-l-2 border-[#195a6d] ml-3 pl-2 my-1 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentSection('plantas_evaluaciones');
                            if (setCurrentPlantEvalSubModule) {
                              setCurrentPlantEvalSubModule('modulo1');
                            }
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10.5px] font-medium transition-all cursor-pointer ${
                            isPlantasEvaluacionesActive && currentPlantEvalSubModule === 'modulo1'
                              ? 'bg-[#0e333e] text-[#38bdf8] font-bold'
                              : 'text-[#8ea7af] hover:text-white hover:bg-[#103a46]/70'
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isPlantasEvaluacionesActive && currentPlantEvalSubModule === 'modulo1'
                                ? 'bg-[#38bdf8]'
                                : 'bg-[#627d86]'
                            }`}
                          />
                          <span className="truncate">Módulo 1: Base de Datos</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCurrentSection('plantas_evaluaciones');
                            if (setCurrentPlantEvalSubModule) {
                              setCurrentPlantEvalSubModule('modulo2');
                            }
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10.5px] font-medium transition-all cursor-pointer ${
                            isPlantasEvaluacionesActive && currentPlantEvalSubModule === 'modulo2'
                              ? 'bg-[#0e333e] text-[#38bdf8] font-bold'
                              : 'text-[#8ea7af] hover:text-white hover:bg-[#103a46]/70'
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isPlantasEvaluacionesActive && currentPlantEvalSubModule === 'modulo2'
                                ? 'bg-[#38bdf8]'
                                : 'bg-[#627d86]'
                            }`}
                          />
                          <span className="truncate">Módulo 2: Por Planta</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCurrentSection('plantas_evaluaciones');
                            if (setCurrentPlantEvalSubModule) {
                              setCurrentPlantEvalSubModule('modulo3');
                            }
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10.5px] font-medium transition-all cursor-pointer ${
                            isPlantasEvaluacionesActive && currentPlantEvalSubModule === 'modulo3'
                              ? 'bg-[#0e333e] text-[#38bdf8] font-bold'
                              : 'text-[#8ea7af] hover:text-white hover:bg-[#103a46]/70'
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isPlantasEvaluacionesActive && currentPlantEvalSubModule === 'modulo3'
                                ? 'bg-[#38bdf8]'
                                : 'bg-[#627d86]'
                            }`}
                          />
                          <span className="truncate">Módulo 3: Matriz General</span>
                        </button>
                      </div>
                    )}
                  </div>
            </div>
          )}
        </div>

        {/* Separador de Módulos Generales */}
        <div className="pt-2 pb-1">
          <div className="h-px bg-[#144453]/70" />
        </div>

        {/* Formulario Estaciones - Auditoría & Formulario */}
        {user.role !== 'Usuario final' && (
          <button
            type="button"
            onClick={() => setCurrentSection('zoho')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentSection === 'zoho'
                ? 'bg-[#164e5e] text-white shadow-xs ring-1 ring-emerald-400/50'
                : 'hover:bg-[#12414f] text-[#d3e3e8] hover:text-white'
            }`}
            title="Formulario Estaciones: Inspección de 54 puntos, Historial y Exportación"
          >
            <div className="flex items-center gap-2.5">
              <ClipboardCheck className={`w-4 h-4 ${currentSection === 'zoho' ? 'text-emerald-400' : 'text-[#8ea7af]'}`} />
              <span>Formulario Estaciones</span>
            </div>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
              Form
            </span>
          </button>
        )}

        {/* Usuarios - Desactivado para Usuario final */}
        {user.role !== 'Usuario final' && (
          <button
            type="button"
            onClick={() => setCurrentSection('usuarios')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              currentSection === 'usuarios'
                ? 'bg-[#164e5e] text-white shadow-xs font-semibold'
                : 'hover:bg-[#12414f] text-[#d3e3e8] hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-[#8ea7af]" />
            <span>Usuarios</span>
          </button>
        )}

        {/* Base de Datos Supabase - Desactivado para Usuario final */}
        {user.role !== 'Usuario final' && (
          <button
            type="button"
            onClick={() => setCurrentSection('supabase')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              currentSection === 'supabase'
                ? 'bg-[#164e5e] text-white shadow-xs font-semibold'
                : 'hover:bg-[#12414f] text-[#d3e3e8] hover:text-white'
            }`}
          >
            <Database className="w-4 h-4 text-[#38bdf8]" />
            <span>Base Supabase</span>
          </button>
        )}

        {/* Historial - Desactivado para Usuario final */}
        {user.role !== 'Usuario final' && (
          <button
            type="button"
            onClick={() => setCurrentSection('historial')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              currentSection === 'historial'
                ? 'bg-[#164e5e] text-white shadow-xs font-semibold'
                : 'hover:bg-[#12414f] text-[#d3e3e8] hover:text-white'
            }`}
          >
            <History className="w-4 h-4 text-[#8ea7af]" />
            <span>Historial de Archivos</span>
          </button>
        )}

        {/* Perfil */}
        <button
          type="button"
          onClick={() => setCurrentSection('perfil')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            currentSection === 'perfil'
              ? 'bg-[#164e5e] text-white shadow-xs font-semibold'
              : 'hover:bg-[#12414f] text-[#d3e3e8] hover:text-white'
          }`}
        >
          <User className="w-4 h-4 text-[#8ea7af]" />
          <span>Perfil</span>
        </button>


        {/* NAVEGADOR DE ROLES EXCLUSIVO PARA ADMIN EN SIDEBAR */}
        {(isAdminAccount || user.role === 'Admin') && onAdminSwitchRole && (
          <div className="pt-3 border-t border-[#144453]/80">
            <span className="text-[10px] font-bold text-[#8ea7af] uppercase tracking-wider block mb-1.5 px-1">
              Navegar Rol (Admin):
            </span>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => onAdminSwitchRole('Admin')}
                className={`py-1.5 px-1 rounded text-[11px] font-semibold text-center transition-all ${
                  user.role === 'Admin'
                    ? 'bg-[#eab308] text-[#0c323f] shadow-xs'
                    : 'bg-[#103a46] text-[#d3e3e8] hover:bg-[#144e5e]'
                }`}
                title="Rol Admin"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => onAdminSwitchRole('Coordinador')}
                className={`py-1.5 px-1 rounded text-[11px] font-semibold text-center transition-all ${
                  user.role === 'Coordinador'
                    ? 'bg-[#0891b2] text-white shadow-xs'
                    : 'bg-[#103a46] text-[#d3e3e8] hover:bg-[#144e5e]'
                }`}
                title="Rol Coordinador"
              >
                Coord
              </button>
              <button
                type="button"
                onClick={() => onAdminSwitchRole('Usuario final')}
                className={`py-1.5 px-1 rounded text-[11px] font-semibold text-center transition-all ${
                  user.role === 'Usuario final'
                    ? 'bg-neutral-600 text-white shadow-xs'
                    : 'bg-[#103a46] text-[#d3e3e8] hover:bg-[#144e5e]'
                }`}
                title="Rol Usuario final (Solo lectura)"
              >
                Lectura
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* User Bottom Strip with Prominent Cerrar Sesión Button */}
      <div className="p-3 border-t border-[#144453] bg-[#092832]">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div
            onClick={() => setCurrentSection('perfil')}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 truncate flex-1"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover border border-[#2d6474]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#164e5e] text-white flex items-center justify-center font-bold text-xs uppercase border border-[#2d6474] shrink-0">
                {user.name.slice(0, 2)}
              </div>
            )}
            <div className="truncate min-w-0">
              <span className="text-xs font-semibold text-white block truncate leading-tight">
                {user.name}
              </span>
              <span className="text-[10px] text-[#8ea7af] block truncate">
                {user.role} {isAdminAccount && user.role !== 'Admin' && '(Vista simulada)'}
              </span>
            </div>
          </div>
        </div>

        {/* BOTÓN CERRAR SESIÓN DESTACADO */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-red-200 hover:text-white bg-red-950/60 hover:bg-red-900 border border-red-800/60 rounded-lg transition-all shadow-xs cursor-pointer active:scale-98"
          title="Cerrar sesión completamente y salir"
        >
          <LogOut className="w-3.5 h-3.5 text-red-400" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
};
