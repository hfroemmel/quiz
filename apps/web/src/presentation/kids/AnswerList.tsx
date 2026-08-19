/**
 * Antwortzeilen der Kinderansicht.
 *
 * `AnswerOption` deckt alle vier Antworten und alle Zustaende ab - es gibt
 * bewusst keine zweite Zeilenkomponente, die spaeter abweichen koennte.
 *
 * Die Zeilen sind KEINE Schaltflaechen: Auf der Buehne wird nicht geklickt.
 * Gespielt wird ueber Buzzer und Operator; der Screen zeigt nur den Zustand, den
 * der Server sendet.
 */
import { optionLetter } from '../../ui/OptionBar.tsx'
import { answerVisualState } from './answerVisualState.ts'
import { kidsAssets } from './kidsAssets.ts'
import { KidsSurface } from './KidsSurface.tsx'
import type { PublicOption, PublicScene } from '@quiz/contracts'

export function AnswerList({ options, scene }: { options: PublicOption[]; scene: PublicScene }) {
  if (options.length === 0) return null
  return (
    <ul className="kids-answers">
      {options.map((option, index) => (
        <AnswerOption key={option.id} letter={optionLetter(index)} text={option.text} state={answerVisualState(option, scene)} />
      ))}
    </ul>
  )
}

function AnswerOption({
  letter,
  text,
  state,
}: {
  letter: string
  text: string
  state: ReturnType<typeof answerVisualState>
}) {
  return (
    <KidsSurface as="li" image={kidsAssets.answer[state]} className="kids-answer" data-state={state}>
      {/*
        * Der Chip steht in einer festen Spalte. Er darf bei zweizeiligem Text
        * weder mitwachsen noch nach unten rutschen - sonst tanzen die
        * Buchstaben A bis D in der Senkrechten.
        */}
      <span className="kids-answer__chip" style={{ ['--kids-chip' as string]: `url(${kidsAssets.chip[state]})` }}>
        {letter}
      </span>
      <span className="kids-answer__text">{text}</span>
    </KidsSurface>
  )
}
