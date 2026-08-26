/**
 * Bilderkennen mit synchroner Aufloesung (Spezifikation 10).
 *
 * Das Bild liegt unter einer Decke aus Kacheln, die eine nach der anderen
 * verschwindet. Sie IST die Uhr: Wer sehen will, wie viel Zeit bleibt, sieht auf
 * das Bild. Eine Zahl daneben gab es frueher, sie ist bewusst entfallen - der
 * Saal soll auf das Motiv schauen, nicht auf einen Zaehler.
 *
 * NEBEN DEM BILD STEHT NICHTS. Frueher stand hier ein Regievermerk fuer die
 * Vorschau (`pausiert`, `Buzzern weiterhin möglich`). Er kam und ging mit der
 * Phase und schob dabei das Motiv zur Seite - ausgerechnet in dem Moment, in
 * dem alle darauf schauen. Was er sagte, steht ohnehin in der Bedienleiste.
 *
 * ABLEITUNG DER AUFLOESUNG: `reveal.progress` kommt aus `useRevealClock` und damit
 * aus dem Serverzustand. Hier darf niemals eine eigene CSS-Animation das
 * Aufdecken steuern - sonst liefe das Bild gegen die Uhr des Servers, und ein
 * Spieler bekaeme einen Informationsvorteil.
 *
 * Am Bild selbst aendert sich nichts: kein Zoom, keine Bewegung (bestaetigte
 * Designvorgabe).
 *
 * VERHALTEN BEI PAUSE UND RECONNECT: Pausiert der Server die Enthuellung, friert
 * der Wert ein, weil `status !== 'running'` keine Weiterrechnung erlaubt. Nach
 * einem Reconnect uebernimmt der naechste Snapshot sofort wieder den Serverstand.
 */
import { revealGrid } from '@hfroemmel/quiz-core'
import { Media } from '../stage/Media'
import { QuestionHead } from '../stage/QuestionHead'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps'

export function RevealScene({ view, reveal }: SceneProps) {
  const question = view.question
  if (!question) return null

  return (
    <div
      className={`${styles.scene} ${styles.reveal}`}
      data-fit-box=""
      data-paused={String(view.reveal?.status === 'paused')}
    >
      <QuestionHead question={question} />

      <div className={styles.revealStage}>
        <Media src={question.imageUrl} reveal={{ grid: revealGrid, progress: reveal.progress }} variant="reveal" />
      </div>
    </div>
  )
}
