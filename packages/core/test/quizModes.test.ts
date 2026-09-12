/**
 * Quizarten: was der Server annimmt, was er abweist und was danach feststeht.
 *
 * Die Quizart ist die EINE Entscheidung des Pults vor dem Abend. Alles, was ein
 * Quiz ausmacht - Zielgruppe, Fragenpool, Theme und ob es eine
 * Schwierigkeitswahl gibt -, steht in der Konfiguration; hier wird geprueft,
 * dass der Server genau daraus ableitet und nichts vom Client uebernimmt.
 */
import { describe, expect, it } from 'vitest'
import { defaultPresetIdOf, quizSupportsDifficulty } from '../src'
import { resolveQuizMode } from '../src/engine/quizModes'
import { createHarness, makeQuestion, testConfig } from './helpers'

const script = () => Array.from({ length: 7 }, (_, index) => makeQuestion({ id: `q${index + 1}` }))

describe('Quizkonfiguration', () => {
  it('bietet eine Schwierigkeitswahl nur an, wo es mehr als ein Preset gibt', () => {
    expect(quizSupportsDifficulty({ presetIds: ['easy', 'medium', 'hard'] })).toBe(true)
    expect(quizSupportsDifficulty({ presetIds: ['medium'] })).toBe(false)
  })

  it('nimmt als Voreinstellung die benannte Stufe, sonst die erste', () => {
    expect(defaultPresetIdOf({ presetIds: ['easy', 'medium', 'hard'], defaultPresetId: 'medium' })).toBe('medium')
    expect(defaultPresetIdOf({ presetIds: ['easy', 'medium'] })).toBe('easy')
  })

  it('loest Zielgruppe, Pool, Theme und Stufen aus der Konfiguration auf', () => {
    const lookup = resolveQuizMode(testConfig, 'bremen')
    expect(lookup.ok).toBe(true)
    if (!lookup.ok) return
    expect(lookup.quiz).toMatchObject({
      id: 'bremen',
      audience: 'adults',
      themeId: 'default',
      poolIds: ['bremen'],
      presetIds: ['medium'],
      defaultPresetId: 'medium',
    })
  })

  it('nennt beim Aufloesen den Grund, wenn es die Quizart nicht gibt', () => {
    const lookup = resolveQuizMode(testConfig, 'atlantis')
    expect(lookup.ok).toBe(false)
    if (lookup.ok) return
    expect(lookup.message).toContain('atlantis')
  })

  it('weist eine Quizart zurueck, deren Fragenpool nicht konfiguriert ist', () => {
    const broken = {
      ...testConfig,
      quizzes: [
        { id: 'europa', label: 'Europa-Quiz', audienceId: 'adults', themeId: 'default', poolIds: ['europa'], presetIds: ['medium'] },
      ],
    }
    const lookup = resolveQuizMode(broken, 'europa')
    expect(lookup.ok).toBe(false)
    if (lookup.ok) return
    expect(lookup.message).toContain('europa')
  })

  it('weist eine Quizart zurueck, deren Theme es nicht gibt', () => {
    const broken = {
      ...testConfig,
      quizzes: [{ id: 'bunt', label: 'Buntquiz', audienceId: 'adults', themeId: 'neon', presetIds: ['medium'] }],
    }
    const lookup = resolveQuizMode(broken, 'bunt')
    expect(lookup.ok).toBe(false)
    if (lookup.ok) return
    expect(lookup.message).toContain('neon')
  })
})

