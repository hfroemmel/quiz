/**
 * Testhilfen fuer die Domain.
 *
 * Alle Regeltests laufen mit Fake-Clock und einer festen Fragenreihenfolge, damit
 * das Verhalten der Zustandsmaschine unabhaengig vom Auswahlalgorithmus geprueft
 * werden kann. Die Auswahl selbst hat eigene Tests (`selection.test.ts`).
 */
import {
  gameTiming,
  selfServiceTiming,
  type Command,
  type FlowProfile,
  type GameState,
  type PlayerCount,
  type OperatorQuizViewModel,
  type PublicQuizViewModel,
  type Question,
  type QuizConfig,
  type RuntimeQuestion,
} from '../src'
import { reduce, type EngineContext, type QuestionSource, type SlotRequest } from '../src/engine/engine'
import { projectOperator, projectPublic } from '../src/engine/projection'

export function makeQuestion(overrides: Partial<Question> & { id: string }): Question {
  return {
    poolIds: ['bundestag'],
    audiences: ['adults'],
    difficulty: 'medium',
    categories: ['general'],
    tags: [],
    locale: 'de-DE',
    prompt: `Frage ${overrides.id}`,
    questionType: 'text-choice',
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
  /** Das oeffentliche View-Modell zum aktuellen Stand - das, was der Saal saehe. */
  publicView(): PublicQuizViewModel
  /** Die Operatoransicht - sie traegt die Joker-Schaltflaechen. */
  operatorView(): OperatorQuizViewModel
  events: { category: string; message: string }[]
  scoreTransactions: { playerId: string; delta: number; reason: string }[]
  usages: { questionId: string; slotId: string }[]
}

export function createHarness(
  script: Question[],
  options: {
    spare?: Question[]
    startNow?: number
    /** Fixed source of chance - lets a test say which wrong answer survives. */
    random?: () => number
  } = {},
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
    publicView() {
      return projectPublic(harness.state, projectionContext())
    },

    operatorView() {
      return projectOperator(harness.state, projectionContext())
    },

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
      ...(options.random === undefined ? {} : { random: options.random }),
    }
  }

  function projectionContext() {
    return {
      nowMs: harness.now,
      config: testConfig,
      assetUrl: (assetId: string | undefined) => (assetId ? `/media/${assetId}` : undefined),
      contentVersion: 'test',
      eventDayId: 'event-day-test',
    }
  }

  return harness
}

/** Minimalkonfiguration fuer die Projektion - die Farbwerte selbst sind hier egal. */
const testConfig: QuizConfig = {
  questionsPerGame: 7,
  difficulties: [{ id: 'medium', label: 'Mittel' }],
  categories: [{ id: 'general', label: 'Allgemein' }],
  pools: [{ id: 'bundestag', label: 'Bundestag' }],
  themes: [{ id: 'default', label: 'Standard' }],
  presets: [{ id: 'medium', label: 'Mittel', slots: [{ id: 'text', filters: {} }] }],
  audiences: [{ id: 'adults', label: 'Erwachsene', themeId: 'default', allowedPresetIds: ['medium'] }],
}

/** Startet ein Spiel und laesst den Pausenscreen ablaufen, bis die erste Frage steht. */
export function startGame(
  harness: Harness,
  options: { playerCount?: PlayerCount; playerLabels?: string[]; flowProfile?: FlowProfile } = {},
): GameState {
  harness.dispatch({
    type: 'START_GAME',
    audience: 'adults',
    presetId: 'medium',
    ...(options.playerCount === undefined ? {} : { playerCount: options.playerCount }),
    ...(options.playerLabels === undefined ? {} : { playerLabels: options.playerLabels }),
    ...(options.flowProfile === undefined ? {} : { flowProfile: options.flowProfile }),
  })
  // Nur den Pausenscreen ablaufen lassen. Bei Selbstbedienung wuerde `settle()`
  // das ganze Spiel durchspielen, weil dort jeder Uebergang eingeplant ist.
  harness.advance(gameTiming.pauseScreenMs)
  /*
   * Bei Selbstbedienung steht danach zuerst nur die Frage. Die Tests unten
   * beginnen fast alle bei der offenen Antwort; wer die Frist selbst pruefen
   * will, startet ohne diesen Helfer. Eine Videofrage bleibt unberuehrt - dort
   * kommt die Frist erst nach dem Video.
   */
  if (harness.state?.phase === 'question-presented') harness.advance(selfServiceTiming.questionLeadInMs)
  return harness.state!
}

/**
 * Bringt eine Frage bis zur Phase `answer-locked` mit dem angegebenen Spieler.
 *
 * Jede Frage steht zuerst still da, damit der Moderator sie vorlesen kann; erst
 * die Freigabe oeffnet den Buzzer.
 */
export function releaseRound(harness: Harness): void {
  if (harness.state?.phase === 'question-presented') harness.dispatch({ type: 'OPEN_BUZZER' })
  if (harness.state?.phase === 'reveal-ready') harness.dispatch({ type: 'START_IMAGE_REVEAL' })
}

export function buzzIn(harness: Harness, playerId: 'player-1' | 'player-2'): void {
  releaseRound(harness)
  harness.dispatch({ type: 'BUZZ', playerId })
}
