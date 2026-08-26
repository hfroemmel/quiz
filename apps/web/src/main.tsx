/**
 * Einstiegspunkt des Web-Clients.
 *
 * Ein Build bedient alle Rollen; die Rolle ergibt sich aus dem Pfad. Das haelt Build
 * und Auslieferung einfach und stellt sicher, dass alle Ansichten dieselben
 * Verträge und dieselbe Praesentationsschicht verwenden.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OperatorApp } from './apps/operator/OperatorApp'
import { StageApp } from './apps/stage/StageApp'
import { ModeratorApp } from './apps/moderator/ModeratorApp'
import { PreviewApp } from './apps/preview/PreviewApp'
import { QuizGame } from './game/QuizGame'
import { ShellApp } from './apps/shell/ShellApp'
/*
 * Globale Stylesheets - bewusst KEINE Module.
 *
 *   palette   ERZEUGT aus `packages/contracts/src/theme.ts` - alle Farbwerte
 *   tokens    Massvariablen, Schriften und Dauern am Wurzelelement
 *   base      Schriften, Reset, Grundtypografie
 *   controls  Schaltflaechen und Formularfelder des Bedienrahmens
 *   motion    Keyframes und Uebergangsklassen; das Uebergangsregistry setzt
 *             ihre Namen als Zeichenkette und braucht sie deshalb ungehasht
 *   stage     Wurzelklassen der Buehne (`.stage--default`, `.stage--kids`,
 *             `.stage--bright`) - der Schalter, auf den alle Bauteilmodule
 *             ueber `:global(...)` zugreifen
 *
 * Alles Bauteilhafte liegt als `*.module.css` neben seiner Komponente.
 */
import './styles/palette.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/controls.css'
import './styles/motion.css'
import './styles/stage.css'

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  switch (path) {
    case '/stage':
      return <StageApp />
    case '/moderator':
      return <ModeratorApp />
    case '/preview':
      return <PreviewApp />
    /*
     * Beispielhafte Gastgeberanwendung. Sie zeigt, wie eine fremde Anwendung das
     * Quiz einbindet - und dient als Pruefstand fuer den Einbettungsvertrag.
     */
    case '/shell':
      return <ShellApp />
    /*
     * Selbstbedienung am Touchgeraet. Dieselbe Komponente betreibt der Kiosk und
     * spaeter die Multigame-Anwendung; hier ist sie ueber den lokalen Server
     * erreichbar und damit im Browser spielbar.
     *
     * Zwei Betriebsangaben kommen als Abfrageparameter, damit der Kiosk sein
     * Fenster ohne eigenen Build einrichten kann:
     *   ?audience=adults   Zielgruppe des Geraets
     *   ?idle=120          Leerlauf-Aufsicht in Sekunden
     */
    case '/play': {
      const params = new URLSearchParams(window.location.search)
      const audience = params.get('audience')
      const idleSeconds = Number(params.get('idle'))
      return (
        <QuizGame
          {...(audience ? { audience } : {})}
          {...(Number.isFinite(idleSeconds) && idleSeconds > 0 ? { idleTimeoutMs: idleSeconds * 1_000 } : {})}
        />
      )
    }
    default:
      return <OperatorApp />
  }
}

const container = document.getElementById('root')
if (!container) throw new Error('Wurzelelement #root fehlt.')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
