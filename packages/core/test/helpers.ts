/**
 * Test helpers for the domain.
 *
 * All rule tests run with a fake clock and a fixed question order, so that the
 * behaviour of the state machine can be checked independently of the selection
 * algorithm. The selection has tests of its own (`selection.test.ts`).
 */
import {
  gameTiming,
  resolveRules,
  type RulesConfig,
  selfServiceTiming,
  type Command,
  type FlowProfile,
  type GameState,
  type PlayerCount,
  type ModeratorQuizViewModel,
  type OperatorQuizViewModel,
  type PublicQuizViewModel,
  type Question,
  type QuizConfig,
  type RuntimeQuestion,
} from '../src'
import { reduce, type EngineContext, type QuestionSource, type SlotRequest } from '../src/engine/engine'
import { resolveQuizMode } from '../src/engine/quizModes'
import { projectModerator, projectOperator, projectPublic } from '../src/engine/projection'

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

/** Supplies the questions in a fixed order - one slot per entry. */
function scriptedSource(script: Question[], spare: Question[]): QuestionSource {
  return {
    slotCountFor: () => script.length,
    /*
     * The quiz types come from the same configuration the projection uses and
     * are resolved with the same function as in the server. A rebuilt lookup
     * would have different rules here than there.
     */
    quizFor: (quizId) => resolveQuizMode(testConfig, quizId),
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
  /** Execute a command; throws if it is refused. */
  dispatch(command: Command): GameState
  /** Execute a command and return the refusal; throws if it is accepted. */
  expectReject(command: Command): { reason: string; message: string }
  /** Advance the clock and fire due timed transitions (like the server timer). */
  advance(ms: number): void
  /** Complete all open timed transitions at once. */
  settle(): void
  /** The public view model of the current state - what the hall would see. */
  publicView(): PublicQuizViewModel
  /** The moderator view - it says what the pending answer is worth. */
  moderatorView(): ModeratorQuizViewModel
  /** The operator view - it carries the joker controls. */
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
    /** Rules of the package under test - without them the house rules apply. */
    rules?: RulesConfig
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
     * Completes open transitions without moving the clock beyond them.
     * Important for picture questions: otherwise the reveal clock would
     * unintentionally run on to the end.
     */
    publicView() {
      return projectPublic(harness.state, projectionContext())
    },

    moderatorView() {
      return projectModerator(harness.state, projectionContext())
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
    const rules = resolveRules(options.rules)
    return {
      nowMs: harness.now,
      eventDayId: 'event-day-test',
      newId: (prefix) => `${prefix}-${(counter += 1)}`,
      questionSource: source,
      timing: rules.timing,
      selfServiceTiming: rules.selfServiceTiming,
      scoring: rules.scoring,
      jokersEnabled: rules.jokersEnabled,
      ...(options.random === undefined ? {} : { random: options.random }),
    }
  }

  function projectionContext() {
    return {
      nowMs: harness.now,
      config: options.rules ? { ...testConfig, rules: options.rules } : testConfig,
      assetUrl: (assetId: string | undefined) => (assetId ? `/media/${assetId}` : undefined),
      mediaUrl: (filename: string | undefined) => (filename ? `/media/${filename}` : undefined),
      contentVersion: 'test',
      eventDayId: 'event-day-test',
    }
  }

  return harness
}

/**
 * Minimal configuration for the projection - the colour values themselves do not
 * matter here.
 *
 * The quiz types cover the three cases there are to distinguish: one with a
 * difficulty choice, one with its own design world and one that IS its
 * question pool.
 */
export const testConfig: QuizConfig = {
  questionsPerGame: 7,
  difficulties: [{ id: 'medium', label: 'Mittel' }],
  categories: [{ id: 'general', label: 'Allgemein' }],
  pools: [
    { id: 'bundestag', label: 'Bundestag' },
    { id: 'bremen', label: 'Bremen' },
  ],
  themes: [
    { id: 'default', label: 'Standard' },
    { id: 'kids', label: 'Kinder', skin: 'kids' },
  ],
  presets: [
    { id: 'easy', label: 'Leicht', slots: [{ id: 'text', filters: {} }] },
    { id: 'medium', label: 'Mittel', slots: [{ id: 'text', filters: {} }] },
    { id: 'hard', label: 'Schwer', slots: [{ id: 'text', filters: {} }] },
  ],
  audiences: [
    { id: 'adults', label: 'Erwachsene', themeId: 'default', allowedPresetIds: ['easy', 'medium', 'hard'] },
    { id: 'kids', label: 'Kinder', themeId: 'kids', allowedPresetIds: ['easy'] },
  ],
  quizzes: [
    {
      id: 'bundestag',
      label: 'Bundestagsquiz',
      audienceId: 'adults',
      themeId: 'default',
      presetIds: ['easy', 'medium', 'hard'],
      defaultPresetId: 'medium',
    },
    { id: 'kids', label: 'Kinderquiz', audienceId: 'kids', themeId: 'kids', presetIds: ['easy'] },
    {
      id: 'bremen',
      label: 'Bremen-Quiz',
      audienceId: 'adults',
      themeId: 'default',
      poolIds: ['bremen'],
      presetIds: ['medium'],
    },
  ],
}

/** Starts a game and lets the pause screen run until the first question stands. */
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
  // Only let the pause screen run. In self-service `settle()` would play
  // through the whole game, because every transition is scheduled there.
  harness.advance(gameTiming.pauseScreenMs)
  /*
   * In self-service only the question stands at first afterwards. The tests
   * below almost all begin at the open answer; whoever wants to check the
   * deadline itself starts without this helper. A video question stays
   * untouched - there the deadline only comes after the video.
   */
  if (harness.state?.phase === 'question-presented') harness.advance(selfServiceTiming.questionLeadInMs)
  return harness.state!
}

/**
 * Brings a question to the phase `answer-locked` with the given player.
 *
 * Every question first stands still so that the moderator can read it aloud;
 * only opening the buzzer makes it buzzable.
 */
export function releaseRound(harness: Harness): void {
  if (harness.state?.phase === 'question-presented') harness.dispatch({ type: 'OPEN_BUZZER' })
  if (harness.state?.phase === 'reveal-ready') harness.dispatch({ type: 'START_IMAGE_REVEAL' })
}

export function buzzIn(harness: Harness, playerId: 'player-1' | 'player-2'): void {
  releaseRound(harness)
  harness.dispatch({ type: 'BUZZ', playerId })
}
