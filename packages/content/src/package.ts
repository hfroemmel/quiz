/**
 * Laden und Bauen versionierter Quizpakete (Spezifikation 24.2 und 24.3).
 *
 * Ein Build der Veranstaltungssoftware darf zur Laufzeit niemals von Google Sheets
 * abhaengen. Deshalb liegt das Ergebnis immer als geprueftes, versioniertes Paket im
 * Projekt beziehungsweise Build-Artefakt.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import {
  QUIZ_PACKAGE_SCHEMA_VERSION,
  mediaAssetSchema,
  questionSchema,
  quizConfigSchema,
  quizPackageManifestSchema,
  resolveThemeColors,
  type MediaAsset,
  type Question,
  type QuizConfig,
  type QuizPackage,
  type QuizPackageManifest,
} from '@quiz/contracts'
import { validateContent, type IssueSeverity, type ValidationResult } from './validate.ts'

export const ASSET_DIRECTORY = 'assets'
export const QUESTIONS_FILE = 'questions.json'
export const CONFIG_FILE = 'config.json'
export const ASSETS_FILE = 'assets.json'
export const MANIFEST_FILE = 'manifest.json'

export interface RawSource {
  config: unknown
  questions: unknown
  assets: MediaAsset[]
  rootDir: string
}

/** Liest ein Quellverzeichnis (`content/source`) ohne zu validieren. */
export function readSource(sourceDir: string): RawSource {
  const config = readJson(join(sourceDir, CONFIG_FILE))
  const questions = readJson(join(sourceDir, QUESTIONS_FILE))
  const assetsRaw = readJson(join(sourceDir, ASSETS_FILE))
  const assets = mediaAssetSchema.array().parse(assetsRaw)
  return { config, questions, assets, rootDir: sourceDir }
}

/**
 * Aufloesung eines Asset-Dateipfads.
 *
 * SICHERHEIT: Dateipfade aus Quizdaten duerfen niemals zu beliebigen lokalen Dateien
 * aufgeloest werden (Spezifikation 30). Der aufgeloeste Pfad muss innerhalb des
 * Asset-Verzeichnisses liegen, sonst gibt es `null`.
 */
export function resolveAssetPath(rootDir: string, filename: string): string | null {
  const assetRoot = resolve(rootDir, ASSET_DIRECTORY)
  const candidate = resolve(assetRoot, filename)
  if (candidate !== assetRoot && !candidate.startsWith(assetRoot + sep)) return null
  return candidate
}

export function assetFileExists(rootDir: string, asset: MediaAsset): boolean {
  const path = resolveAssetPath(rootDir, asset.filename)
  return path !== null && existsSync(path) && statSync(path).isFile()
}

export interface SourceValidationOptions {
  contentVersion?: string
  /** Siehe `ValidationInput.missingMediaSeverity`. Standard ist `'error'`. */
  missingMediaSeverity?: IssueSeverity
}

export function validateSource(source: RawSource, options: SourceValidationOptions = {}): ValidationResult {
  return validateContent({
    config: source.config,
    questions: source.questions,
    assets: source.assets,
    assetFileExists: (asset) => assetFileExists(source.rootDir, asset),
    contentVersion: options.contentVersion,
    missingMediaSeverity: options.missingMediaSeverity,
  })
}

export interface BuildOptions {
  sourceDir: string
  outDir: string
  contentVersion: string
  sourceRevision?: string
  createdAt: string
  /** Siehe `ValidationInput.missingMediaSeverity`. Standard ist `'error'`. */
  missingMediaSeverity?: IssueSeverity
}

export interface BuildResult {
  manifest: QuizPackageManifest
  validation: ValidationResult
  outDir: string
  /** Medien ohne Datei - nur bei deaktivierten Fragen moeglich. */
  missingAssetFiles: string[]
}

/**
 * Baut ein normalisiertes, versioniertes Paket. Bricht bei Schemafehlern ab -
 * Warnungen laufen durch, muessen aber im Bericht bewusst freigegeben werden.
 */
