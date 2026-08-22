/**
 * Serverseitige Projektion des autoritativen Zustands auf rollenabhaengige
 * View-Modelle (Spezifikation 19).
 *
 * SICHERHEITSREGEL: Der Buehnenscreen bekommt ausschliesslich `PublicQuizViewModel`.
 * Die richtige Antwort, Erklaerungen, Regiehinweise und Auswahlbegruendungen werden
 * hier herausgefiltert und niemals uebertragen, bevor sie oeffentlich sein duerfen.
 * Ein Ausblenden per CSS waere nicht ausreichend.
 */
import {
  isSelfServicePreset,
  scoringRules,
  type AuditEntry,
  type CatalogViewModel,
  type ModeratorQuizViewModel,
  type OperatorQuizViewModel,
  type PublicOption,
  type PublicQuestion,
  type PublicQuizViewModel,
  type PublicScene,
  type PublicScore,
  type PublicSolution,
  type PublicTheme,
  type QuizConfig,
  type Question,
  type GamePhase,
  type GameState,
  type PrivateSolution,
  type ActorRole,
  type PlayerQuizViewModel,
} from '@quiz/contracts'
import { activePlayerId } from './buzzer.ts'
import { allowedCommandsForRole } from './allowedCommands.ts'
import { attemptsForCurrentQuestion, determineResult, pendingAttempt, pointsForCorrectAnswer } from './scoring.ts'
import { revealElapsedMs } from './reveal.ts'

export interface ProjectionContext {
  nowMs: number
  config: QuizConfig
  /** Aufloesung einer Asset-ID in eine ausspielbare URL. */
  assetUrl: (assetId: string | undefined) => string | undefined
  contentVersion: string
  eventDayId: string
  /** Begruendung der aktuellen Fragenauswahl - nur fuer Operator-Diagnose. */
  selectionRationale?: string
  auditSummary?: AuditEntry[]
  connectedClients?: { role: ActorRole; clientId: string }[]
  sessionCode?: string
  lanUrls?: string[]
  warnings?: string[]
  resumable?: OperatorQuizViewModel['resumable']
  /**
   * Befehle, die nicht aus der Phase folgen, sondern aus dem Betriebszustand des
   * Servers (Wiederherstellung, Veranstaltungstag, Hotfix). Sie werden hier ergaenzt,
   * damit der Operatorclient weiterhin nur `allowedCommands` auswerten muss.
   */
  additionalOperatorCommands?: import('@quiz/contracts').CommandType[]
  /** Modus, dessen Theme auf der Startansicht gezeigt wird, solange kein Spiel laeuft. */
  previewModeId?: string
  /** Globaler Soundstatus, solange kein Spiel laeuft. */
  soundEnabled?: boolean
}

/** Szene des Buehnenscreens. Sie wird immer aus der Phase abgeleitet. */
export function sceneForPhase(phase: GamePhase): PublicScene {
  switch (phase) {
    case 'idle':
    case 'aborted':
      return 'start'
    case 'pause-screen':
      return 'pause'
    case 'question-presented':
    case 'buzzer-open':
    case 'answer-locked':
    case 'second-chance':
      return 'question'
    case 'video-ready':
    case 'video-playing':
      return 'video'
    case 'reveal-running':
    case 'reveal-paused':
      return 'reveal'
    case 'attempt-feedback':
      return 'feedback'
    case 'solution':
      return 'solution'
    case 'result':
      return 'result'
  }
}

