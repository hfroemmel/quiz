/**
 * Development view for scenes and transitions (spec 22.6).
 *
 * Purpose: start, replay and check scenes and animations in isolation with
 * different themes - without a complete quiz and without a running server.
 *
 * This route does NOT interfere with the production workflow:
 *  - it opens no WebSocket connection;
 *  - it sends no commands;
 *  - it exclusively uses locally generated sample view models;
 *  - in the production build it is locked behind `import.meta.env.DEV`.
 */
import { useMemo, useState } from 'react'
import type {
  PublicQuizViewModel,
  PublicScene,
  QuestionPresentationType,
  ThemeSkin,
} from '@hfroemmel/quiz-core'
import { gameTiming } from '@hfroemmel/quiz-core'
import { stagePalettes } from '@hfroemmel/quiz-themes'
import { StageScreen } from '@hfroemmel/quiz-react'
import { themeForView, themeVariables } from '@hfroemmel/quiz-themes'
import { transitions } from '@hfroemmel/quiz-react'
import { prefersReducedMotion } from '@hfroemmel/quiz-react'
import styles from './PreviewApp.module.css'

/**
 * Themes of the preview.
 *
 * The preview runs without a server and builds its own view models; that's
 * why it fetches its colours directly from the palette - the same source
 * the quiz package is built from. Otherwise a copy of its own would
 * inevitably exist here, and it would eventually drift apart.
 *
 * There are exactly two design worlds: the adult stage and the illustrated
 * kids world. The Saarbruecken mode uses the adult theme and therefore
 * doesn't appear separately here.
 */
const SKINS: Record<string, ThemeSkin> = { default: 'default', kids: 'kids' }

const SCENES: PublicScene[] = ['start', 'pause', 'question', 'reveal', 'video', 'feedback', 'solution', 'result']

/**
 * Question types with their own layout that can be checked in the question
 * and solution scenes. `image-reveal` and `video-then-question` have their
 * own scenes and are therefore not offered as a choice.
 */
const QUESTION_TYPES: QuestionPresentationType[] = ['image-choice', 'text-choice', 'person']

