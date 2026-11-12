import { UserSession, UserLoginLog } from '../types';
import { safeStorageGet, safeStorageSet } from './sessionManager';

const LOGIN_LOGS_KEY = 'evaluaciones_login_audit_logs_v1';
const USERS_LIST_KEY = 'evaluaciones_users_list_v1';

/**
 * Detect user browser and platform for audit logging
 */
export function getDeviceInfo(): string {
  if (typeof window === 'undefined' || !navigator) return 'Desconocido';
  const ua = navigator.userAgent || '';
  let browser = 'Navegador Web';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';

  let os = 'Dispositivo';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} (${os})`;
}

/**
 * Format date to standard Mexican Spanish format: DD/MM/YYYY, hh:mm:ss a
 */
export function formatToMexicanDateTime(date: Date): string {
  try {
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch (e) {
    return date.toISOString();
  }
}

/**
 * Get all stored login logs (newest first)
 */
export function getUserLoginLogs(): UserLoginLog[] {
  try {
    const raw = safeStorageGet(LOGIN_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.error('Error reading login logs:', e);
  }
  return [];
}

/**
 * Get logs filtered by username
 */
export function getUserRecentLogins(username: string, limit = 10): UserLoginLog[] {
  const clean = username.trim().toLowerCase();
  const all = getUserLoginLogs();
  return all.filter((l) => l.username.toLowerCase() === clean).slice(0, limit);
}

/**
 * Record a new login event into local storage and update user session
 */
export function recordUserLogin(user: UserSession): UserSession {
  const now = new Date();
  const isoTimestamp = now.toISOString();
  const formattedDate = formatToMexicanDateTime(now);
  const deviceInfo = getDeviceInfo();

  const newLog: UserLoginLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    username: user.username.trim().toLowerCase(),
    name: user.name,
    role: user.role,
    timestamp: isoTimestamp,
    formattedDate,
    deviceInfo,
  };

  // 1. Update logs array (keep last 500 records)
  try {
    const logs = getUserLoginLogs();
    const updatedLogs = [newLog, ...logs].slice(0, 500);
    safeStorageSet(LOGIN_LOGS_KEY, JSON.stringify(updatedLogs));
  } catch (e) {
    console.error('Error writing login log:', e);
  }

  // 2. Count total logins for this user
  const userLogs = getUserRecentLogins(user.username, 1000);
  const totalCount = Math.max((user.loginCount || 0) + 1, userLogs.length);

  const updatedUser: UserSession = {
    ...user,
    lastLoginAt: isoTimestamp,
    loginCount: totalCount,
  };

  // 3. Update the user in evaluations_users_list_v1
  try {
    const savedList = safeStorageGet(USERS_LIST_KEY);
    if (savedList) {
      const parsed: UserSession[] = JSON.parse(savedList);
      if (Array.isArray(parsed)) {
        const cleanUser = user.username.trim().toLowerCase();
        let found = false;
        const nextList = parsed.map((u) => {
          if (u.username.toLowerCase() === cleanUser) {
            found = true;
            return {
              ...u,
              lastLoginAt: isoTimestamp,
              loginCount: totalCount,
            };
          }
          return u;
        });

        if (!found) {
          nextList.push(updatedUser);
        }
        safeStorageSet(USERS_LIST_KEY, JSON.stringify(nextList));
      }
    }
  } catch (e) {
    console.error('Error updating users list with login time:', e);
  }

  return updatedUser;
}

/**
 * Format relative and full time for display
 */
export function formatLastLoginDisplay(isoDate?: string): {
  relative: string;
  full: string;
  isToday: boolean;
  timeOnly: string;
} {
  if (!isoDate) {
    return {
      relative: 'Sin accesos registrados',
      full: 'El usuario aún no ha iniciado sesión',
      isToday: false,
      timeOnly: '',
    };
  }

  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) {
      return {
        relative: isoDate,
        full: isoDate,
        isToday: false,
        timeOnly: '',
      };
    }

    const now = new Date();
    const full = formatToMexicanDateTime(date);

    const timeOnly = date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMinutes < 1) {
      return { relative: 'Hace unos momentos', full, isToday: true, timeOnly };
    }
    if (diffMinutes < 60) {
      return { relative: `Hace ${diffMinutes} min`, full, isToday: true, timeOnly };
    }
    if (isToday) {
      return { relative: `Hoy, ${timeOnly}`, full, isToday: true, timeOnly };
    }
    if (isYesterday) {
      return { relative: `Ayer, ${timeOnly}`, full, isToday: false, timeOnly };
    }

    const dateShort = date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return {
      relative: `${dateShort}, ${timeOnly}`,
      full,
      isToday: false,
      timeOnly,
    };
  } catch (e) {
    return {
      relative: isoDate,
      full: isoDate,
      isToday: false,
      timeOnly: '',
    };
  }
}
