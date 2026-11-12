/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserSession,
  StationEvaluationRecord,
  ImportedFileRecord,
  MainNavSection,
  EvalSubModule,
  UserRole,
} from './types';
import {
  generateInitialDatabaseRecords,
  INITIAL_STATIONS,
  INITIAL_STATION_MASTERS,
  INITIAL_IMPORT_HISTORY,
  INITIAL_USERS,
  INITIAL_PLANTS,
  INITIAL_PLANT_MASTERS,
  generateInitialPlantRecords,
} from './data/initialData';
import { Sidebar } from './components/Sidebar';
import { BottomNavBar } from './components/BottomNavBar';
import { TopHeader } from './components/TopHeader';
import { HomeRoleSelection } from './components/HomeRoleSelection';
import { WelcomeScreenModule } from './components/WelcomeScreenModule';
import { MexicoMapModule } from './components/MexicoMapModule';
import { MetricsDashboard } from './components/MetricsDashboard';
import { StationsModule } from './components/StationsModule';
import { Module1Station } from './components/Module1Station';
import { Module2Database } from './components/Module2Database';
import { Module3Matrix } from './components/Module3Matrix';
import { UsersModule } from './components/UsersModule';
import { SupabaseModule } from './components/SupabaseModule';
import { ProfileModule } from './components/ProfileModule';
import { FileManager } from './components/FileManager';
import { FileImportModal } from './components/FileImportModal';
import { MultiSectionImporterModule } from './components/MultiSectionImporterModule';
import { ZohoModule } from './components/ZohoModule';
import { ZohoAuditRecord } from './types';
import {
  saveRecordToSupabase,
  syncRecordsToSupabase,
  deleteSupabaseRecords,
  saveUserToSupabase,
  fetchUserFromSupabase,
  fetchSupabaseEvaluationRecords,
  fetchSupabasePlantEvaluationRecords,
  savePlantRecordToSupabase,
  syncPlantRecordsToSupabase,
  deleteSupabasePlantRecords,
  deleteAllSupabaseRecords,
  deleteAllSupabasePlantRecords,
  deleteAllTestAnexosFromSupabase,
} from './lib/supabaseClient';
import {
  loadUserSession,
  persistUserSession,
  clearUserSession,
  loadIsAdminAccount,
  saveIsAdminAccount,
  loadNavigationLocation,
  saveNavigationLocation,
  safeStorageGet,
  safeStorageSet,
  safeStorageRemove,
} from './utils/sessionManager';
import { isSameStation, normalizeMonthName, cleanTextForMatch, calculateStationOverall } from './utils/evaluationFormulas';
import { MEXICO_STATES_DEFS } from './data/mexicoMapStateDefs';
import { CheckCircle2, Clock } from 'lucide-react';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import { DuplicateAction } from './components/FileImportModal';
import { recordUserLogin } from './utils/userActivityLogger';

