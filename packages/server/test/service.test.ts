/**
 * Integrations- und Persistenztests (Spezifikation 31.3).
 *
 * Geprueft wird die Kette Befehl -> Transaktion -> Verteilung, die Wiederherstellung
 * nach Serverneustart in kritischen Phasen und die Rollentrennung der View-Modelle.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { scoringRules } from '@hfroemmel/quiz-core'
import { createRig, playQuestion, showQuestionAfterVideo, type TestRig } from './helpers'

const rigs: TestRig[] = []
function rig(options?: Parameters<typeof createRig>[0]): TestRig {
  const created = createRig(options)
  rigs.push(created)
  return created
}

afterEach(() => {
  while (rigs.length) rigs.pop()!.dispose()
})

/*
 * Startet ein Spiel und bringt die erste Frage in einen Zustand, in dem sich
 * bedienen laesst. Der erste Fragenplatz ist eine Videofrage; das Video ist fuer
 * diese Tests Vorspann, nicht Gegenstand.
 */
function startGame(target: TestRig, presetId = 'medium'): void {
  const result = target.send({ type: 'START_GAME', audience: 'adults', presetId })
  expect(result.ok).toBe(true)
  target.settle()
  showQuestionAfterVideo(target)
}

describe('Spielprotokoll', () => {
  it('zaehlt gespielte Spiele je Zielgruppe und ueberlebt einen Neustart', () => {
    let target = rig()
    expect(target.service.snapshotFor('operator').statistics.audiences.every((entry) => entry.total === 0)).toBe(true)

    startGame(target)
    target.send({ type: 'ABORT_GAME' })
    startGame(target)

    const before = target.service.snapshotFor('operator').statistics
    const adults = before.audiences.find((entry) => entry.audience === 'adults')!
    expect(adults.label).toBe('Erwachsene')
    expect(adults.total).toBe(2)
    expect(adults.aborted).toBe(1)
    // Jede konfigurierte Zielgruppe erscheint, auch ohne Spiel.
    expect(before.audiences.length).toBeGreaterThan(1)
    expect(before.audiences.some((entry) => entry.audience === 'kids' && entry.total === 0)).toBe(true)

    // Die Zahlen liegen in der Datenbank, nicht im Browser.
    target = target.restart()
    rigs.push(target)
    expect(target.service.snapshotFor('operator').statistics.audiences.find((entry) => entry.audience === 'adults')!.total).toBe(2)
  })

  it('setzt die Zaehlung zurueck, ohne Spiele zu loeschen', () => {
    const target = rig()
    startGame(target)
    target.send({ type: 'ABORT_GAME' })
    expect(target.store.countRows('games')).toBe(1)

    target.clock.nowMs += 60_000
    expect(target.send({ type: 'RESET_GAME_STATISTICS' }).ok).toBe(true)

    const after = target.service.snapshotFor('operator').statistics
    expect(after.audiences.every((entry) => entry.total === 0)).toBe(true)
    expect(after.countingSinceIso).toBeDefined()
    // Das Spiel selbst bleibt: An ihm haengen Spielstand, Versuche und Auditlog.
    expect(target.store.countRows('games')).toBe(1)

    // Ab jetzt wird wieder gezaehlt.
    startGame(target)
    expect(target.service.snapshotFor('operator').statistics.audiences.find((entry) => entry.audience === 'adults')!.total).toBe(1)
  })
})

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
    expect(result.rejection?.message).toContain('geändert')
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

