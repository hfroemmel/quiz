/**
 * Komposition einer Frageansicht: Medium, Fragetafel, Antwortzeilen.
 *
 * Frage- und Loesungsszene zeigen dieselben Teile in derselben Anordnung; sie
 * unterscheiden sich nur darin, was zwischen Frage und Antworten steht (der
 * Hinweis auf die zweite Chance bzw. das Etikett "Richtige Antwort:"). Diese
 * Stelle ist deshalb ein Kind-Slot.
 *
 * ZWEI ANORDNUNGEN, EINE ENTSCHEIDUNG:
 *
 *   Regelfall     Bild links, Rubrik und Frage daneben, Antworten darunter
 *   `person`      das Portraet IST die Frage: gross links, alles andere rechts
 *
 * Welche gilt, steht im Fragetyp des Servers - hier wird sie an genau einer
 * Stelle gelesen, damit Frage und Loesung nie auseinanderlaufen.
 */
import type { ReactNode } from 'react'
import type { PublicQuestion } from '@quiz/contracts'
import { AnswerList, type AnswerRow } from './AnswerList'
import { Media } from './Media'
import { QuestionHead } from './QuestionHead'
import styles from './QuestionComposition.module.css'
import type { SceneAnswering } from '../scenes/sceneProps'

interface QuestionCompositionProps {
  question: PublicQuestion
  /** Bildadresse; in der Loesung kann sie von der der Frage abweichen. */
  imageUrl?: string
  mediaVariant?: 'inline' | 'solution'
  rows: AnswerRow[]
  /** Nur am Touchgeraet: macht die Zeilen zu Schaltflaechen. */
  answering?: SceneAnswering
  /** Steht zwischen Frage und Antworten. */
  children?: ReactNode
}

export function QuestionComposition({
  question,
  imageUrl,
  mediaVariant = 'inline',
  rows,
  answering,
  children,
}: QuestionCompositionProps) {
  /*
   * Die Liste bekommt entweder beides oder nichts: Ein `onSelect` ohne die
   * Angabe, wer tippen darf, machte auf dem Beamer aus Anzeigezeilen Knoepfe.
   */
  const list = answering
    ? { onSelect: answering.onSelect, disabled: answering.disabled, label: answering.label }
    : {}
  /*
   * Ohne Bild gibt es nichts, wonach sich die Portraetanordnung richten koennte -
   * die Bildspalte bliebe leer und die Frage stuende zusammengedraengt daneben.
   * Die Validierung verlangt zwar ein Bild, aber ein fehlendes Medium darf die
   * Buehne im Betrieb nicht entstellen.
   */
  if (question.presentationType === 'person' && imageUrl) {
    return (
      <div className={styles.person}>
        <Media src={imageUrl} variant="portrait" />
        <div className={styles.column}>
          <QuestionHead question={question} />
          {children}
          <AnswerList rows={rows} {...list} />
        </div>
      </div>
    )
  }

  return (
    <>
      <QuestionHead question={question} imageUrl={imageUrl} variant={mediaVariant} />
      {children}
      <AnswerList rows={rows} {...list} />
    </>
  )
}
