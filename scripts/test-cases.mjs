/**
 * Builds docs/testy/PRZYPADKI-TESTOWE.md (the full test-case table) from the real
 * test log written by `npm run test:log`, so the documentation always matches
 * what actually ran.
 *
 *   npm run test:log && node scripts/test-cases.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const log = readFileSync(resolve(root, 'docs/testy/logi/przebieg-testow.log'), 'utf8')

const MODULE = {
  'engine.test.ts': 'Silnik gry (`src/game/engine.ts`)',
  'progression.test.ts': 'Progresja i balans (`src/lib/progression.ts`)',
  'outfits.test.ts': 'Stroje + zgodność z bazą (`src/lib/outfits.ts`, `supabase/schema.sql`)',
  'api.test.ts': 'Backend offline (`src/lib/api.ts`)',
  'balance.test.ts': 'Symulacje meczów (cały silnik + AI)',
}

const header = log.split('\n').slice(0, 11).join('\n')
const rows = []
for (const line of log.split('\n')) {
  const m = line.match(/^\s*([✓×↓])\s+tests\/(\S+)\s+>\s+(.+?)\s+>\s+(.+?)(?:\s+\d+ms)?\s*$/)
  if (!m) continue
  const [, mark, file, group, rest] = m
  const id = rest.match(/^(T-[A-Z]+-\d+)\s+(.*)$/)
  rows.push({
    id: id ? id[1] : '—',
    desc: id ? id[2] : rest,
    module: MODULE[file] ?? file,
    group,
    ok: mark === '✓' ? '✅ zaliczony' : mark === '×' ? '❌ niezaliczony' : 'pominięty',
  })
}

const byModule = Object.values(MODULE).map((mod) => {
  const rs = rows.filter((r) => r.module === mod)
  return `| ${mod} | ${rs.length} | ${rs.filter((r) => r.ok.startsWith('✅')).length} |`
})

const md = [
  '# Przypadki testowe — pełna lista',
  '',
  'Plik wygenerowany automatycznie skryptem `scripts/test-cases.mjs` z prawdziwego logu',
  '[`logi/przebieg-testow.log`](logi/przebieg-testow.log). Nie edytuj ręcznie — uruchom ponownie:',
  '',
  '```bash',
  'npm run test:log && node scripts/test-cases.mjs',
  '```',
  '',
  '## Nagłówek uruchomienia',
  '',
  '```',
  header.trim(),
  '```',
  '',
  '## Podsumowanie według modułów',
  '',
  '| Moduł | Liczba testów | Zaliczone |',
  '|---|---|---|',
  ...byModule,
  `| **Razem** | **${rows.length}** | **${rows.filter((r) => r.ok.startsWith('✅')).length}** |`,
  '',
  '## Wszystkie przypadki',
  '',
  '| ID | Moduł | Grupa | Co sprawdza (oczekiwany wynik) | Wynik |',
  '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} | ${r.module.split(' (')[0]} | ${r.group} | ${r.desc.replace(/\|/g, '\\|')} | ${r.ok} |`),
  '',
].join('\n')

writeFileSync(resolve(root, 'docs/testy/PRZYPADKI-TESTOWE.md'), md, 'utf8')
console.log(`Zapisano ${rows.length} przypadków testowych → docs/testy/PRZYPADKI-TESTOWE.md`)
