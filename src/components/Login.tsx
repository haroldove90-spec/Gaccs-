import React, { useState, useEffect } from 'react';
import { UserSession } from '../types';
import { ShieldCheck, Lock, User, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff, Clock } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin1');
  const [password, setPassword] = useState('Chevropar#1970');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inactivityNotice, setInactivityNotice] = useState<boolean>(false);

  useEffect(() => {
    try {
      const reason = sessionStorage.getItem('evaluaciones_logout_reason');
      if (reason === 'inactivity') {
        setInactivityNotice(true);
        sessionStorage.removeItem('evaluaciones_logout_reason');
      }
    } catch {}
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      const cleanUser = username.trim();
      const cleanPass = password.trim();

      if (cleanUser === 'admin1' && cleanPass === 'Chevropar#1970') {
        onLoginSuccess({
          username: 'admin1',
          name: 'Administrador 1',
          role: 'Administrador',
        });
      } else if (cleanUser === 'haroldo90' && cleanPass === 'Chevropar#1970') {
        onLoginSuccess({
          username: 'haroldo90',
          name: 'Haroldo Vega',
          role: 'Evaluador',
        });
      } else {
        setError('CREDENCIALES NO RECONOCIDAS. VERIFICA TU USUARIO Y CONTRASEÑA.');
        setLoading(false);
      }
    }, 200);
  };

  const handleSelectQuickAccount = (user: string) => {
    setUsername(user);
    setPassword('Chevropar#1970');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-neutral-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Brand Lockup */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded bg-neutral-950 flex items-center justify-center text-white mb-3 shadow-xs">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            Evaluaciones
          </h1>
          <p className="text-sm text-neutral-500 mt-1 text-center">
            Tablero de Seguridad y Verificación en Estaciones 2026
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white border border-neutral-200 rounded-lg p-6 sm:p-8 shadow-xs">
          {inactivityNotice && (
            <div className="mb-4 p-3.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-2.5 animate-in fade-in">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">Sesión cerrada por inactividad</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Por seguridad, la sesión anterior se cerró automáticamente al no detectarse movimiento durante 10 minutos. Por favor ingresa tus credenciales nuevamente.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1"
              >
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin1 o haroldo90"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-neutral-300 rounded focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-neutral-700 uppercase tracking-wider mb-1"
              >
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-10 py-2 text-sm border border-neutral-300 rounded focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-neutral-950 hover:bg-neutral-800 rounded transition-colors disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'Ingresando...' : 'Acceder al Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Access Credentials helper */}
          <div className="mt-6 pt-5 border-t border-neutral-100">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-2">
              Credenciales autorizadas en sistema:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectQuickAccount('admin1')}
                className={`text-left p-2.5 rounded border text-xs transition-colors ${
                  username === 'admin1'
                    ? 'border-neutral-900 bg-neutral-50 text-neutral-950'
                    : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">admin1</span>
                  {username === 'admin1' && <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900" />}
                </div>
                <span className="text-[11px] text-neutral-500 block">Rol: Administrador</span>
                <span className="text-[10px] text-neutral-400 font-mono mt-0.5 block">Chevropar#1970</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectQuickAccount('haroldo90')}
                className={`text-left p-2.5 rounded border text-xs transition-colors ${
                  username === 'haroldo90'
                    ? 'border-neutral-900 bg-neutral-50 text-neutral-950'
                    : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">haroldo90</span>
                  {username === 'haroldo90' && <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900" />}
                </div>
                <span className="text-[11px] text-neutral-500 block">Rol: Evaluador</span>
                <span className="text-[10px] text-neutral-400 font-mono mt-0.5 block">Chevropar#1970</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-neutral-400 font-mono">
          Sistema de Verificación Técnica · NOM-001, NOM-002, NOM-003
        </div>
      </div>
    </div>
  );
};
