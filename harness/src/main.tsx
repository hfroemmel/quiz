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
 * `@hfroemmel/quiz-react/styles.css` - one file since the playable quiz moved
 * into that package.
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
    // Self-service at the touch device.
    case '/play':
      return touchDevice()
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
    /*
     * The scene preview is development only - in a built folder it is
     * locked behind `import.meta.env.DEV` and shows nothing but a note.
     * A build is a folder on a static host, so the root there would be a
     * dead end; it opens the quiz itself instead.
     */
    default:
      return import.meta.env.DEV ? <PreviewApp /> : touchDevice()
  }
}

/**
 * The touch device with the operating settings from the query string.
 *
 * They arrive as query parameters, so a device can set up its window
 * without a build of its own:
 *   ?audience=adults   audience of the device
 *   ?idle=120          idle supervision in seconds
 *   ?details=1         read the background of a question at the device
 *                      (`rules.showDetailsAfterSolution`) - a rule of the
 *                      content, switchable here so that one suite can see
 *                      the step without all of them getting it
 *   ?layout=kiosk      the arrangement of a device standing on its own -
 *                      score cards in the head, drawn buzzers in the
 *                      corners. Without it, the live event's device.
 *   ?zoom=0.75         the host's zoom level, as a media table sets it
 */
function touchDevice() {
  const params = new URLSearchParams(window.location.search)
  const audience = params.get('audience') ?? 'adults'
  const idleSeconds = Number(params.get('idle'))
  const zoom = Number(params.get('zoom'))
  return (
    <TouchDevice
      audience={audience}
      {...(params.get('layout') === 'kiosk' ? { layout: 'kiosk' as const } : {})}
      {...(Number.isFinite(zoom) && zoom > 0 ? { zoom } : {})}
      {...(Number.isFinite(idleSeconds) && idleSeconds > 0 ? { idleTimeoutMs: idleSeconds * 1_000 } : {})}
      {...(params.get('details') === null ? {} : { showDetailsAfterSolution: true })}
    />
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('Wurzelelement #root fehlt.')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