export function projectPublic(state: GameState | null, ctx: ProjectionContext): PublicQuizViewModel {
  const theme = resolveTheme(state, ctx)
  if (!state || state.status === 'aborted') {
    return {
      scene: 'start',
      phase: state?.phase ?? 'idle',
      theme,
      playerScores: [],
      progress: { current: 0, total: ctx.config.questionsPerGame },
      soundEnabled: state?.soundEnabled ?? ctx.soundEnabled ?? true,
      serverTimeMs: ctx.nowMs,
      revision: state?.revision ?? 0,
    }
  }

  const scene = sceneForPhase(state.phase)
  const runtime = state.currentQuestion
  const question = runtime?.question
  const active = activePlayerId(state)
  const showsQuestion = scene === 'question' || scene === 'feedback' || scene === 'solution' || scene === 'reveal' || scene === 'video'

  const publicQuestion: PublicQuestion | undefined =
    showsQuestion && question
      ? {
          prompt: question.prompt,
          presentationType: question.presentationType,
          imageUrl: ctx.assetUrl(question.media?.imageAssetId),
          videoUrl: scene === 'video' ? ctx.assetUrl(question.media?.videoAssetId) : undefined,
          categoryLabel: categoryLabel(question, ctx),
        }
      : undefined

  const scores: PublicScore[] = state.players.map((player) => ({
    playerId: player.id,
    label: player.label,
    score: player.score,
    active: player.id === active,
    locked: player.lockedForCurrentQuestion,
  }))

  const view: PublicQuizViewModel = {
    scene,
    phase: state.phase,
    theme,
    secondChance:
      state.phase === 'second-chance'
        ? {
            pointsIfCorrect: pointsForCorrectAnswer(
              attemptsForCurrentQuestion(state).filter((entry) => entry.outcome === 'incorrect').length,
            ),
          }
        : undefined,
    question: publicQuestion,
    visibleOptions: showsQuestion ? publicOptions(state, scene) : undefined,
    // Die Loesung wird ausschliesslich in der Loesungsszene uebertragen. Nach einer
    // falschen ersten Antwort bleibt sie damit auch technisch verborgen.
    visibleSolution: scene === 'solution' ? publicSolution(state, ctx) : undefined,
    feedback: scene === 'feedback' ? publicFeedback(state) : undefined,
    playerScores: scores,
    currentPlayer: active,
    progress: { current: state.currentSlotIndex + 1, total: state.totalQuestions },
    reveal: state.reveal
      ? {
          status: state.reveal.status,
          durationMs: state.reveal.durationMs,
          elapsedMs: revealElapsedMs(state.reveal, ctx.nowMs),
        }
      : undefined,
    video: state.video
      ? {
          status: state.video.status,
          positionMs: videoPositionMs(state, ctx.nowMs),
          hasError: Boolean(state.video.error),
        }
      : undefined,
    result:
      scene === 'result'
        ? { ...determineResult(state), scores }
        : undefined,
    soundEnabled: state.soundEnabled,
    transition: state.lastTransition
      ? {
          id: state.lastTransition.transitionId,
          startedAtServerMs: state.lastTransition.startedAtServerMs,
          durationMs: state.lastTransition.durationMs,
        }
      : undefined,
    serverTimeMs: ctx.nowMs,
    revision: state.revision,
  }
  return view
}

/**
 * Ansicht der Spieler am Touchgeraet.
 *
 * SICHERHEITSREGEL wie beim Buehnenscreen: Es ist die oeffentliche Ansicht. Die
 * Loesung wird erst in der Loesungsszene uebertragen, Erklaerungen und
 * Regiehinweise nie. Dazu kommt allein die Liste der jetzt moeglichen Befehle,
 * damit der Touchclient seine Bedienbarkeit nicht selbst herleitet.
 */
export function projectPlayer(state: GameState | null, ctx: ProjectionContext): PlayerQuizViewModel {
  return {
    ...projectPublic(state, ctx),
    allowedCommands: allowedCommandsForRole(state ?? null, 'player'),
    catalog: buildPlayerCatalog(ctx),
  }
}

/**
 * Katalog fuer das Touchgeraet: nur Presets, die dort auch spielbar sind, und nur
 * Modi, die mindestens eines davon erlauben.
 *
 * Damit steht am Geraet keine Schwierigkeitsstufe zur Wahl, die auf halber
 * Strecke einen Operator braeuchte - und der Client muss nichts darueber wissen.
 */
function buildPlayerCatalog(ctx: ProjectionContext): CatalogViewModel {
  const full = buildCatalog(ctx)
  const playable = new Set(ctx.config.presets.filter(isSelfServicePreset).map((preset) => preset.id))

  return {
    questionsPerGame: full.questionsPerGame,
    presets: full.presets.filter((preset) => playable.has(preset.id)),
    modes: full.modes
      .map((mode) => ({ ...mode, allowedPresetIds: mode.allowedPresetIds.filter((id) => playable.has(id)) }))
      .filter((mode) => mode.allowedPresetIds.length > 0),
  }
}

