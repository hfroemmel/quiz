/**
 * Bilderkennen mit synchroner Aufloesung (Spezifikation 10).
 *
 * Das Bild liegt unter einer Decke aus Kacheln, die eine nach der anderen
 * verschwindet. Sie IST die Uhr: Wer sehen will, wie viel Zeit bleibt, sieht auf
 * das Bild. Eine Zahl daneben gab es frueher, sie ist bewusst entfallen - der
 * Saal soll auf das Motiv schauen, nicht auf einen Zaehler.
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
import { revealGrid } from '@quiz/contracts'
import { Media } from '../stage/Media.tsx'
import { QuestionHead } from '../stage/QuestionHead.tsx'
import styles from './scenes.module.css'
import type { SceneProps } from './sceneProps.ts'

export function RevealScene({ view, reveal, variant }: SceneProps) {
  const question = view.question
  if (!question) return null

  const paused = view.reveal?.status === 'paused'
  const finished = reveal.progress >= 1
  /*
   * Regievermerk fuer den Operator: Er sagt, warum das Bild steht bzw. dass nach
   * dem Aufdecken weiterhin gebuzzert werden darf. Der Saal braucht ihn nicht und
   * bekommt ihn deshalb nicht.
   */
  const hint = variant !== 'preview' ? null : paused ? 'pausiert' : finished ? 'Buzzern weiterhin möglich' : null

  return (
    <div className={`${styles.scene} ${styles.reveal}`} data-fit-box="" data-paused={String(paused)}>
      <QuestionHead question={question} />

      <div className={styles.revealStage}>
        <Media src={question.imageUrl} reveal={{ grid: revealGrid, progress: reveal.progress }} variant="reveal" />
      </div>

      {hint && <span className={styles.revealHint}>{hint}</span>}
    </div>
  )
}
