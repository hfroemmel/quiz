/**
 * Entry point of the harness.
 *
 * This repository ships libraries, not an application. What runs here is
 * their harness: the scene preview, the touch device, and an example host
 * application. All three work without a server - the quiz runs via a
 * `LocalQuizRuntime` in the browser.
 *
 * The harness carries the screenshot references and the embedding contract.
 * It is never shipped.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PreviewApp } from './preview/PreviewApp'
import { ShellApp } from './shell/ShellApp'
import { ThemedPair } from './ThemedPair'
import { TouchDevice } from './TouchDevice'
/*
 * Global stylesheets - deliberately NOT modules.
 *
 *   palette   GENERATED from quiz-themes (`palettes.ts`) - all colour values
 *   fonts     the @font-face rules from quiz-themes
 *   tokens    size variables, fonts and durations on the root element
 *   base      reset and basic typography
 *   controls  buttons and form fields of the preview
 *   motion    keyframes and transition classes; the transition registry
 *             sets their names as a string and therefore needs them unhashed
 *   stage     root classes of the stage (`.stage--default`, `.stage--kids`,
 *             `.stage--bright`) - the switch all component modules access
 *             via `:global(...)`
 *
 * Here they come from the packages' SOURCE; a host that includes the
 * published packages additionally fetches the component styles via
 * `@hfroemmel/quiz-react/styles.css` and `@hfroemmel/quiz-kiosk/styles.css`.
 */
import '@hfroemmel/quiz-themes/palette.css'
import '@hfroemmel/quiz-themes/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/controls.css'
import '@hfroemmel/quiz-react/styles/motion.css'
import '@hfroemmel/quiz-react/styles/stage.css'

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  switch (path) {
    /*
     * Self-service at the touch device. Two operating settings arrive as
     * query parameters, so a device can set up its window without its own
     * build:
     *   ?audience=adults   audience of the device
     *   ?idle=120          idle supervision in seconds
     *   ?details=1         read the background of a question at the device
     *                      (`rules.showDetailsAfterSolution`) - a rule of the
     *                      content, switchable here so that one suite can see
     *                      the step without all of them getting it
     */
    case '/play': {
      const params = new URLSearchParams(window.location.search)
      const audience = params.get('audience') ?? 'adults'
      const idleSeconds = Number(params.get('idle'))
      return (
        <TouchDevice
          audience={audience}
          {...(Number.isFinite(idleSeconds) && idleSeconds > 0 ? { idleTimeoutMs: idleSeconds * 1_000 } : {})}
          {...(params.get('details') === null ? {} : { showDetailsAfterSolution: true })}
        />
      )
    }
    /*
     * Example host application. It shows how an external application
     * embeds the quiz - and serves as the harness for the embedding
     * contract.
     */
    case '/shell':
      return <ShellApp />
    /*
     * Two quizzes on one page, each with its own design - the case the theme
     * provider exists for. Nothing here is a product; it is the surface on
     * which a leaking theme becomes visible.
     */
    case '/pair':
      return <ThemedPair />
    default:
      return <PreviewApp />
  }
}

const container = document.getElementById('root')
if (!container) throw new Error('Wurzelelement #root fehlt.')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