export function projectModerator(state: GameState | null, ctx: ProjectionContext): ModeratorQuizViewModel {
  const base = projectPublic(state, ctx)
  const question = state?.currentQuestion?.question
  const attempt = state ? pendingAttempt(state) : undefined

  return {
    ...base,
    questionId: question?.id,
    // Moderator und Operator sehen die Loesung jederzeit privat - der Buehnenscreen nie vorzeitig.
    privateSolution: question ? privateSolution(state!) : undefined,
    explanation: question?.explanation,
    allowedCommands: allowedCommandsForRole(state ?? null, 'moderator'),
    nextStepHint: nextStepHint(state),
    answering:
      state && attempt && question
        ? {
            evaluationMode: question.evaluationMode,
            loggedOptionId: attempt.loggedOptionId,
            loggedManualVerdict: attempt.loggedManualVerdict,
            attemptNumber: attempt.attemptNumber,
            pointsIfCorrect: pointsForCorrectAnswer(
              attemptsForCurrentQuestion(state).filter((entry) => entry.outcome === 'incorrect').length,
            ),
          }
        : undefined,
  }
}

export function projectOperator(state: GameState | null, ctx: ProjectionContext): OperatorQuizViewModel {
  const moderator = projectModerator(state, ctx)
  return {
    ...moderator,
    allowedCommands: [
      ...new Set([...allowedCommandsForRole(state ?? null, 'operator'), ...(ctx.additionalOperatorCommands ?? [])]),
    ],
    auditSummary: ctx.auditSummary ?? [],
    diagnostics: {
      contentVersion: ctx.contentVersion,
      eventDayId: ctx.eventDayId,
      selectionRationale: ctx.selectionRationale,
      connectedClients: ctx.connectedClients ?? [],
      sessionCode: ctx.sessionCode,
      lanUrls: ctx.lanUrls,
      warnings: [...(ctx.warnings ?? []), ...videoWarnings(state)],
    },
    resumable: ctx.resumable,
    catalog: buildCatalog(ctx),
  }
}

/* ------------------------------------------------------------------ *
 * Bausteine
 * ------------------------------------------------------------------ */

function publicOptions(state: GameState, scene: PublicScene): PublicOption[] | undefined {
  const runtime = state.currentQuestion
  const question = runtime?.question
  if (!runtime || !question?.options?.length) return undefined

  const byId = new Map(question.options.map((option) => [option.id, option]))
  const chosenIncorrect = new Set(
    attemptsForCurrentQuestion(state)
      .filter((attempt) => attempt.outcome === 'incorrect' && attempt.loggedOptionId)
      .map((attempt) => attempt.loggedOptionId!),
  )

  return runtime.optionOrder
    .map((optionId) => byId.get(optionId))
    .filter((option): option is NonNullable<typeof option> => Boolean(option))
    .map((option) => {
      const entry: PublicOption = { id: option.id, text: option.text }
      // Der Zustand einer Option wird erst in der Loesungsszene uebertragen.
      if (scene === 'solution') {
        if (option.id === question.correctOptionId) entry.state = 'correct'
        else if (chosenIncorrect.has(option.id)) entry.state = 'chosen-incorrect'
      }
      return entry
    })
}

function correctAnswerText(state: GameState): string {
  const question = state.currentQuestion?.question
  if (!question) return ''
  if (question.correctOptionId) {
    const option = question.options?.find((entry) => entry.id === question.correctOptionId)
    if (option) return option.text
  }
  return question.acceptedAnswerText?.[0] ?? ''
}

/**
 * Rubrik ueber dem Fragetext: Label der ERSTEN Kategorie der Frage.
 *
 * Die Reihenfolge der Kategorien ist redaktionell gesetzt; die erste ist die
 * fuehrende. Steht sie nicht in der Konfiguration, bleibt die Zeile leer, statt
 * eine rohe ID auf die Buehne zu bringen.
 */
function categoryLabel(question: Question, ctx: ProjectionContext): string | undefined {
  const first = question.categoryIds[0]
  if (!first) return undefined
  return ctx.config.categories.find((category) => category.id === first)?.label
}

function publicSolution(state: GameState, ctx: ProjectionContext): PublicSolution {
  const question = state.currentQuestion!.question
  return {
    answerText: correctAnswerText(state),
    imageUrl: ctx.assetUrl(question.media?.imageAssetId),
    // `summary` ist der redaktionell freigegebene, oeffentlich zeigbare Kurztext.
    // `details`, `source` und `moderatorNotes` bleiben privat.
    publicNote: question.explanation?.summary,
  }
}

function privateSolution(state: GameState): PrivateSolution {
  const question = state.currentQuestion!.question
  return {
    answerText: correctAnswerText(state),
    correctOptionId: question.correctOptionId,
    acceptedAnswerText: question.acceptedAnswerText,
  }
}

