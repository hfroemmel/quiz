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
  isChoiceQuestion,
  scoringRules,
  type GameStatisticsViewModel,
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
  type QuestionPresentationType,
  type GamePhase,
  type GameState,
  type PrivateSolution,
  type ActorRole,
  type PlayerQuizViewModel,
  isSelfServicePreset,
  beschriftung,
  fragenTextFuer,
  gueltigeSprache,
  oberflaechenTexte,
} from '../contracts'
import { activePlayerId } from './buzzer'
import { allowedCommandsForRole } from './allowedCommands'
import { attemptsForCurrentQuestion, determineResult, pendingAttempt, pointsForCorrectAnswer } from './scoring'
import { revealElapsedMs } from './reveal'

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
  additionalOperatorCommands?: import('../contracts').CommandType[]
  /** Zielgruppe, deren Theme die Startansicht zeigt, solange kein Spiel laeuft. */
  previewAudienceId?: string
  /** Globaler Soundstatus, solange kein Spiel laeuft. */
  soundEnabled?: boolean
  /** Sprache des Geraets, solange kein Spiel laeuft. */
  locale?: string
  /**
   * Rohzahlen des Spielprotokolls aus der Datenbank, je Zielgruppe. Die Zuordnung
   * zu lesbaren Namen passiert hier in der Projektion - dieselbe Regel wie
   * bei Rubriken: rohe IDs kommen nicht in die Oberflaeche.
   */
  gameCounts?: { audience: string; total: number; completed: number; aborted: number; lastAtIso?: string }[]
  /** Zeitpunkt, ab dem das Protokoll zaehlt. */
  statisticsSinceIso?: string
}

/**
 * Szene des Buehnenscreens.
 *
 * Sie folgt der Phase - mit einer Ausnahme, die der Fragetyp vorgibt: Beim
 * Bilderkennen bleibt die Buehne auch dann in der Enthuellungsszene, wenn ein
 * Spieler den Zuschlag hat. Das eingefrorene Bild ist genau das, worueber jetzt
 * gesprochen wird; ein Sprung in das Fragelayout naehme es vom Schirm.
 */
export function sceneForPhase(phase: GamePhase, presentationType?: QuestionPresentationType): PublicScene {
  if (presentationType === 'image-reveal' && phase === 'answer-locked') return 'reveal'
  return sceneForPhaseOnly(phase)
}

function sceneForPhaseOnly(phase: GamePhase): PublicScene {
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
    case 'reveal-ready':
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
      locale: spracheFuer(state, ctx),
      ...texteFuer(state, ctx),
      serverTimeMs: ctx.nowMs,
      revision: state?.revision ?? 0,
    }
  }

  const scene = sceneForPhase(state.phase, state.currentQuestion?.question.questionType)
  const runtime = state.currentQuestion
  const locale = spracheFuer(state, ctx)
  /*
   * AB HIER IST DIE FRAGE UEBERSETZT. Alles darunter - Text, Optionen, Medium,
   * Loesung - liest aus dieser einen Fassung; sonst stuende die Frage in einer
   * und die Antworten in einer anderen Sprache.
   */
  const question = runtime ? fragenTextFuer(runtime.question, locale) : undefined
  const active = activePlayerId(state)
  const showsQuestion = scene === 'question' || scene === 'feedback' || scene === 'solution' || scene === 'reveal' || scene === 'video'

  const publicQuestion: PublicQuestion | undefined =
    showsQuestion && question
      ? {
          prompt: question.prompt,
          presentationType: question.questionType,
          imageUrl: ctx.assetUrl(question.media?.imageAssetId),
          videoUrl: scene === 'video' ? ctx.assetUrl(question.media?.videoAssetId) : undefined,
          categoryLabel: categoryLabel(question, ctx, locale),
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
    question: publicQuestion,
    // Nur der Zwischenscreen bekommt die Rubrik der gleich folgenden Frage.
    upcomingCategoryLabel: scene === 'pause' && question ? categoryLabel(question, ctx, locale) : undefined,
    /*
     * Die Antwortmoeglichkeiten gehen erst auf die Leitung, wenn der Operator die
     * Runde freigegeben hat. Solange nur die Frage steht, liest der Moderator sie
     * vor - haette der Buehnenclient die Optionen bereits, waeren sie im DOM zu
     * finden, bevor sie jemand sehen soll.
     */
    visibleOptions:
      showsQuestion && state.phase !== 'question-presented' ? publicOptions(state, scene, question) : undefined,
    // Die Loesung wird ausschliesslich in der Loesungsszene uebertragen. Nach einer
    // falschen ersten Antwort bleibt sie damit auch technisch verborgen.
    visibleSolution: scene === 'solution' ? publicSolution(ctx, question!) : undefined,
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
          // Erst die gemeldete Laufzeit macht den Positionsregler des Operators
          // brauchbar - ohne sie reicht er nur bis zur bereits erreichten Stelle.
          durationMs: state.video.durationMs,
          hasError: Boolean(state.video.error),
        }
      : undefined,
    result:
      scene === 'result'
        ? { ...determineResult(state), scores }
        : undefined,
    soundEnabled: state.soundEnabled,
    locale,
    ...texteFuer(state, ctx),
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
    catalog: buildPlayerCatalog(ctx, spracheFuer(state, ctx)),
  }
}

