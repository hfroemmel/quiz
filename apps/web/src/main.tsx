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
     * Selbstbedienung am Touchgeraet. Dieselbe Komponente betreibt spaeter der
     * Kiosk und die Multigame-Anwendung; hier ist sie ueber den lokalen Server
     * erreichbar und damit im Browser spielbar.
     */
    case '/play':
      return <QuizGame />
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
