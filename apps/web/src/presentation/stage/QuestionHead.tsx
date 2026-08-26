/**
 * Kopfzone einer Frage: Medium und Fragetafel - EIN Bauteil fuer beide Welten.
 *
 * Sie sieht in Frage-, Enthuellungs- und Loesungsszene gleich aus. Deshalb steht
 * sie einmal hier, statt in drei Szenen wiederholt zu werden.
 *
 * Die Rubrik ist das Label der ersten Kategorie und kommt fertig aus dem
 * View-Modell; der Client schlaegt nichts nach.
 *
 * OB EIN BILD DA IST, entscheidet die Adresse - nicht die Frage, ob eine
 * Bildkomponente uebergeben wurde. Sonst gilt eine Frage ohne Foto als
 * bebildert, und die Fragetafel bekaeme eine Spalte fuer nichts.
 */
import type { PublicQuestion } from '@hfroemmel/quiz-core'
import { Media } from './Media'
import { useFittedPrompt } from './useFittedPrompt'
import styles from './QuestionHead.module.css'

interface QuestionHeadProps {
  question: PublicQuestion
  /** Bildadresse; fehlt sie, laeuft die Fragetafel ueber die volle Breite. */
  imageUrl?: string
  variant?: 'inline' | 'solution'
}

export function QuestionHead({ question, imageUrl, variant = 'inline' }: QuestionHeadProps) {
  // Lange Fragen werden verkleinert, bis nichts mehr aus der Szene ragt.
  const promptRef = useFittedPrompt(question.prompt)

  return (
    <div className={`${styles.head} ${imageUrl ? styles.withMedia : styles.wide}`}>
      {imageUrl && <Media src={imageUrl} variant={variant} />}
      <div className={styles.panel} data-panel="">
        {question.categoryLabel && <p className={styles.category} data-category="">
            {question.categoryLabel}
          </p>}
        <h2 ref={promptRef} className={styles.prompt} data-prompt="">
          {question.prompt}
        </h2>
      </div>
    </div>
  )
}
