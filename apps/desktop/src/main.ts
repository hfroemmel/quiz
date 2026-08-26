/**
 * Electron-Hauptprozess (Spezifikation 20.1 und 27).
 *
 * Verantwortung:
 *   - den lokalen Quizserver im selben Prozess starten (kein separater Dienst);
 *   - das Operatorfenster oeffnen;
 *   - das Praesentationsfenster oeffnen, moeglichst auf dem HDMI-Display;
 *   - Fensterpositionen merken und bei veraenderter Displaykonfiguration sicher
 *     darauf zurueckfallen;
 *   - eine minimale, klar umrissene Preload-API bereitstellen.
 *
 * SICHERHEIT (Spezifikation 30): Renderer laufen mit `contextIsolation: true` und
 * ohne `nodeIntegration`. Die Preload-Bruecke stellt ausschliesslich Fensterfunktionen
 * bereit - niemals Dateisystem, Datenbank oder Spielzustand. Alles Fachliche laeuft
 * ueber denselben WebSocket-Vertrag wie bei externen Clients.
 */
import { app, BrowserWindow, ipcMain, screen, type Rectangle } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer, type RunningServer } from '@quiz/server'

// Der Hauptprozess laeuft als ES-Modul; `__dirname` gibt es dort nicht.
const moduleDir = dirname(fileURLToPath(import.meta.url))
const preloadScript = join(moduleDir, 'preload.cjs')

/*
 * Diese Huelle lebt (noch) im Monorepo und verankert ihre Pfade an der eigenen
 * Lage: dist/ -> App-Verzeichnis -> apps/ -> Wurzel. Der Server selbst kennt
 * keine Repository-Struktur mehr - er bekommt alles explizit.
 */
const repoWurzel = join(moduleDir, '..', '..', '..')

let running: RunningServer | null = null
let operatorWindow: BrowserWindow | null = null
let stageWindow: BrowserWindow | null = null

/** Gespeicherte Fenstergeometrie. Sie ist ein Komfortmerkmal, keine Voraussetzung. */
interface WindowLayout {
  operator?: Rectangle
  stage?: Rectangle
  stageDisplayId?: number
}

const layoutFile = join(app.getPath('userData'), 'window-layout.json')

function readLayout(): WindowLayout {
  try {
    return JSON.parse(readFileSync(layoutFile, 'utf8')) as WindowLayout
  } catch {
    return {}
  }
}

function writeLayout(layout: WindowLayout): void {
  try {
    mkdirSync(dirname(layoutFile), { recursive: true })
    writeFileSync(layoutFile, JSON.stringify(layout, null, 2), 'utf8')
  } catch {
    // Ein fehlgeschlagenes Speichern der Fensterposition darf den Betrieb nicht stoeren.
  }
}

/**
 * Prueft, ob eine gespeicherte Position noch auf einen vorhandenen Bildschirm passt.
 * Nach einem Displaywechsel wuerde ein Fenster sonst ausserhalb des sichtbaren
 * Bereichs geoeffnet.
 */
function isOnVisibleDisplay(bounds: Rectangle | undefined): boolean {
  if (!bounds) return false
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea
    return (
      bounds.x >= area.x - 50 &&
      bounds.y >= area.y - 50 &&
      bounds.x + bounds.width <= area.x + area.width + 50 &&
      bounds.y + bounds.height <= area.y + area.height + 50
    )
  })
}

/** Das Display, auf dem der Buehnenscreen liegen soll: bevorzugt das zweite. */
function presentationDisplay() {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  return displays.find((display) => display.id !== primary.id) ?? primary
}

function baseUrl(): string {
  return `http://localhost:${running!.port}`
}

