import { createClient } from '@supabase/supabase-js';
import { StationEvaluationRecord, UserSession, AnexoFile } from '../types';
import { INITIAL_ANEXOS, INITIAL_USERS } from '../data/initialData';
import { isSameStation } from '../utils/evaluationFormulas';

// Supabase Configuration specified by user
export const SUPABASE_CONFIG = {
  projectName: "gaccs@appdesignsoftware.com's Project",
  projectId: 'yybannuorhqsykqagkwz',
  url: 'https://yybannuorhqsykqagkwz.supabase.co',
  restUrl: 'https://yybannuorhqsykqagkwz.supabase.co/rest/v1/',
  anonKey: 'sb_publishable_KZ8eHozeaRkHz3-IJWlM-w_9Ix2xx63',
  dashboardUrl: 'https://supabase.com/dashboard/project/yybannuorhqsykqagkwz',
  credentials: {
    user: 'gaccs@appdesignsoftware.com',
    pass: 'Chevropar#1970',
  },
};

// Supabase client instance
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export interface SupabaseHealthResult {
  connected: boolean;
  tableExists: boolean;
  latencyMs: number;
  recordsCount: number;
  errorDetail: string | null;
  errorCode: string | null;
  httpStatus?: number;
  testedAt: string;
}

/**
 * Monitor connection to Supabase and check if table 'evaluaciones_registros' exists and is accessible.
 */
