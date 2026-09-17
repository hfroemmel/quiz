/**
 * Loads the built quiz package in the browser.
 *
 * The harness runs the quiz with a `LocalQuizRuntime` - without a server.
 * The development server serves the package's three files under
 * `/quiz-package/` (see `vite.config.ts`), the media under `/media/<id>` - the
 * same route the core builds and that the quiz server serves during a live
 * stage show.
 *
 * Checks run here too: a silently half-loaded question set would be more
 * unpleasant than a clear error.
 */
import { loadQuizPackage, type AssetResolver, type QuizPackage } from '@hfroemmel/quiz-core'

export async function loadHarnessPackage(): Promise<QuizPackage> {
  const fetchValue = async (name: string): Promise<unknown> => {
    const answer = await fetch(`/quiz-package/${name}`)
    if (!answer.ok) throw new Error(`${name} nicht ladbar (${answer.status}) - erst "pnpm content:build" laufen lassen.`)
    return answer.json()
  }

  const [rawManifest, rawConfig, rawQuestions] = await Promise.all([
    fetchValue('manifest.json'),
    fetchValue('config.json'),
    fetchValue('questions.json'),
  ])

  /*
   * Reading and checking is the package's own job (`loadQuizPackage`) - four
   * hosts used to carry the same twenty lines. There is no directory in the
   * browser; media come over the URL, so none is named.
   */
  return loadQuizPackage({ manifest: rawManifest, config: rawConfig, questions: rawQuestions })
}

/**
 * Where a medium lies when the harness is a folder on a static host.
 *
 * `/media/<id>` is the route of a SERVER: it looks the id up in the manifest
 * and answers with the file behind it, including its content type. A static
 * host has no lookup - it hands out files, and it reads their type from the
 * extension. So the id is resolved here, in the browser, out of the manifest
 * the package already carries, and what goes over the wire is the file name.
 *
 * The development server serves both routes (see `vite.config.ts`), so the
 * harness behaves the same in both places.
 */
export function harnessMedia(quizPackage: QuizPackage): AssetResolver {
  return (assetId) => {
    const asset = quizPackage.assetsById.get(assetId)
    // No medium for this id: the question then runs without a picture
    // instead of with a broken frame - the core's own rule.
    if (!asset) return undefined
    return `/media/${encodeURI(asset.filename)}`
  }
}
