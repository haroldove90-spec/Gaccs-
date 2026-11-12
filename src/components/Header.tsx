import React from 'react';
import { UserSession } from '../types';
import { ShieldCheck, LogOut, FileSpreadsheet, Database, TableProperties, History, Upload } from 'lucide-react';

interface HeaderProps {
  currentModule: 'modulo1' | 'modulo2' | 'modulo3' | 'historial';
  setCurrentModule: (mod: 'modulo1' | 'modulo2' | 'modulo3' | 'historial') => void;
  user: UserSession;
  onLogout: () => void;
  onOpenImportModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentModule,
  setCurrentModule,
  user,
  onLogout,
  onOpenImportModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-neutral-900 bg-neutral-900 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-semibold tracking-tight text-neutral-950 block leading-tight">
                Evaluaciones
              </span>
              <span className="text-xs text-neutral-500 font-mono">
                Tablero de Seguridad & Estaciones
              </span>
            </div>
          </div>

          {/* Module Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setCurrentModule('modulo1')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-2 ${
                currentModule === 'modulo1'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
              }`}
            >
              <Database className="w-4 h-4" />
              Módulo 1: Base de Datos
            </button>

            <button
              onClick={() => setCurrentModule('modulo2')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-2 ${
                currentModule === 'modulo2'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Módulo 2: Por Estación
            </button>

            <button
              onClick={() => setCurrentModule('modulo3')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-2 ${
                currentModule === 'modulo3'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
              }`}
            >
              <TableProperties className="w-4 h-4" />
              Módulo 3: Matriz General
            </button>

            <button
              onClick={() => setCurrentModule('historial')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-2 ${
                currentModule === 'historial'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
              }`}
            >
              <History className="w-4 h-4" />
              Historial y Archivos
            </button>
          </nav>

          {/* Right Actions & User Profile */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded transition-colors"
              title="Importar archivo Excel de forma manual"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Excel</span>
            </button>

            <div className="h-4 w-px bg-neutral-200 hidden sm:block" />

            <div className="text-right hidden sm:block">
              <span className="text-xs font-medium text-neutral-900 block leading-tight">
                {user.name}
              </span>
              <span className="text-[11px] text-neutral-500 font-mono">
                {user.role} ({user.username})
              </span>
            </div>

            <button
              onClick={onLogout}
              className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex overflow-x-auto border-t border-neutral-200 px-4 py-2 gap-1 bg-white">
        <button
          onClick={() => setCurrentModule('modulo1')}
          className={`px-2.5 py-1 text-xs whitespace-nowrap rounded font-medium ${
            currentModule === 'modulo1' ? 'bg-neutral-900 text-white' : 'text-neutral-600'
          }`}
        >
          Módulo 1
        </button>
        <button
          onClick={() => setCurrentModule('modulo2')}
          className={`px-2.5 py-1 text-xs whitespace-nowrap rounded font-medium ${
            currentModule === 'modulo2' ? 'bg-neutral-900 text-white' : 'text-neutral-600'
          }`}
        >
          Módulo 2
        </button>
        <button
          onClick={() => setCurrentModule('modulo3')}
          className={`px-2.5 py-1 text-xs whitespace-nowrap rounded font-medium ${
            currentModule === 'modulo3' ? 'bg-neutral-900 text-white' : 'text-neutral-600'
          }`}
        >
          Módulo 3
        </button>
        <button
          onClick={() => setCurrentModule('historial')}
          className={`px-2.5 py-1 text-xs whitespace-nowrap rounded font-medium ${
            currentModule === 'historial' ? 'bg-neutral-900 text-white' : 'text-neutral-600'
          }`}
        >
          Historial
        </button>
      </div>
    </header>
  );
};
