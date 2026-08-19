/**
 * Klaenge, die sich aus dem Zustand ergeben - nicht aus einem Klick.
 *
 * Der Szenenwechsel bringt seine Soundmarke aus dem Uebergangsregistry mit. Alles
 * andere passiert INNERHALB einer Szene und braucht deshalb einen eigenen Blick
 * auf den Snapshot:
 *
 *   Antworten eingeblendet   sichtbare Optionen wechseln von keiner auf welche
 *   Antwort eingeloggt       eine Option bekommt den Zustand `chosen`
 *   Buzzer betaetigt         die Phase wechselt auf `answer-locked`
 *   Countdown                jede volle Sekunde, und einmal am Ende
 *
 * Der Buzzerklang haengt bewusst am Phasenwechsel des Servers: Ein Tastendruck bei
 * gesperrtem Buzzer wird abgewiesen - und bleibt damit auch still.
 */
import { useEffect, useRef } from 'react'
import type { PublicQuizViewModel } from '@quiz/contracts'
import type { RevealDisplay } from '../client/useRevealClock.ts'
import type { SoundCueId } from './soundCues.ts'

export function useStageSounds(
  view: PublicQuizViewModel,
  reveal: RevealDisplay,
  play: (cueId: SoundCueId) => void,
): void {
  const previous = useRef({
    optionCount: 0,
    chosenOptionId: undefined as string | undefined,
    phase: view.phase,
    countdownSecond: reveal.countdownSeconds,
    countdownFinished: false,
    questionKey: '',
  })

  const optionCount = view.visibleOptions?.length ?? 0
  const chosenOptionId = view.visibleOptions?.find((option) => option.state === 'chosen')?.id
  // Frageidentitaet fuer die Countdown-Erkennung: eine neue Frage startet neu.
  const questionKey = `${view.progress.current}:${view.question?.prompt ?? ''}`

  useEffect(() => {
    const before = previous.current

    if (optionCount > 0 && before.optionCount === 0) play('options-appear')
    if (chosenOptionId && chosenOptionId !== before.chosenOptionId) play('answer-logged')
    if (view.phase === 'answer-locked' && before.phase !== 'answer-locked') play('buzz')

    if (view.scene === 'reveal' && questionKey === before.questionKey) {
      const running = view.reveal?.status === 'running'
      if (running && reveal.countdownSeconds < before.countdownSecond) play('countdown-tick')
      if (reveal.progress >= 1 && !before.countdownFinished) play('countdown-end')
    }

    previous.current = {
      optionCount,
      chosenOptionId,
      phase: view.phase,
      countdownSecond: reveal.countdownSeconds,
      countdownFinished: view.scene === 'reveal' && reveal.progress >= 1,
      questionKey,
    }
  }, [
    optionCount,
    chosenOptionId,
    view.phase,
    view.scene,
    view.reveal?.status,
    reveal.countdownSeconds,
    reveal.progress,
    questionKey,
    play,
  ])
}
