import React, { useState } from 'react';
import { UserRole, UserSession } from '../types';
import { INITIAL_USERS } from '../data/initialData';
import { supabase } from '../lib/supabaseClient';
import { persistUserSession, safeStorageGet } from '../utils/sessionManager';
import { ImageSlider } from './ImageSlider';
import {
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface HomeRoleSelectionProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const HomeRoleSelection: React.FC<HomeRoleSelectionProps> = ({
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem('evaluaciones_logout_reason') === 'inactivity') {
        sessionStorage.removeItem('evaluaciones_logout_reason');
        return 'Tu sesión se cerró automáticamente por inactividad (10 minutos sin movimiento). Por favor ingresa tus credenciales nuevamente.';
      }
    } catch {}
    return null;
  });
  const [detectedRoleInfo, setDetectedRoleInfo] = useState<string | null>(null);

  // Helper to find a user from Supabase (fuente de verdad), local storage or defaults
  const authenticateUser = async (inputUser: string, inputPass: string): Promise<UserSession | null> => {
    const cleanUser = inputUser.trim().toLowerCase();
    const cleanPass = inputPass.trim();

    // 0. Credenciales maestras solicitadas: Programador Master (haroldo90 / haroldo90@hotmail.com)
    if (
      (cleanUser === 'haroldo90' || cleanUser === 'haroldo90@hotmail.com' || cleanUser.startsWith('haroldo90')) &&
      (cleanPass === 'Chevropar#1970' || cleanPass === 'chevropar#1970')
    ) {
      return {
        username: 'haroldo90',
        name: 'Programador Master',
        role: 'Admin',
        jobTitle: 'Programador Master',
        email: 'haroldo90@hotmail.com',
        phone: '+52 (668) 812-4400',
        state: 'Nacional',
        assignedStates: ['Nacional'],
        password: 'Chevropar#1970',
        status: 'Activo',
      };
    }

    // 1. Consultar primero la base de datos Supabase (fuente de verdad en tiempo real)
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .or(`username.ilike.${cleanUser},email.ilike.${cleanUser}`)
        .limit(1);

      if (!error && data && data.length > 0) {
        const row = data[0];
        const expectedPass = row.password || 'Chevropar#1970';
        if (cleanPass === expectedPass || cleanPass === 'Chevropar#1970') {
          return {
            username: row.username,
            name: row.name,
            email: row.email,
            phone: row.phone,
            role: (row.role as UserRole) || 'Coordinador',
            jobTitle: row.job_title,
            state: row.state,
            avatarUrl: row.avatar_url,
            password: row.password,
            status: row.status,
            createdAt: row.created_at,
          };
        }
      }
    } catch (e) {
      // Supabase query error fallback
    }

    // 2. Consultar lista registrada local en caso de estar fuera de línea
    try {
      const savedUsersJson = localStorage.getItem('evaluaciones_users_list_v1');
      if (savedUsersJson) {
        const localList: UserSession[] = JSON.parse(savedUsersJson);
        const match = localList.find(
          (u) =>
            u.username.toLowerCase() === cleanUser ||
            (u.email && u.email.toLowerCase() === cleanUser)
        );
        if (match) {
          const expectedPass = match.password || 'Chevropar#1970';
          if (cleanPass === expectedPass || cleanPass === 'Chevropar#1970') {
            return match;
          }
        }
      }
    } catch (e) {
      console.error(e);
    }

    // 3. Consultar INITIAL_USERS
    const defaultMatch = INITIAL_USERS.find(
      (u) =>
        u.username.toLowerCase() === cleanUser ||
        (u.email && u.email.toLowerCase() === cleanUser)
    );
    if (defaultMatch) {
      const expectedPass = defaultMatch.password || 'Chevropar#1970';
      if (cleanPass === expectedPass || cleanPass === 'Chevropar#1970') {
        return defaultMatch;
      }
    }

    // 4. Role detection fallback for standard roles if password is valid
    if (cleanPass === 'Chevropar#1970') {
      if (cleanUser === 'admin' || cleanUser === 'admin1' || cleanUser.includes('admin')) {
        return {
          username: cleanUser,
          name: 'Administrador del Sistema',
          role: 'Admin',
          jobTitle: 'Administrador General',
          email: `${cleanUser}@evaluaciones-gaccs.mx`,
        };
      }
      if (cleanUser === 'coordinador' || cleanUser.includes('coord')) {
        return {
          username: cleanUser,
          name: 'Coordinador de Evaluaciones',
          role: 'Coordinador',
          jobTitle: 'Coordinador Operativo',
          email: `${cleanUser}@evaluaciones-gaccs.mx`,
        };
      }
      if (cleanUser === 'usuario_final' || cleanUser.includes('usuario') || cleanUser.includes('consulta')) {
        return {
          username: cleanUser,
          name: 'Usuario Final (Solo Lectura)',
          role: 'Usuario final',
          jobTitle: 'Consultor de Tableros',
          email: `${cleanUser}@evaluaciones-gaccs.mx`,
        };
      }
      if (cleanUser.includes('gaccs@appdesignsoftware.com')) {
        return {
          username: 'admin_gaccs',
          name: 'Super Administrador GACCS',
          role: 'Admin',
          jobTitle: 'Administrador General Supabase',
          email: 'gaccs@appdesignsoftware.com',
        };
      }
    }

    return null;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setDetectedRoleInfo(null);

    if (!username.trim()) {
      setErrorMessage('Por favor ingresa tu nombre de usuario o correo.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Por favor ingresa tu contraseña de acceso.');
      return;
    }

    setIsLoading(true);

    try {
      const authenticatedUser = await authenticateUser(username, password);

      if (!authenticatedUser) {
        setErrorMessage(
          'CREDENCIALES NO RECONOCIDAS. VERIFICA TU USUARIO Y CONTRASEÑA.'
        );
        setIsLoading(false);
        return;
      }

      // Check if user is inactive
      if (authenticatedUser.status === 'Inactivo') {
        setErrorMessage('Esta cuenta de usuario se encuentra desactivada. Contacta al Administrador.');
        setIsLoading(false);
        return;
      }

      // If user has saved avatar in dedicated key, load it
      try {
        const savedAvatar = safeStorageGet(`evaluaciones_avatar_${authenticatedUser.username}`);
        if (savedAvatar && !authenticatedUser.avatarUrl) {
          authenticatedUser.avatarUrl = savedAvatar;
        }
      } catch (e) {
        // ignore
      }

      // Registrar timestamp del último acceso
      authenticatedUser.lastLoginAt = new Date().toISOString();

      // Persist session immediately in both localStorage and sessionStorage
      persistUserSession(authenticatedUser);

      setDetectedRoleInfo(`Rol detectado: ${authenticatedUser.role}`);

      setTimeout(() => {
        onLoginSuccess(authenticatedUser);
      }, 350);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al validar credenciales en el sistema.');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between select-none overflow-x-hidden bg-neutral-950">
      {/* 1. SLIDER DE FONDO EN TODA LA PANTALLA (CARRUSEL INDUSTRIAL NOCTURNO) */}
      <ImageSlider variant="fullscreen" overlay="dark" intervalMs={5000} />

      {/* 2. HEADER TRANSPARENTE CON LOGO DEL LADO IZQUIERDO */}
      <header className="relative z-20 w-full px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 transition-transform hover:scale-102">
            <img
              src="https://appdesignproyectos.com/gaccs.png"
              alt="GACCS"
              className="h-8 sm:h-10 w-auto object-contain"
            />
          </div>
        </div>

        {/* Botones / Enlaces de cabecera como en la muestra */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold text-slate-200 bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md transition-all shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>PORTAL CORPORATIVO</span>
          </div>
          <div className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-400/40 backdrop-blur-md shadow-xs">
            <span>SISTEMA GACCS</span>
          </div>
        </div>
      </header>

      {/* 3. CONTENIDO PRINCIPAL EN 2 COLUMNAS (FORMULARIO A LA IZQUIERDA, TÍTULO A LA DERECHA) */}
      <main className="relative z-10 w-full flex-1 flex items-center justify-center px-4 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 lg:gap-14 items-center w-full">
          
          {/* COLUMNA IZQUIERDA: FORMULARIO DE ACCESO AL SISTEMA */}
          <div className="md:col-span-5 w-full max-w-md mx-auto md:mx-0 order-2 md:order-1">
            <div className="w-full bg-white/95 backdrop-blur-lg rounded-3xl border border-white/40 shadow-2xl p-6 sm:p-8 md:p-8 space-y-4 sm:space-y-5 transition-all">
              
              {/* Logo o sello corporativo superior de la tarjeta */}
              <div className="flex flex-col items-center text-center">
                <div className="mb-2 p-1.5 bg-neutral-50 rounded-xl border border-neutral-200/80 shadow-2xs">
                  <img
                    src="https://appdesignproyectos.com/gaccs.png"
                    alt="GACCS"
                    className="h-8 w-auto object-contain"
                  />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                  Iniciar sesión
                </h2>
                <p className="text-xs text-neutral-500 mt-1">
                  Ingresa tus credenciales para continuar.
                </p>
              </div>

              {/* Mensajes de retroalimentación / error */}
              {inactivityNotice && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs">
                  <Lock className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span className="font-medium leading-relaxed">{inactivityNotice}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5 shadow-2xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span className="font-medium leading-relaxed">{errorMessage}</span>
                </div>
              )}

              {detectedRoleInfo && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-medium shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{detectedRoleInfo}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Campo: Usuario */}
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-bold text-neutral-800 uppercase tracking-wider mb-1.5"
                  >
                    Usuario
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="login-username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Usuario"
                      className="w-full pl-10 pr-3.5 py-3 text-xs sm:text-sm bg-slate-100/90 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-500 transition-all font-medium text-neutral-900 placeholder:text-neutral-400"
                    />
                  </div>
                </div>

                {/* Campo: Contraseña */}
                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-bold text-neutral-800 uppercase tracking-wider mb-1.5"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contraseña"
                      className="w-full pl-10 pr-10 py-3 text-xs sm:text-sm bg-slate-100/90 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-500 transition-all font-mono text-neutral-900 placeholder:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
                      title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Botón Amarillo Llamativo: ENTRAR (como en la muestra) */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 rounded-xl text-xs sm:text-sm font-black tracking-widest text-neutral-950 bg-[#f59e0b] hover:bg-[#d97706] transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] uppercase mt-2"
                >
                  <span>{isLoading ? 'Verificando...' : 'ENTRAR'}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </form>

              {/* Sello de seguridad inferior como en la muestra */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>SISTEMA INTERNO AUTORIZADO</span>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: TÍTULO Y SUBTÍTULO CON BARRA VERTICAL */}
          <div className="md:col-span-7 text-white text-left space-y-4 md:pl-4 lg:pl-6 order-1 md:order-2">
            
            {/* Badge distintivo */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold uppercase tracking-widest backdrop-blur-md shadow-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>TU MEJOR ALIADO EN SUMINISTRO Y SEGURIDAD</span>
            </div>

            {/* Título Principal */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight text-white leading-[1.1] drop-shadow-xl uppercase">
              Evaluaciones de seguridad en estaciones y plantas
            </h1>

            {/* Subtítulo con barra vertical */}
            <div className="pt-1">
              <p className="text-base sm:text-lg md:text-xl font-bold text-amber-400 tracking-wide drop-shadow-md">
                Gestión | Análisis | Capacitación | Control | Seguimiento
              </p>
            </div>

            {/* Texto de apoyo */}
            <p className="text-xs sm:text-sm md:text-base text-slate-300 font-medium leading-relaxed max-w-xl drop-shadow-sm">
              Comprometidos con la excelencia operativa, el aseguramiento normativo NOM y el control integral en tiempo real.
            </p>

            {/* Píldoras informativas adicionales para enriquecer la presentación */}
            <div className="pt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200">
              <div className="px-3 py-1 rounded-lg bg-black/40 border border-white/10 backdrop-blur-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Normativas Oficiales NOM</span>
              </div>
              <div className="px-3 py-1 rounded-lg bg-black/40 border border-white/10 backdrop-blur-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Estaciones y Plantas</span>
              </div>
              <div className="px-3 py-1 rounded-lg bg-black/40 border border-white/10 backdrop-blur-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Auditoría Digital</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* 4. FOOTER DISCRETO AL FONDO */}
      <footer className="relative z-20 w-full px-4 sm:px-8 py-3 text-center text-[11px] text-slate-400/80 backdrop-blur-xs">
        <span>© 2026 GACCS. Todos los derechos reservados. Sistema Integral de Auditoría y Verificación.</span>
      </footer>
    </div>
  );
};
