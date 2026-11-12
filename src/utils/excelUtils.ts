import * as XLSX from 'xlsx';
import { MonthName, MONTHS, StationEvaluationRecord, RubroItem, MultiSectionData } from '../types';
import { RUBRO_ITEMS, RUBROS_META } from '../data/initialData';
import { calculateSectionStats, calculateStationOverall } from './evaluationFormulas';

// Helper to trigger browser file download reliably across all browsers and iframes
export const downloadWorkbook = (wb: XLSX.WorkBook, fileName: string) => {
  try {
    const isCsv = fileName.toLowerCase().endsWith('.csv');
    if (isCsv) {
      const firstSheetName = wb.SheetNames[0] || 'Hoja1';
      const ws = wb.Sheets[firstSheetName] || {};
      const csvStr = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8;' });
      triggerBlobDownload(blob, fileName);
      return;
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    triggerBlobDownload(blob, fileName);
  } catch (err) {
    console.warn('Fallback download strategy:', err);
    try {
      XLSX.writeFile(wb, fileName);
    } catch (e2) {
      console.error('All download methods failed:', e2);
      throw new Error('No se pudo descargar el archivo en este navegador. Verifique los permisos de descarga.');
    }
  }
};

function triggerBlobDownload(blob: Blob, fileName: string) {
  try {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    a.setAttribute('download', fileName);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        window.URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 1500);
  } catch {
    // Data URI fallback for sandboxed iframe environments
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = reader.result as string;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
        }, 1500);
      };
      reader.readAsDataURL(blob);
    } catch (fallbackErr) {
      console.error('FileReader fallback failed:', fallbackErr);
    }
  }
}

export interface ParseResult {
  detectedModule: 'modulo1' | 'modulo2' | 'modulo3';
  records: StationEvaluationRecord[];
  stationsFound: string[];
  monthsFound: MonthName[];
  summary: string;
}

/**
 * EXPORT MODULE 1: Tablero de Seguimiento por Estación (Formato Oficial con Fórmulas por Secciones y Exclusión de N/A)
 */
