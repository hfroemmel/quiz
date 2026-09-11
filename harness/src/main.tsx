/**
 * Einstiegspunkt des Pruefstands.
 *
 * Dieses Repository liefert Bibliotheken aus, keine Anwendung. Was hier laeuft,
 * ist ihr Pruefstand: die Szenenvorschau, das Touchgeraet und eine beispielhafte
 * Gastgeberanwendung. Alle drei kommen ohne Server aus - das Quiz laeuft ueber
 * eine `LocalQuizRuntime` im Browser.
 *
 * Der Pruefstand traegt die Screenshot-Referenzen und den Einbettungsvertrag.
 * Er wird nie ausgeliefert.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PreviewApp } from './preview/PreviewApp'
import { ShellApp } from './shell/ShellApp'
import { TouchGeraet } from './TouchGeraet'
/*
 * Globale Stylesheets - bewusst KEINE Module.
 *
 *   palette   ERZEUGT aus quiz-themes (`palettes.ts`) - alle Farbwerte
 *   fonts     die @font-face-Regeln aus quiz-themes
 *   tokens    Massvariablen, Schriften und Dauern am Wurzelelement
 *   base      Reset und Grundtypografie
 *   controls  Schaltflaechen und Formularfelder der Vorschau
 *   motion    Keyframes und Uebergangsklassen; das Uebergangsregistry setzt
 *             ihre Namen als Zeichenkette und braucht sie deshalb ungehasht
 *   stage     Wurzelklassen der Buehne (`.stage--default`, `.stage--kids`,
 *             `.stage--bright`) - der Schalter, auf den alle Bauteilmodule
 *             ueber `:global(...)` zugreifen
 *
 * Hier kommen sie aus der QUELLE der Pakete; ein Gastgeber, der die
 * veroeffentlichten Pakete einbindet, holt die Bauteilstile zusaetzlich ueber
 * `@hfroemmel/quiz-react/styles.css` und `@hfroemmel/quiz-kiosk/styles.css`.
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
     * Selbstbedienung am Touchgeraet. Zwei Betriebsangaben kommen als
     * Abfrageparameter, damit ein Geraet sein Fenster ohne eigenen Build
     * einrichten kann:
     *   ?audience=adults   Zielgruppe des Geraets
     *   ?idle=120          Leerlauf-Aufsicht in Sekunden
     */
    case '/play': {
      const params = new URLSearchParams(window.location.search)
      const audience = params.get('audience') ?? 'adults'
      const idleSeconds = Number(params.get('idle'))
      return (
        <TouchGeraet
          audience={audience}
          {...(Number.isFinite(idleSeconds) && idleSeconds > 0 ? { idleTimeoutMs: idleSeconds * 1_000 } : {})}
        />
      )
    }
    /*
     * Beispielhafte Gastgeberanwendung. Sie zeigt, wie eine fremde Anwendung das
     * Quiz einbindet - und dient als Pruefstand fuer den Einbettungsvertrag.
     */
    case '/shell':
      return <ShellApp />
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