describe('Videofrage', () => {
  /*
   * Die gemeldete Laufzeit ist nicht nur Zierde: Sie ist die einzige Obergrenze,
   * die der Positionsregler des Operators hat. Fehlte sie in der Projektion,
   * reichte der Regler nur bis zur bereits erreichten Stelle - vorwaerts springen
   * waere unmoeglich, und zwar ohne dass irgendetwas nach einem Fehler aussieht.
   */
  it('reicht die vom Buehnenclient gemeldete Laufzeit an den Operator weiter', () => {
    const target = rig()
    expect(target.send({ type: 'START_GAME', audience: 'adults', presetId: 'medium' }).ok).toBe(true)
    target.settle()
    expect(target.service.authoritativeState?.phase).toBe('video-ready')
    expect(target.service.snapshotFor('operator').video?.durationMs).toBeUndefined()

    target.send({ type: 'REPORT_VIDEO_STATUS', durationMs: 42_000 }, 'system')

    expect(target.service.snapshotFor('operator').video?.durationMs).toBe(42_000)
    // Auch die Buehne bekommt sie - dieselbe Projektion fuer alle Rollen.
    expect(target.service.snapshotFor('stage').video?.durationMs).toBe(42_000)
  })

  /*
   * Eine Fehlermeldung des Clients bleibt eine Fehlermeldung: Sie setzt das Video
   * zurueck, damit der Operator eine verstaendliche Lage und die Aktion
   * "Frage ueberspringen" vorfindet.
   */
  it('haelt einen gemeldeten Medienfehler fest', () => {
    const target = rig()
    expect(target.send({ type: 'START_GAME', audience: 'adults', presetId: 'medium' }).ok).toBe(true)
    target.settle()

    target.send({ type: 'REPORT_VIDEO_STATUS', error: 'Datei konnte nicht geladen werden' }, 'system')

    expect(target.service.snapshotFor('operator').video?.hasError).toBe(true)
  })

  /*
   * Und sie nimmt sie zurueck, sobald es doch laeuft. Der Client meldet das,
   * wenn die Wiedergabe wirklich beginnt; ohne diese Rueckname stuende die
   * Meldung "Video nicht verfuegbar" unter einem laufenden Video.
   */
  it('nimmt den Medienfehler zurueck, wenn das Video doch laeuft', () => {
    const target = rig()
    expect(target.send({ type: 'START_GAME', audience: 'adults', presetId: 'medium' }).ok).toBe(true)
    target.settle()

    target.send({ type: 'REPORT_VIDEO_STATUS', error: 'Datei konnte nicht geladen werden' }, 'system')
    expect(target.service.snapshotFor('operator').video?.hasError).toBe(true)

    target.send({ type: 'REPORT_VIDEO_STATUS' }, 'system')
    expect(target.service.snapshotFor('operator').video?.hasError).toBe(false)
  })
})

