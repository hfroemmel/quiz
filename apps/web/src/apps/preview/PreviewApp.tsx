/**
 * Entwicklungsansicht fuer Szenen und Uebergaenge (Spezifikation 22.6).
 *
 * Zweck: Szenen und Animationen isoliert starten, wiederholen und mit verschiedenen
 * Themes pruefen - ohne ein vollstaendiges Quiz und ohne laufenden Server.
 *
 * Diese Route greift NICHT in den Produktionsworkflow ein:
 *  - sie baut keine WebSocket-Verbindung auf;
 *  - sie sendet keine Befehle;
 *  - sie verwendet ausschliesslich lokal erzeugte Beispiel-View-Modelle;
 *  - im Produktionsbuild ist sie ueber `import.meta.env.DEV` gesperrt.
 */
import { useMemo, useState } from 'react'
import { kidsDesignColors, stageDesignColors } from '../../theme/designTokens.ts'
import type { PublicQuizViewModel, PublicScene, ThemeSkin } from '@quiz/contracts'
import { gameTiming } from '@quiz/contracts'
import { StageScreen, themeVariables } from '../../presentation/StageScreen.tsx'
import { transitions } from '../../presentation/transitions/registry.ts'
import { prefersReducedMotion } from '../../presentation/animationPresets.ts'
import styles from './PreviewApp.module.css'

/**
 * Themes der Vorschau - dieselben Werte wie im Quizpaket.
 *
 * Es gibt genau zwei Gestaltungswelten: die Buehne der Erwachsenen und die
 * illustrierte Kinderwelt. Der Modus Saarbruecken benutzt das Theme der
 * Erwachsenen und taucht hier deshalb nicht eigens auf.
 */
const THEMES: Record<string, Record<string, string>> = {
  default: stageDesignColors,
  kids: kidsDesignColors,
}

/** Gestaltungswelt je Theme - wie im Quizpaket. */
const SKINS: Record<string, ThemeSkin> = { default: 'default', kids: 'kids' }

const SCENES: PublicScene[] = ['start', 'pause', 'question', 'reveal', 'video', 'feedback', 'solution', 'result']