export async function checkSupabaseHealth(): Promise<SupabaseHealthResult> {
  const start = performance.now();
  const testedAt = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  try {
    // 1. Direct REST ping test to check base server connectivity
    let restConnected = false;
    try {
      const pingRes = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/health`, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_CONFIG.anonKey,
        },
      });
      // 200 confirms connectivity to Supabase project gateway
      if (pingRes.status === 200) {
        restConnected = true;
      }
    } catch (e: any) {
      // Network or CORS error
      return {
        connected: false,
        tableExists: false,
        latencyMs: Math.round(performance.now() - start),
        recordsCount: 0,
        errorDetail: e?.message || 'No se pudo contactar el servidor de Supabase (Error de Red / Conexión Fallida).',
        errorCode: 'NETWORK_ERROR',
        testedAt,
      };
    }

    // 2. Query table evaluaciones_registros via Supabase client
    const { data, count, error, status } = await supabase
      .from('evaluaciones_registros')
      .select('*', { count: 'exact' })
      .limit(1);

    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      // Check if table does not exist (PostgreSQL error 42P01)
      const isMissingTable =
        error.code === '42P01' ||
        error.message.toLowerCase().includes('does not exist') ||
        error.message.toLowerCase().includes('not found') ||
        error.code === 'PGRST204' ||
        error.code === 'PGRST205';

      return {
        connected: restConnected,
        tableExists: !isMissingTable,
        latencyMs,
        recordsCount: 0,
        errorDetail: isMissingTable
          ? `La base de datos de Supabase está en línea, pero la tabla "evaluaciones_registros" aún no ha sido creada. Corre el script SQL en el Editor SQL de Supabase para generarla.`
          : `Error devuelto por Supabase: ${error.message} (Código: ${error.code || status})`,
        errorCode: error.code || String(status),
        httpStatus: status,
        testedAt,
      };
    }

    // Success: connected and table exists
    return {
      connected: true,
      tableExists: true,
      latencyMs,
      recordsCount: count ?? (data ? data.length : 0),
      errorDetail: null,
      errorCode: null,
      httpStatus: status,
      testedAt,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      connected: false,
      tableExists: false,
      latencyMs,
      recordsCount: 0,
      errorDetail: err?.message || 'Error inesperado al probar conexión con Supabase.',
      errorCode: 'UNEXPECTED_ERROR',
      testedAt,
    };
  }
}

/**
 * Fetch all records from Supabase table (paginated to exceed 1000 limit)
 */
export async function fetchSupabaseEvaluationRecords(): Promise<{
  records: StationEvaluationRecord[];
  error: string | null;
}> {
  try {
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('evaluaciones_registros')
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        return { records: [], error: error.message };
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    }

    // Format fields back to StationEvaluationRecord
    const formatted: StationEvaluationRecord[] = allData.map((row: any) => ({
      id: String(row.id),
      concatenar: row.concatenar || `${row.estacion}${row.mes}${row.punto}`,
      ciudad: row.ciudad || '',
      estacion: row.estacion || '',
      mes: row.mes,
      anio: Number(row.anio) || 2026,
      punto: row.punto || '',
      calificacion:
        row.calificacion === '' || row.calificacion === null || row.calificacion === undefined
          ? ''
          : isNaN(Number(row.calificacion))
          ? row.calificacion
          : Number(row.calificacion),
      rubroId: row.rubro_id ? Number(row.rubro_id) : undefined,
      observaciones: row.observaciones || undefined,
      evidencias: Array.isArray(row.evidencias) ? row.evidencias : [],
    }));

    return { records: formatted, error: null };
  } catch (err: any) {
    return { records: [], error: err?.message || 'Error al obtener registros de Supabase' };
  }
}

/**
 * Delete a single record by ID
 */
export async function deleteSupabaseRecord(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.from('evaluaciones_registros').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al eliminar registro' };
  }
}

/**
 * Delete a batch of records by IDs and optionally concatenars (selective permanent deletion with chunking)
 */
export async function deleteSupabaseRecords(
  ids: string[],
  concatenars?: string[]
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (ids.length === 0 && (!concatenars || concatenars.length === 0)) return { success: true, error: null };
    const batchSize = 100;
    let lastError: string | null = null;

    // Delete by IDs
    if (ids.length > 0) {
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { error } = await supabase.from('evaluaciones_registros').delete().in('id', batch);
        if (error) {
          console.warn('Supabase delete by id error:', error.message);
          lastError = error.message;
        }
      }
    }

    // Delete by Concatenar (protects against mismatched IDs or re-seeded rows)
    if (concatenars && concatenars.length > 0) {
      for (let i = 0; i < concatenars.length; i += batchSize) {
        const batch = concatenars.slice(i, i + batchSize);
        const { error } = await supabase.from('evaluaciones_registros').delete().in('concatenar', batch);
        if (error) {
          console.warn('Supabase delete by concatenar error:', error.message);
          if (!lastError) lastError = error.message;
        }
      }
    }

    if (lastError) {
      return { success: false, error: lastError };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al eliminar selección de registros' };
  }
}

/**
 * Delete all records from Supabase table (global deletion)
 */
export async function deleteAllSupabaseRecords(): Promise<{ success: boolean; error: string | null }> {
  try {
    // Delete where id is not empty (covers all rows)
    const { error } = await supabase.from('evaluaciones_registros').delete().neq('id', '___NEVER_MATCH___');
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al vaciar la tabla de Supabase' };
  }
}

/**
 * Delete all plant records from Supabase table (global deletion)
 */
export async function deleteAllSupabasePlantRecords(): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.from('evaluaciones_plantas_registros').delete().neq('id', '___NEVER_MATCH___');
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al vaciar la tabla de plantas de Supabase' };
  }
}

/**
 * Delete all test import attachments from Supabase table (global deletion)
 */
export async function deleteAllSupabaseImportHistory(): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.from('anexos_mensuales').delete().neq('id', '___NEVER_MATCH___');
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al vaciar anexos de Supabase' };
  }
}

/**
 * Seed / Restore default users to Supabase table 'usuarios'
 */
export async function seedDefaultUsersToSupabase(): Promise<{
  success: boolean;
  count: number;
  error: string | null;
}> {
  try {
    let count = 0;
    for (const u of INITIAL_USERS) {
      const res = await saveUserToSupabase(u);
      if (res.success) count++;
    }
    return { success: true, count, error: null };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Error al re-sembrar usuarios en Supabase' };
  }
}

/**
 * Save or update a single record in Supabase
 */
export async function saveRecordToSupabase(
  rec: StationEvaluationRecord
): Promise<{ success: boolean; error: string | null }> {
  try {
    const payload = {
      id: rec.id,
      concatenar: rec.concatenar,
      ciudad: rec.ciudad,
      estacion: rec.estacion,
      mes: rec.mes,
      anio: rec.anio,
      punto: rec.punto,
      calificacion: String(rec.calificacion),
      rubro_id: rec.rubroId || null,
      observaciones: rec.observaciones || null,
      evidencias: rec.evidencias || [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('evaluaciones_registros').upsert(payload, { onConflict: 'id' });
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al guardar en Supabase' };
  }
}

/**
 * Batch sync local records into Supabase
 */
export async function syncRecordsToSupabase(
  records: StationEvaluationRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<{ success: boolean; count: number; error: string | null }> {
  try {
    if (records.length === 0) return { success: true, count: 0, error: null };

    // Sanitize and format all records for insertion (preventing NaN or nulls that violate constraints)
    const rows = records
      .filter((rec) => rec && (rec.punto || rec.concatenar) && rec.estacion)
      .map((rec) => {
        let safeYear = 2026;
        if (rec.anio !== undefined && rec.anio !== null) {
          const yrNum = typeof rec.anio === 'number' ? rec.anio : parseInt(String(rec.anio).replace(/\D/g, ''), 10);
          if (!isNaN(yrNum) && yrNum >= 2000 && yrNum <= 2100) {
            safeYear = Math.floor(yrNum);
          }
        }
        return {
          id: rec.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          concatenar: rec.concatenar || `${rec.estacion}${rec.mes || 'SEPTIEMBRE'}${rec.punto || ''}`,
          ciudad: rec.ciudad || 'Sinaloa',
          estacion: String(rec.estacion).trim(),
          mes: String(rec.mes || 'SEPTIEMBRE').trim(),
          anio: safeYear,
          punto: String(rec.punto || 'Punto').trim(),
          calificacion: String(rec.calificacion ?? '').trim(),
          rubro_id: rec.rubroId || null,
          observaciones: rec.observaciones || null,
          evidencias: Array.isArray(rec.evidencias) ? rec.evidencias : [],
          updated_at: new Date().toISOString(),
        };
      });

    if (rows.length === 0) return { success: true, count: 0, error: null };

    // Deduplicate IDs within the payload to prevent PostgreSQL "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const seenIds = new Set<string>();
    const uniqueRows: typeof rows = [];
    for (const row of rows) {
      let uniqueId = row.id;
      if (seenIds.has(uniqueId)) {
        uniqueId = `${row.id}-${Math.random().toString(36).slice(2, 7)}`;
        row.id = uniqueId;
      }
      seenIds.add(uniqueId);
      uniqueRows.push(row);
    }

    // Insert in batches of 100 to avoid payload limits
    const batchSize = 100;
    for (let i = 0; i < uniqueRows.length; i += batchSize) {
      const batch = uniqueRows.slice(i, i + batchSize);
      const { error } = await supabase.from('evaluaciones_registros').upsert(batch, { onConflict: 'id' });
      if (error) {
        return { success: false, count: i, error: error.message };
      }
      if (onProgress) {
        onProgress(Math.min(i + batch.length, uniqueRows.length), uniqueRows.length);
      }
    }

    return { success: true, count: uniqueRows.length, error: null };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Error al sincronizar registros a Supabase' };
  }
}

/**
 * Fetch a single user profile directly from Supabase
 */
export async function fetchUserFromSupabase(
  username: string
): Promise<{ user: UserSession | null; error: string | null }> {
  try {
    const clean = username.trim().toLowerCase();
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('username', clean)
      .maybeSingle();

    if (error) {
      return { user: null, error: error.message };
    }
    if (!data) {
      return { user: null, error: null };
    }

    const user: UserSession = {
      username: data.username,
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      role: (data.role as any) || 'Coordinador',
      jobTitle: data.job_title || undefined,
      state: data.state || undefined,
      avatarUrl: data.avatar_url || undefined,
      password: data.password || 'Chevropar#1970',
      status: (data.status as 'Activo' | 'Inactivo') || 'Activo',
      createdAt: data.created_at,
      lastLoginAt: data.last_login_at || undefined,
      loginCount: data.login_count ? Number(data.login_count) : undefined,
    };
    return { user, error: null };
  } catch (err: any) {
    return { user: null, error: err?.message || 'Error al consultar usuario en Supabase' };
  }
}

/**
 * Save or update a user profile instantly in Supabase
 */
export async function saveUserToSupabase(
  user: UserSession
): Promise<{ success: boolean; user?: UserSession; error: string | null }> {
  try {
    const cleanUsername = user.username.trim().toLowerCase();
    const cleanName = user.name.trim() || cleanUsername;

    const payload: Record<string, any> = {
      username: cleanUsername,
      name: cleanName,
      email: user.email ? user.email.trim() : null,
      phone: user.phone ? user.phone.trim() : null,
      role: user.role || 'Coordinador',
      job_title: user.jobTitle ? user.jobTitle.trim() : null,
      state: user.state ? user.state.trim() : null,
      assigned_states: user.assignedStates && user.assignedStates.length > 0
        ? user.assignedStates
        : (user.state ? [user.state] : ['Sinaloa']),
      password: user.password ? user.password.trim() : 'Chevropar#1970',
      status: user.status || 'Activo',
      avatar_url: user.avatarUrl || null,
      last_login_at: user.lastLoginAt || null,
      login_count: user.loginCount !== undefined ? user.loginCount : null,
      updated_at: new Date().toISOString(),
    };

    let { data, error, status } = await supabase
      .from('usuarios')
      .upsert(payload, { onConflict: 'username' })
      .select()
      .maybeSingle();

    // Si columnas nuevas (last_login_at, login_count o assigned_states) aún no existen en Supabase antes de correr el SQL, reintentar sin ellas
    if (error && (error.code === '42703' || error.message?.toLowerCase().includes('column') || error.message?.toLowerCase().includes('assigned_states'))) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.last_login_at;
      delete fallbackPayload.login_count;
      delete fallbackPayload.assigned_states;
      const retry = await supabase
        .from('usuarios')
        .upsert(fallbackPayload, { onConflict: 'username' })
        .select()
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Supabase save user error:', error);
      return {
        success: false,
        error: `${error.message} (Código: ${error.code || status})`,
      };
    }

    const savedUser: UserSession = {
      username: cleanUsername,
      name: cleanName,
      email: payload.email || undefined,
      phone: payload.phone || undefined,
      role: payload.role,
      jobTitle: payload.job_title || undefined,
      state: payload.state || undefined,
      assignedStates: user.assignedStates || (payload.state ? [payload.state] : ['Sinaloa']),
      password: payload.password,
      status: payload.status,
      avatarUrl: payload.avatar_url || undefined,
      createdAt: data?.created_at || user.createdAt,
      lastLoginAt: data?.last_login_at || user.lastLoginAt,
      loginCount: data?.login_count ? Number(data.login_count) : user.loginCount,
    };

    return { success: true, user: savedUser, error: null };
  } catch (err: any) {
    console.error('Unexpected saveUserToSupabase error:', err);
    return {
      success: false,
      error: err?.message || 'Error inesperado al guardar usuario en Supabase',
    };
  }
}

/**
 * Fetch all registered users from Supabase table 'usuarios'
 */
export async function fetchUsersFromSupabase(): Promise<{
  users: UserSession[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('username', { ascending: true });

    if (error) return { users: [], error: error.message };
    if (!data) return { users: [], error: null };

    const users: UserSession[] = data.map((r: any) => ({
      username: r.username,
      name: r.name,
      email: r.email || undefined,
      phone: r.phone || undefined,
      role: (r.role as any) || 'Coordinador',
      jobTitle: r.job_title || undefined,
      state: r.state || undefined,
      assignedStates: Array.isArray(r.assigned_states)
        ? r.assigned_states
        : (typeof r.assigned_states === 'string' && r.assigned_states.startsWith('[')
            ? JSON.parse(r.assigned_states)
            : (r.state ? [r.state] : ['Sinaloa'])),
      avatarUrl: r.avatar_url || undefined,
      password: r.password || 'Chevropar#1970',
      status: (r.status as 'Activo' | 'Inactivo') || 'Activo',
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at || undefined,
      loginCount: r.login_count ? Number(r.login_count) : undefined,
    }));
    return { users, error: null };
  } catch (err: any) {
    return { users: [], error: err?.message || 'Error al consultar usuarios de Supabase' };
  }
}

/**
 * Delete a user from Supabase table 'usuarios'
 */
export async function deleteUserFromSupabase(
  username: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const clean = username.trim().toLowerCase();
    const { error } = await supabase.from('usuarios').delete().eq('username', clean);
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al eliminar usuario en Supabase' };
  }
}

// =======================================================================
// FUNCIONES DE PLANTAS: evaluaciones_plantas_registros
// =======================================================================

/**
 * Fetch all evaluation records for Plantas from Supabase table (paginated to exceed 1000 limit)
 */
export async function fetchSupabasePlantEvaluationRecords(): Promise<{
  records: StationEvaluationRecord[];
  error: string | null;
}> {
  try {
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('evaluaciones_plantas_registros')
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        return { records: [], error: error.message };
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    }

    const formatted: StationEvaluationRecord[] = allData.map((row: any) => ({
      id: String(row.id),
      concatenar: row.concatenar || `${row.estacion}${row.mes}${row.punto}`,
      ciudad: row.ciudad || '',
      estacion: row.estacion || '',
      mes: row.mes,
      anio: Number(row.anio) || 2026,
      punto: row.punto || '',
      calificacion:
        row.calificacion === '' || row.calificacion === null || row.calificacion === undefined
          ? ''
          : isNaN(Number(row.calificacion))
          ? row.calificacion
          : Number(row.calificacion),
      rubroId: row.rubro_id ? Number(row.rubro_id) : undefined,
      observaciones: row.observaciones || undefined,
      evidencias: Array.isArray(row.evidencias) ? row.evidencias : [],
    }));

    return { records: formatted, error: null };
  } catch (err: any) {
    return { records: [], error: err?.message || 'Error al obtener registros de plantas de Supabase' };
  }
}

/**
 * Save or update a single evaluation record for Plantas in Supabase
 */
export async function savePlantRecordToSupabase(
  rec: StationEvaluationRecord
): Promise<{ success: boolean; error: string | null }> {
  try {
    const payload = {
      id: rec.id,
      concatenar: rec.concatenar,
      ciudad: rec.ciudad,
      estacion: rec.estacion,
      mes: rec.mes,
      anio: rec.anio,
      punto: rec.punto,
      calificacion: String(rec.calificacion),
      rubro_id: rec.rubroId || null,
      observaciones: rec.observaciones || null,
      evidencias: rec.evidencias || [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('evaluaciones_plantas_registros')
      .upsert(payload, { onConflict: 'id' });

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al guardar registro de planta en Supabase' };
  }
}

/**
 * Delete a batch of evaluation records for Plantas (selective permanent deletion with chunking)
 */
export async function deleteSupabasePlantRecords(
  ids: string[],
  concatenars?: string[]
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (ids.length === 0 && (!concatenars || concatenars.length === 0)) return { success: true, error: null };
    const batchSize = 100;
    let lastError: string | null = null;

    // Delete by IDs
    if (ids.length > 0) {
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { error } = await supabase
          .from('evaluaciones_plantas_registros')
          .delete()
          .in('id', batch);
        if (error) {
          console.warn('Supabase plant delete by id warning:', error.message);
          lastError = error.message;
        }
      }
    }

    // Delete by Concatenar
    if (concatenars && concatenars.length > 0) {
      for (let i = 0; i < concatenars.length; i += batchSize) {
        const batch = concatenars.slice(i, i + batchSize);
        const { error } = await supabase
          .from('evaluaciones_plantas_registros')
          .delete()
          .in('concatenar', batch);
        if (error) {
          console.warn('Supabase plant delete by concatenar warning:', error.message);
          if (!lastError) lastError = error.message;
        }
      }
    }

    if (lastError) {
      return { success: false, error: lastError };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al eliminar selección de registros de plantas' };
  }
}

/**
 * Batch sync evaluation records for Plantas to Supabase
 */
export async function syncPlantRecordsToSupabase(
  records: StationEvaluationRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<{ success: boolean; count: number; error: string | null }> {
  try {
    if (records.length === 0) return { success: true, count: 0, error: null };

    const rows = records
      .filter((rec) => rec && (rec.punto || rec.concatenar) && rec.estacion)
      .map((rec) => {
        let safeYear = 2026;
        if (rec.anio !== undefined && rec.anio !== null) {
          const yrNum = typeof rec.anio === 'number' ? rec.anio : parseInt(String(rec.anio).replace(/\D/g, ''), 10);
          if (!isNaN(yrNum) && yrNum >= 2000 && yrNum <= 2100) {
            safeYear = Math.floor(yrNum);
          }
        }
        return {
          id: rec.id || `rec-pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          concatenar: rec.concatenar || `${rec.estacion}${rec.mes || 'SEPTIEMBRE'}${rec.punto || ''}`,
          ciudad: rec.ciudad || 'Sinaloa',
          estacion: String(rec.estacion).trim(),
          mes: String(rec.mes || 'SEPTIEMBRE').trim(),
          anio: safeYear,
          punto: String(rec.punto || 'Punto').trim(),
          calificacion: String(rec.calificacion ?? '').trim(),
          rubro_id: rec.rubroId || null,
          observaciones: rec.observaciones || null,
          evidencias: Array.isArray(rec.evidencias) ? rec.evidencias : [],
          updated_at: new Date().toISOString(),
        };
      });

    if (rows.length === 0) return { success: true, count: 0, error: null };

    // Deduplicate IDs within the payload to prevent PostgreSQL "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const seenIds = new Set<string>();
    const uniqueRows: typeof rows = [];
    for (const row of rows) {
      let uniqueId = row.id;
      if (seenIds.has(uniqueId)) {
        uniqueId = `${row.id}-${Math.random().toString(36).slice(2, 7)}`;
        row.id = uniqueId;
      }
      seenIds.add(uniqueId);
      uniqueRows.push(row);
    }

    const batchSize = 100;
    for (let i = 0; i < uniqueRows.length; i += batchSize) {
      const batch = uniqueRows.slice(i, i + batchSize);
      const { error } = await supabase
        .from('evaluaciones_plantas_registros')
        .upsert(batch, { onConflict: 'id' });
      if (error) {
        return { success: false, count: i, error: error.message };
      }
      if (onProgress) {
        onProgress(Math.min(i + batch.length, uniqueRows.length), uniqueRows.length);
      }
    }

    return { success: true, count: uniqueRows.length, error: null };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Error al sincronizar registros de plantas a Supabase' };
  }
}

