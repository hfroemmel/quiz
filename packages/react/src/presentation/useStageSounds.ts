/**
 * Sounds that follow from the state - not from a click.
 *
 * The scene change brings its own sound cue from the transition registry.
 * Everything else happens INSIDE a scene and therefore needs its own look at
 * the snapshot:
 *
 *   Answers faded in       visible options change from none to some
 *   Answer logged          an option gets the `chosen` state
 *   Buzzer pressed          the phase switches to `answer-locked`
 *
 * The buzzer sound deliberately hangs off the server's phase change: a key
 * press on a locked buzzer is rejected - and therefore stays silent too.
 *
 * The decision itself lives as a pure function below (`soundsFor`), so that
 * it is testable without a browser; the hook only keeps track of what applied
 * last.
 */
import { useEffect, useRef } from 'react'
import type { PublicQuizViewModel } from '@hfroemmel/quiz-core'
import type { SoundCueId } from './soundCues'

/** What has to survive from a snapshot in order to judge the next one. */
export interface SoundState {
  optionCount: number
  chosenOptionId: string | undefined
  phase: PublicQuizViewModel['phase']
}

export function soundState(view: PublicQuizViewModel): SoundState {
  return {
    optionCount: view.visibleOptions?.length ?? 0,
    chosenOptionId: view.visibleOptions?.find((option) => option.state === 'chosen')?.id,
    phase: view.phase,
  }
}

/**
 * The sounds triggered by the step from `before` to `now`.
 *
 * IN SOLO PLAY THERE IS NO BUZZER SOUND - nowhere and never. There is no
 * buzzer there either: the first tap on an answer claims the buzz for itself,
 * and until now the stage acknowledged that tap with two sounds on top of
 * each other - the selection tone and the buzzer. That sounded like a bug,
 * and the buzzer is the wrong one of the two: it announces that someone beat
 * someone else to it, and there is no one else there.
 *
 * In the duel it stays unchanged. The `answer-locked` phase is reached
 * exclusively through an accepted buzz (see `claimPlayer` in the engine), so
 * the sound continues to hang precisely off the buzz.
 */
export function soundsFor(before: SoundState, now: SoundState, player: number): SoundCueId[] {
  const sounds: SoundCueId[] = []
  if (now.optionCount > 0 && before.optionCount === 0) sounds.push('options-appear')
  if (now.chosenOptionId && now.chosenOptionId !== before.chosenOptionId) sounds.push('answer-logged')
  if (player > 1 && now.phase === 'answer-locked' && before.phase !== 'answer-locked') sounds.push('buzz')
  return sounds
}

export function useStageSounds(view: PublicQuizViewModel, play: (cueId: SoundCueId) => void): void {
  const previous = useRef<SoundState>({ optionCount: 0, chosenOptionId: undefined, phase: view.phase })

  const state = soundState(view)
  const { optionCount, chosenOptionId, phase } = state
  const player = view.playerScores.length

  useEffect(() => {
    const now: SoundState = { optionCount, chosenOptionId, phase }
    for (const cue of soundsFor(previous.current, now, player)) play(cue)
    previous.current = now
  }, [optionCount, chosenOptionId, phase, player, play])
}

/* Former names, kept for one release so that hosts can migrate. */
/** @deprecated Renamed to `SoundState`. */
export type Klangstand = SoundState
/** @deprecated Renamed to `soundState`. */
export const klangstand = soundState
/** @deprecated Renamed to `soundsFor`. */
export const klaengeFuer = soundsFor
