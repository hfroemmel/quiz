/**
 * Testhilfen fuer Server- und Persistenztests.
 *
 * Es wird bewusst das echte, gebaute Quizpaket und eine echte SQLite-Datei verwendet:
 * Nur so belegen die Tests, dass Wiederherstellung und Transaktionen wirklich tragen.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ContentService, QuizService, createSeededRng } from '@hfroemmel/quiz-core'
import type { ActorRole, Command } from '@hfroemmel/quiz-core'
import { loadQuizPackage } from '@hfroemmel/quiz-content'
import { QuizStore } from '@quiz/persistence'

/** Das gebaute Quizpaket des Repos - Tests duerfen die Repo-Struktur kennen. */
function contentPackageDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'content', 'dist')
}

export interface TestRig {
  service: QuizService
  store: QuizStore
  databaseFile: string
  clock: { nowMs: number }
  send(command: Command, role?: ActorRole): ReturnType<QuizService['dispatch']>
  /** Schliesst offene zeitgesteuerte Uebergaenge ab, ohne die Uhr weiter zu bewegen. */
  settle(): void
  /** Serverneustart: alles schliessen und mit derselben Datenbank neu oeffnen. */
  restart(): TestRig
  dispose(): void
}

let commandCounter = 0

export function createRig(options: { databaseFile?: string; seed?: number; startNow?: number } = {}): TestRig {
  const directory = options.databaseFile ? null : mkdtempSync(join(tmpdir(), 'quiz-test-'))
  const databaseFile = options.databaseFile ?? join(directory!, 'quiz.sqlite')
  const clock = { nowMs: options.startNow ?? Date.UTC(2026, 7, 18, 19, 0, 0) }

  const store = new QuizStore(databaseFile)
  const content = new ContentService(loadQuizPackage(contentPackageDir()), store.loadPatches())
  const service = new QuizService({
    store,
    content,
    now: () => clock.nowMs,
    random: createSeededRng(options.seed ?? 12345),
    sessionCode: '123456',
  })

  const rig: TestRig = {
    service,
    store,
    databaseFile,
    clock,

    send(command, role: ActorRole = 'operator') {
      commandCounter += 1
      return service.dispatch({
        commandId: `test-${commandCounter}`,
        command,
        actor: { clientId: `${role}-test`, role },
        expectedRevision: service.currentRevision,
      })
    },

    settle() {
      let guard = 0
      for (;;) {
        const pending = service.authoritativeState?.pendingTransition
        if (!pending) return
        clock.nowMs = Math.max(clock.nowMs, pending.endsAtMs)
        const result = rig.send({ type: 'ADVANCE_TIMED_PHASE', transitionId: pending.transitionId }, 'system')
        if (!result.ok) throw new Error(`Uebergang abgelehnt: ${result.rejection?.message}`)
        if ((guard += 1) > 100) throw new Error('Endlosschleife bei Uebergaengen')
      }
    },

    restart() {
      service.stopTimers()
      store.close()
      return createRig({ databaseFile, seed: options.seed, startNow: clock.nowMs })
    },

    dispose() {
      service.stopTimers()
      store.close()
      if (directory) rmSync(directory, { recursive: true, force: true })
    },
  }

  return rig
}

/**
 * Blendet die Frage einer Videofrage ein, sofern gerade eine laeuft.
 *
 * Eine Videofrage beginnt mit dem Video; erst danach gibt es eine Frage, auf die
 * sich buzzern laesst. Fuer Tests, die den ANTWORTABLAUF pruefen, ist das eine
 * Vorstufe - der Videoablauf selbst hat eigene Faelle.
 */
export function showQuestionAfterVideo(rig: TestRig): void {
  const phase = rig.service.authoritativeState?.phase
  if (phase !== 'video-ready' && phase !== 'video-playing') return
  rig.send({ type: 'SHOW_QUESTION_AFTER_VIDEO' })
  rig.settle()
}

/** Spielt eine normale Frage bis zur Loesung durch. */
export function playQuestion(
  rig: TestRig,
  outcome: 'correct-first' | 'incorrect-then-correct' | 'resolve-without-answer',
): void {
  showQuestionAfterVideo(rig)
  const state = rig.service.authoritativeState!
  const question = state.currentQuestion!.question

  // Massgeblich ist die Auswertungsart, nicht der Praesentationstyp: Eine
  // bildgestuetzte Auswahlfrage wird genauso eingeloggt wie eine reine Textfrage.
  if (outcome === 'resolve-without-answer' || question.evaluationMode !== 'option-comparison') {
    rig.send({ type: 'RESOLVE_WITHOUT_ANSWER' })
    rig.settle()
    return
  }

  // Jede Frage wartet zuerst auf die Freigabe des Operators.
  rig.send({ type: 'OPEN_BUZZER' })
  rig.send({ type: 'BUZZ', playerId: 'player-1' })

  if (outcome === 'correct-first') {
    rig.send({ type: 'LOG_OPTION_ANSWER', optionId: question.correctOptionId! })
    rig.send({ type: 'RESOLVE_ATTEMPT' })
    rig.settle()
    return
  }

  const wrong = question.options!.find((option) => option.id !== question.correctOptionId)!
  rig.send({ type: 'LOG_OPTION_ANSWER', optionId: wrong.id })
  rig.send({ type: 'RESOLVE_ATTEMPT' })
  rig.settle()
  rig.send({ type: 'LOG_OPTION_ANSWER', optionId: question.correctOptionId! })
  rig.send({ type: 'RESOLVE_ATTEMPT' })
  rig.settle()
}
