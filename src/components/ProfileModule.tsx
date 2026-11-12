import React, { useState, useRef, useEffect } from 'react';
import { UserSession } from '../types';
import { saveUserToSupabase, fetchUserFromSupabase } from '../lib/supabaseClient';
import { safeStorageSet, safeStorageRemove, safeStorageGet } from '../utils/sessionManager';
import {
  User,
  Camera,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  Copy,
  Save,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Shield,
  Trash2,
  LogOut,
  Database,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface ProfileModuleProps {
  user: UserSession;
  onUpdateUser: (updatedUser: UserSession) => void;
  showToast: (msg: string) => void;
  onLogout?: () => void;
}

export const ProfileModule: React.FC<ProfileModuleProps> = ({
  user,
  onUpdateUser,
  showToast,
  onLogout,
}) => {
  // Check if there is an avatar stored in dedicated local key
  const getInitialAvatar = () => {
    if (user.avatarUrl) return user.avatarUrl;
    try {
      const stored = localStorage.getItem(`evaluaciones_avatar_${user.username}`);
      if (stored) return stored;
    } catch (e) {
      // ignore
    }
    return '';
  };

  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    jobTitle: user.jobTitle || '',
    state: user.state || 'Sinaloa',
    password: user.password || 'Chevropar#1970',
    avatarUrl: getInitialAvatar(),
  });

  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [saveStatusFeedback, setSaveStatusFeedback] = useState<string | null>(null);

  // Consultar datos actualizados en tiempo real directamente desde Supabase al montar
  useEffect(() => {
    let isMounted = true;
    const loadRealtimeProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const { user: sbUser, error } = await fetchUserFromSupabase(user.username);
        if (isMounted && sbUser && !error) {
          setFormData({
            name: sbUser.name || '',
            email: sbUser.email || '',
            phone: sbUser.phone || '',
            jobTitle: sbUser.jobTitle || '',
            state: sbUser.state || 'Sinaloa',
            password: sbUser.password || 'Chevropar#1970',
            avatarUrl: sbUser.avatarUrl || getInitialAvatar(),
          });
          // Notificar actualización al estado central
          onUpdateUser({ ...user, ...sbUser });
        }
      } catch (err) {
        console.error('Error fetching realtime profile from Supabase:', err);
      } finally {
        if (isMounted) setIsLoadingProfile(false);
      }
    };

    loadRealtimeProfile();
    return () => {
      isMounted = false;
    };
  }, [user.username]);

  const [showPassword, setShowPassword] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress and crop image to crisp 160x160 square WebP/JPEG dataUrl (~7KB)
  // Perfectly fits under storage limits and transfers cleanly to Supabase
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 160;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          // Center crop
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
          resolve(compressedDataUrl);
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Function to generate a high-security password
  const generateSecurePassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%&*';

    let generated = 'Chevro#';
    const all = upper + lower + digits + symbols;
    for (let i = 0; i < 7; i++) {
      generated += all.charAt(Math.floor(Math.random() * all.length));
    }

    setFormData((prev) => ({ ...prev, password: generated }));
    showToast('Nueva contraseña segura generada.');
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(formData.password);
    setCopiedPass(true);
    showToast('Contraseña copiada al portapapeles.');
    setTimeout(() => setCopiedPass(false), 2500);
  };

  // Upload photo handler with instant compression and real-time saving to Supabase
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    try {
      const compressedDataUrl = await compressImage(file);
      setFormData((prev) => ({ ...prev, avatarUrl: compressedDataUrl }));

      // Guardar en clave de respaldo
      safeStorageSet(`evaluaciones_avatar_${user.username}`, compressedDataUrl);

      const updatedUser: UserSession = {
        ...user,
        name: formData.name.trim() || user.name,
        email: formData.email.trim() || user.email,
        phone: formData.phone.trim() || user.phone,
        jobTitle: formData.jobTitle.trim() || user.jobTitle,
        state: formData.state || user.state,
        password: formData.password || user.password || 'Chevropar#1970',
        avatarUrl: compressedDataUrl,
      };

      // Guardar directamente al instante en la base de datos Supabase
      const sbRes = await saveUserToSupabase(updatedUser);
      if (sbRes.success) {
        onUpdateUser(sbRes.user || updatedUser);
        setSaveStatusFeedback('¡Foto guardada al instante en Supabase!');
        showToast('¡Foto de perfil guardada en Supabase al instante!');
      } else {
        showToast(`Error al guardar foto en Supabase: ${sbRes.error}`);
      }
    } catch (err) {
      console.error(err);
      showToast('Error al procesar y guardar la imagen.');
    } finally {
      setIsProcessingPhoto(false);
      setTimeout(() => setSaveStatusFeedback(null), 4000);
    }
  };

  const handleRemovePhoto = async () => {
    setFormData((prev) => ({ ...prev, avatarUrl: '' }));
    safeStorageRemove(`evaluaciones_avatar_${user.username}`);

    const updatedUser: UserSession = {
      ...user,
      ...formData,
      avatarUrl: '',
    };

    // Guardar en Supabase eliminación de foto al instante
    const res = await saveUserToSupabase(updatedUser);
    if (res.success) {
      onUpdateUser(res.user || updatedUser);
      showToast('Foto de perfil eliminada y guardada en Supabase al instante.');
    } else {
      showToast(`Error al actualizar en Supabase: ${res.error}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDb(true);
    setSaveStatusFeedback(null);

    const updated: UserSession = {
      ...user,
      name: formData.name.trim() || user.name,
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      jobTitle: formData.jobTitle.trim(),
      state: formData.state,
      password: formData.password || user.password || 'Chevropar#1970',
      avatarUrl: formData.avatarUrl,
    };

    // Guardar en base de datos Supabase al instante
    try {
      const res = await saveUserToSupabase(updated);
      if (res.success) {
        onUpdateUser(res.user || updated);
        if (formData.avatarUrl) {
          safeStorageSet(`evaluaciones_avatar_${user.username}`, formData.avatarUrl);
        }
        setSaveStatusFeedback('¡Perfil guardado al instante en Supabase!');
        showToast('¡Datos personales y credenciales guardados en Supabase al instante!');
      } else {
        setSaveStatusFeedback(`Error: ${res.error}`);
        showToast(`Error al guardar en Supabase: ${res.error}`);
      }
    } catch (err: any) {
      const msg = err?.message || 'Error inesperado';
      setSaveStatusFeedback(`Error: ${msg}`);
      showToast(`Error al guardar en Supabase: ${msg}`);
    } finally {
      setIsSavingDb(false);
      setTimeout(() => setSaveStatusFeedback(null), 5000);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 overflow-hidden">
      {/* Top Banner with Logout */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            Mi Perfil de Usuario
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Gestiona tu foto de perfil, datos personales y credenciales de acceso seguro.
          </p>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
            title="Cerrar sesión en este dispositivo"
          >
            <LogOut className="w-4 h-4 text-red-600" />
            <span>Cerrar sesión</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Card Header with Photo */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar Section */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-[#0c323f] text-white flex items-center justify-center font-bold text-2xl uppercase border-2 border-neutral-200 shadow-sm">
              {formData.avatarUrl ? (
                <img
                  src={formData.avatarUrl}
                  alt={formData.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{formData.name.slice(0, 2)}</span>
              )}
            </div>

            {/* Upload Button Overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-full shadow-md transition-transform transform active:scale-95 cursor-pointer"
              title="Subir o cambiar foto"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* User Basic Info Preview */}
          <div className="flex-1 text-center sm:text-left space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h3 className="text-lg font-bold text-neutral-950">
                {formData.name || user.name}
              </h3>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]">
                {user.role}
              </span>
            </div>

            <p className="text-xs text-neutral-500 font-mono">
              Usuario de acceso: <strong className="text-neutral-800">@{user.username}</strong>
            </p>

            <p className="text-xs text-neutral-600">
              {formData.jobTitle} · Estado de {formData.state}
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded transition-colors"
              >
                Cambiar Foto
              </button>
              {formData.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded transition-colors"
                >
                  Quitar Foto
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Personal Data Form */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-neutral-100">
            <User className="w-4 h-4 text-neutral-700" />
            <h4 className="text-sm font-bold text-neutral-900">
              Datos Personales
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-neutral-700 mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-neutral-700 mb-1">
                Nombre de Usuario (Fijo)
              </label>
              <div className="px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-lg text-sm font-mono text-neutral-700 select-all">
                @{user.username}
              </div>
            </div>

            <div>
              <label className="block font-medium text-neutral-700 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-neutral-400" />
                <span>Correo Electrónico</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-neutral-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-neutral-400" />
                <span>Teléfono de Contacto</span>
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-neutral-700 mb-1 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-neutral-400" />
                <span>Cargo o Puesto</span>
              </label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-900 text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-neutral-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                <span>Estado / Entidad Asignada</span>
              </label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-sm focus:outline-none focus:border-neutral-900"
              >
                <option value="Sinaloa">Sinaloa</option>
                <option value="Nuevo León">Nuevo León</option>
                <option value="Jalisco">Jalisco</option>
                <option value="Guanajuato">Guanajuato</option>
                <option value="Puebla">Puebla</option>
                <option value="Chihuahua">Chihuahua</option>
                <option value="Veracruz">Veracruz</option>
                <option value="México">México</option>
                <option value="Coahuila">Coahuila</option>
                <option value="Nacional">Nacional (Todos)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Security & Password Section */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-neutral-700" />
              <h4 className="text-sm font-bold text-neutral-900">
                Contraseña y Seguridad
              </h4>
            </div>

            {/* Secure Password Generator Button */}
            <button
              type="button"
              onClick={generateSecurePassword}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0c323f] bg-[#e0f2fe] hover:bg-[#bae6fd] border border-[#7dd3fc] rounded-lg transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0369a1]" />
              <span>Generar Contraseña Segura</span>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Contraseña de Acceso al Dashboard
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-3 pr-24 py-2 border border-neutral-300 rounded-lg text-sm font-mono focus:outline-none focus:border-neutral-900"
                />

                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded"
                    title="Copiar contraseña"
                  >
                    {copiedPass ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Puedes hacer clic en el botón de ojo para ver tu contraseña, copiarla con el botón adyacente o pulsar <strong>"Generar Contraseña Segura"</strong> para obtener una clave aleatoria de alta entropía.
            </p>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSavingDb}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#0c323f] hover:bg-[#164e5e] rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingDb ? 'Guardando en Supabase...' : 'Guardar Datos y Foto en Supabase'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
