/**
 * Two quizzes on one page, each with its own design.
 *
 * This is the case the theme provider exists for. As long as a host had to
 * overwrite the package's values on the document, two quizzes side by side
 * could only ever have ONE look - whichever declaration came last won for both.
 * `QuizProvider` puts the values on the quiz's own element; here that is shown
 * with two designs that could not be more different, so a leak would be visible
 * instead of plausible.
 *
 * It is a harness surface, not a product: a game collection shows one quiz at a
 * time, and a comparison view of two is exactly what nobody builds - which is
 * why the leak went unnoticed for so long.
 */
import { QuizProvider } from '@hfroemmel/quiz-react'
import type { ThemeDefinition } from '@hfroemmel/quiz-themes'
import { QuizGame } from '@hfroemmel/quiz-kiosk'
import { foyerTheme, hallTheme } from './hostThemes'
import { useLocalRuntime } from './useLocalRuntime'

function Device({ theme, mark }: { theme: ThemeDefinition; mark: string }) {
  const { runtime, errors } = useLocalRuntime()

  if (errors) return <p style={{ padding: '1rem' }}>{errors}</p>
  if (!runtime) return <p style={{ padding: '1rem' }}>Das Quiz wird vorbereitet...</p>

  return (
    <div data-pair={mark} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <QuizProvider theme={theme}>
        <QuizGame runtime={runtime} audience="adults" />
      </QuizProvider>
    </div>
  )
}

export function ThemedPair() {
  return (
    <div style={{ display: 'flex', height: '100%', gap: '1rem' }}>
      <Device theme={foyerTheme} mark="foyer" />
      <Device theme={hallTheme} mark="hall" />
    </div>
  )
}
