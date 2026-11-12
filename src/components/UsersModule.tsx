import React, { useState, useEffect, useMemo } from 'react';
import { UserSession, UserRole, UserLoginLog } from '../types';
import { INITIAL_USERS } from '../data/initialData';
import { MEXICO_STATES_DEFS } from '../data/mexicoMapStateDefs';
import {
  saveUserToSupabase,
  deleteUserFromSupabase,
  fetchUsersFromSupabase,
} from '../lib/supabaseClient';
import { safeStorageGet, safeStorageSet } from '../utils/sessionManager';
import {
  formatLastLoginDisplay,
  getUserLoginLogs,
  getUserRecentLogins,
} from '../utils/userActivityLogger';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  XCircle,
  Shield,
  Trash2,
  KeyRound,
  Download,
  X,
  Sparkles,
  Eye,
  EyeOff,
  Edit2,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  ClipboardCheck,
  UserCheck,
  AlertTriangle,
  Building,
  Phone,
  Mail,
  MapPin,
  Calendar,
  RefreshCw,
  Clock,
  History,
  Activity,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface UsersModuleProps {
  currentUser: UserSession;
  onUserListChange?: (users: UserSession[]) => void;
}

// Icono Oficial de WhatsApp SVG
export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.889 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.711 1.456h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413z" />
  </svg>
);

