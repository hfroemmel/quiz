/**
 * Bruecke zur Electron-Desktop-Anwendung.
 *
 * Fensterverwaltung ist Geraetesache und gehoert nicht in den Spielzustand: Vollbild
 * und Displaywahl aendern nichts am Quiz und werden deshalb NICHT ueber Befehle an den
 * Server geschickt.
 *
 * Im Browser gibt es diese Bruecke nicht. Dann faellt die Anwendung auf das
 * Vollbild des eigenen Fensters zurueck - fuer den Buehnenscreen im Browser genuegt das.
 */
export interface DesktopBridge {
  /** Praesentationsfenster auf dem Zweitdisplay in den Vollbildmodus schalten. */
  toggleStageFullscreen(): Promise<boolean>
  /** Praesentationsfenster erneut oeffnen, falls es geschlossen wurde. */
  openStageWindow(): Promise<void>
  /** Kennzeichnet die lokale Desktop-Anwendung. */
  readonly isDesktop: true
}

declare global {
  interface Window {
    quizDesktop?: DesktopBridge
  }
}

export function desktopBridge(): DesktopBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.quizDesktop
}

/**
 * Vollbild fuer den Buehnenscreen anfordern.
 *
 * In Electron steuert der Hauptprozess gezielt das Praesentationsfenster; das
 * Operatorfenster bleibt bewusst im Fenstermodus (Spezifikation 27.2).
 */
export async function requestStageFullscreen(): Promise<void> {
  const bridge = desktopBridge()
  if (bridge) {
    await bridge.toggleStageFullscreen()
    return
  }
  // Browser-Fallback: nur das eigene Fenster kann in den Vollbildmodus wechseln.
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined)
  } else {
    await document.documentElement.requestFullscreen().catch(() => undefined)
  }
}

/** Vollbild fuer das aktuelle Fenster - vom Buehnenclient selbst genutzt. */
export async function toggleOwnFullscreen(): Promise<void> {
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined)
  } else {
    await document.documentElement.requestFullscreen().catch(() => undefined)
  }
}
