/**
 * The background of a question, and who may read it.
 *
 * An explanation is written for the moderator: they tell it, in their own
 * words, while the hall listens. That is why nothing of it used to leave the
 * server publicly - a screen that wrote it out would compete with the person
 * speaking.
 *
 * At a device there is nobody to tell it. The two people at the table read it
 * themselves, so a quiz set up for that place says
 * `rules.showDetailsAfterSolution` - and then the detail text travels with the
 * solution. These tests pin down both directions, because the rule moves a
 * piece of text across the line the projection exists to draw.
 */
import { describe, expect, it } from 'vitest'
import { buzzIn, createHarness, makeQuestion, startGame } from './helpers'

const background = {
  summary: 'Kurz fuer die Moderation',
  details: 'Der Bundestag zog 1999 vom Wasserwerk in das umgebaute Reichstagsgebaeude.',
  source: 'Redaktionelle Quelle',
  moderatorNotes: 'Regieanweisung',
}

/** Seven questions, the first of which carries editorial background. */
const sevenWithBackground = () =>
  Array.from({ length: 7 }, (_, index) =>
    makeQuestion({
      id: `q${index + 1}`,
      questionType: 'text-choice',
      evaluationMode: 'option-comparison',
      ...(index === 0 ? { explanation: background } : {}),
    }),
  )

/** Plays the first question through to the solution scene. */
function toSolution(harness: ReturnType<typeof createHarness>): void {
  startGame(harness)
  buzzIn(harness, 'player-1')
  harness.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: 'a' })
  harness.dispatch({ type: 'RESOLVE_ATTEMPT' })
  harness.settle()
}

describe('the background in the public view', () => {
  it('stays with the moderator where nothing is configured', () => {
    const harness = createHarness(sevenWithBackground())
    toSolution(harness)

    const view = harness.publicView()
    expect(view.scene).toBe('solution')
    expect(view.visibleSolution?.answerText).toBe('Antwort A')
    // The house rule: told, not written out.
    expect(view.visibleSolution?.details).toBeUndefined()
    // And the moderator has it, as before.
    expect(harness.moderatorView().explanation?.details).toBe(background.details)
  })

  it('travels with the solution where the installation asks for it', () => {
    const harness = createHarness(sevenWithBackground(), { rules: { showDetailsAfterSolution: true } })
    toSolution(harness)

    expect(harness.publicView().visibleSolution?.details).toBe(background.details)
  })

  it('carries the detail text and nothing else of the explanation', () => {
    const harness = createHarness(sevenWithBackground(), { rules: { showDetailsAfterSolution: true } })
    toSolution(harness)

    /*
     * The short version is the moderator's lead-in, the source an editorial
     * note, the directing notes are stage directions. None of the three is
     * meant for a player, and a rule about the background must not smuggle
     * them along.
     */
    const solution = JSON.stringify(harness.publicView().visibleSolution)
    expect(solution).toContain(background.details)
    expect(solution).not.toContain(background.summary)
    expect(solution).not.toContain(background.source)
    expect(solution).not.toContain(background.moderatorNotes)
  })

  it('is absent before the solution stands, even with the rule on', () => {
    const harness = createHarness(sevenWithBackground(), { rules: { showDetailsAfterSolution: true } })
    startGame(harness)
    buzzIn(harness, 'player-1')

    /*
     * The solution itself is only transmitted in the solution scene, and the
     * background hangs on the solution - so a client cannot read the answer
     * out of the background while the question still stands.
     */
    const view = harness.publicView()
    expect(view.scene).not.toBe('solution')
    expect(view.visibleSolution).toBeUndefined()
  })

  it('leaves the field out where a question brings no background', () => {
    const harness = createHarness(
      Array.from({ length: 7 }, (_, index) => makeQuestion({ id: `q${index + 1}` })),
      { rules: { showDetailsAfterSolution: true } },
    )
    toSolution(harness)

    /*
     * The field is absent, not empty: the device reads its presence as "there
     * is a step here", and an empty string would buy an in-between screen with
     * nothing on it.
     */
    const solution = harness.publicView().visibleSolution!
    expect(solution.details).toBeUndefined()
    expect('details' in solution).toBe(false)
  })

  it('leaves the field out where the explanation has only a summary', () => {
    const harness = createHarness(
      Array.from({ length: 7 }, (_, index) =>
        makeQuestion({
          id: `q${index + 1}`,
          ...(index === 0 ? { explanation: { summary: 'Nur kurz' } } : {}),
        }),
      ),
      { rules: { showDetailsAfterSolution: true } },
    )
    toSolution(harness)

    expect(harness.publicView().visibleSolution?.details).toBeUndefined()
  })
})
