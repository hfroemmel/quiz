/**
 * Antwortzeilen - EIN Bauteil fuer alle Zeilen, alle Zustaende, beide Welten.
 *
 * Aufbau jeder Zeile: Buchstabenchip und Antwortflaeche sind zwei getrennte
 * Geschwister. Der breite Hintergrund gehoert ausschliesslich auf die Flaeche;
 * laege er auf der Zeile, saesse der Buchstabe mit darauf.
 *
 *   li.answer > span.chip + span.surface > span.text
 *
 * Die Zeilen sind KEINE Schaltflaechen: Auf der Buehne wird nicht geklickt.
 * Gespielt wird ueber Buzzer und Operator; der Screen zeigt nur den Zustand, den
 * der Server sendet.
 *
 * Es gibt bewusst keine zweite Zeilenkomponente, die spaeter abweichen koennte.
 */
import { presentationTiming } from '../animationPresets.ts'
import { optionLetter, type AnswerState } from './answerState.ts'
import styles from './AnswerList.module.css'

export interface AnswerRow {
  id: string
  letter?: string
  text: string
  state: AnswerState
}

export function AnswerList({ rows }: { rows: AnswerRow[] }) {
  if (rows.length === 0) return null
  return (
    <ul className={styles.answers} data-answers="">
      {rows.map((row, index) => (
        <li
          key={row.id}
          className={styles.answer}
          data-answer=""
          data-state={row.state}
          /* Versatz der Einlaufanimation - die Zeilen erscheinen nacheinander. */
          style={{ animationDelay: `${index * presentationTiming.optionStaggerMs}ms` }}
        >
          {/*
            * Feste Spalte, feste Groesse: Bei zweizeiligem Text darf der
            * Buchstabe weder mitwachsen noch nach unten rutschen - sonst tanzen
            * die Buchstaben A bis D in der Senkrechten.
            */}
          {row.letter && (
            <span className={styles.chip} data-answer-chip="">
              {row.letter}
            </span>
          )}
          <span className={styles.surface} data-answer-surface="">
            <span className={styles.text} data-answer-text="">
              {row.text}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export { optionLetter }
