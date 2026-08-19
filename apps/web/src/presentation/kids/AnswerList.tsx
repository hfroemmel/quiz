/**
 * Antwortzeilen der Kinderansicht.
 *
 * `AnswerOption` deckt alle vier Antworten und alle Zustaende ab - es gibt
 * bewusst keine zweite Zeilenkomponente, die spaeter abweichen koennte.
 *
 * ZWEI FLAECHEN, NICHT EINE: Buchstabenchip und Antwortkarte sind getrennte
 * Geschwister mit einer sichtbaren Luecke dazwischen (Assetpaket, Abschnitt 6).
 * Die breite Kartenzeichnung liegt ausschliesslich auf `.kids-answer__surface`;
 * laege sie auf der Zeile, saesse der Chip auf derselben Karte und die Ansicht
 * verloere genau den gezeichneten Aufbau der Designreferenz.
 *
 * Die Zeilen sind KEINE Schaltflaechen: Auf der Buehne wird nicht geklickt.
 * Gespielt wird ueber Buzzer und Operator; der Screen zeigt nur den Zustand, den
 * der Server sendet.
 */
import { optionLetter } from '../../ui/OptionBar.tsx'
import { answerVisualState } from './answerVisualState.ts'
import { answerBadge, answerSurface } from './kidsAssets.ts'
import { KidsSurface } from './KidsSurface.tsx'
import type { PublicOption, PublicScene } from '@quiz/contracts'

export function AnswerList({ options, scene }: { options: PublicOption[]; scene: PublicScene }) {
  if (options.length === 0) return null
  return (
    <ul className="kids-answers">
      {options.map((option, index) => (
        <AnswerOption
          key={option.id}
          index={index}
          letter={optionLetter(index)}
          text={option.text}
          state={answerVisualState(option, scene)}
        />
      ))}
    </ul>
  )
}

function AnswerOption({
  index,
  letter,
  text,
  state,
}: {
  index: number
  letter: string
  text: string
  state: ReturnType<typeof answerVisualState>
}) {
  /*
   * Der Index waehlt die Zeichnung mit aus: Im Entwurf hat jede Zeile ihre
   * eigene Kontur. Die Slice-Werte stammen aus `boxes.json` des Pakets.
   */
  return (
    <li className="kids-answer" data-state={state}>
      {/*
        * Der Chip traegt seine eigene quadratische Zeichnung und steht in einer
        * festen Spalte. Er darf bei zweizeiligem Text weder mitwachsen noch nach
        * unten rutschen - sonst tanzen die Buchstaben A bis D in der Senkrechten.
        */}
      <KidsSurface as="span" image={answerBadge(state, index)} slice={24} className="kids-answer__chip">
        {letter}
      </KidsSurface>
      <KidsSurface as="span" image={answerSurface(state, index)} slice={24} className="kids-answer__surface">
        <span className="kids-answer__text">{text}</span>
      </KidsSurface>
    </li>
  )
}
