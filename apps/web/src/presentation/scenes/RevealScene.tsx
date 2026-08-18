/**
 * Bilderkennen mit synchroner Enthuellung (Spezifikation 10).
 *
 * ABLEITUNG DER BILDSCHAERFE: `reveal.blurPx` und `reveal.countdownSeconds` stammen
 * beide aus `useRevealClock` und damit aus demselben Fortschritt. Hier darf niemals
 * eine eigene CSS-Animation die Unschaerfe steuern - sonst koennten Countdown und
 * Bild auseinanderlaufen und ein Spieler bekaeme einen Informationsvorteil.
 *
 * VERHALTEN BEI PAUSE UND RECONNECT: Pausiert der Server die Enthuellung, friert der
 * Wert ein, weil `status !== 'running'` keine Weiterrechnung erlaubt. Nach einem
 * Reconnect uebernimmt der naechste Snapshot sofort wieder den Serverstand.
 */
import type { SceneProps } from './sceneProps.ts'

export function RevealScene({ view, reveal }: SceneProps) {
  const question = view.question
  if (!question) return null

  const paused = view.reveal?.status === 'paused'
  const finished = reveal.progress >= 1

  return (
    <div className="scene scene--reveal">
      <h2 className="question-prompt">{question.prompt}</h2>

      <div className="reveal__stage">
        <div className="reveal__frame">
          {question.imageUrl && (
            <img
              className="reveal__image"
              src={question.imageUrl}
              alt=""
              // Einzige Quelle der Unschaerfe: der Reveal-Fortschritt.
              style={{ filter: `blur(${reveal.blurPx.toFixed(2)}px)` }}
            />
          )}
        </div>

        <div className={`reveal__countdown ${paused ? 'reveal__countdown--paused' : ''}`}>
          <span className="reveal__seconds">{reveal.countdownSeconds}</span>
          {paused && <span className="reveal__hint">pausiert</span>}
          {finished && !paused && <span className="reveal__hint">Buzzern weiterhin moeglich</span>}
        </div>
      </div>
    </div>
  )
}
