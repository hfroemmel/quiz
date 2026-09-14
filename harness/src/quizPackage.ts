/**
 * Das gebaute Quizpaket im Browser laden.
 *
 * Der Pruefstand betreibt das Quiz mit einer `LocalQuizRuntime` - ohne Server.
 * Die drei Dateien des Pakets liefert der Entwicklungsserver unter
 * `/quizpaket/` aus (siehe `vite.config.ts`), die Medien unter `/media/<id>` -
 * derselben Adresse, die der Kern bildet und die im Buehnenbetrieb der
 * Quizserver bedient.
 *
 * Geprueft wird auch hier: Eine stillschweigend halb geladene Fragenmenge waere
 * unangenehmer als ein klarer Fehler.
 */
import {
  questionSchema,
  quizConfigSchema,
  quizPackageManifestSchema,
  type QuizPackage,
} from '@hfroemmel/quiz-core'

export async function loadHarnessPackage(): Promise<QuizPackage> {
  const fetchValue = async (name: string): Promise<unknown> => {
    const answer = await fetch(`/quizpaket/${name}`)
    if (!answer.ok) throw new Error(`${name} nicht ladbar (${answer.status}) - erst "pnpm content:build" laufen lassen.`)
    return answer.json()
  }

  const [rawManifest, rawConfig, rawQuestions] = await Promise.all([
    fetchValue('manifest.json'),
    fetchValue('config.json'),
    fetchValue('questions.json'),
  ])

  const manifest = quizPackageManifestSchema.parse(rawManifest)
  return {
    manifest,
    config: quizConfigSchema.parse(rawConfig),
    questions: questionSchema.array().parse(rawQuestions),
    assetsById: new Map(manifest.assets.map((asset) => [asset.id, asset])),
    // Ein Verzeichnis gibt es im Browser nicht; Medien kommen ueber die Adresse.
    rootDir: '',
  }
}
