/**
 * DIE FARBEN. Alle. An einer Stelle.
 *
 * Jeder Farbwert des Quiz-Systems steht in dieser Datei - die beiden
 * Gestaltungswelten, die helle Fassung der Erwachsenenbuehne, die wenigen
 * Farben, die keiner Welt gehoeren, und der Bedienrahmen des Operators.
 * Anderswo steht kein Farbwert mehr; `test/palette.test.ts` haelt das fest.
 *
 * Das Token-Vokabular (`designColorTokens`) definiert der Kern - hier stehen
 * die WERTE. So bleibt das Quizpaket frei von Darstellung, und trotzdem gibt
 * es genau eine Quelle je Farbe.
 */
import type { DesignColors, ThemeSkin } from '@hfroemmel/quiz-core'

/**
 * Kuehles, leicht blaeuliches System der Buehne der Erwachsenen.
 *
 * Die Flaechenfarben sind halbtransparent: Hinter der Szene liegt das unscharfe
 * Fragebild, und Kacheln, Buchstaben und Antwortleisten sollen es als Milchglas
 * durchscheinen lassen, statt es zuzudecken. Sie sind neutral und stammen aus
 * dem Buehnenentwurf; die Bedeutungsfarben dagegen aus dem Farbspektrum des
 * Bundes (Styleguide der Bundesregierung, dieselbe Farbwelt wie bundestag.de).
 *
 * Farbwelt des Kinderquiz: Papier, Tinte und die Signalfarben der Illustration.
 * Ihre Werte stammen aus `boxes.css` des Boxen-Assetpakets - die gezeichneten
 * Rahmen tragen dieselben Toene, deshalb duerfen sie nicht frei gewaehlt werden.
 */
export const stagePalettes: Record<ThemeSkin, DesignColors> = {
  default: {
    pageTop: '#12161A',
    pageBottom: '#171C21',
    stageTop: '#171C21',
    stageBottom: '#293139',
    controls: '#12161A',
    tile: 'rgba(255, 255, 255, 0.09)',
    tileDisabled: 'rgba(255, 255, 255, 0.05)',
    tileQuiet: 'rgba(255, 255, 255, 0.06)',
    option: 'rgba(255, 255, 255, 0.05)',
    /*
     * Bedeutungsfarben aus dem Farbspektrum des Bundes.
     *
     * Ausgewaehlt wurde je Token der Ton mit dem kleinsten Abstand zur zuvor
     * gesetzten Farbe (CIELAB) - die Buehne behaelt ihr Bild, traegt aber
     * amtliche Werte. Die Prozentzahl ist die Abstufung des Styleguides; sie
     * entsteht durch proportionales Aufhellen mit Weiss bzw. Abdunkeln mit
     * Schwarz und ist selbst Teil der Vorgabe.
     *
     * Auf dunklem Grund tragen die Aufhellungen: Der reine Ton saeuft im
     * Hintergrund ab. Die helle Fassung nimmt dieselben Farben bei 100 Prozent.
     */
    accent: '#3392C5', // Blau 80 %
    accentQuiet: '#005A76', // Petrol, 80 % abgedunkelt
    primary: '#339D6E', // Gruen 80 %
    solution: '#339D6E', // Gruen 80 %
    /*
     * Derselbe Ton wie die Leiste: Buchstabe und Antwort sind EINE Flaeche, die
     * nur eine Fuge teilt. Zwei Gruens nebeneinander lasen sich wie zwei
     * Aussagen - der dunklere Chip wirkte wie ein zweiter Zustand.
     */
    solutionChip: '#339D6E', // Gruen 80 %
    correct: '#339AA2', // Tuerkis 80 %
    incorrect: '#9A0030', // Rot, 80 % abgedunkelt
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.6)',
  },
  kids: {
    pageTop: '#A9D5EF',
    pageBottom: '#D9D7F2',
    stageTop: '#A9D5EF',
    stageBottom: '#D9D7F2',
    controls: '#F4EBD8',
    tile: '#F4EBD8',
    tileDisabled: '#EADDC2',
    tileQuiet: '#EADDC2',
    option: '#F4EBD8',
    accent: '#D61E1E',
    accentQuiet: '#D98B93',
    primary: '#D61E1E',
    solution: '#6FBE6B',
    solutionChip: '#F9CD36',
    correct: '#6FBE6B',
    incorrect: '#D98B93',
    text: '#0E090C',
    textMuted: 'rgba(14, 9, 12, 0.6)',
  },
}

/**
 * Helle Fassung der Erwachsenenbuehne - der Umschalter im Kopf der Buehne.
 *
 * Der Bauplan spiegelt die dunkle Fassung: Wo dort weisse Schleier auf Dunkel
 * liegen, liegen hier dunkle Schleier auf Papier.
 *
 * Sie nennt auch die Bedeutungsfarben, und zwar dieselben CI-Farben wie oben,
 * nur bei voller Saettigung: Eine Aufhellung, die auf Dunkel leuchtet,
 * verschwindet auf Papier. Das ist zugleich eine Festlegung - ein Modus mit
 * eigenem Akzent zeigt ihn in der hellen Fassung nicht mehr. Beide Modi der
 * Buehne benutzen heute dasselbe Theme; sollte je ein Modus eine eigene
 * Farbwelt bekommen, gehoert die helle Fassung in sein Theme.
 */
