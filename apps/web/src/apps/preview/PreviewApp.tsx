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
import type { PublicQuizViewModel, PublicScene } from '@quiz/contracts'
import { gameTiming } from '@quiz/contracts'
import { StageScreen } from '../../presentation/StageScreen.tsx'
import { transitions } from '../../presentation/transitions/registry.ts'
import { prefersReducedMotion } from '../../presentation/animationPresets.ts'

const THEMES: Record<string, Record<string, string>> = {
  default: {
    background: '#0b1020',
    backgroundAccent: '#141d3a',
    surface: '#1b2545',
    text: '#f4f7ff',
    textMuted: '#a8b4d4',
    accent: '#ffc32b',
    accentText: '#221800',
    correct: '#37d67a',
    incorrect: '#ff5c5c',
    playerOne: '#4aa3ff',
    playerTwo: '#ff8a3d',
  },
  kids: {
    background: '#10233a',
    backgroundAccent: '#17466b',
    surface: '#1d5580',
    text: '#ffffff',
    textMuted: '#c8e6ff',
    accent: '#ffd93d',
    accentText: '#2a2000',
    correct: '#4ade80',
    incorrect: '#fb7185',
    playerOne: '#38bdf8',
    playerTwo: '#fb923c',
  },
  regional: {
    background: '#0d1b16',
    backgroundAccent: '#12332a',
    surface: '#1a4438',
    text: '#f2fbf7',
    textMuted: '#a6ccbd',
    accent: '#7bd88f',
    accentText: '#04200f',
    correct: '#37d67a',
    incorrect: '#ff6b6b',
    playerOne: '#5ad1c8',
    playerTwo: '#e8b84b',
  },
}

const SCENES: PublicScene[] = ['start', 'pause', 'question', 'reveal', 'video', 'feedback', 'solution', 'result']

export function PreviewApp() {
  const [scene, setScene] = useState<PublicScene>('question')
  const [themeId, setThemeId] = useState('default')
  const [feedbackOutcome, setFeedbackOutcome] = useState<'correct' | 'incorrect'>('correct')
  const [revealElapsedMs, setRevealElapsedMs] = useState(3_000)
  const [draw, setDraw] = useState(false)
  // Neu montieren, um denselben Uebergang erneut abzuspielen.
  const [runId, setRunId] = useState(0)

  const view = useMemo(
    () => buildSampleView({ scene, themeId, feedbackOutcome, revealElapsedMs, draw }),
    [scene, themeId, feedbackOutcome, revealElapsedMs, draw],
  )

  if (!import.meta.env.DEV) {
    return (
      <div className="preview preview--disabled">
        <p>Die Entwicklungsansicht ist nur im Entwicklungsmodus verfuegbar.</p>
      </div>
    )
  }

  return (
    <div className="preview">
      <aside className="preview__panel">
        <h1>Szenen- und Animationsvorschau</h1>
        <p className="preview__note">
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

        <button className="button button--primary" onClick={() => setRunId((value) => value + 1)}>
          Uebergang erneut abspielen
        </button>

        <p className="preview__reduced">
          Reduzierte Bewegung ist aktuell <strong>{prefersReducedMotion() ? 'aktiv' : 'inaktiv'}</strong>.
        </p>

        <h2>Registrierte Uebergaenge</h2>
        <ul className="preview__transitions">
          {transitions.map((definition) => (
            <li key={definition.id}>
              <code>{definition.id}</code>
              <span>
                {definition.appliesTo.from} → {definition.appliesTo.to} &middot; {definition.durationMs} ms
                {' / '}
                {definition.reducedMotionDurationMs} ms bei reduzierter Bewegung
              </span>
              <p>{definition.description}</p>
              {definition.locked && <p className="preview__locked">Feste Dauer: {definition.locked}</p>}
            </li>
          ))}
        </ul>
      </aside>

      <div className="preview__stage">
        <StageScreen key={runId} view={view} serverNow={() => view.serverTimeMs} isAudioMaster={false} />
      </div>
    </div>
  )
}

/**
 * Beispiel-View-Modelle. Sie haben denselben Aufbau wie die echten Snapshots des
 * Servers, damit die Vorschau nicht an einer eigenen Datenstruktur vorbeientwickelt.
 */
function buildSampleView(input: {
  scene: PublicScene
  themeId: string
  feedbackOutcome: 'correct' | 'incorrect'
  revealElapsedMs: number
  draw: boolean
}): PublicQuizViewModel {
  const serverTimeMs = 1_700_000_000_000
  const scores = [
    { playerId: 'player-1' as const, label: 'Spieler 1', score: 200, active: true, locked: false },
    { playerId: 'player-2' as const, label: 'Spieler 2', score: input.draw ? 200 : 150, active: false, locked: false },
  ]

  const base: PublicQuizViewModel = {
    scene: input.scene,
    phase: 'question-presented',
    theme: { id: input.themeId, colors: THEMES[input.themeId] ?? THEMES['default']! },
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
        question: { prompt: 'Welcher Fluss fliesst durch Koeln?', presentationType: 'text-choice' },
        visibleOptions: [
          { id: 'o1', text: 'Rhein' },
          { id: 'o2', text: 'Elbe' },
          { id: 'o3', text: 'Donau' },
          { id: 'o4', text: 'Main' },
        ],
        currentPlayer: 'player-1',
      }
    case 'reveal':
      return {
        ...base,
        phase: 'reveal-running',
        question: { prompt: 'Welches Bauwerk ist hier zu sehen?', presentationType: 'image-reveal', imageUrl: '/media/img-bauwerk-brandenburger-tor' },
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
        question: { prompt: 'Welcher Fluss fliesst durch Koeln?', presentationType: 'text-choice' },
        visibleOptions: [
          { id: 'o1', text: 'Rhein', state: 'correct' },
          { id: 'o2', text: 'Elbe', state: 'chosen-incorrect' },
          { id: 'o3', text: 'Donau' },
          { id: 'o4', text: 'Main' },
        ],
        visibleSolution: { answerText: 'Rhein', publicNote: 'Koeln liegt am Rhein.' },
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
      return { ...base, phase: 'pause-screen' }
    default:
      return { ...base, phase: 'idle', playerScores: [] }
  }
}