export function PreviewApp() {
  const [scene, setScene] = useState<PublicScene>('question')
  /*
   * `null` means: the scene keeps its own sample type. Only this way do the
   * scene preview's reference images stay comparable, while every question
   * type can still be opened individually when needed.
   */
  const [questionType, setQuestionType] = useState<QuestionPresentationType | null>(null)
  const [themeId, setThemeId] = useState('default')
  const [variant, setVariant] = useState<'stage' | 'preview'>('stage')
  const [feedbackOutcome, setFeedbackOutcome] = useState<'correct' | 'incorrect'>('correct')
  const [revealElapsedMs, setRevealElapsedMs] = useState(3_000)
  const [draw, setDraw] = useState(false)
  /*
   * Stress test for the text areas. The kids-quiz asset package's
   * specification demands four question lines and two-line answers without
   * truncation; this toggle lets that be checked in every scene and theme.
   */
  const [longText, setLongText] = useState(false)
  /*
   * The 50:50 joker. It belongs to the live quiz and not to the scene, so
   * here it's a toggle like reduced motion: it hides two answers in the
   * question scene, so the presentation of hidden answers stays checkable
   * without a server. The joker card itself lives in the live quiz.
   */
  const [fiftyFifty, setFiftyFifty] = useState(false)
  /*
   * The video's current state. The operator preview announces exactly that,
   * and the stage fades the area out as soon as it has ended.
   */
  // Remount to replay the same transition.
  const [runId, setRunId] = useState(0)

  const view = useMemo(
    () =>
      buildSampleView({
        scene,
        questionType,
        themeId,
        feedbackOutcome,
        revealElapsedMs,
        draw,
        longText,
        fiftyFifty,
      }),
    [scene, questionType, themeId, feedbackOutcome, revealElapsedMs, draw, longText, fiftyFifty],
  )

  if (!import.meta.env.DEV) {
    return (
      <div className={`${styles.preview} ${styles.disabled}`}>
        <p>Die Entwicklungsansicht ist nur im Entwicklungsmodus verfügbar.</p>
      </div>
    )
  }

  return (
    <div className={styles.preview} data-preview="">
      <aside className={styles.panel} data-preview-panel="">
        <h1>Szenen- und Animationsvorschau</h1>
        <p className={styles.note}>
          Nur Entwicklung. Kein Server, keine Befehle, kein Einfluss auf ein laufendes Spiel.
        </p>

        <label className="field">
          <span>Szene</span>
          <select value={scene} onChange={(event) => setScene(event.target.value as PublicScene)}>
            {SCENES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Theme</span>
          <select value={themeId} onChange={(event) => setThemeId(event.target.value)}>
            {Object.keys(SKINS).map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>

        {(scene === 'question' || scene === 'solution') && (
          <label className="field">
            <span>Fragetyp</span>
            <select
              value={questionType ?? ''}
              onChange={(event) =>
                setQuestionType(event.target.value === '' ? null : (event.target.value as QuestionPresentationType))
              }
            >
              <option value="">Vorgabe der Szene</option>
              {QUESTION_TYPES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
        )}

        {scene === 'feedback' && (
          <label className="field">
            <span>Feedbackvariante</span>
            <select
              value={feedbackOutcome}
              onChange={(event) => setFeedbackOutcome(event.target.value as 'correct' | 'incorrect')}
            >
              <option value="correct">richtig</option>
              <option value="incorrect">falsch</option>
            </select>
          </label>
        )}

        {scene === 'reveal' && (
          <label className="field">
            <span>Enthuellungsfortschritt: {(revealElapsedMs / 1000).toFixed(1)} s</span>
            <input
              type="range"
              min={0}
              max={gameTiming.imageRevealDurationMs}
              step={100}
              value={revealElapsedMs}
              onChange={(event) => setRevealElapsedMs(Number(event.target.value))}
            />
          </label>
        )}

        {scene === 'result' && (
          <label className="field field--checkbox">
            <input type="checkbox" checked={draw} onChange={(event) => setDraw(event.target.checked)} />
            <span>Unentschieden (kein Konfetti)</span>
          </label>
        )}

        {/*
          * AT THE END OF THE BAR, not in between: the end-to-end tests
          * address the select fields by their order, and a new field further
          * up would silently shift every other one.
          *
          * WHERE THE SCENE RUNS is part of the package's surface and
          * therefore belongs in the harness. The operator's preview is not
          * the same view as the projector: it may carry direction cues -
          * whether a video is currently playing, for instance - that have no
          * business being in the hall.
          */}
        <label className="field">
          <span>Ansicht</span>
          <select
            data-preview-variant=""
            value={variant}
            onChange={(event) => setVariant(event.target.value as 'stage' | 'preview')}
          >
            <option value="stage">Buehne</option>
            <option value="preview">Operatorvorschau</option>
          </select>
        </label>

        <label className="field field--checkbox">
          <input type="checkbox" checked={longText} onChange={(event) => setLongText(event.target.checked)} />
          <span>Lange Texte (vierzeilige Frage, zweizeilige Antworten)</span>
        </label>

        <label className="field field--checkbox">
          <input
            type="checkbox"
            data-preview-fifty-fifty=""
            checked={fiftyFifty}
            onChange={(event) => setFiftyFifty(event.target.checked)}
          />
          <span>50:50-Joker (zwei Antworten ausgeblendet)</span>
        </label>


        <button className="button button--primary" onClick={() => setRunId((value) => value + 1)}>
          Uebergang erneut abspielen
        </button>

        <p className={styles.reduced}>
          Reduzierte Bewegung ist aktuell <strong>{prefersReducedMotion() ? 'aktiv' : 'inaktiv'}</strong>.
        </p>

        <h2>Registrierte Übergänge</h2>
        <ul className={styles.transitions}>
          {transitions.map((definition) => (
            <li key={definition.id}>
              <code>{definition.id}</code>
              <span>
                {definition.appliesTo.from} → {definition.appliesTo.to} &middot; {definition.durationMs} ms
                {' / '}
                {definition.reducedMotionDurationMs} ms bei reduzierter Bewegung
              </span>
              <p>{definition.description}</p>
              {definition.locked && <p className={styles.locked}>Feste Dauer: {definition.locked}</p>}
            </li>
          ))}
        </ul>
      </aside>

      <div className={styles.stage} data-preview-stage="" style={themeVariables(themeForView(view))}>
        <StageScreen
          key={runId}
          view={view}
          /*
           * Time stands still for everything shown - otherwise the reveal
           * clock would run out immediately and every screenshot would show
           * something different.
           */
          serverNow={() => view.serverTimeMs}
          isAudioMaster={false}
          variant={variant}
        />
      </div>
    </div>
  )
}

/**
 * Placeholder image of the preview.
 *
 * The preview runs without a server and therefore may not use a media URL
 * from the server. The image sits directly in the module as a data URI.
 */
const previewImage =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480">
      <rect width="640" height="480" fill="#5C5C5C"/>
      <rect x="16" y="16" width="608" height="448" fill="none" stroke="#444444" stroke-width="6"/>
      <circle cx="320" cy="220" r="90" fill="#777777"/>
      <rect x="180" y="330" width="280" height="26" rx="6" fill="#777777"/>
    </svg>`,
  )

/**
 * Portrait for the preview of the `person` question type.
 *
 * Nearly square, because the layout displays the image large in portrait
 * orientation; a landscape image would make the column split hard to judge
 * correctly.
 */
const previewPortrait =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 620" width="640" height="620">
      <rect width="640" height="620" fill="#5C5C5C"/>
      <circle cx="320" cy="250" r="120" fill="#8A8A8A"/>
      <path d="M120 620c0-125 90-205 200-205s200 80 200 205z" fill="#8A8A8A"/>
    </svg>`,
  )

/** Start image of the preview - likewise without a server URL. */
const previewStartVisual =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="400" height="320">
      <circle cx="200" cy="130" r="96" fill="rgba(255,255,255,0.08)"/>
      <text x="200" y="190" font-size="150" font-family="Georgia, serif" fill="#FFFFFF" text-anchor="middle">?</text>
    </svg>`,
  )

/**
 * Sample view models. They have the same shape as the server's real
 * snapshots, so the preview doesn't get developed past its own data
 * structure.
 */
/** Test texts from `ASSET_INTEGRATION.md`, section 8. */
const LONG_PROMPT =
  'Welche Aufgabe übernimmt die Bundestagspräsidentin während einer besonders unübersichtlichen und kontrovers geführten Plenarsitzung?'
const LONG_ANSWERS = [
  'Sie achtet auf die Einhaltung der parlamentarischen Ordnung und leitet die Sitzung des Deutschen Bundestages.',
  'Sie entscheidet gemeinsam mit dem Bundesrat über die Tagesordnung der kommenden Sitzungswoche im Plenum.',
  'Sie vertritt den Deutschen Bundestag nach außen und führt die Geschäfte der Bundestagsverwaltung.',
  'Sie beruft die Ausschüsse ein und bestimmt die Reihenfolge der Redebeiträge aller Fraktionen.',
]

/**
 * Sample question per layout.
 *
 * `person` gets its own question complete with portrait: the layout
 * displays the image large and cannot be judged with a geography question.
 */
function sampleQuestion(type: QuestionPresentationType, longText: boolean) {
  if (type === 'person') {
    return {
      question: {
        id: 'person-1',
        prompt: longText ? LONG_PROMPT : 'Wer ist diese Politikerin?',
        presentationType: type,
        categoryLabel: 'Personen',
        imageUrl: previewPortrait,
      },
      answers: ['Bärbel Bas', 'Rita Süssmuth', 'Annemarie Renger', 'Hildegard Hamm-Brücher'],
    }
  }
  return {
    question: {
      id: 'frage-1',
      prompt: longText ? LONG_PROMPT : 'Welcher Fluss fließt durch Köln?',
      presentationType: type,
      categoryLabel: 'Erdkunde',
      ...(type === 'image-choice' ? { imageUrl: previewImage } : {}),
    },
    answers: ['Rhein', 'Elbe', 'Donau', 'Main'],
  }
}

function buildSampleView(input: {
  scene: PublicScene
  questionType: QuestionPresentationType | null
  themeId: string
  feedbackOutcome: 'correct' | 'incorrect'
  revealElapsedMs: number
  draw: boolean
  longText: boolean
  fiftyFifty: boolean
}): PublicQuizViewModel {
  // Fixed point in time for everything shown - screenshots must not depend on the clock.
  const serverTimeMs = 1_700_000_000_000
  const scores = [
    // Three-digit scores are the rule, not the exception.
    { playerId: 'player-1' as const, label: 'Spieler 1', score: 200, active: true, locked: false },
    {
      playerId: 'player-2' as const,
      label: 'Spieler 2',
      score: input.draw ? 200 : 150,
      active: false,
      locked: false,
    },
  ]
  const text = (short: string, index: number) => (input.longText ? (LONG_ANSWERS[index] ?? short) : short)

  const base: PublicQuizViewModel = {
    scene: input.scene,
    phase: 'question-presented',
    theme: {
      id: input.themeId,
      skin: SKINS[input.themeId] ?? 'default',
      startVisualUrl: previewStartVisual,
      startTitle: 'Bundestags-Quiz',
    },
    /*
     * Empty, and that is the point: the offering overview is the
     * application's business (the `quiz-live` stage client shows it before
     * the first game). This package's scenes don't know it, and this
     * preview checks the scenes.
     */
    quizOffers: [],
    playerScores: scores,
    progress: { current: 3, total: 7 },
    soundEnabled: false,
    serverTimeMs,
    locale: 'de-DE',
    revision: 42,
  }

  switch (input.scene) {
    case 'question': {
      const sample = sampleQuestion(input.questionType ?? 'image-choice', input.longText)
      return {
        ...base,
        question: sample.question,
        visibleOptions: [
          { id: 'o1', text: text(sample.answers[0]!, 0) },
          // Logged-in answer: marked as public, but without a score.
          { id: 'o2', text: text(sample.answers[1]!, 1), state: 'chosen' },
          /*
           * With 50:50: the joker took these two. They keep their place and
           * their letter - that's exactly what should be visible in the image.
           */
          { id: 'o3', text: text(sample.answers[2]!, 2), ...(input.fiftyFifty ? { eliminated: true } : {}) },
          // Second chance: this answer was already wrong and is used up.
          {
            id: 'o4',
            text: text(sample.answers[3]!, 3),
            state: 'chosen-incorrect',
            ...(input.fiftyFifty ? { eliminated: true } : {}),
          },
        ],
        /*
         * The draw itself belongs to the live quiz; the preview only shows
         * what's on the stage afterwards - an applied 50:50.
         */
        ...(input.fiftyFifty
          ? {
              jokerDraw: {
                phase: 'applied' as const,
                sequenceId: 'joker-preview',
                playerId: 'player-1' as const,
                startedAtServerMs: serverTimeMs,
                revealAtMs: 820,
                type: 'fiftyFifty' as const,
              },
            }
          : {}),
        currentPlayer: 'player-1',
      }
    }
    case 'reveal':
      return {
        ...base,
        phase: 'reveal-running',
        question: {
          id: 'reveal-1',
          prompt: 'Welches Bauwerk ist hier zu sehen?',
          presentationType: 'image-reveal',
          imageUrl: previewImage,
          categoryLabel: 'Gebäude',
        },
        reveal: { status: 'paused', durationMs: gameTiming.imageRevealDurationMs, elapsedMs: input.revealElapsedMs },
      }
    case 'video':
      /*
       * There is exactly ONE state: the video area is present, a job is
       * queued. How far playback has progressed is as unknown to the preview
       * as to the server. The URL deliberately points nowhere - what's being
       * checked is the composition.
       */
      return {
        ...base,
        phase: 'video',
        question: {
          id: 'video-1',
          prompt: 'Videofrage',
          presentationType: 'video-then-question',
          videoUrl: '/media/beispielvideo',
        },
        video: { questionId: 'video-1', requestId: 'vorschau' },
      }
    case 'feedback':
      return {
        ...base,
        phase: 'attempt-feedback',
        feedback: {
          outcome: input.feedbackOutcome,
          playerId: 'player-1',
          awardedPoints: input.feedbackOutcome === 'correct' ? 100 : 0,
        },
      }
    case 'solution': {
      const sample = sampleQuestion(input.questionType ?? 'text-choice', input.longText)
      return {
        ...base,
        phase: 'solution',
        // Last question: also checks the 7/7 counter.
        progress: { current: 7, total: 7 },
        question: sample.question,
        visibleOptions: [
          { id: 'o1', text: text(sample.answers[0]!, 0), state: 'correct' },
          { id: 'o2', text: text(sample.answers[1]!, 1), state: 'chosen-incorrect' },
          { id: 'o3', text: text(sample.answers[2]!, 2) },
          { id: 'o4', text: text(sample.answers[3]!, 3) },
        ],
        visibleSolution: { answerText: sample.answers[0]! },
      }
    }
    case 'result':
      return {
        ...base,
        phase: 'result',
        result: {
          // The preview shows the duel's stage; the solo game has
          // its own results scene and no preview case.
          mode: 'duel',
          winnerPlayerId: input.draw ? null : 'player-1',
          isDraw: input.draw,
          scores,
        },
      }
    case 'pause':
      // The interstitial screen announces the number and category of the next question.
      return { ...base, phase: 'pause-screen', upcomingCategoryLabel: 'Erdkunde' }
    default:
      return { ...base, phase: 'idle', playerScores: [] }
  }
}
