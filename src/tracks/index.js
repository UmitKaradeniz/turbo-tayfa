import palmCove from './palmCove.js';
import pineValley from './pineValley.js';
import snowPeak from './snowPeak.js';
import nightCity from './nightCity.js';

// Tüm pistler. Yeni pist eklemek için tanım dosyasını buraya ekleyin.
export const TRACKS = { palmCove, pineValley, snowPeak, nightCity };
export const TRACK_IDS = Object.keys(TRACKS);
