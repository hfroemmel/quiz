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

export async function ladeQuizPaket(): Promise<QuizPackage> {
  const hole = async (name: string): Promise<unknown> => {
    const antwort = await fetch(`/quizpaket/${name}`)
    if (!antwort.ok) throw new Error(`${name} nicht ladbar (${antwort.status}) - erst "pnpm content:build" laufen lassen.`)
    return antwort.json()
  }

  const [rohManifest, rohConfig, rohFragen] = await Promise.all([
    hole('manifest.json'),
    hole('config.json'),
    hole('questions.json'),
  ])

  const manifest = quizPackageManifestSchema.parse(rohManifest)
  return {
    manifest,
    config: quizConfigSchema.parse(rohConfig),
    questions: questionSchema.array().parse(rohFragen),
    assetsById: new Map(manifest.assets.map((asset) => [asset.id, asset])),
    // Ein Verzeichnis gibt es im Browser nicht; Medien kommen ueber die Adresse.
    rootDir: '',
  }
}
