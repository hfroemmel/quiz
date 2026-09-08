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
import { createSeededRng, gameTiming } from '../src'
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

  it('plant das Ende der Videophase im gefuehrten Spiel ueber den Dienst', () => {
    /*
     * DIE ENGINE ALLEIN GENUEGT ALS NACHWEIS NICHT. Zwischen ihr und dem Saal
     * steht der Dienst: Er nimmt den Befehl an, prueft Rolle und Revision und
     * stellt den Timer, der den Uebergang spaeter ausloest. Faellt eine dieser
     * Stufen aus, bleibt im Saal ein schwarzes Bild stehen - und die
     * Engine-Tests waeren trotzdem gruen.
     *
     * Nachgestellt wird die Reihenfolge des Betriebs: Der Browser meldet die
     * Laufzeit, SOBALD er die Datei gelesen hat - also regelmaessig BEVOR der
     * Operator auf Start drueckt.
     */
    const { runtime, clock } = createRuntime()
    const service = runtime.service
    let zaehler = 0
    const alsOperator = (command: Parameters<typeof service.dispatch>[0]['command']) =>
      service.dispatch({
        commandId: `video-${zaehler++}`,
        command,
        actor: { clientId: 'test-operator', role: 'operator' },
        expectedRevision: service.currentRevision,
      })

    expect(alsOperator({ type: 'START_GAME', audience: 'adults', presetId: 'easy', flowProfile: 'operated' }).ok).toBe(
      true,
    )

    // Der Pausenscreen laeuft ab; danach steht die Videofrage.
    const faellig = service.authoritativeState!.pendingTransition!
    clock.nowMs = faellig.endsAtMs
    service.dispatch({
      commandId: 'video-pause',
      command: { type: 'ADVANCE_TIMED_PHASE', transitionId: faellig.transitionId },
      actor: { clientId: 'test-system', role: 'system' },
      expectedRevision: service.currentRevision,
    })
    expect(service.authoritativeState!.phase).toBe('video-ready')

    expect(alsOperator({ type: 'REPORT_VIDEO_STATUS', durationMs: 5_000 }).ok).toBe(true)
    // Solange nichts laeuft, gibt es auch nichts zu planen.
    expect(service.authoritativeState!.pendingTransition).toBeUndefined()

    expect(alsOperator({ type: 'START_VIDEO' }).ok).toBe(true)
    const geplant = service.authoritativeState!.pendingTransition
    expect(geplant?.nextPhase).toBe('question-presented')
    expect(geplant!.endsAtMs - clock.nowMs).toBe(5_000 + gameTiming.videoTailMs)

    // Und der Uebergang selbst beendet das Video, statt es weiterlaufen zu lassen.
    clock.nowMs = geplant!.endsAtMs
    service.dispatch({
      commandId: 'video-ende',
      command: { type: 'ADVANCE_TIMED_PHASE', transitionId: geplant!.transitionId },
      actor: { clientId: 'test-system', role: 'system' },
      expectedRevision: service.currentRevision,
    })
    expect(service.authoritativeState!.phase).toBe('question-presented')
    expect(service.authoritativeState!.video!.status).toBe('ended')
    runtime.dispose()
  })

  it('stellt Fragen, Antworten und Beschriftungen auf die gewaehlte Sprache um', () => {
    /*
     * DER GANZE WEG IN EINEM TEST: Befehl -> Dienst -> Zustand -> Projektion.
     * Die Sprache wird an vier Stellen aufgeloest (Frage, Optionen, Katalog,
     * Oberflaeche); faellt eine davon aus, stuende im Saal eine Frage auf
     * Deutsch mit englischen Antworten.
     */
    const { runtime, settle } = createRuntime()

    expect(runtime.getSnapshot().view!.locale).toBe('de-DE')
    expect(runtime.getSnapshot().view!.catalog.locales.map((sprache) => sprache.id)).toEqual(['de-DE', 'en-GB'])

    runtime.dispatch({ type: 'SET_LOCALE', locale: 'en-GB' })
    const vorDemSpiel = runtime.getSnapshot().view!
    expect(vorDemSpiel.locale).toBe('en-GB')
    // Auch die Beschriftungen des Katalogs und der Oberflaeche wechseln mit.
    expect(vorDemSpiel.catalog.presets.map((preset) => preset.label)).toContain('Easy')
    expect(vorDemSpiel.texts?.['kiosk.start']).toBe("Let's go")

    runtime.dispatch({ type: 'START_GAME', audience: 'adults', presetId: 'medium', flowProfile: 'self-service' })
    settle()

    const imSpiel = runtime.getSnapshot().view!
    expect(imSpiel.locale).toBe('en-GB')
    expect(imSpiel.question!.prompt).toMatch(/^Test question /)
    for (const option of imSpiel.visibleOptions ?? []) {
      expect(option.text).toMatch(/^(Correct|Wrong) answer /)
    }
    runtime.dispose()
  })

  it('faellt auf die Grundsprache zurueck, wenn der Inhalt die Sprache nicht kennt', () => {
    // Der Wunsch kommt aus einem Config File; ein Tippfehler darf nichts leeren.
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
