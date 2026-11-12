import { MonthName, RubroItem, StationEvaluationRecord } from '../types';
import { RUBROS_META, RUBRO_ITEMS } from '../data/initialData';

export interface SectionCalculationResult {
  rubroId: number;
  rubroName: string;
  norma: string;
  baseMaxPoints: number;
  puntosObtenidos: number;
  maxTeorico: number;
  maxAplicable: number;
  naCount: number;
  evaluatedCount: number;
  pctCumplimiento: number;
  puntosPonderados: number;
}

export interface StationOverallCalculationResult {
  stationName: string;
  month: MonthName;
  year: number;
  sections: SectionCalculationResult[];
  totalPuntosObtenidos: number;
  totalMaxTeorico: number;
  totalMaxAplicable: number;
  totalPuntosPonderados: number;
  calificacionFinal: number; // 0-100 scale
  estatus: 'Cumple' | 'Observación' | 'Crítico';
}

export function normalizeMonthName(m?: string): string {
  if (!m) return '';
  const clean = m
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (clean === 'SETIEMBRE' || clean === 'SEPTIEMBRE' || clean === 'SEP') return 'SEPTIEMBRE';
  if (clean === 'OCTUBRE' || clean === 'OCT') return 'OCTUBRE';
  if (clean === 'NOVIEMBRE' || clean === 'NOV') return 'NOVIEMBRE';
  if (clean === 'DICIEMBRE' || clean === 'DIC') return 'DICIEMBRE';
  if (clean === 'ENERO' || clean === 'ENE') return 'ENERO';
  if (clean === 'FEBRERO' || clean === 'FEB') return 'FEBRERO';
  if (clean === 'MARZO' || clean === 'MAR') return 'MARZO';
  if (clean === 'ABRIL' || clean === 'ABR') return 'ABRIL';
  if (clean === 'MAYO' || clean === 'MAY') return 'MAYO';
  if (clean === 'JUNIO' || clean === 'JUN') return 'JUNIO';
  if (clean === 'JULIO' || clean === 'JUL') return 'JULIO';
  if (clean === 'AGOSTO' || clean === 'AGO') return 'AGOSTO';
  return clean;
}

export function cleanTextForMatch(s: string): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!"“”'«»_.,:;\-–—()[\]{}/\\#*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isMatchingRubroItem(rPunto: string, item: RubroItem): boolean {
  if (!rPunto || !item) return false;
  const rawPunto = rPunto.trim();
  const cleanP = cleanTextForMatch(rawPunto);
  const cleanDesc = cleanTextForMatch(item.description);

  if (!cleanP || !cleanDesc) return false;

  // 1. Exact or contains match on cleaned descriptions
  if (cleanP === cleanDesc) return true;
  if (cleanP.includes(cleanDesc)) return true;
  if (cleanDesc.includes(cleanP) && cleanP.length >= 15) return true;

  // 2. ID matching with discrete boundary (e.g. "1.1", "1.1.", "1.1 -", "Punto 1.1")
  // Do NOT match "1.1" against "1.10", "1.11", etc.
  if (item.id) {
    const escapedId = item.id.replace('.', '\\.');
    const idRegex = new RegExp(`(^|[^0-9.])${escapedId}([^0-9.]|$)`, 'i');
    if (idRegex.test(rawPunto)) {
      return true;
    }
  }

  // 3. Prefix matching: first 22 chars of clean description
  const prefix = cleanDesc.slice(0, 22).trim();
  if (prefix.length >= 12 && cleanP.includes(prefix)) {
    // If it's one of the "estacion cuenta con senalamiento" items, disambiguate with keywords!
    if (prefix.startsWith('estacion cuenta con senal') || prefix.startsWith('estacion cuenta con let')) {
      if (cleanDesc.includes('fumar') && cleanP.includes('fumar')) return true;
      if (cleanDesc.includes('estacionarse') && cleanP.includes('estacionarse')) return true;
      if (cleanDesc.includes('inflamable') && cleanP.includes('inflamable')) return true;
      if (cleanDesc.includes('autorizadas') && cleanP.includes('autorizadas')) return true;
      if (cleanDesc.includes('fuego') && cleanP.includes('fuego')) return true;
      if (cleanDesc.includes('velocidad') && cleanP.includes('velocidad')) return true;
      if (cleanDesc.includes('procedimiento operativo') && cleanP.includes('procedimiento')) return true;
      if (cleanDesc.includes('personas a bordo') && cleanP.includes('bordo')) return true;
      return false; // don't blindly match the first one!
    }
    return true;
  }

  // 4. Disambiguation for specific items with unique keywords
  if (cleanDesc.includes('luquatite') && cleanP.includes('luquatite')) return true;
  if (cleanDesc.includes('peinados') && cleanP.includes('peinados')) return true;
  if (cleanDesc.includes('pastillas') && cleanP.includes('pastillas')) return true;
  if (cleanDesc.includes('hongo') && cleanP.includes('hongo')) return true;
  if (cleanDesc.includes('marchamo') && cleanP.includes('marchamo')) return true;
  if (cleanDesc.includes('alarma sonora') && cleanP.includes('alarma sonora')) return true;
  if (cleanDesc.includes('isleta') && cleanDesc.includes('paro') && cleanP.includes('isleta')) return true;
  if (cleanDesc.includes('oficina') && cleanDesc.includes('paro') && cleanP.includes('oficina')) return true;

  return false;
}

