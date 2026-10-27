/**
 * Runs the whole test suite and saves the full console output as a dated log
 * for the school documentation: docs/testy/logi/przebieg-testow.log
 *
 *   npm run test:log
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'docs/testy/logi/przebieg-testow.log')

const git = (args) => {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : 'brak'
}

const started = new Date()
const run = spawnSync('npx', ['vitest', 'run', '--reporter=verbose', '--no-color'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
})
const ms = Date.now() - started.getTime()
// strip any remaining ANSI colour codes
const clean = (s) => (s ?? '').replace(/\u001b\[[0-9;]*m/g, '')

const header = [
  '=====================================================================',
  ' tebBasket — log z uruchomienia testów automatycznych',
  '=====================================================================',
  ` Data:         ${started.toLocaleString('pl-PL')}`,
  ` Node.js:      ${process.version} (${process.platform} ${process.arch})`,
  ` Commit:       ${git(['rev-parse', '--short', 'HEAD'])} (${git(['rev-parse', '--abbrev-ref', 'HEAD'])})`,
  ` Polecenie:    npx vitest run --reporter=verbose`,
  ` Czas trwania: ${(ms / 1000).toFixed(1)} s`,
  ` Kod wyjścia:  ${run.status} (${run.status === 0 ? 'WSZYSTKIE TESTY ZALICZONE' : 'SĄ BŁĘDY'})`,
  '=====================================================================',
  '',
].join('\n')

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, header + clean(run.stdout) + clean(run.stderr), 'utf8')
process.stdout.write(clean(run.stdout))
process.stderr.write(clean(run.stderr))
console.log(`\nLog zapisany: ${out}`)
process.exit(run.status ?? 1)
