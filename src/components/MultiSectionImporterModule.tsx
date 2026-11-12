import React, { useState, useEffect, useRef } from 'react';
import {
  MultiSectionData,
  StationEvaluationRecord,
  UserSession,
} from '../types';
import {
  parseMultiSectionExcel,
  downloadSampleMultiSectionTemplate,
  exportMultiSectionDataToExcel,
  parseIndividualTableFile,
} from '../utils/excelUtils';
import {
  Upload,
  FileSpreadsheet,
  Layers,
  Database,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Download,
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
  Info,
  Check,
  Table,
  SlidersHorizontal,
  ChevronRight,
  X,
  FileDown,
  Sparkles,
} from 'lucide-react';

interface MultiSectionImporterModuleProps {
  user: UserSession;
  onDistributeToPlatform: (
    bdRecords: StationEvaluationRecord[],
    stationName?: string
  ) => void;
  showToast: (msg: string) => void;
}

const STORAGE_KEY = 'evaluaciones_multisection_data_v1';

export const MultiSectionImporterModule: React.FC<MultiSectionImporterModuleProps> = ({
  user,
  onDistributeToPlatform,
  showToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const individualFileInputRef = useRef<HTMLInputElement>(null);
  const [targetIndividualTab, setTargetIndividualTab] = useState<'est1' | 'resumen' | 'observaciones' | null>(null);

  const [data, setData] = useState<MultiSectionData | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<'bd' | 'est1' | 'resumen' | 'observaciones'>('bd');
  const [loading, setLoading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStationFilter, setSelectedStationFilter] = useState<string>('all');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');

  // Sheet mapping overrides
  const [customMapping, setCustomMapping] = useState<{
    bd?: string;
    est1?: string;
    resumen?: string;
    observaciones?: string;
  }>({});

  // Sync to local storage
  useEffect(() => {
    if (data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.error('Error saving multi-section data to storage:', e);
      }
    }
  }, [data]);

  // Handle file selection (single or multi)
  const handleFileProcess = async (file: File) => {
    try {
      setLoading(true);
      const parsedData = await parseMultiSectionExcel(file, customMapping);
      setData(parsedData);
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      if (isCsv) {
        showToast(`Archivo CSV procesado (${parsedData.bdRecords.length} reg). Las 4 secciones han sido distribuidas.`);
      } else {
        showToast(`Libro de Excel procesado con éxito. Se detectaron y distribuyeron las 4 secciones.`);
      }
    } catch (error: any) {
      console.error(error);
      showToast(`Error al procesar el archivo: ${error?.message || 'Formato no compatible'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMultipleFilesProcess = async (files: File[]) => {
    try {
      setLoading(true);
      const bdFile =
        files.find((f) => {
          const n = f.name.toUpperCase();
          return n.includes('BD') || n.includes('BASE');
        }) || files[0];

      let parsed = await parseMultiSectionExcel(bdFile, customMapping);

      for (const f of files) {
        if (f === bdFile) continue;
        const n = f.name.toUpperCase();
        const table = await parseIndividualTableFile(f);
        if (n.includes('EST') || n.includes('ESTACION')) {
          parsed.est1Headers = table.headers;
          parsed.est1Records = table.rows;
          parsed.meta.sheetsMapped.est1 = f.name;
        } else if (n.includes('RESUMEN') || n.includes('PUNTO')) {
          parsed.resumenPuntosHeaders = table.headers;
          parsed.resumenPuntosRows = table.rows;
          parsed.meta.sheetsMapped.resumen = f.name;
        } else if (n.includes('OBSERVACION') || n.includes('NOTAS') || n.includes('HALLAZGO')) {
          parsed.observacionesHeaders = table.headers;
          parsed.observacionesRows = table.rows;
          parsed.meta.sheetsMapped.observaciones = f.name;
        }
      }

      setData(parsed);
      showToast(`Se cargaron y distribuyeron ${files.length} archivos a las 4 secciones con éxito.`);
    } catch (err: any) {
      showToast(`Error al procesar archivos: ${err?.message || 'Error de formato'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      handleFileProcess(files[0]);
    } else {
      handleMultipleFilesProcess(Array.from(files));
    }
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 1) {
      handleFileProcess(files[0]);
    } else if (files.length > 1) {
      handleMultipleFilesProcess(files);
    }
  };

  // Upload individual sheet per tab
  const handleIndividualFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetIndividualTab) return;
    try {
      setLoading(true);
      const parsed = await parseIndividualTableFile(file);
      setData((prev) => {
        if (!prev) return prev;
        if (targetIndividualTab === 'est1') {
          return {
            ...prev,
            est1Headers: parsed.headers,
            est1Records: parsed.rows,
            meta: {
              ...prev.meta,
              sheetsMapped: { ...prev.meta.sheetsMapped, est1: file.name },
            },
          };
        } else if (targetIndividualTab === 'resumen') {
          return {
            ...prev,
            resumenPuntosHeaders: parsed.headers,
            resumenPuntosRows: parsed.rows,
            meta: {
              ...prev.meta,
              sheetsMapped: { ...prev.meta.sheetsMapped, resumen: file.name },
            },
          };
        } else if (targetIndividualTab === 'observaciones') {
          return {
            ...prev,
            observacionesHeaders: parsed.headers,
            observacionesRows: parsed.rows,
            meta: {
              ...prev.meta,
              sheetsMapped: { ...prev.meta.sheetsMapped, observaciones: file.name },
            },
          };
        }
        return prev;
      });
      showToast(`Hoja para "${targetIndividualTab.toUpperCase()}" cargada exitosamente (${parsed.rows.length} filas).`);
    } catch (err: any) {
      showToast(`Error al leer archivo: ${err?.message || 'Formato no soportado'}`);
    } finally {
      setLoading(false);
      setTargetIndividualTab(null);
      if (e.target) e.target.value = '';
    }
  };

  // Clear data and cache
  const handleClearAllData = () => {
    setData(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    setShowClearModal(false);
    showToast('Caché limpiada y registros del módulo eliminados.');
  };

  // Distribute all to platform
  const handleDistributeAll = () => {
    if (!data || data.bdRecords.length === 0) {
      showToast('No hay registros en la sección BD para distribuir.');
      return;
    }
    const detectedStation = data.bdRecords[0]?.estacion || undefined;
    onDistributeToPlatform(data.bdRecords, detectedStation);
    showToast(`Se distribuyeron ${data.bdRecords.length} registros automáticamente al sistema.`);
  };

  // Filtering for BD records
  const filteredBDRecords = React.useMemo(() => {
    if (!data?.bdRecords) return [];
    return data.bdRecords.filter((r) => {
      const matchSearch =
        !searchTerm ||
        r.punto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.estacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.ciudad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.concatenar.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStation =
        selectedStationFilter === 'all' || r.estacion === selectedStationFilter;

      const matchMonth =
        selectedMonthFilter === 'all' || r.mes === selectedMonthFilter;

      return matchSearch && matchStation && matchMonth;
    });
  }, [data?.bdRecords, searchTerm, selectedStationFilter, selectedMonthFilter]);

  // Filtering for other sections
  const filteredEst1Rows = React.useMemo(() => {
    if (!data?.est1Records) return [];
    if (!searchTerm) return data.est1Records;
    return data.est1Records.filter((row) =>
      Object.values(row).some((val) =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data?.est1Records, searchTerm]);

  const filteredResumenRows = React.useMemo(() => {
    if (!data?.resumenPuntosRows) return [];
    if (!searchTerm) return data.resumenPuntosRows;
    return data.resumenPuntosRows.filter((row) =>
      Object.values(row).some((val) =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data?.resumenPuntosRows, searchTerm]);

  const filteredObservacionesRows = React.useMemo(() => {
    if (!data?.observacionesRows) return [];
    if (!searchTerm) return data.observacionesRows;
    return data.observacionesRows.filter((row) =>
      Object.values(row).some((val) =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data?.observacionesRows, searchTerm]);

  const stationsInBD = React.useMemo(() => {
    if (!data?.bdRecords) return [];
    return Array.from(new Set(data.bdRecords.map((r) => r.estacion)));
  }, [data?.bdRecords]);

  const monthsInBD = React.useMemo(() => {
    if (!data?.bdRecords) return [];
    return Array.from(new Set(data.bdRecords.map((r) => r.mes)));
  }, [data?.bdRecords]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. MÓDULO HEADER */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-[#0c323f] text-[#38bdf8] rounded-lg shadow-2xs">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                  <span>Módulo 4: Importador y Distribución Multisección</span>
                  <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Automático
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-neutral-500">
                  Carga un archivo Excel con 4 secciones y distribúyelo automáticamente en:{' '}
                  <strong className="text-neutral-700">BD</strong>,{' '}
                  <strong className="text-neutral-700">EST1</strong>,{' '}
                  <strong className="text-neutral-700">RESUMEN PUNTOS</strong> y{' '}
                  <strong className="text-neutral-700">OBSERVACIONES 1</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Action Header Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => downloadSampleMultiSectionTemplate()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors border border-neutral-300 shadow-2xs cursor-pointer"
              title="Descargar plantilla de Excel con las 4 hojas oficiales de ejemplo"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span>Plantilla Ejemplo (4 Hojas)</span>
            </button>

            {data && (
              <>
                <button
                  onClick={() => exportMultiSectionDataToExcel(data)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 rounded-lg transition-colors border border-neutral-300 shadow-2xs cursor-pointer"
                  title="Exportar archivo consolidado con las 4 secciones"
                >
                  <Download className="w-4 h-4 text-[#0c323f]" />
                  <span>Exportar Consolidado</span>
                </button>

                <button
                  onClick={handleDistributeAll}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#0c323f] hover:bg-[#144453] rounded-lg transition-all shadow-xs cursor-pointer hover:shadow"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Distribuir a Plataforma</span>
                </button>

                <button
                  onClick={() => setShowClearModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200 cursor-pointer"
                  title="Borrar registros del módulo y limpiar caché"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span>Borrar y Limpiar Caché</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Info badges when data is loaded */}
        {data && (
          <div className="mt-4 pt-4 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-neutral-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                {data.meta.fileName}
              </span>
              <span className="text-neutral-400">•</span>
              <span>Subido: {data.meta.importDate}</span>
              <span className="text-neutral-400">•</span>
              <span>Tamaño: {data.meta.fileSizeFormatted}</span>
              <span className="text-neutral-400">•</span>
              <span className="bg-cyan-50 text-cyan-800 px-2 py-0.5 rounded font-mono font-medium">
                {data.meta.totalSheetsFound} hojas detectadas
              </span>
            </div>

            <button
              onClick={() => setShowMappingModal(true)}
              className="text-xs font-semibold text-[#0c323f] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Ver / Ajustar Mapeo de Hojas</span>
            </button>
          </div>
        )}

        {/* Banner explicativo cuando el archivo cargado es un .CSV */}
        {data && data.meta.isCsv && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50/95 border border-amber-200/90 text-amber-950 text-xs space-y-2">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-amber-200/80 rounded-lg text-amber-800 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-xs sm:text-sm text-amber-950 flex items-center gap-2">
                    <span>Archivo .CSV cargado: {data.meta.fileName}</span>
                    <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded font-bold font-mono">
                      1 Hoja por especificación CSV
                    </span>
                  </div>
                  {data.meta.autoGeneratedFromBD && (
                    <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      4 secciones calculadas y listas
                    </span>
                  )}
                </div>
                <p className="text-amber-800 leading-relaxed">
                  <strong>¿Por qué solo se detectó 1 hoja?</strong> Los archivos <code>.csv</code> son archivos de texto que, por diseño de Excel, <strong>solo pueden contener 1 sola hoja de cálculo</strong> (la que estaba seleccionada al momento de guardar). Si tu archivo de trabajo original es un libro de Excel con 4 pestañas abajo (BD, EST1, RESUMEN PUNTOS, OBSERVACIONES 1), guarda y sube el archivo original en formato <strong>.XLSX</strong> para leer todas las pestañas juntas en un solo paso.
                </p>
                <div className="p-2.5 bg-white/70 rounded-lg border border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-amber-900 font-medium">
                    ⚡ <strong>¡Distribución automática activa!</strong> Hemos calculado y generado las secciones <strong>EST1</strong>, <strong>RESUMEN PUNTOS</strong> y <strong>OBSERVACIONES 1</strong> a partir de tus {data.bdRecords.length} registros de BD.
                  </span>
                  <span className="text-[11px] text-amber-700">
                    O si tienes las demás hojas en archivos individuales, puedes subirlas en los botones de cada pestaña.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. ZONA DE CARGA DE ARCHIVO (DROPZONE) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".xlsx,.xls,.csv"
        multiple
        className="hidden"
      />

      <input
        type="file"
        ref={individualFileInputRef}
        onChange={handleIndividualFileChange}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
          isDragOver
            ? 'border-[#0c323f] bg-cyan-50/50 scale-[1.005]'
            : data
            ? 'border-neutral-200 bg-neutral-50/60 hover:bg-neutral-100/60'
            : 'border-[#38bdf8]/60 bg-[#0c323f]/5 hover:bg-[#0c323f]/10'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#0c323f]/10 flex items-center justify-center text-[#0c323f]">
            {loading ? (
              <RefreshCw className="w-6 h-6 animate-spin text-[#0c323f]" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-neutral-900">
              {loading
                ? 'Analizando y distribuyendo hojas del archivo...'
                : data
                ? 'Arrastra otro archivo o haz clic para reemplazar los datos'
                : 'Selecciona o arrastra tu archivo Excel con las 4 secciones'}
            </h3>
            <p className="text-xs text-neutral-500">
              Formatos aceptados: .XLSX, .XLS, .CSV. El sistema detectará automáticamente las hojas o secciones{' '}
              <strong>BD</strong>, <strong>EST1</strong>, <strong>RESUMEN PUNTOS</strong> y{' '}
              <strong>OBSERVACIONES 1</strong>.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-white bg-[#0c323f] hover:bg-[#144453] rounded-lg transition-colors shadow-2xs"
            >
              {loading ? 'Procesando...' : 'Examinar Archivo'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. RESUMEN DE LAS 4 SECCIONES DETECTADAS (CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: BD */}
        <div
          onClick={() => setActiveTab('bd')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'bd'
              ? 'border-[#0c323f] bg-white ring-2 ring-[#0c323f]/15 shadow-sm'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-800 rounded-md">
                <Database className="w-4 h-4" />
              </span>
              <span className="font-bold text-xs uppercase tracking-wider text-neutral-700">
                1. BD
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                (data?.bdRecords.length || 0) > 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {(data?.bdRecords.length || 0) > 0 ? 'Conectado' : 'Vacío'}
            </span>
          </div>
          <div className="text-xl font-extrabold text-neutral-900">
            {data?.bdRecords.length || 0}{' '}
            <span className="text-xs font-medium text-neutral-500">registros</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
            Hoja: {data?.meta.sheetsMapped.bd || 'Pendiente'}
          </p>
        </div>

        {/* Card 2: EST1 */}
        <div
          onClick={() => setActiveTab('est1')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'est1'
              ? 'border-[#0c323f] bg-white ring-2 ring-[#0c323f]/15 shadow-sm'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-100 text-indigo-800 rounded-md">
                <Table className="w-4 h-4" />
              </span>
              <span className="font-bold text-xs uppercase tracking-wider text-neutral-700">
                2. EST1
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                (data?.est1Records.length || 0) > 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {(data?.est1Records.length || 0) > 0 ? 'Conectado' : 'Vacío'}
            </span>
          </div>
          <div className="text-xl font-extrabold text-neutral-900">
            {data?.est1Records.length || 0}{' '}
            <span className="text-xs font-medium text-neutral-500">filas de criterios</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
            Hoja: {data?.meta.sheetsMapped.est1 || 'Pendiente'}
          </p>
        </div>

        {/* Card 3: RESUMEN PUNTOS */}
        <div
          onClick={() => setActiveTab('resumen')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'resumen'
              ? 'border-[#0c323f] bg-white ring-2 ring-[#0c323f]/15 shadow-sm'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-100 text-amber-800 rounded-md">
                <ClipboardList className="w-4 h-4" />
              </span>
              <span className="font-bold text-xs uppercase tracking-wider text-neutral-700">
                3. RESUMEN PUNTOS
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                (data?.resumenPuntosRows.length || 0) > 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {(data?.resumenPuntosRows.length || 0) > 0 ? 'Conectado' : 'Vacío'}
            </span>
          </div>
          <div className="text-xl font-extrabold text-neutral-900">
            {data?.resumenPuntosRows.length || 0}{' '}
            <span className="text-xs font-medium text-neutral-500">categorías/subtotales</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
            Hoja: {data?.meta.sheetsMapped.resumen || 'Pendiente'}
          </p>
        </div>

        {/* Card 4: OBSERVACIONES 1 */}
        <div
          onClick={() => setActiveTab('observaciones')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'observaciones'
              ? 'border-[#0c323f] bg-white ring-2 ring-[#0c323f]/15 shadow-sm'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-rose-100 text-rose-800 rounded-md">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <span className="font-bold text-xs uppercase tracking-wider text-neutral-700">
                4. OBSERVACIONES 1
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                (data?.observacionesRows.length || 0) > 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {(data?.observacionesRows.length || 0) > 0 ? 'Conectado' : 'Vacío'}
            </span>
          </div>
          <div className="text-xl font-extrabold text-neutral-900">
            {data?.observacionesRows.length || 0}{' '}
            <span className="text-xs font-medium text-neutral-500">hallazgos / notas</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
            Hoja: {data?.meta.sheetsMapped.observaciones || 'Pendiente'}
          </p>
        </div>
      </div>

      {/* 4. TABS NAVIGATION & SEARCH BAR */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
        {/* Navigation Tabs Header */}
        <div className="border-b border-neutral-200 bg-neutral-50/70 px-4 pt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('bd')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'bd'
                  ? 'border-[#0c323f] text-[#0c323f] bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/70'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>1. Base de Datos (BD)</span>
              <span className="ml-1 text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded-full font-mono">
                {data?.bdRecords.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('est1')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'est1'
                  ? 'border-[#0c323f] text-[#0c323f] bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/70'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-indigo-600" />
              <span>2. Estación 1 (EST1)</span>
              <span className="ml-1 text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded-full font-mono">
                {data?.est1Records.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('resumen')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'resumen'
                  ? 'border-[#0c323f] text-[#0c323f] bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/70'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
              <span>3. Resumen Puntos</span>
              <span className="ml-1 text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded-full font-mono">
                {data?.resumenPuntosRows.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('observaciones')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'observaciones'
                  ? 'border-[#0c323f] text-[#0c323f] bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/70'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>4. Observaciones 1</span>
              <span className="ml-1 text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded-full font-mono">
                {data?.observacionesRows.length || 0}
              </span>
            </button>
          </div>

          {/* Quick sync current tab */}
          {activeTab === 'bd' && (data?.bdRecords.length || 0) > 0 && (
            <button
              onClick={handleDistributeAll}
              className="mb-2 text-xs font-bold text-white bg-[#0c323f] hover:bg-[#154655] px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Sincronizar BD con Módulo 2 y Supabase</span>
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="p-3 bg-white border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex-1 min-w-[240px] max-w-md relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar en esta sección por punto, criterio, estación, etc..."
              className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0c323f]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {activeTab === 'bd' && stationsInBD.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-neutral-500 font-medium">Estación:</label>
              <select
                value={selectedStationFilter}
                onChange={(e) => setSelectedStationFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-neutral-200 rounded-lg bg-neutral-50 text-xs focus:outline-none"
              >
                <option value="all">Todas ({stationsInBD.length})</option>
                {stationsInBD.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              <label className="text-neutral-500 font-medium ml-2">Mes:</label>
              <select
                value={selectedMonthFilter}
                onChange={(e) => setSelectedMonthFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-neutral-200 rounded-lg bg-neutral-50 text-xs focus:outline-none"
              >
                <option value="all">Todos ({monthsInBD.length})</option>
                {monthsInBD.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tab Body View */}
        <div className="p-4 sm:p-5">
          {!data ? (
            <div className="text-center py-16 space-y-3">
              <Layers className="w-12 h-12 text-neutral-300 mx-auto" />
              <h4 className="text-sm font-bold text-neutral-800">
                No hay datos cargados en el Importador Multisección
              </h4>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                Sube tu archivo de Excel arriba para que el sistema analice y separe automáticamente
                las 4 secciones (BD, EST1, RESUMEN PUNTOS y OBSERVACIONES 1).
              </p>
              <div className="pt-2">
                <button
                  onClick={() => downloadSampleMultiSectionTemplate()}
                  className="px-3.5 py-2 text-xs font-semibold text-[#0c323f] bg-cyan-50 hover:bg-cyan-100 rounded-lg border border-cyan-200 inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla de Ejemplo con 4 Secciones</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TAB 1: BD (Base de Datos) */}
              {activeTab === 'bd' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      Mostrando <strong>{filteredBDRecords.length}</strong> de{' '}
                      <strong>{data.bdRecords.length}</strong> registros
                    </span>
                    <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
                      Formato Columnar Módulo 2
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-neutral-200 rounded-lg max-h-[500px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0c323f] text-white sticky top-0 uppercase text-[10px] font-bold tracking-wider z-10">
                        <tr>
                          <th className="py-2.5 px-3">Concatenar</th>
                          <th className="py-2.5 px-3">Ciudad</th>
                          <th className="py-2.5 px-3">Estación</th>
                          <th className="py-2.5 px-3">Mes</th>
                          <th className="py-2.5 px-3">Año</th>
                          <th className="py-2.5 px-3">Punto a Revisar</th>
                          <th className="py-2.5 px-3 text-center">Calificación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredBDRecords.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-neutral-400">
                              No se encontraron registros en la sección BD con los filtros actuales.
                            </td>
                          </tr>
                        ) : (
                          filteredBDRecords.map((r, idx) => (
                            <tr
                              key={r.id || idx}
                              className="hover:bg-cyan-50/40 transition-colors"
                            >
                              <td className="py-2 px-3 font-mono text-[11px] text-neutral-600 whitespace-nowrap">
                                {r.concatenar}
                              </td>
                              <td className="py-2 px-3 font-medium text-neutral-800 whitespace-nowrap">
                                {r.ciudad}
                              </td>
                              <td className="py-2 px-3 font-semibold text-neutral-900 whitespace-nowrap">
                                {r.estacion}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span className="bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {r.mes}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-neutral-600 whitespace-nowrap">
                                {r.anio}
                              </td>
                              <td className="py-2 px-3 text-neutral-800 max-w-md truncate" title={r.punto}>
                                {r.punto}
                              </td>
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-block font-bold px-2 py-0.5 rounded text-xs ${
                                    r.calificacion === 'N/A'
                                      ? 'bg-neutral-200 text-neutral-700'
                                      : Number(r.calificacion) > 0
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {r.calificacion}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: EST1 (Estación 1) */}
              {activeTab === 'est1' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        Mostrando <strong>{filteredEst1Rows.length}</strong> de{' '}
                        <strong>{data.est1Records.length}</strong> filas
                      </span>
                      {data.meta.autoGeneratedFromBD && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium border border-emerald-200">
                          ✨ Generado automáticamente de BD
                        </span>
                      )}
                      <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono">
                        Estructura Seguimiento de Estación
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setTargetIndividualTab('est1');
                        individualFileInputRef.current?.click();
                      }}
                      className="text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Si tienes un archivo separado específicamente para EST1, cárgalo aquí"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir archivo individual para EST1</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-neutral-200 rounded-lg max-h-[500px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0c323f] text-white sticky top-0 uppercase text-[10px] font-bold tracking-wider z-10">
                        <tr>
                          {data.est1Headers.map((header, idx) => (
                            <th key={idx} className="py-2.5 px-3 whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredEst1Rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={Math.max(1, data.est1Headers.length)}
                              className="py-8 text-center text-neutral-400"
                            >
                              No hay registros en la sección EST1 o no coinciden con la búsqueda.
                            </td>
                          </tr>
                        ) : (
                          filteredEst1Rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-indigo-50/40 transition-colors">
                              {data.est1Headers.map((header, cIdx) => {
                                const val = row[header];
                                return (
                                  <td
                                    key={cIdx}
                                    className="py-2 px-3 text-neutral-800 whitespace-nowrap font-medium"
                                  >
                                    {val !== undefined && val !== null ? String(val) : '-'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: RESUMEN PUNTOS */}
              {activeTab === 'resumen' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        Mostrando <strong>{filteredResumenRows.length}</strong> de{' '}
                        <strong>{data.resumenPuntosRows.length}</strong> categorías/totales
                      </span>
                      {data.meta.autoGeneratedFromBD && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium border border-emerald-200">
                          ✨ Calculado automáticamente con fórmulas oficiales
                        </span>
                      )}
                      <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-mono">
                        Consolidado y Ponderaciones
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setTargetIndividualTab('resumen');
                        individualFileInputRef.current?.click();
                      }}
                      className="text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Si tienes un archivo separado específicamente para RESUMEN PUNTOS, cárgalo aquí"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir archivo individual para RESUMEN PUNTOS</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-neutral-200 rounded-lg max-h-[500px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0c323f] text-white sticky top-0 uppercase text-[10px] font-bold tracking-wider z-10">
                        <tr>
                          {data.resumenPuntosHeaders.map((header, idx) => (
                            <th key={idx} className="py-2.5 px-3 whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredResumenRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={Math.max(1, data.resumenPuntosHeaders.length)}
                              className="py-8 text-center text-neutral-400"
                            >
                              No hay registros en la sección RESUMEN PUNTOS o no coinciden con la búsqueda.
                            </td>
                          </tr>
                        ) : (
                          filteredResumenRows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-amber-50/40 transition-colors">
                              {data.resumenPuntosHeaders.map((header, cIdx) => {
                                const val = row[header];
                                const isPercent = String(val).includes('%');
                                const isScore = typeof val === 'number';
                                return (
                                  <td
                                    key={cIdx}
                                    className={`py-2 px-3 text-neutral-800 whitespace-nowrap ${
                                      isPercent || isScore ? 'font-bold' : 'font-medium'
                                    }`}
                                  >
                                    {val !== undefined && val !== null ? String(val) : '-'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: OBSERVACIONES 1 */}
              {activeTab === 'observaciones' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        Mostrando <strong>{filteredObservacionesRows.length}</strong> de{' '}
                        <strong>{data.observacionesRows.length}</strong> hallazgos y notas
                      </span>
                      {data.meta.autoGeneratedFromBD && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium border border-emerald-200">
                          ✨ Extraído de registros de BD
                        </span>
                      )}
                      <span className="text-[11px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-mono">
                        Hallazgos & Recomendaciones Técnicas
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setTargetIndividualTab('observaciones');
                        individualFileInputRef.current?.click();
                      }}
                      className="text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Si tienes un archivo separado específicamente para OBSERVACIONES 1, cárgalo aquí"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir archivo individual para OBSERVACIONES 1</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-neutral-200 rounded-lg max-h-[500px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0c323f] text-white sticky top-0 uppercase text-[10px] font-bold tracking-wider z-10">
                        <tr>
                          {data.observacionesHeaders.map((header, idx) => (
                            <th key={idx} className="py-2.5 px-3 whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredObservacionesRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={Math.max(1, data.observacionesHeaders.length)}
                              className="py-8 text-center text-neutral-400"
                            >
                              No hay registros en la sección OBSERVACIONES 1 o no coinciden con la búsqueda.
                            </td>
                          </tr>
                        ) : (
                          filteredObservacionesRows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-rose-50/40 transition-colors">
                              {data.observacionesHeaders.map((header, cIdx) => {
                                const val = row[header];
                                const isPriority =
                                  String(header).toLowerCase().includes('prior') ||
                                  String(header).toLowerCase().includes('nivel');
                                return (
                                  <td
                                    key={cIdx}
                                    className="py-2 px-3 text-neutral-800 whitespace-nowrap font-medium"
                                  >
                                    {isPriority ? (
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          String(val).toLowerCase().includes('alta') ||
                                          String(val).toLowerCase().includes('critic')
                                            ? 'bg-rose-100 text-rose-800'
                                            : String(val).toLowerCase().includes('media')
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                      >
                                        {String(val || '-')}
                                      </span>
                                    ) : (
                                      <span>{val !== undefined && val !== null ? String(val) : '-'}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 5. MODAL: BORRAR Y LIMPIAR CACHÉ */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-lg shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  ¿Borrar registros y limpiar la caché?
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Esta acción eliminará todos los registros cargados en el Importador Multisección y
                  limpiará el caché del navegador para permitir subir un archivo nuevo desde cero.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Los registros que ya hayas distribuido a la base general de la plataforma se mantendrán
                a salvo a menos que los borres explícitamente desde los módulos 1, 2 o 3.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearAllData}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                Sí, borrar y limpiar caché
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: MAPEO DE HOJAS PERSONALIZADO */}
      {showMappingModal && data && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#0c323f]" />
                <span>Mapeo de Hojas del Archivo Excel</span>
              </h3>
              <button
                onClick={() => setShowMappingModal(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              El sistema detectó las siguientes hojas en tu archivo. Puedes reasignar cuál hoja
              corresponde a cada uno de los 4 módulos:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  1. Sección BD (Base de Datos):
                </label>
                <select
                  value={customMapping.bd || data.meta.sheetsMapped.bd || ''}
                  onChange={(e) => setCustomMapping((prev) => ({ ...prev, bd: e.target.value }))}
                  className="w-full p-2 border border-neutral-300 rounded-lg bg-neutral-50"
                >
                  {data.sheetNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  2. Sección EST1 (Estación 1):
                </label>
                <select
                  value={customMapping.est1 || data.meta.sheetsMapped.est1 || ''}
                  onChange={(e) => setCustomMapping((prev) => ({ ...prev, est1: e.target.value }))}
                  className="w-full p-2 border border-neutral-300 rounded-lg bg-neutral-50"
                >
                  {data.sheetNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  3. Sección RESUMEN PUNTOS:
                </label>
                <select
                  value={customMapping.resumen || data.meta.sheetsMapped.resumen || ''}
                  onChange={(e) => setCustomMapping((prev) => ({ ...prev, resumen: e.target.value }))}
                  className="w-full p-2 border border-neutral-300 rounded-lg bg-neutral-50"
                >
                  {data.sheetNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  4. Sección OBSERVACIONES 1:
                </label>
                <select
                  value={customMapping.observaciones || data.meta.sheetsMapped.observaciones || ''}
                  onChange={(e) =>
                    setCustomMapping((prev) => ({ ...prev, observaciones: e.target.value }))
                  }
                  className="w-full p-2 border border-neutral-300 rounded-lg bg-neutral-50"
                >
                  {data.sheetNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowMappingModal(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0c323f] hover:bg-[#154655] rounded-lg transition-colors cursor-pointer"
              >
                Cerrar y Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
