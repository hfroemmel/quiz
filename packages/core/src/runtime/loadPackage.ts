/**
 * Turn three files into one checked quiz package.
 *
 * WHY THIS IS IN THE PACKAGE. Four hosts had the same twenty lines: parse the
 * manifest, parse the configuration, parse the questions, build the asset map,
 * set a directory. The lines were not hard, but they were FOUR COPIES of one
 * rule - and the rule matters: a package that is only half read must fail at
 * the start and not in the middle of a game, where nobody can intervene.
 *
 * WHY IT VALIDATES EVEN THOUGH THE PACKAGE COMES FROM OUR OWN DELIVERY. A
 * quietly half-loaded question set would be far more unpleasant in operation
 * than a clear error at start. It costs one pass over a file that is read once.
 */
import {
  questionSchema,
  quizConfigSchema,
  quizPackageManifestSchema,
  type QuizPackage,
} from '../contracts'

export interface LoadQuizPackageInput {
  manifest: unknown
  config: unknown
  questions: unknown
}

export interface LoadQuizPackageOptions {
  /**
   * The directory that holds the package's `assets/`.
   *
   * A server resolves media from a file system and names it; a window has no
   * directory - there the media come over a protocol or a URL, and the field
   * stays empty. Whoever delivers decides, not the core: it touches no file
   * system itself.
   */
  rootDir?: string
}

export function loadQuizPackage(raw: LoadQuizPackageInput, options: LoadQuizPackageOptions = {}): QuizPackage {
  const manifest = quizPackageManifestSchema.parse(raw.manifest)
  return {
    manifest,
    config: quizConfigSchema.parse(raw.config),
    questions: questionSchema.array().parse(raw.questions),
    assetsById: new Map(manifest.assets.map((asset) => [asset.id, asset])),
    rootDir: options.rootDir ?? '',
  }
}
