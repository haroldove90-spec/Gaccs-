import React from 'react';
import { UserSession, MainNavSection, EvalSubModule, UserRole } from '../types';
import { Upload, LogOut, ShieldCheck, ClipboardCheck, Eye, Sparkles } from 'lucide-react';

interface TopHeaderProps {
  currentSection: MainNavSection;
  setCurrentSection?: (section: MainNavSection) => void;
  currentEvalSubModule: EvalSubModule;
  setCurrentEvalSubModule: (sub: EvalSubModule) => void;
  currentPlantEvalSubModule?: EvalSubModule;
  setCurrentPlantEvalSubModule?: (sub: EvalSubModule) => void;
  user: UserSession;
  isAdminAccount?: boolean;
  onAdminSwitchRole?: (role: UserRole) => void;
  onLogout: () => void;
  onOpenImportModal: () => void;
  onNavigateToProfile: () => void;
  onSwitchRole?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
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
  onNavigateToProfile,
  onSwitchRole,
}) => {
  const isReadOnly = user.role === 'Usuario final';

  const getTitle = () => {
    switch (currentSection) {
      case 'inicio':
        return 'Inicio';
      case 'mapa':
        return 'Mapa de estaciones';
      case 'metricas':
        return 'Métricas de Estaciones';
      case 'estaciones':
        return 'Estaciones';
      case 'evaluaciones':
        return 'Evaluaciones de Estaciones';
      case 'plantas_mapa':
        return 'Mapa de plantas';
      case 'plantas_metricas':
        return 'Métricas de Plantas';
      case 'plantas':
        return 'Plantas';
      case 'plantas_evaluaciones':
        return 'Evaluaciones de Plantas';
      case 'usuarios':
        return 'Usuarios';
      case 'supabase':
        return 'Base de Datos Supabase';
      case 'historial':
        return 'Historial de Archivos';
      case 'zoho':
        return 'Formulario Estaciones - Inspección & Auditoría';
      case 'perfil':
        return 'Mi Perfil';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-neutral-200">
      <div className="px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <img
            src="https://appdesignproyectos.com/gaccs.png"
            alt="GACCS"
            className="h-7 sm:h-8 w-auto object-contain shrink-0"
          />
          <div className="h-5 w-px bg-neutral-200 hidden xs:block" />
          <h1 className="text-base sm:text-xl md:text-2xl font-bold tracking-tight text-neutral-950 truncate">
            {getTitle()}
          </h1>

          {/* Sub-tabs if inside 1. Estaciones */}
          {['mapa', 'metricas', 'estaciones'].includes(currentSection) && setCurrentSection && (
            <div className="hidden lg:flex items-center gap-1 p-0.5 bg-neutral-100 rounded-lg text-xs shrink-0">
              <button
                onClick={() => setCurrentSection('mapa')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  currentSection === 'mapa'
                    ? 'bg-white text-neutral-900 shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Mapa de estaciones
              </button>
              <button
                onClick={() => setCurrentSection('metricas')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  currentSection === 'metricas'
                    ? 'bg-white text-neutral-900 shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Métricas
              </button>
              <button
                onClick={() => setCurrentSection('estaciones')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  currentSection === 'estaciones'
                    ? 'bg-white text-neutral-900 shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Estaciones
              </button>
            </div>
          )}

          {/* Sub-tabs if inside Evaluaciones de Estaciones */}
          {currentSection === 'evaluaciones' && (
            <div className="hidden lg:flex items-center gap-1 p-0.5 bg-neutral-100 rounded-lg text-xs shrink-0">
              <button
                onClick={() => setCurrentEvalSubModule('modulo1')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  currentEvalSubModule === 'modulo1'
                    ? 'bg-white text-neutral-900 shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Módulo 1: Base de Datos
              </button>
              <button
                onClick={() => setCurrentEvalSubModule('modulo2')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  currentEvalSubModule === 'modulo2'
                    ? 'bg-white text-neutral-900 shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Módulo 2: Por Estación
              </button>
              <button
                onClick={() => setCurrentEvalSubModule('modulo3')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  currentEvalSubModule === 'modulo3'
                    ? 'bg-white text-neutral-900 shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Módulo 3: Matriz General
              </button>
            </div>
          )}

          {/* Sub-tabs if inside 2. Plantas */}
          {['plantas_mapa', 'plantas_metricas', 'plantas'].includes(currentSection) && setCurrentSection && (
            <div className="hidden lg:flex items-center gap-1 p-0.5 bg-neutral-100 rounded-lg text-xs shrink-0">
              <button
                onClick={() => setCurrentSection('plantas_mapa')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  currentSection === 'plantas_mapa'
                    ? 'bg-white text-neutral-900 shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Mapa de plantas
              </button>
              <button
                onClick={() => setCurrentSection('plantas_metricas')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  currentSection === 'plantas_metricas'
                    ? 'bg-white text-neutral-900 shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Métricas
              </button>
              <button
                onClick={() => setCurrentSection('plantas')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  currentSection === 'plantas'
                    ? 'bg-white text-neutral-900 shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Plantas
              </button>
            </div>
          )}

          {/* Sub-tabs if inside Evaluaciones de Plantas */}
          {currentSection === 'plantas_evaluaciones' && (
            <div className="hidden lg:flex items-center gap-1 p-0.5 bg-neutral-100 rounded-lg text-xs shrink-0">
              <button
                onClick={() => (setCurrentPlantEvalSubModule ? setCurrentPlantEvalSubModule('modulo1') : setCurrentEvalSubModule('modulo1'))}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  (currentPlantEvalSubModule || currentEvalSubModule) === 'modulo1'
                    ? 'bg-white text-neutral-900 shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Módulo 1: Base de Datos
              </button>
              <button
                onClick={() => (setCurrentPlantEvalSubModule ? setCurrentPlantEvalSubModule('modulo2') : setCurrentEvalSubModule('modulo2'))}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  (currentPlantEvalSubModule || currentEvalSubModule) === 'modulo2'
                    ? 'bg-white text-neutral-900 shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Módulo 2: Por Planta
              </button>
              <button
                onClick={() => (setCurrentPlantEvalSubModule ? setCurrentPlantEvalSubModule('modulo3') : setCurrentEvalSubModule('modulo3'))}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  (currentPlantEvalSubModule || currentEvalSubModule) === 'modulo3'
                    ? 'bg-white text-neutral-900 shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Módulo 3: Matriz General
              </button>
            </div>
          )}
        </div>

        {/* Right side controls: Role Navigator (Admin only) + Profile + Cerrar Sesión */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* EXCLUSIVO ADMIN: Navegación entre los 3 Roles */}
          {(isAdminAccount || user.role === 'Admin') && onAdminSwitchRole && (
            <div className="flex items-center gap-1 p-1 bg-amber-50/95 border border-amber-300 rounded-xl shadow-xs">
              <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider px-1.5 hidden md:inline">
                Rol:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onAdminSwitchRole('Admin')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    user.role === 'Admin'
                      ? 'bg-[#0c323f] text-white shadow-xs ring-1 ring-amber-400'
                      : 'text-neutral-700 hover:bg-amber-100 hover:text-neutral-900'
                  }`}
                  title="Navegar como Administrador (Control total)"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => onAdminSwitchRole('Coordinador')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    user.role === 'Coordinador'
                      ? 'bg-[#0891b2] text-white shadow-xs ring-1 ring-cyan-300'
                      : 'text-neutral-700 hover:bg-amber-100 hover:text-neutral-900'
                  }`}
                  title="Navegar como Coordinador (Auditoría)"
                >
                  <ClipboardCheck className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span>Coord</span>
                </button>

                <button
                  type="button"
                  onClick={() => onAdminSwitchRole('Usuario final')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    user.role === 'Usuario final'
                      ? 'bg-neutral-900 text-white shadow-xs ring-1 ring-emerald-300'
                      : 'text-neutral-700 hover:bg-amber-100 hover:text-neutral-900'
                  }`}
                  title="Navegar como Usuario final (Solo lectura / Estación)"
                >
                  <Eye className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                  <span>Usuario</span>
                </button>
              </div>
            </div>
          )}

          {/* Usuario Final: Permisos de estados autorizados */}
          {user.role === 'Usuario final' && user.assignedStates && user.assignedStates.length > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 border border-cyan-200 text-cyan-900 rounded-lg text-xs font-medium">
              <span className="text-[10px] uppercase font-bold text-cyan-700">Estados:</span>
              <span className="font-semibold">{user.assignedStates.join(', ')}</span>
            </div>
          )}

          {/* Role badge with avatar */}
          <div
            onClick={onNavigateToProfile}
            className="cursor-pointer border border-neutral-200 bg-white hover:bg-neutral-50 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-800 shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
            title="Ver mi perfil"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-4 h-4 rounded-full object-cover border border-neutral-300 shrink-0"
              />
            ) : user.role === 'Admin' ? (
              <ShieldCheck className="w-4 h-4 text-[#0c323f]" />
            ) : user.role === 'Coordinador' ? (
              <ClipboardCheck className="w-4 h-4 text-[#0891b2]" />
            ) : (
              <Eye className="w-4 h-4 text-neutral-600" />
            )}
            <span className="font-semibold hidden sm:inline">{user.role}</span>
          </div>

          {/* BOTÓN CERRAR SESIÓN DESTACADO, SÓLIDO Y SIEMPRE VISIBLE */}
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 border border-red-700 rounded-lg transition-all shadow-xs cursor-pointer hover:shadow-sm active:scale-95 shrink-0"
            title="Cerrar sesión y salir del sistema"
          >
            <LogOut className="w-3.5 h-3.5 text-white shrink-0" />
            <span className="font-bold">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
};