describe('Spielstart ueber eine Quizart', () => {
  it('schreibt Quizart, Zielgruppe, Pool und Stufe in den Spielstand', () => {
    const harness = createHarness(script())
    const state = harness.dispatch({ type: 'START_GAME', quizId: 'bremen' })
    expect(state.quizId).toBe('bremen')
    expect(state.audience).toBe('adults')
    expect(state.poolIds).toEqual(['bremen'])
    expect(state.presetId).toBe('medium')
  })

  it('uebernimmt die gewaehlte Schwierigkeit, wo die Quizart eine Wahl anbietet', () => {
    const harness = createHarness(script())
    const state = harness.dispatch({ type: 'START_GAME', quizId: 'bundestag', presetId: 'hard' })
    expect(state.presetId).toBe('hard')
  })

  it('weist eine unbekannte Quizart ab', () => {
    const harness = createHarness(script())
    const rejection = harness.expectReject({ type: 'START_GAME', quizId: 'atlantis' })
    expect(rejection.reason).toBe('unknown-quiz')
  })

  it('weist eine Schwierigkeit ab, wo die Quizart keine anbietet', () => {
    const harness = createHarness(script())
    const rejection = harness.expectReject({ type: 'START_GAME', quizId: 'kids', presetId: 'easy' })
    expect(rejection.reason).toBe('invalid-difficulty')
  })

  it('verlangt eine Schwierigkeit, wo die Quizart eine anbietet', () => {
    const harness = createHarness(script())
    const rejection = harness.expectReject({ type: 'START_GAME', quizId: 'bundestag' })
    expect(rejection.reason).toBe('invalid-difficulty')
  })

  it('weist eine Stufe ab, die es in dieser Quizart nicht gibt', () => {
    const harness = createHarness(script())
    const rejection = harness.expectReject({ type: 'START_GAME', quizId: 'bundestag', presetId: 'regional' })
    expect(rejection.reason).toBe('invalid-difficulty')
  })

  it('weist eine Zielgruppe neben der Quizart ab - das waere eine zweite Angabe', () => {
    const harness = createHarness(script())
    const rejection = harness.expectReject({
      type: 'START_GAME',
      quizId: 'bundestag',
      presetId: 'medium',
      audience: 'kids',
    })
    expect(rejection.reason).toBe('invalid-payload')
  })

  it('startet weiterhin ohne Quizart, wenn Zielgruppe und Preset genannt sind', () => {
    const harness = createHarness(script())
    const state = harness.dispatch({ type: 'START_GAME', audience: 'adults', presetId: 'medium' })
    expect(state.quizId).toBeUndefined()
    expect(state.audience).toBe('adults')
  })

  it('weist einen Start ohne jede Angabe ab', () => {
    const harness = createHarness(script())
    expect(harness.expectReject({ type: 'START_GAME' }).reason).toBe('invalid-payload')
  })
})

describe('Theme und Angebotsliste in der Buehnenansicht', () => {
  it('zeigt vor dem Spiel alle Angebote und kein laufendes Quiz', () => {
    const harness = createHarness(script())
    const view = harness.publicView()
    expect(view.scene).toBe('start')
    expect(view.quizId).toBeUndefined()
    expect(view.quizOffers.map((offer) => offer.id)).toEqual(['bundestag', 'kids', 'bremen'])
  })

  it('traegt die Angebote ohne Zielgruppe, Pool und Preset - die Buehne soll nichts ableiten', () => {
    const harness = createHarness(script())
    const [offer] = harness.publicView().quizOffers
    expect(Object.keys(offer!).sort()).toEqual(['id', 'label'])
  })

  it('gibt dem Bundestagsquiz das helle Standard-Theme', () => {
    const harness = createHarness(script())
    harness.dispatch({ type: 'START_GAME', quizId: 'bundestag', presetId: 'medium' })
    const view = harness.publicView()
    expect(view.quizId).toBe('bundestag')
    expect(view.theme.id).toBe('default')
    expect(view.theme.skin).toBeUndefined()
  })

  it('gibt dem Kinderquiz die Kinderwelt', () => {
    const harness = createHarness(script())
    harness.dispatch({ type: 'START_GAME', quizId: 'kids' })
    expect(harness.publicView().theme.skin).toBe('kids')
  })

  it('laesst das Bremen-Quiz im Standard-Theme - eine bunte Karte ist kein Theme', () => {
    const harness = createHarness(script())
    harness.dispatch({ type: 'START_GAME', quizId: 'bremen' })
    const view = harness.publicView()
    expect(view.theme.id).toBe('default')
    expect(view.theme.skin).toBeUndefined()
  })

  it('behaelt die bestaetigte Konfiguration ueber eine neue Projektion hinweg', () => {
    const harness = createHarness(script())
    harness.dispatch({ type: 'START_GAME', quizId: 'bundestag', presetId: 'hard' })
    // Ein neu verbundener Client bekommt denselben Stand neu projiziert.
    const erste = harness.publicView()
    const zweite = harness.publicView()
    expect(zweite.quizId).toBe(erste.quizId)
    expect(zweite.theme.id).toBe(erste.theme.id)
    expect(harness.state?.presetId).toBe('hard')
  })
})

describe('Katalog des Operators', () => {
  it('nennt zu jeder Quizart, ob sie eine Schwierigkeitswahl hat', () => {
    const harness = createHarness(script())
    const quizzes = harness.operatorView().catalog.quizzes
    expect(quizzes.map((quiz) => [quiz.id, quiz.supportsDifficulty])).toEqual([
      ['bundestag', true],
      ['kids', false],
      ['bremen', false],
    ])
  })

  it('nennt die Stufen des Bundestagsquiz in der Reihenfolge des Angebots', () => {
    const harness = createHarness(script())
    const bundestag = harness.operatorView().catalog.quizzes.find((quiz) => quiz.id === 'bundestag')
    expect(bundestag?.presetIds).toEqual(['easy', 'medium', 'hard'])
    expect(bundestag?.defaultPresetId).toBe('medium')
  })
})
