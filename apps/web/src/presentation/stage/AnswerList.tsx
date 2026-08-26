/**
 * Antwortzeilen - EIN Bauteil fuer alle Zeilen, alle Zustaende, beide Welten.
 *
 * Aufbau jeder Zeile: Buchstabenchip und Antwortflaeche sind zwei getrennte
 * Geschwister. Der breite Hintergrund gehoert ausschliesslich auf die Flaeche;
 * laege er auf der Zeile, saesse der Buchstabe mit darauf.
 *
 *   li.answer > span.chip + span.surface > span.text
 *
 * Auf der Buehne sind die Zeilen KEINE Schaltflaechen: Dort wird nicht geklickt,
 * gespielt wird ueber Buzzer und Operator, und der Screen zeigt nur den Zustand,
 * den der Server sendet.
 *
 * Am Touchgeraet sind sie es. Dort ersetzt der Fingertipp den Buzzer, und dann
 * braucht jede Zeile ein echtes `button` - wegen der Tastatur, wegen der
 * Vorlesewerkzeuge und wegen der Trefferflaeche. Diese Zeilen bekommen deshalb
 * `onSelect`; ohne den Rueckruf bleibt alles wie auf der Buehne.
 *
 * Es gibt bewusst keine zweite Zeilenkomponente, die spaeter abweichen koennte:
 * Zustaende, Buchstabenchip und Zeichnung sollen sich nie auseinanderentwickeln,
 * nur weil ein Kontext dazugekommen ist.
 */
import { presentationTiming } from '../animationPresets'
import { optionLetter, type AnswerState } from './answerState'
import styles from './AnswerList.module.css'

export interface AnswerRow {
  id: string
  letter?: string
  text: string
  state: AnswerState
}

export interface AnswerListProps {
  rows: AnswerRow[]
  /**
   * Nur am Touchgeraet: Was passiert, wenn eine Zeile getippt wird. Ist der
   * Rueckruf gesetzt, wird jede Zeile zur Schaltflaeche.
   */
  onSelect?: (optionId: string) => void
  /** Antworten gerade nicht moeglich - die Schaltflaechen sind stumpf. */
  disabled?: boolean
  /** Vorlesewerkzeuge sollen wissen, wessen Antworten das sind. */
  label?: string
}

export function AnswerList({ rows, onSelect, disabled, label }: AnswerListProps) {
  if (rows.length === 0) return null
  return (
    <ul
      className={styles.answers}
      data-answers=""
      {...(onSelect ? { role: 'group' } : {})}
      {...(label ? { 'aria-label': label } : {})}
    >
      {rows.map((row, index) => {
        /*
         * Feste Spalte, feste Groesse: Bei zweizeiligem Text darf der Buchstabe
         * weder mitwachsen noch nach unten rutschen - sonst tanzen die Buchstaben
         * A bis D in der Senkrechten.
         */
        const content = (
          <>
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
          </>
        )

        return (
          <li
            key={row.id}
            className={styles.answer}
            data-answer=""
            data-state={row.state}
            /* Versatz der Einlaufanimation - die Zeilen erscheinen nacheinander. */
            style={{ animationDelay: `${index * presentationTiming.optionStaggerMs}ms` }}
          >
            {onSelect ? (
              /*
               * Die Schaltflaeche traegt dieselbe Aufteilung wie die Buehnenzeile
               * und keine eigene Gestaltung: Chip und Flaeche sollen an beiden
               * Orten gleich aussehen.
               */
              <button
                type="button"
                className={styles.touch}
                data-answer-button=""
                disabled={disabled}
                onClick={() => onSelect(row.id)}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        )
      })}
    </ul>
  )
}

export { optionLetter }
