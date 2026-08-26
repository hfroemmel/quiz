/**
 * Electron-Hauptprozess des Kioskbetriebs.
 *
 * Verantwortung - und nur diese:
 *   - die Quizlaufzeit im selben Prozess starten, ausschliesslich auf Loopback;
 *   - ein einziges Vollbildfenster oeffnen, das die Spieleransicht zeigt;
 *   - das Fenster wieder aufmachen, falls es geschlossen wird.
 *
 * Es gibt hier bewusst kein Operatorfenster, kein Menue und keine LAN-Freigabe.
 * Ein Kioskgeraet steht im Foyer: Was dort erreichbar ist, ist die Spieleransicht -
 * sonst nichts.
 *
 * SICHERHEIT (Spezifikation 30): Der Renderer laeuft mit `contextIsolation: true`
 * und ohne `nodeIntegration`. Es gibt keine Preload-Bruecke, weil die
 * Spieleransicht keine Fensterfunktionen braucht. Alles Fachliche laeuft ueber
 * denselben WebSocket-Vertrag wie bei jedem anderen Client.
 */
import { app, BrowserWindow } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer, type RunningServer } from '@quiz/server'

/*
 * Diese Huelle lebt (noch) im Monorepo und verankert ihre Pfade an der eigenen
 * Lage: dist/ -> App-Verzeichnis -> apps/ -> Wurzel. Der Server selbst kennt
 * keine Repository-Struktur mehr - er bekommt alles explizit.
 */
const repoWurzel = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Quizmodus des Geraets. Er gehoert zur Aufstellung, nicht auf den Spielbildschirm. */
const audience = process.env['QUIZ_KIOSK_AUDIENCE'] ?? 'adults'

/**
 * Leerlauf-Aufsicht in Sekunden. Ohne sie bliebe ein Geraet mit einer offenen
 * Frage stehen, wenn die Spieler weggehen - auf einer Frage liegt bewusst kein
 * Zeitdruck.
 */
const idleSeconds = Number(process.env['QUIZ_KIOSK_IDLE_SECONDS'] ?? 120)

let running: RunningServer | null = null
let window: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const created = new BrowserWindow({
    kiosk: true,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#12161A',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      /*
       * Am Kioskgeraet gibt es niemanden, der erst einmal irgendwo hinklickt,
       * damit der Ton freigegeben wird. Die Wiedergabe ist deshalb von
       * vornherein erlaubt - so wie im Buehnenfenster der Desktop-Anwendung.
       */
      autoplayPolicy: 'no-user-gesture-required',
    },
  })

  const params = new URLSearchParams({ audience, idle: String(idleSeconds) })
  void created.loadURL(`http://127.0.0.1:${running!.port}/play?${params.toString()}`)

  // Ein geschlossenes Fenster darf das Geraet nicht dunkel zuruecklassen.
  created.on('closed', () => {
    window = null
    if (!app.isReady()) return
    window = createWindow()
  })
  return created
}

app.whenReady().then(async () => {
  /*
   * `127.0.0.1` ist hier keine Vorsichtsmassnahme, sondern Voraussetzung: Die
   * Spielerrolle wird ausschliesslich ueber Loopback angenommen. Ein Kioskgeraet
   * oeffnet damit keinen Zugang zum laufenden Spiel ins Netz.
   */
  running = await startServer({
    host: '127.0.0.1',
    port: 0,
    packageDir: join(repoWurzel, 'content', 'dist'),
    databaseFile: join(repoWurzel, 'runtime', 'quiz.sqlite'),
    webDistDir: join(repoWurzel, 'apps', 'web', 'dist'),
    mediaFallbackDirs: [join(repoWurzel, 'content', 'source')],
  })
  window = createWindow()
})

app.on('window-all-closed', () => {
  // Auf dem Kioskgeraet gibt es nichts, wohin man zurueckkehren koennte.
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void running?.close()
})
