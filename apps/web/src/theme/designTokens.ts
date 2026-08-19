/**
 * Farbsysteme der Buehne als getippte Tokenwerte.
 *
 * WOFUER: Die verbindlichen Werte stehen im Quizpaket (`config.json`) und kommen
 * zur Laufzeit ueber das View-Modell. Diese Datei ist der Stand fuer alles, was
 * ohne Server laeuft: die Entwicklungsvorschau und die Fallbackwerte in
 * `styles.css`. Beide Saetze muessen mit `content/source/config.json`
 * uebereinstimmen.
 *
 * Der Typ `DesignColors` stammt aus `@quiz/contracts`. Fehlt ein Token, ist das
 * ein Typfehler - dieselbe Liste prueft die Inhaltsvalidierung am Quizpaket.
 */
import type { DesignColors } from '@quiz/contracts'

/**
 * Kuehles, leicht blaeuliches System der Modi Erwachsene und Saarbruecken.
 *
 * Die Flaechenfarben sind halbtransparent: Hinter der Szene liegt das unscharfe
 * Fragebild, und Kacheln, Buchstaben und Antwortleisten sollen es als
 * Milchglas durchscheinen lassen, statt es zuzudecken.
 */
export const stageDesignColors: DesignColors = {
  pageTop: '#12161A',
  pageBottom: '#171C21',
  stageTop: '#171C21',
  stageBottom: '#293139',
  controls: '#12161A',
  tile: 'rgba(255, 255, 255, 0.09)',
  tileDisabled: 'rgba(255, 255, 255, 0.05)',
  tileQuiet: 'rgba(255, 255, 255, 0.06)',
  option: 'rgba(255, 255, 255, 0.05)',
  accent: '#1F87B5',
  accentQuiet: '#2B5C73',
  primary: '#00CC9C',
  solution: '#01A780',
  solutionChip: '#028365',
  correct: '#25A7B0',
  incorrect: '#A62749',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
}

/** Bisheriges Graustufensystem - traegt noch den Modus Kinder. */
export const greyDesignColors: DesignColors = {
  pageTop: '#555555',
  pageBottom: '#6E6E6E',
  stageTop: '#5C5C5C',
  stageBottom: '#757575',
  controls: '#555555',
  tile: '#444444',
  tileDisabled: '#4F4F4F',
  tileQuiet: '#464646',
  option: '#777777',
  accent: '#3693B3',
  accentQuiet: '#4E6A74',
  primary: '#00CC9C',
  solution: '#01A780',
  solutionChip: '#028365',
  correct: '#25A7B0',
  incorrect: '#A62749',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.45)',
}

/**
 * Serifenschrift des Entwurfs.
 *
 * Die gelieferten Schriftdateien werden spaeter ueber `@font-face` als erste
 * Familie ergaenzt; diese Kette bleibt als Rueckfallebene stehen.
 */
export const designFontStack =
  "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif"