/**
 * Katalog fuer das Touchgeraet: nur Presets, die dort auch spielbar sind, und nur
 * Zielgruppen, die mindestens eines davon erlauben.
 *
 * Damit steht am Geraet keine Schwierigkeitsstufe zur Wahl, die auf halber
 * Strecke einen Operator braeuchte - und der Client muss nichts darueber wissen.
 */
function buildPlayerCatalog(ctx: ProjectionContext, locale: string): CatalogViewModel {
  const full = buildCatalog(ctx, locale)
  const playable = new Set(ctx.config.presets.filter(isSelfServicePreset).map((preset) => preset.id))

  return {
    ...full,
    presets: full.presets.filter((preset) => playable.has(preset.id)),
    audiences: full.audiences
      .map((entry) => ({ ...entry, allowedPresetIds: entry.allowedPresetIds.filter((id) => playable.has(id)) }))
      .filter((entry) => entry.allowedPresetIds.length > 0),
  }
}

export function projectModerator(state: GameState | null, ctx: ProjectionContext): ModeratorQuizViewModel {
  const base = projectPublic(state, ctx)
  const roh = state?.currentQuestion?.question
  /*
   * Der Moderator liest vor, was im Saal steht - also die uebersetzte Fassung.
   * Der Operator dagegen bearbeitet weiter unten das ORIGINAL: Ein Hotfix
   * schreibt in den Bestand zurueck, und eine Uebersetzung dort einzutragen
   * ueberschriebe die Grundsprache.
   */
  const question = roh ? fragenTextFuer(roh, base.locale) : undefined
  const attempt = state ? pendingAttempt(state) : undefined

  return {
    ...base,
    questionId: question?.id,
    // Moderator und Operator sehen die Loesung jederzeit privat - der Buehnenscreen nie vorzeitig.
    privateSolution: question ? privateSolution(question) : undefined,
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
  const question = state?.currentQuestion?.question
  return {
    ...moderator,
    /*
     * Grundlage der Live-Korrektur: Fragetext und Antwortmoeglichkeiten in
     * bearbeitbarer Form. Sie stehen unabhaengig davon bereit, ob die Antworten
     * auf der Buehne schon eingeblendet sind - der Operator sieht ohnehin die
     * vollstaendige Frage.
     */
    editableQuestion: question
      ? {
          prompt: question.prompt,
          options: (question.options ?? []).map((option) => ({ id: option.id, text: option.text })),
          correctOptionId: question.correctOptionId,
          acceptedAnswerText: question.acceptedAnswerText ?? [],
        }
      : undefined,
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
    statistics: gameStatistics(ctx),
    resumable: ctx.resumable,
    catalog: buildCatalog(ctx, spracheFuer(state, ctx)),
  }
}

/* ------------------------------------------------------------------ *
 * Bausteine
 * ------------------------------------------------------------------ */

function publicOptions(state: GameState, scene: PublicScene, question: Question | undefined): PublicOption[] | undefined {
  const runtime = state.currentQuestion
  /*
   * Ohne echte Auswahl gibt es keine Antwortleisten. Eine einzelne Option waere
   * die Loesung auf der Buehne - die Frage laeuft dann als freie Antwort.
   */
  if (!runtime || !question || !isChoiceQuestion(question)) return undefined

  const byId = new Map((question.options ?? []).map((option) => [option.id, option]))
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
      // Ob eine Option richtig ist, wird erst in der Loesungsszene uebertragen.
      if (scene === 'solution' && option.id === question.correctOptionId) {
        entry.state = 'correct'
      } else if (chosenIncorrect.has(option.id)) {
        /*
         * Eine bereits als falsch bewertete Option ist verbraucht. Sie wird sofort
         * so markiert - nicht erst in der Loesungsszene -, damit die zweite Chance
         * sie sichtbar ausschliesst. Der Saal hat die Bewertung ohnehin gehoert.
         */
        entry.state = 'chosen-incorrect'
      } else if (option.id === pendingAttempt(state)?.loggedOptionId) {
        // Die eingeloggte Antwort ist oeffentlich - aber nur als Festlegung,
        // nicht als Bewertung.
        entry.state = 'chosen'
      }
      return entry
    })
}

