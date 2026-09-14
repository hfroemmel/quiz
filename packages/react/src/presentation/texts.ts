/**
 * The interface's labels - German in the code, translatable in the content.
 *
 * WHY BOTH: the German versions live here because a quiz has to run without a
 * single entry in the configuration - an empty screen with key names on it
 * would be the worse default. Translation happens in the content
 * (`interfaceStrings` in the configuration), because a new language then
 * needs no new program version.
 *
 * WHAT DOES NOT BELONG HERE: anything that comes from the content - question
 * texts, answers, categories, names of target audiences and difficulty
 * levels. The projection already delivers those translated. Only the words
 * the program itself speaks live here.
 *
 * THE KEYS ARE A CONTRACT. Whoever renames one silently disables an existing
 * set's translations; whoever adds one adds a German version for it right
 * away.
 */
import type { PublicQuizViewModel } from '@hfroemmel/quiz-core'

export const defaultTexts = {
  /* Buehne */
  'stage.player': 'Spieler',
  'stage.points': 'Punkte',
  'stage.question': 'Frage',
  /*
   * The joker card on the stage. The card itself carries no words, so these two
   * sentences exist for a screen reader alone - and for nobody in the hall,
   * which is why they name no variant: which joker it became is announced out
   * loud and stays legible at the operator's desk.
   */
  'stage.joker.available': '{player} hat noch einen Joker.',
  'stage.joker.used': '{player} hat den Joker eingesetzt.',
  /* The two outcomes of a draw - under the revealed card. */
  'stage.joker.fiftyFifty': '50:50-Joker',
  'stage.joker.audience': 'Publikumsjoker',
  /* Spoken as soon as the card is laid down. */
  'stage.joker.drawn': '{player} hat gezogen: {joker}',
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
  /*
   * The video's status - only in the operator preview. In the hall the
   * image sits at this spot instead.
   */

  /* Geraet: Startauswahl */
  'kiosk.setupTitle': 'Spiel starten',
  'kiosk.setupSubtitle': 'Wähle Modus und Schwierigkeit.',
  'kiosk.playerCount': 'Wie viele spielen?',
  'kiosk.difficulty': 'Wie schwer?',
  'kiosk.solo': 'Allein',
  'kiosk.duo': 'Zu zweit',
  /* The second line on the two mode cards - a word on what that means. */
  'kiosk.soloHint': 'Eine Person',
  'kiosk.duoHint': 'Buzzer-Duell',
  'kiosk.questionCount': '{count} Fragen',
  /*
   * Footnote under the start button.
   *
   * It deliberately does NOT say "changeable at any time": while playing,
   * there is no menu in which mode or difficulty could be adjusted - that
   * would be a promise the device does not keep.
   */
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

  /* Device: game and finish */
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

export type TextKey = keyof typeof defaultTexts

/**
 * Lookup: first in the content, then in the German defaults.
 *
 * `{name}` in a text is replaced by the value of the same name. That is
 * deliberately the only formatting rule - plural forms and number formats,
 * if they are ever needed, belong in `Intl` and not in a home-grown
 * templating language.
 */
export function textFor(
  view: Pick<PublicQuizViewModel, 'texts'> | null | undefined,
  key: TextKey,
  values?: Record<string, string | number>,
): string {
  const template = view?.texts?.[key] ?? defaultTexts[key]
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}

/** The same lookup, bound to one view - for components with many texts. */
export function textsFor(view: Pick<PublicQuizViewModel, 'texts'> | null | undefined) {
  return (key: TextKey, values?: Record<string, string | number>) => textFor(view, key, values)
}

/* Former names, kept for one release so that hosts can migrate. */
/** @deprecated Renamed to `defaultTexts`. */
export const standardTexte = defaultTexts
/** @deprecated Renamed to `textFor`. */
export const textFuer = textFor
/** @deprecated Renamed to `textsFor`. */
export const texteFuer = textsFor
