/**
 * Fussleiste des Touchgeraets: die beiden Spielerecken und der Fragezaehler.
 *
 * Sie ersetzt am Geraet die Kopfzeile der Buehne. Der Grund ist die Koerperhaltung
 * und nicht die Gestaltung: Im Saal schaut man zum Beamer hinauf, am Tisch steht
 * man davor. Punktestand und Buzzer gehoeren dorthin, wo die Hand ist - unten,
 * in der Ecke des Spielers, dem sie gehoert.
 *
 *   [Spieler 1 | Punkte]     [Hinweis oder "Weiter"]     [Punkte | Spieler 2]
 *   [    BUZZERN     ]           [Frage 6/7]            [     BUZZERN     ]
 *
 * Ueber dem Zaehler liegt EIN Feld fuer beides: den kurzen Spielhinweis und den
 * Knopf, mit dem es weitergeht. Es hat eine feste Hoehe, damit der Wechsel
 * zwischen Satz und Knopf nichts darueber verschiebt - Frage und Antworten
 * duerfen nicht springen, waehrend jemand zielt.
 *
 * Punktekarte und Zaehler sind DIESELBEN Bauteile wie auf der Buehne. Sie tragen
 * hier nur die Farbe ihres Spielers; alles andere - Aufbau, Hochzaehlen,
 * gezeichnete Karte der Kinderwelt - kommt unveraendert von dort.
 */
import type { PlayerId, PlayerQuizViewModel } from '@quiz/contracts'
import { Counter } from '../presentation/stage/Counter.tsx'
import { Score } from '../presentation/stage/Score.tsx'
import { Buzzer } from './Buzzer.tsx'
import styles from './Game.module.css'

interface PlayerFootProps {
  view: PlayerQuizViewModel
  /** Wer den Zuschlag hat - `null`, solange niemand gedrueckt hat. */
  turn: PlayerId | null
  /** Darf dieser Spieler den Zuschlag ueberhaupt holen? */
  canBuzz(playerId: PlayerId): boolean
  onBuzz(playerId: PlayerId): void
  /** Naechste Frage anfordern - nur nach der Loesung moeglich. */
  onContinue(): void
}

/**
 * Der Satz, der gerade im Hinweisfeld steht.
 *
 * Es ist die einzige Stelle, an der das Geraet die Spieler anspricht, und sie
 * bleibt bewusst karg: In der zweiten Chance wechselt der Zug auf den anderen
 * Spieler, ohne dass er gebuzzert haette - das saehe er sonst nirgends.
 * Alles andere sagt der Bildschirm von selbst.
 */
function hinweis(view: PlayerQuizViewModel): string | null {
  if (view.phase !== 'second-chance') return null
  const gegner = view.playerScores.find((entry) => entry.playerId === view.currentPlayer)
  return gegner ? `${gegner.label}, du darfst es jetzt auch versuchen` : null
}

export function PlayerFoot({ view, turn, canBuzz, onBuzz, onContinue }: PlayerFootProps) {
  const [playerOne, playerTwo] = view.playerScores
  if (!playerOne) return null

  /*
   * Im Einzelspiel gibt es niemanden, gegen den man sich melden koennte: Die
   * Antworten sind offen, sobald der Server sie annimmt, und ein Knopf davor
   * waere reine Zeremonie.
   */
  const solo = view.playerScores.length < 2

  const ecke = (player: (typeof view.playerScores)[number], side: 'left' | 'right') => (
    <div className={styles.corner} data-corner={side}>
      <Score label={player.label} score={player.score} active={turn === player.playerId} mirrored={side === 'right'} />
      {!solo && (
        <Buzzer
          playerId={player.playerId}
          label={player.label}
          side={side}
          enabled={!turn && canBuzz(player.playerId)}
          armed={turn === player.playerId}
          onBuzz={onBuzz}
        />
      )}
    </div>
  )

  const text = hinweis(view)
  const weiter = view.allowedCommands.includes('CONTINUE')

  return (
    <div className={styles.foot} data-player-foot="">
      {ecke(playerOne, 'left')}

      <div className={styles.middle}>
        {/* Feste Hoehe, wechselnder Inhalt - siehe oben. */}
        <div className={styles.notice} data-notice="">
          {weiter ? (
            <button type="button" className={styles.continue} data-continue="" onClick={onContinue}>
              Weiter
            </button>
          ) : (
            text && <span className={styles.noticeText}>{text}</span>
          )}
        </div>
        {view.progress.total > 0 && <Counter current={view.progress.current} total={view.progress.total} />}
      </div>

      {playerTwo && ecke(playerTwo, 'right')}
    </div>
  )
}