// Generar URL oficial para enviar credenciales por WhatsApp
export const getWhatsAppUrl = (user: UserSession, customPhone?: string): string => {
  const rawPhone = (customPhone || user.phone || '').trim();
  const digits = rawPhone.replace(/\D/g, '');
  const systemUrl = 'https://evaluaciones-1.ai.studio/';
  const password = user.password || 'Chevropar#1970';
  const estadosTxt = user.assignedStates && user.assignedStates.length > 0
    ? user.assignedStates.join(', ')
    : (user.state || 'Nacional');

  const message =
`🔐 *Credenciales de Acceso - Sistema de Evaluaciones*

Hola *${user.name}*, se han generado tus credenciales para ingresar a la plataforma:

🌐 *Enlace del Sistema:*
${systemUrl}

👤 *Usuario:* ${user.username}
🔑 *Contraseña:* ${password}
🛡️ *Rol asignado:* ${user.role}
💼 *Puesto:* ${user.jobTitle || 'No especificado'}
📍 *Estados autorizados:* ${estadosTxt}

_Favor de ingresar y mantener tus accesos resguardados._`;

  const encoded = encodeURIComponent(message);
  if (digits && digits.length >= 10) {
    const finalPhone = digits.length === 10 ? `52${digits}` : digits;
    return `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
};

// Componente interactivo para asignar uno o varios estados a un usuario
interface StateMultiSelectProps {
  selectedStates: string[];
  onChange: (states: string[]) => void;
  role: UserRole;
}

const StateMultiSelect: React.FC<StateMultiSelectProps> = ({ selectedStates, onChange, role }) => {
  const [search, setSearch] = useState('');
  const allStateNames = React.useMemo(() => MEXICO_STATES_DEFS.map((s) => s.name).sort(), []);

  const filteredStates = React.useMemo(() => {
    if (!search.trim()) return allStateNames;
    return allStateNames.filter((s) => s.toLowerCase().includes(search.toLowerCase().trim()));
  }, [allStateNames, search]);

  const toggleState = (st: string) => {
    if (selectedStates.includes(st)) {
      onChange(selectedStates.filter((s) => s !== st));
    } else {
      onChange([...selectedStates, st]);
    }
  };

  const handleSelectAll = () => onChange([...allStateNames]);
  const handleSelectSinaloaOnly = () => onChange(['Sinaloa']);
  const handleClearAll = () => onChange([]);

  return (
    <div className="space-y-2 border border-neutral-300 rounded-xl p-3 bg-neutral-50/70">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="font-bold text-neutral-900 text-xs flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#0e7490]" />
            <span>Asignar Estados para Permisos de Visualización *</span>
          </label>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {role === 'Usuario final'
              ? 'El usuario final solo tendrá permisos para ver datos de los estados que selecciones aquí.'
              : 'Estados asignados a este usuario. (Admin y Coordinador tienen acceso global).'}
          </p>
        </div>

        {/* Acciones rápidas */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-neutral-300 hover:bg-neutral-100 rounded text-neutral-700 cursor-pointer shadow-2xs"
            title="Asignar los 32 estados de la República"
          >
            Todos (Nacional)
          </button>
          <button
            type="button"
            onClick={handleSelectSinaloaOnly}
            className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-neutral-300 hover:bg-neutral-100 rounded text-neutral-700 cursor-pointer shadow-2xs"
          >
            Solo Sinaloa
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-neutral-300 hover:bg-neutral-100 rounded text-red-600 cursor-pointer shadow-2xs"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Estados seleccionados (Etiquetas interactivas) */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[34px] p-2 bg-white border border-neutral-300 rounded-lg">
        {selectedStates.length === 0 ? (
          <span className="text-[11px] text-neutral-400 italic">
            Ningún estado seleccionado. Haz clic abajo en los estados que deseas autorizar.
          </span>
        ) : (
          selectedStates.map((st) => (
            <span
              key={st}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-[#0c323f] text-white shadow-2xs"
            >
              <span>{st}</span>
              <button
                type="button"
                onClick={() => toggleState(st)}
                className="hover:text-red-300 ml-0.5 font-bold cursor-pointer"
                title={`Quitar ${st}`}
              >
                ✕
              </button>
            </span>
          ))
        )}
      </div>

      {/* Buscador de estado */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar estado (ej. Jalisco, Chihuahua, Sinaloa...)"
          className="w-full pl-8 pr-3 py-1 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-neutral-900"
        />
      </div>

      {/* Grid de botones para activar o desactivar estados */}
      <div className="max-h-32 overflow-y-auto p-1.5 bg-white border border-neutral-200 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-1">
        {filteredStates.map((st) => {
          const isSelected = selectedStates.includes(st);
          return (
            <button
              key={st}
              type="button"
              onClick={() => toggleState(st)}
              className={`px-2 py-1 text-[11px] rounded font-medium text-left transition-colors flex items-center justify-between cursor-pointer ${
                isSelected
                  ? 'bg-cyan-100 text-cyan-950 font-bold border border-cyan-400'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
              }`}
            >
              <span className="truncate">{st}</span>
              {isSelected ? (
                <Check className="w-3 h-3 text-cyan-800 shrink-0 ml-1" />
              ) : (
                <span className="text-[10px] text-neutral-300 shrink-0 ml-1">+</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const UsersModule: React.FC<UsersModuleProps> = ({
  currentUser,
  onUserListChange,
}) => {
  const [usersList, setUsersList] = useState<UserSession[]>(() => {
    try {
      const saved = safeStorageGet('evaluaciones_users_list_v1');
      if (saved) {
        const parsed: UserSession[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filtrar cuentas de muestra obsoletas si quedaron en la memoria local antigua
          const sampleDummies = [
            'estacion_obregon',
            'auditor_culiacan',
            'supervisor_mochis',
            'estacion_mazatlan',
            'auditor_nogales',
            'gerente_hermosillo',
            'auditor_navojoa',
            'estacion_guaymas',
          ];
          const cleaned = parsed.filter(
            (u) => !sampleDummies.includes(u.username.toLowerCase())
          );
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_USERS;
  });

  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);

  // Historial de accesos y auditoría de logins
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [loginLogs, setLoginLogs] = useState<UserLoginLog[]>(() => getUserLoginLogs());

  // Helper para enriquecer la lista de usuarios con los registros de login locales y de Supabase
  const enrichUsersWithLogs = (list: UserSession[], logs: UserLoginLog[]): UserSession[] => {
    return list.map((u) => {
      const clean = u.username.toLowerCase();
      const userLogs = logs.filter((l) => l.username.toLowerCase() === clean);
      const latestLog = userLogs[0];
      const count = Math.max(u.loginCount || 0, userLogs.length);
      return {
        ...u,
        lastLoginAt: u.lastLoginAt || (latestLog ? latestLog.timestamp : undefined),
        loginCount: count > 0 ? count : (u.lastLoginAt ? 1 : undefined),
      };
    });
  };

  // Sincronizar y descargar usuarios existentes de Supabase (Fuente de verdad)
  const syncUsersFromSupabase = async (showNotice = false) => {
    setIsSyncingSupabase(true);
    try {
      const freshLogs = getUserLoginLogs();
      setLoginLogs(freshLogs);

      // Traer lista real y actual directamente de Supabase
      const { users, error } = await fetchUsersFromSupabase();
      if (!error && Array.isArray(users)) {
        if (users.length > 0) {
          // Supabase tiene usuarios registrados: Usar como fuente de verdad y enriquecer con timestamps
          const enriched = enrichUsersWithLogs(users, freshLogs);
          setUsersList(enriched);
          safeStorageSet('evaluaciones_users_list_v1', JSON.stringify(enriched));
          if (showNotice) {
            setCopyFeedback(`¡${users.length} usuarios sincronizados en tiempo real desde Supabase!`);
            setTimeout(() => setCopyFeedback(null), 3500);
          }
        } else {
          // Si la tabla en Supabase está vacía, auto-restauramos de inmediato los usuarios maestros
          console.log('Tabla usuarios vacía en Supabase. Auto-sembrando usuarios maestros...');
          const enriched = enrichUsersWithLogs(INITIAL_USERS, freshLogs);
          setUsersList(enriched);
          safeStorageSet('evaluaciones_users_list_v1', JSON.stringify(enriched));
          // Sembrar automáticamente en Supabase para que la tabla se llene
          for (const u of INITIAL_USERS) {
            await saveUserToSupabase(u);
          }
          if (showNotice) {
            setCopyFeedback('¡Usuarios maestros auto-restaurados y sembrados en Supabase con éxito!');
            setTimeout(() => setCopyFeedback(null), 3500);
          }
        }
      } else if (error) {
        // En caso de error de conexión con Supabase, mantener usuarios locales o iniciales
        if (showNotice) {
          setCopyFeedback(`Aviso Supabase: ${error}. Mostrando usuarios locales.`);
          setTimeout(() => setCopyFeedback(null), 3500);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleRestoreMasterUsersToSupabase = async () => {
    setIsSyncingSupabase(true);
    try {
      const freshLogs = getUserLoginLogs();
      const enriched = enrichUsersWithLogs(INITIAL_USERS, freshLogs);
      for (const u of enriched) {
        await saveUserToSupabase(u);
      }
      setUsersList(enriched);
      safeStorageSet('evaluaciones_users_list_v1', JSON.stringify(enriched));
      setCopyFeedback('¡Usuarios maestros guardados y restaurados en Supabase exitosamente!');
      setTimeout(() => setCopyFeedback(null), 4000);
    } catch (err: any) {
      setCopyFeedback(`Error al restaurar usuarios: ${err?.message || 'Error'}`);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  useEffect(() => {
    syncUsersFromSupabase(false);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserSession | null>(null);
  const [editingUser, setEditingUser] = useState<UserSession | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserSession | null>(null);

  // Password visibility states
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showViewPassword, setShowViewPassword] = useState(false);

  // Notification feedback
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Form state for new user
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    role: 'Coordinador' as UserRole,
    jobTitle: 'Coordinador Técnico',
    state: 'Sinaloa',
    assignedStates: ['Sinaloa'] as string[],
    password: '',
    status: 'Activo' as 'Activo' | 'Inactivo',
  });

  const [registerError, setRegisterError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Generador de contraseñas seguras
  const generateStrongPassword = (): string => {
    const specials = ['#', '!', '$', '%', '&', '@', '*'];
    const lowers = 'abcdefghjkmnpqrstuvwxyz';
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const numbers = '23456789';

    const pick = (str: string) => str[Math.floor(Math.random() * str.length)];
    const special = specials[Math.floor(Math.random() * specials.length)];

    let result = 'Gaccs' + special;
    result += pick(uppers);
    result += pick(lowers);
    result += pick(numbers);
    result += pick(lowers);
    result += pick(numbers);
    result += pick(uppers);

    return result;
  };

  // Generador de nombre de usuario automático basado en el nombre completo
  const generateUsernameFromName = (fullName: string): string => {
    const clean = fullName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return `usuario_${Math.floor(100 + Math.random() * 900)}`;
    if (parts.length === 1) return parts[0];
    return `${parts[0]}.${parts[parts.length - 1]}`;
  };

  const handleApplyRegisterPassword = () => {
    const pwd = generateStrongPassword();
    setNewUser((prev) => ({ ...prev, password: pwd }));
    setShowRegisterPassword(true);
  };

  const handleApplyEditPassword = () => {
    if (!editingUser) return;
    const pwd = generateStrongPassword();
    setEditingUser({ ...editingUser, password: pwd });
    setShowEditPassword(true);
  };

  const handleAutoGenerateRegisterUsername = () => {
    if (!newUser.name) return;
    const generated = generateUsernameFromName(newUser.name);
    setNewUser((prev) => ({
      ...prev,
      username: generated,
      email: prev.email || `${generated}@evaluaciones-gaccs.mx`,
    }));
  };

  const handleAutoGenerateEditUsername = () => {
    if (!editingUser || !editingUser.name) return;
    const generated = generateUsernameFromName(editingUser.name);
    setEditingUser({ ...editingUser, username: generated });
  };

  // Compartir credenciales con el enlace oficial solicitado: https://evaluaciones-1.ai.studio/
  const handleShareCredentials = async (user: UserSession) => {
    const message = `🔐 Credenciales de Acceso - Sistema de Evaluaciones:\n\n🌐 Enlace del Sistema: https://evaluaciones-1.ai.studio/\n👤 Nombre: ${user.name}\n🏷️ Usuario: ${user.username}\n🔑 Contraseña: ${user.password || 'Chevropar#1970'}\n🛡️ Rol asignado: ${user.role}\n📍 Estado: ${user.state || 'Nacional'}`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        setCopyFeedback(`Credenciales de ${user.username} copiadas con éxito.`);
        setTimeout(() => setCopyFeedback(null), 3500);
      }
      if (navigator.share && window.innerWidth < 768) {
        await navigator.share({
          title: 'Credenciales Sistema Evaluaciones',
          text: message,
          url: 'https://evaluaciones-1.ai.studio/',
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Abrir WhatsApp con las credenciales formateadas
  const handleOpenWhatsApp = (user: UserSession, customPhone?: string) => {
    const url = getWhatsAppUrl(user, customPhone);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  // Guardar nuevo usuario
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);

  const handleRegisterSubmit = async (e: React.FormEvent, openWhatsApp = false) => {
    e.preventDefault();
    setRegisterError(null);
    if (!newUser.name.trim() || !newUser.username.trim()) return;

    setIsSubmittingNewUser(true);
    const cleanUsername = newUser.username.trim().toLowerCase();
    const finalPassword = newUser.password.trim() || generateStrongPassword();
    const assignedStates = newUser.assignedStates && newUser.assignedStates.length > 0
      ? newUser.assignedStates
      : (newUser.state ? [newUser.state] : ['Sinaloa']);

    const created: UserSession = {
      username: cleanUsername,
      name: newUser.name.trim(),
      email: newUser.email.trim() || `${cleanUsername}@evaluaciones-gaccs.mx`,
      phone: newUser.phone.trim() || '',
      role: newUser.role,
      jobTitle: newUser.jobTitle.trim() || (newUser.role === 'Admin' ? 'Administrador General' : newUser.role === 'Coordinador' ? 'Coordinador de Evaluaciones' : 'Usuario Final Consultante'),
      state: assignedStates[0] || newUser.state || 'Sinaloa',
      assignedStates,
      password: finalPassword,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: newUser.status,
    };

    // 1. Guardar primero directamente e instantáneamente en Supabase
    const { success, user: savedUser, error } = await saveUserToSupabase(created);

    if (!success) {
      setIsSubmittingNewUser(false);
      setRegisterError(`Error al guardar en Supabase: ${error}`);
      setCopyFeedback(`Error al guardar en Supabase: ${error}`);
      return;
    }

    // 2. Guardar en memoria de la vista
    const finalRecord = savedUser || created;
    const next = [finalRecord, ...usersList.filter((u) => u.username !== cleanUsername)];
    setUsersList(next);
    safeStorageSet('evaluaciones_users_list_v1', JSON.stringify(next));

    if (onUserListChange) {
      onUserListChange(next);
    }

    setIsSubmittingNewUser(false);
    setIsRegisterModalOpen(false);
    
    // Abrir automáticamente la vista de usuario para compartir credenciales inmediatamente
    setViewingUser(finalRecord);
    
    if (openWhatsApp) {
      handleOpenWhatsApp(finalRecord);
    }

    setCopyFeedback(`¡Usuario "${cleanUsername}" guardado en Supabase al instante!`);
    setTimeout(() => setCopyFeedback(null), 5000);

    // Reset form
    setNewUser({
      name: '',
      username: '',
      email: '',
      phone: '',
      role: 'Coordinador',
      jobTitle: 'Coordinador Técnico',
      state: 'Sinaloa',
      assignedStates: ['Sinaloa'],
      password: '',
      status: 'Activo',
    });
  };

  // Guardar edición de usuario
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setIsSubmittingEdit(true);

    const cleanUsername = editingUser.username.trim().toLowerCase();
    const assignedStates = editingUser.assignedStates && editingUser.assignedStates.length > 0
      ? editingUser.assignedStates
      : (editingUser.state ? [editingUser.state] : ['Sinaloa']);

    const updatedPayload: UserSession = {
      ...editingUser,
      username: cleanUsername,
      name: editingUser.name.trim(),
      assignedStates,
      state: assignedStates[0] || editingUser.state || 'Sinaloa',
    };

    // Sincronizar edición instantáneamente con Supabase
    const { success, user: savedUser, error } = await saveUserToSupabase(updatedPayload);

    setIsSubmittingEdit(false);

    if (!success) {
      setEditError(`Error al guardar en Supabase: ${error}`);
      setCopyFeedback(`Error al actualizar en Supabase: ${error}`);
      return;
    }

    const finalRecord = savedUser || updatedPayload;
    const next = usersList.map((u) =>
      u.username.toLowerCase() === cleanUsername ? finalRecord : u
    );
    setUsersList(next);
    safeStorageSet('evaluaciones_users_list_v1', JSON.stringify(next));

    if (onUserListChange) {
      onUserListChange(next);
    }

    setEditingUser(null);
    setCopyFeedback(`¡Usuario "${cleanUsername}" actualizado en Supabase al instante!`);
    setTimeout(() => setCopyFeedback(null), 4000);
  };

  // Desactivar / Activar usuario
  const handleToggleStatus = async (username: string) => {
    const cleanUsername = username.trim().toLowerCase();
    const target = usersList.find((u) => u.username.toLowerCase() === cleanUsername);
    if (!target) return;

    const newStatus = target.status === 'Activo' ? ('Inactivo' as const) : ('Activo' as const);
    const updated: UserSession = { ...target, status: newStatus };

    const { success, error } = await saveUserToSupabase(updated);
    if (!success) {
      setCopyFeedback(`Error al cambiar estatus en Supabase: ${error}`);
      setTimeout(() => setCopyFeedback(null), 4000);
      return;
    }

    const next = usersList.map((u) =>
      u.username.toLowerCase() === cleanUsername ? updated : u
    );
    setUsersList(next);
    safeStorageSet('evaluaciones_users_list_v1', JSON.stringify(next));

    if (onUserListChange) {
      onUserListChange(next);
    }

    setCopyFeedback(`Estatus de "${cleanUsername}" actualizado a "${newStatus}" en Supabase.`);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  // Eliminar usuario
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    if (userToDelete.username === currentUser.username) {
      alert('No puedes eliminar tu propio usuario en sesión activa.');
      setUserToDelete(null);
      return;
    }

    setIsDeletingUser(true);
    const usernameToDelete = userToDelete.username.trim().toLowerCase();

    // Eliminar de Supabase al instante
    const { success, error } = await deleteUserFromSupabase(usernameToDelete);
    setIsDeletingUser(false);

    if (!success) {
      setCopyFeedback(`Error al eliminar de Supabase: ${error}`);
      setTimeout(() => setCopyFeedback(null), 4000);
      return;
    }

    const next = usersList.filter((u) => u.username.toLowerCase() !== usernameToDelete);
    setUsersList(next);
    safeStorageSet('evaluaciones_users_list_v1', JSON.stringify(next));

    if (onUserListChange) {
      onUserListChange(next);
    }

    setUserToDelete(null);
    setCopyFeedback(`Usuario "${usernameToDelete}" eliminado de Supabase al instante.`);
    setTimeout(() => setCopyFeedback(null), 3500);
  };

  // Exportar lista de usuarios a Excel con fecha y hora del último acceso
  const handleExportUsers = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['LISTADO DE USUARIOS Y ACCESOS AL SISTEMA DE EVALUACIONES', ''],
      ['Enlace de Acceso:', 'https://evaluaciones-1.ai.studio/'],
      ['Fecha de Reporte:', new Date().toLocaleDateString('es-MX')],
      [''],
      ['Nombre Completo', 'Usuario', 'Rol', 'Contraseña', 'Correo', 'Teléfono', 'Estado / Región', 'Puesto', 'Estatus', 'Último Acceso (Fecha y Hora)', 'Total de Accesos', 'Fecha Registro'],
      ...usersList.map((u) => {
        const loginInfo = formatLastLoginDisplay(u.lastLoginAt);
        return [
          u.name,
          u.username,
          u.role,
          u.password || 'Chevropar#1970',
          u.email || '-',
          u.phone || '-',
          u.state || '-',
          u.jobTitle || '-',
          u.status || 'Activo',
          u.lastLoginAt ? loginInfo.full : 'Sin ingresos registrados',
          u.loginCount || (u.lastLoginAt ? 1 : 0),
          u.createdAt || '-',
        ];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    XLSX.writeFile(wb, 'Usuarios_Credenciales_Evaluaciones.xlsx');
  };

  // Exportar bitácora completa de inicios de sesión y horarios a Excel
  const handleExportAuditLogs = () => {
    const logsToExport = getUserLoginLogs();
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['BITÁCORA DE HORARIOS E INICIOS DE SESIÓN DE USUARIOS', ''],
      ['Fecha de Emisión del Reporte:', new Date().toLocaleString('es-MX')],
      ['Total de Inicios de Sesión Registrados:', logsToExport.length],
      [''],
      ['#', 'Usuario', 'Nombre Completo', 'Rol', 'Fecha y Hora Exacta de Ingreso', 'Dispositivo / Navegador'],
      ...logsToExport.map((log, idx) => [
        idx + 1,
        `@${log.username}`,
        log.name,
        log.role,
        log.formattedDate,
        log.deviceInfo || 'Navegador Web',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Historial Accesos');
    XLSX.writeFile(wb, 'Bitacora_Horarios_Accesos_Usuarios.xlsx');
  };

  const filteredUsers = usersList.filter((u) => {
    const matchSearch =
      searchTerm === '' ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.state && u.state.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.jobTitle && u.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchRole = filterRole === 'ALL' || u.role === filterRole;
    const matchStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'Activo' && (u.status === 'Activo' || !u.status)) ||
      (filterStatus === 'Inactivo' && u.status === 'Inactivo');

    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Toast de confirmación de copia */}
      {copyFeedback && (
        <div className="fixed top-5 right-5 z-50 bg-neutral-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-neutral-700 text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{copyFeedback}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 mb-1">
            <span>ADMINISTRACIÓN</span>
            <span>/</span>
            <span>GESTIÓN DE ACCESOS Y ROLES</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <span>Usuarios y Credenciales del Sistema</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Registro, generación de contraseñas seguras y control de acceso para Admin, Coordinadores y Usuarios Finales.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const defaultPass = generateStrongPassword();
              setNewUser({
                name: '',
                username: '',
                email: '',
                phone: '',
                role: 'Coordinador',
                jobTitle: 'Coordinador Técnico',
                state: 'Sinaloa',
                assignedStates: ['Sinaloa'],
                password: defaultPass,
                status: 'Activo',
              });
              setShowRegisterPassword(true);
              setIsRegisterModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-neutral-950 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Registrar Nuevo Usuario</span>
          </button>

          <button
            type="button"
            onClick={() => syncUsersFromSupabase(true)}
            disabled={isSyncingSupabase}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-800 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
            title="Sincronizar y recargar usuarios desde Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-spin text-cyan-600' : 'text-neutral-500'}`} />
            <span>{isSyncingSupabase ? 'Sincronizando...' : 'Sincronizar Supabase'}</span>
          </button>

          <button
            type="button"
            onClick={handleRestoreMasterUsersToSupabase}
            disabled={isSyncingSupabase}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-cyan-900 bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
            title="Restaurar y guardar cuentas maestras (haroldo90, admin, coordinador, etc.) en Supabase"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-700" />
            <span>Restaurar Usuarios en Supabase</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginLogs(getUserLoginLogs());
              setIsAuditModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-800 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
            title="Ver bitácora de horarios e inicios de sesión de todos los usuarios"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-700" />
            <span>Historial de Accesos</span>
            {loginLogs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-100 text-cyan-800 font-bold">
                {loginLogs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportUsers}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Lista (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-xs max-w-full overflow-hidden">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, usuario, correo, estado o puesto..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 text-xs font-medium border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none"
            >
              <option value="ALL">Todos los Roles</option>
              <option value="Admin">Admin</option>
              <option value="Coordinador">Coordinador</option>
              <option value="Usuario final">Usuario final</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-xs font-medium border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:outline-none"
            >
              <option value="ALL">Todos los Estatus</option>
              <option value="Activo">Activos</option>
              <option value="Inactivo">Desactivados</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 font-semibold bg-neutral-50/50">
                <th className="py-2.5 px-4 min-w-[200px]">Usuario / Nombre</th>
                <th className="py-2.5 px-3 min-w-[130px]">Rol</th>
                <th className="py-2.5 px-3 min-w-[130px]">Clave de Acceso</th>
                <th className="py-2.5 px-3 min-w-[170px]">Contacto</th>
                <th className="py-2.5 px-3 min-w-[110px]">Estado</th>
                <th className="py-2.5 px-3 min-w-[170px]">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-700" />
                    <span>Último Acceso</span>
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center w-28">Estatus</th>
                <th className="py-2.5 px-3 text-center w-40">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-400">
                    No se encontraron usuarios con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrentUser = u.username === currentUser.username;
                  const isActive = u.status === 'Activo' || !u.status;
                  const loginInfo = formatLastLoginDisplay(u.lastLoginAt);

                  return (
                    <tr
                      key={u.username}
                      className={`hover:bg-neutral-50/80 transition-colors ${
                        !isActive ? 'opacity-60 bg-neutral-50/50' : ''
                      }`}
                    >
                      {/* Name & Username */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#0c323f] text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {u.name.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-bold text-neutral-900 block leading-tight">
                              {u.name}
                            </span>
                            <span className="font-mono text-[11px] text-[#0e7490] block">
                              @{u.username}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            u.role === 'Admin' || u.role === 'Administrador'
                              ? 'bg-[#0c323f]/10 text-[#0c323f] border border-[#0c323f]/20'
                              : u.role === 'Coordinador'
                              ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                              : 'bg-neutral-100 text-neutral-700 border border-neutral-300'
                          }`}
                        >
                          {u.role === 'Admin' || u.role === 'Administrador' ? (
                            <ShieldCheck className="w-3 h-3 text-[#0c323f]" />
                          ) : u.role === 'Coordinador' ? (
                            <ClipboardCheck className="w-3 h-3 text-cyan-700" />
                          ) : (
                            <UserCheck className="w-3 h-3 text-neutral-600" />
                          )}
                          <span>{u.role}</span>
                        </span>
                        {u.jobTitle && (
                          <span className="text-[10px] text-neutral-400 block mt-0.5">
                            {u.jobTitle}
                          </span>
                        )}
                      </td>

                      {/* Clave de Acceso (oculta o con ojito al ver) */}
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <span className="bg-neutral-100 px-2 py-1 rounded text-neutral-700 border border-neutral-200 tracking-wider">
                          ••••••••••
                        </span>
                      </td>

                      {/* Contacto */}
                      <td className="py-3 px-3 text-[11px]">
                        <div className="text-neutral-700 truncate max-w-[160px]" title={u.email}>
                          {u.email || '-'}
                        </div>
                        <div className="text-neutral-400 font-mono text-[10px]">
                          {u.phone || '-'}
                        </div>
                      </td>

                      {/* Estados Asignados / Permisos */}
                      <td className="py-3 px-3 text-neutral-700">
                        {u.assignedStates && u.assignedStates.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[190px]">
                            {u.assignedStates.slice(0, 3).map((st) => (
                              <span
                                key={st}
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-50 text-cyan-900 border border-cyan-200"
                              >
                                {st}
                              </span>
                            ))}
                            {u.assignedStates.length > 3 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-300">
                                +{u.assignedStates.length - 3} más
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs">{u.state || 'Nacional'}</span>
                        )}
                      </td>

                      {/* Último Acceso al Sistema */}
                      <td className="py-3 px-3">
                        {!u.lastLoginAt ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-500 border border-neutral-200">
                            <Clock className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span>Sin registros</span>
                          </span>
                        ) : (
                          <div className="space-y-0.5" title={`Acceso completo: ${loginInfo.full}`}>
                            <div className="flex items-center gap-1.5">
                              {loginInfo.isToday ? (
                                <span className="relative flex h-2 w-2 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                              ) : (
                                <Clock className="w-3 h-3 text-neutral-400 shrink-0" />
                              )}
                              <span className={`text-[11px] font-bold ${loginInfo.isToday ? 'text-emerald-800' : 'text-neutral-800'}`}>
                                {loginInfo.relative}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono pl-3.5">
                              <span>{loginInfo.timeOnly || loginInfo.full}</span>
                              {u.loginCount && u.loginCount > 1 && (
                                <span className="ml-1 px-1 py-0.2 rounded bg-neutral-100 text-neutral-600 text-[9px] font-sans font-semibold">
                                  {u.loginCount} accesos
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Estatus con Switch / Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u.username)}
                          disabled={isCurrentUser}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-neutral-200 text-neutral-600 border border-neutral-300 hover:bg-neutral-300'
                          }`}
                          title={
                            isCurrentUser
                              ? 'No puedes desactivar tu propia cuenta'
                              : isActive
                              ? 'Clic para desactivar acceso'
                              : 'Clic para reactivar acceso'
                          }
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Activo</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-neutral-500" />
                              <span>Desactivado</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* Ver Usuario */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowViewPassword(false);
                              setViewingUser(u);
                            }}
                            className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                            title="Ver detalles y credenciales"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Enviar Credenciales por WhatsApp */}
                          <a
                            href={getWhatsAppUrl(u)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-[#25D366] hover:text-[#20ba59] hover:bg-emerald-50 rounded transition-colors inline-flex items-center justify-center cursor-pointer"
                            title="Enviar credenciales al usuario por WhatsApp"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                          </a>

                          {/* Compartir / Copiar Credenciales */}
                          <button
                            type="button"
                            onClick={() => handleShareCredentials(u)}
                            className="p-1.5 text-neutral-500 hover:text-[#0e7490] hover:bg-cyan-50 rounded transition-colors"
                            title="Copiar credenciales de acceso"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Editar Usuario */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowEditPassword(false);
                              setEditingUser({ ...u });
                            }}
                            className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                            title="Editar usuario"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Borrar Usuario */}
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            disabled={isCurrentUser}
                            className={`p-1.5 rounded transition-colors ${
                              isCurrentUser
                                ? 'text-neutral-300 cursor-not-allowed'
                                : 'text-neutral-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={isCurrentUser ? 'No puedes borrarte a ti mismo' : 'Eliminar usuario'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: REGISTRAR NUEVO USUARIO */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-neutral-300 p-5 sm:p-6 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-950 text-white flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Registrar Nuevo Usuario
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Crea el usuario y asigna clave segura para ingresar al sistema
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              {/* Nombre Completo */}
              <div>
                <label className="block font-semibold text-neutral-800 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Ej. Ing. Roberto Sánchez Gómez"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
                />
              </div>

              {/* Nombre de Usuario con botón de auto-generar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-neutral-800">
                    Nombre de Usuario (Login) *
                  </label>
                  {newUser.name && (
                    <button
                      type="button"
                      onClick={handleAutoGenerateRegisterUsername}
                      className="text-[11px] text-[#0e7490] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generar desde el nombre</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="Ej. roberto.sanchez"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono focus:outline-none focus:border-neutral-900"
                />
              </div>

              {/* Clave de Acceso con Ojito y Generador de Contraseña Segura */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-neutral-800 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Clave de Acceso / Contraseña *</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleApplyRegisterPassword}
                    className="text-[11px] text-[#0e7490] hover:underline flex items-center gap-1 font-semibold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200"
                  >
                    <Sparkles className="w-3 h-3 text-[#0e7490]" />
                    <span>Crear contraseña segura</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full pl-3 pr-10 py-2 border border-neutral-300 rounded-lg font-mono text-xs focus:outline-none focus:border-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-800 p-1"
                    title={showRegisterPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showRegisterPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Rol y Estatus */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-800 mb-1">
                    Rol en el Sistema *
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e: any) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-2.5 py-2 border border-neutral-300 rounded-lg bg-white font-medium"
                  >
                    <option value="Admin">Admin (Acceso Total)</option>
                    <option value="Coordinador">Coordinador (Acceso Total)</option>
                    <option value="Usuario final">Usuario final (Solo Lectura)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-800 mb-1">
                    Estatus Inicial
                  </label>
                  <select
                    value={newUser.status}
                    onChange={(e: any) => setNewUser({ ...newUser, status: e.target.value })}
                    className="w-full px-2.5 py-2 border border-neutral-300 rounded-lg bg-white font-medium"
                  >
                    <option value="Activo">Activo (Puede ingresar)</option>
                    <option value="Inactivo">Desactivado (Bloqueado)</option>
                  </select>
                </div>
              </div>

              {/* Correo y Teléfono */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-800 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-800 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    placeholder="+52 (668) 000-0000"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Puesto / Cargo */}
              <div>
                <label className="block font-semibold text-neutral-800 mb-1">
                  Puesto / Cargo
                </label>
                <input
                  type="text"
                  value={newUser.jobTitle}
                  onChange={(e) => setNewUser({ ...newUser, jobTitle: e.target.value })}
                  placeholder="Ej. Auditor de Seguridad / Gerente de Estación"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs"
                />
              </div>

              {/* Asignación de Estados para Permisos */}
              <StateMultiSelect
                selectedStates={newUser.assignedStates}
                onChange={(sts) =>
                  setNewUser({
                    ...newUser,
                    assignedStates: sts,
                    state: sts[0] || 'Sinaloa',
                  })
                }
                role={newUser.role}
              />

              {/* Info banner de enlace a compartir */}
              <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-[11px] text-neutral-600 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#0e7490] shrink-0" />
                <span>
                  Al registrar al usuario podrás compartirle sus credenciales con el enlace oficial: <strong>https://evaluaciones-1.ai.studio/</strong>
                </span>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSubmittingNewUser}
                  onClick={(e) => handleRegisterSubmit(e, true)}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-[#25D366] hover:bg-[#20ba59] rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  title="Guardar usuario y abrir WhatsApp con las credenciales listas para enviar"
                >
                  <WhatsAppIcon className="w-4 h-4 fill-current shrink-0" />
                  <span>Registrar y Enviar por WhatsApp</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewUser}
                  className="px-4 py-2 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingNewUser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando en Supabase...</span>
                    </>
                  ) : (
                    <span>Registrar y Guardar</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VER USUARIO Y COMPARTIR CREDENCIALES */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-neutral-300 p-5 sm:p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-200 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#0c323f] text-white flex items-center justify-center font-bold text-base uppercase shrink-0">
                  {viewingUser.name.slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 leading-tight">
                    {viewingUser.name}
                  </h3>
                  <span className="font-mono text-xs text-[#0e7490]">
                    @{viewingUser.username}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Banner destacado: Enviar por WhatsApp */}
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <WhatsAppIcon className="w-5 h-5 fill-current" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-xs text-emerald-950 block truncate">
                    Enviar Accesos por WhatsApp
                  </span>
                  <span className="text-[11px] text-emerald-700 block truncate">
                    {viewingUser.phone ? `Destino: ${viewingUser.phone}` : 'Abre chat para seleccionar contacto'}
                  </span>
                </div>
              </div>
              <a
                href={getWhatsAppUrl(viewingUser)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                <span>Abrir WhatsApp</span>
              </a>
            </div>

            {/* Credenciales de acceso destacadas */}
            <div className="bg-neutral-900 text-white rounded-xl p-4 space-y-3 mb-4 shadow-inner">
              <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800 pb-2">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-cyan-400">
                  Credenciales de Acceso
                </span>
                <span>Enlace oficial</span>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 block">Enlace del Sistema:</span>
                <a
                  href="https://evaluaciones-1.ai.studio/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-cyan-300 hover:underline font-mono break-all font-semibold"
                >
                  https://evaluaciones-1.ai.studio/
                </a>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-neutral-400 block">Usuario:</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {viewingUser.username}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400 block">Contraseña:</span>
                    <button
                      type="button"
                      onClick={() => setShowViewPassword(!showViewPassword)}
                      className="text-neutral-400 hover:text-white"
                      title={showViewPassword ? 'Ocultar' : 'Ver'}
                    >
                      {showViewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {showViewPassword ? viewingUser.password || 'Chevropar#1970' : '••••••••••'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 block">Rol Asignado:</span>
                <span className="inline-block mt-0.5 px-2 py-0.5 bg-white/10 rounded font-semibold text-xs text-neutral-200">
                  {viewingUser.role}
                </span>
              </div>

              {/* Botones de acción: WhatsApp y Copiar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-2 border-t border-neutral-800">
                <a
                  href={getWhatsAppUrl(viewingUser)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer text-center"
                >
                  <WhatsAppIcon className="w-4 h-4 fill-current shrink-0" />
                  <span>Enviar por WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleShareCredentials(viewingUser)}
                  className="w-full py-2.5 px-3 bg-[#0c323f] hover:bg-[#164e5e] border border-cyan-800 text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>Copiar Credenciales</span>
                </button>
              </div>
            </div>

            {/* Otros datos */}
            <div className="space-y-2 text-xs text-neutral-700">
              <div className="flex items-center justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Puesto / Cargo:</span>
                <span className="font-medium">{viewingUser.jobTitle || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Estados Autorizados:</span>
                <span className="font-bold text-[#0c323f]">
                  {viewingUser.assignedStates && viewingUser.assignedStates.length > 0
                    ? viewingUser.assignedStates.join(', ')
                    : (viewingUser.state || 'Nacional')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Correo Electrónico:</span>
                <span className="font-medium">{viewingUser.email || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Teléfono:</span>
                <span className="font-medium">{viewingUser.phone || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-500">Estatus:</span>
                <span className={`font-bold ${viewingUser.status === 'Inactivo' ? 'text-red-600' : 'text-emerald-700'}`}>
                  {viewingUser.status || 'Activo'}
                </span>
              </div>
            </div>

            {/* Registro de Accesos y Horarios del Usuario */}
            <div className="mt-4 p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900">
                  <Clock className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                  <span>Historial de Horarios y Último Acceso</span>
                </div>
                {viewingUser.loginCount ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-100 text-cyan-800 rounded-full">
                    {viewingUser.loginCount} {viewingUser.loginCount === 1 ? 'acceso' : 'accesos'}
                  </span>
                ) : null}
              </div>

              {(() => {
                const loginInfo = formatLastLoginDisplay(viewingUser.lastLoginAt);
                const userRecent = getUserRecentLogins(viewingUser.username, 5);
                return (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-neutral-200/60">
                      <span className="text-neutral-500">Última vez en el sistema:</span>
                      <span className="font-bold text-neutral-900 text-right">
                        {viewingUser.lastLoginAt ? loginInfo.full : 'Aún no ha ingresado al sistema'}
                      </span>
                    </div>

                    {userRecent.length > 0 ? (
                      <div className="mt-2 pt-1">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                          Últimos Inicios de Sesión Registrados:
                        </span>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                          {userRecent.map((log) => (
                            <div key={log.id} className="p-1.5 bg-white border border-neutral-200 rounded flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-cyan-600 shrink-0" />
                                <span className="text-neutral-800 font-mono font-medium">{log.formattedDate}</span>
                              </div>
                              <span className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                                {log.deviceInfo || 'Web'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-neutral-400 italic py-1">
                        No hay ingresos anteriores registrados para este usuario.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setEditingUser({ ...viewingUser });
                  setViewingUser(null);
                }}
                className="text-xs font-semibold text-neutral-800 hover:underline flex items-center gap-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar este usuario</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="px-4 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDITAR USUARIO */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-neutral-300 p-5 sm:p-6 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Editar Usuario @{editingUser.username}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Modifica datos de perfil, rol o regenera su clave de acceso
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              {/* Nombre Completo */}
              <div>
                <label className="block font-semibold text-neutral-800 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900"
                />
              </div>

              {/* Nombre de Usuario con botón para auto-generar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-neutral-800">
                    Nombre de Usuario *
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateEditUsername}
                    className="text-[11px] text-[#0e7490] hover:underline flex items-center gap-1 font-semibold"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Regenerar desde nombre</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={editingUser.username}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono focus:outline-none focus:border-neutral-900"
                />
              </div>

              {/* Clave de Acceso con Ojito y Generador de Contraseña Segura */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-neutral-800 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Clave de Acceso / Contraseña *</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleApplyEditPassword}
                    className="text-[11px] text-[#0e7490] hover:underline flex items-center gap-1 font-semibold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200"
                  >
                    <Sparkles className="w-3 h-3 text-[#0e7490]" />
                    <span>Crear contraseña segura</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    required
                    value={editingUser.password || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 border border-neutral-300 rounded-lg font-mono text-xs focus:outline-none focus:border-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-800 p-1"
                    title={showEditPassword ? 'Ocultar' : 'Ver'}
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Rol y Estatus */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-800 mb-1">
                    Rol en el Sistema
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={(e: any) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full px-2.5 py-2 border border-neutral-300 rounded-lg bg-white font-medium"
                  >
                    <option value="Admin">Admin (Acceso Total)</option>
                    <option value="Coordinador">Coordinador (Acceso Total)</option>
                    <option value="Usuario final">Usuario final (Solo Lectura)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-800 mb-1">
                    Estatus de Acceso
                  </label>
                  <select
                    value={editingUser.status || 'Activo'}
                    onChange={(e: any) => setEditingUser({ ...editingUser, status: e.target.value })}
                    className="w-full px-2.5 py-2 border border-neutral-300 rounded-lg bg-white font-medium"
                  >
                    <option value="Activo">Activo (Habilitado)</option>
                    <option value="Inactivo">Desactivado (Bloqueado)</option>
                  </select>
                </div>
              </div>

              {/* Correo y Teléfono */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-800 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-800 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Puesto / Cargo */}
              <div>
                <label className="block font-semibold text-neutral-800 mb-1">
                  Puesto / Cargo
                </label>
                <input
                  type="text"
                  value={editingUser.jobTitle || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, jobTitle: e.target.value })}
                  placeholder="Ej. Auditor de Seguridad / Gerente de Estación"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs"
                />
              </div>

              {/* Asignación de Estados para Permisos */}
              <StateMultiSelect
                selectedStates={
                  editingUser.assignedStates && editingUser.assignedStates.length > 0
                    ? editingUser.assignedStates
                    : editingUser.state && editingUser.state !== 'Nacional'
                    ? [editingUser.state]
                    : ['Sinaloa']
                }
                onChange={(sts) =>
                  setEditingUser({
                    ...editingUser,
                    assignedStates: sts,
                    state: sts[0] || 'Sinaloa',
                  })
                }
                role={editingUser.role}
              />

              <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <a
                    href={getWhatsAppUrl(editingUser)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-xs font-bold text-white bg-[#25D366] hover:bg-[#20ba59] rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Enviar credenciales actualizadas por WhatsApp"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                    <span>Enviar por WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleShareCredentials(editingUser)}
                    className="px-3 py-2 text-xs font-semibold text-[#0e7490] hover:bg-cyan-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-3.5 py-2 font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEdit}
                    className="px-4 py-2 font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {isSubmittingEdit ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando en Supabase...</span>
                      </>
                    ) : (
                      <span>Guardar Cambios</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRMACIÓN PARA BORRAR USUARIO */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-xl border border-neutral-300 p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  ¿Eliminar este usuario?
                </h3>
                <span className="font-mono text-xs text-neutral-500">
                  @{userToDelete.username} ({userToDelete.name})
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
              Esta acción eliminará permanentemente la cuenta de <strong>{userToDelete.name}</strong> y sus credenciales de acceso de Supabase.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingUser ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando en Supabase...</span>
                  </>
                ) : (
                  <span>Sí, Eliminar Usuario</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: BITÁCORA Y HISTORIAL COMPLETO DE HORARIOS E INICIOS DE SESIÓN */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-neutral-300 p-5 sm:p-6 max-w-4xl w-full shadow-2xl overflow-y-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#0c323f] text-white flex items-center justify-center shadow-xs">
                  <Clock className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                    <span>Bitácora de Horarios e Inicios de Sesión</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 font-semibold font-mono">
                      {loginLogs.length} {loginLogs.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Control y auditoría para que el Administrador conozca con precisión qué usuario y a qué hora entró al sistema.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter and Actions Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Filtrar por usuario, nombre, rol o fecha..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-neutral-900"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setLoginLogs(getUserLoginLogs())}
                  className="px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Recargar registros actuales"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Actualizar</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAuditLogs}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Descargar reporte en Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span>Exportar (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Table of Login Logs */}
            <div className="overflow-x-auto border border-neutral-200 rounded-lg max-h-[50vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-neutral-100/95 backdrop-blur-xs z-10 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Usuario / Nombre</th>
                    <th className="py-2.5 px-3 min-w-[110px]">Rol</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Fecha y Hora de Acceso</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Navegador / Plataforma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-800">
                  {(() => {
                    const filteredLogs = loginLogs.filter((log) => {
                      if (!auditSearch.trim()) return true;
                      const term = auditSearch.toLowerCase();
                      return (
                        log.username.toLowerCase().includes(term) ||
                        log.name.toLowerCase().includes(term) ||
                        log.role.toLowerCase().includes(term) ||
                        log.formattedDate.toLowerCase().includes(term) ||
                        (log.deviceInfo && log.deviceInfo.toLowerCase().includes(term))
                      );
                    });

                    if (filteredLogs.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-neutral-400">
                            No se encontraron registros de inicio de sesión con el filtro indicado.
                          </td>
                        </tr>
                      );
                    }

                    return filteredLogs.map((log, index) => {
                      const display = formatLastLoginDisplay(log.timestamp);
                      return (
                        <tr key={log.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-center text-neutral-400 font-mono text-[11px]">
                            {index + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-neutral-900 leading-tight">
                              {log.name}
                            </div>
                            <span className="font-mono text-[11px] text-[#0e7490]">
                              @{log.username}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                              {log.role}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-900 font-medium">
                              <Clock className="w-3 h-3 text-cyan-600 shrink-0" />
                              <span>{log.formattedDate}</span>
                            </div>
                            <div className="text-[10px] text-neutral-500 mt-0.5">
                              {display.relative}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-neutral-600">
                            <span className="px-2 py-0.5 rounded bg-neutral-50 text-neutral-700 border border-neutral-200 text-[10px] font-mono">
                              {log.deviceInfo || 'Navegador Web'}
                            </span>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="mt-4 pt-3 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Registro automático en tiempo real en cada inicio de sesión</span>
              </span>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
