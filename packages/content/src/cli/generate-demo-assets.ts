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
import { mediaAssetSchema } from '@hfroemmel/quiz-core'
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

/* ------------------------------------------------------------------ *
 * Video placeholder
 * ------------------------------------------------------------------ */

/** An MP4 box: length, type, content. */
function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const payload = Buffer.concat(parts)
  const header = Buffer.alloc(8)
  header.writeUInt32BE(payload.length + 8, 0)
  header.write(type, 4, 'ascii')
  return Buffer.concat([header, payload])
}

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values)
}

function uint32(value: number): Uint8Array {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32BE(value, 0)
  return buffer
}

/**
 * A valid, EMPTY MP4 container.
 *
 * WHAT FOR: A video question needs a file, otherwise validation fails and the
 * question would be unplayable. A real video cannot be produced here - there
 * is no encoder, and a placeholder video would be as meaningless as a
 * placeholder graphic anyway.
 *
 * So a container with a video track WITHOUT picture data is produced: the
 * browser loads it, reports the duration and ends immediately. The flow can
 * thus be played through completely - what is visible is the stage's
 * placeholder area, exactly as with a media error.
 *
 * The boxes are in the order of the standard (ISO/IEC 14496-12); timescale
 * and duration are 1000 and 1000, i.e. one second.
 */
function placeholderMp4(): Uint8Array {
  const timescale = uint32(1000)
  const duration = uint32(1000)

  const ftyp = box('ftyp', Buffer.from('isom', 'ascii'), uint32(0x200), Buffer.from('isomiso2mp41', 'ascii'))

  const mvhd = box(
    'mvhd',
    bytes(0, 0, 0, 0), // Version 0, keine Flags
    uint32(0), // Erstellung
    uint32(0), // Aenderung
    timescale,
    duration,
    uint32(0x00010000), // Abspielrate 1.0
    bytes(1, 0, 0, 0), // Lautstaerke 1.0, Reserve
    new Uint8Array(8), // Reserve
    // Identity matrix
    Buffer.concat([uint32(0x00010000), uint32(0), uint32(0), uint32(0), uint32(0x00010000), uint32(0), uint32(0), uint32(0), uint32(0x40000000)]),
    new Uint8Array(24), // vordefiniert
    uint32(2), // naechste Track-ID
  )

  const tkhd = box(
    'tkhd',
    bytes(0, 0, 0, 3), // Version 0, Flags: aktiviert und Teil des Films
    uint32(0),
    uint32(0),
    uint32(1), // Track-ID
    uint32(0), // Reserve
    duration,
    new Uint8Array(8), // Reserve
    bytes(0, 0, 0, 0), // Ebene, alternative Gruppe
    bytes(0, 0, 0, 0), // Lautstaerke (Video: 0), Reserve
    Buffer.concat([uint32(0x00010000), uint32(0), uint32(0), uint32(0), uint32(0x00010000), uint32(0), uint32(0), uint32(0), uint32(0x40000000)]),
    uint32(1280 << 16), // Breite als 16.16-Festkommazahl
    uint32(720 << 16), // Hoehe
  )

  const mdhd = box('mdhd', bytes(0, 0, 0, 0), uint32(0), uint32(0), timescale, duration, bytes(0x55, 0xc4), bytes(0, 0))
  const hdlr = box(
    'hdlr',
    bytes(0, 0, 0, 0),
    uint32(0),
    Buffer.from('vide', 'ascii'),
    new Uint8Array(12),
    Buffer.from('Platzhalter\0', 'ascii'),
  )
  const vmhd = box('vmhd', bytes(0, 0, 0, 1), new Uint8Array(8))
  const dref = box('dref', bytes(0, 0, 0, 0), uint32(1), box('url ', bytes(0, 0, 0, 1)))
  const dinf = box('dinf', dref)
  // Empty tables: the track deliberately contains not a single picture sample.
  const stbl = box(
    'stbl',
    box('stsd', bytes(0, 0, 0, 0), uint32(0)),
    box('stts', bytes(0, 0, 0, 0), uint32(0)),
    box('stsc', bytes(0, 0, 0, 0), uint32(0)),
    box('stsz', bytes(0, 0, 0, 0), uint32(0), uint32(0)),
    box('stco', bytes(0, 0, 0, 0), uint32(0)),
  )
  const minf = box('minf', vmhd, dinf, stbl)
  const mdia = box('mdia', mdhd, hdlr, minf)
  const trak = box('trak', tkhd, mdia)
  const moov = box('moov', mvhd, trak)

  return Buffer.concat([ftyp, moov, box('mdat')])
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
  const assets = mediaAssetSchema.array().parse(readJson(join(contentSourceDir, 'assets.json')))
  let written = 0
  let kept = 0

  for (const asset of assets) {
    const isImage = asset.kind === 'image' && asset.filename.endsWith('.svg')
    const isVideo = asset.kind === 'video' && asset.filename.endsWith('.mp4')
    if (!isImage && !isVideo) continue
    const target = resolveAssetPath(contentSourceDir, asset.filename)
    if (!target) {
      throw new Error(`Asset-Pfad "${asset.filename}" liegt ausserhalb des Asset-Verzeichnisses.`)
    }
    // Existing files stay untouched: as soon as approved material is in the
    // pool, a repeated run must not replace it with a placeholder
    // again.
    if (existsSync(target)) {
      kept += 1
      continue
    }
    mkdirSync(dirname(target), { recursive: true })
    if (isVideo) {
      writeFileSync(target, placeholderMp4())
    } else {
      const label = brandingLabels[asset.id]
      writeFileSync(target, label ? brandingSvg(asset.id, label) : questionImageSvg(asset.id), 'utf8')
    }
    written += 1
  }

  console.log(`${written} Platzhalter-Medien erzeugt, ${kept} vorhandene Dateien unveraendert.`)
  console.log(`Verzeichnis: ${join(contentSourceDir, 'assets')}.`)
  console.log('Hinweis: Vor der Veranstaltung durch freigegebenes Material ersetzen.')
}

main()
