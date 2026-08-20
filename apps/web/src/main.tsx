/**
 * Einstiegspunkt des Web-Clients.
 *
 * Ein Build bedient alle Rollen; die Rolle ergibt sich aus dem Pfad. Das haelt Build
 * und Auslieferung einfach und stellt sicher, dass alle Ansichten dieselben
 * Verträge und dieselbe Praesentationsschicht verwenden.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OperatorApp } from './apps/operator/OperatorApp.tsx'
import { StageApp } from './apps/stage/StageApp.tsx'
import { ModeratorApp } from './apps/moderator/ModeratorApp.tsx'
import { PreviewApp } from './apps/preview/PreviewApp.tsx'
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
