/**
 * DIE FARBEN. Alle. An einer Stelle.
 *
 * Jeder Farbwert der Anwendung steht in dieser Datei - die beiden
 * Gestaltungswelten, die helle Fassung der Erwachsenenbuehne, die wenigen
 * Farben, die keiner Welt gehoeren, und der Bedienrahmen des Operators.
 * Anderswo steht kein Farbwert mehr; ein Test in `apps/web/test` haelt das fest.
 *
 * WARUM SO STRENG: Die Werte werden an drei voellig verschiedenen Orten
 * gebraucht - im Quizpaket (`content/dist/config.json`, das der Server je Modus
 * ausliefert), in der serverlosen Entwicklungsvorschau und als Rueckfallebene im
 * Stylesheet, bevor der erste Snapshot da ist. Solange jeder Ort seine eigene
 * Abschrift fuehrte, liefen sie auseinander, ohne dass es jemandem auffiel: Eine
 * geerbte Inline-Variable schlaegt eine `:root`-Regel, also gewann stillschweigend
 * das Quizpaket, und Aenderungen am Stylesheet blieben wirkungslos.
 *
 * WER LIEST WAS:
 *   `packages/content`   setzt die Farben beim Bauen in das Quizpaket ein
 *   `apps/web/src/theme` schreibt sie als Custom-Properties in ein Stylesheet
 *
 * Ein Theme in `config.json` kann einzelne Werte ueberschreiben (Feld `colors`);
 * es erbt alles, was es nicht nennt, von seiner Gestaltungswelt. Ein neuer Modus
 * mit eigener Farbwelt braucht deshalb weiterhin keine Codeaenderung.
 */
import type { ThemeSkin } from './content.ts'

export const designColorTokens = [
  /* Grundflaechen */
  'pageTop',
  'pageBottom',
  'stageTop',
  'stageBottom',
  'controls',
  /* Kacheln und Schaltflaechen */
  'tile',
  'tileDisabled',
  'tileQuiet',
  'option',
  /* Bedeutungsfarben */
  'accent',
  'accentQuiet',
  'primary',
  'solution',
  'solutionChip',
  'correct',
  'incorrect',
  /* Schrift */
  'text',
  'textMuted',
] as const

export type DesignColorToken = (typeof designColorTokens)[number]

/** Vollstaendiger Tokensatz eines Themes. */
export type DesignColors = Record<DesignColorToken, string>

export function missingColorTokens(colors: Record<string, string>): DesignColorToken[] {
  return designColorTokens.filter((token) => !colors[token])
}

/* ------------------------------------------------------------------ *
 * Die Gestaltungswelten
 * ------------------------------------------------------------------ */

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
    solutionChip: '#337D6A', // Dunkelgruen 80 %
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
  solutionChip: '#005C45', // Dunkelgruen 100 %
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

/**
 * Farben eines Themes vervollstaendigen.
 *
 * Ein Theme nennt nur, was von seiner Gestaltungswelt abweicht. Erst hier
 * entsteht der vollstaendige Satz, den das Quizpaket ausliefert und den die
 * Validierung prueft.
 */
export function resolveThemeColors(theme: {
  skin?: ThemeSkin | undefined
  colors?: Record<string, string> | undefined
}): DesignColors {
  return { ...stagePalettes[theme.skin ?? 'default'], ...theme.colors }
}