export function normalizeStationName(st: string): string {
  if (!st) return '';
  return st
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^mochis(\s*[-_–—]\s*|\s+)/i, '')
    .replace(/^estaci[oó]n(\s+de\s+servicio)?(\s*[-_–—]\s*|\s+)/i, '')
    .replace(/^e\.?s\.?\s*\d*(\s*[-_–—]\s*|\s+)/i, '')
    .replace(/[\-_/.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSameStation(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const rawA = a.trim().toLowerCase();
  const rawB = b.trim().toLowerCase();
  if (rawA === rawB) return true;
  // Si uno es 'general', solo coincide si ambos son idénticos
  if (rawA === 'general' || rawB === 'general') return false;

  const normA = normalizeStationName(a);
  const normB = normalizeStationName(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  const noSpaceA = normA.replace(/\s+/g, '');
  const noSpaceB = normB.replace(/\s+/g, '');
  if (noSpaceA === noSpaceB) return true;
  if (normA.length >= 4 && normB.includes(normA) && (normB.startsWith(normA) || normB.endsWith(normA))) return true;
  if (normB.length >= 4 && normA.includes(normB) && (normA.startsWith(normB) || normA.endsWith(normB))) return true;
  return false;
}


/**
 * Calculates a single section ("sandwichito") following the exact client formula:
 * 1. Puntos Obtenidos: SUM(calificaciones numéricas de la sección)
 * 2. Max Aplicable: SUM(puntos máximos de preguntas que NO sean 'N/A') -> Se descuenta el N/A
 * 3. Regla de Tres: % Cumplimiento = (Puntos Obtenidos / Max Aplicable) * 100
 * 4. Puntos Ponderados: (% Cumplimiento / 100) * baseMaxPoints de la sección
 */
export function calculateSectionStats(
  items: RubroItem[],
  stationRecords: StationEvaluationRecord[],
  month: MonthName,
  rubroId: number,
  baseMaxPoints: number,
  rubroName: string,
  norma: string,
  year?: number | string
): SectionCalculationResult {
  let puntosObtenidos = 0;
  let maxTeorico = 0;
  let maxAplicable = 0;
  let naCount = 0;
  let evaluatedCount = 0;

  const targetMes = normalizeMonthName(month);

  items.forEach((item) => {
    if (item.isInformative) return;
    maxTeorico += item.maxPoints;

    const rec = stationRecords.find((r) => {
      if (!r) return false;
      const rMes = normalizeMonthName(r.mes);
      if (rMes && targetMes && rMes !== targetMes) return false;
      if (year && year !== 'ALL' && r.anio && String(r.anio) !== String(year)) return false;

      return isMatchingRubroItem(r.punto, item);
    });

    const val = rec !== undefined ? rec.calificacion : null;

    if (val === 'N/A' || val === 'NA') {
      naCount++;
      // Excluido de maxAplicable (no se toma como cero, se redistribuye mediante regla de tres)
    } else if (typeof val === 'number') {
      puntosObtenidos += val;
      maxAplicable += item.maxPoints;
      evaluatedCount++;
    } else if (val !== null && val !== undefined && val !== '-' && !isNaN(Number(val))) {
      const num = Number(val);
      puntosObtenidos += num;
      maxAplicable += item.maxPoints;
      evaluatedCount++;
    }
  });

  const pctCumplimiento =
    maxAplicable > 0
      ? Math.round((puntosObtenidos / maxAplicable) * 1000) / 10
      : (evaluatedCount === 0 && naCount === 0 ? 0 : 100);

  const puntosPonderados =
    maxAplicable > 0
      ? Math.round(((pctCumplimiento / 100) * baseMaxPoints) * 10) / 10
      : (evaluatedCount === 0 && naCount === 0 ? 0 : baseMaxPoints);

  return {
    rubroId,
    rubroName,
    norma,
    baseMaxPoints,
    puntosObtenidos: parseFloat(puntosObtenidos.toFixed(1)),
    maxTeorico,
    maxAplicable,
    naCount,
    evaluatedCount,
    pctCumplimiento,
    puntosPonderados,
  };
}

/**
 * Calculates the overall station score by consolidating all 6 sections
 * exactly as structured in the client's Excel:
 * Sum of all section weighted totals -> Final score
 */
export function calculateStationOverall(
  stationName: string,
  records: StationEvaluationRecord[],
  month: MonthName = 'SEPTIEMBRE',
  year?: number | string
): StationOverallCalculationResult {
  // Filter records specifically for this station if records contain multiple stations
  const targetYear = year === undefined ? 'ALL' : year;
  const stationRecords = stationName
    ? records.filter((r) => {
        if (!isSameStation(r.estacion, stationName)) return false;
        if (targetYear !== 'ALL' && r.anio && String(r.anio) !== String(targetYear)) return false;
        return true;
      })
    : records;

  const sections: SectionCalculationResult[] = [];
  let totalPuntosObtenidos = 0;
  let totalMaxTeorico = 0;
  let totalMaxAplicable = 0;
  let totalPuntosPonderados = 0;

  RUBROS_META.forEach((meta) => {
    const items = RUBRO_ITEMS.filter((i) => i.rubroId === meta.id);
    const secResult = calculateSectionStats(
      items,
      stationRecords,
      month,
      meta.id,
      meta.maxPoints,
      meta.name,
      meta.norma,
      targetYear
    );

    sections.push(secResult);
    totalPuntosObtenidos += secResult.puntosObtenidos;
    totalMaxTeorico += secResult.maxTeorico;
    totalMaxAplicable += secResult.maxAplicable;
    totalPuntosPonderados += secResult.puntosPonderados;
  });

  // Score normalized to standard 100 scale based on weighted sections (sum of baseMaxPoints is 106)
  const grandBaseMax = RUBROS_META.reduce((acc, curr) => acc + curr.maxPoints, 0); // 106
  const calificacionFinal =
    grandBaseMax > 0
      ? Math.round((totalPuntosPonderados / grandBaseMax) * 100)
      : 0;

  const estatus: 'Cumple' | 'Observación' | 'Crítico' =
    calificacionFinal >= 85
      ? 'Cumple'
      : calificacionFinal >= 80
      ? 'Observación'
      : 'Crítico';

  return {
    stationName,
    month,
    year: typeof targetYear === 'number' ? targetYear : 2026,
    sections,
    totalPuntosObtenidos: parseFloat(totalPuntosObtenidos.toFixed(1)),
    totalMaxTeorico,
    totalMaxAplicable,
    totalPuntosPonderados: parseFloat(totalPuntosPonderados.toFixed(1)),
    calificacionFinal,
    estatus,
  };
}

/**
 * Conditional Formatting Cell Style Helper:
 * - 0: ROJO INTENSO con letra BLANCA ("¡Híjole, sacamos un cero!")
 * - 0 < score < maxPoints: NARANJA con letra blanca/contrastante (Observación / Hallazgo menor)
 * - score == maxPoints: BLANCO (limpio, sin alerta de riesgo)
 * - score == 'N/A': GRIS SUAVE (no aplica, no penaliza)
 * - empty / '-': NEUTRO
 */
export function getScoreCellFormat(
  calif: number | string | null | undefined,
  maxPoints: number,
  isInformative: boolean = false
): {
  bgClass: string;
  textClass: string;
  badgeText: string;
  isZero: boolean;
  isPartial: boolean;
  isMax: boolean;
  isNA: boolean;
  tooltipText: string;
} {
  if (isInformative || maxPoints === 0) {
    return {
      bgClass: 'bg-neutral-50/70',
      textClass: 'text-neutral-700 font-mono font-medium',
      badgeText: calif !== null && calif !== undefined ? String(calif) : '-',
      isZero: false,
      isPartial: false,
      isMax: false,
      isNA: false,
      tooltipText: 'Campo informativo de auditoría',
    };
  }

  if (calif === 'N/A' || calif === 'NA') {
    return {
      bgClass: 'bg-neutral-100 text-neutral-600',
      textClass: 'text-neutral-600 font-bold italic text-[11px]',
      badgeText: 'N/A',
      isZero: false,
      isPartial: false,
      isMax: false,
      isNA: true,
      tooltipText: 'No Aplica: Excluido de la base y redistribuido por regla de tres',
    };
  }

  if (calif === '-' || calif === null || calif === undefined || calif === '') {
    return {
      bgClass: 'bg-transparent',
      textClass: 'text-neutral-400 font-mono',
      badgeText: '-',
      isZero: false,
      isPartial: false,
      isMax: false,
      isNA: false,
      tooltipText: 'Sin evaluación registrada en este periodo',
    };
  }

  const num = typeof calif === 'number' ? calif : Number(calif);

  if (isNaN(num)) {
    return {
      bgClass: 'bg-neutral-50',
      textClass: 'text-neutral-700 font-mono',
      badgeText: String(calif),
      isZero: false,
      isPartial: false,
      isMax: false,
      isNA: false,
      tooltipText: String(calif),
    };
  }

  // 1. CERO (0) -> ROJO INTENSO con letra BLANCA en negrita
  if (num === 0) {
    return {
      bgClass: 'bg-red-600 text-white font-black shadow-xs ring-1 ring-red-700',
      textClass: 'text-white font-extrabold',
      badgeText: '0',
      isZero: true,
      isPartial: false,
      isMax: false,
      isNA: false,
      tooltipText: `Cero crítico (0 de ${maxPoints} pts) - No cumple`,
    };
  }

  // 2. PARCIAL (0 < num < maxPoints) -> NARANJA con letra contrastante
  if (num > 0 && num < maxPoints) {
    return {
      bgClass: 'bg-amber-500 text-white font-bold shadow-2xs ring-1 ring-amber-600',
      textClass: 'text-white font-bold',
      badgeText: String(num),
      isZero: false,
      isPartial: true,
      isMax: false,
      isNA: false,
      tooltipText: `Cumplimiento parcial (${num} de ${maxPoints} pts)`,
    };
  }

  // 3. PUNTO MÁXIMO (num >= maxPoints) -> BLANCO (limpio, cumple al 100%)
  return {
    bgClass: 'bg-white text-neutral-900 border border-neutral-200/90 hover:bg-neutral-50',
    textClass: 'text-neutral-900 font-bold',
    badgeText: String(num),
    isZero: false,
    isPartial: false,
    isMax: true,
    isNA: false,
    tooltipText: `Cumplimiento total (${num} de ${maxPoints} pts)`,
  };
}
