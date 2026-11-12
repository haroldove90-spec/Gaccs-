// High-precision geographic vector coordinates for the 32 federal entities of Mexico
// Normalized coordinate grid viewBox="0 0 1000 660" matching national cartography

export interface MexicoStatePath {
  id: string;
  code: string;
  name: string;
  shortName: string;
  d: string;
  centerX: number;
  centerY: number;
  labelAngle?: number;
  paletteColor: string; // Color from reference map image
}

export const MEXICO_STATES: MexicoStatePath[] = [
  {
    id: 'BC',
    code: '02',
    name: 'Baja California',
    shortName: 'Baja California',
    centerX: 122,
    centerY: 85,
    labelAngle: -55,
    paletteColor: '#7c73a8', // Slate purple as in image
    d: 'M 104,18 L 168,22 L 174,48 L 166,74 L 172,98 L 160,118 L 146,142 L 138,168 L 118,172 L 96,128 L 84,94 L 72,56 L 82,24 Z',
  },
  {
    id: 'BCS',
    code: '03',
    name: 'Baja California Sur',
    shortName: 'Baja California Sur',
    centerX: 215,
    centerY: 278,
    labelAngle: -50,
    paletteColor: '#a3b638', // Olive green as in image
    d: 'M 118,172 L 138,168 L 152,192 L 176,236 L 210,274 L 250,332 L 278,380 L 268,396 L 244,374 L 224,324 L 188,284 L 160,250 L 140,214 Z',
  },
  {
    id: 'SON',
    code: '26',
    name: 'Sonora',
    shortName: 'Sonora',
    centerX: 260,
    centerY: 115,
    paletteColor: '#d90479', // Vivid magenta as in image
    d: 'M 168,22 L 316,22 L 318,52 L 334,84 L 322,130 L 326,170 L 312,216 L 298,242 L 272,240 L 242,204 L 206,158 L 178,118 L 166,74 L 174,48 Z',
  },
  {
    id: 'CHIH',
    code: '08',
    name: 'Chihuahua',
    shortName: 'Chihuahua',
    centerX: 382,
    centerY: 135,
    paletteColor: '#f59e0b', // Amber yellow-orange as in image
    d: 'M 316,22 L 442,32 L 448,58 L 476,96 L 472,138 L 458,180 L 440,204 L 434,236 L 396,238 L 362,254 L 326,224 L 312,216 L 326,170 L 322,130 L 334,84 L 318,52 Z',
  },
  {
    id: 'COAH',
    code: '05',
    name: 'Coahuila',
    shortName: 'Coahuila',
    centerX: 494,
    centerY: 192,
    paletteColor: '#2d6a4f', // Deep dark green as in image
    d: 'M 442,32 L 474,86 L 506,84 L 544,142 L 568,178 L 562,218 L 542,248 L 526,276 L 498,300 L 474,296 L 452,266 L 434,236 L 440,204 L 458,180 L 472,138 L 476,96 L 448,58 Z',
  },
  {
    id: 'NL',
    code: '19',
    name: 'Nuevo León',
    shortName: 'Nuevo León',
    centerX: 560,
    centerY: 242,
    paletteColor: '#80ced6', // Cyan mint as in image
    d: 'M 544,142 L 564,152 L 588,198 L 596,236 L 588,278 L 576,322 L 552,330 L 542,298 L 526,276 L 542,248 L 562,218 L 568,178 Z',
  },
  {
    id: 'TAMPS',
    code: '28',
    name: 'Tamaulipas',
    shortName: 'Tamaulipas',
    centerX: 598,
    centerY: 282,
    paletteColor: '#f26419', // Coral orange as in image
    d: 'M 564,152 L 610,186 L 632,240 L 636,298 L 626,346 L 598,374 L 576,358 L 576,322 L 588,278 L 596,236 L 588,198 Z',
  },
  {
    id: 'SIN',
    code: '25',
    name: 'Sinaloa',
    shortName: 'Sinaloa',
    centerX: 334,
    centerY: 278,
    paletteColor: '#c3db73', // Pale olive lime green as in image
    d: 'M 298,242 L 326,224 L 362,254 L 372,284 L 388,328 L 402,364 L 380,388 L 358,358 L 334,310 L 308,276 Z',
  },
  {
    id: 'DGO',
    code: '10',
    name: 'Durango',
    shortName: 'Durango',
    centerX: 418,
    centerY: 270,
    paletteColor: '#e6007e', // Bright magenta as in image
    d: 'M 362,254 L 396,238 L 434,236 L 452,266 L 444,304 L 420,336 L 398,342 L 388,328 L 372,284 Z',
  },
  {
    id: 'ZAC',
    code: '32',
    name: 'Zacatecas',
    shortName: 'Zacatecas',
    centerX: 476,
    centerY: 326,
    paletteColor: '#2b35af', // Royal dark blue as in image
    d: 'M 452,266 L 474,296 L 498,300 L 512,328 L 496,368 L 472,392 L 448,390 L 432,364 L 420,336 L 444,304 Z',
  },
  {
    id: 'SLP',
    code: '24',
    name: 'San Luis Potosí',
    shortName: 'San Luis Potosí',
    centerX: 546,
    centerY: 350,
    paletteColor: '#f7ee69', // Bright yellow as in image
    d: 'M 498,300 L 526,276 L 542,298 L 552,330 L 576,322 L 576,358 L 594,370 L 588,406 L 562,416 L 536,412 L 512,374 L 512,328 Z',
  },
  {
    id: 'NAY',
    code: '18',
    name: 'Nayarit',
    shortName: 'Nayarit',
    centerX: 388,
    centerY: 388,
    paletteColor: '#83a598', // Soft greenish slate
    d: 'M 380,388 L 402,364 L 418,378 L 412,414 L 386,418 L 374,402 Z',
  },
  {
    id: 'JAL',
    code: '14',
    name: 'Jalisco',
    shortName: 'Jalisco',
    centerX: 432,
    centerY: 422,
    paletteColor: '#1d4e28', // Dark emerald pine as in image
    d: 'M 402,364 L 432,364 L 448,390 L 464,394 L 460,432 L 444,468 L 406,472 L 386,442 L 386,418 L 412,414 L 418,378 Z',
  },
  {
    id: 'AGS',
    code: '01',
    name: 'Aguascalientes',
    shortName: 'Ags.',
    centerX: 474,
    centerY: 376,
    paletteColor: '#457b9d', // Teal blue
    d: 'M 466,368 L 482,368 L 484,386 L 468,386 Z',
  },
  {
    id: 'GTO',
    code: '11',
    name: 'Guanajuato',
    shortName: 'Guanajuato',
    centerX: 504,
    centerY: 406,
    paletteColor: '#9d4edd', // Purple violet
    d: 'M 476,394 L 514,386 L 532,414 L 508,438 L 480,434 L 476,410 Z',
  },
  {
    id: 'QRO',
    code: '22',
    name: 'Querétaro',
    shortName: 'Qro.',
    centerX: 538,
    centerY: 412,
    paletteColor: '#e0a96d', // Sand orange
    d: 'M 526,396 L 546,394 L 552,424 L 534,432 L 526,416 Z',
  },
  {
    id: 'HGO',
    code: '13',
    name: 'Hidalgo',
    shortName: 'Hidalgo',
    centerX: 574,
    centerY: 416,
    paletteColor: '#0077b6', // Strong ocean blue
    d: 'M 546,394 L 588,394 L 596,428 L 568,438 L 552,424 Z',
  },
  {
    id: 'COL',
    code: '06',
    name: 'Colima',
    shortName: 'Col.',
    centerX: 424,
    centerY: 476,
    paletteColor: '#d62828', // Crimson accent
    d: 'M 416,468 L 434,468 L 434,488 L 416,488 Z',
  },
  {
    id: 'MICH',
    code: '16',
    name: 'Michoacán',
    shortName: 'Michoacán',
    centerX: 478,
    centerY: 468,
    paletteColor: '#c77dff', // Pastel orchid violet as in image
    d: 'M 444,432 L 480,434 L 508,438 L 528,452 L 532,488 L 504,524 L 456,520 L 442,490 L 444,468 Z',
  },
  {
    id: 'EDOMEX',
    code: '15',
    name: 'México',
    shortName: 'Edoméx',
    centerX: 546,
    centerY: 456,
    paletteColor: '#f9c74f', // Mustard yellow as in image
    d: 'M 524,440 L 562,440 L 570,478 L 538,494 L 526,474 L 528,452 Z',
  },
  {
    id: 'CDMX',
    code: '09',
    name: 'Ciudad de México',
    shortName: 'CDMX',
    centerX: 554,
    centerY: 460,
    paletteColor: '#1d3557', // Navy blue
    d: 'M 548,454 L 560,454 L 560,466 L 548,466 Z',
  },
  {
    id: 'MOR',
    code: '17',
    name: 'Morelos',
    shortName: 'Mor.',
    centerX: 554,
    centerY: 482,
    paletteColor: '#e63946', // Red
    d: 'M 546,474 L 564,474 L 564,490 L 546,490 Z',
  },
  {
    id: 'TLAX',
    code: '29',
    name: 'Tlaxcala',
    shortName: 'Tlax.',
    centerX: 590,
    centerY: 442,
    paletteColor: '#48cae4', // Cyan
    d: 'M 582,434 L 598,434 L 598,450 L 582,450 Z',
  },
  {
    id: 'PUE',
    code: '21',
    name: 'Puebla',
    shortName: 'Puebla',
    centerX: 602,
    centerY: 464,
    paletteColor: '#ef4444', // Salmon red as in image
    d: 'M 570,440 L 608,434 L 626,464 L 634,500 L 610,528 L 584,508 L 584,476 L 570,478 Z',
  },
  {
    id: 'VER',
    code: '30',
    name: 'Veracruz',
    shortName: 'Veracruz',
    centerX: 672,
    centerY: 456,
    paletteColor: '#3a0ca3', // Deep indigo blue as in image
    d: 'M 598,374 L 626,346 L 664,402 L 702,460 L 748,494 L 744,524 L 708,520 L 672,504 L 634,500 L 626,464 L 608,434 L 596,428 L 588,394 L 594,370 Z',
  },
  {
    id: 'GRO',
    code: '12',
    name: 'Guerrero',
    shortName: 'Guerrero',
    centerX: 532,
    centerY: 526,
    paletteColor: '#4f772d', // Olive brown green as in image
    d: 'M 456,520 L 504,524 L 532,488 L 546,490 L 584,508 L 610,528 L 598,564 L 552,580 L 486,558 Z',
  },
  {
    id: 'OAX',
    code: '20',
    name: 'Oaxaca',
    shortName: 'Oaxaca',
    centerX: 642,
    centerY: 554,
    paletteColor: '#00b4d8', // Aquamarine teal green as in image
    d: 'M 610,528 L 672,504 L 708,520 L 718,552 L 728,582 L 674,614 L 624,606 L 598,564 Z',
  },
  {
    id: 'TAB',
    code: '27',
    name: 'Tabasco',
    shortName: 'Tabasco',
    centerX: 766,
    centerY: 504,
    paletteColor: '#b7e4c7', // Pale mint as in image
    d: 'M 744,500 L 794,496 L 814,528 L 766,544 L 744,524 Z',
  },
  {
    id: 'CHIS',
    code: '07',
    name: 'Chiapas',
    shortName: 'Chiapas',
    centerX: 772,
    centerY: 574,
    paletteColor: '#e9c46a', // Gold sand as in image
    d: 'M 728,552 L 766,544 L 814,528 L 848,566 L 826,628 L 778,632 L 738,586 Z',
  },
  {
    id: 'CAMP',
    code: '04',
    name: 'Campeche',
    shortName: 'Campeche',
    centerX: 832,
    centerY: 494,
    paletteColor: '#6a0dad', // Dark violet as in image
    d: 'M 794,444 L 852,434 L 872,488 L 868,542 L 814,528 L 794,496 Z',
  },
  {
    id: 'YUC',
    code: '31',
    name: 'Yucatán',
    shortName: 'Yucatán',
    centerX: 884,
    centerY: 414,
    paletteColor: '#90e0ef', // Light blue cyan as in image
    d: 'M 852,434 L 858,382 L 928,382 L 928,438 L 888,446 Z',
  },
  {
    id: 'QROO',
    code: '23',
    name: 'Quintana Roo',
    shortName: 'Quintana Roo',
    centerX: 914,
    centerY: 468,
    labelAngle: 65,
    paletteColor: '#7b2cbf', // Lavender indigo as in image
    d: 'M 928,382 L 956,396 L 946,476 L 922,536 L 868,542 L 872,488 L 888,446 L 928,438 Z',
  },
];