// =====================================================================
// ANEXOS MENSUALES (DOCUMENTOS PDF, EXCEL, WORD, ETC.)
// =====================================================================
const ANEXOS_STORAGE_KEY = 'evaluaciones_anexos_v1';
const ANEXOS_DELETED_KEY = 'evaluaciones_anexos_deleted_ids_v1';
export const TEST_ANEXO_IDS = ['anx-sep-01', 'anx-sep-02', 'anx-sep-03'];

/**
 * Cargar el conjunto de IDs de anexos que han sido eliminados por el usuario
 */
export function loadDeletedAnexoIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ANEXOS_DELETED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {
    console.error('Error al leer blacklist de anexos:', e);
  }
  return new Set();
}

/**
 * Registrar un ID de anexo como eliminado permanentemente
 */
export function addDeletedAnexoId(id: string): void {
  try {
    const deleted = loadDeletedAnexoIds();
    deleted.add(id);
    localStorage.setItem(ANEXOS_DELETED_KEY, JSON.stringify(Array.from(deleted)));
  } catch (e) {
    console.error('Error al registrar anexo eliminado:', e);
  }
}

// In-memory cache for full anexo objects (including large content URLs) during session
let inMemoryAnexosCache: AnexoFile[] = [];

/**
 * Cargar anexos desde almacenamiento local (caché offline y persistente)
 */
