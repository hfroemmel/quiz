/**
 * Beweis der Speicher-Schnittstelle: Derselbe `QuizService`, der auf der Buehne
 * gegen SQLite laeuft, spielt hier ein komplettes Selbstbedienungsspiel gegen
 * den `MemoryQuizStore` - ueber die gemeinsame `QuizRuntime`-Oberflaeche, wie
 * sie Kiosk und Einbettung benutzen.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSeededRng } from '../src'
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
 * Der Kern liest keine Dateien - das ist hier Absicht und Testgegenstand
 * zugleich. Das echte gebaute Paket wird deshalb VOM TEST geladen (nicht ueber
 * den Ladeweg aus `@hfroemmel/quiz-content` - das waere eine Zirkelabhaengigkeit
 * der Pakete) und der Runtime fertig uebergeben.
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
   * Zeitgesteuerte Uebergaenge laufen im Betrieb ueber echte Timer des Dienstes.
   * Tests stellen stattdessen die Fake-Uhr und schliessen faellige Uebergaenge
   * selbst ab - wie die Server-Testumgebung auch.
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

    // Lokal gibt es keine Verbindungsfrage und keine Konkurrenz um den Ton.
    expect(runtime.getSnapshot().connection).toEqual({ connected: true, audioMaster: true })

    runtime.dispatch({ type: 'START_GAME', audience: 'adults', presetId: 'medium', flowProfile: 'self-service' })
    settle()
    if (runtime.service.authoritativeState?.phase === 'video-playing') {
      runtime.dispatch({ type: 'REPORT_VIDEO_STATUS', durationMs: 1_000 })
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
    // Jede Aenderung hat die Abonnenten erreicht.
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
     * Am Kioskgeraet sitzt der Tonschalter im Startbildschirm - dort laeuft
     * nichts, worin die Engine den Befehl ablegen koennte. Er gehoert dem
     * Geraet, nicht dem Spiel, und muss deshalb auch ohne Spiel greifen.
     */
    const saved: MemoryQuizStoreSnapshot[] = []
    const { runtime } = createRuntime({ persist: (snapshot) => saved.push(snapshot) })

    expect(runtime.getSnapshot().view!.soundEnabled).toBe(true)
    runtime.dispatch({ type: 'SET_SOUND_ENABLED', enabled: false })
    expect(runtime.getSnapshot().lastRejection).toBeNull()
    expect(runtime.getSnapshot().view!.soundEnabled).toBe(false)

    // Und er ueberlebt den Neustart des Geraets.
    runtime.dispose()
    const restored = createRuntime({ restoreFrom: saved.at(-1)! }).runtime
    expect(restored.getSnapshot().view!.soundEnabled).toBe(false)
    restored.dispose()
  })

  it('gibt den Stand beim Aufraeumen an den persist-Adapter und stellt ihn wieder her', () => {
    const saved: MemoryQuizStoreSnapshot[] = []
    const { runtime } = createRuntime({ persist: (snapshot) => saved.push(snapshot) })

    runtime.dispatch({ type: 'START_GAME', audience: 'adults', presetId: 'medium', flowProfile: 'self-service' })
    runtime.dispatch({ type: 'SET_SOUND_ENABLED', enabled: false })
    runtime.dispatch({ type: 'ABORT_GAME' })
    // `dispose` schreibt einen noch ausstehenden Stand, bevor er verloren ginge.
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
