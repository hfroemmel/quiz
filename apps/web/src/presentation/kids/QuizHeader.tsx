/**
 * Kopfzeile der Kinderansicht: Wortmarke, beide Spielerkarten, Fragenzaehler.
 *
 * Aufbau nach Designreferenz:
 *
 *   [Adler] Deutscher Bundestag    [Spieler|1][Punkte|0] [Punkte|0][Spieler|2]    [Frage|1/7]
 *
 * GESPIEGELT WIRD DER INHALT, NICHT DIE GRAFIK: In beiden Kartenzeichnungen
 * liegt die farbige Haelfte links. Bei Spieler 1 steht dort die Spielernummer,
 * bei Spieler 2 der Punktestand - genau wie in der Referenz.
 */
import logoUrl from '../../assets/images/logo.svg'
import { kidsAssets } from './kidsAssets.ts'
import { KidsSurface } from './KidsSurface.tsx'
import type { PublicQuizViewModel, PublicScore } from '@quiz/contracts'

export function QuizHeader({ view }: { view: PublicQuizViewModel }) {
  const [playerOne, playerTwo] = view.playerScores
  const showsCounter = view.progress.total > 0

  return (
    <header className="kids-header">
      <BundestagBrand />

      <div className="kids-header__scores">
        {playerOne && <PlayerScoreCard score={playerOne} colour="blue" order="player-first" />}
        {playerTwo && <PlayerScoreCard score={playerTwo} colour="lavender" order="score-first" />}
      </div>

      {showsCounter && (
        <QuestionCounter
          current={Math.min(view.progress.current, view.progress.total)}
          total={view.progress.total}
        />
      )}
    </header>
  )
}

/** Wortmarke des Bundestages - das freigegebene Originalasset des Projekts. */
function BundestagBrand() {
  return (
    <div className="kids-brand">
      <img className="kids-brand__mark" src={logoUrl} alt="Deutscher Bundestag" />
    </div>
  )
}

/**
 * Eine Spielerkarte fuer BEIDE Spieler.
 *
 * `colour` waehlt die Zeichnung, `order` die Reihenfolge der beiden Zellen. Zwei
 * getrennte Komponenten wuerden mit der Zeit auseinanderlaufen.
 */
function PlayerScoreCard({
  score,
  colour,
  order,
}: {
  score: PublicScore
  colour: 'blue' | 'lavender'
  order: 'player-first' | 'score-first'
}) {
  // Die Spielernummer steht in der Beschriftung; die Buehne zeigt keine Eigennamen.
  const number = score.label.replace(/\D+/g, '') || (colour === 'blue' ? '1' : '2')
  const playerCell = (
    <div className="kids-score__cell kids-score__cell--player">
      <span className="kids-score__label">Spieler</span>
      <span className="kids-score__value">{number}</span>
    </div>
  )
  const pointsCell = (
    <div className="kids-score__cell kids-score__cell--points">
      <span className="kids-score__label">Punkte</span>
      <span className="kids-score__value kids-score__value--points">{score.score}</span>
    </div>
  )

  return (
    <KidsSurface
      image={kidsAssets.score[colour][score.active ? 'active' : 'idle']}
      className="kids-score"
      data-player={number}
      data-active={String(score.active)}
    >
      {order === 'player-first' ? playerCell : pointsCell}
      {order === 'player-first' ? pointsCell : playerCell}
    </KidsSurface>
  )
}

function QuestionCounter({ current, total }: { current: number; total: number }) {
  return (
    <KidsSurface image={kidsAssets.questionCounter} className="kids-counter">
      <span className="kids-counter__label">Frage</span>
      <span className="kids-counter__value">
        {current}/{total}
      </span>
    </KidsSurface>
  )
}
