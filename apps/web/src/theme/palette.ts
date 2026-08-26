/**
 * Die Farben der Palette als CSS-Regeln.
 *
 * HIER STEHT KEIN FARBWERT. Alle Werte kommen aus `@quiz/contracts` (`theme.ts`);
 * diese Datei uebersetzt sie nur in Text. Geschrieben wird daraus
 * `src/styles/palette.css` - siehe `pnpm palette:build`.
 *
 * WARUM ERZEUGT UND NICHT VON HAND: Dieselben Werte muessen auch in das
 * Quizpaket, das der Server je Modus ausliefert. Ein handgeschriebenes
 * Stylesheet waere zwangslaeufig eine zweite Abschrift - genau die Doppelung,
 * die frueher unbemerkt auseinanderlief.
 *
 * WARUM EINE DATEI UND KEIN STYLE-TAG ZUR LAUFZEIT: Der Grund der Buehne wird
 * aus `--color-pageTop` gemalt. Kaeme die Variable erst mit dem JavaScript, gaebe
 * es davor ein Bild ohne Farbe - auf einem Beamer ein weisser Blitz.
 *
 * WELCHE REGELN ENTSTEHEN, UND WARUM NUR DIESE:
 *
 *   :root                          Rueckfallebene, bis der erste Snapshot des
 *                                  Servers da ist.
 *   .stage--default.stage--bright  die helle Fassung. Sie MUSS am
 *                                  Buehnenelement selbst stehen: Die Themefarben
 *                                  kommen als Inline-Variablen am Rahmen an, und
 *                                  eine eigene Deklaration schlaegt einen
 *                                  geerbten Wert.
 *
 * Fuer die dunkle Fassung und die Kinderwelt entsteht BEWUSST keine Regel: Ihre
 * Farben liefert das Theme des laufenden Quiz. Eine Regel hier wuerde ein Theme
 * mit eigenen Farben aussperren.
 */
import { brightPalette, stageExtras, stagePalettes, uiPalette } from '@hfroemmel/quiz-core'

const HEADER = `/*
 * ERZEUGT - NICHT VON HAND BEARBEITEN.
 *
 * Quelle aller Werte: packages/contracts/src/theme.ts
 * Neu schreiben:      pnpm palette:build
 *
 * Wer hier einen Farbwert aendert, aendert ihn nur an der Oberflaeche: Im Betrieb
 * kommen die Buehnenfarben aus dem Quizpaket, das aus derselben Quelle gebaut
 * wird. Der naechste Lauf ueberschreibt die Aenderung, und der Test
 * apps/web/test/palette.test.ts meldet sie vorher.
 */`

function block(selector: string, entries: Record<string, string>): string {
  const lines = Object.entries(entries).map(([name, value]) => `  --${name}: ${value};`)
  return `${selector} {\n${lines.join('\n')}\n}`
}

/** Der Praefix sagt, wem die Farbe gehoert - dem Modus, der Lage oder der Regie. */
function prefixed(entries: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).map(([name, value]) => [`${prefix}${name}`, value]))
}

/** Der vollstaendige Inhalt von `src/styles/palette.css`. */
export function paletteStyleSheet(): string {
  return [
    HEADER,
    '',
    '/* Rueckfallebene: Buehne der Erwachsenen, dunkel - plus alles, was keinem Theme gehoert. */',
    block(':root', {
      ...prefixed(stagePalettes.default, 'color-'),
      ...prefixed(stageExtras, 'stage-'),
      ...prefixed(uiPalette, 'ui-'),
    }),
    '',
    '/* Helle Fassung der Erwachsenenbuehne - nur Flaechen, Kanten und Schrift. */',
    block('.stage--default.stage--bright', prefixed(brightPalette as Record<string, string>, 'color-')),
    '',
  ].join('\n')
}