function publicFeedback(state: GameState): PublicQuizViewModel['feedback'] {
  const attempts = attemptsForCurrentQuestion(state)
  const last = attempts.filter((attempt) => attempt.outcome !== undefined).at(-1)
  if (!last) return undefined
  return { outcome: last.outcome!, playerId: last.playerId, awardedPoints: last.awardedPoints }
}

function videoPositionMs(state: GameState, nowMs: number): number {
  const video = state.video
  if (!video) return 0
  if (video.status !== 'playing' || video.startedAtServerMs === undefined) return video.positionMs
  return video.positionMs + Math.max(0, nowMs - video.startedAtServerMs)
}

function videoWarnings(state: GameState | null): string[] {
  if (!state?.video?.error) return []
  return [
    `Video konnte nicht geladen werden (${state.video.error}). Sichere naechste Aktion: Frage ueberspringen oder ohne Video weiterfuehren.`,
  ]
}

function resolveTheme(state: GameState | null, ctx: ProjectionContext): PublicTheme {
  const modeId = state?.quizModeId ?? ctx.previewModeId
  const mode = ctx.config.modes.find((entry) => entry.id === modeId) ?? ctx.config.modes[0]!
  const theme = ctx.config.themes.find((entry) => entry.id === mode.themeId) ?? ctx.config.themes[0]!
  return {
    id: theme.id,
    colors: theme.colors,
    logoUrl: ctx.assetUrl(theme.logoAssetId),
    startVisualUrl: ctx.assetUrl(mode.startVisualAssetId ?? theme.logoAssetId),
    startTitle: mode.startTitle,
    headingFont: theme.typography?.headingFont,
    bodyFont: theme.typography?.bodyFont,
    presentationAnimationSetId: theme.presentationAnimationSetId,
  }
}

function buildCatalog(ctx: ProjectionContext): CatalogViewModel {
  return {
    questionsPerGame: ctx.config.questionsPerGame,
    modes: ctx.config.modes.map((mode) => ({
      id: mode.id,
      label: mode.label,
      themeId: mode.themeId,
      startVisualUrl: ctx.assetUrl(mode.startVisualAssetId),
      allowedPresetIds: mode.allowedPresetIds,
    })),
    presets: ctx.config.presets.map((preset) => ({
      id: preset.id,
      label: preset.label,
      slotCount: preset.slots.length,
    })),
  }
}

/** Klartexthinweis, was als naechstes passiert - hilft Moderator und Operator. */
function nextStepHint(state: GameState | null): string {
  if (!state) return 'Modus und Preset waehlen, dann "Spiel starten".'
  if (state.status === 'aborted') return 'Spiel abgebrochen. Zurueck zur Startansicht.'
  if (state.status === 'completed') return 'Ergebnis sichtbar. Punkte koennen noch korrigiert werden.'

  const isLast = state.currentSlotIndex + 1 >= state.totalQuestions
  switch (state.phase) {
    case 'pause-screen':
      return 'Pausenscreen laeuft, danach erscheint die naechste Frage automatisch.'
    case 'question-presented':
      return 'Frage steht. Naechster Schritt: Buzzer freigeben.'
    case 'video-ready':
      return 'Video steht bereit. Der Operator startet es; Buzzern ist erst nach dem Video moeglich.'
    case 'video-playing':
      return 'Video laeuft. Danach "Frage einblenden" und Buzzer freigeben.'
    case 'buzzer-open':
      return 'Buzzer offen. Wer zuerst drueckt, antwortet.'
    case 'reveal-running':
      return 'Enthuellung laeuft. Buzzern bleibt auch nach dem Countdown erlaubt.'
    case 'reveal-paused':
      return 'Enthuellung pausiert. Fortsetzen oder Antwort aufnehmen.'
    case 'answer-locked':
      return 'Antwort einloggen und anschliessend aufloesen.'
    case 'second-chance':
      return 'Zweite Chance: 50 Punkte bei richtiger Antwort, kein erneutes Buzzern noetig.'
    case 'attempt-feedback':
      return 'Feedback laeuft, der Wechsel erfolgt automatisch.'
    case 'solution':
      return isLast ? 'Letzte Frage. "Weiter" zeigt das Ergebnis.' : '"Weiter" startet die naechste Frage.'
    default:
      return ''
  }
}

/** Nur zur Anzeige: wie viele Punkte gaebe es aktuell bei richtiger Antwort? */
export const maximumPointsPerQuestion = scoringRules.firstAnswerPoints
