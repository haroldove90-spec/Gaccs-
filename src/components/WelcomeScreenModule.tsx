import React from 'react';
import { UserSession, MainNavSection } from '../types';
import { ShieldCheck, Clock } from 'lucide-react';

interface WelcomeScreenModuleProps {
  user: UserSession;
  onNavigateTo?: (section: MainNavSection) => void;
}

export const WelcomeScreenModule: React.FC<WelcomeScreenModuleProps> = ({
  user,
  onNavigateTo,
}) => {
  return (
    <div className="relative w-full min-h-[calc(100vh-65px)] md:min-h-[calc(100vh-60px)] flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden rounded-2xl select-none">
      {/* 1. IMAGEN DE FONDO (DIAGRAMA TÉCNICO OFICIAL DE PLANTA) */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-100"
        style={{
          backgroundImage: `url('https://yybannuorhqsykqagkwz.supabase.co/storage/v1/object/public/planta/05.jpg')`,
        }}
      />

      {/* 2. CAPA CON DIFUMINADO NEGRO PROFUNDO COMO LA MUESTRA */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/75 to-black/85 backdrop-blur-[2px]" />

      {/* 3. TARJETA CENTRAL DE BIENVENIDA (ESTILO GLASS TRANSLÚCIDO) */}
      <div className="relative z-10 max-w-2xl w-full bg-neutral-900/80 backdrop-blur-md border border-neutral-700/60 rounded-3xl p-6 sm:p-10 md:p-12 text-center text-white shadow-2xl space-y-6">
        
        {/* Badge de seguridad superior */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 text-xs font-semibold tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>Acceso Autorizado al Sistema</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* Título de bienvenida con el nombre del usuario */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
            Bienvenido, <span className="text-amber-400">{user.name}</span>
          </h1>
          <p className="text-sm sm:text-base font-medium text-neutral-300 tracking-wide">
            GACCS — Sistema de Plantas y Estaciones v1.0
          </p>
          <p className="text-xs text-neutral-400 font-mono tracking-wider uppercase">
            Gestión · Análisis · Capacitación · Control · Seguimiento
          </p>
        </div>

        {/* Metadatos de la sesión activa */}
        <div className="inline-flex flex-wrap items-center justify-center gap-2 pt-1 pb-2">
          <span className="px-2.5 py-1 rounded-lg bg-neutral-800/80 border border-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-neutral-400">Rol:</span>
            <span className="font-bold text-white">{user.role}</span>
          </span>

          {user.role === 'Usuario final' && user.assignedStates && user.assignedStates.length > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-200 text-xs font-medium">
              <span className="text-[10px] uppercase font-bold text-cyan-400 mr-1">Estados:</span>
              <span className="font-semibold">{user.assignedStates.join(', ')}</span>
            </span>
          )}

          <span className="px-2.5 py-1 rounded-lg bg-neutral-800/80 border border-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Período Vigente: Septiembre 2026</span>
          </span>
        </div>

        {/* Separador sutil */}
        <div className="h-px w-24 bg-gradient-to-r from-transparent via-neutral-600 to-transparent mx-auto" />

      </div>
    </div>
  );
};