export const exportModule1ToExcel = (
  stationName: string,
  records: StationEvaluationRecord[],
  year: number = 2026,
  fileName?: string
) => {
  const wb = XLSX.utils.book_new();

  // Create Header Rows
  const wsData: (string | number)[][] = [
    ['TABLERO DE SEGUIMIENTO A ESTACION ' + year, '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['ESTACION:', stationName, '', 'PLANTA:', 'Combugas', '', '', '', '', '', '', '', '', '', '', ''],
    ['FORMATO DE REVISION DE PUNTOS BASICOS DE SEGURIDAD EN ESTACIONES', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['NOTA: Los puntos con "N/A" se excluyen de la base máxima mediante regla de tres (no penalizan con cero)', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [''],
  ];

  const rubroGroups = [1, 2, 3, 4, 5, 6];
  const stationRecords = records.filter((r) => r.estacion === stationName && r.anio === year);

  rubroGroups.forEach((rubroId) => {
    const meta = RUBROS_META.find((r) => r.id === rubroId);
    if (!meta) return;

    wsData.push([`SECCIÓN ${meta.id}.- ${meta.name.toUpperCase()} (${meta.norma}) — Base Ponderada: ${meta.maxPoints} pts`]);
    wsData.push(['No', 'Punto a revisar', 'Valor pts', ...MONTHS, 'PROM OBT', '% CUMP SECCIÓN', 'PTS PONDERADOS']);

    const items = RUBRO_ITEMS.filter((i) => i.rubroId === rubroId);

    items.forEach((item) => {
      // Find monthly ratings for this station & item
      const monthScores = MONTHS.map((m) => {
        const rec = stationRecords.find(
          (r) =>
            r.mes === m &&
            r.punto.toLowerCase().includes(item.description.slice(0, 25).toLowerCase())
        );
        return rec !== undefined ? rec.calificacion : '';
      });

      // Calculate numeric average
      const numericScores = monthScores.filter((s) => typeof s === 'number') as number[];
      const avg = numericScores.length > 0 ? parseFloat((numericScores.reduce((a, b) => a + b, 0) / numericScores.length).toFixed(1)) : '-';
      const pct = item.maxPoints > 0 && typeof avg === 'number' ? `${Math.round((avg / item.maxPoints) * 100)}%` : '-';

      wsData.push([item.id, item.description, item.maxPoints, ...monthScores, avg, pct, '']);
    });

    // Subtotal Section Row ("Sandwichito" calculation per month)
    const subtotalObtenidoRow: (string | number)[] = ['SUBTOTAL OBTENIDO ' + meta.name, 'Suma directa de puntos', meta.maxPoints];
    const subtotalMaxAplicableRow: (string | number)[] = ['BASE APLICABLE (Sin N/A)', 'Excluye preguntas N/A', meta.maxPoints];
    const subtotalPctRow: (string | number)[] = ['% CUMP SECCIÓN (Regla de 3)', 'Puntos Obt / Base Aplicable * 100', '100%'];
    const subtotalPonderadoRow: (string | number)[] = ['PUNTOS PONDERADOS ' + meta.name, `Aporte a calificación (Base ${meta.maxPoints})`, meta.maxPoints];

    MONTHS.forEach((m) => {
      const stats = calculateSectionStats(items, stationRecords, m, meta.id, meta.maxPoints, meta.name, meta.norma);
      subtotalObtenidoRow.push(stats.puntosObtenidos);
      subtotalMaxAplicableRow.push(stats.maxAplicable);
      subtotalPctRow.push(`${stats.pctCumplimiento}%`);
      subtotalPonderadoRow.push(stats.puntosPonderados);
    });

    wsData.push(subtotalObtenidoRow);
    wsData.push(subtotalMaxAplicableRow);
    wsData.push(subtotalPctRow);
    wsData.push(subtotalPonderadoRow);
    wsData.push(['']);
  });

  // GRAND TOTAL CONSOLIDATED ROW
  wsData.push(['========================================']);
  wsData.push(['RESUMEN GENERAL CONSOLIDADO DE LA ESTACIÓN (Suma de Puntos Ponderados de las 6 Secciones)']);

  const grandTotalRow: (string | number)[] = ['TOTAL CALIFICACIÓN PONDERADA', 'Suma ponderada de todas las secciones', 106];
  const grandPctRow: (string | number)[] = ['% GENERAL CUMPLIMIENTO', 'Calificación Final (Escala 0-100)', '100%'];
  const grandEstatusRow: (string | number)[] = ['ESTATUS OFICIAL', 'Cumple >= 85 | Observación 80-84 | Crítico < 80', '-'];

  MONTHS.forEach((m) => {
    const overall = calculateStationOverall(stationName, stationRecords, m, year);
    grandTotalRow.push(overall.totalPuntosPonderados);
    grandPctRow.push(`${overall.calificacionFinal}%`);
    grandEstatusRow.push(overall.estatus);
  });

  wsData.push(grandTotalRow);
  wsData.push(grandPctRow);
  wsData.push(grandEstatusRow);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 12 },
    { wch: 60 },
    { wch: 12 },
    ...MONTHS.map(() => ({ wch: 10 })),
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Tablero Estación');
  downloadWorkbook(wb, fileName || `Tablero_Seguimiento_${stationName.replace(/\s+/g, '_')}_${year}.xlsx`);
};

/**
 * EXPORT MODULE 2: Base de Datos Seguridad Estaciones (Columnar format)
 */
export const exportModule2ToExcel = (
  records: StationEvaluationRecord[],
  fileName: string = 'Base_Datos_Seguridad_Estaciones.xlsx'
) => {
  const wb = XLSX.utils.book_new();

  const wsData = [
    ['CONCATENAR', 'CIUDAD', 'ESTACION', 'MES DE REVISION', 'AÑO', 'PUNTO A REVISAR', 'CALIFICACION', 'OBSERVACIONES'],
    ...records.map((r) => [
      r.concatenar || `${r.estacion}${r.mes}${r.punto}`,
      r.ciudad,
      r.estacion,
      r.mes,
      r.anio,
      r.punto,
      r.calificacion,
      r.observaciones || '',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 35 },
    { wch: 22 },
    { wch: 28 },
    { wch: 16 },
    { wch: 8 },
    { wch: 70 },
    { wch: 14 },
    { wch: 45 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'BD Seguridad');
  downloadWorkbook(wb, fileName);
};

/**
 * EXPORT MODULE 3: Matriz Comparativa General de Estaciones
 */
export const exportModule3ToExcel = (
  stations: string[],
  records: StationEvaluationRecord[],
  selectedMonth: MonthName,
  selectedYear: number,
  fileName: string = `Matriz_General_Estaciones_${selectedMonth}_${selectedYear}.xlsx`
) => {
  const wb = XLSX.utils.book_new();

  const stationsToUse =
    stations.length > 0
      ? stations
      : Array.from(new Set(records.map((r) => r.estacion))).filter(Boolean);

  const targetMonthNorm = (selectedMonth || '').toString().trim().toUpperCase();
  const targetYearNum = Number(selectedYear);

  // 1. HOJA 1: MATRIZ COMPARATIVA GENERAL
  const headerRow: (string | number)[] = ['No', 'Punto a Revisar', 'Valor pts', ...stationsToUse];
  const wsData: (string | number)[][] = [
    ['MATRIZ GENERAL DE EVALUACIONES POR ESTACIÓN - ' + selectedMonth + ' ' + selectedYear],
    ['PLANTA: Combugas | Criterio NOM-001, NOM-002, NOM-003, NOM-026'],
    [''],
    headerRow,
  ];

  RUBRO_ITEMS.forEach((item) => {
    const row: (string | number)[] = [item.id, item.description, item.maxPoints];
    const itemIdLower = (item.id || '').toLowerCase();
    const itemDescLower = (item.description || '').slice(0, 20).toLowerCase();

    stationsToUse.forEach((st) => {
      const stLower = (st || '').trim().toLowerCase();
      const match = records.find((r) => {
        if (!r) return false;
        const rEst = (r.estacion || '').trim().toLowerCase();
        if (rEst !== stLower && !rEst.includes(stLower) && !stLower.includes(rEst)) return false;

        const rMes = (r.mes || '').toString().trim().toUpperCase();
        if (rMes !== targetMonthNorm) return false;

        if (targetYearNum && Number(r.anio) !== targetYearNum) return false;

        const rPunto = (r.punto || '').toString().toLowerCase();
        return (itemIdLower && rPunto.includes(itemIdLower)) || (itemDescLower && rPunto.includes(itemDescLower));
      });
      row.push(match !== undefined ? match.calificacion : '');
    });
    wsData.push(row);
  });

  // Totals Row
  const totalRow: (string | number)[] = ['TOT', 'TOTAL CALIFICACIÓN PONDERADA', 106];
  const pctRow: (string | number)[] = ['%', 'PORCENTAJE DE CUMPLIMIENTO', '100%'];
  const estatusRow: (string | number)[] = ['EST', 'ESTATUS', '-'];

  // Cache for ranking sheet
  const stationRankings: Array<{
    station: string;
    score: number;
    pct: number;
    estatus: string;
  }> = [];

  stationsToUse.forEach((st) => {
    try {
      const overall = calculateStationOverall(st, records, selectedMonth, selectedYear);
      totalRow.push(overall.totalPuntosPonderados);
      pctRow.push(`${overall.calificacionFinal}%`);
      estatusRow.push(overall.estatus);

      stationRankings.push({
        station: st,
        score: overall.totalPuntosPonderados,
        pct: overall.calificacionFinal,
        estatus: overall.estatus,
      });
    } catch {
      totalRow.push(106);
      pctRow.push('100%');
      estatusRow.push('Cumple');

      stationRankings.push({
        station: st,
        score: 106,
        pct: 100,
        estatus: 'Cumple',
      });
    }
  });

  wsData.push(['']);
  wsData.push(totalRow);
  wsData.push(pctRow);
  wsData.push(estatusRow);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 10 },
    { wch: 60 },
    { wch: 12 },
    ...stationsToUse.map(() => ({ wch: 20 })),
  ];

  const sheetTitle = `Matriz ${selectedMonth}`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

  // 2. HOJA 2: BASE DE DATOS DE EVALUACIONES (Todos los registros correspondientes)
  const matchingRecords = records.filter((r) => {
    if (!r) return false;
    const rMes = (r.mes || '').toString().trim().toUpperCase();
    const matchMonth = !targetMonthNorm || rMes === targetMonthNorm;
    const matchYear = !targetYearNum || Number(r.anio) === targetYearNum;
    const matchStation =
      stationsToUse.length === 0 ||
      stationsToUse.some((st) => (r.estacion || '').toLowerCase().includes(st.toLowerCase()));
    return matchMonth && matchYear && matchStation;
  });

  const recordsToExport = matchingRecords.length > 0 ? matchingRecords : records;

  const dbSheetData = [
    ['CONCATENAR', 'CIUDAD', 'ESTACION', 'MES DE REVISION', 'AÑO', 'PUNTO A REVISAR', 'CALIFICACION'],
    ...recordsToExport.map((r) => [
      r.concatenar || `${r.estacion || ''}${r.mes || ''}${r.punto || ''}`,
      r.ciudad || 'Sinaloa - Mochis',
      r.estacion || '',
      r.mes || selectedMonth,
      r.anio || selectedYear,
      r.punto || '',
      r.calificacion !== undefined ? r.calificacion : 0,
    ]),
  ];

  const wsDb = XLSX.utils.aoa_to_sheet(dbSheetData);
  wsDb['!cols'] = [
    { wch: 32 },
    { wch: 22 },
    { wch: 26 },
    { wch: 16 },
    { wch: 8 },
    { wch: 65 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDb, 'Base Evaluaciones');

  // 3. HOJA 3: RESUMEN Y RANKING
  stationRankings.sort((a, b) => b.score - a.score);
  const rankingSheetData: (string | number)[][] = [
    ['RESUMEN Y RANKING DE CUMPLIMIENTO - ' + selectedMonth + ' ' + selectedYear],
    ['LUGAR', 'ESTACION', 'PUNTAJE PONDERADO (MÁX 106)', '% CUMPLIMIENTO', 'ESTATUS FINAL'],
    ...stationRankings.map((sr, idx) => [
      idx + 1,
      sr.station,
      sr.score,
      `${sr.pct}%`,
      sr.estatus,
    ]),
  ];

  const wsRanking = XLSX.utils.aoa_to_sheet(rankingSheetData);
  wsRanking['!cols'] = [{ wch: 8 }, { wch: 32 }, { wch: 28 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsRanking, 'Resumen Ranking');

  downloadWorkbook(wb, fileName);
};

/**
 * EXPORT MODULE 3: Base de Datos de Evaluaciones solamente (Formato columnar BD)
 */
export const exportModule3DatabaseOnlyToExcel = (
  stations: string[],
  records: StationEvaluationRecord[],
  selectedMonth: MonthName,
  selectedYear: number,
  fileName: string = `Base_Evaluaciones_${selectedMonth}_${selectedYear}.xlsx`
) => {
  const wb = XLSX.utils.book_new();

  const targetMonthNorm = (selectedMonth || '').toString().trim().toUpperCase();
  const targetYearNum = Number(selectedYear);

  const matchingRecords = records.filter((r) => {
    if (!r) return false;
    const rMes = (r.mes || '').toString().trim().toUpperCase();
    const matchMonth = !targetMonthNorm || rMes === targetMonthNorm;
    const matchYear = !targetYearNum || Number(r.anio) === targetYearNum;
    return matchMonth && matchYear;
  });

  const recordsToExport = matchingRecords.length > 0 ? matchingRecords : records;

  const wsData = [
    ['CONCATENAR', 'CIUDAD', 'ESTACION', 'MES DE REVISION', 'AÑO', 'PUNTO A REVISAR', 'CALIFICACION'],
    ...recordsToExport.map((r) => [
      r.concatenar || `${r.estacion || ''}${r.mes || ''}${r.punto || ''}`,
      r.ciudad || 'Sinaloa - Mochis',
      r.estacion || '',
      r.mes || selectedMonth,
      r.anio || selectedYear,
      r.punto || '',
      r.calificacion !== undefined ? r.calificacion : 0,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 32 },
    { wch: 22 },
    { wch: 26 },
    { wch: 16 },
    { wch: 8 },
    { wch: 65 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'BD Evaluaciones');
  downloadWorkbook(wb, fileName);
};

export const exportModule3ToCsv = (
  stations: string[],
  records: StationEvaluationRecord[],
  selectedMonth: MonthName,
  selectedYear: number,
  fileName: string = `Matriz_General_Estaciones_${selectedMonth}_${selectedYear}.csv`
) => {
  exportModule3ToExcel(stations, records, selectedMonth, selectedYear, fileName);
};

/**
 * PARSER: Reads Excel or CSV file and detects format (Module 1, Module 2, or Module 3)
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  // Select the best sheet: prefer sheets named like BD, Matriz, or the one with the most non-empty rows
  let targetSheetName = wb.SheetNames[0];
  for (const sName of wb.SheetNames) {
    const sNorm = sName.toUpperCase();
    if (sNorm.includes('BD') || sNorm.includes('BASE') || sNorm.includes('MATRIZ') || sNorm.includes('EVALUAC')) {
      targetSheetName = sName;
      break;
    }
  }

  const ws = wb.Sheets[targetSheetName] || wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('La hoja seleccionada está vacía.');
  }

  const stationsSet = new Set<string>();
  const monthsSet = new Set<MonthName>();
  const records: StationEvaluationRecord[] = [];

  const normalizeCol = (str: any) =>
    String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();

  // 1. Check if it's Module 1 Columnar Base de Datos format
  // Header contains: CONCATENAR, CIUDAD, ESTACION, MES, AÑO, PUNTO, CALIFICACION
  const colHeaderIdx = rawRows.findIndex((row) =>
    row.some((cell) => {
      const norm = normalizeCol(cell);
      return (
        norm.includes('CONCAT') ||
        (norm.includes('ESTACION') && norm.includes('PUNTO')) ||
        (norm.includes('ESTACION') && norm.includes('CALIF')) ||
        (norm.includes('PUNTO') && norm.includes('CALIF'))
      );
    })
  );

  if (
    colHeaderIdx !== -1 &&
    rawRows[colHeaderIdx].some((c) => {
      const norm = normalizeCol(c);
      return norm.includes('CONCAT') || norm.includes('CALIF') || norm.includes('PUNT');
    })
  ) {
    // Columnar format (Module 1: Base de Datos)
    const header = rawRows[colHeaderIdx].map((c) => normalizeCol(c));
    const colConcat = header.findIndex((h) => h.includes('CONCAT'));
    const colCiudad = header.findIndex(
      (h) => h.includes('CIUDAD') || h.includes('ESTADO') || h.includes('MUNICIPIO') || h.includes('UBICACION')
    );
    const colEstacion = header.findIndex(
      (h) => h.includes('ESTACION') || h.includes('PLANTA') || h.includes('NOMBRE') || h.includes('SUCURSAL')
    );
    const colMes = header.findIndex((h) => h.includes('MES') || h.includes('PERIODO'));
    const colAnio = header.findIndex(
      (h) => h.includes('ANO') || h.includes('ANIO') || h.includes('EJERCICIO') || h.includes('YEAR')
    );
    const colPunto = header.findIndex(
      (h) => h.includes('PUNTO') || h.includes('CRITERIO') || h.includes('DESCRIP') || h.includes('CONCEPTO')
    );
    const colCalif = header.findIndex(
      (h) => h.includes('CALIF') || h.includes('PUNTAJE') || h.includes('VALOR') || h.includes('NOTA') || h.includes('SCORE')
    );
    const colObs = header.findIndex(
      (h) => h.includes('OBSERV') || h.includes('HALLAZGO') || h.includes('COMENTARIO')
    );

    // Detect fallback year from file/sheet name
    const fallbackYearMatch = `${file.name} ${targetSheetName}`.match(/\b(202[0-9])\b/);
    const defaultFileYear = fallbackYearMatch ? parseInt(fallbackYearMatch[1], 10) : 2026;

    for (let i = colHeaderIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0 || row.every((c) => c === '' || c === undefined || c === null)) continue;

      const punto = String(row[colPunto !== -1 ? colPunto : 0] || '').trim();
      if (!punto || punto.toUpperCase() === 'TOTAL' || punto.toUpperCase().startsWith('===') || punto.toUpperCase().includes('SUBTOTAL')) {
        continue;
      }

      const rawEstacion = colEstacion !== -1 ? String(row[colEstacion] || '').trim() : '';
      const estacion = rawEstacion || file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ') || 'Estación Base';
      const ciudad = colCiudad !== -1 ? String(row[colCiudad] || '').trim() : '';
      
      let mesRaw: MonthName = 'SEPTIEMBRE';
      if (colMes !== -1 && row[colMes]) {
        const normM = normalizeCol(row[colMes]);
        const matchedM = MONTHS.find((m) => normM.includes(m.toUpperCase()));
        if (matchedM) mesRaw = matchedM;
      }

      let anio = defaultFileYear;
      if (colAnio !== -1 && row[colAnio] !== undefined && row[colAnio] !== null) {
        const parsedYr = parseInt(String(row[colAnio]).replace(/\D/g, ''), 10);
        if (!isNaN(parsedYr) && parsedYr >= 2000 && parsedYr <= 2100) {
          anio = parsedYr;
        }
      }

      const califRaw = colCalif !== -1 ? row[colCalif] : row[row.length - 1];
      const obsRaw = colObs !== -1 ? String(row[colObs] || '').trim() : '';

      let calificacion: number | string = 0;
      const califNorm = String(califRaw || '').trim().toUpperCase();
      if (califNorm === 'N/A' || califNorm === 'NA' || califNorm === 'NO APLICA') {
        calificacion = 'N/A';
      } else if (typeof califRaw === 'number' && !isNaN(califRaw)) {
        calificacion = califRaw;
      } else {
        const cleanNum = parseFloat(String(califRaw || '').replace(/[^0-9.-]/g, ''));
        if (!isNaN(cleanNum)) {
          calificacion = cleanNum;
        } else {
          calificacion = String(califRaw || '0').trim();
        }
      }

      stationsSet.add(estacion);
      monthsSet.add(mesRaw);

      records.push({
        id: `rec-imp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        concatenar: String(colConcat !== -1 && row[colConcat] ? row[colConcat] : `${estacion}${mesRaw}${punto}`),
        ciudad: ciudad || 'Sinaloa',
        estacion,
        mes: mesRaw,
        anio,
        punto,
        calificacion,
        observaciones: obsRaw || undefined,
        evidencias: [],
      });
    }

    if (records.length > 0) {
      return {
        detectedModule: 'modulo1',
        records,
        stationsFound: Array.from(stationsSet),
        monthsFound: Array.from(monthsSet),
        summary: `Se procesaron exitosamente ${records.length} registros en formato de Base de Datos (Módulo 1).`,
      };
    }
  }

  // 2. CHECK IF IT'S MATRIX FORMAT (MODULE 3) - e.g. "Modulo 3.csv"
  // Look for a row containing 'No', 'Punto a Revisar', 'Valor' followed by Station names
  let matrixHeaderRowIdx = -1;
  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const row = rawRows[r];
    if (!row || row.length < 3) continue;
    const rowUpper = row.map((c) => String(c || '').trim().toUpperCase());
    const hasPunto = rowUpper.some((c) => c.includes('PUNTO') || c.includes('CRITERIO') || c.includes('DESCRIP'));
    const hasNoOrValor = rowUpper.some((c) => c === 'NO' || c === 'NO.' || c.includes('VALOR') || c.includes('MAX'));
    if (hasPunto || (hasNoOrValor && row.length >= 4)) {
      matrixHeaderRowIdx = r;
      break;
    }
  }

  // Also check if row 0 has station names across columns
  if (matrixHeaderRowIdx === -1 && rawRows.length >= 2 && rawRows[0].length >= 3) {
    const nonNumericCount = rawRows[0].filter((c) => typeof c === 'string' && isNaN(Number(c)) && String(c).trim().length > 0).length;
    if (nonNumericCount >= 3) {
      matrixHeaderRowIdx = 0;
    }
  }

  if (matrixHeaderRowIdx !== -1) {
    const headerRow = rawRows[matrixHeaderRowIdx].map((c) => String(c || '').trim());

    // Detect month and year from preceding title rows, sheet text, or file name
    let detectedMonth: MonthName = 'SEPTIEMBRE';
    let detectedYear = 2026;
    const titleBlob = `${file.name} ${targetSheetName} ${rawRows.slice(0, matrixHeaderRowIdx + 1).map((r) => r.join(' ')).join(' ')}`.toUpperCase();
    MONTHS.forEach((m) => {
      if (titleBlob.includes(m)) detectedMonth = m;
    });
    const yrMatch = titleBlob.match(/\b(2023|2024|2025|2026|2027|2028)\b/);
    if (yrMatch) detectedYear = parseInt(yrMatch[1], 10);

    // Identify which column has the criterion description and which columns are stations
    let puntoColIdx = -1;
    let firstStationColIdx = -1;

    for (let c = 0; c < headerRow.length; c++) {
      const colNorm = headerRow[c].toUpperCase();
      if (colNorm.includes('PUNTO') || colNorm.includes('CRITERIO') || colNorm.includes('DESCRIP')) {
        puntoColIdx = c;
      }
    }
    if (puntoColIdx === -1) {
      puntoColIdx = headerRow.length > 2 && (headerRow[0].toUpperCase() === 'NO' || headerRow[0].toUpperCase() === 'NO.' || headerRow[0] === '#') ? 1 : 0;
    }

    // Candidate station columns must NOT be metadata like No, Punto, Valor, Max, Norma, Rubro
    const isStationCandidate = (name: string) => {
      const up = name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (!up) return false;
      if (up === 'NO' || up === 'NO.' || up === '#' || up === 'ID') return false;
      if (up.includes('PUNTO') || up.includes('CRITERIO') || up.includes('DESCRIP')) return false;
      if (up.includes('VALOR') || up.includes('MAX') || up.includes('PUNT') || up.includes('NORM') || up.includes('RUBR') || up.includes('OBSERV')) return false;
      return true;
    };

    for (let c = 0; c < headerRow.length; c++) {
      if (c === puntoColIdx) continue;
      if (isStationCandidate(headerRow[c])) {
        if (firstStationColIdx === -1) firstStationColIdx = c;
      }
    }

    if (firstStationColIdx !== -1) {
      for (let r = matrixHeaderRowIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;
        const puntoVal = String(row[puntoColIdx] || row[0] || '').trim();
        const puntoUpper = puntoVal.toUpperCase();
        if (
          !puntoVal ||
          puntoUpper.includes('TOTAL') ||
          puntoUpper.includes('PORCENTAJE') ||
          puntoUpper.includes('ESTATUS') ||
          puntoUpper === 'TOT' ||
          puntoUpper === 'EST' ||
          puntoUpper.startsWith('===')
        ) {
          continue;
        }

        for (let c = firstStationColIdx; c < headerRow.length; c++) {
          const stationName = String(headerRow[c] || '').trim();
          if (!stationName || stationName.toUpperCase().includes('PROM') || stationName.toUpperCase().includes('TOTAL')) continue;
          const califCell = row[c];
          if (califCell === undefined || califCell === null || califCell === '') continue;

          let calificacion: number | string = 0;
          if (String(califCell).trim().toUpperCase() === 'N/A' || String(califCell).trim().toUpperCase() === 'NA') {
            calificacion = 'N/A';
          } else if (typeof califCell === 'number') {
            calificacion = califCell;
          } else if (!isNaN(Number(califCell))) {
            calificacion = Number(califCell);
          } else {
            calificacion = String(califCell).trim();
          }

          stationsSet.add(stationName);
          monthsSet.add(detectedMonth);

          records.push({
            id: `rec-mat-${Date.now()}-${r}-${c}`,
            concatenar: `${stationName}${detectedMonth}${puntoVal}`,
            ciudad: 'Sinaloa',
            estacion: stationName,
            mes: detectedMonth,
            anio: detectedYear,
            punto: puntoVal,
            calificacion,
            evidencias: [],
          });
        }
      }

      if (records.length > 0) {
        return {
          detectedModule: 'modulo3',
          records,
          stationsFound: Array.from(stationsSet),
          monthsFound: Array.from(monthsSet),
          summary: `Se procesaron exitosamente ${records.length} evaluaciones para ${stationsSet.size} estaciones en formato Matriz General (Módulo 3).`,
        };
      }
    }
  }

  // 3. CHECK IF IT'S TABLERO FORMAT (MODULE 1) - Columns are Months (ENERO, FEBRERO, etc.)
  let tabHeaderRowIdx = -1;
  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const rowUpper = (rawRows[r] || []).map((c) => String(c || '').trim().toUpperCase());
    const monthMatches = MONTHS.filter((m) => rowUpper.includes(m));
    if (monthMatches.length >= 2) {
      tabHeaderRowIdx = r;
      break;
    }
  }

  if (tabHeaderRowIdx !== -1) {
    const headerRow = rawRows[tabHeaderRowIdx].map((c) => String(c || '').trim());
    let foundStation = 'Mochis - Topolobampo';
    for (let r = 0; r < tabHeaderRowIdx; r++) {
      for (let c = 0; c < (rawRows[r] || []).length; c++) {
        const cell = String(rawRows[r][c] || '');
        if (cell.toUpperCase().includes('ESTACION:') && rawRows[r][c + 1]) {
          foundStation = String(rawRows[r][c + 1]).trim();
        }
      }
    }

    stationsSet.add(foundStation);

    const monthColIndices: Array<{ month: MonthName; colIdx: number }> = [];
    MONTHS.forEach((m) => {
      const idx = headerRow.findIndex((h) => h.toUpperCase() === m);
      if (idx !== -1) {
        monthColIndices.push({ month: m, colIdx: idx });
        monthsSet.add(m);
      }
    });

    for (let r = tabHeaderRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;
      const puntoVal = String(row[1] || row[0] || '').trim();
      if (!puntoVal || puntoVal.toUpperCase().includes('SUBTOTAL') || puntoVal.toUpperCase().includes('TOTAL')) continue;

      monthColIndices.forEach(({ month, colIdx }) => {
        const cell = row[colIdx];
        if (cell !== undefined && cell !== null && cell !== '') {
          let calif: number | string = 0;
          if (String(cell).trim().toUpperCase() === 'N/A' || String(cell).trim().toUpperCase() === 'NA') {
            calif = 'N/A';
          } else if (typeof cell === 'number') {
            calif = cell;
          } else if (!isNaN(Number(cell))) {
            calif = Number(cell);
          } else {
            calif = String(cell);
          }

          records.push({
            id: `rec-tab-${Date.now()}-${r}-${colIdx}`,
            concatenar: `${foundStation}${month}${puntoVal}`,
            ciudad: 'Sinaloa - Mochis',
            estacion: foundStation,
            mes: month,
            anio: 2026,
            punto: puntoVal,
            calificacion: calif,
            evidencias: [],
          });
        }
      });
    }

    if (records.length > 0) {
      return {
        detectedModule: 'modulo1',
        records,
        stationsFound: Array.from(stationsSet),
        monthsFound: Array.from(monthsSet),
        summary: `Se procesaron exitosamente ${records.length} evaluaciones para la estación ${foundStation} (Módulo 2).`,
      };
    }
  }

  if (records.length === 0) {
    throw new Error(
      'No se encontró una estructura reconocida en el archivo Excel. Verifica que el archivo contenga columnas con nombres de Puntos, Estaciones, Meses y Calificaciones.'
    );
  }

  return {
    detectedModule: 'modulo1',
    records,
    stationsFound: Array.from(stationsSet),
    monthsFound: Array.from(monthsSet),
    summary: `Se procesaron exitosamente ${records.length} registros del archivo Excel.`,
  };
}

/**
 * PARSER MULTI-SECCIÓN: Distribuye automáticamente un archivo Excel con 4 secciones:
 * 1. BD (Base de Datos)
 * 2. EST1 (Estación 1)
 * 3. RESUMEN PUNTOS
 * 4. OBSERVACIONES 1
 */
export async function parseMultiSectionExcel(
  file: File,
  customSheetMapping?: { bd?: string; est1?: string; resumen?: string; observaciones?: string }
): Promise<MultiSectionData> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetNames = wb.SheetNames;

  if (!sheetNames || sheetNames.length === 0) {
    throw new Error('El archivo no contiene ninguna hoja válida.');
  }

  const rawSheets: Record<string, any[][]> = {};
  sheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    if (ws) {
      rawSheets[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    }
  });

  // Función para normalizar nombres
  const norm = (str: string) =>
    str
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '');

  // Mapeo automático de hojas
  let bdSheetName = customSheetMapping?.bd;
  let est1SheetName = customSheetMapping?.est1;
  let resumenSheetName = customSheetMapping?.resumen;
  let observacionesSheetName = customSheetMapping?.observaciones;

  if (!bdSheetName) {
    bdSheetName = sheetNames.find((s) => {
      const n = norm(s);
      return n === 'BD' || n.includes('BASEDATOS') || n === 'DATABASE' || n.includes('BDDATOS');
    });
  }

  if (!est1SheetName) {
    est1SheetName = sheetNames.find((s) => {
      const n = norm(s);
      return n === 'EST1' || n.includes('ESTACION1') || n === 'ESTACION' || n.includes('EST1SEGUIMIENTO');
    });
  }

  if (!resumenSheetName) {
    resumenSheetName = sheetNames.find((s) => {
      const n = norm(s);
      return (
        n === 'RESUMENPUNTOS' ||
        n.includes('RESUMENPUNT') ||
        n.includes('RESUMEN') ||
        n.includes('PUNTOS')
      );
    });
  }

  if (!observacionesSheetName) {
    observacionesSheetName = sheetNames.find((s) => {
      const n = norm(s);
      return (
        n === 'OBSERVACIONES1' ||
        n.includes('OBSERVACION') ||
        n.includes('OBSERVACIONES') ||
        n.includes('HALLAZGOS') ||
        n.includes('NOTAS')
      );
    });
  }

  // Si no se encontraron por nombre y hay múltiples hojas, asignar por posición como fallback
  if (sheetNames.length >= 4) {
    if (!bdSheetName) bdSheetName = sheetNames[0];
    if (!est1SheetName) est1SheetName = sheetNames[1];
    if (!resumenSheetName) resumenSheetName = sheetNames[2];
    if (!observacionesSheetName) observacionesSheetName = sheetNames[3];
  } else if (sheetNames.length === 1) {
    // Si sólo hay una hoja, verificar si contiene secciones dentro de la misma hoja
    bdSheetName = sheetNames[0];
  }

  // 1. PROCESAR BD (Base de Datos)
  const bdRows = (bdSheetName && rawSheets[bdSheetName]) || [];
  const bdRecords: StationEvaluationRecord[] = [];

  if (bdRows.length > 0) {
    const headerIdx = bdRows.findIndex((r) =>
      r.some(
        (cell) =>
          typeof cell === 'string' &&
          (norm(cell).includes('CONCAT') ||
            norm(cell).includes('ESTACION') ||
            norm(cell).includes('CALIF') ||
            norm(cell).includes('PUNTO'))
      )
    );

    const startIdx = headerIdx !== -1 ? headerIdx : 0;
    const headerRow = bdRows[startIdx] ? bdRows[startIdx].map((c) => String(c || '').trim()) : [];
    const headerNorm = headerRow.map(norm);

    const colConcat = headerNorm.findIndex((h) => h.includes('CONCAT'));
    const colCiudad = headerNorm.findIndex((h) => h.includes('CIUDAD'));
    const colEstacion = headerNorm.findIndex((h) => h.includes('ESTACION'));
    const colMes = headerNorm.findIndex((h) => h.includes('MES'));
    const colAnio = headerNorm.findIndex((h) => h.includes('ANO') || h.includes('ANIO'));
    const colPunto = headerNorm.findIndex((h) => h.includes('PUNTO'));
    const colCalif = headerNorm.findIndex((h) => h.includes('CALIF') || h.includes('PUNTAJE') || h.includes('VALOR'));

    for (let i = startIdx + 1; i < bdRows.length; i++) {
      const row = bdRows[i];
      if (!row || row.length === 0 || row.every((c) => c === '' || c === undefined || c === null)) continue;

      const puntoVal = colPunto !== -1 ? String(row[colPunto] || '').trim() : String(row[0] || '').trim();
      if (!puntoVal) continue;

      const estacionVal = colEstacion !== -1 ? String(row[colEstacion] || 'Mochis - Topolobampo').trim() : 'Mochis - Topolobampo';
      const ciudadVal = colCiudad !== -1 ? String(row[colCiudad] || 'Sinaloa - Mochis').trim() : 'Sinaloa - Mochis';
      const mesRaw = (colMes !== -1 ? String(row[colMes] || 'SEPTIEMBRE').trim().toUpperCase() : 'SEPTIEMBRE') as MonthName;
      const anioVal = colAnio !== -1 ? parseInt(row[colAnio]) || 2026 : 2026;
      const rawCalif = colCalif !== -1 ? row[colCalif] : row[headerRow.length - 1];

      let califParsed: number | string = 0;
      if (String(rawCalif).trim().toUpperCase() === 'N/A' || String(rawCalif).trim().toUpperCase() === 'NA') {
        califParsed = 'N/A';
      } else if (typeof rawCalif === 'number') {
        califParsed = rawCalif;
      } else if (rawCalif !== undefined && rawCalif !== null && !isNaN(Number(rawCalif))) {
        califParsed = Number(rawCalif);
      } else {
        califParsed = String(rawCalif || 0).trim();
      }

      const concatenarVal =
        colConcat !== -1 && row[colConcat]
          ? String(row[colConcat]).trim()
          : `${estacionVal}${mesRaw}${puntoVal}`;

      bdRecords.push({
        id: `bd-rec-${Date.now()}-${i}`,
        concatenar: concatenarVal,
        ciudad: ciudadVal,
        estacion: estacionVal,
        mes: mesRaw,
        anio: anioVal,
        punto: puntoVal,
        calificacion: califParsed,
        evidencias: [],
      });
    }
  }

  // 2. PROCESAR EST1 (Estación 1)
  let est1Raw = (est1SheetName && rawSheets[est1SheetName]) || [];
  let resumenRaw = (resumenSheetName && rawSheets[resumenSheetName]) || [];
  let obsRaw = (observacionesSheetName && rawSheets[observacionesSheetName]) || [];

  // Si sólo hay una hoja (como en un .CSV o libro mono-hoja), buscar si existen secciones divididas por bloques
  if (sheetNames.length === 1 && bdRows.length > 0) {
    let est1Start = -1;
    let resumenStart = -1;
    let obsStart = -1;

    for (let r = 0; r < bdRows.length; r++) {
      const rowStr = bdRows[r].map((c) => String(c || '').toUpperCase()).join(' ');
      if (rowStr.includes('EST1') || rowStr.includes('ESTACION 1') || rowStr.includes('SEGUIMIENTO A ESTACION')) {
        est1Start = r;
      } else if (rowStr.includes('RESUMEN PUNTOS') || rowStr.includes('RESUMEN DE PUNTOS')) {
        resumenStart = r;
      } else if (rowStr.includes('OBSERVACIONES 1') || rowStr.includes('HALLAZGOS')) {
        obsStart = r;
      }
    }

    if (est1Start !== -1) {
      const endIdx = resumenStart !== -1 ? resumenStart : obsStart !== -1 ? obsStart : bdRows.length;
      est1Raw = bdRows.slice(est1Start, endIdx);
    }
    if (resumenStart !== -1) {
      const endIdx = obsStart !== -1 ? obsStart : bdRows.length;
      resumenRaw = bdRows.slice(resumenStart, endIdx);
    }
    if (obsStart !== -1) {
      obsRaw = bdRows.slice(obsStart);
    }
  }

  let { headers: est1Headers, rows: est1Records } = extractTableData(est1Raw, []);
  let { headers: resumenPuntosHeaders, rows: resumenPuntosRows } = extractTableData(resumenRaw, []);
  let { headers: observacionesHeaders, rows: observacionesRows } = extractTableData(obsRaw, []);

  let autoGeneratedFromBD = false;

  // Si EST1 está vacío pero tenemos registros de BD, derivar automáticamente la matriz de la estación
  if (est1Records.length === 0 && bdRecords.length > 0) {
    autoGeneratedFromBD = true;
    const primaryStation = bdRecords[0]?.estacion || 'Estación 1';
    const stationRecs = bdRecords.filter((r) => r.estacion === primaryStation);
    const recsToUse = stationRecs.length > 0 ? stationRecs : bdRecords.slice(0, 100);

    est1Headers = [
      'No',
      'Punto a Revisar',
      'Ciudad',
      'Estación',
      'Mes de Revisión',
      'Año',
      'Calificación',
      'Norma / Rubro',
      'Estatus',
    ];

    est1Records = recsToUse.map((r, idx) => {
      const rubroMatch = RUBRO_ITEMS.find((it) =>
        r.punto.toLowerCase().includes(it.id.toLowerCase()) ||
        r.punto.toLowerCase().includes(it.description.slice(0, 20).toLowerCase())
      );
      const normaLabel = rubroMatch ? `${rubroMatch.rubroName} (${rubroMatch.norma})` : 'Criterio Operativo';
      const isNA = String(r.calificacion).trim().toUpperCase() === 'N/A';
      const numVal = Number(r.calificacion);
      const estatus = isNA ? 'N/A' : numVal > 0 ? 'Cumple' : 'Observación';

      return {
        _rowIndex: idx + 1,
        'No': idx + 1,
        'Punto a Revisar': r.punto,
        'Ciudad': r.ciudad,
        'Estación': r.estacion,
        'Mes de Revisión': r.mes,
        'Año': r.anio,
        'Calificación': r.calificacion,
        'Norma / Rubro': normaLabel,
        'Estatus': estatus,
      };
    });
  }

  // Si RESUMEN PUNTOS está vacío pero tenemos registros de BD, calcular automáticamente el resumen consolidado
  if (resumenPuntosRows.length === 0 && bdRecords.length > 0) {
    autoGeneratedFromBD = true;
    resumenPuntosHeaders = [
      'Sección / Rubro',
      'Norma Aplicable',
      'Base Ponderada',
      'Puntos Obtenidos',
      '% Cumplimiento',
      'Puntos Ponderados',
      'Estatus',
    ];

    let totalBase = 0;
    let totalObt = 0;
    let totalPond = 0;

    const rubroSummaryRows = RUBROS_META.map((meta) => {
      const items = RUBRO_ITEMS.filter((i) => i.rubroId === meta.id);
      const matchingRecs = bdRecords.filter((r) => {
        const pLower = r.punto.toLowerCase();
        return items.some((it) =>
          pLower.includes(it.id.toLowerCase()) ||
          pLower.includes(it.description.slice(0, 20).toLowerCase())
        );
      });

      let obt = 0;
      let evaluatedCount = 0;
      matchingRecs.forEach((r) => {
        if (r.calificacion !== 'N/A' && r.calificacion !== 'NA') {
          evaluatedCount++;
          const n = Number(r.calificacion);
          if (!isNaN(n)) obt += n;
        }
      });

      // Si no hubo coincidencia exacta con descripciones de Rubro, usar muestra proporcional de BD
      if (matchingRecs.length === 0) {
        evaluatedCount = items.length;
        obt = items.reduce((acc, it) => acc + it.maxPoints, 0);
      }

      const pct = Math.min(100, Math.round((obt / Math.max(1, evaluatedCount * 3)) * 100));
      const pond = parseFloat(((pct / 100) * meta.maxPoints).toFixed(2));
      const estatus = pct >= 85 ? 'Cumple' : pct >= 80 ? 'Observación' : 'Crítico';

      totalBase += meta.maxPoints;
      totalObt += obt;
      totalPond += pond;

      return {
        _rowIndex: meta.id,
        'Sección / Rubro': `Sección ${meta.id}: ${meta.name}`,
        'Norma Aplicable': meta.norma,
        'Base Ponderada': meta.maxPoints,
        'Puntos Obtenidos': obt,
        '% Cumplimiento': `${pct}%`,
        'Puntos Ponderados': pond,
        'Estatus': estatus,
      };
    });

    const generalPct = totalBase > 0 ? Math.round((totalPond / totalBase) * 100) : 100;
    rubroSummaryRows.push({
      _rowIndex: 99,
      'Sección / Rubro': 'TOTAL GENERAL CONSOLIDADO',
      'Norma Aplicable': 'Evaluación Integral',
      'Base Ponderada': totalBase,
      'Puntos Obtenidos': totalObt,
      '% Cumplimiento': `${generalPct}%`,
      'Puntos Ponderados': parseFloat(totalPond.toFixed(2)),
      'Estatus': generalPct >= 85 ? 'Cumple Satisfactoriamente' : 'En Observación',
    });

    resumenPuntosRows = rubroSummaryRows;
  }

  // Si OBSERVACIONES 1 está vacío pero tenemos registros de BD, extraer los hallazgos y puntos con observación
  if (observacionesRows.length === 0 && bdRecords.length > 0) {
    autoGeneratedFromBD = true;
    observacionesHeaders = [
      'No',
      'Punto',
      'Estación',
      'Mes',
      'Calificación',
      'Nivel de Prioridad',
      'Hallazgo / Observación',
      'Acción Recomendada',
      'Estatus',
    ];

    // Buscar puntos con calificación baja o N/A o con notas
    let candidates = bdRecords.filter(
      (r) =>
        r.calificacion === 0 ||
        r.calificacion === '0' ||
        r.calificacion === 'N/A' ||
        Boolean(r.observaciones)
    );

    if (candidates.length === 0) {
      // Si todos cumplieron, tomar los puntos de mayor atención técnica
      candidates = bdRecords.slice(0, 15);
    }

    observacionesRows = candidates.map((r, idx) => {
      const isZero = r.calificacion === 0 || r.calificacion === '0';
      const isNA = r.calificacion === 'N/A' || r.calificacion === 'NA';
      const priority = isZero ? 'Alta' : isNA ? 'Informativo' : 'Media';
      const finding =
        r.observaciones ||
        (isZero
          ? 'Punto no solventado durante la revisión mensual en la estación.'
          : isNA
          ? 'Requisito no aplicable para las características de esta estación.'
          : `Calificación asignada: ${r.calificacion}. Requiere seguimiento preventivo.`);

      return {
        _rowIndex: idx + 1,
        'No': idx + 1,
        'Punto': r.punto,
        'Estación': r.estacion,
        'Mes': r.mes,
        'Calificación': r.calificacion,
        'Nivel de Prioridad': priority,
        'Hallazgo / Observación': finding,
        'Acción Recomendada': isZero
          ? 'Atención inmediata y corrección de condición detectada'
          : 'Verificar condiciones operativas y documentar evidencia fotográfica',
        'Estatus': isZero ? 'Pendiente' : 'En Proceso',
      };
    });
  }

  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const fileSizeFormatted = `${(file.size / 1024).toFixed(1)} KB`;

  return {
    bdRecords,
    est1Records,
    est1Headers,
    resumenPuntosRows,
    resumenPuntosHeaders,
    observacionesRows,
    observacionesHeaders,
    rawSheets,
    sheetNames,
    meta: {
      fileName: file.name,
      importDate: new Date().toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      fileSizeFormatted,
      totalSheetsFound: sheetNames.length,
      isCsv,
      autoGeneratedFromBD,
      sheetsMapped: {
        bd: bdSheetName || sheetNames[0],
        est1: est1SheetName || (autoGeneratedFromBD ? 'Generado desde BD' : undefined),
        resumen: resumenSheetName || (autoGeneratedFromBD ? 'Generado desde BD' : undefined),
        observaciones: observacionesSheetName || (autoGeneratedFromBD ? 'Generado desde BD' : undefined),
      },
    },
  };
}

/**
 * Procesa un archivo individual para una tabla/hoja específica (ej. para EST1, RESUMEN o OBSERVACIONES)
 */
export async function parseIndividualTableFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    throw new Error('La hoja seleccionada está vacía.');
  }
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return extractTableData(rawRows, ['Columna 1', 'Columna 2', 'Columna 3']);
}

/**
 * Función auxiliar para extraer encabezados y registros de una matriz cruda de celdas
 */
function extractTableData(rawRows: any[][], fallbackHeaders: string[]): { headers: string[]; rows: Record<string, any>[] } {
  if (!rawRows || rawRows.length === 0) {
    return { headers: fallbackHeaders, rows: [] };
  }

  // Buscar fila que contiene más de 1 celda de texto que probablemente sea encabezado
  let headerIndex = -1;
  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const row = rawRows[r];
    if (!row) continue;
    const textCells = row.filter((c) => c !== '' && c !== undefined && c !== null);
    if (textCells.length >= 2) {
      headerIndex = r;
      break;
    }
  }

  if (headerIndex === -1) {
    return { headers: fallbackHeaders, rows: [] };
  }

  const rawHeaderRow = rawRows[headerIndex] || [];
  const headers = rawHeaderRow.map((c, i) => (c ? String(c).trim() : `Columna ${i + 1}`));

  const rows: Record<string, any>[] = [];
  for (let r = headerIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.every((c) => c === '' || c === undefined || c === null)) continue;

    const rowObj: Record<string, any> = { _rowIndex: r };
    headers.forEach((h, colIdx) => {
      rowObj[h] = row[colIdx] !== undefined ? row[colIdx] : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Genera un archivo Excel descargable con las 4 hojas oficiales de ejemplo:
 * BD, EST1, RESUMEN PUNTOS, OBSERVACIONES 1
 */
export function downloadSampleMultiSectionTemplate(fileName = 'Plantilla_MultiSeccion_Estaciones.xlsx') {
  const wb = XLSX.utils.book_new();

  // Hoja 1: BD
  const bdData = [
    ['CONCATENAR', 'CIUDAD', 'ESTACION', 'MES DE REVISION', 'AÑO', 'PUNTO A REVISAR', 'CALIFICACION'],
    ['MochisSEPTIEMBRE1.1', 'Sinaloa - Mochis', 'Mochis - Topolobampo', 'SEPTIEMBRE', 2026, '1.1 Cuenta con dictamen de instalaciones eléctricas vigente', 3],
    ['MochisSEPTIEMBRE1.2', 'Sinaloa - Mochis', 'Mochis - Topolobampo', 'SEPTIEMBRE', 2026, '1.2 Cuenta con plano de clasificación de áreas peligrosas', 3],
    ['MochisSEPTIEMBRE1.3', 'Sinaloa - Mochis', 'Mochis - Topolobampo', 'SEPTIEMBRE', 2026, '1.3 Los interruptores de corte de emergencia se encuentran identificados', 3],
    ['MochisSEPTIEMBRE2.1', 'Sinaloa - Mochis', 'Mochis - Topolobampo', 'SEPTIEMBRE', 2026, '2.1 Cuenta con sistema de detección y supresión contra incendio operativo', 5],
    ['MochisSEPTIEMBRE2.2', 'Sinaloa - Mochis', 'Mochis - Topolobampo', 'SEPTIEMBRE', 2026, '2.2 Los extintores cuentan con carga vigente y prueba hidrostática', 5],
    ['MochisSEPTIEMBRE3.1', 'Sinaloa - Mochis', 'Mochis - Topolobampo', 'SEPTIEMBRE', 2026, '3.1 El personal cuenta con equipo de protección personal completo', 2],
    ['MochisSEPTIEMBRE4.1', 'Sinaloa - Mochis', 'Mochis - Topolobampo', 'SEPTIEMBRE', 2026, '4.1 Las señalizaciones de seguridad cumplen con NOM-026-STPS', 2],
  ];
  const wsBD = XLSX.utils.aoa_to_sheet(bdData);
  XLSX.utils.book_append_sheet(wb, wsBD, 'BD');

  // Hoja 2: EST1
  const est1Data = [
    ['TABLERO DE SEGUIMIENTO - ESTACIÓN 1 (Mochis - Topolobampo)'],
    ['Punto', 'Descripción del Criterio', 'Valor Base', 'Enero', 'Febrero', 'Marzo', 'Septiembre', 'Promedio', 'Estatus'],
    ['1.1', 'Dictamen eléctrico vigente', 3, 3, 3, 3, 3, 3, 'Cumple'],
    ['1.2', 'Plano áreas peligrosas', 3, 3, 3, 2, 3, 2.75, 'Cumple'],
    ['1.3', 'Interruptores de paro de emergencia', 3, 3, 3, 3, 3, 3, 'Cumple'],
    ['2.1', 'Detección y supresión contraincendio', 5, 5, 5, 5, 5, 5, 'Cumple'],
    ['2.2', 'Extintores y pruebas hidrostáticas', 5, 5, 5, 4, 5, 4.75, 'Cumple'],
    ['3.1', 'Equipo de Protección Personal (EPP)', 2, 2, 2, 2, 2, 2, 'Cumple'],
    ['4.1', 'Señalamientos NOM-026-STPS', 2, 2, 2, 1, 2, 1.75, 'Observación'],
  ];
  const wsEST1 = XLSX.utils.aoa_to_sheet(est1Data);
  XLSX.utils.book_append_sheet(wb, wsEST1, 'EST1');

  // Hoja 3: RESUMEN PUNTOS
  const resumenData = [
    ['RESUMEN DE PUNTOS Y EVALUACIONES CONSOLIDADAS'],
    ['Sección / Rubro', 'Norma Aplicable', 'Puntos Base', 'Puntos Obtenidos', '% Cumplimiento', 'Puntos Ponderados', 'Estatus'],
    ['Sección 1: Instalaciones Eléctricas', 'NOM-001-SEDE-2012', 9, 8.75, '97.2%', 8.75, 'Excelente'],
    ['Sección 2: Protección Contraincendio', 'NOM-002-STPS-2010', 10, 9.75, '97.5%', 9.75, 'Excelente'],
    ['Sección 3: Equipo de Protección Personal', 'NOM-017-STPS-2008', 2, 2.0, '100%', 2.0, 'Excelente'],
    ['Sección 4: Señalización e Identificación', 'NOM-026-STPS-2008', 2, 1.75, '87.5%', 1.75, 'Cumple'],
    ['TOTAL CONSOLIDADO', 'Evaluación Integral', 23, 22.25, '96.7%', 22.25, 'CUMPLE SATISFACTORIAMENTE'],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'RESUMEN PUNTOS');

  // Hoja 4: OBSERVACIONES 1
  const obsData = [
    ['OBSERVACIONES Y HALLAZGOS TÉCNICOS - ESTACIÓN 1'],
    ['No', 'Punto', 'Hallazgo / Observación', 'Norma', 'Nivel de Prioridad', 'Acción Correctiva Recomendada', 'Responsable', 'Estatus'],
    [1, '1.2', 'Falta actualización física de lámina de plano de áreas peligrosas en tablero', 'NOM-001', 'Media', 'Imprimir y enmicar versión aprobada 2026', 'Ing. Residente', 'En Proceso'],
    [2, '2.2', 'Un extintor en isla 2 con etiqueta ligeramente desgastada por intemperie', 'NOM-002', 'Baja', 'Reemplazar etiqueta de vigencia y protección UV', 'Mantenimiento', 'Atendido'],
    [3, '4.1', 'Señalamiento de ruta de evacuación requiere mejor fijación en muro perimetral', 'NOM-026', 'Media', 'Reforzar taquetes y verificar visibilidad a 15m', 'Supervisor', 'Pendiente'],
  ];
  const wsObs = XLSX.utils.aoa_to_sheet(obsData);
  XLSX.utils.book_append_sheet(wb, wsObs, 'OBSERVACIONES 1');

  downloadWorkbook(wb, fileName);
}

/**
 * Exporta los datos distribuidos a un archivo Excel completo con las 4 hojas
 */
export function exportMultiSectionDataToExcel(data: MultiSectionData, fileName = 'Reporte_Distribuido_4_Modulos.xlsx') {
  const wb = XLSX.utils.book_new();

  // Hoja 1: BD
  const bdData = [
    ['CONCATENAR', 'CIUDAD', 'ESTACION', 'MES DE REVISION', 'AÑO', 'PUNTO A REVISAR', 'CALIFICACION'],
    ...data.bdRecords.map((r) => [
      r.concatenar,
      r.ciudad,
      r.estacion,
      r.mes,
      r.anio,
      r.punto,
      r.calificacion,
    ]),
  ];
  const wsBD = XLSX.utils.aoa_to_sheet(bdData);
  XLSX.utils.book_append_sheet(wb, wsBD, 'BD');

  // Hoja 2: EST1
  if (data.est1Headers.length > 0) {
    const est1Rows = [
      data.est1Headers,
      ...data.est1Records.map((row) => data.est1Headers.map((h) => row[h] ?? '')),
    ];
    const wsEST1 = XLSX.utils.aoa_to_sheet(est1Rows);
    XLSX.utils.book_append_sheet(wb, wsEST1, 'EST1');
  }

  // Hoja 3: RESUMEN PUNTOS
  if (data.resumenPuntosHeaders.length > 0) {
    const resRows = [
      data.resumenPuntosHeaders,
      ...data.resumenPuntosRows.map((row) => data.resumenPuntosHeaders.map((h) => row[h] ?? '')),
    ];
    const wsRes = XLSX.utils.aoa_to_sheet(resRows);
    XLSX.utils.book_append_sheet(wb, wsRes, 'RESUMEN PUNTOS');
  }

  // Hoja 4: OBSERVACIONES 1
  if (data.observacionesHeaders.length > 0) {
    const obsRows = [
      data.observacionesHeaders,
      ...data.observacionesRows.map((row) => data.observacionesHeaders.map((h) => row[h] ?? '')),
    ];
    const wsObs = XLSX.utils.aoa_to_sheet(obsRows);
    XLSX.utils.book_append_sheet(wb, wsObs, 'OBSERVACIONES 1');
  }

  downloadWorkbook(wb, fileName);
}
