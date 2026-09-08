/**
 * Die Beschriftungen der Oberflaeche - deutsch im Code, uebersetzbar im Inhalt.
 *
 * WARUM BEIDES: Die deutschen Fassungen stehen hier, weil ein Quiz ohne einen
 * einzigen Eintrag in der Konfiguration laufen muss - ein leerer Bildschirm mit
 * Schluesselnamen darauf waere die schlechtere Vorgabe. Uebersetzt wird im
 * Inhalt (`interfaceStrings` in der Konfiguration), weil eine neue Sprache dann
 * keine neue Programmfassung braucht.
 *
 * WAS HIER NICHT HINEINGEHOERT: alles, was aus dem Inhalt kommt - Fragetexte,
 * Antworten, Rubriken, Namen der Zielgruppen und Schwierigkeitsstufen. Die
 * traegt die Projektion bereits uebersetzt heran. Hier stehen nur die Woerter,
 * die das Programm selbst spricht.
 *
 * DIE SCHLUESSEL SIND VERTRAG. Wer einen umbenennt, macht die Uebersetzungen
 * eines Bestandes still unwirksam; wer einen ergaenzt, ergaenzt eine deutsche
 * Fassung gleich mit.
 */
import type { PublicQuizViewModel } from '@hfroemmel/quiz-core'

export const standardTexte = {
  /* Buehne */
  'stage.player': 'Spieler',
  'stage.points': 'Punkte',
  'stage.question': 'Frage',
  'stage.questionOf': 'Frage {current} von {total}',
  'feedback.correct': 'Richtig!',
  'feedback.incorrect': 'Falsch!',
  'result.winner': 'Gewinner',
  'result.draw': 'Unentschieden',
  'result.drawHeadline': 'Unentschieden!',
  'result.winnerHeadline': '{player} hat gewonnen!',
  'result.solo': 'Ergebnis',
  'result.soloHeadline': '{correct} von {total} richtig',
  'video.missing': 'Kein Video hinterlegt.',
  'video.error': 'Video nicht verfügbar.',
  'video.remaining': 'bis zur Frage',
  'video.paused': 'verbleibend - angehalten',
  'video.unknownDuration': 'gelaufen - Laufzeit noch nicht gemeldet',

  /* Geraet: Startauswahl */
  'kiosk.playerCount': 'Wie viele spielen?',
  'kiosk.difficulty': 'Wie schwer?',
  'kiosk.solo': 'Allein',
  'kiosk.duo': 'Zu zweit',
  'kiosk.questionCount': '{count} Fragen',
  'kiosk.start': "Los geht's",
  'kiosk.back': 'Zurück',
  'kiosk.preparing': 'Das Quiz wird vorbereitet...',
  'kiosk.disconnected': 'Keine Verbindung zum Quiz.',

  /* Geraet: Einstellungen */
  'kiosk.settings': 'Einstellungen',
  'kiosk.sound': 'Ton',
  'kiosk.on': 'An',
  'kiosk.off': 'Aus',
  'kiosk.soundTest': 'Tonprobe',
  'kiosk.playSound': 'Ton abspielen',
  'kiosk.size': 'Größe',
  'kiosk.language': 'Sprache',
  'kiosk.done': 'Fertig',

  /* Geraet: Spiel und Abschluss */
  'kiosk.endGame': 'Spiel beenden',
  'kiosk.endGameQuestion': 'Spiel wirklich beenden?',
  'kiosk.end': 'Beenden',
  'kiosk.keepPlaying': 'Weiterspielen',
  'kiosk.playAgain': 'Nochmal spielen',
  'kiosk.buzzer': 'Buzzern',
  'kiosk.submit': 'Antwort abgeben und auflösen',
  'kiosk.secondChance': '{player}, du darfst es jetzt auch versuchen',
  'kiosk.continue': 'Weiter',
} as const

export type TextKey = keyof typeof standardTexte

/**
 * Nachschlagen: erst im Inhalt, dann in den deutschen Vorgaben.
 *
 * `{name}` in einem Text wird durch den gleichnamigen Wert ersetzt. Das ist
 * bewusst die einzige Formatierungsregel - Pluralformen und Zahlenformate
 * gehoeren, wenn sie je gebraucht werden, in `Intl` und nicht in eine
 * selbstgebaute Schablonensprache.
 */
export function textFuer(
  view: Pick<PublicQuizViewModel, 'texts'> | null | undefined,
  key: TextKey,
  werte?: Record<string, string | number>,
): string {
  const vorlage = view?.texts?.[key] ?? standardTexte[key]
  if (!werte) return vorlage
  return vorlage.replace(/\{(\w+)\}/g, (treffer, name: string) =>
    name in werte ? String(werte[name]) : treffer,
  )
}

/** Dieselbe Suche, an eine Ansicht gebunden - fuer Komponenten mit vielen Texten. */
export function texteFuer(view: Pick<PublicQuizViewModel, 'texts'> | null | undefined) {
  return (key: TextKey, werte?: Record<string, string | number>) => textFuer(view, key, werte)
}
