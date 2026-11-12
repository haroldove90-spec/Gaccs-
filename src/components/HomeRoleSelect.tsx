import React from 'react';
import { UserSession, UserRole } from '../types';
import { ShieldCheck, UserCheck, Eye, ArrowRight, Sparkles } from 'lucide-react';

interface HomeRoleSelectProps {
  onSelectRole: (role: UserRole) => void;
}

export const HomeRoleSelect: React.FC<HomeRoleSelectProps> = ({ onSelectRole }) => {
  const rolesConfig: {
    role: UserRole;
    name: string;
    icon: React.ReactNode;
    colorClasses: string;
    badgeText: string;
    badgeClasses: string;
    description: string;
  }[] = [
    {
      role: 'Admin',
      name: 'Admin',
      icon: <ShieldCheck className="w-10 h-10 text-red-500 group-hover:scale-110 transition-transform duration-200" />,
      colorClasses: 'hover:border-red-500/60 hover:bg-red-950/20 hover:shadow-red-950/40',
      badgeText: 'Acceso Total',
      badgeClasses: 'bg-red-500/10 text-red-400 border-red-500/30',
      description: 'Control absoluto de edición, eliminación, observaciones y administración de usuarios.',
    },
    {
      role: 'Coordinador',
      name: 'Coordinador',
      icon: <UserCheck className="w-10 h-10 text-cyan-400 group-hover:scale-110 transition-transform duration-200" />,
      colorClasses: 'hover:border-cyan-500/60 hover:bg-cyan-950/20 hover:shadow-cyan-950/40',
      badgeText: 'Acceso Operativo Total',
      badgeClasses: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      description: 'Acceso a todas las funciones: editar, eliminar, fotos, observaciones e importación.',
    },
    {
      role: 'Usuario final',
      name: 'Usuario final',
      icon: <Eye className="w-10 h-10 text-amber-400 group-hover:scale-110 transition-transform duration-200" />,
      colorClasses: 'hover:border-amber-500/60 hover:bg-amber-950/20 hover:shadow-amber-950/40',
      badgeText: 'Solo Lectura',
      badgeClasses: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      description: 'Consulta de evaluaciones, semáforos, mapas y exportación a Excel (.xlsx).',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-white flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden select-none">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-cyan-600/10 via-transparent to-red-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center text-center z-10 space-y-10">
        
        {/* LOGO CORPORATIVO COMBUGAS / SEGURIDAD ESTACIONES */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative group">
            {/* Outer Glow */}
            <div className="absolute -inset-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-cyan-500 rounded-2xl blur-md opacity-40 group-hover:opacity-75 transition duration-300" />
            
            {/* Logo Emblem */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center p-3 shadow-2xl">
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full drop-shadow-md"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Shield Contour */}
                <path
                  d="M50 8L85 24V50C85 71.5 70 87.5 50 94C30 87.5 15 71.5 15 50V24L50 8Z"
                  className="fill-neutral-900 stroke-cyan-500/80"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />
                {/* Security Inner Layer */}
                <path
                  d="M50 16L77 28.5V49C77 66.5 65.5 79.5 50 85C34.5 79.5 23 66.5 23 49V28.5L50 16Z"
                  fill="url(#shield_grad)"
                  opacity="0.25"
                />
                {/* Stylized Gas Flame Symbol */}
                <path
                  d="M50 26C50 26 62 42 62 55C62 64.5 56.6 71 50 71C43.4 71 38 64.5 38 55C38 42 50 26 50 26Z"
                  fill="url(#flame_grad)"
                />
                <path
                  d="M50 42C50 42 56 51 56 59C56 63.5 53.3 67 50 67C46.7 67 44 63.5 44 59C44 51 50 42 50 42Z"
                  fill="#FFFBEB"
                />
                <defs>
                  <linearGradient id="shield_grad" x1="50" y1="16" x2="50" y2="85" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#06b6d4" />
                    <stop offset="1" stopColor="#0891b2" />
                  </linearGradient>
                  <linearGradient id="flame_grad" x1="50" y1="26" x2="50" y2="71" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ef4444" />
                    <stop offset="0.5" stopColor="#f59e0b" />
                    <stop offset="1" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono">
              COMBUGAS
            </h1>
            <p className="text-xs sm:text-sm font-semibold tracking-widest text-neutral-400 uppercase font-mono">
              Evaluaciones de Seguridad en Estaciones y Plantas
            </p>
          </div>
        </div>

        {/* ACCESO A LOS DIFERENTES ROLES (3 ROLES) */}
        <div className="w-full space-y-4">
          <p className="text-xs text-neutral-500 uppercase tracking-widest font-mono">
            Selecciona el rol para ingresar al sistema
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-3xl mx-auto">
            {rolesConfig.map((item) => (
              <button
                key={item.role}
                type="button"
                onClick={() => onSelectRole(item.role)}
                className={`group relative flex flex-col items-center justify-between p-6 sm:p-7 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-center transition-all duration-300 shadow-xl cursor-pointer ${item.colorClasses} hover:-translate-y-1 hover:shadow-2xl`}
              >
                {/* Top Badge */}
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border mb-4 ${item.badgeClasses}`}
                >
                  {item.badgeText}
                </span>

                {/* Role Icon */}
                <div className="my-2 p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 group-hover:border-neutral-700 transition-colors">
                  {item.icon}
                </div>

                {/* Role Name */}
                <div className="mt-4 space-y-1.5 w-full">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-neutral-100">
                    {item.name}
                  </h2>
                  <p className="text-[11px] text-neutral-400 leading-snug line-clamp-2 px-1">
                    {item.description}
                  </p>
                </div>

                {/* Enter Arrow Cue */}
                <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-neutral-400 group-hover:text-white transition-colors">
                  <span>Ingresar</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-4 text-xs font-mono text-neutral-600">
          Cumplimiento NOM-001 · NOM-002 · NOM-003 · NOM-026 · Combugas S.A. de C.V.
        </div>
      </div>
    </div>
  );
};
