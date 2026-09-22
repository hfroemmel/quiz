/**
 * Generates placeholder media for the bundled example package.
 *
 * IMPORTANT: These graphics are deliberately abstract. They show nothing that
 * could give away the solution, and they are no substitute for editorially
 * approved image material. Before a real event the files under
 * `content/source/assets/questions/` are replaced by the approved images
 * (same file name, or adjust the file name in `assets.json`).
 *
 * The graphics are derived deterministically from the asset id so that
 * repeated runs produce reproducible files.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mediaAssetSchema, questionSchema } from '@hfroemmel/quiz-core'
import { contentDir } from './dirs'
import { readJson, resolveAssetPath } from '../package'

/** Stable hash of a string - replaces randomness so that builds stay reproducible. */
function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function paletteFor(id: string): { background: string; shapes: string[] } {
  const hue = hash(id) % 360
  return {
    background: `hsl(${hue} 45% 18%)`,
    shapes: [
      `hsl(${(hue + 25) % 360} 70% 55%)`,
      `hsl(${(hue + 190) % 360} 65% 60%)`,
      `hsl(${(hue + 95) % 360} 60% 48%)`,
    ],
  }
}

/** Abstract composition: gives nothing away but fills the whole area. */
function questionImageSvg(id: string): string {
  const palette = paletteFor(id)
  const seed = hash(id)
  const shapes: string[] = []
  for (let index = 0; index < 7; index += 1) {
    const local = hash(`${id}:${index}`)
    const cx = 120 + (local % 960)
    const cy = 100 + ((local >> 8) % 480)
    const radius = 70 + ((local >> 16) % 190)
    const color = palette.shapes[index % palette.shapes.length]!
    shapes.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" opacity="0.5" />`)
  }
  const angle = seed % 60
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675" role="img" aria-label="Platzhalterbild">
  <rect width="1200" height="675" fill="${palette.background}" />
  <g transform="rotate(${angle} 600 337)">${shapes.join('')}</g>
  <rect x="0" y="600" width="1200" height="75" fill="rgba(0,0,0,0.45)" />
  <text x="24" y="648" font-family="sans-serif" font-size="28" fill="#ffffff" opacity="0.75">Platzhaltergrafik - bitte ersetzen</text>
</svg>
`
}

function brandingSvg(id: string, label: string): string {
  const palette = paletteFor(id)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.background}" />
      <stop offset="100%" stop-color="${palette.shapes[2]}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)" />
  <circle cx="600" cy="300" r="190" fill="none" stroke="${palette.shapes[0]}" stroke-width="14" />
  <text x="600" y="322" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="120" fill="${palette.shapes[0]}">?</text>
  <text x="600" y="560" text-anchor="middle" font-family="sans-serif" font-size="54" fill="#ffffff" opacity="0.9">${label}</text>
</svg>
`
}

const brandingLabels: Record<string, string> = {
  'logo-quiz': 'Abendquiz',
  'logo-kids': 'Kinderquiz',
  'logo-regional': 'Regionalquiz',
  'start-adults': 'Abendquiz',
  'start-kids': 'Kinderquiz',
  'start-regional': 'Regionalquiz',
}

function main(): void {
  const contentSourceDir = contentDir(process.argv.slice(2), 'source', 'source')
  /*
   * TWO PLACES NAME A FILE. `assets.json` holds the house's media, referenced
   * by id from the configuration; the questions carry their own. A file named
   * by several questions is drawn once - the set is what matters.
   */
  const assets = mediaAssetSchema.array().parse(readJson(join(contentSourceDir, 'assets.json')))
  const questions = questionSchema.array().parse(readJson(join(contentSourceDir, 'questions.json')))
  const wanted = new Map<string, string>()
  for (const asset of assets) wanted.set(asset.filename, asset.id)
  for (const question of questions) {
    for (const medium of [question.image]) {
      if (medium && !wanted.has(medium.filename)) wanted.set(medium.filename, question.id)
    }
  }
  let written = 0
  let kept = 0

  for (const [filename, label] of wanted) {
    if (!filename.endsWith('.svg')) continue
    const target = resolveAssetPath(contentSourceDir, filename)
    if (!target) {
      throw new Error(`Asset-Pfad "${filename}" liegt ausserhalb des Asset-Verzeichnisses.`)
    }
    // Existing files stay untouched: as soon as approved material is in the
    // pool, a repeated run must not replace it with a placeholder
    // again.
    if (existsSync(target)) {
      kept += 1
      continue
    }
    mkdirSync(dirname(target), { recursive: true })
    const branding = brandingLabels[label]
    writeFileSync(target, branding ? brandingSvg(label, branding) : questionImageSvg(label), 'utf8')
    written += 1
  }

  console.log(`${written} Platzhalter-Medien erzeugt, ${kept} vorhandene Dateien unveraendert.`)
  console.log(`Verzeichnis: ${join(contentSourceDir, 'assets')}.`)
  console.log('Hinweis: Vor der Veranstaltung durch freigegebenes Material ersetzen.')
}

main()
