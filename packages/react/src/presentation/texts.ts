/**
 * The interface's labels - in the code, translatable in the content.
 *
 * WHY IN THE CODE AT ALL: a quiz has to run without a single entry in the
 * configuration; an empty screen with key names on it would be the worse
 * default. So the package speaks two languages itself - German and English -
 * and the content can override every single string (`interfaceStrings`),
 * because a third language then needs no new program version.
 *
 * WHY EXACTLY TWO: they are the two the applications are operated in. A
 * package that shipped German only forced every English-speaking host to state
 * EVERY visible string, and a set of fifty overrides in a build script is a
 * translation nobody reviews - the media table carried one.
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
  /* Stage */
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
  /* Device: start selection */
  'kiosk.setupTitle': 'Spiel starten',
  'kiosk.setupSubtitle': 'Wähle Modus und Schwierigkeit.',
  /*
   * The three step labels. They are not headlines on the screen but the names
   * of the three groups, which is what a screen reader announces before the
   * cards in them - and what a package renames when its step offers something
   * else (the media table calls the levels "rounds").
   */
  'kiosk.quizChoice': 'Welches Quiz?',
  'kiosk.playerCount': 'Wie viele spielen?',
  'kiosk.difficulty': 'Wie schwer?',
  'kiosk.solo': 'Allein spielen',
  'kiosk.duo': 'Zu zweit spielen',
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
  /*
   * Why an offer cannot be started right now. The reason comes from the
   * catalogue (`unavailableReason`), so the menu says it BEFORE the attempt
   * instead of letting somebody press a button that cannot work.
   */
  'start.rejected.no-questions': 'Für dieses Quiz sind noch keine Fragen hinterlegt.',
  'start.rejected.missing-pool': 'Dieses Quiz hat noch keinen Fragenpool.',
  'kiosk.preparing': 'Das Quiz wird vorbereitet...',
  'kiosk.disconnected': 'Keine Verbindung zum Quiz.',

  /* Device: settings */
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
  'kiosk.endRound': 'Runde beenden',
  'kiosk.endRoundQuestion': 'Diese Runde wirklich beenden?',
  'kiosk.end': 'Beenden',
  'kiosk.keepPlaying': 'Weiterspielen',
  'kiosk.playAgain': 'Nochmal spielen',
  'kiosk.buzzer': 'Buzzern',
  'kiosk.submit': 'Antwort abgeben',
  'kiosk.secondChance': '{player}, du darfst es jetzt auch versuchen',
  'kiosk.continue': 'Weiter',
  /*
   * The three sentences of the kiosk layout's hint field - the only place
   * where an unattended device addresses the people in front of it. They
   * follow the state of the question, one at a time: the call to buzz, the
   * call to the player who got it, and the reminder that a marked row is not
   * yet an answer (see `KioskFoot`).
   */
  'kiosk.hintBuzz': 'Wenn du die Antwort kennst, jetzt buzzern!',
  'kiosk.hintChoose': '{player}, bitte wähle eine Antwort.',
  'kiosk.hintSubmit': 'Sicher? Dann gib deine Antwort nun ab.',
} as const

export type TextKey = keyof typeof defaultTexts

/**
 * The same set in English.
 *
 * IT IS A TRANSLATION OF THIS PACKAGE'S VOICE, not of any host's: where an
 * application words a screen differently - the media table greets its players -
 * it says so in its content, in both languages, as before.
 *
 * Completeness is not a matter of care here but of the type: `Record<TextKey,
 * string>` refuses a missing key, and a test says the same thing for whoever
 * reads it rather than compiles it.
 */
