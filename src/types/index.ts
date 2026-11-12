export type MonthName =
  | 'ENERO'
  | 'FEBRERO'
  | 'MARZO'
  | 'ABRIL'
  | 'MAYO'
  | 'JUNIO'
  | 'JULIO'
  | 'AGOSTO'
  | 'SEPTIEMBRE'
  | 'OCTUBRE'
  | 'NOVIEMBRE'
  | 'DICIEMBRE';

export const MONTHS: MonthName[] = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
];

export interface RubroItem {
  id: string; // e.g. "1.1", "2.3", "INFORMATIVO"
  rubroId: number; // 1 to 5, or 6 for Otros
  rubroName: string;
  norma: string;
  description: string;
  maxPoints: number; // e.g. 3, 5, 2, 1, or 0 for informative
  isInformative?: boolean;
}

export interface EvidencePhoto {
  id: string;
  dataUrl: string; // Base64 or object URL of photo
  caption?: string;
  timestamp: string;
  slotIndex?: number; // 1, 2, 3, 4
}

export interface StationEvaluationRecord {
  id: string;
  concatenar: string;
  ciudad: string;
  estacion: string;
  mes: MonthName;
  anio: number;
  punto: string;
  calificacion: number | string;
  rubroId?: number;
  evidencias?: EvidencePhoto[]; // Up to 4 photos (Inspector / Admin / Coordinador)
  observaciones?: string; // Observations and findings notes (Inspector / Admin / Coordinador)
  inspectorSubmittedAt?: string; // Timestamp when Admin/Coordinador uploaded evidence/notes (Starts stopwatch)
  inspectorUser?: string; // Inspector username / role
  userFinalEvidencias?: EvidencePhoto[]; // Evidencias subidas por el Usuario Final (Subsanación / Respuesta)
  userFinalObservaciones?: string; // Observaciones / justificación del Usuario Final
  userFinalSubmittedAt?: string; // Timestamp when Usuario Final uploaded evidences (Stops and freezes stopwatch)
  userFinalUser?: string; // Usuario Final name / username
  timerElapsedSeconds?: number; // Total seconds taken by Usuario Final (frozen duration)
  timerFrozen?: boolean; // True once frozen permanently
}

export interface ImportedFileRecord {
  id: string;
  fileName: string;
  moduleTarget: 'modulo1' | 'modulo2' | 'modulo3' | 'general';
  uploadDate: string;
  uploadedBy: string;
  recordsCount: number;
  fileSizeFormatted: string;
  stationName?: string;
  month?: MonthName;
  status: 'Completado' | 'En proceso' | 'Error';
}

export interface AnexoFile {
  id: string;
  mes: MonthName | string;
  anio: number;
  estacion?: string; // 'General' o nombre de estación
  nombreArchivo: string;
  tipoArchivo: 'pdf' | 'excel' | 'word' | 'image' | 'text' | 'zip' | 'other';
  mimeType?: string;
  tamanoBytes: number;
  tamanoFormatted: string;
  contenidoUrl: string; // Base64 data URL o URL de Supabase para descarga directa
  descripcion?: string;
  subidoPor: string;
  subidoPorRol?: string;
  createdAt: string;
}

export type UserRole =
  | 'Admin'
  | 'Coordinador'
  | 'Usuario final'
  | 'Administrador'
  | 'Auditor de seguridad'
  | 'Evaluador'
  | 'Supervisor';

export interface UserSession {
  username: string;
  name: string;
  role: UserRole;
  email?: string;
  phone?: string;
  jobTitle?: string;
  state?: string;
  assignedStates?: string[]; // Estados asignados para filtrar permisos de visualización
  avatarUrl?: string;
  password?: string;
  createdAt?: string;
  status?: 'Activo' | 'Inactivo';
  lastLoginAt?: string; // Fecha y hora ISO del último acceso al sistema
  loginCount?: number; // Contador total de ingresos al sistema
}

export interface UserLoginLog {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  timestamp: string; // ISO string
  formattedDate: string; // Formato amigable dd/mm/yyyy hh:mm:ss a
  deviceInfo?: string;
}


export interface StationMaster {
  codigo: string;
  nombre: string;
  estado: string;
  ciudad: string;
  calificacion: number;
  estatus: 'Cumple' | 'Observación' | 'Crítico';
  evaluacionesCerradas?: number;
  ultimoPeriodo?: string;
}

export type MainNavSection =
  | 'inicio'
  | 'mapa'
  | 'metricas'
  | 'estaciones'
  | 'evaluaciones'
  | 'plantas_mapa'
  | 'plantas_metricas'
  | 'plantas'
  | 'plantas_evaluaciones'
  | 'usuarios'
  | 'supabase'
  | 'perfil'
  | 'historial'
  | 'distribuidor'
  | 'zoho';

export interface ZohoAuditItem {
  puntoIndex: number; // 1 to 54
  id: string; // e.g. "1.1", "2.1", "INF-3.1"
  rubroId: number;
  rubroName: string;
  punto: string;
  calificacion: number | string;
  observaciones: string;
  maxPoints: number;
  isInformative?: boolean;
}

export interface ZohoAuditRecord {
  id: string;
  fecha: string; // YYYY-MM-DD (recabada automáticamente)
  hora: string; // HH:MM (recabada automáticamente)
  auditor: string; // Nombre del auditor
  estacion: string;
  ciudad: string;
  mes: MonthName;
  anio: number;
  overallScore: number;
  estatus: 'Cumple' | 'Observación' | 'Crítico';
  observacionesCount: number;
  items: ZohoAuditItem[];
  createdAt: string;
  updatedAt?: string;
}

export type EvalSubModule = 'modulo1' | 'modulo2' | 'modulo3';

export interface MultiSectionData {
  bdRecords: StationEvaluationRecord[];
  est1Records: Record<string, any>[];
  est1Headers: string[];
  resumenPuntosRows: Record<string, any>[];
  resumenPuntosHeaders: string[];
  observacionesRows: Record<string, any>[];
  observacionesHeaders: string[];
  rawSheets: Record<string, any[][]>;
  sheetNames: string[];
  meta: {
    fileName: string;
    importDate: string;
    fileSizeFormatted: string;
    totalSheetsFound: number;
    isCsv?: boolean;
    autoGeneratedFromBD?: boolean;
    sheetsMapped: {
      bd?: string;
      est1?: string;
      resumen?: string;
      observaciones?: string;
    };
  };
}