describe('Selbstbedienung am Geraet', () => {
  /**
   * Startet ein Selbstbedienungsspiel so, wie es der Touchclient tut.
   *
   * Der erste Fragenplatz des Presets ist eine Videofrage. Ohne Operator startet
   * das Video von selbst; das Ende meldet der Client, und daraus plant der Server
   * den Wechsel zur Frage. Genau diese Meldung wird hier nachgestellt.
   */
  function startSelfService(target: TestRig): void {
    const result = target.send(
      { type: 'START_GAME', audience: 'adults', presetId: 'medium', flowProfile: 'self-service' },
      'player',
    )
    expect(result.ok).toBe(true)
    target.settle()

    if (target.service.authoritativeState?.phase === 'video-playing') {
      target.send({ type: 'REPORT_VIDEO_STATUS', durationMs: 1_000 }, 'player')
      target.settle()
    }
  }

  it('laesst einen Spieler kein vom Operator gesteuertes Spiel starten', () => {
    const target = rig()
    const result = target.send({ type: 'START_GAME', audience: 'adults', presetId: 'medium' }, 'player')

    expect(result.ok).toBe(false)
    expect(result.rejection?.reason).toBe('wrong-flow-profile')
  })

  it('laesst einen Spieler nichts korrigieren und nicht zu frueh weitergehen', () => {
    const target = rig()
    startSelfService(target)

    // Punktekorrektur bleibt Operatorsache - auch in der Selbstbedienung.
    const adjust = target.send({ type: 'ADJUST_SCORE', playerId: 'player-1', direction: 'increase' }, 'player')
    expect(adjust.ok).toBe(false)
    expect(adjust.rejection?.reason).toBe('forbidden-role')

    /*
     * `Weiter` DARF ein Spieler senden - am Geraet haelt die Loesung an, bis er
     * es tut. Nur eben nicht mittendrin: Die Phase weist es ab, nicht die Rolle.
     */
    const zuFrueh = target.send({ type: 'CONTINUE' }, 'player')
    expect(zuFrueh.ok).toBe(false)
    expect(zuFrueh.rejection?.reason).toBe('invalid-phase')
  })

  it('weist Spielerbefehle in einem vom Operator gefuehrten Spiel ab', () => {
    const target = rig()
    startGame(target)

    /*
     * Die Rollentabelle erlaubt diese Befehle inzwischen auch Spielern - aber
     * nur fuer die Selbstbedienung. In einem gefuehrten Spiel wuerde ein
     * Spielerbefehl dem Operator in die Auswertung greifen; diese Politik
     * prueft der Service, weil die Engine den Absender nicht kennt.
     */
    for (const command of [
      { type: 'BUZZ', playerId: 'player-1' },
      { type: 'LOG_OPTION_ANSWER', optionId: 'option_1' },
      { type: 'RESOLVE_ATTEMPT' },
      { type: 'CONTINUE' },
    ] as const) {
      const result = target.send(command, 'player')
      expect(result.ok, command.type).toBe(false)
      expect(result.rejection?.reason, command.type).toBe('wrong-flow-profile')
    }
  })

  it('gibt der Spieleransicht die moeglichen Befehle, aber nie die Loesung', () => {
    const target = rig()
    startSelfService(target)

    const player = target.service.snapshotFor('player')
    expect(player.allowedCommands).toContain('BUZZ')
    // Einloggen und Abgeben kommen erst mit dem Zuschlag.
    expect(player.allowedCommands).not.toContain('RESOLVE_ATTEMPT')
    // Dieselbe Sicherheitsregel wie beim Buehnenscreen.
    expect(player.visibleSolution).toBeUndefined()
    expect(JSON.stringify(player)).not.toContain('privateSolution')
    expect(player.visibleOptions?.every((option) => option.state === undefined)).toBe(true)
  })

  it('spielt eine Frage ohne einen einzigen Operatorbefehl bis zur Auswertung durch', () => {
    const target = rig()
    startSelfService(target)

    const question = target.service.authoritativeState!.currentQuestion!.question
    expect(target.send({ type: 'BUZZ', playerId: 'player-1' }, 'player').ok).toBe(true)
    expect(target.send({ type: 'LOG_OPTION_ANSWER', optionId: question.correctOptionId! }, 'player').ok).toBe(true)

    // Die markierte Antwort ist fuer alle sichtbar, aber noch nicht gewertet.
    const marked = target.service.snapshotFor('player')
    expect(marked.visibleOptions?.some((option) => option.state === 'chosen')).toBe(true)
    expect(target.service.authoritativeState!.players[0]!.score).toBe(0)

    expect(target.send({ type: 'RESOLVE_ATTEMPT' }, 'player').ok).toBe(true)
    expect(target.service.authoritativeState!.players[0]!.score).toBe(100)

    // Punkte, Versuch und Protokoll liegen in derselben Transaktion wie sonst auch.
    expect(target.store.countRows('score_transactions')).toBe(1)
    expect(target.store.countRows('attempts')).toBe(1)
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

    expect(target.service.authoritativeState!.players[0]!.score).toBe(scoringRules.firstAnswerPoints)
    expect(target.service.authoritativeState!.players[1]!.score).toBe(scoringRules.manualAdjustmentStep)
  })

  it('stellt eine laufende Enthuellung als pausiert wieder her', () => {
    let target = rig({ seed: 7 })
    // Das Preset "regional" hat einen Bilderkennen-Platz an Position 3; hier wird
    // gezielt bis dorthin gespielt.
    target.send({ type: 'START_GAME', audience: 'adults', presetId: 'medium' })
    target.settle()
    playQuestion(target, 'resolve-without-answer')
    target.send({ type: 'CONTINUE' })
    target.settle()
    playQuestion(target, 'resolve-without-answer')
    target.send({ type: 'CONTINUE' })
    target.settle()

    // Die Frage steht zunaechst still - erst die Freigabe startet die Enthuellung.
    expect(target.service.authoritativeState!.phase).toBe('reveal-ready')
    target.send({ type: 'START_IMAGE_REVEAL' })
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
    const spielen = (): string[] => {
      const gespielt: string[] = []
      startGame(target)
      for (let index = 0; index < 7; index += 1) {
        gespielt.push(target.service.authoritativeState!.currentQuestion!.question.id)
        playQuestion(target, 'resolve-without-answer')
        target.send({ type: 'CONTINUE' })
        target.settle()
      }
      expect(target.service.authoritativeState!.phase).toBe('result')
      return gespielt
    }

    const ersteRunde = spielen()
    const zweiteRunde = spielen()

    /*
     * Platz 1 und 2 sind die Testplaetze fuer Video- und Portraetfrage. Hinter
     * beiden steht genau eine Frage, sie MUESSEN sich also wiederholen. Ab Platz
     * 3 ist der Pool gross genug, dass die Auswahl frische Fragen vorzieht -
     * und genau das wird hier gemessen.
     */
    expect(zweiteRunde.slice(0, 2)).toEqual(ersteRunde.slice(0, 2))
    expect(zweiteRunde.slice(2).filter((id) => ersteRunde.includes(id))).toEqual([])
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