export function PreviewApp() {
  const [scene, setScene] = useState<PublicScene>('question')
  const [themeId, setThemeId] = useState('default')
  const [feedbackOutcome, setFeedbackOutcome] = useState<'correct' | 'incorrect'>('correct')
  const [revealElapsedMs, setRevealElapsedMs] = useState(3_000)
  const [draw, setDraw] = useState(false)
  /*
   * Belastungsprobe der Textflaechen. Die Vorgabe des Kinderquiz-Assetpakets
   * verlangt vier Fragezeilen und zweizeilige Antworten ohne Abschneiden; mit
   * diesem Schalter laesst sich das in jeder Szene und jedem Theme pruefen.
   */
  const [longText, setLongText] = useState(false)
  // Neu montieren, um denselben Uebergang erneut abzuspielen.
  const [runId, setRunId] = useState(0)

  const view = useMemo(
    () => buildSampleView({ scene, themeId, feedbackOutcome, revealElapsedMs, draw, longText }),
    [scene, themeId, feedbackOutcome, revealElapsedMs, draw, longText],
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
            {Object.keys(THEMES).map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>

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

        <label className="field field--checkbox">
          <input type="checkbox" checked={longText} onChange={(event) => setLongText(event.target.checked)} />
          <span>Lange Texte (vierzeilige Frage, zweizeilige Antworten)</span>
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

      <div className={styles.stage} data-preview-stage="" style={themeVariables(view)}>
        <StageScreen key={runId} view={view} serverNow={() => view.serverTimeMs} isAudioMaster={false} />
      </div>
    </div>
  )
}

/**
 * Platzhalterbild der Vorschau.
 *
 * Die Vorschau laeuft ohne Server und darf deshalb keine Medienadresse des
 * Servers benutzen. Das Bild steckt als Daten-URI direkt im Modul.
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

/** Startbild der Vorschau - ebenfalls ohne Serveradresse. */
const previewStartVisual =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="400" height="320">
      <circle cx="200" cy="130" r="96" fill="rgba(255,255,255,0.08)"/>
      <text x="200" y="190" font-size="150" font-family="Georgia, serif" fill="#FFFFFF" text-anchor="middle">?</text>
    </svg>`,
  )

/**
 * Beispiel-View-Modelle. Sie haben denselben Aufbau wie die echten Snapshots des
 * Servers, damit die Vorschau nicht an einer eigenen Datenstruktur vorbeientwickelt.
 */
/** Testtexte aus `ASSET_INTEGRATION.md`, Abschnitt 8. */
const LONG_PROMPT =
  'Welche Aufgabe übernimmt die Bundestagspräsidentin während einer besonders unübersichtlichen und kontrovers geführten Plenarsitzung?'
const LONG_ANSWERS = [
  'Sie achtet auf die Einhaltung der parlamentarischen Ordnung und leitet die Sitzung des Deutschen Bundestages.',
  'Sie entscheidet gemeinsam mit dem Bundesrat über die Tagesordnung der kommenden Sitzungswoche im Plenum.',
  'Sie vertritt den Deutschen Bundestag nach außen und führt die Geschäfte der Bundestagsverwaltung.',
  'Sie beruft die Ausschüsse ein und bestimmt die Reihenfolge der Redebeiträge aller Fraktionen.',
]

function buildSampleView(input: {
  scene: PublicScene
  themeId: string
  feedbackOutcome: 'correct' | 'incorrect'
  revealElapsedMs: number
  draw: boolean
  longText: boolean
}): PublicQuizViewModel {
  const serverTimeMs = 1_700_000_000_000
  const scores = [
    // Dreistellige Punktestaende sind der Regelfall, nicht die Ausnahme.
    { playerId: 'player-1' as const, label: 'Spieler 1', score: 200, active: true, locked: false },
    { playerId: 'player-2' as const, label: 'Spieler 2', score: input.draw ? 200 : 150, active: false, locked: false },
  ]
  const text = (short: string, index: number) => (input.longText ? (LONG_ANSWERS[index] ?? short) : short)

  const base: PublicQuizViewModel = {
    scene: input.scene,
    phase: 'question-presented',
    theme: {
      id: input.themeId,
      skin: SKINS[input.themeId] ?? 'default',
      colors: THEMES[input.themeId] ?? THEMES['default']!,
      startVisualUrl: previewStartVisual,
      startTitle: 'Bundestags-Quiz',
    },
    playerScores: scores,
    progress: { current: 3, total: 7 },
    soundEnabled: false,
    serverTimeMs,
    revision: 42,
  }

  switch (input.scene) {
    case 'question':
      return {
        ...base,
        question: {
          prompt: input.longText ? LONG_PROMPT : 'Welcher Fluss fließt durch Köln?',
          presentationType: 'image-choice',
          categoryLabel: 'Erdkunde',
          imageUrl: previewImage,
        },
        visibleOptions: [
          { id: 'o1', text: text('Rhein', 0) },
          // Eingeloggte Antwort: oeffentlich markiert, aber ohne Bewertung.
          { id: 'o2', text: text('Elbe', 1), state: 'chosen' },
          { id: 'o3', text: text('Donau', 2) },
          // Zweite Chance: diese Antwort war schon falsch und ist verbraucht.
          { id: 'o4', text: text('Main', 3), state: 'chosen-incorrect' },
        ],
        currentPlayer: 'player-1',
      }
    case 'reveal':
      return {
        ...base,
        phase: 'reveal-running',
        question: {
          prompt: 'Welches Bauwerk ist hier zu sehen?',
          presentationType: 'image-reveal',
          imageUrl: previewImage,
          categoryLabel: 'Gebäude',
        },
        reveal: { status: 'paused', durationMs: gameTiming.imageRevealDurationMs, elapsedMs: input.revealElapsedMs },
      }
    case 'video':
      return {
        ...base,
        phase: 'video-ready',
        question: { prompt: 'Videofrage', presentationType: 'video-then-question' },
        video: { status: 'idle', positionMs: 0, hasError: false },
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
    case 'solution':
      return {
        ...base,
        phase: 'solution',
        // Letzte Frage: prueft zugleich den Zaehler 7/7.
        progress: { current: 7, total: 7 },
        question: {
          prompt: input.longText ? LONG_PROMPT : 'Welcher Fluss fließt durch Köln?',
          presentationType: 'text-choice',
          categoryLabel: 'Erdkunde',
        },
        visibleOptions: [
          { id: 'o1', text: text('Rhein', 0), state: 'correct' },
          { id: 'o2', text: text('Elbe', 1), state: 'chosen-incorrect' },
          { id: 'o3', text: text('Donau', 2) },
          { id: 'o4', text: text('Main', 3) },
        ],
        visibleSolution: { answerText: 'Rhein' },
      }
    case 'result':
      return {
        ...base,
        phase: 'result',
        result: {
          winnerPlayerId: input.draw ? null : 'player-1',
          isDraw: input.draw,
          scores,
        },
      }
    case 'pause':
      // Der Zwischenscreen kuendigt Nummer und Rubrik der naechsten Frage an.
      return { ...base, phase: 'pause-screen', upcomingCategoryLabel: 'Erdkunde' }
    default:
      return { ...base, phase: 'idle', playerScores: [] }
  }
}