export function detectStateFromRecord(cityOrState: string, stationName: string): string {
  const combined = `${cityOrState || ''} ${stationName || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const stDef of MEXICO_STATES_DEFS) {
    const cleanDef = stDef.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (combined.includes(cleanDef)) {
      return stDef.name;
    }
  }
  // Check known Mexican cities
  if (combined.includes('mochis') || combined.includes('culiacan') || combined.includes('mazatlan') || combined.includes('guamuchil') || combined.includes('guasave') || combined.includes('topolobampo')) return 'Sinaloa';
  if (combined.includes('hermosillo') || combined.includes('obregon') || combined.includes('nogales') || combined.includes('navojoa') || combined.includes('guaymas') || combined.includes('caborca')) return 'Sonora';
  if (combined.includes('monterrey') || combined.includes('guadalupe') || combined.includes('san pedro') || combined.includes('apodaca') || combined.includes('san nicolas')) return 'Nuevo León';
  if (combined.includes('guadalajara') || combined.includes('zapopan') || combined.includes('tlaquepaque') || combined.includes('tonala') || combined.includes('puerto vallarta')) return 'Jalisco';
  if (combined.includes('saltillo') || combined.includes('torreon') || combined.includes('monclova') || combined.includes('piedras negras')) return 'Coahuila';
  if (combined.includes('chihuahua') || combined.includes('juarez') || combined.includes('delicias') || combined.includes('cuauhtemoc')) return 'Chihuahua';
  if (combined.includes('leon') || combined.includes('irapuato') || combined.includes('celaya') || combined.includes('silao') || combined.includes('guanajuato') || combined.includes('salamanca')) return 'Guanajuato';
  if (combined.includes('puebla') || combined.includes('tehuacan') || combined.includes('cholula')) return 'Puebla';
  if (combined.includes('veracruz') || combined.includes('xalapa') || combined.includes('coatzacoalcos') || combined.includes('cordoba') || combined.includes('orizaba') || combined.includes('poza rica')) return 'Veracruz';
  if (combined.includes('tijuana') || combined.includes('mexicali') || combined.includes('ensenada') || combined.includes('tecate')) return 'Baja California';
  if (combined.includes('la paz') || combined.includes('los cabos') || combined.includes('cabo san lucas')) return 'Baja California Sur';
  if (combined.includes('durango') || combined.includes('gomez palacio') || combined.includes('lerdo')) return 'Durango';
  if (combined.includes('zacatecas') || combined.includes('fresnillo') || combined.includes('guadalupe zac')) return 'Zacatecas';
  if (combined.includes('merida') || combined.includes('valladolid')) return 'Yucatán';
  if (combined.includes('cancun') || combined.includes('chetumal') || combined.includes('playa del carmen') || combined.includes('cozumel')) return 'Quintana Roo';
  if (combined.includes('toluca') || combined.includes('ecatepec') || combined.includes('naucalpan') || combined.includes('tlalnepantla') || combined.includes('neza')) return 'México';
  if (combined.includes('cdmx') || combined.includes('ciudad de mexico') || combined.includes('df') || combined.includes('distrito federal')) return 'Ciudad de México';
  if (combined.includes('queretaro') || combined.includes('san juan del rio')) return 'Querétaro';
  if (combined.includes('san luis potosi') || combined.includes('soledad') || combined.includes('valles')) return 'San Luis Potosí';
  if (combined.includes('aguascalientes')) return 'Aguascalientes';
  if (combined.includes('cuernavaca') || combined.includes('jiutepec')) return 'Morelos';
  if (combined.includes('pachuca') || combined.includes('tula')) return 'Hidalgo';
  if (combined.includes('tlaxcala')) return 'Tlaxcala';
  if (combined.includes('villahermosa')) return 'Tabasco';
  if (combined.includes('campeche') || combined.includes('carmen')) return 'Campeche';
  if (combined.includes('tuxtla') || combined.includes('tapachula') || combined.includes('san cristobal')) return 'Chiapas';
  if (combined.includes('oaxaca') || combined.includes('salina cruz')) return 'Oaxaca';
  if (combined.includes('acapulco') || combined.includes('chilpancingo') || combined.includes('zihuatanejo')) return 'Guerrero';
  if (combined.includes('morelia') || combined.includes('urupan') || combined.includes('zamora')) return 'Michoacán';
  if (combined.includes('colima') || combined.includes('manzanillo')) return 'Colima';
  if (combined.includes('tepic')) return 'Nayarit';
  if (combined.includes('reynosa') || combined.includes('matamoros') || combined.includes('nuevo laredo') || combined.includes('tampico') || combined.includes('victoria')) return 'Tamaulipas';
  return 'Sinaloa';
}

export default function App() {
  // Preload preserved navigation state
  const initialNav = loadNavigationLocation();

  // Authentication session (guaranteed persistence across refreshes)
  const [currentUser, setCurrentUser] = useState<UserSession | null>(loadUserSession);

  // Track if current session originated as Admin to grant role navigation superpowers
  const [isAdminAccount, setIsAdminAccount] = useState<boolean>(() =>
    loadIsAdminAccount(currentUser)
  );

  // Active section (starts at 'inicio' / pantalla de bienvenida al entrar al sistema)
  const [currentSection, setCurrentSection] = useState<MainNavSection>(
    initialNav.section === 'distribuidor' ? 'evaluaciones' : (initialNav.section || 'inicio')
  );

  // Sub-module for Evaluaciones (preserved across refreshes)
  const [currentEvalSubModule, setCurrentEvalSubModule] = useState<EvalSubModule>(
    initialNav.evalSubModule
  );

  // Sub-module for Plantas Evaluaciones (preserved across refreshes)
  const [currentPlantEvalSubModule, setCurrentPlantEvalSubModule] = useState<EvalSubModule>(
    initialNav.plantEvalSubModule || 'modulo1'
  );

  // Pre-selected station when jumping from Estaciones to Modulo 1 (preserved across refreshes)
  const [targetStationForModule1, setTargetStationForModule1] = useState<string | null>(
    initialNav.targetStation
  );

  // Pre-selected plant when jumping from Plantas to Modulo 1 (preserved across refreshes)
  const [targetPlantForModule1, setTargetPlantForModule1] = useState<string | null>(
    initialNav.targetPlant
  );

  // Central evaluation records for Estaciones
  const [records, setRecords] = useState<StationEvaluationRecord[]>(() => {
    try {
      const isPurged = localStorage.getItem('evaluaciones_records_purged') === 'true';
      if (isPurged) {
        return [];
      }
      const savedBlacklist = localStorage.getItem('evaluaciones_deleted_record_ids_v1');
      const blacklist = savedBlacklist ? new Set<string>(JSON.parse(savedBlacklist)) : new Set<string>();

      const saved = localStorage.getItem('evaluaciones_records_v1');
      if (saved !== null) {
        const parsed: StationEvaluationRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((r) => !blacklist.has(r.id) && !blacklist.has(r.concatenar));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Central evaluation records for Plantas
  const [plantRecords, setPlantRecords] = useState<StationEvaluationRecord[]>(() => {
    try {
      const isPurged = localStorage.getItem('evaluaciones_plant_records_purged') === 'true';
      if (isPurged) {
        return [];
      }
      const savedBlacklist = localStorage.getItem('evaluaciones_plant_deleted_record_ids_v1');
      const blacklist = savedBlacklist ? new Set<string>(JSON.parse(savedBlacklist)) : new Set<string>();

      const saved = localStorage.getItem('evaluaciones_plant_records_v1');
      if (saved !== null) {
        const parsed: StationEvaluationRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((r) => !blacklist.has(r.id) && !blacklist.has(r.concatenar));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // List of stations
  const [stations, setStations] = useState<string[]>(() => {
    try {
      const isPurged = localStorage.getItem('evaluaciones_records_purged') === 'true';
      if (isPurged) {
        return [];
      }
      const saved = localStorage.getItem('evaluaciones_stations_v1');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // List of plants
  const [plants, setPlants] = useState<string[]>(() => {
    try {
      const isPurged = localStorage.getItem('evaluaciones_plant_records_purged') === 'true';
      if (isPurged) {
        return [];
      }
      const saved = localStorage.getItem('evaluaciones_plants_v1');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Station Masters catalog (sincronizado con Módulo 1: Base de Datos)
  const [stationMasters, setStationMasters] = useState<typeof INITIAL_STATION_MASTERS>(() => {
    try {
      const isPurged = localStorage.getItem('evaluaciones_records_purged') === 'true';
      if (isPurged) return [];
      const saved = localStorage.getItem('evaluaciones_station_masters_v1');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Plant Masters catalog (sincronizado con Módulo 1 de Plantas)
  const [plantMasters, setPlantMasters] = useState<typeof INITIAL_PLANT_MASTERS>(() => {
    try {
      const isPurged = localStorage.getItem('evaluaciones_plant_records_purged') === 'true';
      if (isPurged) return [];
      const saved = localStorage.getItem('evaluaciones_plant_masters_v1');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Import history files
  const [importHistory, setImportHistory] = useState<ImportedFileRecord[]>(() => {
    try {
      const saved = localStorage.getItem('evaluaciones_import_history_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Notification toast
  const [notification, setNotification] = useState<string | null>(null);

  // Global Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('evaluaciones_records_v1', JSON.stringify(records));
    } catch (e) {
      console.error(e);
    }
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem('evaluaciones_plant_records_v1', JSON.stringify(plantRecords));
    } catch (e) {
      console.error(e);
    }
  }, [plantRecords]);

  useEffect(() => {
    try {
      localStorage.setItem('evaluaciones_stations_v1', JSON.stringify(stations));
    } catch (e) {
      console.error(e);
    }
  }, [stations]);

  useEffect(() => {
    try {
      localStorage.setItem('evaluaciones_plants_v1', JSON.stringify(plants));
    } catch (e) {
      console.error(e);
    }
  }, [plants]);

  useEffect(() => {
    try {
      localStorage.setItem('evaluaciones_import_history_v1', JSON.stringify(importHistory));
    } catch (e) {
      console.error(e);
    }
  }, [importHistory]);

  // Keep session synced across storage layers
  useEffect(() => {
    if (currentUser) {
      persistUserSession(currentUser);
      saveIsAdminAccount(isAdminAccount);
    }
  }, [currentUser, isAdminAccount]);

  // Keep navigation location synced so browser refreshes keep the user right where they were
  useEffect(() => {
    if (currentSection === 'distribuidor') {
      setCurrentSection('evaluaciones');
      return;
    }
    saveNavigationLocation(
      currentSection,
      currentEvalSubModule,
      targetStationForModule1,
      currentPlantEvalSubModule,
      targetPlantForModule1
    );
  }, [
    currentSection,
    currentEvalSubModule,
    targetStationForModule1,
    currentPlantEvalSubModule,
    targetPlantForModule1,
  ]);

  // Para Usuario final: acceso completo activado para todos los módulos de estaciones y plantas, y perfil
  useEffect(() => {
    if (currentUser?.role === 'Usuario final') {
      const allowedSections: MainNavSection[] = [
        'inicio',
        'mapa',
        'metricas',
        'estaciones',
        'evaluaciones',
        'plantas_mapa',
        'plantas_metricas',
        'plantas',
        'plantas_evaluaciones',
        'perfil',
      ];
      if (!allowedSections.includes(currentSection)) {
        setCurrentSection('inicio');
      }
    }
  }, [currentUser?.role, currentSection]);

  // Estados asignados al usuario actual para filtrar permisos de visualización
  const userAssignedStates = useMemo<string[] | null>(() => {
    if (currentUser?.role !== 'Usuario final') return null; // Sin restricción para Admin / Coordinador
    const states = currentUser.assignedStates && currentUser.assignedStates.length > 0
      ? currentUser.assignedStates
      : (currentUser.state ? [currentUser.state] : []);
    if (states.some((s: string) => s.toLowerCase() === 'nacional' || s.toLowerCase() === 'todos')) {
      return null;
    }
    return states;
  }, [currentUser]);

  // Datos filtrados según los registros reales del Módulo 1 (Base de Datos) y permisos de usuario
  const visibleStationMasters = useMemo(() => {
    // Si no hay registros en Módulo 1 (Base de Datos), no debe existir ninguna estación fantasma
    if (records.length === 0) {
      return [];
    }

    const activeStationNames = new Set(
      records.map((r) => (r.estacion || '').trim().toLowerCase()).filter(Boolean)
    );

    let list = stationMasters.filter((sm) => activeStationNames.has(sm.nombre.trim().toLowerCase()));

    // Asegurar que toda estación activa en records tenga su ficha en stationMasters con datos reales
    const registeredNames = new Set(list.map((sm) => sm.nombre.trim().toLowerCase()));
    activeStationNames.forEach((cleanNameLower) => {
      if (!registeredNames.has(cleanNameLower)) {
        const sampleRecord = records.find(
          (r) => (r.estacion || '').trim().toLowerCase() === cleanNameLower
        );
        const originalName = sampleRecord?.estacion?.trim() || cleanNameLower;
        const detectedState = detectStateFromRecord(sampleRecord?.ciudad || '', originalName);
        const stRecs = records.filter((r) => isSameStation(r.estacion, originalName));
        const overall = calculateStationOverall(
          originalName,
          stRecs,
          sampleRecord?.mes || 'SEPTIEMBRE',
          sampleRecord?.anio || 2026
        );

        list.push({
          codigo: `ST-${originalName.slice(0, 3).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
          nombre: originalName,
          estado: detectedState,
          ciudad: sampleRecord?.ciudad || `${detectedState} - ${originalName}`,
          calificacion: overall.calificacionFinal,
          estatus: overall.estatus,
          evaluacionesCerradas: 1,
          ultimoPeriodo: `${sampleRecord?.mes || 'Agosto'} ${sampleRecord?.anio || 2026}`,
        });
      }
    });

    if (!userAssignedStates || userAssignedStates.length === 0) return list;
    const lower = userAssignedStates.map((s: string) => s.trim().toLowerCase());
    return list.filter((sm) => lower.includes(sm.estado.trim().toLowerCase()));
  }, [stationMasters, records, userAssignedStates]);

  const visibleStations = useMemo(() => {
    if (records.length === 0) return [];
    const activeNames = Array.from(
      new Set(records.map((r) => (r.estacion || '').trim()))
    ).filter(Boolean);

    if (!userAssignedStates || userAssignedStates.length === 0) return activeNames;
    const lower = userAssignedStates.map((s: string) => s.trim().toLowerCase());
    return activeNames.filter((st) => {
      const master = visibleStationMasters.find((sm) => sm.nombre.toLowerCase() === st.toLowerCase());
      if (master && lower.includes(master.estado.trim().toLowerCase())) return true;
      return lower.some((s: string) => st.toLowerCase().includes(s));
    });
  }, [records, visibleStationMasters, userAssignedStates]);

  const visibleRecords = useMemo(() => {
    if (records.length === 0) return [];
    if (!userAssignedStates || userAssignedStates.length === 0) return records;
    const allowedStationNames = new Set(visibleStations.map((s: string) => s.toLowerCase()));
    const lower = userAssignedStates.map((s: string) => s.trim().toLowerCase());
    return records.filter((r) => {
      if (allowedStationNames.has(r.estacion.toLowerCase())) return true;
      return lower.some((s: string) => (r.ciudad || '').toLowerCase().includes(s));
    });
  }, [records, visibleStations, userAssignedStates]);

  const visiblePlantMasters = useMemo(() => {
    if (plantRecords.length === 0) {
      return [];
    }
    const activePlantNames = new Set(
      plantRecords.map((r) => (r.estacion || '').trim().toLowerCase()).filter(Boolean)
    );
    let list = plantMasters.filter((pm) => activePlantNames.has(pm.nombre.trim().toLowerCase()));
    if (!userAssignedStates || userAssignedStates.length === 0) return list;
    const lower = userAssignedStates.map((s: string) => s.trim().toLowerCase());
    return list.filter((pm) => lower.includes(pm.estado.trim().toLowerCase()));
  }, [plantMasters, plantRecords, userAssignedStates]);

  const visiblePlants = useMemo(() => {
    if (plantRecords.length === 0) return [];
    const activeNames = Array.from(
      new Set(plantRecords.map((r) => (r.estacion || '').trim()))
    ).filter(Boolean);

    if (!userAssignedStates || userAssignedStates.length === 0) return activeNames;
    const lower = userAssignedStates.map((s: string) => s.trim().toLowerCase());
    return activeNames.filter((p) => {
      const master = visiblePlantMasters.find((pm) => pm.nombre.toLowerCase() === p.toLowerCase());
      if (master && lower.includes(master.estado.trim().toLowerCase())) return true;
      return lower.some((s: string) => p.toLowerCase().includes(s));
    });
  }, [plantRecords, visiblePlantMasters, userAssignedStates]);

  const visiblePlantRecords = useMemo(() => {
    if (plantRecords.length === 0) return [];
    if (!userAssignedStates || userAssignedStates.length === 0) return plantRecords;
    const allowedPlantNames = new Set(visiblePlants.map((p: string) => p.toLowerCase()));
    const lower = userAssignedStates.map((s: string) => s.trim().toLowerCase());
    return plantRecords.filter((r) => {
      if (allowedPlantNames.has(r.estacion.toLowerCase())) return true;
      return lower.some((s: string) => (r.ciudad || '').toLowerCase().includes(s));
    });
  }, [plantRecords, visiblePlants, userAssignedStates]);

  // Sincronización reactiva de estado en caché cuando Módulo 1 está vacío
  useEffect(() => {
    if (records.length === 0) {
      setStations([]);
      setStationMasters([]);
      setTargetStationForModule1(null);
      safeStorageSet('evaluaciones_stations_v1', JSON.stringify([]));
      safeStorageSet('evaluaciones_station_masters_v1', JSON.stringify([]));
    }
  }, [records.length]);

  useEffect(() => {
    if (plantRecords.length === 0) {
      setPlants([]);
      setPlantMasters([]);
      setTargetPlantForModule1(null);
      safeStorageSet('evaluaciones_plants_v1', JSON.stringify([]));
      safeStorageSet('evaluaciones_plant_masters_v1', JSON.stringify([]));
    }
  }, [plantRecords.length]);

  // Sincronizar targetStationForModule1 si la estación actual ya no pertenece a los estados autorizados
  useEffect(() => {
    if (visibleStations.length > 0 && (!targetStationForModule1 || !visibleStations.includes(targetStationForModule1))) {
      setTargetStationForModule1(visibleStations[0]);
    }
  }, [visibleStations, targetStationForModule1]);

  useEffect(() => {
    if (visiblePlants.length > 0 && (!targetPlantForModule1 || !visiblePlants.includes(targetPlantForModule1))) {
      setTargetPlantForModule1(visiblePlants[0]);
    }
  }, [visiblePlants, targetPlantForModule1]);

  // Cargar datos en tiempo real directamente desde Supabase al iniciar
  useEffect(() => {
    let isMounted = true;
    const loadLiveSupabaseData = async () => {
      try {
        // Cargar registros de estaciones de Supabase en tiempo real (filtrando permanentemente los eliminados)
        const savedBlacklist = localStorage.getItem('evaluaciones_deleted_record_ids_v1');
        const blacklist = savedBlacklist ? new Set<string>(JSON.parse(savedBlacklist)) : new Set<string>();

        const { records: sbRecords, error: errRecords } = await fetchSupabaseEvaluationRecords();
        if (isMounted && !errRecords && sbRecords) {
          const cleanRecords = sbRecords.filter((r) => !blacklist.has(r.id) && !blacklist.has(r.concatenar));
          if (cleanRecords.length > 0) {
            setRecords(cleanRecords);
            localStorage.setItem('evaluaciones_records_v1', JSON.stringify(cleanRecords));

            // Actualizar catálogo de estaciones con las encontradas en Supabase
            setStations((prev) => {
              const set = new Set(prev);
              cleanRecords.forEach((r) => {
                if (r.estacion && r.estacion.trim()) set.add(r.estacion.trim());
              });
              const updated = Array.from(set);
              try {
                localStorage.setItem('evaluaciones_stations_v1', JSON.stringify(updated));
              } catch (e) {
                console.error(e);
              }
              return updated;
            });

            // Registrar estaciones en stationMasters para catálogo general y mapas
            setStationMasters((prev) => {
              const existingNames = new Set(prev.map((sm) => sm.nombre.toLowerCase().trim()));
              const toAdd: typeof INITIAL_STATION_MASTERS = [];
              cleanRecords.forEach((r) => {
                const cleanName = (r.estacion || '').trim();
                if (cleanName && !existingNames.has(cleanName.toLowerCase())) {
                  existingNames.add(cleanName.toLowerCase());
                  toAdd.push({
                    codigo: `ST-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900 + 100)}`,
                    nombre: cleanName,
                    estado: r.ciudad?.includes('Sinaloa') ? 'Sinaloa' : r.ciudad?.includes('Sonora') ? 'Sonora' : 'Sinaloa',
                    ciudad: r.ciudad || 'Sinaloa - Mochis',
                    calificacion: 100,
                    estatus: 'Cumple',
                    evaluacionesCerradas: 1,
                    ultimoPeriodo: `${r.mes || 'Agosto'} ${r.anio || 2026}`,
                  });
                }
              });
              if (toAdd.length > 0) {
                const next = [...prev, ...toAdd];
                try {
                  localStorage.setItem('evaluaciones_station_masters_v1', JSON.stringify(next));
                } catch (e) {
                  console.error(e);
                }
                return next;
              }
              return prev;
            });

            // Establecer estación inicial para Módulo 1 si no está definida
            setTargetStationForModule1((curr) => {
              if (!curr && cleanRecords[0]?.estacion) return cleanRecords[0].estacion.trim();
              return curr;
            });
          } else {
            // Supabase TIENE 0 REGISTROS (base de datos vaciada por el usuario)
            setRecords([]);
            setStations([]);
            localStorage.setItem('evaluaciones_records_v1', JSON.stringify([]));
            localStorage.setItem('evaluaciones_stations_v1', JSON.stringify([]));
            localStorage.setItem('evaluaciones_records_purged', 'true');
            setTargetStationForModule1(null);
          }
        }

        // Cargar registros de plantas de Supabase en tiempo real (filtrando permanentemente los eliminados)
        const savedPlantBlacklist = localStorage.getItem('evaluaciones_plant_deleted_record_ids_v1');
        const plantBlacklist = savedPlantBlacklist ? new Set<string>(JSON.parse(savedPlantBlacklist)) : new Set<string>();

        const { records: sbPlantRecords, error: errPlants } = await fetchSupabasePlantEvaluationRecords();
        if (isMounted && !errPlants && sbPlantRecords) {
          const cleanPlantRecords = sbPlantRecords.filter((r) => !plantBlacklist.has(r.id) && !plantBlacklist.has(r.concatenar));
          if (cleanPlantRecords.length > 0) {
            setPlantRecords(cleanPlantRecords);
            localStorage.setItem('evaluaciones_plant_records_v1', JSON.stringify(cleanPlantRecords));

            // Actualizar catálogo de plantas con las encontradas en Supabase
            setPlants((prev) => {
              const set = new Set(prev);
              cleanPlantRecords.forEach((r) => {
                if (r.estacion && r.estacion.trim()) set.add(r.estacion.trim());
              });
              const updated = Array.from(set);
              try {
                localStorage.setItem('evaluaciones_plants_v1', JSON.stringify(updated));
              } catch (e) {
                console.error(e);
              }
              return updated;
            });

            setTargetPlantForModule1((curr) => {
              if (!curr && cleanPlantRecords[0]?.estacion) return cleanPlantRecords[0].estacion.trim();
              return curr;
            });
          } else {
            // Supabase plantas con 0 registros
            setPlantRecords([]);
            setPlants([]);
            localStorage.setItem('evaluaciones_plant_records_v1', JSON.stringify([]));
            localStorage.setItem('evaluaciones_plants_v1', JSON.stringify([]));
            localStorage.setItem('evaluaciones_plant_records_purged', 'true');
            setTargetPlantForModule1(null);
          }
        }

        // Cargar datos en vivo del usuario autenticado desde Supabase
        if (currentUser?.username) {
          const { user: liveUser } = await fetchUserFromSupabase(currentUser.username);
          if (isMounted && liveUser) {
            setCurrentUser((prev) => (prev ? { ...prev, ...liveUser } : liveUser));
            persistUserSession(liveUser);
          }
        }

        // Purgar de forma automática y definitiva los datos adjuntos de prueba en anexos
        deleteAllTestAnexosFromSupabase();
      } catch (e) {
        console.error('Error fetching live data from Supabase:', e);
      }
    };

    loadLiveSupabaseData();
    return () => {
      isMounted = false;
    };
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  const handleLogin = (user: UserSession) => {
    // Detectar si el usuario autenticado tiene rol de Administrador
    const cleanUser = user.username.trim().toLowerCase();
    const isAdmin =
      user.role === 'Admin' ||
      cleanUser === 'haroldo90' ||
      cleanUser === 'admin' ||
      cleanUser === 'admin1' ||
      cleanUser.includes('admin');

    setIsAdminAccount(isAdmin);
    saveIsAdminAccount(isAdmin);

    // Look up detailed user in INITIAL_USERS
    const detailed = INITIAL_USERS.find((u) => u.username.toLowerCase() === cleanUser);
    const mergedUser: UserSession = {
      ...(detailed || {}),
      ...user,
    };

    // Recuperar foto de clave dedicada si no viene en el objeto
    try {
      const storedAvatar = safeStorageGet(`evaluaciones_avatar_${user.username}`);
      if (storedAvatar && !mergedUser.avatarUrl) {
        mergedUser.avatarUrl = storedAvatar;
      }
    } catch (e) {
      // ignore
    }

    // Registrar fecha y hora exacta del ingreso en la bitácora de auditoría y en el perfil
    const trackedUser = recordUserLogin(mergedUser);

    setCurrentUser(trackedUser);
    setCurrentSection((prev) => (prev && prev !== 'inicio' ? prev : initialNav.section || 'inicio'));
    persistUserSession(trackedUser);

    // Sincronizar en segundo plano la fecha de ingreso en Supabase
    saveUserToSupabase(trackedUser).catch((err) => {
      console.warn('Could not sync last_login_at to Supabase:', err);
    });

    showToast(`Bienvenido al sistema, ${trackedUser.name} (${trackedUser.role})`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdminAccount(false);
    clearUserSession();
    safeStorageRemove('evaluaciones_is_admin_account');
    safeStorageRemove('evaluaciones_current_section_v1');
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {}
    showToast('Sesión cerrada correctamente.');
  };

  // Cierre de sesión automático por inactividad de 10 minutos
  const handleInactivityLogout = () => {
    try {
      sessionStorage.setItem('evaluaciones_logout_reason', 'inactivity');
    } catch {}
    setCurrentUser(null);
    setIsAdminAccount(false);
    clearUserSession();
    safeStorageRemove('evaluaciones_is_admin_account');
    safeStorageRemove('evaluaciones_current_section_v1');
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {}
    showToast('Sesión cerrada automáticamente por 10 minutos de inactividad.');
  };

  const {
    showWarning: showInactivityWarning,
    secondsRemaining: inactivitySecondsRemaining,
    resetTimer: resetInactivityTimer,
  } = useInactivityTimeout({
    timeoutMs: 10 * 60 * 1000, // 10 minutos (600,000 ms)
    warningMs: 60 * 1000,      // Advertencia 60 segundos antes de cerrar
    isEnabled: !!currentUser,
    onTimeout: handleInactivityLogout,
  });

  const handleAdminSwitchRole = (targetRole: UserRole) => {
    if (!isAdminAccount && currentUser?.role !== 'Admin') {
      showToast('Solo el Administrador tiene permiso para navegar entre los 3 roles.');
      return;
    }

    let roleUser: UserSession;
    if (targetRole === 'Admin') {
      roleUser = {
        username: 'admin',
        name: 'Administrador (Admin)',
        role: 'Admin',
        jobTitle: 'Administrador General',
      };
    } else if (targetRole === 'Coordinador') {
      roleUser = {
        username: 'coordinador',
        name: 'Coordinador (Vista Admin)',
        role: 'Coordinador',
        jobTitle: 'Coordinador de Evaluaciones',
      };
    } else {
      roleUser = {
        username: 'usuario_final',
        name: 'Usuario final (Vista Admin)',
        role: 'Usuario final',
        jobTitle: 'Consultante (Solo Lectura)',
      };
    }

    // Mantener avatar si existía
    if (currentUser?.avatarUrl) {
      roleUser.avatarUrl = currentUser.avatarUrl;
    }

    if (targetRole === 'Usuario final') {
      const allowedSections: MainNavSection[] = [
        'mapa',
        'metricas',
        'estaciones',
        'evaluaciones',
        'plantas_mapa',
        'plantas_metricas',
        'plantas',
        'plantas_evaluaciones',
        'perfil',
      ];
      if (!allowedSections.includes(currentSection)) {
        setCurrentSection('mapa');
      }
    }

    setIsAdminAccount(true);
    saveIsAdminAccount(true);

    setCurrentUser(roleUser);
    persistUserSession(roleUser);
    showToast(`Navegando ahora en modo: ${targetRole}`);
  };

  const handleUserListChange = (updatedList: UserSession[]) => {
    if (currentUser) {
      const foundCurrent = updatedList.find(
        (u) => u.username.toLowerCase() === currentUser.username.toLowerCase()
      );
      if (foundCurrent) {
        setCurrentUser(foundCurrent);
        persistUserSession(foundCurrent);
      }
    }
  };

  const handleUpdateProfileUser = (updatedUser: UserSession) => {
    setCurrentUser(updatedUser);
    persistUserSession(updatedUser);

    if (updatedUser.avatarUrl) {
      safeStorageSet(`evaluaciones_avatar_${updatedUser.username}`, updatedUser.avatarUrl);
    }

    // Sincronizar instantáneamente con Supabase
    saveUserToSupabase(updatedUser).then(({ success, user: sbUser, error }) => {
      if (success && sbUser) {
        setCurrentUser(sbUser);
        persistUserSession(sbUser);
        showToast('Perfil actualizado y sincronizado en Supabase al instante.');
      } else if (!success && error) {
        showToast(`Error al guardar en Supabase: ${error}`);
      }
    });
  };

  // Record mutations
  const handleAddRecord = (newRec: StationEvaluationRecord) => {
    setRecords((prev) => [newRec, ...prev]);
    if (!stations.includes(newRec.estacion)) {
      setStations((prev) => [...prev, newRec.estacion]);
    }
    // Guardar al instante en Supabase
    saveRecordToSupabase(newRec).then(({ success, error }) => {
      if (success) {
        showToast('Registro guardado en Supabase al instante.');
      } else if (error) {
        showToast(`Error al guardar en Supabase: ${error}`);
      }
    });
  };

  const handleUpdateRecord = (updatedRec: StationEvaluationRecord) => {
    setRecords((prev) => {
      const idx = prev.findIndex(
        (r) =>
          r.id === updatedRec.id ||
          (r.estacion === updatedRec.estacion &&
            r.mes === updatedRec.mes &&
            r.punto.toLowerCase().includes(updatedRec.punto.slice(0, 25).toLowerCase()))
      );
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = updatedRec;
        return next;
      }
      return [updatedRec, ...prev];
    });
    if (!stations.includes(updatedRec.estacion)) {
      setStations((prev) => [...prev, updatedRec.estacion]);
    }
    // Guardar al instante en Supabase
    saveRecordToSupabase(updatedRec).then(({ success, error }) => {
      if (success) {
        showToast('Calificación guardada en Supabase al instante.');
      } else if (error) {
        showToast(`Error al actualizar en Supabase: ${error}`);
      }
    });
  };

  const handleDeleteRecords = (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;
    const idSet = new Set(idsToDelete);

    // Identificar también las cadenas concatenar de los registros a eliminar
    const concatenarsToDelete: string[] = [];
    records.forEach((r) => {
      if (idSet.has(r.id)) {
        if (r.concatenar) concatenarsToDelete.push(r.concatenar);
        concatenarsToDelete.push(`${r.estacion}${r.mes}${r.punto}`);
      }
    });

    setRecords((prev) => {
      const remaining = prev.filter((r) => !idSet.has(r.id));
      try {
        localStorage.setItem('evaluaciones_records_v1', JSON.stringify(remaining));
        sessionStorage.setItem('evaluaciones_records_v1', JSON.stringify(remaining));
        if (remaining.length === 0) {
          localStorage.setItem('evaluaciones_records_purged', 'true');
          sessionStorage.setItem('evaluaciones_records_purged', 'true');
        }
      } catch (e) {
        console.error(e);
      }
      return remaining;
    });

    // Guardar IDs y concatenars borrados en la lista negra local para evitar que reaparezcan del generador inicial o Supabase
    try {
      const savedBlacklist = localStorage.getItem('evaluaciones_deleted_record_ids_v1');
      const blacklist: string[] = savedBlacklist ? JSON.parse(savedBlacklist) : [];
      const updatedBlacklist = Array.from(new Set([...blacklist, ...idsToDelete, ...concatenarsToDelete]));
      localStorage.setItem('evaluaciones_deleted_record_ids_v1', JSON.stringify(updatedBlacklist));
      sessionStorage.setItem('evaluaciones_deleted_record_ids_v1', JSON.stringify(updatedBlacklist));
    } catch (e) {
      console.error(e);
    }

    // Eliminar al instante de Supabase (por id y por concatenar)
    deleteSupabaseRecords(idsToDelete, concatenarsToDelete).then(({ success, error }) => {
      if (success) {
        showToast(`${idsToDelete.length} registro(s) eliminado(s) de memoria, caché y Supabase.`);
      } else if (error) {
        showToast(`Eliminado de caché local. En Supabase: ${error}`);
      }
    });
  };

  // Vaciar completamente la base de datos de Estaciones (borrar todos los registros de prueba)
  const handleClearAllRecords = async () => {
    try {
      setRecords([]);
      setStations([]);
      setStationMasters([]);
      setTargetStationForModule1(null);
      localStorage.setItem('evaluaciones_records_v1', JSON.stringify([]));
      localStorage.setItem('evaluaciones_stations_v1', JSON.stringify([]));
      localStorage.setItem('evaluaciones_station_masters_v1', JSON.stringify([]));
      sessionStorage.setItem('evaluaciones_records_v1', JSON.stringify([]));
      sessionStorage.setItem('evaluaciones_stations_v1', JSON.stringify([]));
      sessionStorage.setItem('evaluaciones_station_masters_v1', JSON.stringify([]));
      localStorage.setItem('evaluaciones_records_purged', 'true');
      sessionStorage.setItem('evaluaciones_records_purged', 'true');

      // Limpiar blacklist para que nuevas importaciones de archivos reales no colisionen
      localStorage.removeItem('evaluaciones_deleted_record_ids_v1');
      sessionStorage.removeItem('evaluaciones_deleted_record_ids_v1');

      const { success, error } = await deleteAllSupabaseRecords();
      if (success) {
        showToast('Base de datos de Estaciones vaciada con éxito. Supabase y navegador en 0 registros.');
      } else {
        showToast(`Memoria local vaciada (0 registros). En Supabase: ${error || 'Asegúrate de tener conexión'}`);
      }
    } catch (e: any) {
      console.error(e);
      showToast(`Error al vaciar registros: ${e?.message || e}`);
    }
  };

  // Eliminar estaciones seleccionadas y sus registros vinculados
  const handleDeleteStations = (stationNames: string[], stationCodes: string[]) => {
    if (stationNames.length === 0 && stationCodes.length === 0) return;
    const nameSet = new Set(stationNames.map((n) => n.trim().toLowerCase()));
    const codeSet = new Set(stationCodes);

    // 1. Eliminar registros de evaluación vinculados
    const recordsToDelete = records.filter((r) => nameSet.has(r.estacion.trim().toLowerCase()));
    if (recordsToDelete.length > 0) {
      handleDeleteRecords(recordsToDelete.map((r) => r.id));
    }

    // 2. Eliminar de la lista de nombres de estaciones
    setStations((prev) => prev.filter((s) => !nameSet.has(s.trim().toLowerCase())));

    // 3. Eliminar de stationMasters
    setStationMasters((prev) => {
      const next = prev.filter(
        (sm) => !codeSet.has(sm.codigo) && !nameSet.has(sm.nombre.trim().toLowerCase())
      );
      try {
        localStorage.setItem('evaluaciones_station_masters_v1', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    showToast(`${stationCodes.length} estación(es) eliminada(s) con éxito.`);
  };

  // File mutations
  const handleDeleteFiles = (fileIds: string[]) => {
    const idSet = new Set(fileIds);
    setImportHistory((prev) => prev.filter((f) => !idSet.has(f.id)));
    showToast(`${fileIds.length} archivo(s) eliminado(s) del historial.`);
  };

  // Import completion handler (guarantees non-destructive updates, duplicate resolution and Supabase sync)
  const handleImportComplete = async (
    newRecords: StationEvaluationRecord[],
    historyEntry: ImportedFileRecord,
    onProgress?: (processed: number, total: number) => void,
    duplicateAction: DuplicateAction = 'replace'
  ): Promise<{ success: boolean; count: number; error: string | null }> => {
    const isPlantSection = currentSection.startsWith('plantas');
    let recordsToSync: StationEvaluationRecord[] = [];

    if (isPlantSection) {
      // 1. Plantas flow
      setPlantRecords((prev) => {
        const updatedList = [...prev];
        const claimedIndices = new Set<number>();
        const toSync: StationEvaluationRecord[] = [];

        newRecords.forEach((newR) => {
          const cleanNewP = cleanTextForMatch(newR.punto);
          const normNewM = normalizeMonthName(newR.mes);
          const existingIdx = updatedList.findIndex(
            (r, idx) =>
              !claimedIndices.has(idx) &&
              isSameStation(r.estacion, newR.estacion) &&
              normalizeMonthName(r.mes) === normNewM &&
              cleanTextForMatch(r.punto) === cleanNewP
          );

          if (existingIdx !== -1) {
            claimedIndices.add(existingIdx);
            if (duplicateAction === 'replace') {
              // Reemplazar: actualizar datos del registro existente
              newR.id = updatedList[existingIdx].id;
              const merged: StationEvaluationRecord = {
                ...updatedList[existingIdx],
                calificacion: newR.calificacion,
                anio: newR.anio || updatedList[existingIdx].anio,
                concatenar: newR.concatenar || updatedList[existingIdx].concatenar,
                ciudad: newR.ciudad || updatedList[existingIdx].ciudad,
                observaciones: newR.observaciones || updatedList[existingIdx].observaciones,
              };
              updatedList[existingIdx] = merged;
              toSync.push(merged);
            } else if (duplicateAction === 'skip') {
              // Omitir: no modificar el registro existente
            } else if (duplicateAction === 'keep_both') {
              // Conservar ambos: agregar como nueva entrada independiente
              const freshId = `plant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
              const clone = { ...newR, id: freshId };
              updatedList.unshift(clone);
              toSync.push(clone);
            }
          } else {
            // Registro nuevo: siempre se agrega
            updatedList.unshift(newR);
            toSync.push(newR);
          }
        });

        recordsToSync = toSync;

        try {
          localStorage.setItem('evaluaciones_plant_records_v1', JSON.stringify(updatedList));
          localStorage.removeItem('evaluaciones_plant_records_purged');
          sessionStorage.removeItem('evaluaciones_plant_records_purged');

          const savedBl = localStorage.getItem('evaluaciones_plant_deleted_record_ids_v1');
          if (savedBl) {
            const bl = new Set<string>(JSON.parse(savedBl));
            newRecords.forEach((r) => {
              bl.delete(r.id);
              if (r.concatenar) bl.delete(r.concatenar);
            });
            localStorage.setItem('evaluaciones_plant_deleted_record_ids_v1', JSON.stringify(Array.from(bl)));
          }
        } catch (e) {
          console.error(e);
        }
        return updatedList;
      });

      const newPlantsSet = new Set(plants);
      newRecords.forEach((r) => {
        if (r.estacion && r.estacion.trim()) newPlantsSet.add(r.estacion.trim());
      });
      const updatedPlants = Array.from(newPlantsSet);
      setPlants(updatedPlants);
      try {
        localStorage.setItem('evaluaciones_plants_v1', JSON.stringify(updatedPlants));
      } catch (e) {
        console.error(e);
      }

      // Vincular automáticamente la primera planta importada para Módulo 1
      if (newRecords.length > 0 && newRecords[0].estacion) {
        setTargetPlantForModule1(newRecords[0].estacion.trim());
      }

      // Sincronizar el mes activo para Matriz General
      if (newRecords[0]?.mes) {
        const detectedM = normalizeMonthName(newRecords[0].mes);
        safeStorageSet('evaluaciones_m3_selected_month', detectedM);
      }

      setImportHistory((prev) => [historyEntry, ...prev]);

      // Guardar inmediatamente en Supabase (evaluaciones_plantas_registros)
      try {
        const syncList = recordsToSync.length > 0 ? recordsToSync : newRecords;
        const { success, count, error } = await syncPlantRecordsToSupabase(syncList, onProgress);
        if (success) {
          showToast(`Archivo "${historyEntry.fileName}" importado: ${count} registros procesados en Supabase.`);
          return { success: true, count, error: null };
        } else {
          showToast(`Importado localmente (${recordsToSync.length} reg). En Supabase: ${error}`);
          return { success: false, count: 0, error: error || 'Error al guardar en Supabase' };
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        showToast(`Importado localmente. Error conectando con Supabase: ${msg}`);
        return { success: false, count: 0, error: msg };
      }
    } else {
      // 2. Estaciones flow
      setRecords((prev) => {
        const updatedList = [...prev];
        const claimedIndices = new Set<number>();
        const toSync: StationEvaluationRecord[] = [];

        newRecords.forEach((newR) => {
          const cleanNewP = cleanTextForMatch(newR.punto);
          const normNewM = normalizeMonthName(newR.mes);
          const existingIdx = updatedList.findIndex(
            (r, idx) =>
              !claimedIndices.has(idx) &&
              isSameStation(r.estacion, newR.estacion) &&
              normalizeMonthName(r.mes) === normNewM &&
              cleanTextForMatch(r.punto) === cleanNewP
          );

          if (existingIdx !== -1) {
            claimedIndices.add(existingIdx);
            if (duplicateAction === 'replace') {
              // Reemplazar: actualizar datos del registro existente
              newR.id = updatedList[existingIdx].id;
              const merged: StationEvaluationRecord = {
                ...updatedList[existingIdx],
                calificacion: newR.calificacion,
                anio: newR.anio || updatedList[existingIdx].anio,
                concatenar: newR.concatenar || updatedList[existingIdx].concatenar,
                ciudad: newR.ciudad || updatedList[existingIdx].ciudad,
                observaciones: newR.observaciones || updatedList[existingIdx].observaciones,
              };
              updatedList[existingIdx] = merged;
              toSync.push(merged);
            } else if (duplicateAction === 'skip') {
              // Omitir: conservar registro existente
            } else if (duplicateAction === 'keep_both') {
              // Conservar ambos: agregar como nueva fila
              const freshId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
              const clone = { ...newR, id: freshId };
              updatedList.unshift(clone);
              toSync.push(clone);
            }
          } else {
            // Registro nuevo: siempre se agrega
            updatedList.unshift(newR);
            toSync.push(newR);
          }
        });

        recordsToSync = toSync;

        try {
          localStorage.setItem('evaluaciones_records_v1', JSON.stringify(updatedList));
          localStorage.removeItem('evaluaciones_records_purged');
          sessionStorage.removeItem('evaluaciones_records_purged');

          const savedBl = localStorage.getItem('evaluaciones_deleted_record_ids_v1');
          if (savedBl) {
            const bl = new Set<string>(JSON.parse(savedBl));
            newRecords.forEach((r) => {
              bl.delete(r.id);
              if (r.concatenar) bl.delete(r.concatenar);
            });
            localStorage.setItem('evaluaciones_deleted_record_ids_v1', JSON.stringify(Array.from(bl)));
          }
        } catch (e) {
          console.error(e);
        }
        return updatedList;
      });

      const newStationsSet = new Set(stations);
      newRecords.forEach((r) => {
        if (r.estacion && r.estacion.trim()) newStationsSet.add(r.estacion.trim());
      });
      const updatedStations = Array.from(newStationsSet);
      setStations(updatedStations);
      try {
        localStorage.setItem('evaluaciones_stations_v1', JSON.stringify(updatedStations));
      } catch (e) {
        console.error(e);
      }

      // Registrar estaciones en stationMasters para vinculación de catálogo y estado
      setStationMasters((prev) => {
        const existingNames = new Set(prev.map((sm) => sm.nombre.toLowerCase().trim()));
        const toAdd: typeof INITIAL_STATION_MASTERS = [];
        newRecords.forEach((r) => {
          const cleanName = (r.estacion || '').trim();
          if (cleanName && !existingNames.has(cleanName.toLowerCase())) {
            existingNames.add(cleanName.toLowerCase());
            const detectedState = detectStateFromRecord(r.ciudad, cleanName);
            const stRecs = newRecords.filter((nr) => isSameStation(nr.estacion, cleanName));
            const overall = calculateStationOverall(cleanName, stRecs, r.mes || 'SEPTIEMBRE', r.anio || 2026);
            toAdd.push({
              codigo: `ST-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900 + 100)}`,
              nombre: cleanName,
              estado: detectedState,
              ciudad: r.ciudad || `${detectedState} - ${cleanName}`,
              calificacion: overall.calificacionFinal || 85,
              estatus: overall.estatus,
              evaluacionesCerradas: 1,
              ultimoPeriodo: `${r.mes || 'Agosto'} ${r.anio || 2026}`,
            });
          }
        });
        if (toAdd.length > 0) {
          const next = [...prev, ...toAdd];
          try {
            localStorage.setItem('evaluaciones_station_masters_v1', JSON.stringify(next));
          } catch (e) {
            console.error(e);
          }
          return next;
        }
        return prev;
      });

      // Vincular automáticamente la primera estación importada para Módulo 1
      if (newRecords.length > 0 && newRecords[0].estacion) {
        setTargetStationForModule1(newRecords[0].estacion.trim());
      }

      // Sincronizar el mes activo para Matriz General
      if (newRecords[0]?.mes) {
        const detectedM = normalizeMonthName(newRecords[0].mes);
        safeStorageSet('evaluaciones_m3_selected_month', detectedM);
      }

      setImportHistory((prev) => [historyEntry, ...prev]);

      // Guardar inmediatamente en Supabase (evaluaciones_registros)
      try {
        const syncList = recordsToSync.length > 0 ? recordsToSync : newRecords;
        const { success, count, error } = await syncRecordsToSupabase(syncList, onProgress);
        if (success) {
          showToast(`Archivo "${historyEntry.fileName}" importado: ${count} registros procesados en Supabase.`);
          return { success: true, count, error: null };
        } else {
          showToast(`Importado localmente (${recordsToSync.length} reg). En Supabase: ${error}`);
          return { success: false, count: 0, error: error || 'Error al guardar en Supabase' };
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        showToast(`Importado localmente. Error conectando con Supabase: ${msg}`);
        return { success: false, count: 0, error: msg };
      }
    }
  };

  // Full synchronization to Supabase triggered on demand
  const handleSyncAllToSupabase = async (
    onProgress?: (processed: number, total: number) => void
  ): Promise<{ success: boolean; count: number; error: string | null }> => {
    const isPlant = currentSection.startsWith('plantas');
    const targetRecords = isPlant ? plantRecords : records;
    if (targetRecords.length === 0) {
      showToast('No hay registros en memoria para sincronizar con Supabase.');
      return { success: true, count: 0, error: null };
    }
    try {
      const res = isPlant
        ? await syncPlantRecordsToSupabase(targetRecords, onProgress)
        : await syncRecordsToSupabase(targetRecords, onProgress);
      if (res.success) {
        showToast(`✓ Sincronización completa: ${res.count} registros guardados en Supabase.`);
      } else {
        showToast(`Error al sincronizar con Supabase: ${res.error}`);
      }
      return res;
    } catch (e: any) {
      const msg = e?.message || String(e);
      showToast(`Error de conexión con Supabase: ${msg}`);
      return { success: false, count: 0, error: msg };
    }
  };

  // Guardar auditoría del Módulo Zoho y sincronizar con la base de datos centralizada
  const handleZohoSaveAudit = async (
    audit: ZohoAuditRecord,
    evalRecords: StationEvaluationRecord[]
  ): Promise<{ success: boolean; count: number; error: string | null }> => {
    const historyEntry: ImportedFileRecord = {
      id: `imp-form-est-${Date.now()}`,
      fileName: `Formulario_Estaciones_Auditoria_${audit.estacion.replace(/[^a-zA-Z0-9_-]/g, '_')}_${audit.mes}.xlsx`,
      moduleTarget: 'modulo1',
      uploadDate: `${audit.fecha} ${audit.hora}`,
      uploadedBy: audit.auditor,
      recordsCount: evalRecords.length,
      fileSizeFormatted: '12.4 KB',
      stationName: audit.estacion,
      month: audit.mes,
      status: 'Completado',
    };

    return await handleImportComplete(evalRecords, historyEntry, undefined, 'replace');
  };

  // Multi-section distribution handler (Módulo 4: BD, EST1, RESUMEN PUNTOS, OBSERVACIONES 1)
  const handleDistributeMultiSection = async (
    bdRecords: StationEvaluationRecord[],
    stationName?: string
  ) => {
    if (!bdRecords || bdRecords.length === 0) return;

    setRecords((prev) => {
      const updatedList = [...prev];
      bdRecords.forEach((newR) => {
        const cleanNewP = cleanTextForMatch(newR.punto);
        const normNewM = normalizeMonthName(newR.mes);
        const existingIdx = updatedList.findIndex(
          (r) =>
            isSameStation(r.estacion, newR.estacion) &&
            normalizeMonthName(r.mes) === normNewM &&
            (cleanTextForMatch(r.punto) === cleanNewP ||
              (cleanNewP.length >= 15 && cleanTextForMatch(r.punto).includes(cleanNewP)) ||
              (cleanTextForMatch(r.punto).length >= 15 && cleanNewP.includes(cleanTextForMatch(r.punto))))
        );
        if (existingIdx !== -1) {
          updatedList[existingIdx] = {
            ...updatedList[existingIdx],
            calificacion: newR.calificacion,
            anio: newR.anio || updatedList[existingIdx].anio,
            concatenar: newR.concatenar || updatedList[existingIdx].concatenar,
            ciudad: newR.ciudad || updatedList[existingIdx].ciudad,
          };
        } else {
          updatedList.unshift(newR);
        }
      });
      try {
        localStorage.setItem('evaluaciones_records_v1', JSON.stringify(updatedList));
      } catch (e) {
        console.error(e);
      }
      return updatedList;
    });

    const newStationsSet = new Set(stations);
    bdRecords.forEach((r) => {
      if (r.estacion) newStationsSet.add(r.estacion);
    });
    const updatedStations = Array.from(newStationsSet);
    setStations(updatedStations);
    try {
      localStorage.setItem('evaluaciones_stations_v1', JSON.stringify(updatedStations));
      localStorage.removeItem('evaluaciones_records_purged');
      sessionStorage.removeItem('evaluaciones_records_purged');
    } catch (e) {
      console.error(e);
    }

    // Guardar en Supabase en lotes seguros
    try {
      const { success, count, error } = await syncRecordsToSupabase(bdRecords);
      if (success) {
        showToast(`¡Distribución exitosa! Se guardaron ${count} registros en la base general y Supabase.`);
      } else {
        showToast(`Registros guardados en navegador. En Supabase: ${error}`);
      }
    } catch (err: any) {
      showToast(`Registros guardados en navegador. Error conectando con Supabase: ${err?.message || err}`);
    }

    const historyEntry: ImportedFileRecord = {
      id: `file-multisec-${Date.now()}`,
      fileName: 'Importación Multisección (BD, EST1, RESUMEN, OBS)',
      moduleTarget: 'general',
      uploadDate: new Date().toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      uploadedBy: currentUser?.name || 'Administrador',
      recordsCount: bdRecords.length,
      fileSizeFormatted: `${(bdRecords.length * 0.4).toFixed(1)} KB`,
      status: 'Completado',
      stationName: stationName || bdRecords[0]?.estacion,
    };
    setImportHistory((prev) => [historyEntry, ...prev]);
  };

  // Jump from Estaciones / Mapa to Módulo 2 (Por Estación)
  const handleSelectStationToInspect = (stationName: string) => {
    const clean = stationName.trim();
    setStations((prev) => {
      const match = prev.find((s) => isSameStation(s, clean));
      if (!match) {
        return [...prev, clean];
      }
      return prev;
    });
    setTargetStationForModule1(clean);
    safeStorageSet('evaluaciones_target_station_v1', clean);
    setCurrentSection('evaluaciones');
    setCurrentEvalSubModule('modulo2');
  };

  // Jump from Plantas to Módulo 2 (Por Planta)
  const handleSelectPlantToInspect = (plantName: string) => {
    setPlants((prev) => {
      if (!prev.includes(plantName)) {
        return [...prev, plantName];
      }
      return prev;
    });
    setTargetPlantForModule1(plantName);
    setCurrentSection('plantas_evaluaciones');
    setCurrentPlantEvalSubModule('modulo2');
  };

  // Plant record mutations
  const handleAddPlantRecord = (newRec: StationEvaluationRecord) => {
    setPlantRecords((prev) => [newRec, ...prev]);
    if (!plants.includes(newRec.estacion)) {
      setPlants((prev) => [...prev, newRec.estacion]);
    }
    // Guardar al instante en Supabase
    savePlantRecordToSupabase(newRec).then(({ success, error }) => {
      if (success) {
        showToast('Registro de planta guardado en Supabase al instante.');
      } else if (error) {
        showToast(`Error al guardar planta en Supabase: ${error}`);
      }
    });
  };

  const handleUpdatePlantRecord = (updatedRec: StationEvaluationRecord) => {
    setPlantRecords((prev) => {
      const idx = prev.findIndex(
        (r) =>
          r.id === updatedRec.id ||
          (r.estacion === updatedRec.estacion &&
            r.mes === updatedRec.mes &&
            r.punto.toLowerCase().includes(updatedRec.punto.slice(0, 25).toLowerCase()))
      );
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = updatedRec;
        return next;
      }
      return [updatedRec, ...prev];
    });
    if (!plants.includes(updatedRec.estacion)) {
      setPlants((prev) => [...prev, updatedRec.estacion]);
    }
    // Guardar al instante en Supabase
    savePlantRecordToSupabase(updatedRec).then(({ success, error }) => {
      if (success) {
        showToast('Calificación de planta guardada en Supabase al instante.');
      } else if (error) {
        showToast(`Error al actualizar planta en Supabase: ${error}`);
      }
    });
  };

  const handleDeletePlantRecords = (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;
    const idSet = new Set(idsToDelete);

    // Identificar también las cadenas concatenar de los registros de plantas a eliminar
    const concatenarsToDelete: string[] = [];
    plantRecords.forEach((r) => {
      if (idSet.has(r.id)) {
        if (r.concatenar) concatenarsToDelete.push(r.concatenar);
        concatenarsToDelete.push(`${r.estacion}${r.mes}${r.punto}`);
      }
    });

    setPlantRecords((prev) => {
      const remaining = prev.filter((r) => !idSet.has(r.id));
      try {
        localStorage.setItem('evaluaciones_plant_records_v1', JSON.stringify(remaining));
        sessionStorage.setItem('evaluaciones_plant_records_v1', JSON.stringify(remaining));
        if (remaining.length === 0) {
          localStorage.setItem('evaluaciones_plant_records_purged', 'true');
          sessionStorage.setItem('evaluaciones_plant_records_purged', 'true');
        }
      } catch (e) {
        console.error(e);
      }
      return remaining;
    });

    // Guardar IDs y concatenars borrados en la lista negra local de plantas
    try {
      const savedBlacklist = localStorage.getItem('evaluaciones_plant_deleted_record_ids_v1');
      const blacklist: string[] = savedBlacklist ? JSON.parse(savedBlacklist) : [];
      const updatedBlacklist = Array.from(new Set([...blacklist, ...idsToDelete, ...concatenarsToDelete]));
      localStorage.setItem('evaluaciones_plant_deleted_record_ids_v1', JSON.stringify(updatedBlacklist));
      sessionStorage.setItem('evaluaciones_plant_deleted_record_ids_v1', JSON.stringify(updatedBlacklist));
    } catch (e) {
      console.error(e);
    }

    // Eliminar al instante de Supabase (por id y por concatenar)
    deleteSupabasePlantRecords(idsToDelete, concatenarsToDelete).then(({ success, error }) => {
      if (success) {
        showToast(`${idsToDelete.length} registro(s) de planta eliminado(s) de memoria, caché y Supabase.`);
      } else if (error) {
        showToast(`Eliminado de caché local. En Supabase: ${error}`);
      }
    });
  };

  // Vaciar completamente la base de datos de Plantas (borrar todos los registros de prueba)
  const handleClearAllPlantRecords = async () => {
    try {
      setPlantRecords([]);
      setPlants([]);
      setTargetPlantForModule1(null);
      localStorage.setItem('evaluaciones_plant_records_v1', JSON.stringify([]));
      localStorage.setItem('evaluaciones_plants_v1', JSON.stringify([]));
      sessionStorage.setItem('evaluaciones_plant_records_v1', JSON.stringify([]));
      sessionStorage.setItem('evaluaciones_plants_v1', JSON.stringify([]));
      localStorage.setItem('evaluaciones_plant_records_purged', 'true');
      sessionStorage.setItem('evaluaciones_plant_records_purged', 'true');

      // Limpiar blacklist para que nuevas importaciones de archivos reales no colisionen
      localStorage.removeItem('evaluaciones_plant_deleted_record_ids_v1');
      sessionStorage.removeItem('evaluaciones_plant_deleted_record_ids_v1');

      const { success, error } = await deleteAllSupabasePlantRecords();
      if (success) {
        showToast('Base de datos de Plantas vaciada con éxito. Supabase y navegador en 0 registros.');
      } else {
        showToast(`Memoria local vaciada (0 registros). En Supabase: ${error || 'Asegúrate de tener conexión'}`);
      }
    } catch (e: any) {
      console.error(e);
      showToast(`Error al vaciar registros de plantas: ${e?.message || e}`);
    }
  };

  // Eliminar plantas seleccionadas y sus registros vinculados
  const handleDeletePlants = (plantNames: string[], plantCodes: string[]) => {
    if (plantNames.length === 0 && plantCodes.length === 0) return;
    const nameSet = new Set(plantNames.map((n) => n.trim().toLowerCase()));
    const codeSet = new Set(plantCodes);

    // 1. Eliminar registros de evaluación vinculados
    const recordsToDelete = plantRecords.filter((r) => nameSet.has(r.estacion.trim().toLowerCase()));
    if (recordsToDelete.length > 0) {
      handleDeletePlantRecords(recordsToDelete.map((r) => r.id));
    }

    // 2. Eliminar de la lista de nombres de plantas
    setPlants((prev) => prev.filter((s) => !nameSet.has(s.trim().toLowerCase())));

    // 3. Eliminar de plantMasters
    setPlantMasters((prev) => {
      const next = prev.filter(
        (pm) => !codeSet.has(pm.codigo) && !nameSet.has(pm.nombre.trim().toLowerCase())
      );
      try {
        localStorage.setItem('evaluaciones_plant_masters_v1', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    showToast(`${plantCodes.length} planta(s) eliminada(s) con éxito.`);
  };

  const handleRoleSelected = (role: UserRole) => {
    let userObj: UserSession;
    if (role === 'Admin') {
      setIsAdminAccount(true);
      try {
        localStorage.setItem('evaluaciones_is_admin_account', 'true');
      } catch (e) {
        console.error(e);
      }
      userObj = {
        username: 'admin',
        name: 'Administrador (Admin)',
        role: 'Admin',
        jobTitle: 'Administrador General',
      };
    } else if (role === 'Coordinador') {
      setIsAdminAccount(false);
      try {
        localStorage.removeItem('evaluaciones_is_admin_account');
      } catch (e) {
        console.error(e);
      }
      userObj = {
        username: 'coordinador',
        name: 'Coordinador',
        role: 'Coordinador',
        jobTitle: 'Coordinador de Evaluaciones',
      };
    } else {
      setIsAdminAccount(false);
      try {
        localStorage.removeItem('evaluaciones_is_admin_account');
      } catch (e) {
        console.error(e);
      }
      userObj = {
        username: 'usuario_final',
        name: 'Usuario final',
        role: 'Usuario final',
        jobTitle: 'Consultante (Solo Lectura)',
      };
    }
    handleLogin(userObj);
  };

  if (!currentUser) {
    return (
      <HomeRoleSelection
        onLoginSuccess={handleLogin}
      />
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-white text-neutral-900 flex font-sans selection:bg-neutral-900 selection:text-white">
      {/* 1. Left Sidebar Navigation (Desktop Fullscreen) */}
      <Sidebar
        currentSection={currentSection}
        setCurrentSection={setCurrentSection}
        currentEvalSubModule={currentEvalSubModule}
        setCurrentEvalSubModule={setCurrentEvalSubModule}
        currentPlantEvalSubModule={currentPlantEvalSubModule}
        setCurrentPlantEvalSubModule={setCurrentPlantEvalSubModule}
        user={currentUser}
        isAdminAccount={isAdminAccount}
        onAdminSwitchRole={handleAdminSwitchRole}
        onLogout={handleLogout}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        stationsCount={visibleStations.length}
        plantsCount={visiblePlants.length}
      />

      {/* 2. Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden pb-16 md:pb-0">
        {/* Top Header */}
        <TopHeader
          currentSection={currentSection}
          setCurrentSection={setCurrentSection}
          currentEvalSubModule={currentEvalSubModule}
          setCurrentEvalSubModule={setCurrentEvalSubModule}
          currentPlantEvalSubModule={currentPlantEvalSubModule}
          setCurrentPlantEvalSubModule={setCurrentPlantEvalSubModule}
          user={currentUser}
          isAdminAccount={isAdminAccount || currentUser.role === 'Admin'}
          onAdminSwitchRole={handleAdminSwitchRole}
          onLogout={handleLogout}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onNavigateToProfile={() => setCurrentSection('perfil')}
          onSwitchRole={handleLogout}
        />

        {/* Banner exclusivo de navegación de roles para el Administrador */}
        {(isAdminAccount || currentUser.role === 'Admin') && currentUser.role !== 'Admin' && (
          <div className="bg-amber-400 text-neutral-950 px-3 sm:px-6 py-2 text-xs font-medium flex items-center justify-between border-b border-amber-500 shadow-xs shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold uppercase tracking-wider text-[10px] bg-neutral-950 text-amber-300 px-2 py-0.5 rounded shadow-2xs">
                Super Admin en Simulación
              </span>
              <span>
                Navegando como <strong>{currentUser.role}</strong>. Cambiar a:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAdminSwitchRole('Admin')}
                  className="px-2 py-0.5 text-xs font-bold bg-neutral-950 hover:bg-neutral-800 text-white rounded transition-colors shadow-2xs cursor-pointer"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleAdminSwitchRole('Coordinador')}
                  className={`px-2 py-0.5 text-xs font-bold rounded transition-colors shadow-2xs cursor-pointer ${
                    currentUser.role === 'Coordinador'
                      ? 'bg-cyan-800 text-white'
                      : 'bg-neutral-900/10 hover:bg-neutral-900/20 text-neutral-900'
                  }`}
                >
                  Coordinador
                </button>
                <button
                  type="button"
                  onClick={() => handleAdminSwitchRole('Usuario final')}
                  className={`px-2 py-0.5 text-xs font-bold rounded transition-colors shadow-2xs cursor-pointer ${
                    currentUser.role === 'Usuario final'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-900/10 hover:bg-neutral-900/20 text-neutral-900'
                  }`}
                >
                  Usuario final
                </button>
              </div>
            </div>
            <button
              onClick={() => handleAdminSwitchRole('Admin')}
              className="px-3 py-1 text-xs font-bold bg-neutral-950 hover:bg-neutral-800 text-white rounded-md transition-colors shadow-2xs shrink-0 cursor-pointer"
            >
              Volver a Modo Admin →
            </button>
          </div>
        )}

        {/* Dynamic Section Content */}
        <main className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl w-full mx-auto min-w-0 overflow-x-hidden">
          {/* Section: Pantalla de Bienvenida (Inicio con Diagrama Técnico y Mensaje Personalizado) */}
          {currentSection === 'inicio' && currentUser && (
            <WelcomeScreenModule
              user={currentUser}
              onNavigateTo={(sec) => setCurrentSection(sec)}
            />
          )}

          {/* Section: Mapa de Estaciones (Visible para todos los roles, incluido Usuario final) */}
          {currentSection === 'mapa' && (
            <MexicoMapModule
              records={visibleRecords}
              customMasters={visibleStationMasters}
              title="Mapa de estaciones"
              onSelectStationToInspect={handleSelectStationToInspect}
              onNavigateToMetrics={() => setCurrentSection('metricas')}
            />
          )}

          {/* Section: Inicio / Métricas */}
          {currentSection === 'metricas' && (
            <MetricsDashboard
              records={visibleRecords}
              customMasters={visibleStationMasters}
              onNavigateToStations={() => setCurrentSection('estaciones')}
              onNavigateToEvaluaciones={() => {
                setCurrentSection('evaluaciones');
                setCurrentEvalSubModule('modulo1');
              }}
              user={currentUser}
              isAdminAccount={isAdminAccount || currentUser.role === 'Admin'}
              onAdminSwitchRole={handleAdminSwitchRole}
            />
          )}

          {/* Section: Estaciones */}
          {currentSection === 'estaciones' && (
            <StationsModule
              onSelectStationToInspect={handleSelectStationToInspect}
              initialMasters={visibleStationMasters}
              allowedStates={userAssignedStates || undefined}
              onDeleteStations={handleDeleteStations}
            />
          )}

          {/* Section: Evaluaciones (Módulo 1: Base de Datos, Módulo 2: Por Estación, Módulo 3: Matriz General) */}
          {currentSection === 'evaluaciones' && (
            <div>
              {currentEvalSubModule === 'modulo1' && (
                <Module2Database
                  records={visibleRecords}
                  stations={visibleStations}
                  onAddRecord={handleAddRecord}
                  onUpdateRecord={handleUpdateRecord}
                  onDeleteRecords={handleDeleteRecords}
                  onClearAllRecords={handleClearAllRecords}
                  onOpenImportModal={() => setIsImportModalOpen(true)}
                  onSyncAllToSupabase={handleSyncAllToSupabase}
                  onNavigateToModule1={(station) => {
                    if (station) setTargetStationForModule1(station);
                    setCurrentEvalSubModule('modulo2');
                  }}
                  onNavigateToMatrix={(month) => {
                    if (month) safeStorageSet('evaluaciones_m3_selected_month', month);
                    setCurrentEvalSubModule('modulo3');
                  }}
                  user={currentUser}
                />
              )}

              {currentEvalSubModule === 'modulo2' && (
                <Module1Station
                  records={visibleRecords}
                  stations={visibleStations}
                  onUpdateRecord={handleUpdateRecord}
                  onDeleteRecords={handleDeleteRecords}
                  onClearAllRecords={handleClearAllRecords}
                  onOpenImportModal={() => setIsImportModalOpen(true)}
                  user={currentUser}
                  targetStation={targetStationForModule1}
                  onStationChange={(st) => setTargetStationForModule1(st)}
                />
              )}

              {currentEvalSubModule === 'modulo3' && (
                <Module3Matrix
                  records={visibleRecords}
                  stations={visibleStations}
                  customMasters={visibleStationMasters}
                  onDeleteRecords={handleDeleteRecords}
                  onClearAllRecords={handleClearAllRecords}
                  onOpenImportModal={() => setIsImportModalOpen(true)}
                  user={currentUser}
                  onUpdateRecord={handleUpdateRecord}
                  showToast={showToast}
                />
              )}
            </div>
          )}

          {/* SECCIONES DUPLICADAS: 2. PLANTAS */}
          {/* Section: Mapa de Plantas (Visible para todos los roles, incluido Usuario final) */}
          {currentSection === 'plantas_mapa' && (
            <MexicoMapModule
              records={visiblePlantRecords}
              customMasters={visiblePlantMasters}
              title="Mapa de plantas"
              entityLabel="Plantas"
              onSelectStationToInspect={handleSelectPlantToInspect}
              onNavigateToMetrics={() => setCurrentSection('plantas_metricas')}
            />
          )}

          {/* Section: Métricas de Plantas */}
          {currentSection === 'plantas_metricas' && (
            <MetricsDashboard
              records={visiblePlantRecords}
              customMasters={visiblePlantMasters}
              title="Tablero de Métricas - Plantas"
              entityLabel="Plantas"
              onNavigateToStations={() => setCurrentSection('plantas')}
              onNavigateToEvaluaciones={() => {
                setCurrentSection('plantas_evaluaciones');
                setCurrentPlantEvalSubModule('modulo1');
              }}
              user={currentUser}
              isAdminAccount={isAdminAccount || currentUser.role === 'Admin'}
              onAdminSwitchRole={handleAdminSwitchRole}
            />
          )}

          {/* Section: Directorio / Lista de Plantas */}
          {currentSection === 'plantas' && (
            <StationsModule
              onSelectStationToInspect={handleSelectPlantToInspect}
              entityType="plantas"
              title="Plantas"
              entityLabel="Planta"
              pluralLabel="Plantas"
              initialMasters={visiblePlantMasters}
              storageKey="evaluaciones_plant_masters_v1"
              codePrefix="PLT-"
              allowedStates={userAssignedStates || undefined}
              onDeleteStations={handleDeletePlants}
            />
          )}

          {/* Section: Evaluaciones de Plantas (Módulo 1, 2, 3) */}
          {/* Section: Evaluaciones de Plantas (Módulo 1: Base de Datos, Módulo 2: Por Planta, Módulo 3: Matriz General) */}
          {currentSection === 'plantas_evaluaciones' && (
            <div>
              {currentPlantEvalSubModule === 'modulo1' && (
                <Module2Database
                  records={visiblePlantRecords}
                  stations={visiblePlants}
                  onAddRecord={handleAddPlantRecord}
                  onUpdateRecord={handleUpdatePlantRecord}
                  onDeleteRecords={handleDeletePlantRecords}
                  onClearAllRecords={handleClearAllPlantRecords}
                  onOpenImportModal={() => setIsImportModalOpen(true)}
                  onSyncAllToSupabase={handleSyncAllToSupabase}
                  onNavigateToModule1={(plant) => {
                    if (plant) setTargetPlantForModule1(plant);
                    setCurrentPlantEvalSubModule('modulo2');
                  }}
                  onNavigateToMatrix={(month) => {
                    if (month) safeStorageSet('evaluaciones_m3_selected_month', month);
                    setCurrentPlantEvalSubModule('modulo3');
                  }}
                  user={currentUser}
                  entityLabel="Planta"
                />
              )}

              {currentPlantEvalSubModule === 'modulo2' && (
                <Module1Station
                  records={visiblePlantRecords}
                  stations={visiblePlants}
                  onUpdateRecord={handleUpdatePlantRecord}
                  onDeleteRecords={handleDeletePlantRecords}
                  onClearAllRecords={handleClearAllPlantRecords}
                  onOpenImportModal={() => setIsImportModalOpen(true)}
                  user={currentUser}
                  targetStation={targetPlantForModule1}
                  onStationChange={(st) => setTargetPlantForModule1(st)}
                  entityLabel="Planta"
                />
              )}

              {currentPlantEvalSubModule === 'modulo3' && (
                <Module3Matrix
                  records={visiblePlantRecords}
                  stations={visiblePlants}
                  customMasters={visiblePlantMasters}
                  onDeleteRecords={handleDeletePlantRecords}
                  onClearAllRecords={handleClearAllPlantRecords}
                  onOpenImportModal={() => setIsImportModalOpen(true)}
                  user={currentUser}
                  entityLabel="Planta"
                  onUpdateRecord={handleUpdatePlantRecord}
                  showToast={showToast}
                />
              )}
            </div>
          )}

          {/* Section: Usuarios (Desactivado para Usuario final) */}
          {currentSection === 'usuarios' && currentUser.role !== 'Usuario final' && (
            <UsersModule currentUser={currentUser} onUserListChange={handleUserListChange} />
          )}

          {/* Section: Base de Datos Supabase (Desactivado para Usuario final) */}
          {currentSection === 'supabase' && currentUser.role !== 'Usuario final' && (
            <SupabaseModule
              localRecords={records}
              onSyncLocalRecords={(newRecs) => setRecords(newRecs)}
              currentUser={currentUser}
              showToast={showToast}
            />
          )}

          {/* Section: Historial de Archivos (Desactivado para Usuario final) */}
          {currentSection === 'historial' && currentUser.role !== 'Usuario final' && (
            <FileManager
              files={importHistory}
              user={currentUser}
              onDeleteFiles={handleDeleteFiles}
              onOpenImportModal={() => setIsImportModalOpen(true)}
            />
          )}

          {/* Section: Módulo Zoho (Formulario de Inspección, Historial y Exportación) */}
          {currentSection === 'zoho' && currentUser.role !== 'Usuario final' && (
            <ZohoModule
              user={currentUser}
              stations={stations}
              existingRecords={records}
              onSaveAuditToSystem={handleZohoSaveAudit}
              onUpdateRecord={handleUpdateRecord}
              showToast={showToast}
            />
          )}

          {/* Section: Perfil */}
          {currentSection === 'perfil' && (
            <ProfileModule
              user={currentUser}
              onUpdateUser={handleUpdateProfileUser}
              showToast={showToast}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>

      {/* 3. Bottom Navigation Bar (Tablet, iOS & Mobile) */}
      <BottomNavBar
        currentSection={currentSection}
        setCurrentSection={setCurrentSection}
        user={currentUser}
        onLogout={handleLogout}
      />

      {/* Manual File Import Modal */}
      <FileImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        user={currentUser}
        stations={currentSection.startsWith('plantas') ? plants : stations}
        existingRecords={currentSection.startsWith('plantas') ? plantRecords : records}
        entityLabel={currentSection.startsWith('plantas') ? 'Planta' : 'Estación'}
        initialModule="modulo1"
        onImportComplete={handleImportComplete}
      />

      {/* Diálogo de advertencia de inactividad (últimos 60 segundos antes del auto-cierre de 10 min) */}
      {showInactivityWarning && currentUser && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/50 p-4 animate-in fade-in backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-amber-300 p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6 animate-pulse text-amber-600" />
            </div>
            <div>
              <h4 className="text-base font-bold text-neutral-900">¿Sigues en el sistema?</h4>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                Por seguridad, tu sesión se cerrará automáticamente en{' '}
                <span className="font-bold text-amber-700 font-mono text-sm">{inactivitySecondsRemaining}</span>{' '}
                segundos si no se detecta movimiento.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={resetInactivityTimer}
                className="w-full py-2.5 bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Mantener Sesión Activa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-16 md:bottom-5 right-5 z-50 bg-neutral-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}
    </div>
  );
}
