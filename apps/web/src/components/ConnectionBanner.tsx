/**
 * Verbindungs- und Fehlerhinweis in klarer Sprache (Spezifikation 28).
 *
 * Jede Meldung nennt eine sichere naechste Aktion. Technische Details bleiben im
 * Serverprotokoll und erscheinen nie auf dem Buehnenscreen.
 */

import styles from './ConnectionBanner.module.css'
export function ConnectionBanner({
  connected,
  rejection,
  onDismiss,
}: {
  connected: boolean
  rejection: { reason: string; message: string } | null
  onDismiss?: () => void
}) {
  if (!connected) {
    return (
      <div className={`${styles.banner} ${styles.warning}`} data-banner="warning" role="status">
        <strong>Verbindung unterbrochen.</strong> Es wird automatisch neu verbunden. Der Spielstand auf dem Server
        bleibt erhalten.
      </div>
    )
  }
  if (!rejection) return null
  return (
    <div className={`${styles.banner} ${styles.error}`} data-banner="error" role="alert">
      <span>{rejection.message}</span>
      {onDismiss && (
        <button type="button" className={styles.dismiss} onClick={onDismiss}>
          Verstanden
        </button>
      )}
    </div>
  )
}
