/**
 * Generates the complete, non-destructive SQL migration & update script for Supabase.
 * IMPORTANT: Never uses DROP TABLE, TRUNCATE, DELETE, or ON CONFLICT DO UPDATE,
 * guaranteeing that all existing records in Supabase are preserved intact.
 */
export function generateSupabaseSqlScript(): string {
  return `-- =====================================================================
-- SISTEMA DE EVALUACIONES GACCS - ACTUALIZACIÓN SEGURA DE SUPABASE
-- Proyecto: gaccs@appdesignsoftware.com's Project
-- Project ID: yybannuorhqsykqagkwz
-- URL REST: https://yybannuorhqsykqagkwz.supabase.co/rest/v1/
-- IMPORTANTE: Este script NO borra ni sobrescribe ningún registro existente.
-- =====================================================================

-- 1. EXTENSIÓN PARA UUID (OPCIONAL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 2. TABLA PRINCIPAL: evaluaciones_registros (Estaciones)
-- =====================================================================
CREATE TABLE IF NOT EXISTS evaluaciones_registros (
  id TEXT PRIMARY KEY,
  concatenar TEXT,
  ciudad TEXT NOT NULL DEFAULT '',
  estacion TEXT NOT NULL,
  mes TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2026,
  punto TEXT NOT NULL,
  calificacion TEXT NOT NULL DEFAULT '',
  rubro_id INTEGER,
  evidencias JSONB DEFAULT '[]'::jsonb,
  observaciones TEXT,
  inspector_submitted_at TIMESTAMPTZ,
  inspector_user TEXT,
  user_final_evidencias JSONB DEFAULT '[]'::jsonb,
  user_final_observaciones TEXT,
  user_final_submitted_at TIMESTAMPTZ,
  user_final_user TEXT,
  timer_elapsed_seconds INTEGER DEFAULT 0,
  timer_frozen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar columnas nuevas si la tabla ya existía (sin perder datos)
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS concatenar TEXT;
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS ciudad TEXT NOT NULL DEFAULT '';
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS rubro_id INTEGER;
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS evidencias JSONB DEFAULT '[]'::jsonb;
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS inspector_submitted_at TIMESTAMPTZ;
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS inspector_user TEXT;
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS user_final_evidencias JSONB DEFAULT '[]'::jsonb;
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS user_final_observaciones TEXT;
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS user_final_submitted_at TIMESTAMPTZ;
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS user_final_user TEXT;
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS timer_elapsed_seconds INTEGER DEFAULT 0;
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS timer_frozen BOOLEAN DEFAULT FALSE;
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE evaluaciones_registros ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Permitir que nuevos puntos inicien sin calificación preseleccionada ('')
ALTER TABLE evaluaciones_registros ALTER COLUMN calificacion SET DEFAULT '';

-- Índices para búsqueda rápida (idempotentes)
CREATE INDEX IF NOT EXISTS idx_evaluaciones_estacion ON evaluaciones_registros(estacion);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_mes ON evaluaciones_registros(mes);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_anio ON evaluaciones_registros(anio);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_rubro ON evaluaciones_registros(rubro_id);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_concatenar ON evaluaciones_registros(concatenar);

-- Permisos de acceso directo con Publishable / Anon Key
ALTER TABLE evaluaciones_registros DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select anon" ON evaluaciones_registros;
DROP POLICY IF EXISTS "Permitir insert anon" ON evaluaciones_registros;
DROP POLICY IF EXISTS "Permitir update anon" ON evaluaciones_registros;
DROP POLICY IF EXISTS "Permitir delete anon" ON evaluaciones_registros;
CREATE POLICY "Permitir select anon" ON evaluaciones_registros FOR SELECT USING (true);
CREATE POLICY "Permitir insert anon" ON evaluaciones_registros FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update anon" ON evaluaciones_registros FOR UPDATE USING (true);
CREATE POLICY "Permitir delete anon" ON evaluaciones_registros FOR DELETE USING (true);

-- =====================================================================
-- 3. TABLA: estaciones_maestro
-- =====================================================================
CREATE TABLE IF NOT EXISTS estaciones_maestro (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL,
  ciudad TEXT NOT NULL,
  calificacion NUMERIC NOT NULL DEFAULT 0,
  estatus TEXT NOT NULL DEFAULT 'Cumple',
  evaluaciones_cerradas INTEGER DEFAULT 0,
  ultimo_periodo TEXT DEFAULT 'Septiembre 2026',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE estaciones_maestro ADD COLUMN IF NOT EXISTS evaluaciones_cerradas INTEGER DEFAULT 0;
ALTER TABLE estaciones_maestro ADD COLUMN IF NOT EXISTS ultimo_periodo TEXT DEFAULT 'Septiembre 2026';
ALTER TABLE estaciones_maestro ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE estaciones_maestro DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select estaciones_maestro anon" ON estaciones_maestro;
DROP POLICY IF EXISTS "Permitir insert estaciones_maestro anon" ON estaciones_maestro;
DROP POLICY IF EXISTS "Permitir update estaciones_maestro anon" ON estaciones_maestro;
DROP POLICY IF EXISTS "Permitir delete estaciones_maestro anon" ON estaciones_maestro;
CREATE POLICY "Permitir select estaciones_maestro anon" ON estaciones_maestro FOR SELECT USING (true);
CREATE POLICY "Permitir insert estaciones_maestro anon" ON estaciones_maestro FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update estaciones_maestro anon" ON estaciones_maestro FOR UPDATE USING (true);
CREATE POLICY "Permitir delete estaciones_maestro anon" ON estaciones_maestro FOR DELETE USING (true);

-- =====================================================================
-- 4. TABLA: plantas_maestro (Módulo Plantas)
-- =====================================================================
CREATE TABLE IF NOT EXISTS plantas_maestro (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL,
  ciudad TEXT NOT NULL,
  calificacion NUMERIC NOT NULL DEFAULT 0,
  estatus TEXT NOT NULL DEFAULT 'Cumple',
  evaluaciones_cerradas INTEGER DEFAULT 0,
  ultimo_periodo TEXT DEFAULT 'Septiembre 2026',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plantas_maestro ADD COLUMN IF NOT EXISTS evaluaciones_cerradas INTEGER DEFAULT 0;
ALTER TABLE plantas_maestro ADD COLUMN IF NOT EXISTS ultimo_periodo TEXT DEFAULT 'Septiembre 2026';
ALTER TABLE plantas_maestro ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE plantas_maestro DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select plantas_maestro anon" ON plantas_maestro;
DROP POLICY IF EXISTS "Permitir insert plantas_maestro anon" ON plantas_maestro;
DROP POLICY IF EXISTS "Permitir update plantas_maestro anon" ON plantas_maestro;
DROP POLICY IF EXISTS "Permitir delete plantas_maestro anon" ON plantas_maestro;
CREATE POLICY "Permitir select plantas_maestro anon" ON plantas_maestro FOR SELECT USING (true);
CREATE POLICY "Permitir insert plantas_maestro anon" ON plantas_maestro FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update plantas_maestro anon" ON plantas_maestro FOR UPDATE USING (true);
CREATE POLICY "Permitir delete plantas_maestro anon" ON plantas_maestro FOR DELETE USING (true);

-- =====================================================================
-- 5. TABLA: evaluaciones_plantas_registros (Evaluaciones para Plantas)
-- =====================================================================
CREATE TABLE IF NOT EXISTS evaluaciones_plantas_registros (
  id TEXT PRIMARY KEY,
  concatenar TEXT,
  ciudad TEXT NOT NULL DEFAULT '',
  estacion TEXT NOT NULL,
  mes TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2026,
  punto TEXT NOT NULL,
  calificacion TEXT NOT NULL DEFAULT '',
  rubro_id INTEGER,
  evidencias JSONB DEFAULT '[]'::jsonb,
  observaciones TEXT,
  inspector_submitted_at TIMESTAMPTZ,
  inspector_user TEXT,
  user_final_evidencias JSONB DEFAULT '[]'::jsonb,
  user_final_observaciones TEXT,
  user_final_submitted_at TIMESTAMPTZ,
  user_final_user TEXT,
  timer_elapsed_seconds INTEGER DEFAULT 0,
  timer_frozen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS concatenar TEXT;
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS ciudad TEXT NOT NULL DEFAULT '';
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS rubro_id INTEGER;
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS evidencias JSONB DEFAULT '[]'::jsonb;
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS inspector_submitted_at TIMESTAMPTZ;
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS inspector_user TEXT;
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS user_final_evidencias JSONB DEFAULT '[]'::jsonb;
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS user_final_observaciones TEXT;
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS user_final_submitted_at TIMESTAMPTZ;
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS user_final_user TEXT;
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS timer_elapsed_seconds INTEGER DEFAULT 0;
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS timer_frozen BOOLEAN DEFAULT FALSE;
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE evaluaciones_plantas_registros ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE evaluaciones_plantas_registros ALTER COLUMN calificacion SET DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_evaluaciones_plantas_estacion ON evaluaciones_plantas_registros(estacion);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_plantas_mes ON evaluaciones_plantas_registros(mes);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_plantas_anio ON evaluaciones_plantas_registros(anio);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_plantas_rubro ON evaluaciones_plantas_registros(rubro_id);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_plantas_concatenar ON evaluaciones_plantas_registros(concatenar);

ALTER TABLE evaluaciones_plantas_registros DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select evaluaciones_plantas anon" ON evaluaciones_plantas_registros;
DROP POLICY IF EXISTS "Permitir insert evaluaciones_plantas anon" ON evaluaciones_plantas_registros;
DROP POLICY IF EXISTS "Permitir update evaluaciones_plantas anon" ON evaluaciones_plantas_registros;
DROP POLICY IF EXISTS "Permitir delete evaluaciones_plantas anon" ON evaluaciones_plantas_registros;
CREATE POLICY "Permitir select evaluaciones_plantas anon" ON evaluaciones_plantas_registros FOR SELECT USING (true);
CREATE POLICY "Permitir insert evaluaciones_plantas anon" ON evaluaciones_plantas_registros FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update evaluaciones_plantas anon" ON evaluaciones_plantas_registros FOR UPDATE USING (true);
CREATE POLICY "Permitir delete evaluaciones_plantas anon" ON evaluaciones_plantas_registros FOR DELETE USING (true);

-- =====================================================================
-- 6. TABLA: usuarios (Con estados asignados, avatar y bitácora de acceso)
-- =====================================================================
CREATE TABLE IF NOT EXISTS usuarios (
  username TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Coordinador',
  job_title TEXT,
  state TEXT,
  assigned_states TEXT[] DEFAULT ARRAY['Sinaloa']::TEXT[],
  password TEXT NOT NULL DEFAULT 'Chevropar#1970',
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'Activo',
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar columnas nuevas si no existen (conservando los usuarios actuales)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS assigned_states TEXT[] DEFAULT ARRAY['Sinaloa']::TEXT[];
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Activo';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select usuarios anon" ON usuarios;
DROP POLICY IF EXISTS "Permitir insert usuarios anon" ON usuarios;
DROP POLICY IF EXISTS "Permitir update usuarios anon" ON usuarios;
DROP POLICY IF EXISTS "Permitir delete usuarios anon" ON usuarios;
CREATE POLICY "Permitir select usuarios anon" ON usuarios FOR SELECT USING (true);
CREATE POLICY "Permitir insert usuarios anon" ON usuarios FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update usuarios anon" ON usuarios FOR UPDATE USING (true);
CREATE POLICY "Permitir delete usuarios anon" ON usuarios FOR DELETE USING (true);

-- =====================================================================
-- 7. TABLA: anexos_mensuales (Archivos PDF, Excel, Word para Consulta)
-- =====================================================================
CREATE TABLE IF NOT EXISTS anexos_mensuales (
  id TEXT PRIMARY KEY,
  mes TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2026,
  estacion TEXT DEFAULT 'General',
  nombre_archivo TEXT NOT NULL,
  tipo_archivo TEXT NOT NULL,
  tamano_bytes BIGINT NOT NULL DEFAULT 0,
  contenido_url TEXT NOT NULL,
  descripcion TEXT,
  subido_por TEXT NOT NULL,
  subido_por_rol TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anexos_mes ON anexos_mensuales(mes);
CREATE INDEX IF NOT EXISTS idx_anexos_anio ON anexos_mensuales(anio);
CREATE INDEX IF NOT EXISTS idx_anexos_estacion ON anexos_mensuales(estacion);

ALTER TABLE anexos_mensuales DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir select anexos_mensuales anon" ON anexos_mensuales;
DROP POLICY IF EXISTS "Permitir insert anexos_mensuales anon" ON anexos_mensuales;
DROP POLICY IF EXISTS "Permitir update anexos_mensuales anon" ON anexos_mensuales;
DROP POLICY IF EXISTS "Permitir delete anexos_mensuales anon" ON anexos_mensuales;
CREATE POLICY "Permitir select anexos_mensuales anon" ON anexos_mensuales FOR SELECT USING (true);
CREATE POLICY "Permitir insert anexos_mensuales anon" ON anexos_mensuales FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update anexos_mensuales anon" ON anexos_mensuales FOR UPDATE USING (true);
CREATE POLICY "Permitir delete anexos_mensuales anon" ON anexos_mensuales FOR DELETE USING (true);

-- =====================================================================
-- 8. INSERTAR USUARIOS BASE SOLO SI NO EXISTEN (ON CONFLICT DO NOTHING)
-- =====================================================================
INSERT INTO usuarios (username, name, email, phone, role, job_title, state, assigned_states, password, status) VALUES
  ('haroldo90', 'Programador Master', 'haroldo90@hotmail.com', '+52 (668) 812-4400', 'Admin', 'Programador Master', 'Nacional', ARRAY['Nacional']::TEXT[], 'Chevropar#1970', 'Activo'),
  ('admin', 'Administrador General', 'gaccs@appdesignsoftware.com', '+52 (668) 812-4400', 'Admin', 'Administrador General de Seguridad', 'Nacional', ARRAY['Nacional']::TEXT[], 'Chevropar#1970', 'Activo'),
  ('coordinador', 'Coordinador de Evaluaciones', 'coordinacion@appdesignsoftware.com', '+52 (668) 815-2233', 'Coordinador', 'Coordinador Técnico Operativo', 'Sinaloa', ARRAY['Sinaloa', 'Sonora', 'Chihuahua']::TEXT[], 'Chevropar#1970', 'Activo'),
  ('usuario_final', 'Usuario Final Consultante', 'consulta@appdesignsoftware.com', '+52 (668) 100-2000', 'Usuario final', 'Consultante de Tableros (Solo Lectura)', 'Chihuahua', ARRAY['Chihuahua', 'Sinaloa']::TEXT[], 'Chevropar#1970', 'Activo'),
  ('admin1', 'Super Admin GACCS', 'admin1@evaluaciones-gaccs.mx', '+52 (668) 999-0001', 'Admin', 'Administrador del Sistema', 'Sinaloa', ARRAY['Nacional']::TEXT[], 'Chevropar#1970', 'Activo')
ON CONFLICT (username) DO NOTHING;

-- =====================================================================
-- 9. VERIFICACIÓN FINAL DE REGISTROS CONSERVADOS
-- =====================================================================
SELECT 'evaluaciones_registros' AS tabla, count(*) AS total_registros FROM evaluaciones_registros
UNION ALL
SELECT 'estaciones_maestro' AS tabla, count(*) AS total_registros FROM estaciones_maestro
UNION ALL
SELECT 'plantas_maestro' AS tabla, count(*) AS total_registros FROM plantas_maestro
UNION ALL
SELECT 'evaluaciones_plantas_registros' AS tabla, count(*) AS total_registros FROM evaluaciones_plantas_registros
UNION ALL
SELECT 'usuarios' AS tabla, count(*) AS total_registros FROM usuarios
UNION ALL
SELECT 'anexos_mensuales' AS tabla, count(*) AS total_registros FROM anexos_mensuales;
`;
}
