/**
 * Loading and building versioned quiz packages (specification 24.2 and 24.3).
 *
 * A build of the event software must never depend on Google Sheets at
 * runtime. That is why the result always lives as a validated, versioned
 * package in the project or in the build artifact.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import {
  QUIZ_PACKAGE_SCHEMA_VERSION,
  mediaAssetSchema,
  type ContentProfile,
  questionSchema,
  quizConfigSchema,
  quizPackageManifestSchema,
  type MediaAsset,
  type Question,
  type QuizConfig,
  type QuizPackage,
  type QuizPackageManifest,
} from '@hfroemmel/quiz-core'
import { validateContent, type IssueSeverity, type ValidationResult } from './validate'

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

/** Reads a source directory (`content/source`) without validating. */
/**
 * Applies a content profile to the source.
 *
 * `no-video` filters out everything video-related for the offline apps:
 *   - video questions are dropped,
 *   - video files leave the media directory,
 *   - question slots that filter for video questions lose exactly that
 *     filter and become free slots - the number of slots per preset stays,
 *     only the dramaturgy of the video slot is gone.
 *
 * The transformation runs BEFORE validation: both profiles are checked as
 * their own, complete source.
 */
export function applyContentProfile(source: RawSource, profile: ContentProfile): RawSource {
  if (profile === 'full') return source

  const questions = Array.isArray(source.questions)
    ? source.questions.filter(
        (question) => (question as { questionType?: string }).questionType !== 'video-then-question',
      )
    : source.questions
  const assets = source.assets.filter((asset) => asset.kind !== 'video')

  const config = structuredClone(source.config) as {
    presets?: { slots?: { filters?: { questionTypes?: string[] } }[] }[]
  }
  for (const preset of config?.presets ?? []) {
    for (const slot of preset.slots ?? []) {
      const types = slot.filters?.questionTypes
      if (!types) continue
      const remaining = types.filter((type) => type !== 'video-then-question')
      if (remaining.length === types.length) continue
      if (remaining.length > 0) slot.filters!.questionTypes = remaining
      else delete slot.filters!.questionTypes
    }
  }

  return { config, questions, assets, rootDir: source.rootDir }
}

export function readSource(sourceDir: string): RawSource {
  const config = readJson(join(sourceDir, CONFIG_FILE))
  const questions = readJson(join(sourceDir, QUESTIONS_FILE))
  const assetsRaw = readJson(join(sourceDir, ASSETS_FILE))
  const assets = mediaAssetSchema.array().parse(assetsRaw)
  return { config, questions, assets, rootDir: sourceDir }
}

/**
 * Resolution of an asset file path.
 *
 * SECURITY: File paths from quiz data must never resolve to arbitrary local
 * files (specification 30). The resolved path must lie inside the asset
 * directory, otherwise the result is `null`.
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
  /** See `ValidationInput.missingMediaSeverity`. Default is `'error'`. */
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
  /** See `ValidationInput.missingMediaSeverity`. Default is `'error'`. */
  missingMediaSeverity?: IssueSeverity
  /** Content profile. Default is `full`. */
  profile?: ContentProfile
}

export interface BuildResult {
  manifest: QuizPackageManifest
  validation: ValidationResult
  outDir: string
  /** Media without a file - only possible for disabled questions. */
  missingAssetFiles: string[]
}

/**
 * Builds a normalised, versioned package. Aborts on schema errors - warnings
 * pass through but have to be consciously approved in the report.
 */
export function buildPackage(options: BuildOptions): BuildResult {
  const profile: ContentProfile = options.profile ?? 'full'
  const source = applyContentProfile(readSource(options.sourceDir), profile)
  const validation = validateSource(source, {
    contentVersion: options.contentVersion,
    missingMediaSeverity: options.missingMediaSeverity,
  })
  if (!validation.ok) {
    return { manifest: emptyManifest(options), validation, outDir: options.outDir, missingAssetFiles: [] }
  }

  /*
   * Since schema v2 the package carries NO colours and fonts anymore -
   * presentation is the host's business (`quiz-themes`). The package only
   * names the visual world (`skin`) and the branding assets.
   */
  const config: QuizConfig = quizConfigSchema.parse(source.config)
  const questions = questionSchema.array().parse(source.questions)

  // Normalisation: stable sorting so that builds are reproducible.
  const normalizedQuestions = [...questions].sort((a, b) => a.id.localeCompare(b.id))
  const assets = [...source.assets]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((asset) => ({
      ...asset,
      checksum: asset.checksum ?? checksumOfFile(resolveAssetPath(source.rootDir, asset.filename)),
    }))

  mkdirSync(options.outDir, { recursive: true })
  // Remove the old manifest first: if the build aborts afterwards, no package
  // is left that does not match the new content files. A half-written
  // package would otherwise only show up through the checksum when loading.
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
      // Validation has already checked this case: if the file of an ENABLED
      // question were missing, the build would have aborted above. Only media of
      // disabled questions remain here - those may stay in the pool as templates.
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
    ...(profile === 'full' ? {} : { profile }),
    questionsFile: QUESTIONS_FILE,
    configFile: CONFIG_FILE,
    assets,
    checksum,
  })
  writeJson(join(options.outDir, MANIFEST_FILE), manifest)

  return { manifest, validation, outDir: options.outDir, missingAssetFiles }
}

/** Loads a built package at runtime. Invalid packages are not loaded. */
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

/** List of all files below `assets/` - for preflight and diagnostics. */
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
 * Helpers
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
 * Checksum over the content. It guards against the forbidden practice of
 * editing the built base JSON directly during the show - such changes are
 * noticed immediately when loading.
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
