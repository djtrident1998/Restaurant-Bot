// Photos come from Unsplash (free licence). Menu items store just the photo id; sizes are requested from the CDN.
const BASE = "https://images.unsplash.com/photo-";

export function photoUrl(id: string, w: number, h?: number): string {
  return `${BASE}${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ""}&q=72`;
}

// Landing-page photography (verified to load; see docs/IMAGES.md).
export const HERO_PHOTO = "1774989423979-6a7bf5add3f0"; // warm-lit restaurant interior
export const FEAST_PHOTO = "1682862279256-b2a9e4f3d22c"; // overhead Indian feast
export const COPPER_PHOTO = "1728910156510-77488f19b152"; // curry served in a copper bowl
export const THALI_PHOTO = "1742281257687-092746ad6021"; // thali
export const TANDOOR_PHOTO = "1792582427557-14fa39dbe877"; // breads in the tandoor