/**
 * Spielprotokoll: jede konfigurierte Zielgruppe erscheint, auch mit null Spielen.
 *
 * Ein fehlender Eintrag waere zweideutig - "noch nie gespielt" sieht dann aus wie
 * "Zielgruppe gibt es nicht mehr".
 */
function gameStatistics(ctx: ProjectionContext): GameStatisticsViewModel {
  const byAudience = new Map((ctx.gameCounts ?? []).map((entry) => [entry.audience, entry]))
  return {
    countingSinceIso: ctx.statisticsSinceIso,
    audiences: ctx.config.audiences.map((audienceConfig) => {
      const counts = byAudience.get(audienceConfig.id)
      return {
        audience: audienceConfig.id,
        label: audienceConfig.label,
        total: counts?.total ?? 0,
        completed: counts?.completed ?? 0,
        aborted: counts?.aborted ?? 0,
        lastPlayedIso: counts?.lastAtIso,
      }
    }),
  }
}

function correctAnswerText(question: Question | undefined): string {
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
function categoryLabel(question: Question, ctx: ProjectionContext, locale: string): string | undefined {
  const first = question.categories[0]
  if (!first) return undefined
  const kategorie = ctx.config.categories.find((category) => category.id === first)
  return kategorie ? beschriftung(kategorie, locale) : undefined
}

/**
 * In welcher Sprache steht diese Ansicht?
 *
 * Ein laufendes Spiel behaelt die Sprache, in der es begonnen wurde; ohne Spiel
 * gilt die des Geraets. Was der Inhalt nicht kennt, faellt auf die Grundsprache
 * zurueck - ein Tippfehler im Config File darf kein Geraet lahmlegen.
 */
function spracheFuer(state: GameState | null, ctx: ProjectionContext): string {
  return gueltigeSprache(ctx.config, state?.locale ?? ctx.locale)
}

/**
 * Die Oberflaechentexte - nur, wenn der Inhalt welche mitbringt.
 *
 * Ohne Eintraege bleibt das Feld weg, statt ein leeres Objekt durch jede
 * Nachricht zu tragen: Der Client haelt seine deutschen Fassungen ohnehin
 * selbst vor.
 */
function texteFuer(state: GameState | null, ctx: ProjectionContext): { texts?: Record<string, string> } {
  const texte = oberflaechenTexte(ctx.config, spracheFuer(state, ctx))
  return Object.keys(texte).length > 0 ? { texts: texte } : {}
}

function publicSolution(ctx: ProjectionContext, question: Question): PublicSolution {
  /*
   * Die Loesungsansicht zeigt die Antwort - mehr nicht. Der Erklaerungstext bleibt
   * dem Operator und dem Moderator vorbehalten; erzaehlt wird er auf der Buehne,
   * nicht gelesen. Er wird deshalb gar nicht erst oeffentlich uebertragen.
   */
  return {
    answerText: correctAnswerText(question),
    imageUrl: ctx.assetUrl(question.media?.imageAssetId),
  }
}

function privateSolution(question: Question): PrivateSolution {
  return {
    answerText: correctAnswerText(question),
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
    `Video konnte nicht geladen werden (${state.video.error}). Sichere nächste Aktion: Frage überspringen oder ohne Video weiterfuehren.`,
  ]
}

function resolveTheme(state: GameState | null, ctx: ProjectionContext): PublicTheme {
  const locale = spracheFuer(state, ctx)
  const audienceId = state?.audience ?? ctx.previewAudienceId
  const audienceConfig =
    ctx.config.audiences.find((entry) => entry.id === audienceId) ?? ctx.config.audiences[0]!
  const theme = ctx.config.themes.find((entry) => entry.id === audienceConfig.themeId) ?? ctx.config.themes[0]!
  // Farben und Schriften stehen bewusst nicht im View-Modell - Darstellung ist
  // Sache des Gastgebers und kommt aus dessen Theme-Schicht.
  return {
    id: theme.id,
    skin: theme.skin,
    logoUrl: ctx.assetUrl(theme.logoAssetId),
    startVisualUrl: ctx.assetUrl(audienceConfig.startVisualAssetId ?? theme.logoAssetId),
    // Auch der Titel ueber dem Startbild spricht die Sprache des Quiz.
    startTitle: audienceConfig.startTitles?.[locale] ?? audienceConfig.startTitle,
    startDescription: audienceConfig.startDescriptions?.[locale] ?? audienceConfig.startDescription,
    presentationAnimationSetId: theme.presentationAnimationSetId,
  }
}

function buildCatalog(ctx: ProjectionContext, locale: string): CatalogViewModel {
  return {
    questionsPerGame: ctx.config.questionsPerGame,
    audiences: ctx.config.audiences.map((audienceConfig) => ({
      id: audienceConfig.id,
      label: beschriftung(audienceConfig, locale),
      themeId: audienceConfig.themeId,
      startVisualUrl: ctx.assetUrl(audienceConfig.startVisualAssetId),
      allowedPresetIds: audienceConfig.allowedPresetIds,
    })),
    pools: ctx.config.pools.map((pool) => ({ id: pool.id, label: beschriftung(pool, locale) })),
    presets: ctx.config.presets.map((preset) => ({
      id: preset.id,
      label: beschriftung(preset, locale),
      slotCount: preset.slots.length,
    })),
    /*
     * Die Sprachen tragen ihren EIGENEN Namen und werden deshalb nicht
     * uebersetzt: Wer Englisch sucht, sucht "English" und nicht "Englisch".
     */
    locales: ctx.config.locales ?? [],
  }
}

/** Klartexthinweis, was als naechstes passiert - hilft Moderator und Operator. */
function nextStepHint(state: GameState | null): string {
  if (!state) return 'Zielgruppe und Preset wählen, dann "Spiel starten".'
  if (state.status === 'aborted') return 'Spiel abgebrochen. Zurück zur Startansicht.'
  if (state.status === 'completed') return 'Ergebnis sichtbar. Punkte können noch korrigiert werden.'

  const isLast = state.currentSlotIndex + 1 >= state.totalQuestions
  switch (state.phase) {
    case 'pause-screen':
      return 'Pausenscreen läuft, danach erscheint die nächste Frage automatisch.'
    case 'question-presented':
      return 'Frage steht. Vorlesen, dann "Antworten einblenden".'
    case 'reveal-ready':
      return 'Bild steht unscharf. Vorlesen, dann "Enthüllung starten".'
    case 'video-ready':
      return 'Video steht bereit. Der Operator startet es; Buzzern ist erst nach dem Video möglich.'
    case 'video-playing':
      return 'Video läuft. Danach "Frage einblenden" und "Antworten einblenden".'
    case 'buzzer-open':
      return 'Buzzer offen. Wer zuerst drückt, antwortet.'
    case 'reveal-running':
      return 'Enthüllung läuft. Buzzern bleibt auch nach Ablauf erlaubt.'
    case 'reveal-paused':
      return 'Enthüllung pausiert. Fortsetzen oder Antwort aufnehmen.'
    case 'answer-locked':
      return 'Antwort einloggen und anschließend auflösen.'
    case 'second-chance':
      return 'Zweite Chance: 50 Punkte bei richtiger Antwort, kein erneutes Buzzern nötig.'
    case 'attempt-feedback':
      return 'Feedback läuft, der Wechsel erfolgt automatisch.'
    case 'solution':
      return isLast ? 'Letzte Frage. "Weiter" zeigt das Ergebnis.' : '"Weiter" startet die nächste Frage.'
    default:
      return ''
  }
}

/** Nur zur Anzeige: wie viele Punkte gaebe es aktuell bei richtiger Antwort? */
export const maximumPointsPerQuestion = scoringRules.firstAnswerPoints
