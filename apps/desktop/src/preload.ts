/**
 * Minimale Preload-Bruecke (Spezifikation 30).
 *
 * Bewusst NUR Fensterfunktionen. Es gibt hier keinen Zugriff auf Dateisystem,
 * Datenbank, Quizinhalte oder Spielzustand: Alles Fachliche laeuft ueber denselben
 * WebSocket-Vertrag, den auch Moderator und externe Praesentationsclients verwenden.
 * Damit gibt es keine zweite, privilegierte Steuerungsschiene.
 */
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('quizDesktop', {
  isDesktop: true,
  toggleStageFullscreen: (): Promise<boolean> => ipcRenderer.invoke('quiz:toggle-stage-fullscreen'),
  openStageWindow: (): Promise<void> => ipcRenderer.invoke('quiz:open-stage-window'),
})
