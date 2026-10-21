import type { Appearance, Lang } from '../types'

export type JerseyPattern = 'none' | 'stripes' | 'gradient' | 'stars' | 'sash'

export interface Outfit {
  id: string
  name: Record<Lang, string>
  jersey: string
  /** secondary colour used by the pattern */
  jersey2: string
  pattern: JerseyPattern
  trim: string
  shorts: string
  shoes: string
  /** null = free / starter */
  price: { coins?: number; gems?: number } | null
}

const o = (
  id: string, pl: string, en: string, jersey: string, trim: string, shorts: string, shoes: string,
  price: Outfit['price'], pattern: JerseyPattern = 'none', jersey2 = trim,
): Outfit => ({ id, name: { pl, en }, jersey, jersey2, pattern, trim, shorts, shoes, price })

// Prices must match the shop_items seed in supabase/schema.sql
export const OUTFITS: Outfit[] = [
  o('teb-blue', 'TEB Niebieski', 'TEB Blue', '#2f6fd0', '#ffffff', '#2f6fd0', '#2a62c9', null),
  o('teb-white', 'TEB Biały', 'TEB White', '#f4f6f8', '#2f6fd0', '#f4f6f8', '#2f6fd0', null),
  o('mint', 'Miętowy', 'Mint', '#5fd4b4', '#0f4d40', '#3fb898', '#ffffff', { coins: 250 }),
  o('fire-red', 'Ognisty', 'Fire Red', '#d93a3a', '#ffffff', '#c22f2f', '#ffffff', { coins: 300 }),
  o('cherry', 'Wiśniowy', 'Cherry', '#7a1f35', '#f4d4dc', '#5e1628', '#f4d4dc', { coins: 400 }),
  o('retro-orange', 'Retro', 'Retro', '#f08a24', '#1f3d7a', '#1f3d7a', '#f08a24', { coins: 450 }),
  o('night-black', 'Nocny', 'Night', '#23262b', '#f2b631', '#23262b', '#f2b631', { coins: 600 }),
  o('ice', 'Lodowy', 'Ice', '#bfe3ff', '#1d4f8a', '#9fd0f5', '#ffffff', { coins: 700 }),
  o('neon', 'Neon', 'Neon', '#3fd16b', '#13331f', '#2bb257', '#13331f', { coins: 800 }),
  o('camo', 'Moro', 'Camo', '#5d6b3a', '#e3d8a8', '#4a552d', '#3a3a2a', { coins: 900 }),
  o('pinstripe', 'Prążki', 'Pinstripe', '#f4f6f8', '#1f2a44', '#1f2a44', '#1f2a44', { coins: 1200 }, 'stripes', '#1f2a44'),
  o('lava', 'Lawa', 'Lava', '#1c1c1f', '#ff7a1a', '#1c1c1f', '#ff7a1a', { coins: 1500 }, 'gradient', '#d1400f'),
  o('cyber', 'Cyber', 'Cyber', '#141824', '#36f0ff', '#141824', '#36f0ff', { coins: 2000 }, 'sash', '#36f0ff'),
  o('flamingo', 'Flaming', 'Flamingo', '#ff8fbf', '#ffffff', '#f06aa6', '#ffffff', { gems: 40 }, 'gradient', '#ffc06a'),
  o('galaxy', 'Galaktyka', 'Galaxy', '#4e2aa3', '#f0c3ff', '#3a1f7a', '#f0c3ff', { gems: 60 }, 'stars', '#f0c3ff'),
  o('sunset', 'Zachód słońca', 'Sunset', '#ff6a3d', '#2b1640', '#2b1640', '#ffd23f', { gems: 80 }, 'gradient', '#7b2f8e'),
  o('royal', 'Królewski', 'Royal', '#3b2a8f', '#e8b630', '#2d206e', '#e8b630', { gems: 100 }, 'sash', '#e8b630'),
  o('gold-legend', 'Złota Legenda', 'Gold Legend', '#e8b630', '#7a4b00', '#d6a21f', '#ffffff', { gems: 150 }, 'stars', '#fff3c4'),
]

export const STARTER_OUTFITS = OUTFITS.filter((o) => !o.price).map((o) => o.id)
export const getOutfit = (id: string) => OUTFITS.find((o) => o.id === id) ?? OUTFITS[0]

export const SKIN_TONES = ['#f6d3b3', '#e8b48f', '#c68a5e', '#8d5a3b', '#5e3a26']
export const HAIR_COLORS = ['#5a3b22', '#2a1d14', '#c9a15b', '#a0522d', '#d8d8d8']
export const HAIR_STYLES = 3

export interface Look {
  jersey: string
  jersey2: string
  pattern: JerseyPattern
  trim: string
  shorts: string
  shoes: string
  skin: string
  hair: string
  hairStyle: number
  number: number
  label: string
}

export function buildLook(outfitId: string, a: Appearance, label = 'TEB'): Look {
  const o = getOutfit(outfitId)
  return {
    jersey: o.jersey,
    jersey2: o.jersey2,
    pattern: o.pattern,
    trim: o.trim,
    shorts: o.shorts,
    shoes: o.shoes,
    skin: SKIN_TONES[a.skin] ?? SKIN_TONES[0],
    hair: HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0],
    hairStyle: a.hair % HAIR_STYLES,
    number: a.number,
    label,
  }
}

export const DEFAULT_APPEARANCE: Appearance = { skin: 0, hair: 0, hairColor: 0, number: 12 }

export const GEM_EXCHANGE = [
  { id: 'x10', gems: 10, coins: 1000 },
  { id: 'x50', gems: 50, coins: 5500 },
  { id: 'x100', gems: 100, coins: 12000 },
]

/** Mock real-money packs — payments are out of MVP scope. Keep ids in sync with mock_purchase(). */
export const GEM_PACKS = [
  { id: 'gems_100', gems: 100, price: '4,99 zł' },
  { id: 'gems_550', gems: 550, price: '19,99 zł' },
  { id: 'gems_1200', gems: 1200, price: '39,99 zł' },
]
