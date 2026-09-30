import palmCove from './palmCove.js';
import pineValley from './pineValley.js';
import snowPeak from './snowPeak.js';
import nightCity from './nightCity.js';
import volcano from './volcano.js';

// Tüm pistler. Yeni pist eklemek için tanım dosyasını buraya ekleyin.
export const TRACKS = { palmCove, pineValley, snowPeak, nightCity, volcano };

// Turbo Kupası setleri: Kupa = ilk dört klasik pist, Büyük Kupa = hepsi
export const CUP_SETS = { cup: ['palmCove', 'pineValley', 'snowPeak', 'nightCity'], bigCup: Object.keys(TRACKS) };
export const TRACK_IDS = Object.keys(TRACKS);
