/**
 * Verbindungs- und Fehlerhinweis in klarer Sprache (Spezifikation 28).
 *
 * Jede Meldung nennt eine sichere naechste Aktion. Technische Details bleiben im
 * Serverprotokoll und erscheinen nie auf dem Buehnenscreen.
 */
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
      <div className="banner banner--warning" role="status">
        <strong>Verbindung unterbrochen.</strong> Es wird automatisch neu verbunden. Der Spielstand auf dem Server
        bleibt erhalten.
      </div>
    )
  }
  if (!rejection) return null
  return (
    <div className="banner banner--error" role="alert">
      <span>{rejection.message}</span>
      {onDismiss && (
        <button type="button" className="banner__dismiss" onClick={onDismiss}>
          Verstanden
        </button>
      )}
    </div>
  )
}
