import { UserSession, MainNavSection, EvalSubModule, UserRole } from '../types';
import { INITIAL_USERS } from '../data/initialData';

const STORAGE_KEYS = {
  USER_SESSION_V2: 'evaluaciones_user_session_v2',
  USER_SESSION_OLD: 'evaluaciones_user_session',
  ACTIVE_USERNAME: 'evaluaciones_active_username',
  ACTIVE_ROLE: 'evaluaciones_active_role',
  IS_ADMIN: 'evaluaciones_is_admin_account',
  CURRENT_SECTION: 'evaluaciones_current_section_v1',
  EVAL_SUBMODULE: 'evaluaciones_eval_submodule_v1',
  PLANT_EVAL_SUBMODULE: 'evaluaciones_plant_eval_submodule_v1',
  TARGET_STATION: 'evaluaciones_target_station_v1',
  TARGET_PLANT: 'evaluaciones_target_plant_v1',
  USERS_LIST: 'evaluaciones_users_list_v1',
  AVATAR_PREFIX: 'evaluaciones_avatar_',
};

const VALID_SECTIONS: MainNavSection[] = [
  'inicio',
  'mapa',
  'metricas',
  'estaciones',
  'evaluaciones',
  'plantas_mapa',
  'plantas_metricas',
  'plantas',
  'plantas_evaluaciones',
  'usuarios',
  'supabase',
  'perfil',
  'historial',
  'distribuidor',
  'zoho',
];

// Helper: In-window storage through window.name
// In all modern browsers, window.name is 100% preserved across page reloads/refreshes
// even in sandboxed iframes and when third-party storage is restricted.
function getWindowNameStore(): Record<string, string> {
  try {
    if (typeof window !== 'undefined' && window.name && window.name.startsWith('__GACCS_STORE__')) {
      const json = window.name.slice(15);
      return JSON.parse(json);
    }
  } catch {}
  return {};
}

function setWindowNameStoreKey(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') {
      const store = getWindowNameStore();
      store[key] = value;
      window.name = '__GACCS_STORE__' + JSON.stringify(store);
    }
  } catch {}
}

function removeWindowNameStoreKey(key: string): void {
  try {
    if (typeof window !== 'undefined') {
      const store = getWindowNameStore();
      delete store[key];
      window.name = '__GACCS_STORE__' + JSON.stringify(store);
    }
  } catch {}
}

// Helper: Cookies (survives refreshes in cookie-enabled environments)
function setCookie(key: string, value: string): void {
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${key}=${encodeURIComponent(value)};path=/;max-age=31536000;SameSite=Lax`;
    }
  } catch {}
}

function getCookie(key: string): string | null {
  try {
    if (typeof document !== 'undefined' && document.cookie) {
      const pairs = document.cookie.split(';');
      for (const pair of pairs) {
        const [k, v] = pair.trim().split('=');
        if (k === key && v) {
          return decodeURIComponent(v);
        }
      }
    }
  } catch {}
  return null;
}

function removeCookie(key: string): void {
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${key}=;path=/;max-age=0;SameSite=Lax`;
    }
  } catch {}
}

/**
 * Multi-layer storage setter (localStorage + sessionStorage + window.name + cookie)
 */
export function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
  try {
    sessionStorage.setItem(key, value);
  } catch {}
  setWindowNameStoreKey(key, value);
  setCookie(key, value);
}

/**
 * Multi-layer storage getter (checks localStorage, sessionStorage, window.name, cookie)
 */
export function safeStorageGet(key: string): string | null {
  try {
    const val = localStorage.getItem(key);
    if (val !== null && val !== undefined && val !== '' && val !== 'undefined' && val !== 'null') {
      return val;
    }
  } catch {}

  try {
    const val = sessionStorage.getItem(key);
    if (val !== null && val !== undefined && val !== '' && val !== 'undefined' && val !== 'null') {
      return val;
    }
  } catch {}

  try {
    const store = getWindowNameStore();
    if (store && store[key] !== undefined && store[key] !== '' && store[key] !== 'null') {
      return store[key];
    }
  } catch {}

  try {
    const val = getCookie(key);
    if (val !== null && val !== undefined && val !== '' && val !== 'undefined' && val !== 'null') {
      return val;
    }
  } catch {}

  return null;
}

/**
 * Multi-layer storage remover
 */
export function safeStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
  try {
    sessionStorage.removeItem(key);
  } catch {}
  removeWindowNameStoreKey(key);
  removeCookie(key);
}

/**
 * Persist user session across page refreshes.
 * Scoped strictly to sessionStorage:
 * - Page refresh (F5/reload): Session is preserved so user doesn't lose work.
 * - Browser/Tab close: Browser automatically destroys sessionStorage, requiring user to re-enter credentials on next visit.
 */