export const brightPalette: Partial<DesignColors> = {
  pageTop: '#fff',
  pageBottom: '#f6f6f6',
  stageTop: '#fff',
  stageBottom: '#ebebeb',
  controls: '#eeeeee',
  /* Keine Bedeutung, sondern Zuruecknahme: der gesperrte Spieler auf Papier. */
  accentQuiet: '#dcdcdc',
  /* Milchglas bleibt Milchglas - nur aus Tinte statt aus Licht. */
  tile: 'rgba(25, 25, 25, 0.06)',
  tileDisabled: 'rgba(25, 25, 25, 0.04)',
  tileQuiet: 'rgba(25, 25, 25, 0.05)',
  option: 'rgba(25, 25, 25, 0.05)',
  accent: '#0077B6', // Blau 100 %
  primary: '#00854A', // Gruen 100 %
  solution: '#00854A', // Gruen 100 %
  solutionChip: '#00854A', // Gruen 100 %, siehe oben
  correct: '#00818B', // Tuerkis 100 %
  incorrect: '#780F2D', // Dunkelrot 100 %
  text: 'rgb(25, 25, 25)',
  textMuted: 'rgba(25, 25, 25, 0.6)',
}

/**
 * Farben der Buehne, die keinem Theme gehoeren.
 *
 * Sie beschreiben kein Thema, sondern eine physikalische Lage: Schrift, die auf
 * einer kraeftigen Flaeche steht, und eine Kante, die ein Bild vom Grund
 * abtrennt. Sie bleiben in jedem Modus gleich und stehen deshalb nicht im
 * Tokensatz des Quizpakets.
 */
export const stageExtras = {
  /** Schrift auf Akzent-, Loesungs- oder Spielerfarbe - dort immer hell. */
  inkOnStrong: '#ffffff',
  /** Haarfeine Kante am Portraet, damit es sich vom Grund abhebt. */
  edge: 'rgb(255 255 255 / 0.22)',
  /**
   * Kontur um helle Schrift, die auf unruhigem Grund steht.
   *
   * In der Kinderwelt liegen Punktestand und Countdown ueber einer Zeichnung
   * mit hellen und dunklen Stellen. Eine Schrift ohne Kontur wuerde dort
   * stellenweise verschwinden - im Saal aus zwanzig Metern zuerst.
   */
  inkOutline: '#000000',
  /**
   * Die beiden Spielerfarben des Touchgeraets.
   *
   * Sie gehoeren KEINEM Modus: Rot links, Blau rechts ist die aelteste Art,
   * zwei Seiten auseinanderzuhalten, und muss in jeder Farbwelt dieselbe
   * bleiben. Wechselte sie mit dem Modus, gehoerte die eigene Ecke am Geraet
   * ploetzlich einer anderen Farbe - und genau daran orientiert sich, wer
   * gleich auf seinen Buzzer schlaegt.
   *
   * Aus diesen beiden Werten leitet sich alles Weitere im Stylesheet ab: Der
   * dunkle Grund des Buzzers ist derselbe Ton, in den Buehnengrund gemischt.
   * Deshalb steht hier je Spieler genau EINE Farbe.
   */
  playerOne: '#b03a3a',
  playerTwo: '#3742a8',
} as const

/* ------------------------------------------------------------------ *
 * Bedienrahmen von Operator und Moderator
 * ------------------------------------------------------------------ */

/**
 * BEWUSST GETRENNT vom Farbsystem der Buehne. Die achtzehn Themetoken gehoeren
 * dem Quizmodus: Wechselt der Modus, wechselt der Saal die Farbe. Die
 * Bedienoberflaeche tut das NICHT - sie bleibt in jedem Modus dieselbe dunkle
 * Flaeche, damit der Operator seine Tasten blind findet und die Buehnenvorschau
 * als einziges helles Feld heraussticht.
 */
