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
import { loadQuizPackage, type QuizPackage } from '@hfroemmel/quiz-core'

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
