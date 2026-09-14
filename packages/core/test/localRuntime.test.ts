/**
 * Proof of the storage interface: the same `QuizService` that runs against
 * SQLite on the stage plays a complete self-service game here against the
 * `MemoryQuizStore` - through the shared `QuizRuntime` surface as kiosk and
 * embedding use it.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSeededRng, gameTiming, type Command } from '../src'
import {
  questionSchema,
  quizConfigSchema,
  quizPackageManifestSchema,
  type PlayerQuizViewModel,
  type QuizPackage,
  type QuizSnapshot,
} from '../src'
import { LocalQuizRuntime } from '../src/runtime/localRuntime'
import type { MemoryQuizStoreSnapshot } from '../src/runtime/memoryStore'

/*
 * The core reads no files - here that is intention and subject of the test at
 * once. The real built package is therefore loaded BY THE TEST (not through
 * the loading path of `@hfroemmel/quiz-content` - that would be a circular
 * dependency of the packages) and handed to the runtime ready-made.
 */
function loadTestPackage(): QuizPackage {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'content', 'dist')
  const read = (name: string) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as unknown
  const manifest = quizPackageManifestSchema.parse(read('manifest.json'))
  return {
    manifest,
    config: quizConfigSchema.parse(read('config.json')),
    questions: questionSchema.array().parse(read('questions.json')),
    assetsById: new Map(manifest.assets.map((asset) => [asset.id, asset])),
    rootDir: dir,
  }
}

function createRuntime(options: {
  restoreFrom?: MemoryQuizStoreSnapshot
  persist?: (snapshot: MemoryQuizStoreSnapshot) => void
  clock?: { nowMs: number }
} = {}) {
  const clock = options.clock ?? { nowMs: Date.UTC(2026, 7, 18, 19, 0, 0) }
  const runtime = new LocalQuizRuntime({
    quizPackage: loadTestPackage(),
    now: () => clock.nowMs,
    random: createSeededRng(12345),
    persistDelayMs: 1,
    ...(options.restoreFrom === undefined ? {} : { restoreFrom: options.restoreFrom }),
    ...(options.persist === undefined ? {} : { persist: options.persist }),
  })

  /*
   * In operation timed transitions run through the service's real timers.
   * Tests set the fake clock instead and complete due transitions themselves
   * - as the server test environment does.
   */
  const settle = () => {
    let guard = 0
    for (;;) {
      const pending = runtime.service.authoritativeState?.pendingTransition
      if (!pending) return
      clock.nowMs = Math.max(clock.nowMs, pending.endsAtMs)
      const result = runtime.service.dispatch({
        commandId: `settle-${guard}-${pending.transitionId}`,
        command: { type: 'ADVANCE_TIMED_PHASE', transitionId: pending.transitionId },
        actor: { clientId: 'test-system', role: 'system' },
        expectedRevision: runtime.service.currentRevision,
      })
      if (!result.ok) throw new Error(`Uebergang abgelehnt: ${result.rejection?.message}`)
      if ((guard += 1) > 100) throw new Error('Endlosschleife bei Uebergaengen')
    }
  }

  return { runtime, clock, settle }
}

