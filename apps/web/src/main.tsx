/**
 * Einstiegspunkt des Web-Clients.
 *
 * Ein Build bedient alle Rollen; die Rolle ergibt sich aus dem Pfad. Das haelt Build
 * und Auslieferung einfach und stellt sicher, dass alle Ansichten dieselben
 * Vertraege und dieselbe Praesentationsschicht verwenden.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QuizGame } from '@quiz/game'
import { OperatorApp } from './apps/operator/OperatorApp.tsx'
import { StageApp } from './apps/stage/StageApp.tsx'
import { ModeratorApp } from './apps/moderator/ModeratorApp.tsx'
import { PreviewApp } from './apps/preview/PreviewApp.tsx'
import { ShellApp } from './apps/shell/ShellApp.tsx'
import '@quiz/presentation/styles.css'
import '@quiz/game/styles.css'
import './styles.css'

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
     * Fenster ohne eigenen Build konfigurieren kann:
     *   ?mode=adults   Quizmodus des Geraets
     *   ?idle=120      Leerlauf-Aufsicht in Sekunden
     */
    case '/play': {
      const params = new URLSearchParams(window.location.search)
      const mode = params.get('mode')
      const idleSeconds = Number(params.get('idle'))
      return (
        <QuizGame
          {...(mode ? { quizModeId: mode } : {})}
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
