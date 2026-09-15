/**
 * The stage's sound rules - without a browser.
 *
 * What is tested is the pure decision, not the hook: what a step from one
 * state to the next triggers depends on nothing but these two states and the
 * number of players.
 */
import { describe, expect, it } from 'vitest'
import { soundsFor, type SoundState } from '../src/presentation/useStageSounds'

const empty: SoundState = { optionCount: 0, chosenOptionId: undefined, phase: 'idle' }

const state = (part: Partial<SoundState>): SoundState => ({ ...empty, ...part })

describe('soundsFor', () => {
  it('reports the revealed answers exactly once', () => {
    const open = state({ optionCount: 4, phase: 'buzzer-open' })
    expect(soundsFor(empty, open, 2)).toEqual(['options-appear'])
    expect(soundsFor(open, open, 2)).toEqual([])
  })

  it('reports every newly logged answer - including a changed one', () => {
    const before = state({ optionCount: 4, phase: 'answer-locked' })
    const first = state({ optionCount: 4, chosenOptionId: 'a', phase: 'answer-locked' })
    const second = state({ optionCount: 4, chosenOptionId: 'b', phase: 'answer-locked' })
    expect(soundsFor(before, first, 2)).toEqual(['answer-logged'])
    expect(soundsFor(first, first, 2)).toEqual([])
    expect(soundsFor(first, second, 2)).toEqual(['answer-logged'])
  })

  it('reports the buzz-in in a duel', () => {
    const open = state({ optionCount: 4, phase: 'buzzer-open' })
    const award = state({ optionCount: 4, phase: 'answer-locked' })
    expect(soundsFor(open, award, 2)).toEqual(['buzz'])
  })

  it('NEVER reports the buzz-in in a solo game', () => {
    const open = state({ optionCount: 4, phase: 'buzzer-open' })
    const award = state({ optionCount: 4, phase: 'answer-locked' })
    expect(soundsFor(open, award, 1)).toEqual([])
  })

  it('leaves the selection sound untouched in a solo game', () => {
    /*
     * The tap on an answer there claims the buzz and the answer in one move:
     * phase and selection change in the same step. Exactly one sound is
     * heard - that of the selection.
     */
    const open = state({ optionCount: 4, phase: 'buzzer-open' })
    const tapped = state({ optionCount: 4, chosenOptionId: 'a', phase: 'answer-locked' })
    expect(soundsFor(open, tapped, 1)).toEqual(['answer-logged'])
    expect(soundsFor(open, tapped, 2)).toEqual(['answer-logged', 'buzz'])
  })
})
