/**
 * Scene choice of the stage (specification 22.1).
 *
 * The scene follows the phase. The only exception is the image reveal: even
 * when a player holds the buzz, the frozen picture stays - that is exactly what
 * is being talked about at this moment.
 */
import { describe, expect, it } from 'vitest'
import { sceneForPhase } from '../src/engine/projection'
import { createHarness, makeQuestion, startGame } from './helpers'

describe('sceneForPhase', () => {
  it('follows the phase when the question type demands nothing else', () => {
    expect(sceneForPhase('buzzer-open', 'text-choice')).toBe('question')
    expect(sceneForPhase('answer-locked', 'text-choice')).toBe('question')
    expect(sceneForPhase('solution', 'text-choice')).toBe('solution')
    expect(sceneForPhase('reveal-running', 'image-reveal')).toBe('reveal')
  })

  it('keeps image recognition in the reveal scene during player selection', () => {
    expect(sceneForPhase('answer-locked', 'image-reveal')).toBe('reveal')
  })

  it('leaves the reveal as soon as it is resolved', () => {
    expect(sceneForPhase('solution', 'image-reveal')).toBe('solution')
    expect(sceneForPhase('attempt-feedback', 'image-reveal')).toBe('feedback')
  })
})

/*
 * THE RUBRIC OF A QUESTION - one line, whether it is graded or not.
 *
 * The editors write the rubric in two columns: the broad subject and the finer
 * one under it. The stage shows one line, and it is assembled here so that
 * every surface that names the rubric names the same string - the board above
 * the answers, the interstitial before the question and the card between two
 * questions.
 */
describe('The rubric line', () => {
  const rest = Array.from({ length: 6 }, (_, index) => makeQuestion({ id: `q${index + 2}` }))
  const lineOf = (categories: string[]) => {
    const harness = createHarness([makeQuestion({ id: 'q1', categories }), ...rest])
    startGame(harness)
    return harness.publicView().question?.categoryLabel
  }

  it('names both rubrics, the broad one first', () => {
    expect(lineOf(['general', 'geschichte'])).toBe('Allgemein - Geschichte')
  })

  it('names one where there is one', () => {
    expect(lineOf(['general'])).toBe('Allgemein')
  })

  /*
   * A rubric the configuration does not know is LEFT OUT rather than shown as
   * an id: a raw "erinnerungsorte" on the stage is worse than the one rubric
   * that is properly labelled.
   */
  it('leaves out what the configuration does not know', () => {
    expect(lineOf(['general', 'nicht-konfiguriert'])).toBe('Allgemein')
    expect(lineOf(['nicht-konfiguriert'])).toBeUndefined()
  })
})

/*
 * THE LICENCE LINE TRAVELS WITH THE PICTURE.
 *
 * Wherever a photo is shown, the line that names its origin belongs on the
 * screen - so it is part of the same view model as the url, in the question as
 * in the solution. A client that had to look it up elsewhere would sooner or
 * later show one without the other.
 */
describe('The licence line of a picture', () => {
  const withImage = (credit?: string) =>
    makeQuestion({
      id: 'q1',
      image: credit === undefined ? { filename: 'questions/img-1.jpg' } : { filename: 'questions/img-1.jpg', credit },
    })
  const rest = Array.from({ length: 6 }, (_, index) => makeQuestion({ id: `q${index + 2}` }))

  it('stands beside the url of the question and of the solution', () => {
    const harness = createHarness([withImage('Foto: Deutscher Bundestag'), ...rest])
    startGame(harness)

    expect(harness.publicView().question?.imageCredit).toBe('Foto: Deutscher Bundestag')

    harness.dispatch({ type: 'RESOLVE_WITHOUT_ANSWER' })
    expect(harness.publicView().visibleSolution?.imageCredit).toBe('Foto: Deutscher Bundestag')
  })

  it('is absent where the content names no origin', () => {
    const harness = createHarness([withImage(), ...rest])
    startGame(harness)

    const question = harness.publicView().question
    // The picture is there, the line is not - and the field is not an empty string.
    expect(question?.imageUrl).toBeDefined()
    expect(question?.imageCredit).toBeUndefined()
  })
})
