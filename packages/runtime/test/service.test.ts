/**
 * Integrations- und Persistenztests (Spezifikation 31.3).
 *
 * Geprueft wird die Kette Befehl -> Transaktion -> Verteilung, die Wiederherstellung
 * nach Serverneustart in kritischen Phasen und die Rollentrennung der View-Modelle.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createRig, playQuestion, type TestRig } from './helpers.ts'

const rigs: TestRig[] = []
function rig(options?: Parameters<typeof createRig>[0]): TestRig {
  const created = createRig(options)
  rigs.push(created)
  return created
}

afterEach(() => {
  while (rigs.length) rigs.pop()!.dispose()
})

function startGame(target: TestRig, presetId = 'medium'): void {
  const result = target.send({ type: 'START_GAME', quizModeId: 'adults', presetId })
  expect(result.ok).toBe(true)
  target.settle()
}

describe('Befehl, Transaktion und Verteilung', () => {
  it('speichert Zustand, Punktebuchung, Nutzung und Auditlog gemeinsam', () => {
    const target = rig()
    let broadcasts = 0
    target.service.onChange(() => {
      broadcasts += 1
    })

    startGame(target)
    expect(target.store.countRows('games')).toBe(1)
    expect(target.store.countRows('game_state')).toBe(1)
    expect(target.store.countRows('question_usage')).toBe(1)
    expect(broadcasts).toBeGreaterThan(0)

    playQuestion(target, 'correct-first')
    expect(target.store.countRows('score_transactions')).toBe(1)
    expect(target.store.countRows('attempts')).toBe(1)
    expect(target.service.authoritativeState!.players[0]!.score).toBe(100)
  })

  it('vergibt bei doppelter Command-ID keine doppelten Punkte', () => {
    const target = rig()
    startGame(target)
    const question = target.service.authoritativeState!.currentQuestion!.question
    target.send({ type: 'OPEN_BUZZER' })
    target.send({ type: 'BUZZ', playerId: 'player-1' })
    target.send({ type: 'LOG_OPTION_ANSWER', optionId: question.correctOptionId! })

    const envelope = {
      commandId: 'doppelt-1',
      command: { type: 'RESOLVE_ATTEMPT' },
      actor: { clientId: 'operator-test', role: 'operator' },
      expectedRevision: target.service.currentRevision,
    }
    const first = target.service.dispatch(envelope)
    const second = target.service.dispatch(envelope)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(target.service.authoritativeState!.players[0]!.score).toBe(100)
    expect(target.store.countRows('score_transactions')).toBe(1)
  })

  it('weist einen Befehl auf veralteter Revision verstaendlich ab', () => {
    const target = rig()
    startGame(target)
    const staleRevision = target.service.currentRevision
    target.send({ type: 'OPEN_BUZZER' })

    const result = target.service.dispatch({
      commandId: 'veraltet-1',
      command: { type: 'RESET_BUZZER' },
      actor: { clientId: 'operator-test', role: 'operator' },
      expectedRevision: staleRevision,
    })
    expect(result.ok).toBe(false)
    expect(result.rejection?.reason).toBe('revision-conflict')
    expect(result.rejection?.message).toContain('geaendert')
  })

  it('gibt bei zwei gleichzeitigen Steuerbefehlen dem ersten den Vorrang', () => {
    const target = rig()
    startGame(target)
    target.send({ type: 'OPEN_BUZZER' })
    const revision = target.service.currentRevision

    // Operator und Moderator entscheiden gleichzeitig auf demselben Stand.
    const operatorCommand = target.service.dispatch({
      commandId: 'gleichzeitig-operator',
      command: { type: 'BUZZ', playerId: 'player-1' },
      actor: { clientId: 'operator-test', role: 'operator' },
      expectedRevision: revision,
    })
    const moderatorCommand = target.service.dispatch({
      commandId: 'gleichzeitig-moderator',
      command: { type: 'RESOLVE_WITHOUT_ANSWER' },
      actor: { clientId: 'moderator-test', role: 'moderator' },
      expectedRevision: revision,
    })

    expect(operatorCommand.ok).toBe(true)
    expect(moderatorCommand.ok).toBe(false)
    expect(moderatorCommand.rejection?.reason).toBe('revision-conflict')
    expect(target.service.authoritativeState!.buzzer.acceptedPlayerId).toBe('player-1')
  })

  it('laesst den Moderator keine Punkte aendern', () => {
    const target = rig()
    startGame(target)
    const result = target.send({ type: 'ADJUST_SCORE', playerId: 'player-1', direction: 'increase' }, 'moderator')
    expect(result.ok).toBe(false)
    expect(result.rejection?.reason).toBe('forbidden-role')
  })
})

describe('Rollenabhaengige View-Modelle', () => {
  it('sendet dem Buehnenscreen niemals die Loesung, bevor sie oeffentlich ist', () => {
    const target = rig()
    startGame(target)
    target.send({ type: 'OPEN_BUZZER' })

    const stage = target.service.snapshotFor('stage')
    const moderator = target.service.snapshotFor('moderator')

    expect(stage.visibleSolution).toBeUndefined()
    expect(JSON.stringify(stage)).not.toContain('privateSolution')
    expect(stage.visibleOptions?.every((option) => option.state === undefined)).toBe(true)
    // Moderator und Operator sehen die Loesung dagegen sofort.
    expect(moderator.privateSolution?.answerText.length).toBeGreaterThan(0)
  })

  it('haelt die Loesung auch nach einer falschen ersten Antwort verborgen', () => {
    const target = rig()
    startGame(target)
    const question = target.service.authoritativeState!.currentQuestion!.question
    target.send({ type: 'OPEN_BUZZER' })
    target.send({ type: 'BUZZ', playerId: 'player-1' })
    const wrong = question.options!.find((option) => option.id !== question.correctOptionId)!
    target.send({ type: 'LOG_OPTION_ANSWER', optionId: wrong.id })
    target.send({ type: 'RESOLVE_ATTEMPT' })
    target.settle()

    expect(target.service.authoritativeState!.phase).toBe('second-chance')
    expect(target.service.snapshotFor('stage').visibleSolution).toBeUndefined()
  })

  it('zeigt die Loesung erst in der Loesungsszene', () => {
    const target = rig()
    startGame(target)
    playQuestion(target, 'correct-first')

    const stage = target.service.snapshotFor('stage')
    expect(stage.scene).toBe('solution')
    expect(stage.visibleSolution?.answerText.length).toBeGreaterThan(0)
    expect(stage.visibleOptions?.some((option) => option.state === 'correct')).toBe(true)
  })

  it('gibt einem mitten im Spiel verbundenen Moderator sofort den vollstaendigen Stand', () => {
    const target = rig()
    startGame(target)
    playQuestion(target, 'correct-first')
    target.send({ type: 'CONTINUE' })
    target.settle()

    const moderator = target.service.snapshotFor('moderator')
    expect(moderator.progress).toEqual({ current: 2, total: 7 })
    expect(moderator.revision).toBe(target.service.currentRevision)
    expect(moderator.nextStepHint.length).toBeGreaterThan(0)
    expect(moderator.allowedCommands).not.toContain('ADJUST_SCORE')
    expect(moderator.allowedCommands).not.toContain('ABORT_GAME')
  })
})

describe('Wiederherstellung nach Serverneustart', () => {
  it('erkennt ein unvollstaendiges Spiel und wartet auf die Operatorentscheidung', () => {
    let target = rig()
    startGame(target)
    playQuestion(target, 'correct-first')
    target.send({ type: 'CONTINUE' })
    target.settle()

    target = target.restart()
    rigs.push(target)

    // Das Spiel wird NICHT automatisch fortgesetzt.
    expect(target.service.authoritativeState).toBeNull()
    expect(target.service.resumableState).not.toBeNull()

    const operator = target.service.snapshotFor('operator')
    expect(operator.resumable?.progress).toBe('Frage 2/7')
    expect(operator.allowedCommands).toContain('RESUME_GAME')
    expect(operator.allowedCommands).toContain('DISCARD_RESUMABLE_GAME')

    expect(target.send({ type: 'RESUME_GAME' }).ok).toBe(true)
    expect(target.service.authoritativeState!.currentSlotIndex).toBe(1)
  })

  it('stellt vergebene Punkte vollstaendig wieder her', () => {
    let target = rig()
    startGame(target)
    playQuestion(target, 'correct-first')
    target.send({ type: 'ADJUST_SCORE', playerId: 'player-2', direction: 'increase' })

    target = target.restart()
    rigs.push(target)
    target.send({ type: 'RESUME_GAME' })

    expect(target.service.authoritativeState!.players[0]!.score).toBe(100)
    expect(target.service.authoritativeState!.players[1]!.score).toBe(100)
  })

  it('stellt eine laufende Enthuellung als pausiert wieder her', () => {
    let target = rig({ seed: 7 })
    // Das Preset "regional" hat einen Bilderkennen-Platz an Position 3; hier wird
    // gezielt bis dorthin gespielt.
    target.send({ type: 'START_GAME', quizModeId: 'adults', presetId: 'medium' })
    target.settle()
    playQuestion(target, 'resolve-without-answer')
    target.send({ type: 'CONTINUE' })
    target.settle()
    playQuestion(target, 'resolve-without-answer')
    target.send({ type: 'CONTINUE' })
    target.settle()

    expect(target.service.authoritativeState!.phase).toBe('reveal-running')
    target.clock.nowMs += 4_000
    // Ein "Absturz": kein sauberes Beenden, nur Neustart mit derselben Datenbank.
    const elapsedBefore = 4_000

    target = target.restart()
    rigs.push(target)
    target.send({ type: 'RESUME_GAME' })

    const reveal = target.service.authoritativeState!.reveal!
    expect(reveal.status).toBe('paused')
    // Der Stand wird auf dem zuletzt persistierten Zeitpunkt eingefroren, nicht weitergezaehlt.
    expect(reveal.elapsedBeforeStartMs).toBeLessThanOrEqual(elapsedBefore)
    expect(target.service.authoritativeState!.phase).toBe('reveal-paused')
  })

  it('verwirft ein unterbrochenes Spiel auf ausdrueckliche Anweisung', () => {
    let target = rig()
    startGame(target)
    playQuestion(target, 'correct-first')

    target = target.restart()
    rigs.push(target)
    expect(target.send({ type: 'DISCARD_RESUMABLE_GAME' }).ok).toBe(true)
    expect(target.service.authoritativeState).toBeNull()
    expect(target.service.resumableState).toBeNull()
    expect(target.service.snapshotFor('stage').scene).toBe('start')
  })

  it('behaelt die Nutzungshistorie ueber den Neustart hinweg', () => {
    let target = rig()
    startGame(target)
    const firstQuestionId = target.service.authoritativeState!.currentQuestion!.question.id

    target = target.restart()
    rigs.push(target)
    const usage = target.store.loadUsageHistory(target.service.eventDayId)
    expect(usage.map((entry) => entry.questionId)).toContain(firstQuestionId)
  })
})

describe('Wiederholungsvermeidung ueber mehrere Spiele', () => {
  it('verwendet innerhalb eines Spiels keine Frage und keine Wiederholungsgruppe doppelt', () => {
    const target = rig({ seed: 99 })
    startGame(target)
    for (let index = 0; index < 7; index += 1) {
      playQuestion(target, 'resolve-without-answer')
      if (index < 6) {
        target.send({ type: 'CONTINUE' })
        target.settle()
      }
    }
    const state = target.service.authoritativeState!
    expect(new Set(state.selectedQuestionIds).size).toBe(state.selectedQuestionIds.length)
    expect(new Set(state.selectedRepetitionGroupIds).size).toBe(state.selectedRepetitionGroupIds.length)
  })

  it('bevorzugt im naechsten Spiel noch nicht gespielte Fragen', () => {
    const target = rig({ seed: 5 })
    startGame(target)
    const firstGame = new Set<string>()
    for (let index = 0; index < 7; index += 1) {
      firstGame.add(target.service.authoritativeState!.currentQuestion!.question.id)
      playQuestion(target, 'resolve-without-answer')
      target.send({ type: 'CONTINUE' })
      target.settle()
    }
    expect(target.service.authoritativeState!.phase).toBe('result')

    startGame(target)
    const secondGameFirstQuestion = target.service.authoritativeState!.currentQuestion!.question.id
    // Der Einstiegs-Pool ist gross genug, dass eine frische Frage kommen muss.
    expect(firstGame.has(secondGameFirstQuestion)).toBe(false)
  })
})

describe('Live-Hotfix', () => {
  /**
   * Die Frage-IDs kommen aus dem echten Paket statt aus dem Test. So bleibt der
   * Test gueltig, wenn der Fragenkatalog ausgetauscht wird.
   */
  function someQuestionId(target: ReturnType<typeof rig>, index = 0): string {
    return target.service.content.baseQuestions[index]!.id
  }

  it('legt sich als Overlay ueber das Basispaket, ohne es zu veraendern', () => {
    const target = rig()
    const questionId = someQuestionId(target)
    const original = target.service.content.baseQuestions.find((question) => question.id === questionId)!
    expect(original.prompt).not.toBe('Korrigierter Text')

    const result = target.send({
      type: 'APPLY_QUESTION_PATCH',
      questionId,
      changes: { prompt: 'Korrigierter Text' },
      reason: 'Tippfehler',
      applyMode: 'next-use',
    })

    expect(result.ok).toBe(true)
    expect(target.service.content.findQuestion(questionId)!.prompt).toBe('Korrigierter Text')
    expect(target.service.content.baseQuestions.find((question) => question.id === questionId)!.prompt).toBe(
      original.prompt,
    )

    const report = target.service.changeReport()
    expect(report[0]).toMatchObject({ questionId, field: 'prompt', newValue: 'Korrigierter Text' })
  })

  it('haelt Hotfixes ueber einen Neustart hinweg', () => {
    let target = rig()
    const questionId = someQuestionId(target, 1)
    target.send({
      type: 'APPLY_QUESTION_PATCH',
      questionId,
      changes: { enabled: false },
      reason: 'Frage fehlerhaft',
      applyMode: 'next-use',
    })

    target = target.restart()
    rigs.push(target)
    expect(target.service.content.findQuestion(questionId)!.enabled).toBe(false)
  })
})

describe('Veranstaltungstag', () => {
  it('setzt ein laufendes Spiel bei einem Tageswechsel nicht zurueck', () => {
    const target = rig()
    startGame(target)
    const result = target.send({ type: 'START_NEW_EVENT_DAY' })
    expect(result.ok).toBe(false)
    expect(result.rejection?.message).toContain('laufendes Spiel')
    expect(target.service.authoritativeState!.status).toBe('active')
  })
})
