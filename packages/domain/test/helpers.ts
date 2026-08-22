/**
 * Testhilfen fuer die Domain.
 *
 * Alle Regeltests laufen mit Fake-Clock und einer festen Fragenreihenfolge, damit
 * das Verhalten der Zustandsmaschine unabhaengig vom Auswahlalgorithmus geprueft
 * werden kann. Die Auswahl selbst hat eigene Tests (`selection.test.ts`).
 */
import {
  gameTiming,
  type Command,
  type FlowProfile,
  type GameState,
  type PlayerCount,
  type Question,
  type RuntimeQuestion,
} from '@quiz/contracts'
import { reduce, type EngineContext, type QuestionSource, type SlotRequest } from '../src/engine.ts'

export function makeQuestion(overrides: Partial<Question> & { id: string }): Question {
  return {
    modeIds: ['adults'],
    difficultyId: 'medium',
    categoryIds: ['general'],
    tags: [],
    prompt: `Frage ${overrides.id}`,
    presentationType: 'text-choice',
    evaluationMode: 'option-comparison',
    options: [
      { id: 'a', text: 'Antwort A' },
      { id: 'b', text: 'Antwort B' },
      { id: 'c', text: 'Antwort C' },
      { id: 'd', text: 'Antwort D' },
    ],
    correctOptionId: 'a',
    enabled: true,
    ...overrides,
  }
}

/** Liefert die Fragen in fest vorgegebener Reihenfolge - ein Fragenplatz je Eintrag. */
function scriptedSource(script: Question[], spare: Question[]): QuestionSource {
  return {
    slotCountFor: () => script.length,
    selectForSlot: (request: SlotRequest) => {
      const preferred = script[request.slotIndex]
      const candidates = preferred ? [preferred, ...spare] : spare
      const question = candidates.find((entry) => !request.excludeQuestionIds.includes(entry.id))
      if (!question) return { ok: false, message: 'Kein Kandidat im Testskript.' }
      const runtime: RuntimeQuestion = {
        question,
        slotId: `slot-${request.slotIndex + 1}`,
        slotIndex: request.slotIndex,
        optionOrder: (question.options ?? []).map((option) => option.id),
      }
      return { ok: true, runtimeQuestion: runtime, rationale: 'Testskript' }
    },
  }
}

export interface Harness {
  state: GameState | null
  now: number
  /** Befehl ausfuehren; wirft, wenn er abgelehnt wird. */
  dispatch(command: Command): GameState
  /** Befehl ausfuehren und die Ablehnung zurueckgeben; wirft, wenn er akzeptiert wird. */
  expectReject(command: Command): { reason: string; message: string }
  /** Uhr vorstellen und faellige zeitgesteuerte Uebergaenge ausloesen (wie der Server-Timer). */
  advance(ms: number): void
  /** Alle offenen zeitgesteuerten Uebergaenge sofort abschliessen. */
  settle(): void
  events: { category: string; message: string }[]
  scoreTransactions: { playerId: string; delta: number; reason: string }[]
  usages: { questionId: string; slotId: string }[]
}

export function createHarness(
  script: Question[],
  options: { spare?: Question[]; startNow?: number } = {},
): Harness {
  let counter = 0
  const source = scriptedSource(script, options.spare ?? [])

  const harness: Harness = {
    state: null,
    now: options.startNow ?? 1_000_000,
    events: [],
    scoreTransactions: [],
    usages: [],

    dispatch(command) {
      const result = reduce(harness.state, command, context())
      if (!result.ok) {
        throw new Error(`Befehl ${command.type} abgelehnt: ${result.rejection.reason} - ${result.rejection.message}`)
      }
      harness.state = result.state
      harness.events.push(...result.events)
      harness.scoreTransactions.push(...result.effects.scoreTransactions)
      harness.usages.push(
        ...result.effects.questionUsages.map((usage) => ({ questionId: usage.questionId, slotId: usage.slotId })),
      )
      return result.state
    },

    expectReject(command) {
      const result = reduce(harness.state, command, context())
      if (result.ok) throw new Error(`Befehl ${command.type} wurde unerwartet akzeptiert.`)
      return result.rejection
    },

    advance(ms) {
      const target = harness.now + ms
      let guard = 0
      for (;;) {
        const pending = harness.state?.pendingTransition
        if (!pending || pending.endsAtMs > target) break
        harness.now = pending.endsAtMs
        harness.dispatch({ type: 'ADVANCE_TIMED_PHASE', transitionId: pending.transitionId })
        if ((guard += 1) > 100) throw new Error('Endlosschleife bei zeitgesteuerten Uebergaengen')
      }
      harness.now = target
    },

    /**
     * Schliesst offene Uebergaenge ab, ohne die Uhr darueber hinaus zu bewegen.
     * Wichtig fuer Bildfragen: sonst wuerde die Enthuellungsuhr unbeabsichtigt
     * bis zum Ende weiterlaufen.
     */
    settle() {
      let guard = 0
      while (harness.state?.pendingTransition) {
        const pending = harness.state.pendingTransition
        harness.now = Math.max(harness.now, pending.endsAtMs)
        harness.dispatch({ type: 'ADVANCE_TIMED_PHASE', transitionId: pending.transitionId })
        if ((guard += 1) > 100) throw new Error('Endlosschleife bei zeitgesteuerten Uebergaengen')
      }
    },
  }

  function context(): EngineContext {
    return {
      nowMs: harness.now,
      eventDayId: 'event-day-test',
      newId: (prefix) => `${prefix}-${(counter += 1)}`,
      questionSource: source,
      timing: gameTiming,
    }
  }

  return harness
}

/**
 * Startet ein Spiel und laesst den Pausenscreen ablaufen, bis die erste Frage steht.
 *
 * Ohne Angabe entsteht ein Duell - genau wie im Buehnenbetrieb, der die
 * Spielerzahl nicht mitschickt.
 */
export function startGame(
  harness: Harness,
  options: { playerCount?: PlayerCount; playerLabels?: string[]; flowProfile?: FlowProfile } = {},
): GameState {
  harness.dispatch({
    type: 'START_GAME',
    quizModeId: 'adults',
    presetId: 'medium',
    ...(options.playerCount === undefined ? {} : { playerCount: options.playerCount }),
    ...(options.playerLabels === undefined ? {} : { playerLabels: options.playerLabels }),
    ...(options.flowProfile === undefined ? {} : { flowProfile: options.flowProfile }),
  })
  // Nur den Pausenscreen ablaufen lassen. Bei Selbstbedienung wuerde `settle()`
  // das ganze Spiel durchspielen, weil dort jeder Uebergang eingeplant ist.
  harness.advance(gameTiming.pauseScreenMs)
  return harness.state!
}

/** Bringt eine normale Frage bis zur Phase `answer-locked` mit dem angegebenen Spieler. */
export function buzzIn(harness: Harness, playerId: 'player-1' | 'player-2'): void {
  if (harness.state?.phase === 'question-presented') harness.dispatch({ type: 'OPEN_BUZZER' })
  harness.dispatch({ type: 'BUZZ', playerId })
}