export function persistUserSession(user: UserSession | null): void {
  if (user) {
    try {
      sessionStorage.setItem(STORAGE_KEYS.USER_SESSION_V2, JSON.stringify(user));
      sessionStorage.setItem(STORAGE_KEYS.ACTIVE_USERNAME, user.username);
      sessionStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, user.role);
      if (user.role === 'Admin') {
        sessionStorage.setItem(STORAGE_KEYS.IS_ADMIN, 'true');
      }
    } catch (e) {
      console.error('Error saving session to sessionStorage:', e);
    }

    // Limpiar claves antiguas en localStorage y cookies permanentes para garantizar que al cerrar el navegador se pida login
    try {
      localStorage.removeItem(STORAGE_KEYS.USER_SESSION_V2);
      localStorage.removeItem(STORAGE_KEYS.USER_SESSION_OLD);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USERNAME);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE);
      localStorage.removeItem(STORAGE_KEYS.IS_ADMIN);
      removeCookie(STORAGE_KEYS.USER_SESSION_V2);
      removeCookie(STORAGE_KEYS.USER_SESSION_OLD);
      removeCookie(STORAGE_KEYS.ACTIVE_USERNAME);
      removeWindowNameStoreKey(STORAGE_KEYS.USER_SESSION_V2);
      removeWindowNameStoreKey(STORAGE_KEYS.ACTIVE_USERNAME);
    } catch {}
  }
}

/**
 * Explicit session removal when the user clicks 'Cerrar Sesión'
 */
export function clearUserSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.USER_SESSION_V2);
    sessionStorage.removeItem(STORAGE_KEYS.USER_SESSION_OLD);
    sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_USERNAME);
    sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE);
    sessionStorage.removeItem(STORAGE_KEYS.IS_ADMIN);
  } catch {}

  safeStorageRemove(STORAGE_KEYS.USER_SESSION_V2);
  safeStorageRemove(STORAGE_KEYS.USER_SESSION_OLD);
  safeStorageRemove(STORAGE_KEYS.ACTIVE_USERNAME);
  safeStorageRemove(STORAGE_KEYS.ACTIVE_ROLE);
  safeStorageRemove(STORAGE_KEYS.IS_ADMIN);
}

/**
 * Load user session on app mount.
 * Checks ONLY sessionStorage: if the user closed the browser/tab, this returns null
 * and requires fresh login credentials.
 */
export function loadUserSession(): UserSession | null {
  try {
    // Verificar exclusivamente en sessionStorage (se borra automáticamente al cerrar navegador/pestaña)
    const raw = sessionStorage.getItem(STORAGE_KEYS.USER_SESSION_V2);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.username) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error al cargar sesión de usuario desde sessionStorage:', e);
  }

  // Si no está en sessionStorage, limpiar cualquier rastro residual en localStorage
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_SESSION_V2);
    localStorage.removeItem(STORAGE_KEYS.USER_SESSION_OLD);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USERNAME);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE);
    localStorage.removeItem(STORAGE_KEYS.IS_ADMIN);
  } catch {}

  return null;
}

/**
 * Determine if current account has Admin privileges
 */
export function loadIsAdminAccount(user: UserSession | null): boolean {
  try {
    const saved = safeStorageGet(STORAGE_KEYS.IS_ADMIN);
    if (saved === 'true') return true;
    if (saved === 'false') return false;
  } catch {}

  if (user) {
    const clean = user.username.trim().toLowerCase();
    return (
      user.role === 'Admin' ||
      clean === 'haroldo90' ||
      clean === 'admin' ||
      clean === 'admin1' ||
      clean.includes('admin')
    );
  }
  return false;
}

/**
 * Save Admin privilege flag
 */
export function saveIsAdminAccount(isAdmin: boolean): void {
  safeStorageSet(STORAGE_KEYS.IS_ADMIN, isAdmin ? 'true' : 'false');
}

/**
 * Parse navigation location from URL hash if available (e.g., #section=evaluaciones&sub=modulo2)
 */
function parseHashLocation(): Partial<{
  section: MainNavSection;
  evalSubModule: EvalSubModule;
  plantEvalSubModule: EvalSubModule;
  targetStation: string | null;
  targetPlant: string | null;
}> {
  try {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace(/^#/, '');
      const params = new URLSearchParams(hash);
      const res: any = {};
      const section = params.get('section') as MainNavSection;
      if (section && VALID_SECTIONS.includes(section)) {
        res.section = section;
      }
      const sub = params.get('sub') as EvalSubModule;
      if (sub === 'modulo1' || sub === 'modulo2' || sub === 'modulo3') {
        res.evalSubModule = sub;
      }
      const plantSub = params.get('plantSub') as EvalSubModule;
      if (plantSub === 'modulo1' || plantSub === 'modulo2' || plantSub === 'modulo3') {
        res.plantEvalSubModule = plantSub;
      }
      const st = params.get('station');
      if (st) res.targetStation = st;
      const pl = params.get('plant');
      if (pl) res.targetPlant = pl;
      return res;
    }
  } catch {}
  return {};
}

