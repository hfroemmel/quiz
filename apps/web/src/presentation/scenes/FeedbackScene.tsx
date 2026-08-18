/**
 * Richtig-/Falsch-Feedback (Spezifikation 13.1).
 *
 * WICHTIG: Diese Szene zeigt NIE die Loesung. Nach einer falschen ersten Antwort
 * folgt die zweite Chance, nicht die Aufloesung - der Server sendet die Loesung in
 * dieser Phase gar nicht erst mit.
 *
 * Die Bewegung kommt aus den gelieferten Bewegtgrafiken `correct` und `wrong`
 * (siehe `animationAssets.ts`), nicht aus im Code gezeichneten Formen. Wie lange
 * die Szene sichtbar bleibt, entscheidet allein der Server ueber seine
 * Fallbackzeit; diese Komponente meldet kein `animationend` zurueck.
 *
 * Der Punktestand wird bewusst NICHT hier angezeigt: Er zaehlt waehrend dieser
 * Animation in der Punktekachel der Kopfzeile hoch (Designergaenzung).
 */
import { AnimationClip } from '../../ui/AnimationClip.tsx'
import type { SceneProps } from './sceneProps.ts'

export function FeedbackScene({ view }: SceneProps) {
  const feedback = view.feedback
  const correct = feedback?.outcome === 'correct'

  return (
    <div className={`scene scene--feedback ${correct ? 'scene--feedback-correct' : 'scene--feedback-incorrect'}`}>
      <div className="feedback__symbol">
        <AnimationClip
          clipId={correct ? 'correct' : 'wrong'}
          // Ein neuer Versuch desselben Spielers startet die Grafik neu.
          restartKey={`${feedback?.playerId ?? 'none'}-${feedback?.outcome ?? 'none'}-${view.revision}`}
        />
      </div>
      <p className="feedback__label">{correct ? 'Richtig!' : 'Falsch!'}</p>
    </div>
  )
}
