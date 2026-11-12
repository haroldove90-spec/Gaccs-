import { INITIAL_STATION_MASTERS, INITIAL_USERS } from '../data/initialData';

/**
 * Generates the complete, production-ready SQL script to create all tables,
 * disable RLS or set permissive policies for anon, and insert initial sample records in Supabase.
 */
export function generateSupabaseSqlScript(): string {
  return `-- =====================================================================
-- SISTEMA DE EVALUACIONES GACCS - SCRIPT DE INICIALIZACIÓN SUPABASE
-- Proyecto: gaccs@appdesignsoftware.com's Project
-- Project ID: yybannuorhqsykqagkwz
-- URL: https://yybannuorhqsykqagkwz.supabase.co
-- Generado automáticamente para ejecutar en: Supabase SQL Editor
-- =====================================================================

-- 1. EXTENSIÓN PARA UUID (OPCIONAL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 2. TABLA PRINCIPAL: evaluaciones_registros
-- =====================================================================
DROP TABLE IF EXISTS evaluaciones_registros CASCADE;

CREATE TABLE evaluaciones_registros (
  id TEXT PRIMARY KEY,
  concatenar TEXT,
  ciudad TEXT NOT NULL DEFAULT '',
  estacion TEXT NOT NULL,
  mes TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2026,
  punto TEXT NOT NULL,
  calificacion TEXT NOT NULL DEFAULT '0',
  rubro_id INTEGER,
  evidencias JSONB DEFAULT '[]'::jsonb,
  observaciones TEXT,
  inspector_submitted_at TIMESTAMPTZ,
  inspector_user TEXT,
  user_final_evidencias JSONB DEFAULT '[]'::jsonb,
  user_final_observaciones TEXT,
  user_final_submitted_at TIMESTAMPTZ,
  user_final_user TEXT,
  timer_elapsed_seconds INTEGER,
  timer_frozen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda ultrarrápida
CREATE INDEX idx_evaluaciones_estacion ON evaluaciones_registros(estacion);
CREATE INDEX idx_evaluaciones_mes ON evaluaciones_registros(mes);
CREATE INDEX idx_evaluaciones_anio ON evaluaciones_registros(anio);
CREATE INDEX idx_evaluaciones_rubro ON evaluaciones_registros(rubro_id);

-- Deshabilitar RLS para permitir operaciones directas con anon key
ALTER TABLE evaluaciones_registros DISABLE ROW LEVEL SECURITY;

-- Políticas de seguridad permisivas en caso de que RLS se active manualmente:
CREATE POLICY "Permitir select anon" ON evaluaciones_registros FOR SELECT USING (true);
CREATE POLICY "Permitir insert anon" ON evaluaciones_registros FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update anon" ON evaluaciones_registros FOR UPDATE USING (true);
CREATE POLICY "Permitir delete anon" ON evaluaciones_registros FOR DELETE USING (true);

-- =====================================================================
-- 3. TABLA: estaciones_maestro
-- =====================================================================
DROP TABLE IF EXISTS estaciones_maestro CASCADE;

CREATE TABLE estaciones_maestro (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL,
  ciudad TEXT NOT NULL,
  calificacion NUMERIC NOT NULL DEFAULT 0,
  estatus TEXT NOT NULL DEFAULT 'Cumple',
  evaluaciones_cerradas INTEGER DEFAULT 9,
  ultimo_periodo TEXT DEFAULT 'Septiembre 2026',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE estaciones_maestro DISABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir select estaciones_maestro anon" ON estaciones_maestro FOR SELECT USING (true);
CREATE POLICY "Permitir insert estaciones_maestro anon" ON estaciones_maestro FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update estaciones_maestro anon" ON estaciones_maestro FOR UPDATE USING (true);
CREATE POLICY "Permitir delete estaciones_maestro anon" ON estaciones_maestro FOR DELETE USING (true);

-- =====================================================================
-- 4. TABLA: plantas_maestro (Módulo Plantas)
-- =====================================================================
DROP TABLE IF EXISTS plantas_maestro CASCADE;

CREATE TABLE plantas_maestro (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL,
  ciudad TEXT NOT NULL,
  calificacion NUMERIC NOT NULL DEFAULT 0,
  estatus TEXT NOT NULL DEFAULT 'Cumple',
  evaluaciones_cerradas INTEGER DEFAULT 9,
  ultimo_periodo TEXT DEFAULT 'Septiembre 2026',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plantas_maestro DISABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir select plantas_maestro anon" ON plantas_maestro FOR SELECT USING (true);
CREATE POLICY "Permitir insert plantas_maestro anon" ON plantas_maestro FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update plantas_maestro anon" ON plantas_maestro FOR UPDATE USING (true);
CREATE POLICY "Permitir delete plantas_maestro anon" ON plantas_maestro FOR DELETE USING (true);

-- =====================================================================
-- 5. TABLA: evaluaciones_plantas_registros (Evaluaciones para Plantas)
-- =====================================================================
DROP TABLE IF EXISTS evaluaciones_plantas_registros CASCADE;

CREATE TABLE evaluaciones_plantas_registros (
  id TEXT PRIMARY KEY,
  concatenar TEXT,
  ciudad TEXT NOT NULL DEFAULT '',
  estacion TEXT NOT NULL,
  mes TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2026,
  punto TEXT NOT NULL,
  calificacion TEXT NOT NULL DEFAULT '0',
  rubro_id INTEGER,
  evidencias JSONB DEFAULT '[]'::jsonb,
  observaciones TEXT,
  inspector_submitted_at TIMESTAMPTZ,
  inspector_user TEXT,
  user_final_evidencias JSONB DEFAULT '[]'::jsonb,
  user_final_observaciones TEXT,
  user_final_submitted_at TIMESTAMPTZ,
  user_final_user TEXT,
  timer_elapsed_seconds INTEGER,
  timer_frozen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evaluaciones_plantas_estacion ON evaluaciones_plantas_registros(estacion);
CREATE INDEX idx_evaluaciones_plantas_mes ON evaluaciones_plantas_registros(mes);
CREATE INDEX idx_evaluaciones_plantas_anio ON evaluaciones_plantas_registros(anio);
CREATE INDEX idx_evaluaciones_plantas_rubro ON evaluaciones_plantas_registros(rubro_id);

ALTER TABLE evaluaciones_plantas_registros DISABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir select evaluaciones_plantas anon" ON evaluaciones_plantas_registros FOR SELECT USING (true);
CREATE POLICY "Permitir insert evaluaciones_plantas anon" ON evaluaciones_plantas_registros FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update evaluaciones_plantas anon" ON evaluaciones_plantas_registros FOR UPDATE USING (true);
CREATE POLICY "Permitir delete evaluaciones_plantas anon" ON evaluaciones_plantas_registros FOR DELETE USING (true);

-- =====================================================================
-- 6. TABLA: usuarios (Con asignación de estados para permisos)
-- =====================================================================
DROP TABLE IF EXISTS usuarios CASCADE;

CREATE TABLE usuarios (
  username TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Coordinador',
  job_title TEXT,
  state TEXT,
  assigned_states TEXT[] DEFAULT ARRAY['Sinaloa']::TEXT[],
  password TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'Activo',
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- Políticas en caso de que RLS esté activo
CREATE POLICY "Permitir select usuarios anon" ON usuarios FOR SELECT USING (true);
CREATE POLICY "Permitir insert usuarios anon" ON usuarios FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update usuarios anon" ON usuarios FOR UPDATE USING (true);
CREATE POLICY "Permitir delete usuarios anon" ON usuarios FOR DELETE USING (true);

-- =====================================================================
-- 7. TABLA: anexos_mensuales (Archivos PDF, Excel, Word para Consulta)
-- =====================================================================
DROP TABLE IF EXISTS anexos_mensuales CASCADE;

CREATE TABLE anexos_mensuales (
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

CREATE INDEX idx_anexos_mes ON anexos_mensuales(mes);
CREATE INDEX idx_anexos_anio ON anexos_mensuales(anio);
CREATE INDEX idx_anexos_estacion ON anexos_mensuales(estacion);

ALTER TABLE anexos_mensuales DISABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir select anexos_mensuales anon" ON anexos_mensuales FOR SELECT USING (true);
CREATE POLICY "Permitir insert anexos_mensuales anon" ON anexos_mensuales FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update anexos_mensuales anon" ON anexos_mensuales FOR UPDATE USING (true);
CREATE POLICY "Permitir delete anexos_mensuales anon" ON anexos_mensuales FOR DELETE USING (true);

-- =====================================================================
-- 8. REGISTROS DE MUESTRA: estaciones_maestro
-- =====================================================================
INSERT INTO estaciones_maestro (codigo, nombre, estado, ciudad, calificacion, estatus, evaluaciones_cerradas, ultimo_periodo) VALUES
  ('GAS-017', 'Chihuahua - Ciudad Juárez', 'Chihuahua', 'Ciudad Juárez', 89, 'Cumple', 9, 'Septiembre 2026'),
  ('GAS-022', 'Chihuahua - Centro', 'Chihuahua', 'Chihuahua', 84, 'Observación', 8, 'Septiembre 2026'),
  ('GAS-023', 'Estación Juárez Aeropuerto', 'Chihuahua', 'Ciudad Juárez', 88, 'Cumple', 9, 'Septiembre 2026'),
  ('GAS-001', 'Mochis - Topolobampo', 'Sinaloa', 'Los Mochis', 88, 'Cumple', 9, 'Septiembre 2026'),
  ('GAS-002', 'Mochis - 9DeDiciembre', 'Sinaloa', 'Los Mochis', 85, 'Cumple', 9, 'Septiembre 2026'),
  ('GAS-003', 'Mochis - Valledelrey', 'Sinaloa', 'Los Mochis', 78, 'Crítico', 7, 'Septiembre 2026'),
  ('GAS-004', 'Mochis - Higuerapalma', 'Sinaloa', 'Los Mochis', 82, 'Observación', 8, 'Septiembre 2026'),
  ('GAS-005', 'Mochis - Higueramilpa', 'Sinaloa', 'Los Mochis', 81, 'Observación', 8, 'Septiembre 2026'),
  ('GAS-006', 'Mochis - Bienestar', 'Sinaloa', 'Los Mochis', 92, 'Cumple', 9, 'Septiembre 2026'),
  ('GAS-014', 'Estación del Norte', 'Nuevo León', 'Monterrey', 91, 'Cumple', 9, 'Agosto 2026'),
  ('GAS-028', 'Estación Zapopan', 'Jalisco', 'Guadalajara / Zapopan', 84, 'Observación', 8, 'Agosto 2026'),
  ('GAS-041', 'Estación Silao', 'Guanajuato', 'Silao', 76, 'Crítico', 6, 'Agosto 2026'),
  ('GAS-053', 'Estación Puebla Centro', 'Puebla', 'Puebla de Zaragoza', 89, 'Cumple', 9, 'Agosto 2026')
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================================
-- 8. REGISTROS DE MUESTRA: plantas_maestro
-- =====================================================================
INSERT INTO plantas_maestro (codigo, nombre, estado, ciudad, calificacion, estatus, evaluaciones_cerradas, ultimo_periodo) VALUES
  ('PLT-001', 'Planta Almacenamiento Topolobampo', 'Sinaloa', 'Topolobampo', 92, 'Cumple', 9, 'Septiembre 2026'),
  ('PLT-002', 'Planta Distribución Juárez Norte', 'Chihuahua', 'Ciudad Juárez', 89, 'Cumple', 9, 'Septiembre 2026'),
  ('PLT-003', 'Planta Terminal Monterrey Huinalá', 'Nuevo León', 'Apodaca / Monterrey', 94, 'Cumple', 9, 'Septiembre 2026'),
  ('PLT-004', 'Planta Guadalajara El Salto', 'Jalisco', 'El Salto / Guadalajara', 83, 'Observación', 8, 'Septiembre 2026'),
  ('PLT-005', 'Planta Hermosillo Poniente', 'Sonora', 'Hermosillo', 88, 'Cumple', 9, 'Septiembre 2026'),
  ('PLT-006', 'Planta Culiacán Humaya', 'Sinaloa', 'Culiacán', 91, 'Cumple', 9, 'Septiembre 2026'),
  ('PLT-007', 'Planta Torreón Laguna', 'Coahuila', 'Torreón', 81, 'Observación', 8, 'Agosto 2026'),
  ('PLT-008', 'Planta Querétaro Bernardo Quintana', 'Querétaro', 'Querétaro', 87, 'Cumple', 9, 'Agosto 2026'),
  ('PLT-009', 'Planta Puebla Tehuacán', 'Puebla', 'Puebla', 86, 'Cumple', 8, 'Agosto 2026'),
  ('PLT-010', 'Planta Toluca Lerma Industrial', 'México', 'Toluca / Lerma', 78, 'Crítico', 7, 'Agosto 2026'),
  ('PLT-011', 'Planta Veracruz San Juan', 'Veracruz', 'Veracruz', 89, 'Cumple', 9, 'Agosto 2026'),
  ('PLT-012', 'Planta Guanajuato Silao', 'Guanajuato', 'Silao', 79, 'Crítico', 7, 'Agosto 2026')
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================================
-- 9. REGISTROS DE MUESTRA: usuarios (Incluye Programador Master)
-- =====================================================================
INSERT INTO usuarios (username, name, email, phone, role, job_title, state, assigned_states, password, status) VALUES
  ('haroldo90', 'Programador Master', 'haroldo90@hotmail.com', '+52 (668) 812-4400', 'Admin', 'Programador Master', 'Nacional', ARRAY['Nacional']::TEXT[], 'Chevropar#1970', 'Activo'),
  ('admin', 'Administrador General', 'gaccs@appdesignsoftware.com', '+52 (668) 812-4400', 'Admin', 'Administrador General de Seguridad', 'Nacional', ARRAY['Nacional']::TEXT[], 'Chevropar#1970', 'Activo'),
  ('coordinador', 'Coordinador de Evaluaciones', 'coordinacion@appdesignsoftware.com', '+52 (668) 815-2233', 'Coordinador', 'Coordinador Técnico Operativo', 'Sinaloa', ARRAY['Sinaloa', 'Sonora', 'Chihuahua']::TEXT[], 'Chevropar#1970', 'Activo'),
  ('usuario_final', 'Usuario Final Consultante', 'consulta@appdesignsoftware.com', '+52 (668) 100-2000', 'Usuario final', 'Consultante de Tableros (Solo Lectura)', 'Chihuahua', ARRAY['Chihuahua', 'Sinaloa']::TEXT[], 'Chevropar#1970', 'Activo'),
  ('admin1', 'Super Admin GACCS', 'admin1@evaluaciones-gaccs.mx', '+52 (668) 999-0001', 'Admin', 'Administrador del Sistema', 'Sinaloa', ARRAY['Nacional']::TEXT[], 'Chevropar#1970', 'Activo')
ON CONFLICT (username) DO NOTHING;

-- =====================================================================
-- 10. REGISTROS DE MUESTRA: evaluaciones_registros (Estaciones)
-- =====================================================================
INSERT INTO evaluaciones_registros (id, concatenar, ciudad, estacion, mes, anio, punto, calificacion, rubro_id, observaciones) VALUES
  -- CHIHUAHUA - CIUDAD JUÁREZ
  ('rec-chih-01', 'Chihuahua - Ciudad JuárezSEPTIEMBREComponentes internos de gabinetes electricos se encuentran identificados', 'Chihuahua - Ciudad Juárez', 'Chihuahua - Ciudad Juárez', 'SEPTIEMBRE', 2026, 'Componentes internos de gabinetes electricos se encuentran identificados', '3', 1, 'Gabinetes con rotulado normativo y peinado de cables verificado conforme a NOM-001.'),
  ('rec-chih-02', 'Chihuahua - Ciudad JuárezSEPTIEMBRETubería luquatite de la estación en condiciones', 'Chihuahua - Ciudad Juárez', 'Chihuahua - Ciudad Juárez', 'SEPTIEMBRE', 2026, 'Tubería luquatite de la estación en condiciones', '3', 1, 'Tubería flexible sin fracturas ni corrosión visible.'),
  ('rec-chih-03', 'Chihuahua - Ciudad JuárezSEPTIEMBRETierras físicas en buen estado en anden de carga, motor, tanque de almacenamiento', 'Chihuahua - Ciudad Juárez', 'Chihuahua - Ciudad Juárez', 'SEPTIEMBRE', 2026, 'Tierras físicas en buen estado en anden de carga, motor, tanque de almacenamiento', '3', 1, 'Medición de resistencia a tierra 2.8 Ohms dentro de norma NOM-001.'),
  ('rec-chih-04', 'Chihuahua - Ciudad JuárezSEPTIEMBRETubería eléctrica en condiciones, con sellos, condulets y pintada', 'Chihuahua - Ciudad Juárez', 'Chihuahua - Ciudad Juárez', 'SEPTIEMBRE', 2026, 'Tubería eléctrica en condiciones, con sellos, condulets y pintada', '3', 1, 'Sellos a prueba de explosión debidamente sellados con compuesto chicote.'),
  ('rec-chih-05', 'Chihuahua - Ciudad JuárezSEPTIEMBRECables dentro de los gabinetes eléctricos en orden (peinados)', 'Chihuahua - Ciudad Juárez', 'Chihuahua - Ciudad Juárez', 'SEPTIEMBRE', 2026, 'Cables dentro de los gabinetes eléctricos en orden (peinados)', '3', 1, 'Cableado ordenado con cinchos de sujeción termoplásticos.'),
  ('rec-chih-06', 'Chihuahua - Ciudad JuárezSEPTIEMBREParo de emergencia de la isleta es de acuerdo a áreas clasificadas (a prueba de explosión)', 'Chihuahua - Ciudad Juárez', 'Chihuahua - Ciudad Juárez', 'SEPTIEMBRE', 2026, 'Paro de emergencia de la isleta es de acuerdo a áreas clasificadas (a prueba de explosión)', '5', 2, 'Botonera clase 1 división 1 con sello de certificación.'),
  ('rec-chih-07', 'Chihuahua - Ciudad JuárezSEPTIEMBREEstación cuenta con paro de emergencia en oficina', 'Chihuahua - Ciudad Juárez', 'Chihuahua - Ciudad Juárez', 'SEPTIEMBRE', 2026, 'Estación cuenta con paro de emergencia en oficina', '5', 2, 'Ubicado a 1.40 m del nivel de piso terminado con señalización visible.'),
  ('rec-chih-08', 'Chihuahua - Ciudad JuárezSEPTIEMBREAl accionar los paros de emergencia se activa la alarma sonora', 'Chihuahua - Ciudad Juárez', 'Chihuahua - Ciudad Juárez', 'SEPTIEMBRE', 2026, 'Al accionar los paros de emergencia se activa la alarma sonora', '5', 2, 'Alarma de 105 dB audible en toda el área de despacho.'),
  ('rec-chih-09', 'Chihuahua - Ciudad JuárezSEPTIEMBRESe cuenta con extintor de CO2 de cuando menos 4.5 kg de capacidad en cada tablero eléctrico', 'Chihuahua - Ciudad Juárez', 'Chihuahua - Ciudad Juárez', 'SEPTIEMBRE', 2026, 'Se cuenta con extintor de CO2 de cuando menos 4.5 kg de capacidad en cada tablero eléctrico', '3', 3, 'Extintor CO2 5kg vigente con collarín de verificación 2026.'),
  ('rec-chih-10', 'Chihuahua - Ciudad JuárezSEPTIEMBRETodos los extintores deben colocarse a una altura máxima de 1.5 m y mínima de 1.3 m', 'Chihuahua - Ciudad Juárez', 'Chihuahua - Ciudad Juárez', 'SEPTIEMBRE', 2026, 'Todos los extintores deben colocarse a una altura máxima de 1.5 m y mínima de 1.3 m', '2', 3, 'Altura a 1.35 m, fijación segura.'),
  ('rec-chih-11', 'Chihuahua - Ciudad JuárezSEPTIEMBRERotulación de tanque de almacenamiento cumple con la NOM-018-STPS-2015', 'Chihuahua - Ciudad Juárez', 'Chihuahua - Ciudad Juárez', 'SEPTIEMBRE', 2026, 'Rotulación de tanque de almacenamiento cumple con la NOM-018-STPS-2015', '2', 4, 'Rombo SGA con pictogramas legibles a distancia.'),
  ('rec-chih-12', 'Chihuahua - Ciudad JuárezSEPTIEMBREEl recipiente (almacen) debe ser identificable mediante placa de identificación legible.', 'Chihuahua - Ciudad Juárez', 'Chihuahua - Ciudad Juárez', 'SEPTIEMBRE', 2026, 'El recipiente (almacen) debe ser identificable mediante placa de identificación legible.', '4', 5, 'Placa de acero inoxidable con datos de presión de diseño.'),

  -- MOCHIS - TOPOLOBAMPO
  ('rec-mochis-01', 'Mochis - TopolobampSEPTIEMBREComponentes internos de gabinetes electricos se encuentran identificados', 'Sinaloa - Mochis', 'Mochis - Topolobampo', 'SEPTIEMBRE', 2026, 'Componentes internos de gabinetes electricos se encuentran identificados', '3', 1, 'Revisión técnica periódica efectuada satisfactoriamente.'),
  ('rec-mochis-02', 'Mochis - TopolobampSEPTIEMBRETubería luquatite de la estación en condiciones', 'Sinaloa - Mochis', 'Mochis - Topolobampo', 'SEPTIEMBRE', 2026, 'Tubería luquatite de la estación en condiciones', '3', 1, 'Sujeción y sellos sin novedad.'),
  ('rec-mochis-03', 'Mochis - TopolobampSEPTIEMBRETierras físicas en buen estado en anden de carga, motor, tanque de almacenamiento', 'Sinaloa - Mochis', 'Mochis - Topolobampo', 'SEPTIEMBRE', 2026, 'Tierras físicas en buen estado en anden de carga, motor, tanque de almacenamiento', '2', 1, 'Lectura de 3.2 Ohms en varilla Copperweld.'),
  ('rec-mochis-04', 'Mochis - TopolobampSEPTIEMBREParo de emergencia de la isleta es de acuerdo a áreas clasificadas (a prueba de explosión)', 'Sinaloa - Mochis', 'Mochis - Topolobampo', 'SEPTIEMBRE', 2026, 'Paro de emergencia de la isleta es de acuerdo a áreas clasificadas (a prueba de explosión)', '5', 2, 'Prueba de disparo exitosa con interrupción eléctrica total.'),
  ('rec-mochis-05', 'Mochis - TopolobampSEPTIEMBRESe cuenta con extintor de CO2 de cuando menos 4.5 kg de capacidad en cada tablero eléctrico', 'Sinaloa - Mochis', 'Mochis - Topolobampo', 'SEPTIEMBRE', 2026, 'Se cuenta con extintor de CO2 de cuando menos 4.5 kg de capacidad en cada tablero eléctrico', '3', 3, 'Extintor CO2 con mantenimiento vigente hasta diciembre 2026.')
ON CONFLICT (id) DO UPDATE SET
  calificacion = EXCLUDED.calificacion,
  observaciones = EXCLUDED.observaciones,
  updated_at = NOW();

-- =====================================================================
-- 11. REGISTROS DE MUESTRA: evaluaciones_plantas_registros (Plantas)
-- =====================================================================
INSERT INTO evaluaciones_plantas_registros (id, concatenar, ciudad, estacion, mes, anio, punto, calificacion, rubro_id, observaciones) VALUES
  ('plt-rec-01', 'Planta Almacenamiento TopolobampoSEPTIEMBREComponentes internos de gabinetes electricos se encuentran identificados', 'Sinaloa - Topolobampo', 'Planta Almacenamiento Topolobampo', 'SEPTIEMBRE', 2026, 'Componentes internos de gabinetes electricos se encuentran identificados', '3', 1, 'Gabinetes industriales de alta capacidad debidamente rotulados y peinados según NOM-001.'),
  ('plt-rec-02', 'Planta Almacenamiento TopolobampoSEPTIEMBRETubería luquatite de la estación en condiciones', 'Sinaloa - Topolobampo', 'Planta Almacenamiento Topolobampo', 'SEPTIEMBRE', 2026, 'Tubería luquatite de la estación en condiciones', '3', 1, 'Tubería hermética sin fisuras en área de compresión.'),
  ('plt-rec-03', 'Planta Almacenamiento TopolobampoSEPTIEMBRETierras físicas en buen estado en anden de carga, motor, tanque de almacenamiento', 'Sinaloa - Topolobampo', 'Planta Almacenamiento Topolobampo', 'SEPTIEMBRE', 2026, 'Tierras físicas en buen estado en anden de carga, motor, tanque de almacenamiento', '3', 1, 'Malla perimetral de tierras físicas en 1.8 Ohms probada con telurómetro.'),
  ('plt-rec-04', 'Planta Almacenamiento TopolobampoSEPTIEMBREParo de emergencia de la isleta es de acuerdo a áreas clasificadas (a prueba de explosión)', 'Sinaloa - Topolobampo', 'Planta Almacenamiento Topolobampo', 'SEPTIEMBRE', 2026, 'Paro de emergencia de la isleta es de acuerdo a áreas clasificadas (a prueba de explosión)', '5', 2, 'Sistema ESD (Emergency Shutdown) con actuadores neumáticos en tanques esferas y patines de carga.'),
  ('plt-rec-05', 'Planta Almacenamiento TopolobampoSEPTIEMBRESe cuenta con extintor de CO2 de cuando menos 4.5 kg de capacidad en cada tablero eléctrico', 'Sinaloa - Topolobampo', 'Planta Almacenamiento Topolobampo', 'SEPTIEMBRE', 2026, 'Se cuenta con extintor de CO2 de cuando menos 4.5 kg de capacidad en cada tablero eléctrico', '3', 3, 'Red de hidrantes y monitores de espuma complementan extintores CO2.'),
  ('plt-rec-06', 'Planta Distribución Juárez NorteSEPTIEMBREComponentes internos de gabinetes electricos se encuentran identificados', 'Chihuahua - Ciudad Juárez', 'Planta Distribución Juárez Norte', 'SEPTIEMBRE', 2026, 'Componentes internos de gabinetes electricos se encuentran identificados', '3', 1, 'Subestación eléctrica y centros de control de motores con diagramas unifilares actualizados.'),
  ('plt-rec-07', 'Planta Distribución Juárez NorteSEPTIEMBREParo de emergencia de la isleta es de acuerdo a áreas clasificadas (a prueba de explosión)', 'Chihuahua - Ciudad Juárez', 'Planta Distribución Juárez Norte', 'SEPTIEMBRE', 2026, 'Paro de emergencia de la isleta es de acuerdo a áreas clasificadas (a prueba de explosión)', '5', 2, 'Botoneras de corte general en rack de llenado verificadas semanalmente.')
ON CONFLICT (id) DO UPDATE SET
  calificacion = EXCLUDED.calificacion,
  observaciones = EXCLUDED.observaciones,
  updated_at = NOW();

-- =====================================================================
-- 12. REGISTROS DE MUESTRA: anexos_mensuales (Archivos de Consulta)
-- =====================================================================
INSERT INTO anexos_mensuales (id, mes, anio, estacion, nombre_archivo, tipo_archivo, tamano_bytes, contenido_url, descripcion, subido_por, subido_por_rol) VALUES
  ('anx-sep-01', 'SEPTIEMBRE', 2026, 'General', 'Procedimiento_Auditorias_Seguridad_Sep2026.pdf', 'pdf', 245760, 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCjEgMCBvYmoKPDwKL1RpdGxlIChBbmV4byAtIFByb2NlZGltaWVudG8gZGUgQXVkaXRvcmlhKQovQXV0aG9yIChBZG1pbmlzdHJhZG9yIEdBQ0NTKQovQ3JlYXRvciAoR0FDQ1MgU2lzdGVtYSkKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDMgMCBSCj4+CmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovS2lkcyBbNCAwIFJdCi9Db3VudCAxCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMyAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDUgMCBSCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggMTg1Cj4+CnN0cmVhbQpCVAovRjEgMjQgVGYKNTAgNzAwIFRECihBbmV4byBNZW5zdWFsOiBTZXB0aWVtYnJlIDIwMjYpIFRqCjAgLTMwIFRECi9GMSAxMiBUZgooRG9jdW1lbnRvIG9maWNpYWwgZGUgYXVkaXRvcmlhIHkgY29uc3VsdGEgcGFyYSBjb29yZGluYWRvcmVzIHkgdXN1YXJpb3MuKSBUagowIC0yMCBURgooR0FDQ1MgLSBHZXJlbmNpYSBkZSBTZWd1cmlkYWQgeSBOb3JtYXRpdmlkYWQpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAxMTYgMDAwMDAgbiAKMDAwMDAwMDE2NiAwMDAwMCBuIAowMDAwMDAwMjI3IDAwMDAwIG4gCjAwMDAwMDAzMTggMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDIgMCBSCj4+CnN0YXJ0eHJlZgo1NTUKJSVFT0YK', 'Manual oficial de procedimientos normativos de auditoría para estaciones de servicio - Periodo Septiembre 2026.', 'Administrador General', 'Admin'),
  ('anx-sep-02', 'SEPTIEMBRE', 2026, 'General', 'Matriz_Ponderaciones_Control_Calidad_Sep2026.xlsx', 'excel', 524288, 'data:application/vnd.ms-excel;charset=utf-8,Estacion%09Mes%09Norma%09Puntos%09Estatus%0AMochis%20-%20Topolobampo%09Septiembre%202026%09NOM-001%0920%09Cumple%0AChihuahua%20-%20Cd%20Juarez%09Septiembre%202026%09NOM-003%0932%09Cumple', 'Plantilla de control de calidad, fórmulas de regla de tres y ponderación de 106 puntos para estaciones.', 'Administrador General', 'Admin'),
  ('anx-sep-03', 'SEPTIEMBRE', 2026, 'General', 'Oficio_Cumplimiento_Normativo_CRE_ASEA_Sep2026.docx', 'word', 131072, 'data:application/msword;charset=utf-8,Oficio%20de%20Cumplimiento%20Normativo%20-%20Septiembre%202026%0D%0AGerencia%20de%20Seguridad%20Industrial%20GACCS', 'Oficio de constancia y respaldo técnico normativo emitido para directores y supervisores.', 'Administrador General', 'Admin')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 13. COMPROBACIÓN FINAL (6 TABLAS)
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