/**
 * Load navigation location so refresh keeps the user exactly where they were.
 * Prioritizes URL hash (browser address bar), then multi-layer storage.
 */
export function loadNavigationLocation(): {
  section: MainNavSection;
  evalSubModule: EvalSubModule;
  plantEvalSubModule: EvalSubModule;
  targetStation: string | null;
  targetPlant: string | null;
} {
  let section: MainNavSection = 'inicio';
  let evalSubModule: EvalSubModule = 'modulo1';
  let plantEvalSubModule: EvalSubModule = 'modulo1';
  let targetStation: string | null = null;
  let targetPlant: string | null = null;

  // 1. Read from storage
  try {
    const savedSection = safeStorageGet(STORAGE_KEYS.CURRENT_SECTION) as MainNavSection;
    if (savedSection && VALID_SECTIONS.includes(savedSection)) {
      section = savedSection;
    }
  } catch {}

  try {
    const savedSub = safeStorageGet(STORAGE_KEYS.EVAL_SUBMODULE) as EvalSubModule;
    if (savedSub === 'modulo1' || savedSub === 'modulo2' || savedSub === 'modulo3') {
      evalSubModule = savedSub;
    }
  } catch {}

  try {
    const savedPlantSub = safeStorageGet(STORAGE_KEYS.PLANT_EVAL_SUBMODULE) as EvalSubModule;
    if (savedPlantSub === 'modulo1' || savedPlantSub === 'modulo2' || savedPlantSub === 'modulo3') {
      plantEvalSubModule = savedPlantSub;
    }
  } catch {}

  try {
    targetStation = safeStorageGet(STORAGE_KEYS.TARGET_STATION);
  } catch {}

  try {
    targetPlant = safeStorageGet(STORAGE_KEYS.TARGET_PLANT);
  } catch {}

  // 2. Check URL Hash (takes precedence if user refreshed a specific URL)
  const fromHash = parseHashLocation();
  if (fromHash.section) section = fromHash.section;
  if (fromHash.evalSubModule) evalSubModule = fromHash.evalSubModule;
  if (fromHash.plantEvalSubModule) plantEvalSubModule = fromHash.plantEvalSubModule;
  if (fromHash.targetStation) targetStation = fromHash.targetStation;
  if (fromHash.targetPlant) targetPlant = fromHash.targetPlant;

  return { section, evalSubModule, plantEvalSubModule, targetStation, targetPlant };
}

/**
 * Save current navigation location so browser refresh keeps the user exactly where they were.
 * Stores in multi-layer storage and synchronizes URL hash smoothly.
 */
export function saveNavigationLocation(
  section: MainNavSection,
  evalSubModule: EvalSubModule,
  targetStation: string | null,
  plantEvalSubModule?: EvalSubModule,
  targetPlant?: string | null
): void {
  safeStorageSet(STORAGE_KEYS.CURRENT_SECTION, section);
  safeStorageSet(STORAGE_KEYS.EVAL_SUBMODULE, evalSubModule);
  if (plantEvalSubModule) {
    safeStorageSet(STORAGE_KEYS.PLANT_EVAL_SUBMODULE, plantEvalSubModule);
  }
  if (targetStation) {
    safeStorageSet(STORAGE_KEYS.TARGET_STATION, targetStation);
  } else {
    safeStorageRemove(STORAGE_KEYS.TARGET_STATION);
  }
  if (targetPlant) {
    safeStorageSet(STORAGE_KEYS.TARGET_PLANT, targetPlant);
  } else {
    safeStorageRemove(STORAGE_KEYS.TARGET_PLANT);
  }

  // Synchronize URL hash so browser refresh or history navigation preserves the exact screen
  try {
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
      const params = new URLSearchParams();
      params.set('section', section);
      if (section === 'evaluaciones') {
        params.set('sub', evalSubModule);
        if (targetStation) params.set('station', targetStation);
      } else if (section === 'plantas_evaluaciones') {
        params.set('plantSub', plantEvalSubModule || 'modulo1');
        if (targetPlant) params.set('plant', targetPlant);
      }
      const newHash = '#' + params.toString();
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, '', newHash);
      }
    }
  } catch {}
}