export function loadLocalAnexos(): AnexoFile[] {
  const deleted = loadDeletedAnexoIds();
  if (inMemoryAnexosCache.length > 0) {
    return inMemoryAnexosCache.filter((a) => !deleted.has(a.id) && !TEST_ANEXO_IDS.includes(a.id));
  }
  try {
    const raw = localStorage.getItem(ANEXOS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const list = parsed.filter((a) => !deleted.has(a.id) && !TEST_ANEXO_IDS.includes(a.id));
        inMemoryAnexosCache = list;
        return list;
      }
    }
  } catch {
    // Ignorar errores de lectura de caché local
  }
  return [];
}

/**
 * Guardar anexos en almacenamiento local asegurando filtrar los eliminados y protegiendo contra QuotaExceededError
 */
export function saveLocalAnexos(anexos: AnexoFile[]): void {
  try {
    const deleted = loadDeletedAnexoIds();
    const clean = anexos.filter((a) => !deleted.has(a.id) && !TEST_ANEXO_IDS.includes(a.id));

    // Mantener la versión completa en memoria para la sesión activa del usuario
    inMemoryAnexosCache = clean;

    // Descartar strings pesados (como base64 data URLs) para no saturar la cuota de localStorage (~5MB)
    const lightweight = clean.map((a) => {
      if (a.contenidoUrl && (a.contenidoUrl.length > 5120 || a.contenidoUrl.startsWith('data:'))) {
        return { ...a, contenidoUrl: '' };
      }
      return a;
    });

    try {
      localStorage.setItem(ANEXOS_STORAGE_KEY, JSON.stringify(lightweight));
    } catch {
      // Si la cuota de localStorage está saturada por otros elementos, intentar guardar metadatos mínimos
      try {
        const minimal = clean.slice(0, 50).map(({ id, mes, anio, estacion, nombreArchivo, tipoArchivo, tamanoBytes, tamanoFormatted, descripcion, subidoPor, subidoPorRol, createdAt }) => ({
          id, mes, anio, estacion, nombreArchivo, tipoArchivo, tamanoBytes, tamanoFormatted, descripcion, subidoPor, subidoPorRol, createdAt, contenidoUrl: ''
        }));
        localStorage.setItem(ANEXOS_STORAGE_KEY, JSON.stringify(minimal));
      } catch {
        // Almacenamiento local saturado; los datos permanecen seguros en memoria y en Supabase
      }
    }
  } catch {
    // Prevenir cualquier error no controlado
  }
}

