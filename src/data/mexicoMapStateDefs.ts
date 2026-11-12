// Definition of all 32 Mexican states with calibrated coordinates for public/mapa.jpg (1244 x 864)
export interface MexicoStateDef {
  id: string;
  name: string;
  shortName: string;
  pinX: number;
  pinY: number;
}

export const MEXICO_STATES_DEFS: MexicoStateDef[] = [
  { id: 'SON', name: 'Sonora', shortName: 'Sonora', pinX: 310, pinY: 180 },
  { id: 'CHIH', name: 'Chihuahua', shortName: 'Chihuahua', pinX: 460, pinY: 200 },
  { id: 'COAH', name: 'Coahuila', shortName: 'Coahuila', pinX: 610, pinY: 250 },
  { id: 'DGO', name: 'Durango', shortName: 'Durango', pinX: 490, pinY: 360 },
  { id: 'SIN', name: 'Sinaloa', shortName: 'Sinaloa', pinX: 400, pinY: 360 },
  { id: 'ZAC', name: 'Zacatecas', shortName: 'Zacatecas', pinX: 570, pinY: 420 },
  { id: 'SLP', name: 'San Luis Potosí', shortName: 'San Luis Potosí', pinX: 660, pinY: 450 },
  { id: 'TAMPS', name: 'Tamaulipas', shortName: 'Tamaulipas', pinX: 720, pinY: 380 },
  { id: 'NL', name: 'Nuevo León', shortName: 'Nuevo León', pinX: 680, pinY: 320 },
  { id: 'NAY', name: 'Nayarit', shortName: 'Nayarit', pinX: 490, pinY: 490 },
  { id: 'JAL', name: 'Jalisco', shortName: 'Jalisco', pinX: 520, pinY: 520 },
  { id: 'COL', name: 'Colima', shortName: 'Colima', pinX: 530, pinY: 610 },
  { id: 'MICH', name: 'Michoacán', shortName: 'Michoacán', pinX: 610, pinY: 570 },
  { id: 'GRO', name: 'Guerrero', shortName: 'Guerrero', pinX: 680, pinY: 640 },
  { id: 'OAX', name: 'Oaxaca', shortName: 'Oaxaca', pinX: 820, pinY: 660 },
  { id: 'CHIS', name: 'Chiapas', shortName: 'Chiapas', pinX: 970, pinY: 690 },
  { id: 'VER', name: 'Veracruz', shortName: 'Veracruz', pinX: 800, pinY: 540 },
  { id: 'TAB', name: 'Tabasco', shortName: 'Tabasco', pinX: 895, pinY: 650 },
  { id: 'CAMP', name: 'Campeche', shortName: 'Campeche', pinX: 1080, pinY: 590 },
  { id: 'YUC', name: 'Yucatán', shortName: 'Yucatán', pinX: 1090, pinY: 545 },
  { id: 'QROO', name: 'Quintana Roo', shortName: 'Quintana Roo', pinX: 1110, pinY: 560 },
  { id: 'BC', name: 'Baja California', shortName: 'Baja California', pinX: 120, pinY: 150 },
  { id: 'BCS', name: 'Baja California Sur', shortName: 'Baja California Sur', pinX: 185, pinY: 305 },
  { id: 'GTO', name: 'Guanajuato', shortName: 'Guanajuato', pinX: 640, pinY: 480 },
  { id: 'QRO', name: 'Querétaro', shortName: 'Querétaro', pinX: 680, pinY: 520 },
  { id: 'HGO', name: 'Hidalgo', shortName: 'Hidalgo', pinX: 720, pinY: 500 },
  { id: 'PUE', name: 'Puebla', shortName: 'Puebla', pinX: 770, pinY: 590 },
  { id: 'TLAX', name: 'Tlaxcala', shortName: 'Tlaxcala', pinX: 748, pinY: 570 },
  { id: 'EDOMEX', name: 'México', shortName: 'Edoméx', pinX: 690, pinY: 580 },
  { id: 'CDMX', name: 'Ciudad de México', shortName: 'CDMX', pinX: 712, pinY: 585 },
  { id: 'MOR', name: 'Morelos', shortName: 'Morelos', pinX: 715, pinY: 610 },
  { id: 'AGS', name: 'Aguascalientes', shortName: 'Aguascalientes', pinX: 595, pinY: 480 },
];

// Helper to find closest state by coordinates on mapa.jpg (1244 x 864)
export function getStateFromCoords(x: number, y: number, maxDistance = 75): MexicoStateDef | null {
  let closest: MexicoStateDef | null = null;
  let minDist = maxDistance;

  for (const s of MEXICO_STATES_DEFS) {
    const dx = x - s.pinX;
    const dy = y - s.pinY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      closest = s;
    }
  }

  return closest;
}
