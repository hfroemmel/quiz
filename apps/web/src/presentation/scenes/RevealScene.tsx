/**
 * Bilderkennen mit synchroner Enthuellung (Spezifikation 10).
 *
 * ABLEITUNG DER BILDSCHAERFE: `reveal.blurPx` und `reveal.countdownSeconds` stammen
 * beide aus `useRevealClock` und damit aus demselben Fortschritt. Hier darf niemals
 * eine eigene CSS-Animation die Unschaerfe steuern - sonst koennten Countdown und
 * Bild auseinanderlaufen und ein Spieler bekaeme einen Informationsvorteil.
 *
 * Am Bild aendert sich ausschliesslich die Schaerfe: kein Zoom, keine Bewegung
 * (bestaetigte Designvorgabe).
 *
 * VERHALTEN BEI PAUSE UND RECONNECT: Pausiert der Server die Enthuellung, friert der
 * Wert ein, weil `status !== 'running'` keine Weiterrechnung erlaubt. Nach einem
 * Reconnect uebernimmt der naechste Snapshot sofort wieder den Serverstand.
 */
import { MediaFrame } from '../../ui/MediaFrame.tsx'
import { ProgressRing } from '../../ui/ProgressRing.tsx'
import { QuestionHead } from './QuestionHead.tsx'
import type { SceneProps } from './sceneProps.ts'

export function RevealScene({ view, reveal }: SceneProps) {
  const question = view.question
  if (!question) return null

  const paused = view.reveal?.status === 'paused'
  const finished = reveal.progress >= 1

  return (
    <div className="scene scene--reveal">
      <QuestionHead question={question} />

      <div className="reveal__stage">
        <div className={`reveal__countdown ${paused ? 'reveal__countdown--paused' : ''}`}>
          <ProgressRing remaining={1 - reveal.progress} seconds={reveal.countdownSeconds} paused={paused} />
          {paused && <span className="reveal__hint">pausiert</span>}
          {finished && !paused && <span className="reveal__hint">Buzzern weiterhin moeglich</span>}
        </div>

        <MediaFrame src={question.imageUrl} blurPx={reveal.blurPx} variant="reveal" className="reveal__frame" />
      </div>

      {view.secondChance && (
        <p className="scene__hint">Zweite Chance · {view.secondChance.pointsIfCorrect} Punkte</p>
      )}
    </div>
  )
}