function createOperatorWindow(): BrowserWindow {
  const layout = readLayout()
  const window = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    title: 'Live-Quiz - Operator',
    backgroundColor: '#0b1020',
    ...(isOnVisibleDisplay(layout.operator) ? layout.operator : {}),
    webPreferences: {
      preload: preloadScript,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  void window.loadURL(`${baseUrl()}/operator`)
  window.on('close', () => {
    writeLayout({ ...readLayout(), operator: window.getBounds() })
  })
  window.on('closed', () => {
    operatorWindow = null
  })
  return window
}

/**
 * Praesentationsfenster.
 *
 * Es wird gezielt auf dem Zweitdisplay geoeffnet. Schliessen oder Absturz dieses
 * Fensters beendet das Spiel NICHT - der Zustand liegt im Server. Beim erneuten
 * Oeffnen bekommt es sofort den aktuellen oeffentlichen Snapshot.
 */
function createStageWindow(): BrowserWindow {
  const layout = readLayout()
  const display = presentationDisplay()
  const useSavedBounds = isOnVisibleDisplay(layout.stage)

  const window = new BrowserWindow({
    ...(useSavedBounds
      ? layout.stage!
      : { x: display.bounds.x, y: display.bounds.y, width: display.bounds.width, height: display.bounds.height }),
    title: 'Live-Quiz - Buehne',
    backgroundColor: '#0b1020',
    autoHideMenuBar: true,
    // Vollbild ist der Normalfall, sobald ein zweites Display vorhanden ist.
    fullscreen: display.id !== screen.getPrimaryDisplay().id,
    webPreferences: {
      preload: preloadScript,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      /*
       * Im Buehnenfenster klickt niemand - es laeuft auf dem Beamer. Ohne diese
       * Freigabe blieben die Soundmarken stumm, weil Browser Audio erst nach
       * einer Nutzerinteraktion erlauben.
       */
      autoplayPolicy: 'no-user-gesture-required',
    },
  })

  void window.loadURL(`${baseUrl()}/stage`)
  window.on('close', () => {
    writeLayout({ ...readLayout(), stage: window.getBounds(), stageDisplayId: display.id })
  })
  window.on('closed', () => {
    stageWindow = null
  })
  return window
}

/* ------------------------------------------------------------------ *
 * Preload-API: ausschliesslich Fensterfunktionen
 * ------------------------------------------------------------------ */

ipcMain.handle('quiz:toggle-stage-fullscreen', () => {
  if (!stageWindow || stageWindow.isDestroyed()) {
    stageWindow = createStageWindow()
    return true
  }
  const next = !stageWindow.isFullScreen()
  stageWindow.setFullScreen(next)
  stageWindow.focus()
  return next
})

ipcMain.handle('quiz:open-stage-window', () => {
  if (!stageWindow || stageWindow.isDestroyed()) {
    stageWindow = createStageWindow()
  } else {
    stageWindow.show()
    stageWindow.focus()
  }
})

/* ------------------------------------------------------------------ *
 * Lebenszyklus
 * ------------------------------------------------------------------ */

async function bootstrap(): Promise<void> {
  // Der Server laeuft im Hauptprozess: ein Prozess weniger, der im Live-Betrieb
  // ausfallen kann. Er lauscht auf allen Schnittstellen, damit Moderator und
  // weitere Praesentationsclients optional zugreifen koennen.
  running = await startServer({
    host: '0.0.0.0',
    packageDir: join(repoWurzel, 'content', 'dist'),
    databaseFile: join(repoWurzel, 'runtime', 'quiz.sqlite'),
    webDistDir: join(repoWurzel, 'apps', 'web', 'dist'),
    mediaFallbackDirs: [join(repoWurzel, 'content', 'source')],
  })

  operatorWindow = createOperatorWindow()
  stageWindow = createStageWindow()

  console.log(`Operator:  ${baseUrl()}/operator`)
  console.log(`Buehne:    ${baseUrl()}/stage`)
  console.log(`Session-Code fuer den Moderator: ${running.sessionCode}`)
  for (const url of running.lanUrls) console.log(`Moderator im LAN: ${url}/moderator`)
}

app.whenReady().then(
  () => void bootstrap(),
  (error: Error) => {
    console.error('Start fehlgeschlagen:', error.message)
    app.quit()
  },
)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    operatorWindow = createOperatorWindow()
    stageWindow = createStageWindow()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void running?.close()
  running = null
})