export const englishTexts: Record<TextKey, string> = {
  /* Stage */
  'stage.player': 'Player',
  'stage.points': 'Points',
  'stage.question': 'Question',
  'stage.joker.available': '{player} still has a lifeline.',
  'stage.joker.used': '{player} has used the lifeline.',
  'stage.joker.fiftyFifty': '50:50 lifeline',
  'stage.joker.audience': 'Ask the audience',
  'stage.joker.drawn': '{player} drew: {joker}',
  'stage.questionOf': 'Question {current} of {total}',
  'feedback.correct': 'Correct!',
  'feedback.incorrect': 'Wrong!',
  'result.winner': 'Winner',
  'result.draw': 'Draw',
  'result.drawHeadline': 'A draw!',
  'result.winnerHeadline': '{player} wins!',
  'result.solo': 'Result',
  'result.soloHeadline': '{correct} out of {total} correct',

  /* Device: start selection */
  'kiosk.setupTitle': 'Start a game',
  'kiosk.setupSubtitle': 'Choose mode and difficulty.',
  'kiosk.quizChoice': 'Which quiz?',
  'kiosk.playerCount': 'How many are playing?',
  'kiosk.difficulty': 'How hard?',
  'kiosk.solo': 'Play alone',
  'kiosk.duo': 'Play in pairs',
  'kiosk.soloHint': 'One person',
  'kiosk.duoHint': 'Buzzer duel',
  'kiosk.questionCount': '{count} questions',
  'kiosk.start': "Let's go",
  'kiosk.back': 'Back',
  'start.rejected.no-questions': 'There are no questions for this quiz yet.',
  'start.rejected.missing-pool': 'This quiz has no question pool yet.',
  'kiosk.preparing': 'The quiz is getting ready...',
  'kiosk.disconnected': 'No connection to the quiz.',

  /* Device: settings */
  'kiosk.settings': 'Settings',
  'kiosk.sound': 'Sound',
  'kiosk.on': 'On',
  'kiosk.off': 'Off',
  'kiosk.soundTest': 'Sound check',
  'kiosk.playSound': 'Play a sound',
  'kiosk.size': 'Size',
  'kiosk.language': 'Language',
  'kiosk.done': 'Done',

  /* Device: game and finish */
  'kiosk.endRound': 'End round',
  'kiosk.endRoundQuestion': 'Really end this round?',
  'kiosk.end': 'End',
  'kiosk.keepPlaying': 'Keep playing',
  'kiosk.playAgain': 'Play again',
  'kiosk.buzzer': 'Buzz',
  'kiosk.submit': 'Submit answer',
  'kiosk.secondChance': '{player}, now you may try as well',
  'kiosk.continue': 'Next question',
  'kiosk.hintBuzz': 'If you know the answer, buzz now!',
  'kiosk.hintChoose': '{player}, please pick an answer.',
  'kiosk.hintSubmit': 'Sure? Then submit your answer.',
}

/**
 * Which set a locale reads, by its LANGUAGE.
 *
 * `en-GB` and `en-US` are the same words here; a region that needs its own
 * wording states it in the content, where a third language would live too.
 * Anything unknown falls back to German - the base language of the content
 * format, and the language the questions are written in.
 */
const setsByLanguage: Record<string, Record<TextKey, string>> = { en: englishTexts }

function defaultsFor(locale: string | undefined): Record<TextKey, string> | undefined {
  const language = locale?.split('-')[0]?.toLowerCase()
  return language ? setsByLanguage[language] : undefined
}

/**
 * Lookup: first in the content, then in the defaults of the view's language,
 * then in the German ones.
 *
 * THE CONTENT WINS in every case - it is the place a host words a screen its
 * own way, and the place a third language arrives without a new program
 * version.
 *
 * `{name}` in a text is replaced by the value of the same name. That is
 * deliberately the only formatting rule - plural forms and number formats,
 * if they are ever needed, belong in `Intl` and not in a home-grown
 * templating language.
 */
export function textFor(
  view: (Pick<PublicQuizViewModel, 'texts'> & Partial<Pick<PublicQuizViewModel, 'locale'>>) | null | undefined,
  key: TextKey,
  values?: Record<string, string | number>,
): string {
  const template = view?.texts?.[key] ?? defaultsFor(view?.locale)?.[key] ?? defaultTexts[key]
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}

/** The same lookup, bound to one view - for components with many texts. */
export function textsFor(
  view: (Pick<PublicQuizViewModel, 'texts'> & Partial<Pick<PublicQuizViewModel, 'locale'>>) | null | undefined,
) {
  return (key: TextKey, values?: Record<string, string | number>) => textFor(view, key, values)
}