/**
 * Consultar anexos desde la tabla `anexos_mensuales` de Supabase
 */
export async function fetchAnexosFromSupabase(
  mes?: string,
  anio?: number
): Promise<{ anexos: AnexoFile[]; error: string | null; fromRemote: boolean }> {
  const deleted = loadDeletedAnexoIds();
  try {
    let query = supabase.from('anexos_mensuales').select('*');
    if (mes) {
      query = query.ilike('mes', mes);
    }
    if (anio) {
      query = query.eq('anio', anio);
    }
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      // Si la tabla no existe o falla la conexión, usar caché local filtrada
      const local = loadLocalAnexos();
      const filtered = local.filter((a) => {
        if (deleted.has(a.id) || TEST_ANEXO_IDS.includes(a.id)) return false;
        if (mes && a.mes?.toUpperCase() !== mes?.toUpperCase()) return false;
        if (anio && a.anio && a.anio !== anio) return false;
        return true;
      });
      return { anexos: filtered, error: error.message, fromRemote: false };
    }

    if (!data || data.length === 0) {
      // La tabla en Supabase no tiene filas. Leer local pero respetando eliminados
      const local = loadLocalAnexos();
      const filtered = local.filter((a) => {
        if (deleted.has(a.id) || TEST_ANEXO_IDS.includes(a.id)) return false;
        if (mes && a.mes?.toUpperCase() !== mes?.toUpperCase()) return false;
        if (anio && a.anio && a.anio !== anio) return false;
        return true;
      });
      return { anexos: filtered, error: null, fromRemote: true };
    }

    const formatted: AnexoFile[] = data
      .filter((row: any) => !deleted.has(String(row.id)) && !TEST_ANEXO_IDS.includes(String(row.id)))
      .map((row: any) => ({
        id: String(row.id),
        mes: row.mes,
        anio: Number(row.anio) || 2026,
        estacion: row.estacion || 'General',
        nombreArchivo: row.nombre_archivo || 'Documento',
        tipoArchivo: (row.tipo_archivo || 'other') as any,
        tamanoBytes: Number(row.tamano_bytes) || 0,
        tamanoFormatted: formatBytes(Number(row.tamano_bytes) || 0),
        contenidoUrl: row.contenido_url || '',
        descripcion: row.descripcion || '',
        subidoPor: row.subido_por || 'Administrador',
        subidoPorRol: row.subido_por_rol || 'Admin',
        createdAt: row.created_at || new Date().toISOString(),
      }));

    // Actualizar caché local sin revivir eliminados
    const local = loadLocalAnexos();
    const map = new Map<string, AnexoFile>();
    local.forEach((a) => {
      if (!deleted.has(a.id)) map.set(a.id, a);
    });
    formatted.forEach((a) => {
      if (!deleted.has(a.id)) map.set(a.id, a);
    });
    saveLocalAnexos(Array.from(map.values()));

    return { anexos: formatted, error: null, fromRemote: true };
  } catch (err: any) {
    const local = loadLocalAnexos();
    return {
      anexos: local.filter((a) => !deleted.has(a.id)),
      error: err?.message || 'Error de conexión con Supabase',
      fromRemote: false,
    };
  }
}

