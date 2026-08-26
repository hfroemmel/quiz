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
 *
 * Der Buzzerklang haengt bewusst am Phasenwechsel des Servers: Ein Tastendruck bei
 * gesperrtem Buzzer wird abgewiesen - und bleibt damit auch still.
 */
import { useEffect, useRef } from 'react'
import type { PublicQuizViewModel } from '@quiz/contracts'
import type { SoundCueId } from './soundCues'

export function useStageSounds(view: PublicQuizViewModel, play: (cueId: SoundCueId) => void): void {
  const previous = useRef({
    optionCount: 0,
    chosenOptionId: undefined as string | undefined,
    phase: view.phase,
  })

  const optionCount = view.visibleOptions?.length ?? 0
  const chosenOptionId = view.visibleOptions?.find((option) => option.state === 'chosen')?.id

  useEffect(() => {
    const before = previous.current

    if (optionCount > 0 && before.optionCount === 0) play('options-appear')
    if (chosenOptionId && chosenOptionId !== before.chosenOptionId) play('answer-logged')
    if (view.phase === 'answer-locked' && before.phase !== 'answer-locked') play('buzz')

    previous.current = { optionCount, chosenOptionId, phase: view.phase }
  }, [optionCount, chosenOptionId, view.phase, play])
}