export function buildPackage(options: BuildOptions): BuildResult {
  const source = readSource(options.sourceDir)
  const validation = validateSource(source, {
    contentVersion: options.contentVersion,
    missingMediaSeverity: options.missingMediaSeverity,
  })
  if (!validation.ok) {
    return { manifest: emptyManifest(options), validation, outDir: options.outDir, missingAssetFiles: [] }
  }

  const sourceConfig = quizConfigSchema.parse(source.config)
  /*
   * Die Themes verlassen die Quelle mit ihren Abweichungen und kommen mit dem
   * vollstaendigen Farbsatz ins Paket. Nur so bleibt das Paket allein lesbar:
   * Server und Client sehen fertige Farben, ohne die Farbdatei zu kennen.
   *
   * DER ZWEITE `parse` IST PFLICHT, nicht Zierde: Die Pruefsumme laeuft ueber
   * `JSON.stringify`, und dort zaehlt die Reihenfolge der Schluessel. Ein
   * ergaenztes `colors` stuende am Ende des Objekts, waehrend der Ladeweg es
   * ueber das Schema an seinen Platz sortiert - das Paket wuerde beim Start mit
   * "Pruefsumme stimmt nicht" abgewiesen.
   */
  const config: QuizConfig = quizConfigSchema.parse({
    ...sourceConfig,
    themes: sourceConfig.themes.map((theme) => ({ ...theme, colors: resolveThemeColors(theme) })),
  })
  const questions = questionSchema.array().parse(source.questions)

  // Normalisierung: stabile Sortierung, damit Builds reproduzierbar sind.
  const normalizedQuestions = [...questions].sort((a, b) => a.id.localeCompare(b.id))
  const assets = [...source.assets]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((asset) => ({
      ...asset,
      checksum: asset.checksum ?? checksumOfFile(resolveAssetPath(source.rootDir, asset.filename)),
    }))

  mkdirSync(options.outDir, { recursive: true })
  // Das alte Manifest zuerst entfernen: Bricht der Build danach ab, liegt kein
  // Paket mehr da, das zu neuen Inhaltsdateien nicht passt. Ein halb geschriebenes
  // Paket wuerde sonst erst beim Laden ueber die Pruefsumme auffallen.
  rmSync(join(options.outDir, MANIFEST_FILE), { force: true })
  writeJson(join(options.outDir, CONFIG_FILE), config)
  writeJson(join(options.outDir, QUESTIONS_FILE), normalizedQuestions)
  writeJson(join(options.outDir, ASSETS_FILE), assets)

  const missingAssetFiles: string[] = []
  for (const asset of assets) {
    const from = resolveAssetPath(source.rootDir, asset.filename)
    const to = resolveAssetPath(options.outDir, asset.filename)
    if (!from || !to) continue
    if (!existsSync(from)) {
      // Die Validierung hat diesen Fall bereits geprueft: Fehlt die Datei einer
      // AKTIVEN Frage, waere der Build oben abgebrochen. Hier bleiben nur Medien
      // deaktivierter Fragen uebrig - die duerfen als Vorlage im Bestand liegen.
      missingAssetFiles.push(asset.filename)
      continue
    }
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(from, to)
  }

  const checksum = checksumOfContent(config, normalizedQuestions, assets)
  const manifest: QuizPackageManifest = quizPackageManifestSchema.parse({
    schemaVersion: QUIZ_PACKAGE_SCHEMA_VERSION,
    contentVersion: options.contentVersion,
    createdAt: options.createdAt,
    sourceRevision: options.sourceRevision,
    questionsFile: QUESTIONS_FILE,
    configFile: CONFIG_FILE,
    assets,
    checksum,
  })
  writeJson(join(options.outDir, MANIFEST_FILE), manifest)

  return { manifest, validation, outDir: options.outDir, missingAssetFiles }
}

/** Laedt ein gebautes Paket zur Laufzeit. Ungueltige Pakete werden nicht geladen. */
export function loadQuizPackage(packageDir: string): QuizPackage {
  const manifest = quizPackageManifestSchema.parse(readJson(join(packageDir, MANIFEST_FILE)))
  if (manifest.schemaVersion !== QUIZ_PACKAGE_SCHEMA_VERSION) {
    throw new Error(
      `Quizpaket hat Schemaversion ${manifest.schemaVersion}, erwartet wird ${QUIZ_PACKAGE_SCHEMA_VERSION}. Bitte Paket neu bauen.`,
    )
  }
  const config: QuizConfig = quizConfigSchema.parse(readJson(join(packageDir, manifest.configFile)))
  const questions: Question[] = questionSchema.array().parse(readJson(join(packageDir, manifest.questionsFile)))

  const expected = checksumOfContent(config, questions, manifest.assets)
  if (expected !== manifest.checksum) {
    throw new Error('Pruefsumme des Quizpakets stimmt nicht. Bitte "pnpm content:build" erneut ausfuehren.')
  }

  return {
    manifest,
    config,
    questions,
    assetsById: new Map(manifest.assets.map((asset) => [asset.id, asset])),
    rootDir: packageDir,
  }
}

/** Liste aller Dateien unterhalb von `assets/` - fuer Preflight und Diagnose. */
export function listAssetFiles(rootDir: string): string[] {
  const assetRoot = join(rootDir, ASSET_DIRECTORY)
  if (!existsSync(assetRoot)) return []
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else out.push(relative(assetRoot, full).split(sep).join('/'))
    }
  }
  walk(assetRoot)
  return out.sort()
}

/* ------------------------------------------------------------------ *
 * Hilfsmittel
 * ------------------------------------------------------------------ */

export function readJson(path: string): unknown {
  if (!existsSync(path)) throw new Error(`Datei fehlt: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function checksumOfFile(path: string | null): string | undefined {
  if (!path || !existsSync(path)) return undefined
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 32)
}

/**
 * Pruefsumme ueber den Inhalt. Sie schuetzt vor der verbotenen Praxis, das gebaute
 * Basis-JSON waehrend der Show direkt zu bearbeiten - solche Aenderungen fallen
 * beim Laden sofort auf.
 */
function checksumOfContent(config: unknown, questions: unknown, assets: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify({ config, questions, assets }))
    .digest('hex')
}

function emptyManifest(options: BuildOptions): QuizPackageManifest {
  return {
    schemaVersion: QUIZ_PACKAGE_SCHEMA_VERSION,
    contentVersion: options.contentVersion,
    createdAt: options.createdAt,
    questionsFile: QUESTIONS_FILE,
    configFile: CONFIG_FILE,
    assets: [],
    checksum: '',
  }
}

export { basename }