/**
 * Guardar o actualizar un archivo de anexo en Supabase y caché local
 */
export async function saveAnexoToSupabase(
  anexo: AnexoFile
): Promise<{ success: boolean; error: string | null }> {
  // 1. Guardar de inmediato en caché local
  try {
    const current = loadLocalAnexos();
    const updated = [anexo, ...current.filter((a) => a.id !== anexo.id)];
    saveLocalAnexos(updated);

    // Si estaba en lista de eliminados, removerlo
    const deleted = loadDeletedAnexoIds();
    if (deleted.has(anexo.id)) {
      deleted.delete(anexo.id);
      localStorage.setItem(ANEXOS_DELETED_KEY, JSON.stringify(Array.from(deleted)));
    }
  } catch (e) {
    console.error('Error guardando anexo localmente:', e);
  }

  // 2. Persistir en tabla `anexos_mensuales` de Supabase
  try {
    const payload = {
      id: anexo.id,
      mes: anexo.mes,
      anio: anexo.anio || 2026,
      estacion: anexo.estacion || 'General',
      nombre_archivo: anexo.nombreArchivo,
      tipo_archivo: anexo.tipoArchivo,
      tamano_bytes: anexo.tamanoBytes,
      contenido_url: anexo.contenidoUrl,
      descripcion: anexo.descripcion || null,
      subido_por: anexo.subidoPor,
      subido_por_rol: anexo.subidoPorRol || 'Admin',
      created_at: anexo.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase
      .from('anexos_mensuales')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('No se pudo persistir en Supabase (se mantiene en caché local):', error.message);
      return { success: true, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: true, error: err?.message || 'Error de red con Supabase' };
  }
}

/**
 * Eliminar un anexo de Supabase y de la caché local de forma permanente
 */
export async function deleteAnexoFromSupabase(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  // 1. Agregar a blacklist persistente de eliminados para que NUNCA vuelva a aparecer
  addDeletedAnexoId(id);

  // 2. Eliminar de local
  try {
    const current = loadLocalAnexos();
    const remaining = current.filter((a) => a.id !== id);
    saveLocalAnexos(remaining);
  } catch (e) {
    console.error('Error eliminando anexo local:', e);
  }

  // 3. Eliminar de Supabase
  try {
    const { error } = await supabase.from('anexos_mensuales').delete().eq('id', id);
    if (error) {
      console.warn('Supabase delete error:', error.message);
      return { success: true, error: error.message };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: true, error: err?.message || 'Error al eliminar en Supabase' };
  }
}

/**
 * Borrar de forma masiva los datos de prueba de anexos ('anx-sep-01', 'anx-sep-02', 'anx-sep-03')
 */
export async function deleteAllTestAnexosFromSupabase(): Promise<{ success: boolean; error: string | null }> {
  try {
    TEST_ANEXO_IDS.forEach((id) => addDeletedAnexoId(id));

    const current = loadLocalAnexos();
    const remaining = current.filter((a) => !TEST_ANEXO_IDS.includes(a.id));
    saveLocalAnexos(remaining);

    // Intentar borrar en Supabase si fueron insertados
    try {
      await supabase.from('anexos_mensuales').delete().in('id', TEST_ANEXO_IDS);
    } catch {}

    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Error al borrar datos de prueba de anexos' };
  }
}

/**
 * Vaciar todos los anexos para un mes o año específico
 */
export async function clearAllAnexosFromSupabase(
  month?: string,
  year?: number,
  stationName?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const current = loadLocalAnexos();
    const toDelete = current.filter((a) => {
      if (month && a.mes?.toUpperCase() !== month.toUpperCase()) return false;
      if (year && a.anio && a.anio !== year) return false;
      if (stationName && stationName !== 'ALL' && !isSameStation(a.estacion, stationName)) return false;
      return true;
    });

    toDelete.forEach((a) => addDeletedAnexoId(a.id));
    TEST_ANEXO_IDS.forEach((id) => addDeletedAnexoId(id));

    const remaining = current.filter((a) => !toDelete.some((d) => d.id === a.id));
    saveLocalAnexos(remaining);

    if (toDelete.length > 0) {
      const ids = toDelete.map((a) => a.id);
      try {
        await supabase.from('anexos_mensuales').delete().in('id', ids);
      } catch {}
    }

    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Error al vaciar anexos' };
  }
}

/**
 * Formatear bytes a tamaño legible
 */
function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}


