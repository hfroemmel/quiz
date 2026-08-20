/**
 * Privater Informationsbereich fuer den Operator (Spezifikation 6.2, Punkt 3).
 *
 * Alles hier ist ausdruecklich NICHT oeffentlich: richtige Antwort, Erklaerung,
 * Quellen und Regiehinweise. Der Buehnenscreen bekommt diese Felder serverseitig
 * gar nicht erst uebertragen.
 */
import type { ModeratorQuizViewModel } from '@quiz/contracts'
import styles from './PrivatePanel.module.css'

export function PrivatePanel({ view }: { view: ModeratorQuizViewModel }) {
  const solution = view.privateSolution
  const explanation = view.explanation
  if (!solution && !explanation) return null

  return (
    <section className={styles.private} aria-label="Private Informationen">
      {solution && (
        <div className={styles.block}>
          <h3>Richtige Antwort</h3>
          <p className={styles.answer} data-private-answer="">{solution.answerText}</p>
          {solution.acceptedAnswerText && solution.acceptedAnswerText.length > 1 && (
            <p className={styles.accepted}>
              Ebenfalls akzeptabel: {solution.acceptedAnswerText.slice(1).join(', ')}
            </p>
          )}
        </div>
      )}

      {explanation?.summary && (
        <div className={styles.block}>
          <h3>Zusatzinformation</h3>
          <p>{explanation.summary}</p>
        </div>
      )}
      {explanation?.details && (
        <div className={styles.block}>
          <h3>Hintergrund</h3>
          <p>{explanation.details}</p>
        </div>
      )}
      {explanation?.moderatorNotes && (
        <div className={`${styles.block} ${styles.notes}`}>
          <h3>Regiehinweis</h3>
          <p>{explanation.moderatorNotes}</p>
        </div>
      )}
      {explanation?.source && (
        <div className={styles.block}>
          <h3>Quelle</h3>
          <p className={styles.source}>{explanation.source}</p>
        </div>
      )}
    </section>
  )
}