describe('LocalQuizRuntime', () => {
  it('spielt eine Frage komplett ueber die Runtime-Schnittstelle - ohne SQLite', () => {
    const { runtime, settle } = createRuntime()
    const seen: QuizSnapshot<PlayerQuizViewModel>[] = []
    const unsubscribe = runtime.subscribe((snapshot) => seen.push(snapshot))

    // Locally there is no connection question and no competition for the sound.
    expect(runtime.getSnapshot().connection).toEqual({ connected: true, audioMaster: true })

    runtime.dispatch({ type: 'START_GAME', audience: 'adults', presetId: 'medium', flowProfile: 'self-service' })
    settle()
    /*
     * At the device the video starts by itself and shows the question after
     * its end - here there is no element that could end, so the test takes the
     * step the scene takes there.
     */
    if (runtime.service.authoritativeState?.phase === 'video') {
      runtime.dispatch({ type: 'SHOW_QUESTION_AFTER_VIDEO' })
      settle()
    }

    const view = runtime.getSnapshot().view!
    expect(view.phase).toBe('buzzer-open')
    expect(view.allowedCommands).toContain('BUZZ')

    const question = runtime.service.authoritativeState!.currentQuestion!.question
    runtime.dispatch({ type: 'BUZZ', playerId: 'player-1' })
    runtime.dispatch({ type: 'LOG_OPTION_ANSWER', optionId: question.correctOptionId! })
    runtime.dispatch({ type: 'RESOLVE_ATTEMPT' })

    expect(runtime.getSnapshot().view!.playerScores[0]!.score).toBe(100)
    // Every change has reached the subscribers.
    expect(seen.length).toBeGreaterThan(3)
    expect(seen.at(-1)!.revision).toBe(runtime.service.currentRevision)

    unsubscribe()
    runtime.dispose()
  })

  it('meldet Ablehnungen im Snapshot und laesst sie loeschen', () => {
    const { runtime } = createRuntime()

    runtime.dispatch({ type: 'RESOLVE_ATTEMPT' })
    const rejection = runtime.getSnapshot().lastRejection
    expect(rejection?.reason).toBe('no-active-game')

    runtime.clearRejection()
    expect(runtime.getSnapshot().lastRejection).toBeNull()
    runtime.dispose()
  })

  it('laesst den Ton auch dann umschalten, wenn kein Spiel laeuft', () => {
    /*
     * At the kiosk device the sound switch sits on the start screen - nothing
     * runs there the engine could record the command in. It belongs to the
     * device, not to the game, and therefore has to work without a game too.
     */
    const saved: MemoryQuizStoreSnapshot[] = []
    const { runtime } = createRuntime({ persist: (snapshot) => saved.push(snapshot) })

    expect(runtime.getSnapshot().view!.soundEnabled).toBe(true)
    runtime.dispatch({ type: 'SET_SOUND_ENABLED', enabled: false })
    expect(runtime.getSnapshot().lastRejection).toBeNull()
    expect(runtime.getSnapshot().view!.soundEnabled).toBe(false)

    // And it survives the restart of the device.
    runtime.dispose()
    const restored = createRuntime({ restoreFrom: saved.at(-1)! }).runtime
    expect(restored.getSnapshot().view!.soundEnabled).toBe(false)
    restored.dispose()
  })

  it('veroeffentlicht den Abspielauftrag ueber den Dienst - und plant nichts darueber hinaus', () => {
    /*
     * THE ENGINE ALONE IS NOT PROOF ENOUGH. Between it and the hall stands the
     * service: it accepts the command, checks role and revision and writes the
     * request into the state from which all clients get their snapshot.
     *
     * And it sets NO timer: the end of the video is no server-side transition
     * any more. If one remained here, the question in the hall would change
     * while the video is still running.
     */
    const { runtime, clock } = createRuntime()
    const service = runtime.service
    let counter = 0
    const asOperator = (command: Command) =>
      service.dispatch({
        commandId: `video-${counter++}`,
        command,
        actor: { clientId: 'test-operator', role: 'operator' },
        expectedRevision: service.currentRevision,
      })

    expect(asOperator({ type: 'START_GAME', audience: 'adults', presetId: 'easy', flowProfile: 'operated' }).ok).toBe(
      true,
    )

    // The pause screen runs out; then the video question stands.
    const due = service.authoritativeState!.pendingTransition!
    clock.nowMs = due.endsAtMs
    service.dispatch({
      commandId: 'video-pausenscreen',
      command: { type: 'ADVANCE_TIMED_PHASE', transitionId: due.transitionId },
      actor: { clientId: 'test-system', role: 'system' },
      expectedRevision: service.currentRevision,
    })
    expect(service.authoritativeState!.phase).toBe('video')
    expect(service.authoritativeState!.video).toBeUndefined()

    const questionId = service.authoritativeState!.currentQuestion!.question.id
    expect(asOperator({ type: 'START_VIDEO', questionId: questionId }).ok).toBe(true)

    const task = service.authoritativeState!.video!
    expect(task.questionId).toBe(questionId)
    expect(service.authoritativeState!.pendingTransition).toBeUndefined()

    // The snapshot carries it to the stage - and nothing else about the video.
    expect(service.snapshotFor('stage').video).toEqual({
      questionId: questionId,
      requestId: task.requestId,
    })

    // A second click is a new request, no special case.
    expect(asOperator({ type: 'START_VIDEO', questionId: questionId }).ok).toBe(true)
    expect(service.authoritativeState!.video!.requestId).not.toBe(task.requestId)

    // And the phase stands still the whole time: the server waits for nobody.
    clock.nowMs += 10 * 60_000
    expect(service.authoritativeState!.phase).toBe('video')
    runtime.dispose()
  })

  it('stellt Fragen, Antworten und Beschriftungen auf die gewaehlte Sprache um', () => {
    /*
     * THE WHOLE WAY IN ONE TEST: command -> service -> state -> projection.
     * The language is resolved in four places (question, options, catalog,
     * interface); if one of them fails, the hall would see a German question
     * with English answers.
     */
    const { runtime, settle } = createRuntime()

    expect(runtime.getSnapshot().view!.locale).toBe('de-DE')
    expect(runtime.getSnapshot().view!.catalog.locales.map((locale) => locale.id)).toEqual(['de-DE', 'en-GB'])

    runtime.dispatch({ type: 'SET_LOCALE', locale: 'en-GB' })
    const beforeGame = runtime.getSnapshot().view!
    expect(beforeGame.locale).toBe('en-GB')
    // The labels of the catalog and the interface switch along, too.
    expect(beforeGame.catalog.presets.map((preset) => preset.label)).toContain('Easy')
    expect(beforeGame.texts?.['kiosk.start']).toBe("Let's go")

    runtime.dispatch({ type: 'START_GAME', audience: 'adults', presetId: 'medium', flowProfile: 'self-service' })
    settle()

    const inGame = runtime.getSnapshot().view!
    expect(inGame.locale).toBe('en-GB')
    expect(inGame.question!.prompt).toMatch(/^Test question /)
    for (const option of inGame.visibleOptions ?? []) {
      expect(option.text).toMatch(/^(Correct|Wrong) answer /)
    }
    runtime.dispose()
  })

  it('faellt auf die Grundsprache zurueck, wenn der Inhalt die Sprache nicht kennt', () => {
    // The wish comes from a config file; a typo must not empty anything.
    const { runtime } = createRuntime()
    runtime.dispatch({ type: 'SET_LOCALE', locale: 'kl-KL' })
    expect(runtime.getSnapshot().view!.locale).toBe('de-DE')
    runtime.dispose()
  })

  it('gibt den Stand beim Aufraeumen an den persist-Adapter und stellt ihn wieder her', () => {
    const saved: MemoryQuizStoreSnapshot[] = []
    const { runtime } = createRuntime({ persist: (snapshot) => saved.push(snapshot) })

    runtime.dispatch({ type: 'START_GAME', audience: 'adults', presetId: 'medium', flowProfile: 'self-service' })
    runtime.dispatch({ type: 'SET_SOUND_ENABLED', enabled: false })
    runtime.dispatch({ type: 'ABORT_GAME' })
    // `dispose` writes a state still pending before it would be lost.
    runtime.dispose()
    expect(saved.length).toBeGreaterThan(0)

    const restored = createRuntime({ restoreFrom: saved.at(-1)! }).runtime
    expect(restored.getSnapshot().view!.soundEnabled).toBe(false)
    expect(restored.store.gameCountsByAudience(null)).toEqual([
      expect.objectContaining({ audience: 'adults', total: 1, aborted: 1 }),
    ])
    restored.dispose()
  })
})
