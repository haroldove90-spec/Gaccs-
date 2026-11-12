import React from 'react';
import { MainNavSection, UserSession } from '../types';
import {
  Map,
  LayoutDashboard,
  Building2,
  Factory,
  FileSpreadsheet,
  Users,
  User,
  History,
  Database,
  LogOut,
  Home,
  ClipboardCheck,
} from 'lucide-react';

interface BottomNavBarProps {
  currentSection: MainNavSection;
  setCurrentSection: (section: MainNavSection) => void;
  user?: UserSession;
  onLogout?: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentSection,
  setCurrentSection,
  user,
  onLogout,
}) => {
  const allNavItems: { id: MainNavSection; label: string; icon: React.ElementType }[] = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'mapa', label: 'Mapa', icon: Map },
    { id: 'metricas', label: 'Métricas', icon: LayoutDashboard },
    { id: 'estaciones', label: 'Estaciones', icon: Building2 },
    { id: 'zoho', label: 'Formulario', icon: ClipboardCheck },
    { id: 'evaluaciones', label: 'Eval.', icon: FileSpreadsheet },
    { id: 'supabase', label: 'Supabase', icon: Database },
    { id: 'perfil', label: 'Perfil', icon: User },
  ];

  // Para Usuario final: activar todos los módulos de estaciones y plantas, y perfil (excluyendo administración)
  const navItems =
    user?.role === 'Usuario final'
      ? allNavItems.filter((item) => item.id !== 'supabase' && item.id !== 'zoho')
      : allNavItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c323f] border-t border-[#184d5e] text-[#d3e3e8] px-1 py-1 flex items-center justify-between w-full max-w-full overflow-hidden shadow-2xl safe-area-bottom">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          currentSection === item.id ||
          (item.id === 'estaciones' && ['mapa', 'metricas', 'estaciones', 'evaluaciones'].includes(currentSection)) ||
          (item.id === 'plantas' && ['plantas_mapa', 'plantas_metricas', 'plantas', 'plantas_evaluaciones'].includes(currentSection));
        return (
          <button
            key={item.id}
            onClick={() => setCurrentSection(item.id)}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 rounded text-[10px] font-medium transition-all ${
              isActive
                ? 'text-white bg-[#164e5e] font-semibold'
                : 'text-[#8ea7af] hover:text-white'
            }`}
          >
            <Icon className={`w-4 h-4 mb-0.5 shrink-0 ${isActive ? 'text-[#38bdf8]' : 'text-[#8ea7af]'}`} />
            <span className="truncate w-full text-center leading-tight block text-[10px]">
              {item.label}
            </span>
          </button>
        );
      })}

      {onLogout && (
        <button
          onClick={onLogout}
          className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 rounded text-[10px] font-bold text-red-300 hover:text-white hover:bg-red-900/50 transition-all cursor-pointer"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4 mb-0.5 shrink-0 text-red-400" />
          <span className="truncate w-full text-center leading-tight block text-[10px]">
            Salir
          </span>
        </button>
      )}
    </nav>
  );
};
