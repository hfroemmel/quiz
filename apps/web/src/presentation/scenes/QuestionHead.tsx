/**
 * Kopfzone einer Frage: Medium, Rubrik und Fragetext.
 *
 * Sie sieht in Frage-, Enthuellungs- und Loesungsszene gleich aus. Deshalb steht
 * sie einmal hier, statt in drei Szenen wiederholt zu werden.
 *
 * Die Rubrik ist das Label der ersten Kategorie und kommt fertig aus dem
 * View-Modell; der Client schlaegt nichts nach.
 */
import type { ReactNode } from 'react'
import type { PublicQuestion } from '@quiz/contracts'

interface QuestionHeadProps {
  question: PublicQuestion
  /** Bild oder Video links neben dem Text. Fehlt es, laeuft der Text ueber die volle Breite. */
  media?: ReactNode
}

export function QuestionHead({ question, media }: QuestionHeadProps) {
  const hasMedia = Boolean(media)
  return (
    <div className={`question-head ${hasMedia ? 'question-head--with-media' : 'question-head--wide'}`}>
      {media}
      <div className="question-head__text">
        {question.categoryLabel && <p className="question-head__category">{question.categoryLabel}</p>}
        <h2 className="question-head__prompt">{question.prompt}</h2>
      </div>
    </div>
  )
}