export const uiPalette = {
  page: '#0d0f13',
  /* Karten und Leisten: Bedienleiste, privater Bereich, Popups, Startpanel. */
  surface: '#171b21',
  /* Kopf- und Fusszeile - eine Spur unter den Karten, damit sie zurueckstehen. */
  'surface-quiet': '#12151a',
  /* Aufgehellte Flaeche INNERHALB einer Karte - etwa die Notizspalte. */
  'surface-raised': 'rgba(255, 255, 255, 0.06)',
  control: '#242a33',
  'control-disabled': '#1a1e24',
  input: 'rgb(0 0 0 / 0.35)',
  border: 'rgb(255 255 255 / 0.1)',
  /* Trennlinie innerhalb einer Karte - schwaecher als die Aussenkante. */
  'border-quiet': 'rgb(255 255 255 / 0.12)',
  /* Kante eines Feldes, das sich absetzen soll - die Buehnenvorschau. */
  'border-strong': 'rgba(255, 255, 255, 0.24)',
  /* Flaeche hinter einem Popup und Grund der Vorschaukachel. */
  scrim: 'rgb(0 0 0 / 0.55)',
  'scrim-quiet': 'rgb(0 0 0 / 0.3)',
  text: '#ffffff',
  'text-muted': 'rgb(255 255 255 / 0.5)',
  accent: '#36b35e',
  correct: '#36b35e',
  incorrect: '#a62749',
  /* Hinterlegte Meldungen: nur ein Hauch Farbe, die Schrift traegt die Aussage. */
  'warning-soft': 'rgba(255, 195, 43, 0.16)',
  'error-soft': 'rgba(255, 92, 92, 0.16)',
} as const

/* ------------------------------------------------------------------ *
 * Startbildschirm des Geraets
 * ------------------------------------------------------------------ */

/**
 * Die Farbwelt der Startauswahl - eine eigene, und mit Absicht.
 *
 * WARUM NICHT DER BEDIENRAHMEN darueber: Der ist ein Werkzeug. Er steht am Pult
 * des Operators, wird stundenlang angesehen und soll nichts wollen. Der
 * Startbildschirm ist das Gegenteil - er ist das Erste, was jemand im Foyer
 * sieht, und muss einladen. Er kommt aus einem eigenen Entwurf
 * (`Quiz_Standalone_Startmenu_SVG_Assets`), und seine Werte stehen deshalb hier
 * als eigener Satz, statt die Bedientoken umzufaerben.
 *
 * WARUM NICHT DIE BUEHNE: Die gehoert dem Quizmodus und wechselt mit ihm - die
 * Kinderwelt ist Papier, die Erwachsenenwelt kuehles Blau. Der Startbildschirm
 * steht VOR dieser Wahl und kann keine Farbe tragen, die erst danach feststeht.
 *
 * DIE DREI SIGNALFARBEN - Gruen, Limone, Violett - stufen die Schwierigkeit ab.
 * Sie sind Reihenfolge und nicht Bedeutung: kein "richtig", kein "falsch".
 */
export const startPalette = {
  /* Grund: ein Verlauf ueber die Diagonale, dazu zwei farbige Lichter. */
  'bg-top': '#111b25',
  'bg-mid': '#0a1118',
  'bg-bottom': '#070c11',
  'ambient-green': '#2bbe65',
  'ambient-violet': '#726bea',

  /* Karten und Kanten der rechten Spalte. */
  surface: '#17212d',
  'surface-quiet': '#111a24',
  /* Eine gewaehlte Karte: derselbe Kasten, nur ins Gruene gekippt. */
  'surface-selected': '#1a2b29',
  line: '#263442',
  'line-strong': '#2b3948',

  text: '#f5f7f9',
  'text-muted': '#98a7b7',
  /* Die Fussnote unter der Startschaltflaeche - leiser als alles andere. */
  'text-quiet': '#6f7f8e',

  green: '#42d176',
  'green-bright': '#63df8e',
  'green-light': '#46d77a',
  'green-deep': '#28b962',
  /* Kante auf der Startschaltflaeche, damit ihr Verlauf nicht ausfranst. */
  'green-edge': '#9cf0b8',
  /* Schrift und Zeichen AUF dem Gruen - dort ist alles Helle unlesbar. */
  'ink-on-green': '#06140c',
  lime: '#d9e93e',
  violet: '#8d86ff',

  /* Die Markentafel links: waermeres Gruen als die Bedienspalte rechts. */
  'brand-top': '#1d2b27',
  'brand-mid': '#173828',
  'brand-bottom': '#205d34',
  'brand-line': '#34483e',
  'brand-text': '#bed0c7',
  /* Schatten und Chipgrund INNERHALB der Tafel - dunkler als ihr Verlauf. */
  'brand-shade': '#07100d',

  /* Zeichen einer nicht gewaehlten Karte und der Eckknoepfe. */
  icon: '#a9b6c4',
  /* Aufhellung als Milchglas - der Ton, aus dem alle Schleier gemischt werden. */
  glass: '#ffffff',
  /* Abdunklung - Schatten unter den Tafeln. */
  shade: '#000000',
} as const

/**
 * Farben eines Themes vervollstaendigen.
 *
 * Ein Gastgeber-Theme nennt nur, was von seiner Gestaltungswelt abweicht; erst
 * hier entsteht der vollstaendige Satz fuer die Buehne.
 */
export function resolveThemeColors(theme: {
  skin?: ThemeSkin | undefined
  colors?: Record<string, string> | undefined
}): DesignColors {
  return { ...stagePalettes[theme.skin ?? 'default'], ...theme.colors }
}
