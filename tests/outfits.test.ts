import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE, GEM_EXCHANGE, GEM_PACKS, HAIR_COLORS, OUTFITS, SKIN_TONES, STARTER_OUTFITS, buildLook, getOutfit } from '../src/lib/outfits'
import { GEMS_PER_LEVEL, REWARDS } from '../src/lib/progression'

const SQL = readFileSync(resolve(__dirname, '../supabase/schema.sql'), 'utf8')
const HEX = /^#[0-9a-f]{6}$/i

describe('Katalog strojów', () => {
  it('T-OU-01 identyfikatory strojów są unikalne', () => {
    const ids = OUTFITS.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('T-OU-02 dokładnie 2 stroje startowe są darmowe (TEB niebieski i biały)', () => {
    expect(STARTER_OUTFITS).toEqual(['teb-blue', 'teb-white'])
  })

  it('T-OU-03 każdy płatny strój ma cenę w monetach ALBO klejnotach, większą od zera', () => {
    for (const o of OUTFITS.filter((x) => x.price)) {
      const c = o.price!.coins ?? 0
      const g = o.price!.gems ?? 0
      expect(c > 0 !== g > 0, o.id).toBe(true)
    }
  })

  it('T-OU-04 wszystkie kolory są poprawnym zapisem #RRGGBB', () => {
    for (const o of OUTFITS) for (const col of [o.jersey, o.jersey2, o.trim, o.shorts, o.shoes]) expect(col, o.id).toMatch(HEX)
    for (const col of [...SKIN_TONES, ...HAIR_COLORS]) expect(col).toMatch(HEX)
  })

  it('T-OU-05 każdy strój ma nazwę po polsku i angielsku', () => {
    for (const o of OUTFITS) {
      expect(o.name.pl.length).toBeGreaterThan(1)
      expect(o.name.en.length).toBeGreaterThan(1)
    }
  })

  it('T-OU-06 nieznany strój → bezpieczny fallback na pierwszy z katalogu', () => {
    expect(getOutfit('nie-istnieje').id).toBe('teb-blue')
  })

  it('T-OU-07 buildLook łączy strój z wyglądem i nie gubi wzoru', () => {
    const look = buildLook('pinstripe', { skin: 2, hair: 4, hairColor: 1, number: 23 }, 'TEB')
    expect(look).toMatchObject({ pattern: 'stripes', number: 23, label: 'TEB', skin: SKIN_TONES[2], hair: HAIR_COLORS[1] })
    expect(look.hairStyle).toBe(1) // 4 % 3 fryzury
  })

  it('T-OU-08 wymiana klejnotów zawsze opłaca się bardziej przy większym pakiecie', () => {
    const rate = GEM_EXCHANGE.map((x) => x.coins / x.gems)
    for (let i = 1; i < rate.length; i++) expect(rate[i]).toBeGreaterThanOrEqual(rate[i - 1])
  })

  it('T-OU-09 domyślny wygląd ma numer 12 (jak na grafice ze specyfikacji)', () => {
    expect(DEFAULT_APPEARANCE.number).toBe(12)
  })
})

describe('Zgodność klient ↔ serwer (supabase/schema.sql)', () => {
  it('T-SQL-01 ceny strojów w bazie = ceny w grze', () => {
    const rows = [...SQL.matchAll(/\('([a-z0-9-]+)',\s*'outfit',\s*(\d+),\s*(\d+)\)/g)].map((m) => ({ id: m[1], coins: +m[2], gems: +m[3] }))
    const paid = OUTFITS.filter((o) => o.price)
    expect(rows.length).toBe(paid.length)
    for (const o of paid) {
      const row = rows.find((r) => r.id === o.id)
      expect(row, `brak ${o.id} w shop_items`).toBeDefined()
      expect(row!.coins).toBe(o.price!.coins ?? 0)
      expect(row!.gems).toBe(o.price!.gems ?? 0)
    }
  })

  it('T-SQL-02 nagrody XP i monet w finish_match() = REWARDS w progression.ts', () => {
    expect(SQL).toContain(`v_xp := case when v_won then ${REWARDS.quick.win.xp} else ${REWARDS.quick.loss.xp} end`)
    expect(SQL).toContain(`v_xp := case when v_won then ${REWARDS.ranked.win.xp} else ${REWARDS.ranked.loss.xp} end`)
    expect(SQL).toContain(`v_coins := case when v_won then ${REWARDS.ranked.win.coins} else ${REWARDS.ranked.loss.coins} end`)
    expect(SQL).toContain(`least(${REWARDS.practice.maxXp}, ${REWARDS.practice.baseXp} + least(p_makes, 15))`)
  })

  it('T-SQL-03 klejnoty za awans w bazie = GEMS_PER_LEVEL', () => {
    expect(SQL).toContain(`gems = gems + v_levels * ${GEMS_PER_LEVEL}`)
  })

  it('T-SQL-04 nowe konto startuje z 0 monet i 0 klejnotów', () => {
    expect(SQL).toMatch(/coins\s+int\s+not null default 0\s/)
    expect(SQL).toMatch(/gems\s+int\s+not null default 0\s/)
  })

  it('T-SQL-05 pakiety wymiany i mock płatności mają te same ID co w grze', () => {
    for (const x of GEM_EXCHANGE) expect(SQL).toContain(`('${x.id}', ${x.gems}, ${x.coins})`)
    for (const p of GEM_PACKS) expect(SQL).toContain(`'${p.id}' then ${p.gems}`)
  })

  it('T-SQL-06 RLS włączone na wszystkich tabelach, klient nie może zmieniać waluty', () => {
    for (const t of ['profiles', 'matches', 'shop_items', 'purchases']) expect(SQL).toMatch(new RegExp(`alter table public\\.${t}\\s+enable row level security`))
    expect(SQL).toContain('grant update (username, outfit, appearance, settings) on public.profiles to authenticated')
    expect(SQL).not.toMatch(/grant update \([^)]*coins/)
  })
})
